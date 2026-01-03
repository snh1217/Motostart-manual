import type { DiagnosticEntry } from "../../lib/types";
import { loadDiagnostics } from "../../lib/diagnostics";
import Link from "next/link";
import Image from "next/image";
import ModelSelector from "../ModelSelector";
import DiagnosticsAdminPanel from "./AdminPanel";
import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSessionValue } from "../../lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const modelOptions = [
  { id: "all", label: "전체", href: "/diagnostics" },
  { id: "125C", label: "125C", href: "/diagnostics?model=125C" },
  { id: "125D", label: "125D", href: "/diagnostics?model=125D" },
  { id: "125E", label: "125E", href: "/diagnostics?model=125E" },
  { id: "125M", label: "125M", href: "/diagnostics?model=125M" },
  { id: "310M", label: "310M", href: "/diagnostics?model=310M" },
  { id: "350D", label: "350D", href: "/diagnostics?model=350D" },
  { id: "350GK", label: "350GK", href: "/diagnostics?model=350GK" },
  { id: "368E", label: "368E", href: "/diagnostics?model=368E" },
  { id: "368G", label: "368G", href: "/diagnostics?model=368G" },
];

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string }>;
}) {
  const resolved = await searchParams;
  const selectedModel = resolved?.model ?? "all";
  const role = parseSessionValue((await cookies()).get(SESSION_COOKIE)?.value ?? null);
  const isAdmin = role === "admin";
  const shouldPrefetch = selectedModel !== "all";
  const filtered = shouldPrefetch ? await loadDiagnostics({ model: selectedModel }) : [];

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">진단기 매뉴얼</h1>
        <p className="text-sm text-slate-600">
          진단기 화면 캡처를 등록하고, 라인별 설명을 관리합니다.
        </p>
        <ModelSelector options={modelOptions} selected={selectedModel} />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.length ? (
          filtered.map((item) => <DiagnosticCard key={item.id} item={item} />)
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
            {shouldPrefetch
              ? "등록된 항목이 없습니다."
              : "모델을 선택해 주세요."}
          </div>
        )}
      </div>

      {isAdmin ? <DiagnosticsAdminPanel /> : null}
    </section>
  );
}

function DiagnosticCard({ item }: { item: DiagnosticEntry }) {
  const sourceLabel = item.source === "db" ? "DB" : item.source === "json" ? "JSON" : null;
  const sourceTone =
    item.source === "db"
      ? "bg-emerald-50 text-emerald-700"
      : item.source === "json"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-500">{item.model}</p>
            {sourceLabel ? (
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${sourceTone}`}>
                {sourceLabel}
              </span>
            ) : null}
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
          {item.section ? <p className="text-sm text-slate-600">{item.section}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {item.updated_at ?? "-"}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
        <Image
          src={item.image}
          alt={item.title}
          width={800}
          height={450}
          className="h-48 w-full bg-white object-contain"
        />
      </div>

      <div className="mt-3 space-y-1 text-sm text-slate-700">
        {item.lines.slice(0, 3).map((line, idx) => (
          <p key={idx}>
            <span className="font-semibold">{line.label}: </span>
            {line.value}
            {line.note ? <span className="text-slate-500"> ({line.note})</span> : null}
          </p>
        ))}
        {item.lines.length > 3 ? (
          <p className="text-xs text-slate-500">+{item.lines.length - 3}건</p>
        ) : null}
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={`/diagnostics/${item.id}`}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          상세 보기
        </Link>
      </div>
    </article>
  );
}
