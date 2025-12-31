import Papa from "papaparse";
import * as XLSX from "xlsx";

type RawRow = Record<string, unknown>;

const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "")
    .replace(/[()]/g, "");
};

const headerMap: Record<string, string> = {
  model: "model",
  "차종": "model",
  "모델": "model",
  system: "system",
  "시스템": "system",
  "고장분류": "system",
  "분류": "system",
  symptom: "symptom",
  "증상": "symptom",
  action: "action",
  "조치": "action",
  "해결": "action",
  fix: "action",
  photo1: "photo_1",
  "사진": "photo_1",
  "사진1": "photo_1",
  "사진1설명": "photo_1_desc",
  photo2: "photo_2",
  "사진2": "photo_2",
  "사진2설명": "photo_2_desc",
  photo3: "photo_3",
  "사진3": "photo_3",
  "사진3설명": "photo_3_desc",
  photo4: "photo_4",
  "사진4": "photo_4",
  "사진4설명": "photo_4_desc",
  photo5: "photo_5",
  "사진5": "photo_5",
  "사진5설명": "photo_5_desc",
};

const normalizeRow = (row: RawRow): Record<string, string> => {
  const normalized: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key);
    const targetKey = headerMap[normalizedKey] ?? headerMap[key];
    if (!targetKey) return;
    normalized[targetKey] = value ? String(value).trim() : "";
  });
  return normalized;
};

export const parseCsv = (content: string): Record<string, string>[] => {
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

export const parseXlsx = (buffer: ArrayBuffer): Record<string, string>[] => {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
  return rows.map(normalizeRow);
};
