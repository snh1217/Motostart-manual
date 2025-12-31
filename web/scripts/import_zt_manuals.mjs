import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";

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
        return { text: result?.text ?? "", numpages: result?.numpages ?? 1 };
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

const SOURCE_ROOT = process.env.ZT_SOURCE_ROOT;
if (!SOURCE_ROOT) {
  throw new Error("ZT_SOURCE_ROOT is required");
}

const MANIFEST_PATH = path.resolve(
  process.cwd(),
  "public",
  "manuals",
  "manifest.json"
);
const OUTPUT_DIR = path.resolve(process.cwd(), "public", "manuals", "splits");
const MODELS_PATH = path.resolve(process.cwd(), "data", "models.json");
const WIRING_MANIFEST_PATH = path.resolve(
  process.cwd(),
  "data",
  "wiring_manifest.json"
);
const WIRING_PUBLIC_MANIFEST_PATH = path.resolve(
  process.cwd(),
  "public",
  "data",
  "wiring_manifest.json"
);
const WIRING_DIR = path.resolve(process.cwd(), "public", "wiring");

const KOREAN = {
  wiring: "\uD68C\uB85C\uB3C4",
  engine: "\uC5D4\uC9C4",
  chassis: "\uCC28\uB300",
  frame: "\uD504\uB808\uC784",
  userGuide: "\uC0AC\uC6A9\uC124\uBA85\uC11C",
  service: "\uC11C\uBE44\uC2A4",
  maintenance: "\uC720\uC9C0",
  manual: "\uC124\uBA85\uC11C",
  install: "\uC124\uCE58",
  guide: "\uAC00\uC774\uB4DC",
  notice: "\uACF5\uC9C0",
  relay: "\uB9B4\uB808\uC774",
  spoke: "\uC2A4\uD3EC\uD06C",
  rack: "\uB799",
  parts: "\uD30C\uCE20",
  terminal: "\uB2E8\uC790",
};

const EXCLUDED_KEYWORDS = [
  KOREAN.install,
  KOREAN.guide,
  KOREAN.notice,
  "obd",
  KOREAN.terminal,
  KOREAN.relay,
  KOREAN.spoke,
  KOREAN.rack,
  KOREAN.parts,
  "parts",
  "dvr",
];

const toSlug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeModelToken = (token) => {
  let next = String(token ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (next.startsWith("ZT")) next = next.slice(2);
  if (!/^\d{3}/.test(next)) return null;
  if (/^\d{4}$/.test(next)) return null;
  return next;
};

const extractModels = (name) => {
  const upper = name.toUpperCase();
  const matches = upper.match(/\d{3}[A-Z0-9-]{0,6}/g) ?? [];
  const normalized = matches
    .map((token) => normalizeModelToken(token))
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const detectManualType = (name) => {
  const lower = name.toLowerCase();
  if (lower.includes(KOREAN.wiring) || lower.includes("wiring")) return "wiring";
  if (lower.includes(KOREAN.engine) || lower.includes("engine")) return "engine";
  if (
    lower.includes(KOREAN.chassis) ||
    lower.includes("chassis") ||
    lower.includes(KOREAN.frame) ||
    lower.includes("frame")
  ) {
    return "chassis";
  }
  if (
    lower.includes(KOREAN.userGuide) ||
    lower.includes(KOREAN.service) ||
    lower.includes("service") ||
    lower.includes(KOREAN.maintenance) ||
    lower.includes("maintenance") ||
    lower.includes(KOREAN.manual) ||
    lower.includes("manual")
  ) {
    return "user";
  }
  return null;
};

const detectLanguage = (name) => {
  const lower = name.toLowerCase();
  if (lower.includes("\uD55C\uAE00") || lower.includes("\uD55C\uAD6D") || lower.includes("kr")) {
    return "KR";
  }
  return "EN";
};

const shouldSkip = (name) => {
  const lower = name.toLowerCase();
  return EXCLUDED_KEYWORDS.some((keyword) => lower.includes(keyword));
};

const walkDir = async (dir, results = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }
  return results;
};

const readJson = async (filePath, fallback) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    return JSON.parse(sanitized);
  } catch {
    return fallback;
  }
};

const writeJson = async (filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
};

const ensureUniqueFile = async (baseName, extension, dir) => {
  let candidate = `${baseName}.${extension}`;
  let counter = 2;
  while (existsSync(path.join(dir, candidate))) {
    candidate = `${baseName}_${counter}.${extension}`;
    counter += 1;
  }
  return candidate;
};

