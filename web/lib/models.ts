import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { hasSupabaseConfig, supabaseAdmin } from "./supabase/server";
import { sortModelCodes } from "./modelSort";

export type ModelEntry = {
  id: string;
  name: string;
  parts_engine_url?: string;
  parts_chassis_url?: string;
  updated_at?: string;
};

const modelsPath = path.resolve(process.cwd(), "data", "models.json");

const readModelsFromFile = async (): Promise<ModelEntry[]> => {
  try {
    const raw = await fs.readFile(modelsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as ModelEntry[]) : [];
  } catch {
    return [];
  }
};

export const loadModels = async (): Promise<ModelEntry[]> => {
  if (hasSupabaseConfig && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("models")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error) {
      const rows = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        parts_engine_url: row.parts_engine_url ?? undefined,
        parts_chassis_url: row.parts_chassis_url ?? undefined,
        updated_at: row.updated_at ?? undefined,
      }));
      return sortModelCodes(rows);
    }
  }

  const items = await readModelsFromFile();
  return sortModelCodes(items);
};

