import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { loadParts } from "../../../lib/parts";
import { SESSION_COOKIE, parseSessionValue } from "../../../lib/auth/session";
import PartAdminActions from "../PartAdminActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const systemLabels: Record<string, string> = {
  engine: "엔진",
  chassis: "차체",
  electrical: "전장",
  other: "기타",
};

export default async function PartDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const entry = (await loadParts({ id: params.id })).at(0);
  if (!entry) notFound();

  const role = parseSessionValue((await cookies()).get(SESSION_COOKIE)?.value ?? null);
  const isAdmin = role === "admin";

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link href="/parts" className="text-sm font-semibold text-slate-600">
          부품/절차로 돌아가기
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                {entry.model}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {systemLabels[entry.system] ?? entry.system}
              </span>
              {entry.tags?.length ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  #{entry.tags.slice(0, 5).join(" #")}
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">{entry.name}</h1>
            {entry.summary ? <p className="text-sm text-slate-600">{entry.summary}</p> : null}
          </div>
          <div className="text-xs text-slate-500">{entry.updated_at ?? ""}</div>
        </div>
        {isAdmin ? <PartAdminActions id={entry.id} /> : null}
      </header>

      {entry.photos?.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">사진</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.photos.map((photo, idx) => (
              <div key={photo.id ?? `${photo.url}-${idx}`} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                <img
                  src={photo.url}
                  alt={photo.label ?? `사진 ${idx + 1}`}
                  className="h-48 w-full rounded-xl object-contain bg-slate-50"
                />
                <div className="text-sm font-semibold text-slate-800">
                  {photo.label ?? `사진 ${idx + 1}`}
                </div>
                {photo.desc ? <p className="text-xs text-slate-500">{photo.desc}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {entry.videos?.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">동영상</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.videos.map((video, idx) => (
              <div key={video.id ?? `${video.url}-${idx}`} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                <video src={video.url} controls className="w-full rounded-xl bg-slate-50" />
                <div className="text-sm font-semibold text-slate-800">
                  {video.label ?? `동영상 ${idx + 1}`}
                </div>
                {video.desc ? <p className="text-xs text-slate-500">{video.desc}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {entry.steps?.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">작업 절차</h2>
          <div className="space-y-3">
            {entry.steps
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step, idx) => (
                <article key={`${step.order}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-800">
                    {step.order}. {step.title}
                  </div>
                  {step.desc ? <p className="mt-2 text-sm text-slate-600">{step.desc}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {step.tools ? <span>도구: {step.tools}</span> : null}
                    {step.torque ? <span>토크: {step.torque}</span> : null}
                    {step.note ? <span>비고: {step.note}</span> : null}
                  </div>
                </article>
              ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
