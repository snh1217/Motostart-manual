import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { hasSupabaseConfig, supabaseAdmin } from "./supabase/server";
import { isReadOnlyMode, isAdminAuthorized } from "./auth/admin";
import type { PartEntry, PartPhoto, PartStep } from "./types";

const partsPath = path.resolve(process.cwd(), "data", "parts.json");

const sanitize = (raw: string) => raw.replace(/^\uFEFF/, "");

export const loadPartsFromFile = async (): Promise<PartEntry[]> => {
  try {
    const raw = await fs.readFile(partsPath, "utf8");
    const parsed = JSON.parse(sanitize(raw));
    return Array.isArray(parsed) ? (parsed as PartEntry[]) : [];
  } catch {
    return [];
  }
};

export const savePartsToFile = async (items: PartEntry[]) => {
  await fs.mkdir(path.dirname(partsPath), { recursive: true });
  await fs.writeFile(partsPath, JSON.stringify(items, null, 2), "utf8");
};

export const loadParts = async (filters?: {
  model?: string;
  system?: string;
  q?: string;
}): Promise<PartEntry[]> => {
  const { model, system, q } = filters ?? {};

  if (hasSupabaseConfig && supabaseAdmin) {
    const query = supabaseAdmin.from("parts").select("*");
    if (model && model !== "all") query.eq("model", model);
    if (system && system !== "all") query.eq("system", system);
    const { data, error } = await query.order("updated_at", {
      ascending: false,
    });
    if (error) {
      // fall back to file
      const items = await loadPartsFromFile();
      return applyFilters(items, model, system, q).map((item) => ({
        ...item,
        source: "json",
      }));
    }
    const items = (data ?? []).map((row) => ({
      id: row.id,
      model: row.model,
      system: row.system,
      name: row.name,
      summary: row.summary ?? undefined,
      tags: row.tags ?? [],
      photos: row.photos ?? [],
      steps: row.steps ?? [],
      updated_at: row.updated_at ?? undefined,
      source: "db" as const,
    }));
    return applyFilters(items, model, system, q);
  }

  const items = await loadPartsFromFile();
  return applyFilters(items, model, system, q).map((item) => ({
    ...item,
    source: "json" as const,
  }));
};

const applyFilters = (
  items: PartEntry[],
  model?: string,
  system?: string,
  q?: string
) => {
  const tokens =
    q
      ?.toLowerCase()
      .split(/\s+/)
      .filter(Boolean) ?? [];

  return items.filter((item) => {
    if (model && model !== "all" && item.model !== model) return false;
    if (system && system !== "all" && item.system !== system) return false;
    if (!tokens.length) return true;
    const haystack = [
      item.name,
      item.summary,
      item.tags?.join(" "),
      item.steps?.map((s) => `${s.title} ${s.desc} ${s.tools} ${s.torque}`).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
};

export const upsertPart = async (payload: PartEntry, request: Request) => {
  if (isReadOnlyMode()) {
    return { error: "READ_ONLY_MODE" as const };
  }
  if (!isAdminAuthorized(request)) {
    return { error: "UNAUTHORIZED" as const };
  }

  const now = new Date().toISOString();
  const normalized: PartEntry = {
    ...payload,
    updated_at: payload.updated_at ?? now,
    tags: payload.tags ?? [],
    photos: (payload.photos ?? []) as PartPhoto[],
    steps: (payload.steps ?? []) as PartStep[],
  };

  if (hasSupabaseConfig && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from("parts")
      .upsert(
        {
          id: normalized.id,
          model: normalized.model,
          system: normalized.system,
          name: normalized.name,
          summary: normalized.summary ?? null,
          tags: normalized.tags ?? [],
          photos: normalized.photos ?? [],
          steps: normalized.steps ?? [],
          updated_at: normalized.updated_at ?? now,
        },
        { onConflict: "id" }
      );
    if (error) {
      return { error: "DB_ERROR", detail: error.message };
    }
    return { ok: true, source: "db" as const };
  }

  const items = await loadPartsFromFile();
  const idx = items.findIndex((item) => item.id === normalized.id);
  if (idx >= 0) {
    items[idx] = normalized;
  } else {
    items.push(normalized);
  }
  await savePartsToFile(items);
  return { ok: true, source: "json" as const, total: items.length };
};
