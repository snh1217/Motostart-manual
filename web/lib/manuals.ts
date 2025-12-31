import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import type { ManifestEntry, ManualType, ModelCode } from "./types";

type Manifest = {
  generated_at: string;
  entries: ManifestEntry[];
};

const resolveManifestPath = async () => {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "public", "manuals", "manifest.json"),
    path.join(cwd, "web", "public", "manuals", "manifest.json"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("manifest.json not found");
};

const readManifest = cache(async (): Promise<Manifest> => {
  const manifestPath = await resolveManifestPath();
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as Manifest;
});

export const loadManifest = cache(async (): Promise<ManifestEntry[]> => {
  const manifest = await readManifest();
  return Array.isArray(manifest.entries) ? manifest.entries : [];
});

export const getManualsBaseUrl = () => {
  const base = process.env.MANUALS_BASE_URL ?? "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

const appendCacheBust = (url: string) => {
  const bust = process.env.MANUALS_CACHE_BUST ?? process.env.MANUALS_VERSION;
  if (!bust) return url;
  const hasQuery = url.includes("?");
  const joiner = hasQuery ? "&" : "?";
  return `${url}${joiner}v=${encodeURIComponent(bust)}`;
};

export const getManualFileUrl = (file: string) => {
  if (!file) return "";
  const base = getManualsBaseUrl();
  let url = "";
  if (file.startsWith("http://") || file.startsWith("https://")) {
    url = file;
  } else if (file.startsWith("/")) {
    url = base ? `${base}${file}` : file;
  } else {
    url = base ? `${base}/manuals/splits/${file}` : `/manuals/splits/${file}`;
  }
  return appendCacheBust(url);
};

export const filterByModel = (
  entries: ManifestEntry[],
  model?: ModelCode
): ManifestEntry[] => {
  if (!model) return entries;
  return entries.filter((entry) => entry.model === model);
};

export const groupByManualType = (
  entries: ManifestEntry[]
): Record<ManualType, ManifestEntry[]> => {
  const grouped: Record<ManualType, ManifestEntry[]> = {
    engine: [],
    chassis: [],
    user: [],
    wiring: [],
  };

  for (const entry of entries) {
    if (grouped[entry.manual_type]) {
      grouped[entry.manual_type].push(entry);
    }
  }

  return grouped;
};

export const sortEntriesBySectionThenTitle = (
  entries: ManifestEntry[]
): ManifestEntry[] => {
  return [...entries].sort((a, b) => {
    const sectionOrder = a.section.localeCompare(b.section, "ko");
    if (sectionOrder !== 0) return sectionOrder;
    return a.title.localeCompare(b.title, "ko");
  });
};
