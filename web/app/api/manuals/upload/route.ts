import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = process.env.MANUALS_BUCKET || "manuals";

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "_");

const parseNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizeManualType = (value: unknown) => String(value ?? "").trim().toLowerCase();

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

  const model = String((body as Record<string, unknown>).model ?? "")
    .trim()
    .toUpperCase();
  const manualType = normalizeManualType((body as Record<string, unknown>).manual_type);
  const section = String((body as Record<string, unknown>).section ?? "").trim();
  const title = String((body as Record<string, unknown>).title ?? "").trim();
  const language = String((body as Record<string, unknown>).language ?? "")
    .trim()
    .toLowerCase() || "ko";
  const docDate = String((body as Record<string, unknown>).doc_date ?? "").trim();
  const docCode = String((body as Record<string, unknown>).doc_code ?? "").trim();
  const sourcePdf = String((body as Record<string, unknown>).source_pdf ?? "").trim();
  const providedId = String((body as Record<string, unknown>).id ?? "").trim();
  const pagesStart = parseNumber((body as Record<string, unknown>).pages_start ?? 1, 1);
  const pagesEnd = parseNumber((body as Record<string, unknown>).pages_end ?? pagesStart, pagesStart);

  if (!model || !section || !title) {
    return NextResponse.json(
      { error: "model, section, title are required" },
      { status: 400 }
    );
  }

  if (!manualType || !["engine", "chassis", "user", "wiring"].includes(manualType)) {
    return NextResponse.json(
      { error: "manual_type must be engine/chassis/user/wiring" },
      { status: 400 }
    );
  }

  const isFinalize = Boolean((body as Record<string, unknown>).finalize);

  if (!isFinalize) {
    const filename = String((body as Record<string, unknown>).filename ?? "").trim();
    const contentType =
      String((body as Record<string, unknown>).contentType ?? "").trim() ||
      "application/pdf";

    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    const safeFileName = sanitizeFileName(filename);
    const storagePath = `splits/${Date.now()}-${safeFileName || "manual.pdf"}`;
    const fileValue = `/manuals/${storagePath}`;

    try {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);
      if (error || !data?.signedUrl) {
        return NextResponse.json(
          { error: error?.message ?? "SIGNED_URL_FAILED" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        signedUrl: data.signedUrl,
        file: fileValue,
        contentType,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "SIGNED_URL_ERROR" },
        { status: 500 }
      );
    }
  }

  const fileValue = String((body as Record<string, unknown>).file ?? "").trim();
  if (!fileValue) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const baseId = `manual-${toSlug(model)}-${toSlug(manualType)}-${toSlug(title)}`;
  const entryId = providedId || baseId || `manual-${Date.now()}`;

  const payload = {
    id: entryId,
    model,
    manual_type: manualType,
    section,
    title,
    language,
    doc_date: docDate || null,
    doc_code: docCode || null,
    source_pdf: sourcePdf || null,
    pages: {
      start: pagesStart,
      end: pagesEnd,
    },
    file: fileValue,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("manuals")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entry: payload, file: fileValue });
}
