import { promises as fs } from "fs";
import path from "path";
import * as XLSX from "xlsx";

const templatesDir = path.resolve(process.cwd(), "public", "templates");

const caseHeaders = ["차종", "고장분류", "증상", "조치", "사진1", "사진2", "사진3"];
const caseRows = [
  {
    차종: "350D",
    고장분류: "엔진",
    증상: "드레인볼트 토크값 확인 필요",
    조치: "매뉴얼 기준 23 N·m로 체결",
    사진1: "",
    사진2: "",
    사진3: "",
  },
  {
    차종: "368G",
    고장분류: "차대",
    증상: "브레이크 레버 유격 과다",
    조치: "레버 유격 조정 후 재점검",
    사진1: "",
    사진2: "",
    사진3: "",
  },
  {
    차종: "125M",
    고장분류: "전장",
    증상: "시동 후 경고등 점등",
    조치: "배선 커넥터 접촉 상태 확인",
    사진1: "",
    사진2: "",
    사진3: "",
  },
];

const videoHeaders = ["차종", "고장분류", "제목", "링크", "태그"];
const videoRows = [
  {
    차종: "368G",
    고장분류: "엔진",
    제목: "엔진 오일 교환",
    링크: "https://example.com",
    태그: "오일, 엔진",
  },
];

const translationHeaders = ["메뉴얼ID", "한글제목", "한글요약", "한글본문"];

const toCsvValue = (value) => {
  const text = String(value ?? "");
  if (text.includes("\"") || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/\"/g, "\"\"")}"`;
  }
  return text;
};

const buildCsv = (headers, rows) => {
  const lines = [];
  lines.push(headers.join(","));
  rows.forEach((row) => {
    const line = headers.map((header) => toCsvValue(row[header])).join(",");
    lines.push(line);
  });
  return lines.join("\n");
};

const writeXlsx = (headers, rows, sheetName, filePath) => {
  const data = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filePath);
};

const loadTranslationRows = async () => {
  const manifestPath = path.resolve(
    process.cwd(),
    "public",
    "manuals",
    "manifest.json"
  );
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const ids = entries.slice(0, 3).map((entry) => entry.id);

    if (ids.length === 0) {
      return [
        { 메뉴얼ID: "example-entry-1", 한글제목: "", 한글요약: "", 한글본문: "" },
      ];
    }

    return ids.map((id) => ({
      메뉴얼ID: id,
      한글제목: "",
      한글요약: "",
      한글본문: "",
    }));
  } catch {
    return [
      { 메뉴얼ID: "example-entry-1", 한글제목: "", 한글요약: "", 한글본문: "" },
    ];
  }
};

const main = async () => {
  await fs.mkdir(templatesDir, { recursive: true });

  const casesCsvPath = path.join(templatesDir, "cases_template.csv");
  await fs.writeFile(casesCsvPath, buildCsv(caseHeaders, caseRows), "utf8");

  const casesXlsxPath = path.join(templatesDir, "cases_template.xlsx");
  writeXlsx(caseHeaders, caseRows, "cases", casesXlsxPath);

  const videosCsvPath = path.join(templatesDir, "videos_template.csv");
  await fs.writeFile(videosCsvPath, buildCsv(videoHeaders, videoRows), "utf8");

  const videosXlsxPath = path.join(templatesDir, "videos_template.xlsx");
  writeXlsx(videoHeaders, videoRows, "videos", videosXlsxPath);

  const translationRows = await loadTranslationRows();
  const translationsCsvPath = path.join(
    templatesDir,
    "translations_template.csv"
  );
  await fs.writeFile(
    translationsCsvPath,
    buildCsv(translationHeaders, translationRows),
    "utf8"
  );

  const translationsXlsxPath = path.join(
    templatesDir,
    "translations_template.xlsx"
  );
  writeXlsx(translationHeaders, translationRows, "translations", translationsXlsxPath);

  console.log(`templates generated in ${templatesDir}`);
};

main().catch((error) => {
  console.error("template generation failed", error);
  process.exit(1);
});