import Link from "next/link";
import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import type { SpecRow, TranslationItem } from "../../lib/types";

const buildApiUrl = async (query: string) => {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/api/search?${query}` : `/api/search?${query}`;
};

type ManualHit = {
  id: string;
  entryId: string;
  model: string;
  manual_type: string;
  title: string;
  file: string;
  page: number;
  snippet: string;
  summary: string;
  score: number;
};

type SearchResponse = {
  answerSpec: SpecRow | null;
  otherSpecs: SpecRow[];
  answerManual: ManualHit | null;
  otherManuals: ManualHit[];
};

const loadTranslations = async (): Promise<TranslationItem[]> => {
  try {
    const filePath = path.resolve(process.cwd(), "data", "translations.json");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
  } catch {
    return [];
  }
};

type ModelEntry = { id: string; name?: string };

type Manifest = { entries?: Array<{ model?: string }> };

const loadModels = async (): Promise<ModelEntry[]> => {
  const cwd = process.cwd();
  const modelsPath = path.join(cwd, "data", "models.json");
  try {
    const raw = await fs.readFile(modelsPath, "utf8");
    const data = JSON.parse(raw) as ModelEntry[];
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    // fall back to manifest
  }

  const manifestPath = path.join(cwd, "public", "manuals", "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as Manifest;
  const modelSet = new Set<string>();
  (manifest.entries ?? []).forEach((entry) => {
    if (entry.model) modelSet.add(entry.model);
  });
  return Array.from(modelSet).map((id) => ({ id }));
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; model?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q ?? "";
  const model = resolvedSearchParams?.model ?? "all";
  const models = await loadModels();
  const translations = await loadTranslations();
  const translationMap = new Map(
    translations.map((item) => [item.entryId, item.title_ko])
  );

  let results: SearchResponse | null = null;
  let errorMessage: string | null = null;

  if (query) {
    try {
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("model", model);
      const apiUrl = await buildApiUrl(params.toString());
      const response = await fetch(apiUrl, { cache: "no-store" });
      if (!response.ok) {
        errorMessage = "검색 결과를 가져올 수 없습니다.";
      } else {
        results = (await response.json()) as SearchResponse;
      }
    } catch {
      errorMessage = "검색 중 오류가 발생했습니다.";
    }
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">검색</h1>
        <p className="text-slate-600">정답 1개 + 근거 1개를 빠르게 확인합니다.</p>
      </header>

      <form className="rounded-2xl border border-slate-200 bg-white p-6" method="get">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="예: 드레인볼트 토크, 헤드 토크"
            className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-base focus:border-slate-400 focus:outline-none"
          />
          <select
            name="model"
            defaultValue={model}
            className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-base text-slate-700 focus:border-slate-400 focus:outline-none lg:w-44"
          >
            <option value="all">전체</option>
            {models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.id}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white"
          >
            검색
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          예: 드레인볼트 토크, 엔진오일량
        </p>
      </form>

      {!query ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          검색어를 입력하면 결과가 표시됩니다.
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-dashed border-red-200 bg-white p-6 text-sm text-red-600">
          {errorMessage}
        </div>
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">정답(스펙)</h2>
                <span className="text-xs text-slate-500">1개</span>
              </div>
              {results?.answerSpec ? (
                <div className="mt-4 space-y-3">
                  <div className="text-sm text-slate-500">
                    {results.answerSpec.model} · {results.answerSpec.category}
                  </div>
                  <div className="text-lg font-semibold text-slate-900">
                    {results.answerSpec.item}
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {results.answerSpec.value}
                  </div>
                  {results.answerSpec.note ? (
                    <div className="text-sm text-slate-500">
                      {results.answerSpec.note}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">
                  정답이 없습니다.
                </div>
              )}
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">근거(매뉴얼)</h2>
                <span className="text-xs text-slate-500">1개</span>
              </div>
              {results?.answerManual ? (
                <div className="mt-4 space-y-3">
                  <div className="text-sm text-slate-500">
                    {results.answerManual.model} · {results.answerManual.manual_type}
                  </div>
                  <div className="text-lg font-semibold text-slate-900">
                    {results.answerManual.title}
                  </div>
                  {translationMap.get(results.answerManual.entryId) ? (
                    <div className="text-sm text-slate-500">
                      {translationMap.get(results.answerManual.entryId)}
                    </div>
                  ) : null}
                  <div className="text-sm text-slate-700">
                    {results.answerManual.summary}
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/viewer?entryId=${encodeURIComponent(
                        results.answerManual.entryId
                      )}&file=${encodeURIComponent(
                        results.answerManual.file
                      )}&title=${encodeURIComponent(
                        results.answerManual.title
                      )}&page=${results.answerManual.page}`}
                      className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      원본 보기
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">
                  매칭된 매뉴얼 근거가 없습니다.
                </div>
              )}
            </article>
          </section>

          <details className="rounded-2xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              추가 결과 보기
            </summary>
            <div className="mt-5 space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">추가 스펙</h3>
                {results?.otherSpecs.length ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">모델</th>
                          <th className="px-4 py-3 font-semibold">카테고리</th>
                          <th className="px-4 py-3 font-semibold">항목</th>
                          <th className="px-4 py-3 font-semibold">값</th>
                          <th className="px-4 py-3 font-semibold">비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.otherSpecs.map((row) => (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {row.model}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.category}
                            </td>
                            <td className="px-4 py-3 text-slate-800">
                              {row.item}
                            </td>
                            <td className="px-4 py-3 text-slate-800">
                              {row.value}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {row.note ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    추가 스펙이 없습니다.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  추가 매뉴얼 근거
                </h3>
                {results?.otherManuals.length ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">모델</th>
                          <th className="px-4 py-3 font-semibold">타입</th>
                          <th className="px-4 py-3 font-semibold">제목</th>
                          <th className="px-4 py-3 font-semibold">요약</th>
                          <th className="px-4 py-3 font-semibold">링크</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.otherManuals.map((hit) => (
                          <tr key={hit.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {hit.model}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {hit.manual_type}
                            </td>
                            <td className="px-4 py-3 text-slate-800">
                              <div className="font-semibold">{hit.title}</div>
                              {translationMap.get(hit.entryId) ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  {translationMap.get(hit.entryId)}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {hit.summary}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/viewer?entryId=${encodeURIComponent(
                                  hit.entryId
                                )}&file=${encodeURIComponent(
                                  hit.file
                                )}&title=${encodeURIComponent(
                                  hit.title
                                )}&page=${hit.page}`}
                                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
                              >
                                원본 보기
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    추가 근거가 없습니다.
                  </div>
                )}
              </section>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}