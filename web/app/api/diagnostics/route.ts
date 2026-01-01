import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { DiagnosticEntry } from "../../../lib/types";
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
    if (!body.id || !body.model || !body.title || !body.image || !Array.isArray(body.lines)) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const now = new Date().toISOString().slice(0, 10);
    const incoming: DiagnosticEntry = {
      id: body.id,
      model: body.model as DiagnosticEntry["model"],
      title: body.title,
      section: body.section,
      image: body.image,
      lines: body.lines as DiagnosticEntry["lines"],
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
