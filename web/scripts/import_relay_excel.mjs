#!/usr/bin/env node
/**
 * Transform 368E 전장.xlsx 릴레이 시트를 PartEntry 형태로 변환합니다.
 * 사용법:
 *   node scripts/import_relay_excel.mjs "C:/Users/내PC/Desktop/정비 앱 자료/368E 전장.xlsx"
 *
 * 출력:
 *   - stdout에 PartEntry JSON 배열
 *   - web/data/parts_relay_import.json 파일 생성
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const inputPath =
  process.argv[2] ??
  "C:/Users/내PC/Desktop/정비 앱 자료/368E 전장.xlsx";

const sheetName = "릴레이";
const outputPath = path.resolve(
  process.cwd(),
  "data",
  "parts_relay_import.json"
);

const normalize = (v) => (v || "").toString().trim();

const wb = XLSX.readFile(inputPath);
const sheet = wb.Sheets[sheetName];
if (!sheet) {
  console.error(`시트 '${sheetName}'을 찾을 수 없습니다.`);
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const parts = [];
let current = null;

rows.forEach((row, idx) => {
  const model = normalize(row["차종"]) || current?.model || "368E";
  const name = normalize(row["부품명"]);
  const note = normalize(row["비고"]);
  const pinName = normalize(row["핀배열"]);
  const pinDesc = normalize(row["핀 설명"]);
  const removal = normalize(row["탈거순서(파트리스트)"]);
  const bolts = normalize(row["분해볼트"]);
  const location = normalize(row["부품위치"]);

  // 새 부품 시작 (부품명이 있을 때)
  if (name) {
    const slug = (value) =>
      value
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    const baseId = slug(`${model}-${name}`) || `part-${model}-${idx + 1}`;
    current = {
      id: baseId,
      model,
      system: "electrical",
      name,
      summary: removal || "",
      tags: ["릴레이"],
      photos: [],
      steps: [],
      updated_at: new Date().toISOString().slice(0, 10),
    };
    if (note) current.tags.push("비고");
    parts.push(current);
  }

  if (!current) return;

  // 핀 정보는 step으로 저장
  if (pinName || pinDesc) {
    current.steps.push({
      order: current.steps.length + 1,
      title: pinName ? `핀 ${pinName}` : `핀 ${current.steps.length + 1}`,
      desc: pinDesc || undefined,
      note: [location, removal, bolts, note].filter(Boolean).join(" / ") || undefined,
    });
  }
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(parts, null, 2), "utf8");
console.log(JSON.stringify(parts, null, 2));
console.log(`\n총 ${parts.length}건 -> ${outputPath}`);
