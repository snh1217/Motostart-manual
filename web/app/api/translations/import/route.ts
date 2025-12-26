import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { TranslationItem } from "../../../../lib/types";

const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "")
    .replace(/[()]/g, "");
};

const headerMap: Record<string, keyof TranslationItem> = {
  entryid: "entryId",
  메뉴얼id: "entryId",
  메뉴얼아이디: "entryId",
  한글제목: "title_ko",
  titleko: "title_ko",
  한글요약: "summary_ko",
  summaryko: "summary_ko",
  한글본문: "text_ko",
  textko: "text_ko",
};

const normalizeRow = (row: Record<string, unknown>): Record<string, string> => {
  const normalized: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key);
    const targetKey = headerMap[normalizedKey];
    if (!targetKey) return;
    normalized[targetKey] = value ? String(value).trim() : "";
  });
  return normalized;
};

const parseCsv = (content: string) => {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length) {
    const firstError = result.errors[0];
    throw new Error(`CSV parse error: ${firstError.message}`);
  }

  return result.data.map(normalizeRow);
};

const parseXlsx = (buffer: ArrayBuffer) => {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return rows.map(normalizeRow);
};

const translationsPath = path.resolve(
  process.cwd(),
  "data",
  "translations.json"
);

const readTranslations = async (): Promise<TranslationItem[]> => {
  try {
    const raw = await fs.readFile(translationsPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
  } catch {
    return [];
  }
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const extension = fileName.split(".").pop() ?? "";
  let rows: Record<string, string>[] = [];

  try {
    if (extension === "csv") {
      const content = await file.text();
      rows = parseCsv(content);
    } else if (extension === "xlsx") {
      const buffer = await file.arrayBuffer();
      rows = parseXlsx(buffer);
    } else {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다." },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "파싱 오류" },
      { status: 400 }
    );
  }

  const existing = await readTranslations();
  const translationMap = new Map(
    existing.map((item) => [item.entryId, item])
  );

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const today = new Date().toISOString().slice(0, 10);

  rows.forEach((row) => {
    if (!row.entryId) {
      skipped += 1;
      return;
    }

    const nextItem: TranslationItem = {
      entryId: row.entryId,
      title_ko: row.title_ko || undefined,
      summary_ko: row.summary_ko || undefined,
      text_ko: row.text_ko || undefined,
      updated_at: today,
    };

    if (translationMap.has(row.entryId)) {
      updated += 1;
    } else {
      imported += 1;
    }

    translationMap.set(row.entryId, nextItem);
  });

  const combined = Array.from(translationMap.values());
  await fs.mkdir(path.dirname(translationsPath), { recursive: true });
  await fs.writeFile(translationsPath, JSON.stringify(combined, null, 2), "utf8");

  return NextResponse.json({
    imported,
    updated,
    skipped,
    total: combined.length,
  });
}
