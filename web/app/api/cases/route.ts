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
  system: string;
  symptom: string;
  action: string;
  cause?: string;
  parts?: string;
  tags?: string;
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelParam = searchParams.get("model")?.trim() ?? "all";
  const systemParam = searchParams.get("system")?.trim() ?? "all";
  const q = searchParams.get("q")?.trim() ?? "";
  const model = modelParam === "all" ? null : modelParam;
  const system = systemParam === "all" ? null : systemParam;

  if (hasSupabaseConfig && supabaseAdmin) {
    let query = supabaseAdmin.from("cases").select("*");
    if (model) query = query.eq("model", model);
    if (system) query = query.eq("system", system);
    if (q) {
      query = query.or(
        `symptom.ilike.%${q}%,action.ilike.%${q}%,cause.ilike.%${q}%`
      );
    }
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ items: data ?? [] });
  }

  const items = await readCasesFromFile();
  const filtered = items.filter((item) => {
    if (model && item.model !== model) return false;
    if (system && item.system !== system) return false;
    if (q) {
      const haystack = `${item.symptom} ${item.action} ${item.cause ?? ""}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  return NextResponse.json({ items: filtered });
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

  if (!payload?.model || !payload?.system || !payload?.symptom || !payload?.action) {
    return NextResponse.json(
      { error: "model, system, symptom, action are required" },
      { status: 400 }
    );
  }

  if (hasSupabaseConfig && supabaseAdmin) {
    const { error } = await supabaseAdmin.from("cases").insert({
      model: payload.model,
      system: payload.system,
      symptom: payload.symptom,
      action: payload.action,
      cause: payload.cause ?? null,
      parts: payload.parts ?? null,
      tags: payload.tags ?? null,
      ref_manual_file: payload.ref_manual_file ?? null,
      ref_manual_page: payload.ref_manual_page ?? null,
      ref_youtube: payload.ref_youtube ?? null,
    });
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
      id: payload.id ?? `case-${Date.now()}`,
      updated_at: new Date().toISOString().slice(0, 10),
    };
    existing.push(nextItem);
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(existing, null, 2), "utf8");
  }

  return NextResponse.json({ ok: true });
}
