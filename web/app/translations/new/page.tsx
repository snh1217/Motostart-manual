import { headers } from "next/headers";
import NewTranslationForm from "./NewTranslationForm";
import type { TranslationItem } from "../../../lib/types";

const buildApiUrl = async (query: string) => {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/api/translations?${query}` : `/api/translations?${query}`;
};

const loadTranslation = async (entryId: string): Promise<TranslationItem | null> => {
  if (!entryId) return null;
  try {
    const params = new URLSearchParams();
    params.set("entryId", entryId);
    const apiUrl = await buildApiUrl(params.toString());
    const response = await fetch(apiUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { items?: TranslationItem[] };
    return data.items?.[0] ?? null;
  } catch {
    return null;
  }
};

export default async function NewTranslationPage({
  searchParams,
}: {
  searchParams?: Promise<{ entryId?: string; title?: string; returnTo?: string; model?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const entryId = resolvedParams?.entryId ?? "";
  const title = resolvedParams?.title ?? "";
  const returnTo = resolvedParams?.returnTo ?? "/translations";
  const model = resolvedParams?.model ?? undefined;
  const isReadOnly = process.env.READ_ONLY_MODE === "1";
  const existing = await loadTranslation(entryId);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">번역 추가/수정</h1>
        <p className="text-slate-600">PDF를 보면서 번역 메모를 입력하세요.</p>
      </header>

      <NewTranslationForm
        entryId={entryId}
        title={title}
        returnTo={returnTo}
        model={model}
        readOnly={isReadOnly}
        initialTitleKo={existing?.title_ko}
        initialSummaryKo={existing?.summary_ko}
        initialTextKo={existing?.text_ko}
        initialPdfUrl={existing?.pdf_ko_url}
      />
    </section>
  );
}
