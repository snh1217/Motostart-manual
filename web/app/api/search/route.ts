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

const readJson = async <T>(filename: string): Promise<T> => {
  const filePath = await resolveDataPath(filename);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
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
  try {
    manualIndex = await readJson<ManualIndexRecord[]>("manual_index.json");
  } catch {
    manualIndex = [];
  }

  const manifestMap = new Map<
    string,
    { title_ko?: string; ko_file?: string }
  >();
  try {
    const manifestPath = path.resolve(
      process.cwd(),
      "public",
      "manuals",
      "manifest.json"
    );
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as {
      entries?: Array<{ id: string; title_ko?: string; ko_file?: string }>;
    };
    (parsed.entries ?? []).forEach((entry) => {
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
  const manualHits = manualIndex
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

  const answerManual = manualHits.length ? manualHits[0] : null;
  const otherManuals = manualHits.slice(1);

  return NextResponse.json({
    answerSpec,
    otherSpecs,
    answerManual,
    otherManuals,
  });
}
