import { NextResponse } from "next/server";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "parts";

export async function POST(request: Request) {
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 500 });
  }
  if (isReadOnlyMode()) {
    return NextResponse.json({ error: "READ_ONLY_MODE" }, { status: 403 });
  }
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const model = String(body?.model ?? "").trim().toUpperCase();
  const kind = String(body?.kind ?? "").trim().toLowerCase();
  const filename = String(body?.filename ?? "").trim();
  const contentType = String(body?.contentType ?? "").trim() || "application/pdf";

  if (!model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }
  if (kind !== "engine" && kind !== "chassis") {
    return NextResponse.json({ error: "kind must be engine or chassis" }, { status: 400 });
  }
  if (!filename) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `parts-lists/${model}/${kind}/${Date.now()}-${safeName}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? "SIGNED_URL_FAILED" },
        { status: 500 }
      );
    }
    const { data: publicUrl } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      ok: true,
      path,
      url: publicUrl?.publicUrl,
      signedUrl: data.signedUrl,
      contentType,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SIGNED_URL_ERROR" },
      { status: 500 }
    );
  }
}
