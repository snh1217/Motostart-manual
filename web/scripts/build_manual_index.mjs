// Usage: node scripts/build_manual_index.mjs

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

const MIN_TEXT_LENGTH = 200;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;

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

const buildIndex = async () => {
  const entries = await readManifest();
  const records = [];
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

  console.log(
    `done: success=${successCount} missing=${missingCount} shortText=${shortTextCount} error=${errorCount} totalChunks=${totalChunks}`
  );
  console.log(`outputPath: ${OUTPUT_PATH}`);
};

buildIndex().catch((error) => {
  console.error("index build failed", error);
  process.exit(1);
});
