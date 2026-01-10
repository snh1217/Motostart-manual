import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { DiagnosticEntry, DiagnosticLine } from "../../../lib/types";
import { isAdminAuthorized } from "../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const manifestPath = path.resolve(process.cwd(), "data", "diagnostics_manifest.json");

const readManifest = async (): Promise<DiagnosticEntry[]> => {
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as DiagnosticEntry[]) : [];
  } catch {
    return [];
  }
};

const writeManifest = async (items: DiagnosticEntry[]) => {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(items, null, 2), "utf8");
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model");
  const id = searchParams.get("id");

  if (hasSupabaseConfig && supabaseAdmin) {
    const query = supabaseAdmin.from("diagnostics").select("*");
    if (id) query.eq("id", id);
    if (model && model !== "all") query.eq("model", model);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }
    const items = (data ?? []).map((item) => ({ ...item, source: "db" }));
    return NextResponse.json({ items });
  }

  const items = await readManifest();
  const filtered = items.filter((item) => {
    if (id && item.id !== id) return false;
    if (model && model !== "all" && item.model !== model) return false;
    return true;
  });

  return NextResponse.json({
    items: filtered.map((item) => ({ ...item, source: "json" })),
  });
}

export async function POST(request: Request) {
  if (process.env.READ_ONLY_MODE === "1") {
    return NextResponse.json({ error: "READ_ONLY_MODE" }, { status: 403 });
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<DiagnosticEntry>;
    if (!body.id || !body.model || !body.title || !Array.isArray(body.lines)) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const images = Array.isArray(body.images)
      ? body.images.filter((url) => typeof url === "string" && url.trim())
      : body.image
        ? [body.image]
        : [];
    if (!images.length) {
      return NextResponse.json({ error: "IMAGE_REQUIRED" }, { status: 400 });
    }

    const normalizedLines = body.lines.map((line) => {
      const source =
        typeof (line as DiagnosticLine).source === "string"
          ? (line as DiagnosticLine).source
          : typeof (line as { label?: string }).label === "string"
            ? (line as { label?: string }).label ?? ""
            : "";
      const translation =
        typeof (line as DiagnosticLine).translation === "string"
          ? (line as DiagnosticLine).translation
          : "";
      const data =
        typeof (line as DiagnosticLine).data === "string"
          ? (line as DiagnosticLine).data
          : typeof (line as { value?: string }).value === "string"
            ? (line as { value?: string }).value ?? ""
            : "";
      const analysis =
        typeof (line as DiagnosticLine).analysis === "string"
          ? (line as DiagnosticLine).analysis
          : "";
      const note = typeof (line as DiagnosticLine).note === "string" ? (line as DiagnosticLine).note : "";
      return { source, translation, data, analysis, note };
    });

    const now = new Date().toISOString().slice(0, 10);
    const incoming: DiagnosticEntry = {
      id: body.id,
      model: body.model as DiagnosticEntry["model"],
      title: body.title,
      section: body.section,
      image: images[0],
      images: images.length ? images : undefined,
      video_cold_url: body.video_cold_url ?? undefined,
      video_hot_url: body.video_hot_url ?? undefined,
      lines: normalizedLines as DiagnosticEntry["lines"],
      note: body.note,
      updated_at: body.updated_at ?? now,
    };

    if (hasSupabaseConfig && supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from("diagnostics")
        .upsert({ ...incoming, updated_at: incoming.updated_at ?? now }, { onConflict: "id" });
      if (error) {
        return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const items = await readManifest();
    const idx = items.findIndex((i) => i.id === incoming.id);
    if (idx >= 0) {
      items[idx] = incoming;
    } else {
      items.push(incoming);
    }
    await writeManifest(items);
    return NextResponse.json({ ok: true, total: items.length });
  } catch (error) {
    return NextResponse.json({ error: "SERVER_ERROR", detail: `${error}` }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (process.env.READ_ONLY_MODE === "1") {
    return NextResponse.json({ error: "READ_ONLY_MODE" }, { status: 403 });
  }
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
  }

  if (hasSupabaseConfig && supabaseAdmin) {
    const { error } = await supabaseAdmin.from("diagnostics").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const items = await readManifest();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await writeManifest(next);
  return NextResponse.json({ ok: true, total: next.length });
}
