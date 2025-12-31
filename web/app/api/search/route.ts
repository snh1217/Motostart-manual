import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { SpecRow } from "../../../lib/types";
import {
  expandTokens,
  makeSnippet,
  makeSummaryFromTokens,
  score,
  scoreSpecMatch,
} from "../../../lib/search";

const resolveDataPath = async (filename: string) => {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "data", filename),
    path.join(cwd, "web", "data", filename),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(`data file not found: ${filename}`);
};

const jsonCache = new Map<string, { mtimeMs: number; value: unknown }>();

const readJson = async <T>(filename: string): Promise<T> => {
  const filePath = await resolveDataPath(filename);
  const stats = await fs.stat(filePath);
  const cached = jsonCache.get(filePath);
  if (cached && cached.mtimeMs === stats.mtimeMs) {
    return cached.value as T;
  }

  const raw = await fs.readFile(filePath, "utf8");
  const sanitized = raw.replace(/^\uFEFF/, "");
  const parsed = JSON.parse(sanitized) as T;
  jsonCache.set(filePath, { mtimeMs: stats.mtimeMs, value: parsed });
  return parsed;
};

type ManualIndexRecord = {
  id: string;
  entryId: string;
  model: string;
  manual_type: string;
  title: string;
  file: string;
  pages: { start: number; end: number };
  text: string;
};

type ManualHit = {
  id: string;
  entryId: string;
  model: string;
  manual_type: string;
  title: string;
  title_ko?: string;
  file: string;
  ko_file?: string;
  page: number;
  snippet: string;
  summary: string;
  score: number;
};

