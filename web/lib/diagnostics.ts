import { promises as fs } from "fs";
import path from "path";
import type { DiagnosticEntry } from "./types";
import { hasSupabaseConfig, supabaseAdmin } from "./supabase/server";

export const diagnosticsManifestPath = path.resolve(
  process.cwd(),
  "data",
  "diagnostics_manifest.json"
);

export const loadDiagnostics = async (): Promise<DiagnosticEntry[]> => {
  if (hasSupabaseConfig && supabaseAdmin) {
    const { data } = await supabaseAdmin.from("diagnostics").select("*");
    const items = (data as DiagnosticEntry[]) ?? [];
    return items.map((item) => ({ ...item, source: "db" }));
  }

  try {
    const raw = await fs.readFile(diagnosticsManifestPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed)
      ? (parsed as DiagnosticEntry[]).map((item) => ({ ...item, source: "json" }))
      : [];
  } catch {
    return [];
  }
};

export const getDiagnosticById = async (
  id: string
): Promise<DiagnosticEntry | null> => {
  if (hasSupabaseConfig && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("diagnostics")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? ({ ...(data as DiagnosticEntry), source: "db" } as DiagnosticEntry) : null;
  }

  const items = await loadDiagnostics();
  return items.find((item) => item.id === id) ?? null;
};
