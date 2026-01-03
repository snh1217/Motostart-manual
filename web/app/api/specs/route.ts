import { NextResponse } from "next/server";
import { loadSpecs } from "../../../lib/specs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model") ?? "all";
  const category = searchParams.get("category") ?? "all";

  const specs = await loadSpecs({ model, category });

  return NextResponse.json({ specs });
}
