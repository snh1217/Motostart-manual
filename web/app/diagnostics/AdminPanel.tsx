import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { DiagnosticEntry } from "../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AdminForm = dynamic(() => import("./AdminForm"), { ssr: false });

const buildApiUrl = async (query: string) => {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/api/diagnostics?${query}` : `/api/diagnostics?${query}`;
};

const loadDiagnostics = async () => {
  try {
    const apiUrl = await buildApiUrl("model=all");
    const res = await fetch(apiUrl, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { items?: DiagnosticEntry[] };
      return { ok: true, items: data.items ?? [] };
    }
  } catch {
    // ignore
  }
  return { ok: false, items: [] };
};

const resolveLatestUpdated = async (items: DiagnosticEntry[], isDbMode: boolean) => {
  const dates = items
    .map((item) => item.updated_at)
    .filter((value): value is string => Boolean(value));

  if (dates.length) {
    return dates.sort().at(-1) ?? "-";
  }

  if (!isDbMode) {
    try {
      const manifestPath = path.resolve(process.cwd(), "data", "diagnostics_manifest.json");
      const stat = await fs.stat(manifestPath);
      return stat.mtime.toISOString().slice(0, 10);
    } catch {
      return "-";
    }
  }

  return "-";
};

const loadJsonCount = async () => {
  try {
    const manifestPath = path.resolve(process.cwd(), "data", "diagnostics_manifest.json");
    const raw = await fs.readFile(manifestPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized) as DiagnosticEntry[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

const loadJsonHash = async () => {
  try {
    const manifestPath = path.resolve(process.cwd(), "data", "diagnostics_manifest.json");
    const raw = await fs.readFile(manifestPath, "utf8");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    return hash.slice(0, 10);
  } catch {
    return "-";
  }
};

export default async function DiagnosticsAdminPanel() {
  const isReadOnly = process.env.READ_ONLY_MODE === "1";
  const isDbMode = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const isWriteDisabled = isReadOnly || !isDbMode;
  const modeLabel = isDbMode ? "DB 모드" : "JSON 모드";
  const modeTone = isDbMode ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  const modeHelp = isDbMode ? "Supabase 연결 중 · 저장 가능" : "Supabase 미연결 · 저장 비활성화";
  const { ok: apiOk, items } = await loadDiagnostics();
  const latestUpdated = await resolveLatestUpdated(items, isDbMode);
  const jsonCount = await loadJsonCount();
  const jsonHash = await loadJsonHash();
  const dbCount = isDbMode ? items.length : 0;
  const connectionTone = apiOk ? "bg-emerald-500" : "bg-amber-500";
  const connectionLabel = apiOk ? "연결됨" : "연결 확인 필요";

  // TODO: add content hash comparison for JSON vs DB to detect updates when counts match.

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">관리자 입력</h2>
          <p className="text-sm text-slate-600">ADMIN_TOKEN 필요 · 저장 시 Supabase로 반영됩니다.</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>DB: {dbCount}건 / JSON: {jsonCount}건</p>
          <p>최종 업데이트: {latestUpdated}</p>
          <p>JSON 해시: {jsonHash}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 ${modeTone}`}>{modeLabel}</span>
        <span className="text-slate-500">{modeHelp}</span>
        <span className="flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
          <span className={`h-2 w-2 rounded-full ${connectionTone}`} />
          {connectionLabel}
        </span>
        {isReadOnly ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">읽기 전용 모드</span>
        ) : null}
      </div>
      <div className="mt-4">
        <AdminForm
          readOnly={isWriteDisabled}
          saveTargetLabel={isDbMode ? "Supabase DB" : "JSON 파일"}
        />
      </div>
    </section>
  );
}
