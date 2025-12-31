import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.MANUALS_BUCKET || "manuals";
const localDir = process.env.MANUALS_LOCAL_DIR || path.resolve(process.cwd(), "public", "manuals", "splits");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const uploadFile = async (filePath, remotePath) => {
  const buffer = await fs.readFile(filePath);
  const { error } = await supabase.storage.from(bucket).upload(remotePath, buffer, {
    upsert: true,
    contentType: "application/pdf",
  });

  if (error) {
    throw error;
  }
};

const main = async () => {
  const entries = await fs.readdir(localDir, { withFileTypes: true });
  const files = entries.filter((ent) => ent.isFile()).map((ent) => ent.name);

  let uploaded = 0;
  for (const file of files) {
    const src = path.join(localDir, file);
    const dest = `splits/${file}`;
    try {
      await uploadFile(src, dest);
      uploaded += 1;
      process.stdout.write(`uploaded ${uploaded}/${files.length}: ${file}\n`);
    } catch (error) {
      process.stdout.write(`failed ${file}: ${error}\n`);
    }
  }

  process.stdout.write(`done: ${uploaded}/${files.length}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
