import { NextResponse } from "next/server";
import { loadParts, upsertPart } from "../../../lib/parts";
import type { PartEntry } from "../../../lib/types";
import { isReadOnlyMode } from "../../../lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model") ?? undefined;
  const system = searchParams.get("system") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const items = await loadParts({ model, system, q });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json({ error: "READ_ONLY_MODE" }, { status: 403 });
  }

  let payload: PartEntry | null = null;
  try {
    payload = (await request.json()) as PartEntry;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!payload?.id || !payload.model || !payload.system || !payload.name) {
    return NextResponse.json(
      { error: "id, model, system, name are required" },
      { status: 400 }
    );
  }

  const result = await upsertPart(payload, request);
  if ("error" in result && result.error) {
    const status = result.error === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
