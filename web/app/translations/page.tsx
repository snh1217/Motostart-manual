import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import UploadForm from "./UploadForm";
import type { TranslationItem } from "../../lib/types";

const loadTranslations = async (): Promise<TranslationItem[]> => {
  try {
    const filePath = path.resolve(process.cwd(), "data", "translations.json");
    const raw = await fs.readFile(filePath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
  } catch {
    return [];
  }
};

export default async function TranslationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q ?? "";

  const translations = await loadTranslations();
  const filtered = translations.filter((item) => {
    if (!query) return true;
    const haystack = [item.entryId, item.title_ko]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">번역 관리</h1>
        <p className="text-slate-600">
          번역 템플릿 업로드로 한글 요약/본문을 관리합니다.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">양식 다운로드</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/translations_template.xlsx"
          >
            번역 양식(엑셀)
          </a>
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/translations_template.csv"
          >
            번역 양식(CSV)
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">업로드</h2>
        <p className="mt-1 text-sm text-slate-600">
          번역 CSV/XLSX 파일을 업로드하세요.
        </p>
        <div className="mt-4">
          <UploadForm />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={query}
            placeholder="메뉴얼ID 또는 한글제목 검색"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            검색
          </button>
          <Link
            href="/translations/new"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            새 번역
          </Link>
        </form>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">메뉴얼ID</th>
                <th className="px-4 py-3 font-semibold">한글제목</th>
                <th className="px-4 py-3 font-semibold">업데이트</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((item) => (
                  <tr key={item.entryId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.entryId}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.title_ko ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.updated_at}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={3}>
                    표시할 번역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}