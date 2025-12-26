import Link from "next/link";
import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import type { SpecRow, TranslationItem } from "../../lib/types";
import CopyButton from "./CopyButton";

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

const suggestionKeywords = [
  "엔진오일 용량",
  "냉각수",
  "브레이크액",
  "플러그",
  "퓨즈",
  "아이들링",
];

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
        errorMessage = "검색 결과를 불러오지 못했습니다.";
      } else {
        results = (await response.json()) as SearchResponse;
      }
    } catch {
      errorMessage = "검색 요청 중 오류가 발생했습니다.";
    }
  }

  const answerText = results?.answerSpec
    ? `${results.answerSpec.item}: ${results.answerSpec.value}`
    : "정답 없음";

  const scopeLabel = model === "all" ? "전체 모델" : `${model} 모델`;

  const hasAnyResult = Boolean(results?.answerSpec || results?.answerManual);

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">검색</h1>
        <p className="text-base text-slate-700">
          정답 1개와 근거 1개로 빠르게 안내합니다.
        </p>
      </header>

      <form className="rounded-2xl border border-slate-200 bg-white p-6" method="get">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="예: 엔진오일 용량, 헤드 토크, 퓨즈, 브레이크액"
            className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg focus:border-slate-400 focus:outline-none"
          />
          <select
            name="model"
            defaultValue={model}
            className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-base text-slate-700 focus:border-slate-400 focus:outline-none lg:w-48"
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
        <p className="mt-2 text-base font-semibold text-slate-700">
          검색 범위: {scopeLabel}
        </p>
      </form>

      {!query ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-base text-slate-700">
          검색어를 입력하면 결과가 표시됩니다.
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-dashed border-red-200 bg-white p-6 text-base text-red-600">
          {errorMessage}
        </div>
      ) : !hasAnyResult ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-base font-semibold text-slate-800">
            결과가 없습니다. 검색어를 바꿔보세요.
          </div>
          <div className="flex flex-wrap gap-3">
            {suggestionKeywords.map((keyword) => (
              <Link
                key={keyword}
                href={`/search?q=${encodeURIComponent(keyword)}&model=${model}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                {keyword}
              </Link>
            ))}
          </div>
          <Link
            href={`/manuals?model=${model === "all" ? "350D" : model}`}
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            매뉴얼 전체에서 찾기
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">정답</h2>
                <span className="text-sm text-slate-500">1개</span>
              </div>
              {results?.answerSpec ? (
                <div className="mt-4 space-y-3">
                  <div className="text-sm text-slate-600">
                    {results.answerSpec.model} · {results.answerSpec.category}
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {results.answerSpec.item}
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {results.answerSpec.value}
                  </div>
                  {results.answerSpec.note ? (
                    <div className="text-sm text-slate-600">
                      {results.answerSpec.note}
                    </div>
                  ) : null}
                  <CopyButton text={answerText} label="정답 복사" />
                </div>
              ) : (
                <div className="mt-4 text-base text-slate-600">
                  정답을 찾지 못했습니다.
                </div>
              )}
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">근거</h2>
                <span className="text-sm text-slate-500">1개</span>
              </div>
              {results?.answerManual ? (
                <div className="mt-4 space-y-3">
                  <div className="text-sm text-slate-600">
                    {results.answerManual.model} · {results.answerManual.manual_type}
                  </div>
                  <div className="text-lg font-semibold text-slate-900">
                    {results.answerManual.title}
                  </div>
                  {translationMap.get(results.answerManual.entryId) ? (
                    <div className="text-sm text-slate-600">
                      {translationMap.get(results.answerManual.entryId)}
                    </div>
                  ) : null}
                  <div className="text-sm text-slate-700">
                    {results.answerManual.summary}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
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
                      근거 보기
                    </Link>
                    <CopyButton
                      text={`${results.answerManual.title} p.${results.answerManual.page}`}
                      label="근거 복사"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-base text-slate-600">
                  근거가 없습니다.
                </div>
              )}
            </article>
          </section>

          <details className="rounded-2xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-base font-semibold text-slate-700">
              추가 결과 보기
            </summary>
            <div className="mt-5 space-y-6">
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-slate-700">추가 스펙</h3>
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
                  <div className="text-base text-slate-600">추가 스펙이 없습니다.</div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-semibold text-slate-700">
                  추가 매뉴얼 근거
                </h3>
                {results?.otherManuals.length ? (
                  <div className="space-y-3">
                    {results.otherManuals.map((hit) => (
                      <div
                        key={hit.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="text-sm text-slate-500">
                          {hit.model} · {hit.manual_type}
                        </div>
                        <div className="text-base font-semibold text-slate-900">
                          {hit.title}
                        </div>
                        {translationMap.get(hit.entryId) ? (
                          <div className="text-sm text-slate-600">
                            {translationMap.get(hit.entryId)}
                          </div>
                        ) : null}
                        <div className="mt-2 text-sm text-slate-700">
                          {hit.summary}
                        </div>
                        <div className="mt-3">
                          <Link
                            href={`/viewer?entryId=${encodeURIComponent(
                              hit.entryId
                            )}&file=${encodeURIComponent(
                              hit.file
                            )}&title=${encodeURIComponent(
                              hit.title
                            )}&page=${hit.page}`}
                            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                          >
                            근거 보기
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-base text-slate-600">
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
