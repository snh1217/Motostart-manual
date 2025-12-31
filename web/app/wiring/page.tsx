import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import WiringAdminAction from "./WiringAdminAction";

type WiringEntry = {
  id: string;
  model: string;
  title: string;
  tags: string[];
  note?: string;
  file: string;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
};

const scoreEntry = (entry: WiringEntry, tokens: string[]) => {
  const haystack = normalizeText(
    [entry.title, entry.note, entry.tags.join(" ")].filter(Boolean).join(" ")
  );
  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) score += 1;
  });
  return score;
};

const loadWiringManifest = cache(async (): Promise<WiringEntry[]> => {
  try {
    const manifestPath = path.resolve(
      process.cwd(),
      "data",
      "wiring_manifest.json"
    );
    const raw = await fs.readFile(manifestPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as WiringEntry[]) : [];
  } catch {
    return [];
  }
});

export default async function WiringPage({
  searchParams,
}: {
  searchParams?: Promise<{ model?: string; q?: string; ask?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const model = resolvedSearchParams?.model ?? "all";
  const query = resolvedSearchParams?.q ?? "";
  const ask = resolvedSearchParams?.ask ?? "";

  const wiringEntries = await loadWiringManifest();
  const modelOptions = Array.from(
    new Set(wiringEntries.map((entry) => entry.model))
  ).sort();

  const queryTokens = tokenize(query);
  const filteredEntries = wiringEntries.filter((entry) => {
    if (model !== "all" && entry.model !== model) return false;
    if (queryTokens.length === 0) return true;
    return scoreEntry(entry, queryTokens) > 0;
  });

  const askTokens = tokenize(ask);
  const recommendations = askTokens.length
    ? wiringEntries
        .map((entry) => ({ entry, score: scoreEntry(entry, askTokens) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : [];

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">회로도</h1>
          <p className="text-slate-600">
            회로도 PDF를 원본 해상도로 바로 열 수 있습니다.
          </p>
        </div>
        <WiringAdminAction />
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <form method="get" className="flex flex-col gap-3 lg:flex-row">
          <select
            name="model"
            defaultValue={model}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 focus:border-slate-400 focus:outline-none lg:w-40"
          >
            <option value="all">전체</option>
            {modelOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={query}
            placeholder="예: 시동, 충전, ABS"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            검색
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          제목, 태그, 설명에서 회로도를 찾습니다.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">회로도 질문</h2>
        <p className="mt-1 text-sm text-slate-600">
          예: 시동 관련 회로가 뭐야?
        </p>
        <form method="get" className="mt-4 flex flex-col gap-3 lg:flex-row">
          <input type="hidden" name="model" value={model} />
          <input
            name="ask"
            defaultValue={ask}
            placeholder="질문을 입력하세요"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            추천 받기
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          추천 결과는 아래에 표시됩니다.
        </p>
        {ask && (
          <div className="mt-4 space-y-3">
            {recommendations.length ? (
              recommendations.map((item) => (
                <div
                  key={item.entry.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="text-xs text-slate-500">
                    {item.entry.model} · {item.entry.title}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {item.entry.note ?? "관련 회로를 확인하세요."}
                  </p>
                  <div className="mt-3">
                    <Link
                      href={`/wiring/${item.entry.id}`}
                      className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
                    >
                      열기
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">
                추천할 회로도가 없습니다.
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">회로도 목록</h2>
          <span className="text-sm text-slate-500">
            {filteredEntries.length}건
          </span>
        </div>
        {filteredEntries.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500">
                    {entry.model}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {entry.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {entry.tags.slice(0, 4).join(" · ")}
                  </p>
                  {entry.note ? (
                    <p className="text-sm text-slate-600">{entry.note}</p>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/wiring/${entry.id}`}
                    className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    열기
                  </Link>
                  <a
                    href={entry.file}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    새 탭
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            표시할 회로도가 없습니다.
          </div>
        )}
      </section>
    </section>
  );
}
