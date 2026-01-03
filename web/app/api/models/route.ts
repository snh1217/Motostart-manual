import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { sortModelCodes } from "../../../lib/modelSort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const modelsPath = path.resolve(process.cwd(), "data", "models.json");
    const raw = await fs.readFile(modelsPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized) as Array<{ id: string; name: string }>;
    const models = Array.isArray(parsed) ? sortModelCodes(parsed) : [];
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
