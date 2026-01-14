import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CaseRow = {
  id?: string;
  model: string;
  system?: string;
  category?: string;
  symptom?: string;
  symptomTitle?: string;
  title?: string;
  description?: string;
  fixSteps?: string;
  action?: string;
  cause?: string;
  parts?: string;
  tags?: string;
  references?: string;
  diagnosisTreeId?: string;
  diagnosisResultId?: string;
  ref_manual_file?: string;
  ref_manual_page?: number;
  ref_youtube?: string;
  created_at?: string;
  updated_at?: string;
};

const dataPath = path.resolve(process.cwd(), "data", "cases.json");

const readCasesFromFile = async (): Promise<CaseRow[]> => {
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CaseRow[]) : [];
  } catch {
    return [];
  }
};

const cacheHeaders = {
  "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelParam = searchParams.get("model")?.trim() ?? "all";
  const systemParam = searchParams.get("system")?.trim() ?? "all";
  const q = searchParams.get("q")?.trim() ?? "";
  const diagnosisTreeId = searchParams.get("diagnosisTreeId")?.trim() ?? "";
  const diagnosisResultId = searchParams.get("diagnosisResultId")?.trim() ?? "";
  const model = modelParam === "all" ? null : modelParam;
  const system = systemParam === "all" ? null : systemParam;

  if (hasSupabaseConfig && supabaseAdmin) {
    let query = supabaseAdmin.from("cases").select("*");
    if (model) query = query.eq("model", model);
    if (system) query = query.eq("system", system);
    if (diagnosisTreeId) query = query.eq("diagnosisTreeId", diagnosisTreeId);
    if (diagnosisResultId) query = query.eq("diagnosisResultId", diagnosisResultId);
    if (q) {
      query = query.or(
        `symptom.ilike.%${q}%,action.ilike.%${q}%,cause.ilike.%${q}%,title.ilike.%${q}%,description.ilike.%${q}%,fixSteps.ilike.%${q}%`
      );
    }
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ items: (data ?? []) as CaseRow[] }, { headers: cacheHeaders });
  }

  const items = await readCasesFromFile();
  const filtered = items.filter((item) => {
    if (model && item.model !== model) return false;
    if (system && item.system !== system) return false;
    if (diagnosisTreeId && item.diagnosisTreeId !== diagnosisTreeId) return false;
    if (diagnosisResultId && item.diagnosisResultId !== diagnosisResultId) return false;
    if (q) {
      const haystack =
        `${item.symptom ?? ""} ${item.symptomTitle ?? ""} ${item.title ?? ""} ${item.description ?? ""} ${item.fixSteps ?? ""} ${item.action ?? ""} ${item.cause ?? ""}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  return NextResponse.json({ items: filtered }, { headers: cacheHeaders });
}

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 저장할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "관리자 토큰이 필요합니다." },
      { status: 401 }
    );
  }

  let payload: CaseRow | null = null;
  try {
    payload = (await request.json()) as CaseRow;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const resolvedTitle = payload.title || payload.symptomTitle || payload.symptom;
  const resolvedFixSteps = payload.fixSteps || payload.action;
  if (!payload?.model || !resolvedTitle || !resolvedFixSteps) {
    return NextResponse.json(
      { error: "model, title/symptom, fixSteps/action are required" },
      { status: 400 }
    );
  }

  const normalized = {
    model: payload.model,
    system: payload.system ?? payload.category ?? undefined,
    category: payload.category ?? payload.system ?? undefined,
    symptom: payload.symptom ?? payload.symptomTitle ?? payload.title ?? undefined,
    symptomTitle: payload.symptomTitle ?? payload.symptom ?? payload.title ?? undefined,
    title: payload.title ?? payload.symptomTitle ?? payload.symptom ?? undefined,
    description: payload.description ?? payload.symptom ?? undefined,
    fixSteps: payload.fixSteps ?? payload.action ?? undefined,
    action: payload.action ?? payload.fixSteps ?? undefined,
    diagnosisTreeId: payload.diagnosisTreeId ?? undefined,
    diagnosisResultId: payload.diagnosisResultId ?? undefined,
    cause: payload.cause ?? undefined,
    parts: payload.parts ?? undefined,
    tags: payload.tags ?? undefined,
    references: payload.references ?? undefined,
    ref_manual_file: payload.ref_manual_file ?? undefined,
    ref_manual_page: payload.ref_manual_page ?? undefined,
    ref_youtube: payload.ref_youtube ?? undefined,
  };

  if (hasSupabaseConfig && supabaseAdmin) {
    const { error } = await supabaseAdmin.from("cases").insert(normalized);
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  } else {
    const existing = await readCasesFromFile();
    const nextItem = {
      ...payload,
      ...normalized,
      id: payload.id ?? `case-${Date.now()}`,
      updated_at: new Date().toISOString().slice(0, 10),
    };
    existing.push(nextItem);
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(existing, null, 2), "utf8");
  }

  return NextResponse.json({ ok: true });
}
