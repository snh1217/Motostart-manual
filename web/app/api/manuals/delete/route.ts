import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = process.env.MANUALS_BUCKET || "manuals";

const normalizeStoragePath = (value: string) => {
  if (!value) return null;
  let path = value.trim();
  if (!path) return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      return null;
    }
  }

  path = path.replace(/^\/storage\/v1\/object\/public\//, "");
  path = path.replace(/^\/storage\/v1\/object\//, "");
  path = path.replace(/^\/+/, "");

  if (path.startsWith(`${BUCKET}/`)) {
    path = path.slice(BUCKET.length + 1);
  } else if (path.startsWith("manuals/")) {
    path = path.slice("manuals/".length);
  }

  return path || null;
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
  const id = String(body?.id ?? "").trim();
  const file = String(body?.file ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("manuals")
    .delete()
    .eq("id", id)
    .select("id,file");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const resolvedFile = data[0]?.file ?? file;
  const storagePath = normalizeStoragePath(resolvedFile);
  let storageError: string | null = null;

  if (storagePath) {
    const { error: removeError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([storagePath]);
    if (removeError) {
      storageError = removeError.message;
    }
  }

  return NextResponse.json({
    ok: true,
    deleted: data.length,
    storageRemoved: Boolean(storagePath) && !storageError,
    storageError,
  });
}
