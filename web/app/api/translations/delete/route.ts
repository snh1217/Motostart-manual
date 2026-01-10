import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";
import type { TranslationItem } from "../../../../lib/types";
import { translationsEnabled } from "../../../../lib/featureFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataPath = path.resolve(process.cwd(), "data", "translations.json");

type DeletePayload = {
  entryId: string;
  model?: string;
};

const readTranslationsFromFile = async (): Promise<TranslationItem[]> => {
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
  } catch {
    return [];
  }
};

export async function POST(request: Request) {
  if (!translationsEnabled) {
    return NextResponse.json({ error: "TRANSLATIONS_DISABLED" }, { status: 404 });
  }
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 삭제할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "관리자 토큰이 필요합니다." },
      { status: 401 }
    );
  }

  let payload: DeletePayload | null = null;
  try {
    payload = (await request.json()) as DeletePayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!payload?.entryId) {
    return NextResponse.json({ error: "entryId가 필요합니다." }, { status: 400 });
  }

  if (hasSupabaseConfig && supabaseAdmin) {
    let query = supabaseAdmin.from("translations").delete().eq("entry_id", payload.entryId);
    if (payload.model) query = query.eq("model", payload.model);
    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const existing = await readTranslationsFromFile();
  const next = existing.filter((item) => item.entryId !== payload.entryId);
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(next, null, 2), "utf8");
  return NextResponse.json({ ok: true });
}
