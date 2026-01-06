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
          ← 부품/절차로 돌아가기
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
              <div
                key={`${entry.id}-photo-${idx}`}
                className="rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{photo.label ?? `사진 ${idx + 1}`}</span>
                  {photo.url ? (
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300"
                    >
                      원본 보기
                    </a>
                  ) : null}
                </div>
                {photo.url ? (
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                    <img
                      src={photo.url}
                      alt={photo.label ?? entry.name}
                      className="h-52 w-full object-contain"
                    />
                  </div>
                ) : null}
                {photo.desc ? (
                  <p className="mt-2 text-xs text-slate-500">{photo.desc}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {entry.steps?.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">단계</h2>
          <div className="space-y-3">
            {entry.steps.map((step, idx) => (
              <div
                key={`${entry.id}-step-${idx}`}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    {step.order}. {step.title}
                  </div>
                  {step.torque ? (
                    <span className="text-xs text-slate-500">토크: {step.torque}</span>
                  ) : null}
                </div>
                {step.desc ? <p className="mt-2 text-sm text-slate-700">{step.desc}</p> : null}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  {step.tools ? <span>공구: {step.tools}</span> : null}
                  {step.note ? <span className="text-amber-600">주의: {step.note}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
