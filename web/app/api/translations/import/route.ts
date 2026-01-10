import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { TranslationItem } from "../../../../lib/types";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";
import { translationsEnabled } from "../../../../lib/featureFlags";

const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "")
    .replace(/[()]/g, "");
};

const headerMap: Record<string, keyof TranslationItem> = {
  entryid: "entryId",
  "메뉴얼id": "entryId",
  "메뉴얼아이디": "entryId",
  "메뉴얼식별자": "entryId",
  "번역제목": "title_ko",
  "한글제목": "title_ko",
  titleko: "title_ko",
  "번역요약": "summary_ko",
  "한글요약": "summary_ko",
  summaryko: "summary_ko",
  "번역본문": "text_ko",
  "한글본문": "text_ko",
  textko: "text_ko",
  "번역pdf": "pdf_ko_url",
  "pdfurl": "pdf_ko_url",
  "pdfko": "pdf_ko_url",
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

const inferModel = (entryId: string): string => {
  const upper = entryId.toUpperCase();
  if (upper.includes("350D")) return "350D";
  if (upper.includes("368G")) return "368G";
  if (upper.includes("368E")) return "368E";
  if (upper.includes("125M")) return "125M";
  if (upper.includes("125D")) return "125D";
  if (upper.includes("125E")) return "125E";
  if (upper.includes("125C")) return "125C";
  if (upper.includes("310M")) return "310M";
  return "UNKNOWN";
};

export async function POST(request: Request) {
  if (!translationsEnabled) {
    return NextResponse.json({ error: "TRANSLATIONS_DISABLED" }, { status: 404 });
  }
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 업로드할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "관리자 토큰이 필요합니다." },
      { status: 401 }
    );
  }

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

  const today = new Date().toISOString().slice(0, 10);

  if (hasSupabaseConfig && supabaseAdmin) {
    const entryIds = Array.from(
      new Set(rows.map((row) => row.entryId).filter(Boolean))
    );
    const existingMetaMap = new Map<string, Record<string, unknown>>();

    if (entryIds.length) {
      const { data: existingRows } = await supabaseAdmin
        .from("translations")
        .select("entry_id,meta")
        .in("entry_id", entryIds);
      existingRows?.forEach((row) => {
        if (row.entry_id) {
          existingMetaMap.set(row.entry_id, (row.meta as Record<string, unknown>) ?? {});
        }
      });
    }

    const payload = rows
      .filter((row) => row.entryId)
      .map((row) => {
        const existingMeta = existingMetaMap.get(row.entryId) ?? {};
        return {
          model: inferModel(row.entryId),
          entry_id: row.entryId,
          title_ko: row.title_ko || null,
          summary_ko: row.summary_ko || null,
          text_ko: row.text_ko || null,
          meta: row.pdf_ko_url
            ? { ...existingMeta, pdf_ko_url: row.pdf_ko_url }
            : Object.keys(existingMeta).length
              ? existingMeta
              : null,
        };
      });

    if (payload.length) {
      const { error } = await supabaseAdmin.from("translations").upsert(payload, {
        onConflict: "model,entry_id",
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      imported: payload.length,
      updated: 0,
      skipped: rows.length - payload.length,
      total: payload.length,
    });
  }

  const existing = await readTranslations();
  const translationMap = new Map(existing.map((item) => [item.entryId, item]));

  let imported = 0;
  let updated = 0;
  let skipped = 0;

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
      pdf_ko_url: row.pdf_ko_url || undefined,
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
