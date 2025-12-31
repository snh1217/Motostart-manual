import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import type { SpecRow } from "../../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const specsPath = path.resolve(process.cwd(), "data", "specs.json");

const normalizeHeader = (header: string): string =>
  header
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "")
    .replace(/[()]/g, "");

const headerMap: Record<string, keyof SpecRow> = {
  id: "id",
  model: "model",
  "모델": "model",
  category: "category",
  "카테고리": "category",
  item: "item",
  "항목": "item",
  value: "value",
  "값": "value",
  note: "note",
  "비고": "note",
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
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });
  return rows.map(normalizeRow);
};

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildKey = (row: SpecRow) =>
  `${row.model}|${row.category}|${row.item}`.toLowerCase();

const readSpecs = async (): Promise<SpecRow[]> => {
  try {
    const raw = await fs.readFile(specsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as SpecRow[]) : [];
  } catch {
    return [];
  }
};

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 업로드할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "Admin_Key가 필요합니다." },
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

  const existing = await readSpecs();
  const byId = new Map(existing.map((item) => [item.id, item]));
  const byKey = new Map(existing.map((item) => [buildKey(item), item]));

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  rows.forEach((row) => {
    const model = row.model?.toUpperCase();
    const category = row.category;
    const item = row.item;
    const value = row.value;

    if (!model || !category || !item || !value) {
      skipped += 1;
      return;
    }

    const nextRow: SpecRow = {
      id: row.id ?? "",
      model: model as SpecRow["model"],
      category,
      item,
      value,
      note: row.note || undefined,
    };

    const key = buildKey(nextRow);
    const existingByKey = byKey.get(key);

    if (nextRow.id && byId.has(nextRow.id)) {
      updated += 1;
      byId.set(nextRow.id, nextRow);
      byKey.set(key, nextRow);
      return;
    }

    if (!nextRow.id && existingByKey) {
      updated += 1;
      byId.set(existingByKey.id, { ...nextRow, id: existingByKey.id });
      byKey.set(key, { ...nextRow, id: existingByKey.id });
      return;
    }

    const baseId = `spec-${toSlug(model)}-${toSlug(category)}-${toSlug(item)}`;
    let candidateId = nextRow.id || baseId || `spec-${Date.now()}`;
    let counter = 2;
    while (byId.has(candidateId)) {
      candidateId = `${baseId}-${counter}`;
      counter += 1;
    }

    const createdRow = { ...nextRow, id: candidateId };
    imported += 1;
    byId.set(createdRow.id, createdRow);
    byKey.set(key, createdRow);
  });

  const combined = Array.from(byId.values());
  await fs.mkdir(path.dirname(specsPath), { recursive: true });
  await fs.writeFile(specsPath, JSON.stringify(combined, null, 2), "utf8");

  return NextResponse.json({
    imported,
    updated,
    skipped,
    total: combined.length,
  });
}
