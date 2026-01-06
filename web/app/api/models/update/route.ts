import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const modelsPath = path.resolve(process.cwd(), "data", "models.json");

type ModelEntry = {
  id: string;
  name: string;
  parts_engine_url?: string;
  parts_chassis_url?: string;
};

const readModels = async (): Promise<ModelEntry[]> => {
  try {
    const raw = await fs.readFile(modelsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as ModelEntry[]) : [];
  } catch {
    return [];
  }
};

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 수정할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "ADMIN_TOKEN이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim().toUpperCase();
  const name = String(body?.name ?? "").trim();
  const partsEngineUrl = String(body?.parts_engine_url ?? body?.partsEngineUrl ?? "").trim();
  const partsChassisUrl = String(body?.parts_chassis_url ?? body?.partsChassisUrl ?? "").trim();

  if (!id || !name) {
    return NextResponse.json(
      { error: "모델 코드와 이름이 필요합니다." },
      { status: 400 }
    );
  }

  if (hasSupabaseConfig && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("models")
      .update({
        name,
        parts_engine_url: partsEngineUrl || null,
        parts_chassis_url: partsChassisUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "모델을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  const existing = await readModels();
  const idx = existing.findIndex((entry) => entry.id.toUpperCase() === id);
  if (idx < 0) {
    return NextResponse.json({ error: "모델을 찾을 수 없습니다." }, { status: 404 });
  }

  const updated: ModelEntry = {
    ...existing[idx],
    id,
    name,
  };
  if (partsEngineUrl) {
    updated.parts_engine_url = partsEngineUrl;
  } else {
    delete updated.parts_engine_url;
  }
  if (partsChassisUrl) {
    updated.parts_chassis_url = partsChassisUrl;
  } else {
    delete updated.parts_chassis_url;
  }

  const next = [...existing];
  next[idx] = updated;

  await fs.mkdir(path.dirname(modelsPath), { recursive: true });
  await fs.writeFile(modelsPath, JSON.stringify(next, null, 2), "utf8");

  return NextResponse.json(updated);
}
