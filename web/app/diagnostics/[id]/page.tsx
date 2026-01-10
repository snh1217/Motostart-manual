import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDiagnosticById } from "../../../lib/diagnostics";
import type { DiagnosticEntry } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DiagnosticDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const id = resolved?.id ?? "";
  const item: DiagnosticEntry | null = await getDiagnosticById(id);
  if (!item) return notFound();

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold text-slate-500">{item.model}</p>
        <h1 className="text-2xl font-semibold text-slate-900">{item.title}</h1>
        {item.section ? <p className="text-sm text-slate-600">{item.section}</p> : null}
        {item.updated_at ? (
          <p className="text-xs text-slate-500">업데이트: {item.updated_at}</p>
        ) : null}
        <div className="flex gap-2">
          <Link
            href="/diagnostics"
            className="text-sm text-slate-600 underline underline-offset-4"
          >
            목록으로
          </Link>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Image
          src={item.image}
          alt={item.title}
          width={1200}
          height={800}
          className="w-full bg-white object-contain"
        />
      </div>

      {item.video_cold_url || item.video_hot_url ? (
        <div className="grid gap-3 md:grid-cols-2">
          {item.video_cold_url ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-600">냉간시</div>
              <video src={item.video_cold_url} controls className="mt-2 w-full rounded-xl bg-slate-50" />
            </div>
          ) : null}
          {item.video_hot_url ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-600">열간시</div>
              <video src={item.video_hot_url} controls className="mt-2 w-full rounded-xl bg-slate-50" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">항목</th>
              <th className="px-4 py-3 font-semibold">값</th>
              <th className="px-4 py-3 font-semibold">비고</th>
            </tr>
          </thead>
          <tbody>
            {item.lines.map((line, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-800">{line.label}</td>
                <td className="px-4 py-3 text-slate-700">{line.value}</td>
                <td className="px-4 py-3 text-slate-500">{line.note ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {item.note ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {item.note}
        </div>
      ) : null}
    </section>
  );
}
