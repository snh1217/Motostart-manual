import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const modelsPath = path.resolve(process.cwd(), "data", "models.json");

type ModelEntry = { id: string; name: string };

const readModels = async (): Promise<ModelEntry[]> => {
  try {
    const raw = await fs.readFile(modelsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as ModelEntry[]) : [];
  } catch {
    return [];
  }
};

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 추가할 수 없습니다." },
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
  const id = String(body?.id ?? "").trim().toUpperCase();
  const name = String(body?.name ?? "").trim();

  if (!id || !name) {
    return NextResponse.json(
      { error: "모델 코드와 이름이 필요합니다." },
      { status: 400 }
    );
  }

  const existing = await readModels();
  if (existing.some((entry) => entry.id.toUpperCase() === id)) {
    return NextResponse.json(
      { error: "이미 등록된 모델입니다." },
      { status: 400 }
    );
  }

  const next = [...existing, { id, name }];
  await fs.mkdir(path.dirname(modelsPath), { recursive: true });
  await fs.writeFile(modelsPath, JSON.stringify(next, null, 2), "utf8");

  return NextResponse.json({ id, name });
}
