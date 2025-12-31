import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import type { TranslationItem } from "./types";

const resolveTranslationsPath = async () => {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "data", "translations.json"),
    path.join(cwd, "web", "data", "translations.json"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("translations.json not found");
};

export const loadTranslations = cache(async (): Promise<TranslationItem[]> => {
  try {
    const translationsPath = await resolveTranslationsPath();
    const raw = await fs.readFile(translationsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
  } catch {
    return [];
  }
});

export const getTranslationByEntryId = async (
  entryId: string
): Promise<TranslationItem | null> => {
  const translations = await loadTranslations();
  return translations.find((item) => item.entryId === entryId) ?? null;
};