const importManuals = async (manifest) => {
  const files = await walkDir(SOURCE_ROOT);
  const pdfFiles = files.filter((file) => file.toLowerCase().endsWith(".pdf"));
  const existingKey = new Set(
    manifest.entries.map(
      (entry) => `${entry.model}|${entry.manual_type}|${entry.source_pdf}`
    )
  );
  const newEntries = [];
  const models = new Set();

  for (const filePath of pdfFiles) {
    const baseName = path.basename(filePath);
    if (shouldSkip(baseName)) continue;

    const manualType = detectManualType(baseName);
    if (!manualType || manualType === "wiring") continue;

    const modelsFound = extractModels(baseName);
    if (modelsFound.length === 0) continue;

    let numPages = 1;
    if (process.env.SKIP_PDF_PARSE !== "1") {
      const data = await fs.readFile(filePath);
      const parsed = await pdfParse(data);
      numPages = parsed.numpages || parsed.numPages || 1;
    }

    const slug = toSlug(path.parse(baseName).name) || "manual";
    const language = detectLanguage(baseName);

    for (const model of modelsFound) {
      const key = `${model}|${manualType}|${baseName}`;
      if (existingKey.has(key)) continue;

      const outputBase = `${model}_${manualType}_${slug}`;
      const outputFile = await ensureUniqueFile(outputBase, "pdf", OUTPUT_DIR);
      const targetPath = path.join(OUTPUT_DIR, outputFile);
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      await fs.copyFile(filePath, targetPath);

      const idBase = `${model.toLowerCase()}-${manualType}-${slug}`;
      let entryId = idBase;
      let suffix = 2;
      while (manifest.entries.some((entry) => entry.id === entryId)) {
        entryId = `${idBase}-${suffix}`;
        suffix += 1;
      }

      newEntries.push({
        id: entryId,
        model,
        manual_type: manualType,
        section: slug,
        title: baseName.replace(/\.pdf$/i, ""),
        language,
        pages: { start: 1, end: numPages, total_in_original: numPages },
        source_pdf: baseName,
        file: outputFile,
      });

      existingKey.add(key);
      models.add(model);
    }
  }

  if (newEntries.length) {
    manifest.entries.push(...newEntries);
  }

  return { newEntries, models };
};

const importWiring = async (existing) => {
  const files = await walkDir(SOURCE_ROOT);
  const wiringFiles = files.filter((file) => {
    const lower = file.toLowerCase();
    return (
      (lower.includes(KOREAN.wiring) || lower.includes("wiring")) &&
      (lower.endsWith(".pdf") ||
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg"))
    );
  });

  const existingKey = new Set(existing.map((entry) => `${entry.model}|${entry.file}`));
  const newEntries = [];
  const models = new Set();

  for (const filePath of wiringFiles) {
    const baseName = path.basename(filePath);
    const modelsFound = extractModels(baseName);
    if (modelsFound.length === 0) continue;
    const ext = path.extname(baseName).toLowerCase().replace(".", "");
    const slug = toSlug(path.parse(baseName).name) || "wiring";

    for (const model of modelsFound) {
      const modelDir = path.join(WIRING_DIR, model);
      await fs.mkdir(modelDir, { recursive: true });
      const outputBase = `${slug}`;
      const outputFile = await ensureUniqueFile(outputBase, ext, modelDir);
      const targetPath = path.join(modelDir, outputFile);
      await fs.copyFile(filePath, targetPath);

      const fileUrl = `/wiring/${model}/${outputFile}`;
      const key = `${model}|${fileUrl}`;
      if (existingKey.has(key)) continue;

      const entryId = `${model.toLowerCase()}-${slug}`;
      newEntries.push({
        id: entryId,
        model,
        title: baseName.replace(/\.[^.]+$/, ""),
        tags: [KOREAN.wiring],
        note: "회로도 자료",
        file: fileUrl,
      });

      existingKey.add(key);
      models.add(model);
    }
  }

  return { newEntries, models };
};

const updateModels = async (newModels) => {
  const existing = await readJson(MODELS_PATH, []);
  const existingIds = new Set(existing.map((item) => item.id));
  let updated = false;

  newModels.forEach((model) => {
    if (!existingIds.has(model)) {
      existing.push({ id: model, name: `ZONTES ${model}` });
      updated = true;
    }
  });

  if (updated) {
    existing.sort((a, b) => a.id.localeCompare(b.id));
    await writeJson(MODELS_PATH, existing);
  }
};

const main = async () => {
  const manifest = await readJson(MANIFEST_PATH, { generated_at: "", entries: [] });
  if (!Array.isArray(manifest.entries)) manifest.entries = [];

  const wiringManifest = await readJson(WIRING_MANIFEST_PATH, []);
  const wiringList = Array.isArray(wiringManifest) ? wiringManifest : [];

  const manualsResult = await importManuals(manifest);
  const wiringResult = await importWiring(wiringList);

  if (manualsResult.newEntries.length) {
    manifest.generated_at = new Date().toISOString();
    await writeJson(MANIFEST_PATH, manifest);
  }

  if (wiringResult.newEntries.length) {
    const updatedWiring = [...wiringList, ...wiringResult.newEntries];
    await writeJson(WIRING_MANIFEST_PATH, updatedWiring);
    await writeJson(WIRING_PUBLIC_MANIFEST_PATH, updatedWiring);
  }

  const models = new Set([...manualsResult.models, ...wiringResult.models]);
  await updateModels(models);

  console.log(
    `manuals added: ${manualsResult.newEntries.length}, wiring added: ${wiringResult.newEntries.length}`
  );
};

main().catch((error) => {
  console.error("import failed", error);
  process.exit(1);
});
