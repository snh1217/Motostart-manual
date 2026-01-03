import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const filePath = path.resolve(process.cwd(), "data", "specs.json");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const main = async () => {
  const raw = await fs.readFile(filePath, "utf8");
  const sanitized = raw.replace(/^\uFEFF/, "");
  const items = JSON.parse(sanitized);

  if (!Array.isArray(items)) {
    throw new Error("specs.json is not an array");
  }

  const now = new Date().toISOString();
  const payload = items.map((item) => ({
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
    throw new Error(`specs upsert failed: ${error.message}`);
  }

  console.log(`done: ${payload.length} rows upserted`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
