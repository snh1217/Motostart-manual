import Link from "next/link";
import {
  filterByModel,
  groupByManualType,
  loadManifest,
  sortEntriesBySectionThenTitle,
} from "../../lib/manuals";
import { loadTranslations } from "../../lib/translation";
import type { ManifestEntry, ManualType, ModelCode } from "../../lib/types";

const knownModels: ModelCode[] = ["350D", "368G", "125M"];
const typeLabels: Record<ManualType, string> = {
  engine: "엔진",
  chassis: "차대",
  user: "사용자",
  wiring: "회로",
};

const buildViewerHref = (entry: ManifestEntry) => {
  const params = new URLSearchParams({
    entryId: entry.id,
    file: entry.file,
    title: entry.title,
    page: entry.pages.start.toString(),
  });
  return `/viewer?${params.toString()}`;
};

export default async function ManualsPage({
  searchParams,
}: {
  searchParams?: Promise<{ model?: string; highlight?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const modelParam = resolvedSearchParams?.model ?? "350D";
  const highlight = resolvedSearchParams?.highlight ?? "";
  const model = knownModels.includes(modelParam as ModelCode)
    ? (modelParam as ModelCode)
    : null;

  let entries: ManifestEntry[] = [];
  let loadError: string | null = null;

  try {
    entries = await loadManifest();
  } catch {
    loadError = "manifest.json을 읽을 수 없습니다.";
  }

  const translations = await loadTranslations();
  const translationMap = new Map(
    translations.map((item) => [item.entryId, item])
  );

  if (!model) {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼</h1>
          <p className="text-slate-600">
            요청한 모델이 유효하지 않습니다.
          </p>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          model 파라미터를 350D, 368G, 125M 중 하나로 지정해주세요.
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼</h1>
          <p className="text-slate-600">{loadError}</p>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          public/manuals/manifest.json 파일을 확인해주세요.
        </div>
      </section>
    );
  }

  const filtered = sortEntriesBySectionThenTitle(filterByModel(entries, model));
  const grouped = groupByManualType(filtered);

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">매뉴얼</h1>
        <p className="text-slate-600">모델 {model} 매뉴얼 목록입니다.</p>
      </header>

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {typeLabels[type as ManualType]}
            </h2>
            <span className="text-sm text-slate-500">{items.length}건</span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              해당 유형의 매뉴얼이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((entry) => {
                const isHighlighted = highlight === entry.id;
                const translation = translationMap.get(entry.id);
                return (
                  <article
                    key={entry.id}
                    id={`entry-${entry.id}`}
                    className={`rounded-2xl border bg-white p-5 shadow-sm ${
                      isHighlighted
                        ? "border-slate-900 ring-2 ring-slate-900/15"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {entry.title}
                      </h3>
                      {translation?.title_ko ? (
                        <p className="text-xs text-slate-500">
                          {translation.title_ko}
                        </p>
                      ) : null}
                      <p className="text-sm text-slate-600">{entry.section}</p>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div>
                        <dt className="text-xs uppercase text-slate-400">페이지</dt>
                        <dd>
                          {entry.pages.start} - {entry.pages.end}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-slate-400">언어</dt>
                        <dd>{entry.language}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-slate-400">날짜</dt>
                        <dd>{entry.doc_date ?? "-"}</dd>
                      </div>
                    </dl>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={buildViewerHref(entry)}
                        className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        원본 보기
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}