import Link from "next/link";
import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import UploadForm from "./UploadForm";
import PdfTranslateForm from "./PdfTranslateForm";
import TranslationsTable from "./TranslationsTable";
import type { TranslationItem, ModelCode } from "../../lib/types";
import { sortModelCodes } from "../../lib/modelSort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buildApiUrl = async (query: string) => {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/api/translations?${query}` : `/api/translations?${query}`;
};

const loadModelOptions = async (): Promise<ModelCode[]> => {
  try {
    const modelsPath = path.resolve(process.cwd(), "data", "models.json");
    const raw = await fs.readFile(modelsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized) as Array<{ id: ModelCode }>;
    if (!Array.isArray(parsed)) return [];
    return sortModelCodes(parsed).map((item) => item.id);
  } catch {
    return [];
  }
};

const loadTranslations = async (query: string, model: string): Promise<TranslationItem[]> => {
  if (!query.trim() && model === "all") return [];
  try {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (model !== "all") params.set("model", model);
    const apiUrl = await buildApiUrl(params.toString());
    const response = await fetch(apiUrl, { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { items?: TranslationItem[] };
      return data.items ?? [];
    }
  } catch {
    // fall back to file
  }

  try {
    const filePath = path.resolve(process.cwd(), "data", "translations.json");
    const raw = await fs.readFile(filePath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    const items = Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
    return items.filter((item) => {
      if (model !== "all" && !item.entryId.toUpperCase().includes(model)) return false;
      if (query.trim()) {
        const haystack = [item.entryId, item.title_ko].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  } catch {
    return [];
  }
};

export default async function TranslationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; model?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q ?? "";
  const selectedModel = resolvedSearchParams?.model ?? "all";
  const isReadOnly = process.env.READ_ONLY_MODE === "1";
  const modelOptions = await loadModelOptions();

  const translations = await loadTranslations(query, selectedModel);
  const returnTo = `/translations?${new URLSearchParams({ q: query, model: selectedModel }).toString()}`;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">번역 관리</h1>
        <p className="text-slate-600">번역 템플릿을 다운로드하고 항목을 관리합니다.</p>
        {isReadOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            읽기 전용 모드입니다. 업로드와 편집이 비활성화됩니다.
          </div>
        ) : null}
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">양식 다운로드</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/translations_template.xlsx"
          >
            양식 다운로드(엑셀)
          </a>
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/translations_template.csv"
          >
            양식 다운로드(CSV)
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">업로드</h2>
        <p className="mt-1 text-sm text-slate-600">CSV/XLSX 파일을 업로드해 주세요.</p>
        <div className="mt-4">
          <UploadForm readOnly={isReadOnly} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">PDF 자동 번역</h2>
        <p className="mt-1 text-sm text-slate-600">
          원본 PDF를 올리면 한국어 PDF를 생성해 저장합니다.
        </p>
        <div className="mt-4">
          <PdfTranslateForm readOnly={isReadOnly} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={query}
            placeholder="매뉴얼 ID 또는 제목 검색"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          />
          <select
            name="model"
            defaultValue={selectedModel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            <option value="all">전체 모델</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            검색
          </button>
          {isReadOnly ? (
            <span className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400">
              읽기 전용
            </span>
          ) : (
            <Link
              href={`/translations/new?${new URLSearchParams({ returnTo }).toString()}`}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              새 번역 생성
            </Link>
          )}
        </form>

        <div className="mt-4">
          <TranslationsTable items={translations} readOnly={isReadOnly} returnTo={returnTo} />
        </div>
      </section>
    </section>
  );
}
