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
      { error: "읽기 전용 모드에서는 삭제할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "ADMIN_TOKEN이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  const idSet = new Set(
    ids
      .filter((id: unknown) => typeof id === "string")
      .map((id: string) => id.toUpperCase())
  );

  if (idSet.size === 0) {
    return NextResponse.json({ error: "삭제할 항목이 없습니다." }, { status: 400 });
  }

  if (hasSupabaseConfig && supabaseAdmin) {
    const { error } = await supabaseAdmin.from("models").delete().in("id", Array.from(idSet));
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: idSet.size });
  }

  const existing = await readModels();
  const next = existing.filter((entry) => !idSet.has(entry.id.toUpperCase()));
  const deleted = existing.length - next.length;

  await fs.mkdir(path.dirname(modelsPath), { recursive: true });
  await fs.writeFile(modelsPath, JSON.stringify(next, null, 2), "utf8");

  return NextResponse.json({ deleted });
}
