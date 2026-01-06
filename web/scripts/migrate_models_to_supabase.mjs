import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE are required.");
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

const modelsPath = path.resolve(process.cwd(), "data", "models.json");

const main = async () => {
  const raw = await fs.readFile(modelsPath, "utf8");
  const sanitized = raw.replace(/^\uFEFF/, "");
  const parsed = JSON.parse(sanitized);
  if (!Array.isArray(parsed)) {
    throw new Error("models.json is not an array");
  }

  const rows = parsed.map((entry) => ({
    id: String(entry.id ?? "").trim().toUpperCase(),
    name: String(entry.name ?? "").trim(),
    parts_engine_url: entry.parts_engine_url ?? null,
    parts_chassis_url: entry.parts_chassis_url ?? null,
    updated_at: new Date().toISOString(),
  }));

  const filtered = rows.filter((row) => row.id && row.name);
  if (!filtered.length) {
    throw new Error("No valid models found in models.json");
  }

  const { error } = await client.from("models").upsert(filtered, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }

  console.log(`done: ${filtered.length} rows upserted`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
