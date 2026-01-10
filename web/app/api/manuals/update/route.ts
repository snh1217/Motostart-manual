import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANUAL_TYPES = new Set(["engine", "chassis", "user", "wiring"]);

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json({ error: "READ_ONLY_MODE" }, { status: 403 });
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!hasSupabaseConfig || !supabaseAdmin) {
    return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const id = String((body as Record<string, unknown>).id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("manuals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const pickString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  let model = existing.model;
  if (hasKey("model")) {
    const value = pickString((body as Record<string, unknown>).model);
    if (value) model = value.toUpperCase();
  }

  let manualType = existing.manual_type;
  if (hasKey("manual_type")) {
    const value = pickString((body as Record<string, unknown>).manual_type).toLowerCase();
    if (!value || !MANUAL_TYPES.has(value)) {
      return NextResponse.json(
        { error: "manual_type must be engine/chassis/user/wiring" },
        { status: 400 }
      );
    }
    manualType = value;
  }

  let section = existing.section;
  if (hasKey("section")) {
    const value = pickString((body as Record<string, unknown>).section);
    if (value) section = value;
  }

  let title = existing.title;
  if (hasKey("title")) {
    const value = pickString((body as Record<string, unknown>).title);
    if (value) title = value;
  }

  let language = existing.language;
  if (hasKey("language")) {
    const value = pickString((body as Record<string, unknown>).language).toLowerCase();
    if (value) language = value;
  }

  let sourcePdf = existing.source_pdf ?? null;
  if (hasKey("source_pdf")) {
    const value = pickString((body as Record<string, unknown>).source_pdf);
    sourcePdf = value || null;
  }

  let docDate = existing.doc_date ?? null;
  if (hasKey("doc_date")) {
    const value = pickString((body as Record<string, unknown>).doc_date);
    docDate = value || null;
  }

  let docCode = existing.doc_code ?? null;
  if (hasKey("doc_code")) {
    const value = pickString((body as Record<string, unknown>).doc_code);
    docCode = value || null;
  }

  const existingPages = existing.pages ?? { start: 1, end: 1 };
  const startValue = hasKey("pages_start")
    ? toNumber((body as Record<string, unknown>).pages_start, existingPages.start ?? 1)
    : existingPages.start ?? 1;
  const endValue = hasKey("pages_end")
    ? toNumber((body as Record<string, unknown>).pages_end, existingPages.end ?? startValue)
    : existingPages.end ?? startValue;

  const pages = {
    start: startValue,
    end: endValue,
  };

  const payload = {
    model,
    manual_type: manualType,
    section,
    title,
    language,
    source_pdf: sourcePdf,
    doc_date: docDate,
    doc_code: docCode,
    pages,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("manuals").update(payload).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
