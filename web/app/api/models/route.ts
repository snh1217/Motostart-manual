import { NextResponse } from "next/server";
import { loadModels } from "../../../lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const models = await loadModels();
    return NextResponse.json(
      { models },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "LOAD_FAILED" },
      { status: 500 }
    );
  }
}
