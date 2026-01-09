import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safeEntryId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 업로드할 수 없습니다." },
      { status: 403 }
    );
  }
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "관리자 토큰이 필요합니다." }, { status: 401 });
  }
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return NextResponse.json({ error: "Supabase 설정이 필요합니다." }, { status: 500 });
  }

  const bucket = process.env.TRANSLATIONS_PDF_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { error: "TRANSLATIONS_PDF_BUCKET 환경변수가 필요합니다." },
      { status: 500 }
    );
  }

  let payload: { entryId?: string; filename?: string; contentType?: string } | null = null;
  try {
    payload = (await request.json()) as {
      entryId?: string;
      filename?: string;
      contentType?: string;
    };
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const entryId = payload?.entryId?.trim();
  if (!entryId) {
    return NextResponse.json({ error: "매뉴얼 ID가 필요합니다." }, { status: 400 });
  }

  const timestamp = Date.now();
  const extension = payload?.filename?.toLowerCase().endsWith(".pdf") ? ".pdf" : ".pdf";
  const objectPath = `translations/${safeEntryId(entryId)}/${timestamp}-original${extension}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(objectPath);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "업로드 URL 생성 실패" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path: objectPath,
    signedUrl: data.signedUrl,
    token: data.token,
    contentType: payload?.contentType ?? "application/pdf",
  });
}
