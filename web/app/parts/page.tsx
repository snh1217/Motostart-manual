import PartAdminPanel from "./PartAdminPanel";
import { loadParts } from "../../lib/parts";
import type { PartEntry } from "../../lib/types";
import Link from "next/link";
import PartUploadForm from "./PartUploadForm";
import { cookies } from "next/headers";
import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";
import { SESSION_COOKIE, parseSessionValue } from "../../lib/auth/session";
import { sortModelCodes } from "../../lib/modelSort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const systemLabels: Record<string, string> = {
  all: "전체",
  engine: "엔진",
  chassis: "차체",
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
  searchParams: Promise<{ model?: string; system?: string; q?: string; edit?: string }>;
}) {
  const resolved = await searchParams;
  const model = resolved?.model ?? "all";
  const system = resolved?.system ?? "all";
  const q = resolved?.q ?? "";
  const editId = resolved?.edit?.trim() ?? "";
  const role = parseSessionValue((await cookies()).get(SESSION_COOKIE)?.value ?? null);
  const isAdmin = role === "admin";
  const shouldPrefetch = Boolean(editId) || model !== "all" || system !== "all" || q.trim() !== "";
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const items = shouldPrefetch ? await loadParts({ model, system, q }) : [];
  const scored = tokens.length
    ? items
        .map((item) => ({ item, score: score(item, tokens) }))
        .filter((i) => i.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((i) => i.item)
    : items;

  const editEntry = editId ? (await loadParts({ id: editId })).at(0) ?? null : null;
  const modelOptions = await loadModelOptions();
  const partsPdfUrl = process.env.NEXT_PUBLIC_PARTS_LIST_PDF_URL ?? "";

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">부품/절차</h1>
        <p className="text-sm text-slate-600">
          부품별 사진과 탈거/조립 절차를 관리합니다. (Supabase 연결 시 DB 우선)
        </p>
        <p className="text-xs text-slate-500">
          검색용으로만 사용한다면 아래 관리자 도구는 펼치지 않아도 됩니다.
        </p>
        {partsPdfUrl ? (
          <div className="flex flex-col gap-1">
            <a
              href={partsPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              파츠리스트 PDF 새창으로 열기
            </a>
            <span className="text-xs text-slate-500">
              PDF에서 복사/붙여넣기는 가능하지만 자동 추출은 지원하지 않습니다.
            </span>
          </div>
        ) : isAdmin ? (
          <p className="text-xs text-slate-500">
            파츠리스트 PDF 링크를 쓰려면 `NEXT_PUBLIC_PARTS_LIST_PDF_URL`을 설정하세요.
          </p>
        ) : null}
        <PartFilters model={model} system={system} modelOptions={modelOptions} q={q} />
      </header>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>총 {scored.length}건</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {scored.length ? (
            scored.map((entry, idx) => (
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
                  <span className="text-xs text-slate-500">{entry.updated_at ?? ""}</span>
                </div>

                {entry.photos?.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {entry.photos.slice(0, 3).map((photo, i) => (
                      <a
                        key={`${entry.id}-photo-${i}`}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-20 overflow-hidden rounded-lg border border-slate-100 bg-slate-50"
                      >
                        <img
                          src={photo.url}
                          alt={photo.label ?? entry.name}
                          className="h-full w-full object-cover"
                        />
                      </a>
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

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {entry.source === "db" ? "DB" : "JSON"}
                  </span>
                  <Link
                    href={`/parts/${encodeURIComponent(entry.id)}`}
                    className="rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-slate-300"
                  >
                    상세 보기
                  </Link>
                  {isAdmin ? (
                    <Link
                      href={`/parts?edit=${encodeURIComponent(entry.id)}`}
                      className="rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-slate-300"
                    >
                      수정
                    </Link>
                  ) : null}
                  <Link
                    href={`/viewer?entryId=${encodeURIComponent(entry.id)}&title=${encodeURIComponent(
                      entry.name
                    )}`}
                    className="rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-slate-300"
                  >
                    관련 매뉴얼 보기
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              {shouldPrefetch
                ? "등록된 부품/절차가 없습니다."
                : "모델, 시스템, 검색어를 선택해 주세요."}
            </div>
          )}
        </div>
      </div>

      {isAdmin ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">관리자 도구</h2>
                <p className="text-xs text-slate-500">
                  부품 추가/업로드/사진 등록 (ADMIN_TOKEN 필요)
                </p>
              </div>
              <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                펼치기/접기
              </span>
            </div>
          </summary>
          <div className="mt-4 space-y-4">
            <PartAdminPanel initialEntry={editEntry} />
            <PartUploadForm />
          </div>
        </details>
      ) : null}
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
    <form
      method="get"
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600">모델 선택</div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "전체" },
            ...modelOptions.map((item) => ({ id: item, label: item })),
          ].map((option) => (
            <label key={option.id} className="cursor-pointer">
              <input
                type="radio"
                name="model"
                value={option.id}
                defaultChecked={model === option.id}
                className="peer sr-only"
              />
              <span className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 transition peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600">시스템 선택</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(systemLabels).map(([id, label]) => (
            <label key={id} className="cursor-pointer">
              <input
                type="radio"
                name="system"
                value={id}
                defaultChecked={system === id}
                className="peer sr-only"
              />
              <span className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 transition peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
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
      </div>
    </form>
  );
}

const loadModelOptions = cache(async (): Promise<string[]> => {
  try {
    const modelsPath = path.resolve(process.cwd(), "data", "models.json");
    const raw = await fs.readFile(modelsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized) as Array<{ id: string }>;
    if (!Array.isArray(parsed)) return [];
    return sortModelCodes(parsed).map((item) => item.id);
  } catch {
    return [];
  }
});
