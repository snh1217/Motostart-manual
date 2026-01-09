import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../lib/supabase/server";
import type { TranslationItem } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataPath = path.resolve(process.cwd(), "data", "translations.json");

type DbTranslation = {
  entry_id?: string;
  entryId?: string;
  model?: string;
  title_ko?: string;
  summary_ko?: string;
  text_ko?: string;
  pdf_ko_url?: string | null;
  title?: string | null;
  ko_text?: string | null;
  meta?: Record<string, unknown> | null;
  updated_at?: string | null;
  updatedAt?: string | null;
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

const toTranslationItem = (row: DbTranslation): TranslationItem => {
  return {
    entryId: row.entry_id ?? row.entryId ?? "",
    title_ko: row.title_ko ?? row.title ?? (row.meta?.title_ko as string | undefined),
    summary_ko: row.summary_ko ?? (row.meta?.summary_ko as string | undefined),
    text_ko:
      row.text_ko ??
      row.ko_text ??
      (row.meta?.text_ko as string | undefined),
    pdf_ko_url:
      row.pdf_ko_url ?? (row.meta?.pdf_ko_url as string | undefined),
    updated_at: row.updated_at ?? row.updatedAt ?? new Date().toISOString().slice(0, 10),
  };
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

const cacheHeaders = {
  "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId")?.trim() ?? "";
  const query = searchParams.get("q")?.trim() ?? "";
  const modelParam = searchParams.get("model")?.trim() ?? "all";
  const model = modelParam === "all" ? null : modelParam;

  if (hasSupabaseConfig && supabaseAdmin) {
    let dbQuery = supabaseAdmin.from("translations").select("*");
    if (entryId) dbQuery = dbQuery.eq("entry_id", entryId);
    if (model) dbQuery = dbQuery.eq("model", model);
    if (query) {
      const escaped = query.replace(/%/g, "\\%").replace(/_/g, "\\_");
      dbQuery = dbQuery.or(
        `entry_id.ilike.%${escaped}%,title_ko.ilike.%${escaped}%`
      );
    }
    const { data, error } = await dbQuery.order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bucketFromEnv = process.env.TRANSLATIONS_PDF_BUCKET;
    const items = await Promise.all(
      (data ?? []).map(async (row) => {
        const typedRow = row as DbTranslation;
        const item = toTranslationItem(typedRow);
        const metaBucket =
          (typedRow.meta?.pdf_ko_bucket as string | undefined) ?? bucketFromEnv;
        const pdfPath = typedRow.meta?.pdf_ko_path as string | undefined;
        if (pdfPath && metaBucket) {
          const { data: signed } = await supabaseAdmin.storage
            .from(metaBucket)
            .createSignedUrl(pdfPath, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) {
            item.pdf_ko_url = signed.signedUrl;
          }
        }
        return item;
      })
    );
    return NextResponse.json({ items }, { headers: cacheHeaders });
  }

  const items = await readTranslationsFromFile();
  const filtered = items.filter((item) => {
    if (entryId && item.entryId !== entryId) return false;
    if (model && !item.entryId.toUpperCase().includes(model)) return false;
    if (query) {
      const haystack = [item.entryId, item.title_ko].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
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

  let payload: TranslationItem & { model?: string } | null = null;
  try {
    payload = (await request.json()) as TranslationItem & { model?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!payload?.entryId) {
    return NextResponse.json({ error: "entryId가 필요합니다." }, { status: 400 });
  }

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const existing = await readTranslationsFromFile();
    const nextItem: TranslationItem = {
      entryId: payload.entryId,
      title_ko: payload.title_ko ?? undefined,
      summary_ko: payload.summary_ko ?? undefined,
      text_ko: payload.text_ko ?? undefined,
      pdf_ko_url: payload.pdf_ko_url ?? undefined,
      updated_at: new Date().toISOString().slice(0, 10),
    };
    const index = existing.findIndex((item) => item.entryId === payload.entryId);
    if (index >= 0) existing[index] = nextItem;
    else existing.push(nextItem);
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(existing, null, 2), "utf8");
  }

  return NextResponse.json({ ok: true });
}
