import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import type { SpecRow } from "../../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const specsPath = path.resolve(process.cwd(), "data", "specs.json");

const readSpecs = async (): Promise<SpecRow[]> => {
  try {
    const raw = await fs.readFile(specsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as SpecRow[]) : [];
  } catch {
    return [];
  }
};

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

  const existing = await readSpecs();
  const next = existing.filter((item) => !idSet.has(item.id));
  const deleted = existing.length - next.length;

  await fs.mkdir(path.dirname(specsPath), { recursive: true });
  await fs.writeFile(specsPath, JSON.stringify(next, null, 2), "utf8");

  return NextResponse.json({ deleted });
}
