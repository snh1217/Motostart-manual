import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { hasSupabaseConfig, supabaseAdmin, supabaseReader } from "./supabase/server";
import type { SpecRow } from "./types";

const specsPath = path.resolve(process.cwd(), "data", "specs.json");

const sanitize = (raw: string) => raw.replace(/^\uFEFF/, "");

const mapRow = (row: Record<string, unknown>): SpecRow => ({
  id: String(row.id ?? ""),
  model: row.model as SpecRow["model"],
  category: row.category as SpecRow["category"],
  item: String(row.item ?? ""),
  value: String(row.value ?? ""),
  note: row.note ? String(row.note) : undefined,
});

export const loadSpecsFromFile = async (): Promise<SpecRow[]> => {
  try {
    const raw = await fs.readFile(specsPath, "utf8");
    const parsed = JSON.parse(sanitize(raw));
    return Array.isArray(parsed) ? (parsed as SpecRow[]) : [];
  } catch {
    return [];
  }
};

export const saveSpecsToFile = async (items: SpecRow[]) => {
  await fs.mkdir(path.dirname(specsPath), { recursive: true });
  await fs.writeFile(specsPath, JSON.stringify(items, null, 2), "utf8");
};

const applyFilters = (
  items: SpecRow[],
  model?: string,
  category?: string
) => {
  return items.filter((row) => {
    if (model && model !== "all" && row.model !== model) return false;
    if (category && category !== "all" && row.category !== category) return false;
    return true;
  });
};

export const loadSpecs = async (filters?: {
  model?: string;
  category?: string;
}): Promise<SpecRow[]> => {
  const { model, category } = filters ?? {};

  if (supabaseReader) {
    const query = supabaseReader.from("specs").select("*");
    if (model && model !== "all") query.eq("model", model);
    if (category && category !== "all") query.eq("category", category);

    const { data, error } = await query.order("updated_at", {
      ascending: false,
    });
    if (!error && data) {
      const mapped = data.map((row) => mapRow(row as Record<string, unknown>));
      return applyFilters(mapped, model, category);
    }
  }

  const items = await loadSpecsFromFile();
  return applyFilters(items, model, category);
};

export const loadSpecsForWrite = async (): Promise<SpecRow[]> => {
  if (hasSupabaseConfig && supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from("specs").select("*");
    if (!error && data) {
      return data.map((row) => mapRow(row as Record<string, unknown>));
    }
  }

  return loadSpecsFromFile();
};

export const upsertSpecsToDb = async (items: SpecRow[]) => {
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return { ok: true as const, skipped: true as const };
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

  const { error } = await supabaseAdmin
    .from("specs")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
};

export const deleteSpecsFromDb = async (ids: string[]) => {
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return { ok: true as const, skipped: true as const };
  }

  if (ids.length === 0) return { ok: true as const };

  const { error } = await supabaseAdmin.from("specs").delete().in("id", ids);
  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
};
