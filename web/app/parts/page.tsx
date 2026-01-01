import PartAdminPanel from "./PartAdminPanel";
import { loadParts } from "../../lib/parts";
import type { PartEntry } from "../../lib/types";
import Link from "next/link";
import PartUploadForm from "./PartUploadForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const systemLabels: Record<string, string> = {
  all: "전체",
  engine: "엔진",
  chassis: "차대",
  electrical: "전장",
  other: "기타",
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const score = (entry: PartEntry, tokens: string[]) => {
  const haystack = normalizeText(
    [
      entry.name,
      entry.summary,
      entry.tags?.join(" "),
      entry.steps?.map((s) => `${s.title} ${s.desc}`).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );
  return tokens.filter((t) => haystack.includes(t)).length;
};

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string; system?: string; q?: string }>;
}) {
  const resolved = await searchParams;
  const model = resolved?.model ?? "all";
  const system = resolved?.system ?? "all";
  const q = resolved?.q ?? "";
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const items = await loadParts({ model, system, q });
  const scored = tokens.length
    ? items
        .map((item) => ({ item, score: score(item, tokens) }))
        .filter((i) => i.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((i) => i.item)
    : items;

  const modelOptions = Array.from(new Set(items.map((i) => i.model))).sort();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">부품 절차</h1>
        <p className="text-sm text-slate-600">
          부품별 사진과 탈거/조립 절차를 관리합니다. (Supabase가 연결되면 DB 우선)
        </p>
        <PartFilters model={model} system={system} modelOptions={modelOptions} q={q} />
      </header>

      <PartAdminPanel />
      <PartUploadForm />

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>총 {scored.length}건</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {scored.map((entry, idx) => (
            <article
              key={`${entry.id}-${idx}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                      {entry.model}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">
                      {systemLabels[entry.system] ?? entry.system}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">{entry.name}</h2>
                  {entry.summary ? (
                    <p className="text-sm text-slate-600">{entry.summary}</p>
                  ) : null}
                  {entry.tags?.length ? (
                    <div className="flex flex-wrap gap-1 text-xs text-slate-500">
                      {entry.tags.slice(0, 6).map((tag, i) => (
                        <span
                          key={`${entry.id}-tag-${i}`}
                          className="rounded-full bg-slate-100 px-2 py-0.5"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="text-xs text-slate-500">
                  {entry.updated_at ?? ""}
                </span>
              </div>

              {entry.photos?.length ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {entry.photos.slice(0, 3).map((photo, i) => (
                    <div
                      key={`${entry.id}-photo-${i}`}
                      className="h-20 overflow-hidden rounded-lg border border-slate-100 bg-slate-50"
                    >
                      <img
                        src={photo.url}
                        alt={photo.label ?? entry.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {entry.steps?.length ? (
                <div className="mt-4 space-y-3">
                  {entry.steps.map((step, i) => (
                    <div
                      key={`${entry.id}-step-${i}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">
                          {step.order}. {step.title}
                        </div>
                        {step.torque ? (
                          <span className="text-xs text-slate-500">토크: {step.torque}</span>
                        ) : null}
                      </div>
                      {step.desc ? <p className="mt-1">{step.desc}</p> : null}
                      {step.tools ? (
                        <p className="mt-1 text-xs text-slate-500">공구: {step.tools}</p>
                      ) : null}
                      {step.note ? (
                        <p className="mt-1 text-xs text-amber-600">주의: {step.note}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {entry.source === "db" ? "DB" : "JSON"}
                </span>
                <Link
                  href={`/viewer?entryId=${encodeURIComponent(entry.id)}&title=${encodeURIComponent(entry.name)}`}
                  className="rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-slate-300"
                >
                  관련 매뉴얼 보기
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PartFilters({
  model,
  system,
  modelOptions,
  q,
}: {
  model: string;
  system: string;
  modelOptions: string[];
  q: string;
}) {
  return (
    <form method="get" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row">
      <select
        name="model"
        defaultValue={model}
        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 focus:border-slate-400 focus:outline-none lg:w-40"
      >
        <option value="all">전체</option>
        {modelOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <select
        name="system"
        defaultValue={system}
        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 focus:border-slate-400 focus:outline-none lg:w-40"
      >
        {Object.entries(systemLabels).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <input
        name="q"
        defaultValue={q}
        placeholder="예: 클러치 커버, 점화코일, 볼트"
        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
      >
        검색
      </button>
    </form>
  );
}
