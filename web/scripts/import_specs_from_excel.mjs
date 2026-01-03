import { promises as fs } from "fs";
import path from "path";
import * as XLSXModule from "xlsx";
import { createClient } from "@supabase/supabase-js";

const XLSX = XLSXModule.default ?? XLSXModule;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = Boolean(supabaseUrl && serviceRoleKey);
const supabase = hasSupabase
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
  : null;

const SPEC_PATH = path.resolve(process.cwd(), "data", "specs.json");
const MODELS_PATH = path.resolve(process.cwd(), "data", "models.json");
const INPUT_FILES = [
  "D:\\롤링업무\\ZT\\제원, 토르크.xlsx",
  "D:\\롤링업무\\ZT\\ZT 토르크.xlsx",
  "D:\\롤링업무\\ZT\\ZONTES 쇼바오일 용량(25.12.19).xlsx",
];

const normalizeModelToken = (token) => {
  let next = String(token ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (next.startsWith("ZT")) next = next.slice(2);
  if (!/^\d{3}/.test(next)) return null;
  return next;
};

const toSlug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const hashText = (value) => {
  let hash = 5381;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const safeSlug = (value) => {
  const slug = toSlug(String(value ?? ""));
  if (slug) return slug;
  return `k${hashText(value)}`;
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

const addSpec = (specs, row) => {
  const key = `${row.model}|${row.category}|${row.item}`.toLowerCase();
  const existingIndex = specs.findIndex(
    (item) =>
      `${item.model}|${item.category}|${item.item}`.toLowerCase() === key
  );
  if (existingIndex >= 0) {
    specs[existingIndex] = { ...specs[existingIndex], ...row };
    return;
  }
  specs.push(row);
};

const categoryForHeader = (header) => {
  if (header.includes("토크") || header.toLowerCase().includes("torque")) {
    return "torque";
  }
  if (header.includes("오일") || header.includes("냉각수")) {
    return "oil";
  }
  if (header.includes("브레이크오일") || header.includes("연료탱크")) {
    return "consumable";
  }
  return null;
};

const parseTorqueSheet = (sheet, specs, models) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length < 2) return;
  const header = rows[0].map((cell) => String(cell).trim());

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const model = normalizeModelToken(row[0]);
    if (!model) continue;
    models.add(model);

    for (let col = 1; col < header.length; col += 1) {
      const label = header[col];
      const value = row[col];
      if (!label || value === "" || value === null || value === undefined) continue;
      const category = categoryForHeader(label);
      if (!category) continue;
      addSpec(specs, {
        id: `spec-${toSlug(model)}-${toSlug(category)}-${safeSlug(label)}`,
        model,
        category,
        item: label,
        value: String(value).trim(),
      });
    }
  }
};

const parseAssemblyTorqueSheet = (sheet, specs, models) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length < 2) return;
  const model = normalizeModelToken(rows[0][0]);
  if (!model) return;
  models.add(model);

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const item = String(row[1] || row[0] || "").trim();
    const value = String(row[3] || "").trim();
    if (!item || !value) continue;
    addSpec(specs, {
      id: `spec-${toSlug(model)}-torque-${safeSlug(item)}`,
      model,
      category: "torque",
      item,
      value,
    });
  }
};

const parseShockOilSheet = (sheet, specs, models) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length < 2) return;
  const header = rows[0].map((cell) => String(cell).replace(/\s+/g, " ").trim());

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    for (let col = 1; col < header.length; col += 2) {
      const modelLabel = row[col];
      const value = row[col + 1];
      if (!modelLabel || !value) continue;
      const model = normalizeModelToken(modelLabel);
      if (!model) continue;
      models.add(model);
      const itemHeader = header[col] ? `${header[col]} 오일 용량` : "쇼바 오일 용량";
      addSpec(specs, {
        id: `spec-${toSlug(model)}-oil-${safeSlug(itemHeader)}`,
        model,
        category: "oil",
        item: itemHeader,
        value: String(value).trim(),
      });
    }
  }
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
  const specs = await readJson(SPEC_PATH, []);
  const models = new Set();

  for (const file of INPUT_FILES) {
    const workbook = XLSX.readFile(file);
    const sheetNames = workbook.SheetNames;
    if (sheetNames[0]) {
      parseTorqueSheet(workbook.Sheets[sheetNames[0]], specs, models);
    }
    if (sheetNames[1]) {
      parseAssemblyTorqueSheet(workbook.Sheets[sheetNames[1]], specs, models);
    }
  }

  const shockFile = INPUT_FILES[2];
  const shockWorkbook = XLSX.readFile(shockFile);
  const shockSheet = shockWorkbook.Sheets[shockWorkbook.SheetNames[0]];
  if (shockSheet) {
    parseShockOilSheet(shockSheet, specs, models);
  }

  await writeJson(SPEC_PATH, specs);
  await updateModels(models);

  if (hasSupabase && supabase) {
    const now = new Date().toISOString();
    const payload = specs.map((item) => ({
      id: item.id,
      model: item.model,
      category: item.category,
      item: item.item,
      value: item.value,
      note: item.note ?? null,
      updated_at: now,
    }));
    const { error } = await supabase
      .from("specs")
      .upsert(payload, { onConflict: "id" });
    if (error) {
      console.error(`specs upsert failed: ${error.message}`);
    } else {
      console.log(`specs upserted: ${payload.length}`);
    }
  }

  console.log(`specs updated: ${specs.length}`);
};

main().catch((error) => {
  console.error("spec import failed", error);
  process.exit(1);
});
