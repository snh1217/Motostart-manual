import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
const pdfParseModule = await import("pdf-parse");
const resolvePdfParser = () => {
  if (typeof pdfParseModule === "function") return pdfParseModule;
  if (typeof pdfParseModule.default === "function") return pdfParseModule.default;
  if (typeof pdfParseModule.pdfParse === "function") return pdfParseModule.pdfParse;
  if (typeof pdfParseModule.parse === "function") return pdfParseModule.parse;
  if (typeof pdfParseModule.default?.default === "function") {
    return pdfParseModule.default.default;
  }

  if (typeof pdfParseModule.PDFParse === "function") {
    return async (data) => {
      const parser = new pdfParseModule.PDFParse({ data });
      try {
        const result = await parser.getText();
        return { text: result?.text ?? "" };
      } finally {
        if (typeof parser.destroy === "function") {
          await parser.destroy();
        }
      }
    };
  }

  const exportedKeys = Object.keys(pdfParseModule);
  throw new Error(`Unsupported pdf-parse export: ${exportedKeys.join(", ")}`);
};

const pdfParse = resolvePdfParser();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFEST_PATH = path.resolve(
  process.cwd(),
  "public",
  "manuals",
  "manifest.json"
);
const OUTPUT_PATH = path.resolve(process.cwd(), "data", "manual_index.json");
const KEYWORDS_PATH = path.resolve(process.cwd(), "data", "manual_keywords.json");

const MIN_TEXT_LENGTH = 200;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;
const KEYWORDS_LIMIT = 20;
const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "from",
  "that",
  "this",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "into",
  "onto",
  "over",
  "under",
  "about",
  "part",
  "parts",
  "page",
  "figure",
  "section",
  "engine",
  "system",
  "manual",
  "spec",
  "specification",
  "bolt",
  "torque",
  "tighten",
  "value",
  "values",
  "item",
  "items",
  "note",
  "notes",
  "주의",
  "참고",
  "그림",
  "표",
  "페이지",
  "장",
  "항목",
  "값",
  "토크",
  "볼트",
  "너트",
  "규격",
  "확인",
  "점검",
  "경우",
  "check",
  "use",
  "using",
]);

const extractRegexKeywords = (text) => {
  const matches = new Set();
  const addMatches = (regex) => {
    const found = text.match(regex);
    if (found) {
      found.forEach((item) => matches.add(item));
    }
  };

  addMatches(/[A-Z]{1,3}-?\d{2,4}/g); // error codes like P0300, E-123
  addMatches(
    /\b\d+(\.\d+)?\s?[~-]\s?\d+(\.\d+)?\s?(?:mm|cm|V|v|A|a|k?Pa|psi|bar|kgf\/cm²)\b/gi
  ); // ranges like 0.5~0.8mm, 10-12V
  addMatches(/\b\d+\s?(?:Pin|PIN|pin|P)\b/g); // connectors like 3P, 4 Pin
  addMatches(/\b\d+(\.\d+)?\s?(?:L|ml|ML|cc|CC)\b/g); // volumes like 1.5L, 300ml
  addMatches(/\b(?:psi|kPa|KPA|bar|kgf\/cm²)\b/g); // pressure units
  addMatches(/\b\d{1,4}\s?(?:V|v|A|a|W|w|Nm|N·m|n·m|MPa|mpa|kgf|kgf·m|mm|cm)\b/g);
  addMatches(/\b\d+(\.\d+)?\s?(?:Nm|kgf[·\\-\\.]?m|ft[·\\-\\.]?lb)\b/gi); // torque
  addMatches(/\b\d+(\.\d+)?\s?(?:°C|°F|Ω|kΩ|ohm)\b/gi); // temp & resistance
  addMatches(/\b(?:M\d+|\d+mm)\s?(?:bolt|nut|screw)?\b/gi); // hardware sizes
  addMatches(/\b[A-Z0-9]{3,}-[A-Z0-9]{3,}(?:-[A-Z0-9]{3,})?\b/gi); // part numbers with hyphens
  addMatches(/\b[A-Z0-9]{4,}\b/g); // fallback part numbers

  return Array.from(matches);
};

const readManifest = async () => {
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error("manifest.json is missing entries array");
  }
  return parsed.entries;
};

