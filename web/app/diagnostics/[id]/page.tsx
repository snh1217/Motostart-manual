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
  const images = (item.images?.length ? item.images : [item.image])
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url));
  const legacyVideo = (item as { video_url?: string })?.video_url?.trim() ?? "";
  const coldVideo = item.video_cold_url?.trim() ?? "";
  const hotVideo = item.video_hot_url?.trim() ?? "";
  const videoUrls = [
    coldVideo || "",
    hotVideo || "",
    !coldVideo && !hotVideo ? legacyVideo : "",
  ].filter((url): url is string => Boolean(url));
  const lines = item.lines.map((line) => {
    const legacy = line as unknown as { label?: string; value?: string };
    return {
      source: line.source ?? legacy.label ?? "",
      translation: line.translation ?? "",
      data: line.data ?? legacy.value ?? "",
      analysis: line.analysis ?? "",
      note: line.note ?? "",
    };
  });

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

      {videoUrls.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            동영상 ({videoUrls.length}개)
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {coldVideo ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-600">냉간시</div>
                <video src={coldVideo} controls className="mt-2 w-full rounded-xl bg-slate-50" />
                <a
                  href={coldVideo}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-slate-500 underline"
                >
                  새 탭에서 보기
                </a>
              </div>
            ) : null}
            {hotVideo ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-600">열간시</div>
                <video src={hotVideo} controls className="mt-2 w-full rounded-xl bg-slate-50" />
                <a
                  href={hotVideo}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-slate-500 underline"
                >
                  새 탭에서 보기
                </a>
              </div>
            ) : null}
            {!coldVideo && !hotVideo && legacyVideo ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-600">동영상</div>
                <video src={legacyVideo} controls className="mt-2 w-full rounded-xl bg-slate-50" />
                <a
                  href={legacyVideo}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-slate-500 underline"
                >
                  새 탭에서 보기
                </a>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            사진 ({images.length}장)
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {images.map((url, idx) => (
            <a
              key={`${url}-${idx}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <Image
                src={url}
                alt={`${item.title} ${idx + 1}`}
                width={1200}
                height={800}
                className="h-40 w-full bg-white object-contain"
              />
              <span className="mt-2 block text-xs text-slate-500">원본 열기</span>
            </a>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">원문 항목</th>
              <th className="px-4 py-3 font-semibold">번역 항목</th>
              <th className="px-4 py-3 font-semibold">데이터</th>
              <th className="px-4 py-3 font-semibold">데이터 분석</th>
              <th className="px-4 py-3 font-semibold">비고</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-800">{line.source}</td>
                <td className="px-4 py-3 text-slate-700">{line.translation || "-"}</td>
                <td className="px-4 py-3 text-slate-700">{line.data}</td>
                <td className="px-4 py-3 text-slate-700">{line.analysis || "-"}</td>
                <td className="px-4 py-3 text-slate-500">{line.note || "-"}</td>
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
