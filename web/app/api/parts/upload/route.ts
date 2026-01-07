import { NextResponse } from "next/server";
import { supabaseAdmin, hasSupabaseConfig } from "../../../../lib/supabase/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const model = (formData.get("model") as string | null)?.trim() || "misc";
  const partId = (formData.get("partId") as string | null)?.trim() || "part";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "ONLY_IMAGE_OR_VIDEO" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `parts/${model}/${partId}/${Date.now()}-${safeName}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from("parts")
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: publicUrl } = supabaseAdmin.storage.from("parts").getPublicUrl(path);
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
