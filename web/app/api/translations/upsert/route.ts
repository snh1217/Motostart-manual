import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { TranslationItem } from "../../../../lib/types";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";
import { translationsEnabled } from "../../../../lib/featureFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const filePath = path.join(process.cwd(), "data", "translations.json");

const readTranslations = async (): Promise<TranslationItem[]> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
  } catch {
    return [];
  }
};

const inferModel = (entryId: string): string => {
  const upper = entryId.toUpperCase();
  if (upper.includes("350D")) return "350D";
  if (upper.includes("368G")) return "368G";
  if (upper.includes("368E")) return "368E";
  if (upper.includes("125M")) return "125M";
  if (upper.includes("125D")) return "125D";
  if (upper.includes("125E")) return "125E";
  if (upper.includes("125C")) return "125C";
  if (upper.includes("310M")) return "310M";
  return "UNKNOWN";
};

export async function POST(request: Request) {
  if (!translationsEnabled) {
    return NextResponse.json({ error: "TRANSLATIONS_DISABLED" }, { status: 404 });
  }
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { message: "읽기 전용 모드에서는 저장할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { message: "관리자 토큰이 필요합니다." },
      { status: 401 }
    );
  }

  let payload: (TranslationItem & { model?: string }) | null = null;
  try {
    payload = (await request.json()) as TranslationItem & { model?: string };
  } catch {
    return NextResponse.json({ message: "invalid json" }, { status: 400 });
  }

  if (!payload?.entryId) {
    return NextResponse.json({ message: "entryId가 필요합니다." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const model = payload.model ?? inferModel(payload.entryId);

  if (hasSupabaseConfig && supabaseAdmin) {
    const upsertPayload: Record<string, unknown> = {
      model,
      entry_id: payload.entryId,
      title_ko: payload.title_ko ?? null,
      summary_ko: payload.summary_ko ?? null,
      text_ko: payload.text_ko ?? null,
    };
    if (payload.pdf_ko_url) {
      const { data: existing } = await supabaseAdmin
        .from("translations")
        .select("meta")
        .eq("model", model)
        .eq("entry_id", payload.entryId)
        .maybeSingle();
      upsertPayload.meta = {
        ...(existing?.meta ?? {}),
        pdf_ko_url: payload.pdf_ko_url,
      };
    }
    const { error } = await supabaseAdmin
      .from("translations")
      .upsert(upsertPayload, { onConflict: "model,entry_id" });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: true });
  }

  try {
    const existing = await readTranslations();
    const index = existing.findIndex((item) => item.entryId === payload?.entryId);
    const nextItem: TranslationItem = {
      entryId: payload.entryId,
      title_ko: payload.title_ko?.trim() || undefined,
      summary_ko: payload.summary_ko?.trim() || undefined,
      text_ko: payload.text_ko?.trim() || undefined,
      pdf_ko_url: payload.pdf_ko_url?.trim() || undefined,
      updated_at: today,
    };

    if (index >= 0) {
      existing[index] = nextItem;
    } else {
      existing.push(nextItem);
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), "utf8");

    return NextResponse.json({
      ok: true,
      updated: index >= 0,
      total: existing.length,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "save failed" },
      { status: 500 }
    );
  }
}
