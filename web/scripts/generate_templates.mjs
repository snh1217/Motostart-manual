import { promises as fs } from "fs";
import path from "path";
import * as XLSX from "xlsx";

const templatesDir = path.resolve(process.cwd(), "public", "templates");

const caseHeaders = [
  "model",
  "system",
  "category",
  "symptomTitle",
  "diagnosisTreeId",
  "diagnosisResultId",
  "title",
  "description",
  "fixSteps",
  "tags",
  "references",
  "parts",
  "photo_1",
  "photo_1_desc",
  "photo_2",
  "photo_2_desc",
  "photo_3",
  "photo_3_desc",
  "photo_4",
  "photo_4_desc",
  "photo_5",
  "photo_5_desc",
];
const caseRows = [
  {
    model: "350D",
    system: "engine",
    category: "Engine",
    symptomTitle: "Poor acceleration",
    diagnosisTreeId: "poor_acceleration_v1",
    diagnosisResultId: "r3",
    title: "Throttle cable free play out of spec",
    description: "Low acceleration after warm-up",
    fixSteps: "Adjust throttle cable free play to spec",
    tags: "engine,acceleration",
    references: "https://example.com",
    parts: "Throttle cable",
    photo_1: "",
    photo_1_desc: "",
    photo_2: "",
    photo_2_desc: "",
    photo_3: "",
    photo_3_desc: "",
    photo_4: "",
    photo_4_desc: "",
    photo_5: "",
    photo_5_desc: "",
  },
  {
    model: "368G",
    system: "engine",
    category: "Idle",
    symptomTitle: "High hot idle",
    diagnosisTreeId: "high_hot_idle_v1",
    diagnosisResultId: "r4",
    title: "Coolant temp sensor fault",
    description: "Idle speed remains high after warm-up",
    fixSteps: "Inspect wiring and replace coolant temperature sensor",
    tags: "idle,sensor",
    references: "",
    parts: "Coolant temperature sensor",
    photo_1: "",
    photo_1_desc: "",
    photo_2: "",
    photo_2_desc: "",
    photo_3: "",
    photo_3_desc: "",
    photo_4: "",
    photo_4_desc: "",
    photo_5: "",
    photo_5_desc: "",
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

const translationHeaders = ["매뉴얼ID", "한글제목", "한글요약", "한글본문"];

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
        { 매뉴얼ID: "example-entry-1", 한글제목: "", 한글요약: "", 한글본문: "" },
      ];
    }

    return ids.map((id) => ({
      매뉴얼ID: id,
      한글제목: "",
      한글요약: "",
      한글본문: "",
    }));
  } catch {
    return [
      { 매뉴얼ID: "example-entry-1", 한글제목: "", 한글요약: "", 한글본문: "" },
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
