import Link from "next/link";
import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import UploadForm from "./UploadForm";
import type { TranslationItem } from "../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buildApiUrl = async (query: string) => {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/api/translations?${query}` : `/api/translations?${query}`;
};

const loadTranslations = async (): Promise<TranslationItem[]> => {
  try {
    const apiUrl = await buildApiUrl("model=all");
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
    return Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
  } catch {
    return [];
  }
};

export default async function TranslationsPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const query = searchParams?.q ?? "";
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

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
        <h1 className="text-2xl font-semibold tracking-tight">���� ����</h1>
        <p className="text-slate-600">
          ���� ���ø� ���ε�� �ѱ� ���/������ �����մϴ�.
        </p>
        {isReadOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            �б� ���� ����Դϴ�. ���ε� �� ���� ����� ��Ȱ��ȭ�˴ϴ�.
          </div>
        ) : null}
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">��� �ٿ�ε�</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/translations_template.xlsx"
          >
            ���� ���(����)
          </a>
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/translations_template.csv"
          >
            ���� ���(CSV)
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">���ε�</h2>
        <p className="mt-1 text-sm text-slate-600">
          ���� CSV/XLSX ������ ���ε��ϼ���.
        </p>
        <div className="mt-4">
          <UploadForm readOnly={isReadOnly} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={query}
            placeholder="�޴��� ID �Ǵ� �ѱ� ���� �˻�"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            �˻�
          </button>
          {isReadOnly ? (
            <span className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400">
              �� ����
            </span>
          ) : (
            <Link
              href="/translations/new"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              �� ����
            </Link>
          )}
        </form>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">�޴��� ID</th>
                <th className="px-4 py-3 font-semibold">�ѱ� ����</th>
                <th className="px-4 py-3 font-semibold">������Ʈ</th>
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
                    ��ϵ� ������ �����ϴ�.
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
