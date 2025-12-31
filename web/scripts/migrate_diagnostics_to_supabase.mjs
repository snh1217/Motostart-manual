import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const filePath = path.resolve(process.cwd(), "data", "diagnostics_manifest.json");

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
    throw new Error("diagnostics_manifest.json is not an array");
  }

  let upserted = 0;
  for (const item of items) {
    const payload = {
      id: item.id,
      model: item.model,
      title: item.title,
      section: item.section ?? null,
      image: item.image,
      lines: item.lines ?? [],
      note: item.note ?? null,
      updated_at: item.updated_at ?? null,
    };

    const { error } = await supabase
      .from("diagnostics")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error(`failed ${item.id}: ${error.message}`);
    } else {
      upserted += 1;
    }
  }

  console.log(`done: ${upserted}/${items.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