type KeywordEntry = {
  entryId: string;
  model: string;
  manual_type: string;
  title: string;
  file: string;
  pages: { start: number; end: number };
  keywords: string[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const modelParam = searchParams.get("model")?.trim() ?? "all";
  const model = modelParam === "all" ? undefined : modelParam;
  const category = searchParams.get("category")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "q is required" },
      { status: 400 }
    );
  }

  const tokens = expandTokens(q);

  const specs = await readJson<SpecRow[]>("specs.json");
  const scoredSpecs = specs
    .filter((row) => {
      if (model && row.model !== model) return false;
      if (category && row.category !== category) return false;

      const haystack = [row.item, row.value, row.note].filter(Boolean).join(" ");
      return scoreSpecMatch(q, haystack).score > 0;
    })
    .map((row) => {
      const haystack = [row.item, row.value, row.note].filter(Boolean).join(" ");
      const specMatch = scoreSpecMatch(q, haystack);
      return { row, specMatch };
    })
    .sort((a, b) => b.specMatch.score - a.specMatch.score);

  const bestPerCategory = new Map<
    string,
    { row: SpecRow; specMatch: { score: number; meaningfulMatches: number } }
  >();
  for (const entry of scoredSpecs) {
    const key = `${entry.row.model}-${entry.row.category}`;
    const current = bestPerCategory.get(key);
    if (!current || entry.specMatch.score > current.specMatch.score) {
      bestPerCategory.set(key, entry);
    }
  }

  const answerSpecCandidate = Array.from(bestPerCategory.values())
    .filter((entry) => entry.specMatch.meaningfulMatches > 0)
    .sort((a, b) => b.specMatch.score - a.specMatch.score)[0];

  const answerSpec = answerSpecCandidate?.row ?? null;
  const otherSpecs = scoredSpecs
    .map((entry) => entry.row)
    .filter((row) => row.id !== answerSpec?.id);

  let manualIndex: ManualIndexRecord[] = [];
  let manualIndexDisabled = false;
  let keywordIndex: KeywordEntry[] = [];
  try {
    const manualIndexPath = await resolveDataPath("manual_index.json");
    const stats = await fs.stat(manualIndexPath);
    const maxBytes = Number(process.env.MANUAL_INDEX_MAX_BYTES ?? 8000000);
    if (process.env.MANUAL_INDEX_DISABLED === "1") {
      manualIndexDisabled = true;
    } else if (process.env.VERCEL && stats.size > maxBytes) {
      manualIndexDisabled = true;
    } else {
      manualIndex = await readJson<ManualIndexRecord[]>("manual_index.json");
    }
  } catch {
    manualIndex = [];
  }
  try {
    keywordIndex = await readJson<KeywordEntry[]>("manual_keywords.json");
  } catch {
    keywordIndex = [];
  }

  let allowedModels: string[] = [];
  try {
    const modelList = await readJson<Array<{ id: string }>>("models.json");
    allowedModels = modelList.map((item) => item.id);
  } catch {
    allowedModels = [];
  }
  const allowedModelSet = new Set(allowedModels);

  const manifestMap = new Map<
    string,
    { title_ko?: string; ko_file?: string }
  >();
  let manifestEntries: Array<{
    id: string;
    model: string;
    manual_type: string;
    section: string;
    title: string;
    title_ko?: string;
    file: string;
    pages: { start: number; end: number };
    ko_file?: string;
  }> = [];
  try {
    const manifestPath = path.resolve(
      process.cwd(),
      "public",
      "manuals",
      "manifest.json"
    );
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as {
      entries?: Array<{
        id: string;
        model: string;
        manual_type: string;
        section: string;
        title: string;
        title_ko?: string;
        file: string;
        pages: { start: number; end: number };
        ko_file?: string;
      }>;
    };
    manifestEntries = parsed.entries ?? [];
    manifestEntries.forEach((entry) => {
      if (entry.id) {
        manifestMap.set(entry.id, {
          title_ko: entry.title_ko,
          ko_file: entry.ko_file,
        });
      }
    });
  } catch {
    // ignore manifest mapping
  }

  const minScore = tokens.length >= 4 ? 2 : 1;
  let manualHits = manualIndex
    .filter((record) =>
      allowedModelSet.size ? allowedModelSet.has(record.model) : true
    )
    .filter((record) => (model ? record.model === model : true))
    .flatMap((record): ManualHit[] => {
      const hitScore = score(record.text, tokens);
      if (hitScore < minScore) return [];

      const manifestMeta = manifestMap.get(record.entryId);
      return [
        {
          id: record.id,
          entryId: record.entryId,
          model: record.model,
          manual_type: record.manual_type,
          title: record.title,
          title_ko: manifestMeta?.title_ko,
          file: record.file,
          ko_file: manifestMeta?.ko_file,
          page: record.pages.start,
          snippet: makeSnippet(record.text, tokens),
          summary: makeSummaryFromTokens(record.text, tokens),
          score: hitScore,
        },
      ];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (
    !manualHits.length &&
    (manualIndexDisabled || manualIndex.length === 0) &&
    keywordIndex.length
  ) {
    manualHits = keywordIndex
      .filter((entry) =>
        allowedModelSet.size ? allowedModelSet.has(entry.model) : true
      )
      .filter((entry) => (model ? entry.model === model : true))
      .flatMap((entry): ManualHit[] => {
        const text = entry.keywords.join(" ");
        const hitScore = score(text, tokens);
        if (hitScore < minScore) return [];
        return [
          {
            id: entry.entryId,
            entryId: entry.entryId,
            model: entry.model,
            manual_type: entry.manual_type,
            title: entry.title,
            title_ko: manifestMap.get(entry.entryId)?.title_ko,
            file: entry.file,
            ko_file: manifestMap.get(entry.entryId)?.ko_file,
            page: entry.pages?.start ?? 1,
            snippet: entry.keywords.slice(0, 6).join(", "),
            summary: entry.keywords.slice(0, 12).join(", "),
            score: hitScore,
          },
        ];
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }

  if (!manualHits.length && (manualIndexDisabled || manualIndex.length === 0)) {
    manualHits = manifestEntries
      .filter((entry) =>
        allowedModelSet.size ? allowedModelSet.has(entry.model) : true
      )
      .filter((entry) => (model ? entry.model === model : true))
      .flatMap((entry): ManualHit[] => {
        const text = [entry.title, entry.section, entry.file].filter(Boolean).join(" ");
        const hitScore = score(text, tokens);
        if (hitScore < minScore) return [];
        return [
          {
            id: entry.id,
            entryId: entry.id,
            model: entry.model,
            manual_type: entry.manual_type,
            title: entry.title,
            title_ko: entry.title_ko,
            file: entry.file,
            ko_file: entry.ko_file,
            page: entry.pages?.start ?? 1,
            snippet: makeSnippet(text, tokens),
            summary: makeSummaryFromTokens(text, tokens),
            score: hitScore,
          },
        ];
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }

  const answerManual = manualHits.length ? manualHits[0] : null;
  const otherManuals = manualHits.slice(1);

  return NextResponse.json(
    {
      answerSpec,
      otherSpecs,
      answerManual,
      otherManuals,
      fallbackMode: manualIndexDisabled || manualIndex.length === 0 ? "manifest" : "index",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
      },
    }
  );
}
