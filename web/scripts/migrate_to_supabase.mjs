import fs from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const readJson = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const inferModel = (entryId) => {
  const upper = entryId.toUpperCase();
  if (upper.includes("350D")) return "350D";
  if (upper.includes("368G")) return "368G";
  if (upper.includes("125M")) return "125M";
  return "UNKNOWN";
};

const cwd = process.cwd();
const translationsPathCandidates = [
  path.resolve(cwd, "public", "data", "translations.json"),
  path.resolve(cwd, "data", "translations.json"),
];
const casesPathCandidates = [
  path.resolve(cwd, "public", "data", "cases.json"),
  path.resolve(cwd, "data", "cases.json"),
];

const resolveExisting = async (candidates) => {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
};

const run = async () => {
  const translationsPath = await resolveExisting(translationsPathCandidates);
  const casesPath = await resolveExisting(casesPathCandidates);

  const translations = translationsPath ? await readJson(translationsPath) : [];
  const cases = casesPath ? await readJson(casesPath) : [];

  const translationPayload = (translations || [])
    .filter((item) => item.entryId)
    .map((item) => ({
      model: inferModel(item.entryId),
      entry_id: item.entryId,
      title_ko: item.title_ko ?? null,
      summary_ko: item.summary_ko ?? null,
      text_ko: item.text_ko ?? null,
    }));

  if (translationPayload.length) {
    const { error } = await supabase
      .from("translations")
      .upsert(translationPayload, { onConflict: "model,entry_id" });
    if (error) {
      console.error("translations upsert failed:", error.message);
    } else {
      console.log(`translations upserted: ${translationPayload.length}`);
    }
  } else {
    console.log("no translations to migrate");
  }

  const casePayload = (cases || [])
    .filter((item) => item.model && item.system && item.symptom && item.action)
    .map((item) => ({
      model: item.model,
      system: item.system,
      symptom: item.symptom,
      action: item.action,
      cause: item.cause ?? null,
      parts: item.parts ?? null,
      tags: item.tags ?? null,
      ref_manual_file: item.ref_manual_file ?? null,
      ref_manual_page: item.ref_manual_page ?? null,
      ref_youtube: item.ref_youtube ?? null,
    }));

  if (casePayload.length) {
    const { error } = await supabase.from("cases").insert(casePayload);
    if (error) {
      console.error("cases insert failed:", error.message);
    } else {
      console.log(`cases inserted: ${casePayload.length}`);
    }
  } else {
    console.log("no cases to migrate");
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
