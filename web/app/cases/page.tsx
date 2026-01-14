import Link from "next/link";
import { headers, cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import CasesAdminPanel from "./CasesAdminPanel";
import { SESSION_COOKIE, parseSessionValue } from "../../lib/auth/session";
import { sortModelCodes } from "../../lib/modelSort";
import ModelSelector from "../ModelSelector";

type CaseRow = {
  id: string;
  model: string;
  system?: string;
  category?: string;
  symptom?: string;
  symptomTitle?: string;
  title?: string;
  description?: string;
  fixSteps?: string;
  action?: string;
  diagnosisTreeId?: string;
  diagnosisResultId?: string;
  photo_1?: string;
  photo_1_desc?: string;
  photo_2?: string;
  photo_2_desc?: string;
  photo_3?: string;
  photo_3_desc?: string;
  photo_4?: string;
  photo_4_desc?: string;
  photo_5?: string;
  photo_5_desc?: string;
};

const systemLabels: Record<string, string> = {
  all: "전체",
  engine: "엔진",
  chassis: "차대",
  electrical: "전장",
};

const buildApiUrl = async (query: string) => {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/api/cases?${query}` : `/api/cases?${query}`;
};

const loadCases = cache(
  async (
    model: string,
    system: string,
    diagnosisTreeId?: string,
    diagnosisResultId?: string
  ): Promise<CaseRow[]> => {
  const params = new URLSearchParams();
  if (model) params.set("model", model);
  if (system) params.set("system", system);
  if (diagnosisTreeId) params.set("diagnosisTreeId", diagnosisTreeId);
  if (diagnosisResultId) params.set("diagnosisResultId", diagnosisResultId);
  try {
    const apiUrl = await buildApiUrl(params.toString());
    const response = await fetch(apiUrl, { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { items?: CaseRow[] };
      return data.items ?? [];
    }
  } catch {
    // fall back to file
  }

  try {
    const casesPath = path.resolve(process.cwd(), "data", "cases.json");
    const raw = await fs.readFile(casesPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as CaseRow[]) : [];
  } catch {
    return [];
  }
});

const buildQuery = (
  model: string,
  system: string,
  diagnosisTreeId?: string,
  diagnosisResultId?: string
) => {
  const params = new URLSearchParams();
  params.set("model", model);
  params.set("system", system);
  if (diagnosisTreeId) params.set("diagnosisTreeId", diagnosisTreeId);
  if (diagnosisResultId) params.set("diagnosisResultId", diagnosisResultId);
  return `?${params.toString()}`;
};

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

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    model?: string;
    system?: string;
    diagnosisTreeId?: string;
    diagnosisResultId?: string;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const model = resolvedSearchParams?.model ?? "all";
  const system = resolvedSearchParams?.system ?? "all";
  const diagnosisTreeId = resolvedSearchParams?.diagnosisTreeId?.trim() ?? "";
  const diagnosisResultId = resolvedSearchParams?.diagnosisResultId?.trim() ?? "";
  const isReadOnly = process.env.READ_ONLY_MODE === "1";
  const role = parseSessionValue((await cookies()).get(SESSION_COOKIE)?.value ?? null);
  const isAdmin = role === "admin";

  const modelOptions = await loadModelOptions();
  const hasDiagnosisFilter = Boolean(diagnosisTreeId || diagnosisResultId);
  const shouldPrefetch = model !== "all" || system !== "all" || hasDiagnosisFilter;
  const filteredCases = shouldPrefetch
    ? await loadCases(model, system, diagnosisTreeId, diagnosisResultId)
    : [];
  const selectorOptions = [
    { id: "all", label: "전체", href: `/cases${buildQuery("all", system, diagnosisTreeId, diagnosisResultId)}` },
    ...modelOptions.map((id) => ({
      id,
      label: id,
      href: `/cases${buildQuery(id, system, diagnosisTreeId, diagnosisResultId)}`,
    })),
  ];

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">정비사례</h1>
        <p className="text-slate-600">
          CSV/XLSX 양식으로 사례를 업로드하고 확인할 수 있습니다.
        </p>
        {isReadOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            읽기 전용 모드입니다. 업로드 및 저장 기능이 비활성화됩니다.
          </div>
        ) : null}
      </header>

      {hasDiagnosisFilter ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          ì§„ë‹¨ ê²°ê³¼ë¡œ í•„í„°ë§ ì¤‘ìž…ë‹ˆ??.
          <Link
            href={`/cases${buildQuery(model, "all")}`}
            className="ml-2 font-semibold text-slate-700 underline"
          >
            í•„í„° í•´ì œ
          </Link>
        </div>
      ) : null}

      {isAdmin ? (
        <CasesAdminPanel readOnly={isReadOnly} selectedModel={model} />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <ModelSelector
          options={selectorOptions}
          selected={model}
          title="모델 선택"
        />
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200">
          {Object.entries(systemLabels).map(([value, label]) => (
            <Link
              key={value}
              href={`/cases${buildQuery(model, value, diagnosisTreeId, diagnosisResultId)}`}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                system === value
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {filteredCases.length ? (
            filteredCases.map((item) => {
              const photoDesc =
                item.photo_1_desc ||
                item.photo_2_desc ||
                item.photo_3_desc ||
                item.photo_4_desc ||
                item.photo_5_desc;
              const title =
                item.title || item.symptomTitle || item.symptom || "?ì •?˜ì§€?Šì€ ?¬ë?";
              const summary = item.fixSteps || item.action || item.description || "";
              const categoryLabel =
                item.system ? systemLabels[item.system] ?? item.system : item.category ?? "-";
              return (
              <Link
                key={item.id}
                href={`/cases/${item.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                    {item.model}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                    {categoryLabel}
                  </span>
                  {item.diagnosisResultId ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                      ì§„ë‹¨ ì—°ê²°
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_140px]">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {title}
                    </h3>
                    {summary ? (
                      <p className="mt-2 text-sm text-slate-600">
                        {summary.slice(0, 120)}
                        {summary.length > 120 ? "..." : ""}
                      </p>
                    ) : null}
                  </div>
                  {item.photo_1 ? (
                    <div className="h-28 w-full overflow-hidden rounded-xl border border-slate-200">
                      <img
                        src={item.photo_1}
                        alt={title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
                {photoDesc ? (
                  <p className="mt-3 text-xs text-slate-500">
                    사진 설명: {photoDesc}
                  </p>
                ) : null}
              </Link>
            );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              {shouldPrefetch
                ? "등록된 정비사례가 없습니다."
                : "모델 또는 시스템을 선택해 주세요."}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
