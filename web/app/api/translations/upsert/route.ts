import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { TranslationItem } from "../../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const filePath = path.join(process.cwd(), "data", "translations.json");

const readTranslations = async (): Promise<TranslationItem[]> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TranslationItem[]) : [];
  } catch {
    return [];
  }
};

export async function POST(request: Request) {
  if (process.env.READ_ONLY_MODE === "1") {
    return NextResponse.json(
      { message: "읽기 전용 모드에서는 저장할 수 없습니다." },
      { status: 403 }
    );
  }

  let payload: TranslationItem | null = null;
  try {
    payload = (await request.json()) as TranslationItem;
  } catch {
    return NextResponse.json({ message: "invalid json" }, { status: 400 });
  }

  if (!payload?.entryId) {
    return NextResponse.json(
      { message: "entryId is required" },
      { status: 400 }
    );
  }

  try {
    const existing = await readTranslations();
    const index = existing.findIndex((item) => item.entryId === payload?.entryId);
    const today = new Date().toISOString().slice(0, 10);
    const nextItem: TranslationItem = {
      entryId: payload.entryId,
      title_ko: payload.title_ko?.trim() || undefined,
      summary_ko: payload.summary_ko?.trim() || undefined,
      text_ko: payload.text_ko?.trim() || undefined,
      updated_at: today,
    };

    if (index >= 0) {
      existing[index] = nextItem;
    } else {
      existing.push(nextItem);
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), "utf8");

    return NextResponse.json({
      ok: true,
      updated: index >= 0,
      total: existing.length,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "save failed" },
      { status: 500 }
    );
  }
}
