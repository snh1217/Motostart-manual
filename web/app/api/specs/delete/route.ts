import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import {
  deleteSpecsFromDb,
  loadSpecsForWrite,
  saveSpecsToFile,
} from "../../../../lib/specs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 삭제할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "Admin_Key가 필요합니다." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  const idSet = new Set(ids.filter((id: unknown) => typeof id === "string"));

  if (idSet.size === 0) {
    return NextResponse.json(
      { error: "삭제할 항목이 없습니다." },
      { status: 400 }
    );
  }

  const existing = await loadSpecsForWrite();
  const next = existing.filter((item) => !idSet.has(item.id));
  const deleted = existing.length - next.length;

  const dbResult = await deleteSpecsFromDb(Array.from(idSet) as string[]);
  if (!dbResult.ok) {
    return NextResponse.json(
      { error: `DB_ERROR: ${dbResult.error}` },
      { status: 500 }
    );
  }

  await saveSpecsToFile(next);

  return NextResponse.json({ deleted });
}
