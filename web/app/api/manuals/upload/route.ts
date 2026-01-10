import { NextResponse } from "next/server";
import path from "path";
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

  const formData = await request.formData();
  const file = formData.get("file");
  const model = String(formData.get("model") ?? "").trim().toUpperCase();
  const manualType = String(formData.get("manual_type") ?? "").trim().toLowerCase();
  const section = String(formData.get("section") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const language = String(formData.get("language") ?? "").trim() || "ko";
  const docDate = String(formData.get("doc_date") ?? "").trim();
  const docCode = String(formData.get("doc_code") ?? "").trim();
  const sourcePdf = String(formData.get("source_pdf") ?? "").trim();
  const providedId = String(formData.get("id") ?? "").trim();
  const pagesStart = Number(formData.get("pages_start") ?? 1) || 1;
  const pagesEnd = Number(formData.get("pages_end") ?? pagesStart) || pagesStart;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!model || !title || !section) {
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

  const originalName = file.name || "manual.pdf";
  const safeFileName = sanitizeFileName(originalName);
  const storagePath = `splits/${safeFileName}`;
  const fileValue = `/manuals/splits/${safeFileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
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
