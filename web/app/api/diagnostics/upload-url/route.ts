import { NextResponse } from "next/server";
import { supabaseAdmin, hasSupabaseConfig } from "../../../../lib/supabase/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safeSegment = (value: string) =>
  value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_") || "file";

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

  let payload: { model?: string; filename?: string; contentType?: string } | null = null;
  try {
    payload = (await request.json()) as {
      model?: string;
      filename?: string;
      contentType?: string;
    };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const bucket = process.env.DIAGNOSTICS_BUCKET || "parts";
  const model = payload?.model?.trim() || "misc";
  const filename = payload?.filename?.trim() || "upload.bin";
  const contentType = payload?.contentType?.trim() || "application/octet-stream";

  const safeName = safeSegment(filename);
  const objectPath = `diagnostics/${safeSegment(model)}/${Date.now()}-${safeName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(objectPath);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "SIGNED_URL_FAILED" },
      { status: 500 }
    );
  }

  const { data: publicUrl } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath);

  return NextResponse.json({
    path: objectPath,
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: publicUrl?.publicUrl ?? "",
    contentType,
  });
}
