import Link from "next/link";
import ModelSelector from "../ModelSelector";
import { getManualFileUrl, loadManifest } from "../../lib/manuals";
import { loadTranslations } from "../../lib/translation";
import type { ManifestEntry, ManualType, ModelCode } from "../../lib/types";

const allowedModels: ModelCode[] = [
  "125C",
  "125D",
  "125E",
  "125M",
  "310M",
  "350D",
  "350GK",
  "368E",
  "368G",
];

const typeLabels: Record<ManualType, string> = {
  engine: "엔진",
  chassis: "차대",
  user: "사용자",
  wiring: "회로도",
};

const typeOrder: ManualType[] = ["engine", "chassis", "wiring", "user"];

type EntryGroup = {
  key: string;
  title: string;
  section: string;
  entries: ManifestEntry[];
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

const buildSourceHref = (entry: ManifestEntry) => {
  return getManualFileUrl(entry.file);
};

const groupByTitleSection = (items: ManifestEntry[]): EntryGroup[] => {
  const map = new Map<string, EntryGroup>();

  for (const entry of items) {
    const key = `${entry.section}||${entry.title}`;
    const existing = map.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      map.set(key, {
        key,
        title: entry.title,
        section: entry.section,
        entries: [entry],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const sectionOrder = a.section.localeCompare(b.section, "ko");
    if (sectionOrder !== 0) return sectionOrder;
    return a.title.localeCompare(b.title, "ko");
  });
};

export default async function ManualsPage({
  searchParams,
}: {
  searchParams?: Promise<{ model?: string; highlight?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const modelParam = resolvedSearchParams?.model ?? "";
  const highlight = resolvedSearchParams?.highlight ?? "";

  let entries: ManifestEntry[] = [];
  let loadError: string | null = null;

  try {
    const allEntries = await loadManifest();
    entries = allEntries.filter((entry) => allowedModels.includes(entry.model));
  } catch {
    loadError = "매뉴얼 목록을 불러오지 못했습니다.";
  }

  if (loadError) {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼</h1>
          <p className="text-slate-600">{loadError}</p>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          `public/manuals/manifest.json` 파일을 확인해 주세요.
        </div>
      </section>
    );
  }

  const modelOptions = allowedModels.filter((model) =>
    entries.some((entry) => entry.model === model)
  );

  const selectedModel = modelOptions.includes(modelParam as ModelCode)
    ? (modelParam as ModelCode)
    : modelOptions[0] ?? allowedModels[0];

  const filtered = entries.filter((entry) => entry.model === selectedModel);
  const translations = await loadTranslations();
  const translationMap = new Map(
    translations.map((item) => [item.entryId, item])
  );

  const groupedByType: Record<ManualType, EntryGroup[]> = {
    engine: [],
    chassis: [],
    user: [],
    wiring: [],
  };

  for (const type of typeOrder) {
    const byType = filtered.filter((entry) => entry.manual_type === type);
    groupedByType[type] = groupByTitleSection(byType);
  }

  const selectorOptions = modelOptions.map((model) => ({
    id: model,
    label: model,
    href: `/manuals?model=${model}`,
  }));

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">매뉴얼</h1>
        <p className="text-slate-600">모델 {selectedModel} 매뉴얼 목록입니다.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="space-y-2">
          <ModelSelector
            options={selectorOptions}
            selected={selectedModel}
            title="모델 선택"
          />
          <p className="text-xs text-slate-500">
            중복된 매뉴얼은 같은 카드로 묶어 표시합니다.
          </p>
        </div>
      </section>

      {typeOrder.map((type) => {
        const groups = groupedByType[type] ?? [];
        return (
          <div key={type} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {typeLabels[type]}
              </h2>
              <span className="text-sm text-slate-500">{groups.length}건</span>
            </div>

            {groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                해당 구분의 매뉴얼이 없습니다.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {groups.map((group) => {
                  const isHighlighted = group.entries.some(
                    (entry) => entry.id === highlight
                  );
                  const translation = group.entries
                    .map((entry) => translationMap.get(entry.id))
                    .find(Boolean);

                  return (
                    <article
                      key={group.key}
                      className={`rounded-2xl border bg-white p-5 shadow-sm ${
                        isHighlighted
                          ? "border-slate-900 ring-2 ring-slate-900/15"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {group.title}
                        </h3>
                        {translation?.title_ko ? (
                          <p className="text-xs text-slate-500">
                            {translation.title_ko}
                          </p>
                        ) : null}
                        <p className="text-sm text-slate-600">{group.section}</p>
                      </div>

                      <div className="mt-4 space-y-3">
                        {group.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-semibold">페이지:</span> {entry.pages.start} - {entry.pages.end}
                                <span className="mx-2 text-slate-400">|</span>
                                <span className="font-semibold">언어:</span> {entry.language}
                                {entry.doc_date ? (
                                  <>
                                    <span className="mx-2 text-slate-400">|</span>
                                    <span className="font-semibold">문서일:</span> {entry.doc_date}
                                  </>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={buildViewerHref(entry)}
                                  className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                >
                                  보기
                                </Link>
                                <a
                                  href={buildSourceHref(entry)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                >
                                  원본
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
