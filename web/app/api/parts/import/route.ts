import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { upsertPart } from "../../../../lib/parts";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import type { PartEntry, PartPhoto, PartStep } from "../../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeHeader = (header: string) =>
  header
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "")
    .replace(/[()]/g, "");

const headerMap: Record<string, string> = {
  id: "id",
  model: "model",
  system: "system",
  name: "name",
  part: "name",
  partname: "name",
  summary: "summary",
  desc: "summary",
  tags: "tags",
  photourl: "photo_url",
  photo: "photo_url",
  photolabel: "photo_label",
  phototags: "photo_tags",
  steporder: "step_order",
  step: "step_title",
  steptitle: "step_title",
  stepdesc: "step_desc",
  steptools: "step_tools",
  steptorque: "step_torque",
  stepnote: "step_note",
};

const normalizeRow = (row: Record<string, unknown>): Record<string, string> => {
  const out: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    const k = normalizeHeader(key);
    const target = headerMap[k];
    if (!target) return;
    out[target] = value ? String(value).trim() : "";
  });
  return out;
};

const parseCsv = (content: string) => {
  const result = Papa.parse(content, { header: true, skipEmptyLines: true });
  if (result.errors.length) {
    throw new Error(result.errors[0].message);
  }
  return result.data.map(normalizeRow);
};

const parseXlsx = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map(normalizeRow);
};

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json({ error: "READ_ONLY_MODE" }, { status: 403 });
  }
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = file.name.toLowerCase().split(".").pop();
  let rows: Record<string, string>[] = [];
  try {
    if (ext === "csv") {
      rows = parseCsv(await file.text());
    } else if (ext === "xlsx") {
      rows = await parseXlsx(file);
    } else {
      return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "parse error" },
      { status: 400 }
    );
  }

  // Group by model + name
  const groups = new Map<string, PartEntry>();
  const now = new Date().toISOString();

  const pushPhoto = (entry: PartEntry, url?: string, label?: string, tags?: string[]) => {
    if (!url) return;
    const photos = entry.photos ?? [];
    const id = `ph-${photos.length + 1}`;
    photos.push({
      id,
      url,
      label,
      tags: tags?.filter(Boolean),
    } as PartPhoto);
    entry.photos = photos;
  };

  const pushStep = (
    entry: PartEntry,
    order: number | null,
    title?: string,
    desc?: string,
    tools?: string,
    torque?: string,
    note?: string
  ) => {
    if (!title && !desc) return;
    const steps = entry.steps ?? [];
    steps.push({
      order: order ?? steps.length + 1,
      title: title ?? `단계 ${steps.length + 1}`,
      desc,
      tools,
      torque,
      note,
    } as PartStep);
    entry.steps = steps;
  };

  rows.forEach((row) => {
    const model = row.model?.toUpperCase();
    const name = row.name || row.part || row.partname;
    if (!model || !name) return;

    const systemValue = (row.system || "other").toLowerCase();
    const systemMap: Record<string, PartEntry["system"]> = {
      engine: "engine",
      chassis: "chassis",
      electrical: "electrical",
      other: "other",
      엔진: "engine",
      차대: "chassis",
      차체: "chassis",
      전장: "electrical",
      기타: "other",
    };
    const system = systemMap[systemValue] ?? "other";

    const key = `${model}||${name}`;
    const existing = groups.get(key) ?? {
      id: row.id || `part-${model}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      model,
      system,
      name,
      summary: row.summary || "",
      tags: (row.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      photos: [],
      steps: [],
      updated_at: now,
    };

    const photoTags = (row.photo_tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    pushPhoto(existing, row.photo_url, row.photo_label, photoTags);

    const orderNum = row.step_order ? Number(row.step_order) || null : null;
    pushStep(
      existing,
      orderNum,
      row.step_title,
      row.step_desc,
      row.step_tools,
      row.step_torque,
      row.step_note
    );

    groups.set(key, existing);
  });

  let imported = 0;
  let skipped = 0;
  for (const entry of groups.values()) {
    if (!entry.model || !entry.name) {
      skipped += 1;
      continue;
    }
    const result = await upsertPart(entry, request);
    if ("error" in result && result.error) {
      skipped += 1;
    } else {
      imported += 1;
    }
  }

  return NextResponse.json({ imported, skipped, total: groups.size });
}
