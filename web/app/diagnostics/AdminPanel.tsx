import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { DiagnosticEntry } from "../../lib/types";
import { getDiagnosticById } from "../../lib/diagnostics";
import DiagnosticsAdminShell from "./DiagnosticsAdminShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export default async function DiagnosticsAdminPanel({
  selectedModel,
  editId,
}: {
  selectedModel: string;
  editId?: string;
}) {
  const isReadOnly = process.env.READ_ONLY_MODE === "1";
  const isDbMode = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const isWriteDisabled = isReadOnly || !isDbMode;
  const modeLabel = isDbMode ? "DB 모드" : "JSON 모드";
  const modeTone = isDbMode ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  const modeHelp = isDbMode
    ? "Supabase 연결 중 · 저장 가능"
    : "Supabase 미연결 · 저장 비활성화";
  const { ok: apiOk, items } = await loadDiagnostics();
  const latestUpdated = await resolveLatestUpdated(items, isDbMode);
  const jsonCount = await loadJsonCount();
  const jsonHash = await loadJsonHash();
  const dbCount = isDbMode ? items.length : 0;
  const connectionTone = apiOk ? "bg-emerald-500" : "bg-amber-500";
  const connectionLabel = apiOk ? "연결됨" : "연결 확인 필요";

  const editEntry = editId ? await getDiagnosticById(editId) : null;

  return (
    <DiagnosticsAdminShell
      readOnly={isWriteDisabled}
      saveTargetLabel={isDbMode ? "Supabase DB" : "JSON 파일"}
      selectedModel={selectedModel}
      initialEntry={editEntry}
      initialOpen={Boolean(editEntry)}
      modeLabel={modeLabel}
      modeTone={modeTone}
      modeHelp={modeHelp}
      connectionTone={connectionTone}
      connectionLabel={connectionLabel}
      isReadOnly={isReadOnly}
      dbCount={dbCount}
      jsonCount={jsonCount}
      jsonHash={jsonHash}
      latestUpdated={latestUpdated}
    />
  );
}
