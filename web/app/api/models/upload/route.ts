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

  const formData = await request.formData();
  const file = formData.get("file");
  const model = String(formData.get("model") ?? "").trim().toUpperCase();
  const kind = String(formData.get("kind") ?? "").trim().toLowerCase();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }
  if (kind !== "engine" && kind !== "chassis") {
    return NextResponse.json({ error: "kind must be engine or chassis" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "pdf";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `parts-lists/${model}/${kind}/${Date.now()}-${safeName}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: publicUrl } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      ok: true,
      path: data?.path,
      url: publicUrl?.publicUrl,
      contentType: file.type || ext,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "UPLOAD_ERROR" },
      { status: 500 }
    );
  }
}
