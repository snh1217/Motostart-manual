import Link from "next/link";
import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import UploadForm from "./UploadForm";

type CaseRow = {
  id: string;
  model: string;
  system: string;
  symptom: string;
  action: string;
  photo_1?: string;
  photo_2?: string;
  photo_3?: string;
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

const loadCases = async (): Promise<CaseRow[]> => {
  try {
    const apiUrl = await buildApiUrl("model=all");
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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CaseRow[]) : [];
  } catch {
    return [];
  }
};

const buildQuery = (model: string, system: string) => {
  const params = new URLSearchParams();
  params.set("model", model);
  params.set("system", system);
  return `?${params.toString()}`;
};

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: Promise<{ model?: string; system?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const model = resolvedSearchParams?.model ?? "all";
  const system = resolvedSearchParams?.system ?? "all";
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

  const cases = await loadCases();
  const modelOptions = Array.from(new Set(cases.map((item) => item.model))).sort();

  const filteredCases = cases.filter((item) => {
    if (model !== "all" && item.model !== model) return false;
    if (system !== "all" && item.system !== system) return false;
    return true;
  });

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

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">양식 다운로드</h2>
        <p className="mt-1 text-sm text-slate-600">
          엑셀 또는 CSV 양식을 내려받아 작성하세요.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/cases_template.xlsx"
          >
            양식 다운로드(엑셀)
          </a>
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/cases_template.csv"
          >
            양식 다운로드(CSV)
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">업로드</h2>
        <p className="mt-1 text-sm text-slate-600">
          CSV 또는 XLSX 파일을 업로드하세요.
        </p>
        <div className="mt-4">
          <UploadForm readOnly={isReadOnly} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-600" htmlFor="model">
            모델
          </label>
          <form method="get" className="flex flex-wrap items-center gap-3">
            <select
              id="model"
              name="model"
              defaultValue={model}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="all">전체</option>
              {modelOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input type="hidden" name="system" value={system} />
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              적용
            </button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200">
          {Object.entries(systemLabels).map(([value, label]) => (
            <Link
              key={value}
              href={`/cases${buildQuery(model, value)}`}
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
            filteredCases.map((item) => (
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
                    {systemLabels[item.system] ?? item.system}
                  </span>
                </div>
                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_140px]">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {item.symptom}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {item.action.slice(0, 120)}
                      {item.action.length > 120 ? "..." : ""}
                    </p>
                  </div>
                  {item.photo_1 ? (
                    <div className="h-28 w-full overflow-hidden rounded-xl border border-slate-200">
                      <img
                        src={item.photo_1}
                        alt={item.symptom}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              등록된 정비사례가 없습니다.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
