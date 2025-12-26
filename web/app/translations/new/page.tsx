import NewTranslationForm from "./NewTranslationForm";

export default async function NewTranslationPage({
  searchParams,
}: {
  searchParams?: Promise<{ entryId?: string; title?: string; returnTo?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const entryId = resolvedParams?.entryId ?? "";
  const title = resolvedParams?.title ?? "";
  const returnTo = resolvedParams?.returnTo ?? "/translations";
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">번역 추가</h1>
        <p className="text-slate-600">PDF를 보면서 빠르게 메모를 남기세요.</p>
      </header>

      <NewTranslationForm
        entryId={entryId}
        title={title}
        returnTo={returnTo}
        readOnly={isReadOnly}
      />
    </section>
  );
}
