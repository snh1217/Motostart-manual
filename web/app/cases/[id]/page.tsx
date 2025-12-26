import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";

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
  engine: "엔진",
  chassis: "차대",
  electrical: "전장",
};

const loadCases = async (): Promise<CaseRow[]> => {
  try {
    const casesPath = path.resolve(process.cwd(), "data", "cases.json");
    const raw = await fs.readFile(casesPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CaseRow[]) : [];
  } catch {
    return [];
  }
};

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const cases = await loadCases();
  const item = cases.find((row) => row.id === resolvedParams.id);

  if (!item) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">정비사례</h1>
        <p className="text-slate-600">해당 사례를 찾을 수 없습니다.</p>
        <Link className="text-sm text-slate-500 underline" href="/cases">
          목록으로 돌아가기
        </Link>
      </section>
    );
  }

  const photos = [item.photo_1, item.photo_2, item.photo_3].filter(Boolean);

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <Link className="text-sm text-slate-500 underline" href="/cases">
          목록으로 돌아가기
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
            {item.model}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
            {systemLabels[item.system] ?? item.system}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">{item.symptom}</h1>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">조치 내용</h2>
        <p className="mt-3 text-sm text-slate-700">{item.action}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">사진</h2>
        {photos.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <div
                key={`${item.id}-photo-${index}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <img src={photo} alt={item.symptom} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            등록된 사진이 없습니다.
          </div>
        )}
      </section>
    </section>
  );
}
