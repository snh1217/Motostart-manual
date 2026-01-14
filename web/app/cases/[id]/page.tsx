import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";

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
  engine: "엔진",
  chassis: "차대",
  electrical: "전장",
};

const loadCases = async (): Promise<CaseRow[]> => {
  try {
    const casesPath = path.resolve(process.cwd(), "data", "cases.json");
    const raw = await fs.readFile(casesPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
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

  const title = item.title || item.symptomTitle || item.symptom || "?•ë¹„?¬ë?";
  const description = item.description || item.symptom || "";
  const fixSteps = item.fixSteps || item.action || "";
  const categoryLabel =
    item.system ? systemLabels[item.system] ?? item.system : item.category ?? "-";

  const photos = [
    { src: item.photo_1, desc: item.photo_1_desc },
    { src: item.photo_2, desc: item.photo_2_desc },
    { src: item.photo_3, desc: item.photo_3_desc },
    { src: item.photo_4, desc: item.photo_4_desc },
    { src: item.photo_5, desc: item.photo_5_desc },
  ].filter((photo) => photo.src);

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
            {categoryLabel}
          </span>
          {item.diagnosisResultId ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
              ì§„ë‹¨ ì—°ê²°
            </span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">??/??</h2>
        <p className="mt-3 text-sm text-slate-700">{description || "-"}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">조치 내용</h2>
        <p className="mt-3 text-sm text-slate-700">{fixSteps || "-"}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">사진</h2>
        {photos.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <figure
                key={`${item.id}-photo-${index}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <img
                  src={photo.src}
                  alt={title}
                  className="h-full w-full object-cover"
                />
                {photo.desc ? (
                  <figcaption className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
                    {photo.desc}
                  </figcaption>
                ) : null}
              </figure>
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
