import Link from "next/link";
import { headers, cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import type { SpecRow } from "../../lib/types";
import CopyButton from "./CopyButton";
import { loadTranslations } from "../../lib/translation";
import { compareModelCode, sortModelCodes } from "../../lib/modelSort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  title_ko?: string;
  file: string;
  ko_file?: string;
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
  fallbackMode?: "index" | "manifest";
};

type ModelEntry = { id: string; name?: string };

type Manifest = { entries?: Array<{ model?: string }> };

const loadModels = cache(async (): Promise<ModelEntry[]> => {
  const cwd = process.cwd();
  const modelsPath = path.join(cwd, "data", "models.json");
  try {
    const raw = await fs.readFile(modelsPath, "utf8");
    const data = JSON.parse(raw) as ModelEntry[];
    if (Array.isArray(data) && data.length > 0) {
      return sortModelCodes(data);
    }
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
  return Array.from(modelSet)
    .map((id) => ({ id }))
    .sort((a, b) => compareModelCode(a.id, b.id));
});

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
  searchParams: Promise<{ q?: string; model?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const query = params.q ?? "";
  const model = params.model ?? "all";
  const models = await loadModels();
  const translations = await loadTranslations();
  const translationMap = new Map(
    translations.map((item) => [item.entryId, item.title_ko])
  );

  let results: SearchResponse | null = null;
  let errorMessage: string | null = null;

  if (query) {
    try {
      const cookieHeader = (await cookies()).toString();
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("model", model);
      const apiUrl = await buildApiUrl(params.toString());
      const response = await fetch(apiUrl, {
        cache: "no-store",
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      });
      if (!response.ok) {
        errorMessage = "검색 요청 처리 중 오류가 발생했습니다.";
      } else {
        results = (await response.json()) as SearchResponse;
      }
    } catch {
      errorMessage = "네트워크 오류가 발생했습니다.";
    }
  }

  const orderedSpecs = results
    ? [results.answerSpec, ...results.otherSpecs].filter(Boolean)
    : [];
  const specByModel = new Map<string, SpecRow>();
  orderedSpecs.forEach((row) => {
    const spec = row as SpecRow;
    if (!specByModel.has(spec.model)) {
      specByModel.set(spec.model, spec);
    }
  });
  const tableRows =
    model === "all"
      ? models
          .map((entry) => specByModel.get(entry.id))
          .filter((row): row is SpecRow => Boolean(row))
      : results?.answerSpec
      ? [results.answerSpec]
      : [];
  const answerText = results?.answerSpec
    ? `${results.answerSpec.item}: ${results.answerSpec.value}`
    : "정답 없음";
  const copyText =
    model === "all" && tableRows.length
      ? tableRows
          .map((row) => `${row.model}: ${row.item} ${row.value}`)
          .join("\n")
      : answerText;

  const scopeLabel = model === "all" ? "전체 모델" : `${model} 모델`;

  const hasAnyResult = Boolean(results?.answerSpec || results?.answerManual);
  const visibleModels = models.slice(0, 4);
  const extraModels = models.slice(4);
  const buildModelHref = (nextModel: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (nextModel !== "all") params.set("model", nextModel);
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  };

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">검색</h1>
        <p className="text-base text-slate-700">
          정답 1개와 근거 1개로 빠르게 찾아냅니다.
        </p>
        {results?.fallbackMode === "manifest" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            현재 제목/섹션 기준 검색만 가능합니다. 부품명(예: 배터리, 퓨즈)이나
            에러 코드로 검색하면 더 잘 찾을 수 있습니다.
          </div>
        ) : null}
      </header>

      <form className="rounded-2xl border border-slate-200 bg-white p-6" method="get">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              1. 모델 선택
            </label>
            <input type="hidden" name="model" value={model} />
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={buildModelHref("all")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  model === "all"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                전체
              </Link>
              {visibleModels.map((entry) => (
                <Link
                  key={entry.id}
                  href={buildModelHref(entry.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    model === entry.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {entry.id}
                </Link>
              ))}
              {extraModels.length ? (
                <details className="group">
                  <summary className="list-none rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300">
                    더보기
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {extraModels.map((entry) => (
                      <Link
                        key={entry.id}
                        href={buildModelHref(entry.id)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          model === entry.id
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {entry.id}
                      </Link>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="q" className="text-sm font-semibold text-slate-700">
              2. 검색어 입력
            </label>
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="예: 드레인볼트 토크, 엔진오일 용량, 퓨즈, 배터리"
              className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg focus:border-slate-400 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {suggestionKeywords.map((keyword) => (
                <Link
                  key={keyword}
                  href={`/search?${new URLSearchParams({ q: keyword, model }).toString()}`}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  {keyword}
                </Link>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white"
          >
            검색하기
          </button>
        </div>
      </form>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {query ? (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">정답</p>
                <h2 className="text-xl font-semibold text-slate-900">
                  {model === "all"
                    ? `${results?.answerSpec?.item ?? query} · 모델별`
                    : answerText}
                </h2>
                <p className="text-sm text-slate-600">검색 범위: {scopeLabel}</p>
              </div>
              <CopyButton text={copyText} />
            </div>

            {tableRows.length ? (
              model === "all" ? (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100 bg-slate-50">
                  <table className="w-full min-w-[480px] text-left text-sm text-slate-700">
                    <thead className="bg-slate-100 text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-2">모델</th>
                        <th className="px-4 py-2">카테고리</th>
                        <th className="px-4 py-2">값</th>
                        <th className="px-4 py-2">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-2 font-semibold">{row.model}</td>
                          <td className="px-4 py-2">{row.category}</td>
                          <td className="px-4 py-2 font-semibold">{row.value}</td>
                          <td className="px-4 py-2">{row.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="grid gap-2 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">모델</p>
                      <p className="font-semibold text-slate-700">
                        {results?.answerSpec?.model ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">카테고리</p>
                      <p className="font-semibold text-slate-700">
                        {results?.answerSpec?.category ?? "-"}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-500">비고</p>
                      <p className="font-semibold text-slate-700">
                        {results?.answerSpec?.note || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <p className="mt-4 text-sm text-slate-500">정답 스펙을 찾지 못했습니다.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">근거(매뉴얼)</p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {results?.answerManual?.title ?? "근거 없음"}
                </h3>
                {results?.answerManual ? (
                  <p className="text-sm text-slate-600">
                    {translationMap.get(results.answerManual.entryId) ||
                      results.answerManual.title_ko ||
                      ""}
                  </p>
                ) : null}
              </div>
              {results?.answerManual ? (
                <Link
                  href={`/viewer?entryId=${encodeURIComponent(
                    results.answerManual.entryId
                  )}&file=${encodeURIComponent(results.answerManual.file)}&title=${encodeURIComponent(
                    results.answerManual.title
                  )}&page=${results.answerManual.page}`}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  근거 보기
                </Link>
              ) : null}
            </div>
            {results?.answerManual ? (
              <p className="mt-4 text-sm text-slate-700">
                {results.answerManual.summary || results.answerManual.snippet}
              </p>
            ) : (
              <p className="mt-4 text-sm text-slate-500">근거 매뉴얼을 찾지 못했습니다.</p>
            )}
          </div>

          {hasAnyResult ? (
            <details className="rounded-2xl border border-slate-200 bg-white p-6">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                추가 결과 보기
              </summary>
              <div className="mt-4 space-y-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700">추가 스펙</h4>
                  {results?.otherSpecs?.length ? (
                    <div className="space-y-2">
                      {results.otherSpecs.map((row, index) => (
                        <div
                          key={`${row.id}-${row.model}-${row.category}-${index}`}
                          className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          <p className="font-semibold">
                            {row.model} · {row.item}: {row.value}
                          </p>
                          {row.note ? <p className="text-xs text-slate-500">{row.note}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">추가 스펙이 없습니다.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700">추가 매뉴얼</h4>
                  {results?.otherManuals?.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {results.otherManuals.map((hit) => (
                        <div
                          key={hit.id}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700"
                        >
                          <p className="text-xs font-semibold text-slate-500">
                            {hit.model} · {hit.manual_type}
                          </p>
                          <p className="font-semibold text-slate-900">{hit.title}</p>
                          {translationMap.get(hit.entryId) || hit.title_ko ? (
                            <p className="text-xs text-slate-500">
                              {translationMap.get(hit.entryId) || hit.title_ko}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-slate-600">
                            {hit.summary || hit.snippet}
                          </p>
                          <Link
                            href={`/viewer?entryId=${encodeURIComponent(
                              hit.entryId
                            )}&file=${encodeURIComponent(hit.file)}&title=${encodeURIComponent(
                              hit.title
                            )}&page=${hit.page}`}
                            className="mt-3 inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            PDF 열기
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">추가 매뉴얼이 없습니다.</p>
                  )}
                </div>
              </div>
            </details>
          ) : null}

          {!hasAnyResult ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              검색 결과가 없습니다. 다른 키워드로 다시 시도해 주세요.
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