const normalizeText = (text) => {
  return text.replace(/\s+/g, " ").trim();
};

const chunkText = (text) => {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
};

const padIndex = (index) => String(index).padStart(4, "0");

const extractKeywords = (text) => {
  const tokens = text
    .toLowerCase()
    .match(/[a-z0-9가-힣]+/g);
  if (!tokens) return [];

  const freq = new Map();
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (STOPWORDS.has(token)) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  const ranked = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, KEYWORDS_LIMIT)
    .map(([token]) => token);

  const regexKeywords = extractRegexKeywords(text);
  const merged = [...new Set([...regexKeywords, ...ranked])];
  return merged.slice(0, KEYWORDS_LIMIT + regexKeywords.length);
};

const buildIndex = async () => {
  const entries = await readManifest();
  const records = [];
  const keywordEntries = [];
  let successCount = 0;
  let missingCount = 0;
  let shortTextCount = 0;
  let errorCount = 0;
  let totalChunks = 0;

  console.log(`cwd: ${process.cwd()}`);
  console.log(`manifestPath: ${MANIFEST_PATH}`);
  console.log(`manifest entries: ${entries.length}`);

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry?.file) {
      console.warn(`[${i + 1}/${entries.length}] MISSING_FILE entryId=${entry?.id ?? "unknown"}`);
      missingCount += 1;
      continue;
    }

    const pdfPath = path.resolve(
      process.cwd(),
      "public",
      "manuals",
      "splits",
      entry.file
    );

    console.log(
      `[${i + 1}/${entries.length}] id=${entry.id} model=${entry.model} type=${entry.manual_type} file=${entry.file}`
    );

    if (!existsSync(pdfPath)) {
      console.warn(`[${i + 1}/${entries.length}] MISSING ${pdfPath}`);
      missingCount += 1;
      continue;
    }

    try {
      const data = await fs.readFile(pdfPath);
      const header = data.slice(0, 5).toString("utf8");
      if (header !== "%PDF-") {
        console.warn(`[${i + 1}/${entries.length}] INVALID_PDF_HEADER ${header}`);
        errorCount += 1;
        continue;
      }

      const parsed = await pdfParse(data);
      const text = normalizeText(parsed.text || "");
      console.log(`[${i + 1}/${entries.length}] textLen=${text.length}`);

      if (text.length < MIN_TEXT_LENGTH) {
        console.warn(`[${i + 1}/${entries.length}] SKIP_SHORTTEXT len=${text.length}`);
        shortTextCount += 1;
        continue;
      }

      const chunks = chunkText(text);
      console.log(`[${i + 1}/${entries.length}] chunks=${chunks.length}`);

      chunks.forEach((chunk, index) => {
        records.push({
          id: `${entry.id}__${padIndex(index + 1)}`,
          entryId: entry.id,
          model: entry.model,
          manual_type: entry.manual_type,
          title: entry.title,
          file: entry.file,
          pages: { start: entry.pages.start, end: entry.pages.end },
          text: chunk,
        });
      });

      const keywords = extractKeywords(text);
      keywordEntries.push({
        entryId: entry.id,
        model: entry.model,
        manual_type: entry.manual_type,
        title: entry.title,
        file: entry.file,
        pages: { start: entry.pages.start, end: entry.pages.end },
        keywords,
      });

      totalChunks += chunks.length;
      successCount += 1;
    } catch (error) {
      errorCount += 1;
      console.warn(`[${i + 1}/${entries.length}] ERROR ${entry.file}`);
      if (error instanceof Error) {
        console.warn(`  reason: ${error.message}`);
      }
    }
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(records, null, 2), "utf8");
  await fs.writeFile(KEYWORDS_PATH, JSON.stringify(keywordEntries, null, 2), "utf8");

  console.log(
    `done: success=${successCount} missing=${missingCount} shortText=${shortTextCount} error=${errorCount} totalChunks=${totalChunks}`
  );
  console.log(`outputPath: ${OUTPUT_PATH}`);
  console.log(`keywordsPath: ${KEYWORDS_PATH}`);
};

buildIndex().catch((error) => {
  console.error("index build failed", error);
  process.exit(1);
});
