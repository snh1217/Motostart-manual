import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { revalidateTag } from "next/cache";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import {
  diagnosisTreesPath,
  loadDiagnosisTrees,
  validateDiagnosisTree,
} from "../../../../lib/diagnosisTrees";
import type { DiagnosisTree } from "../../../../lib/types";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

const safeFileName = (treeId: string) =>
  treeId.replace(/[^a-zA-Z0-9_-]/g, "_");

const parsePayload = async (request: Request): Promise<DiagnosisTree[]> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as DiagnosisTree | DiagnosisTree[];
    return Array.isArray(body) ? body : [body];
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("file is required");
  }
  const raw = await file.text();
  const parsed = JSON.parse(raw) as DiagnosisTree | DiagnosisTree[];
  return Array.isArray(parsed) ? parsed : [parsed];
};

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "관리자 접근이 필요합니다." },
      { status: 401 }
    );
  }

  let items: Array<Record<string, unknown>> = [];
  if (hasSupabaseConfig && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("diagnosis_trees")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      items = data.map((row) => {
        const tree = {
          treeId: row.tree_id as string,
          title: (row.title_en ?? row.title_ko ?? row.tree_id) as string,
          category: (row.category as string) ?? "General",
          supportedModels: (row.supported_models ?? []) as string[],
          startNodeId: row.start_node_id as string,
          nodes: Array.isArray(row.nodes) ? (row.nodes as DiagnosisTree["nodes"]) : [],
        };
        const validation = validateDiagnosisTree(tree as DiagnosisTree);
        return {
          treeId: tree.treeId,
          title: tree.title,
          category: tree.category || "General",
          supportedModels: tree.supportedModels,
          nodeCount: tree.nodes.length,
          version: row.version ?? 1,
          isActive: row.is_active ?? false,
          updatedAt: row.updated_at ?? null,
          updatedBy: row.updated_by ?? null,
          source: "db",
          errors: validation.errors,
          warnings: validation.warnings,
        };
      });
    }
  }

  if (!items.length) {
    const trees = await loadDiagnosisTrees();
    items = trees.map((tree) => {
      const validation = validateDiagnosisTree(tree);
      return {
        treeId: tree.treeId,
        title: tree.title,
        category: tree.category,
        supportedModels: tree.supportedModels,
        nodeCount: tree.nodes.length,
        version: 1,
        isActive: true,
        updatedAt: null,
        updatedBy: null,
        source: "json",
        errors: validation.errors,
        warnings: validation.warnings,
      };
    });
  }

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 업로드할 수 없습니다." },
      { status: 403 }
    );
  }
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "관리자 접근이 필요합니다." },
      { status: 401 }
    );
  }

  let payload: DiagnosisTree[] = [];
  try {
    payload = await parsePayload(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "JSON 파싱 실패" },
      { status: 400 }
    );
  }

  const results: Array<Record<string, unknown>> = [];

  if (hasSupabaseConfig && supabaseAdmin) {
    for (const tree of payload) {
      const validation = validateDiagnosisTree(tree);
      if (validation.errors.length) {
        results.push({
          treeId: tree.treeId ?? "(unknown)",
          status: "failed",
          errors: validation.errors,
          warnings: validation.warnings,
        });
        continue;
      }

      const { data: existing } = await supabaseAdmin
        .from("diagnosis_trees")
        .select("version, is_active")
        .eq("tree_id", tree.treeId)
        .maybeSingle();
      const nextVersion = existing?.version ? Number(existing.version) + 1 : 1;
      const isActive = existing?.is_active ?? false;

      const { error } = await supabaseAdmin
        .from("diagnosis_trees")
        .upsert(
          {
            tree_id: tree.treeId,
            title_en: tree.title,
            category: tree.category,
            supported_models: tree.supportedModels,
            start_node_id: tree.startNodeId,
            nodes: tree.nodes,
            version: nextVersion,
            is_active: isActive,
            updated_by: "admin",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tree_id" }
        );

      if (error) {
        results.push({
          treeId: tree.treeId,
          status: "failed",
          errors: [error.message],
          warnings: validation.warnings,
        });
        continue;
      }

      results.push({
        treeId: tree.treeId,
        status: "saved",
        version: nextVersion,
        warnings: validation.warnings,
      });
    }
    revalidateTag("diagnosis-trees", "max");
    return NextResponse.json({
      imported: results.filter((item) => item.status === "saved").length,
      results,
    });
  }

  await fs.mkdir(diagnosisTreesPath, { recursive: true });
  for (const tree of payload) {
    const validation = validateDiagnosisTree(tree);
    if (validation.errors.length) {
      results.push({
        treeId: tree.treeId ?? "(unknown)",
        status: "failed",
        errors: validation.errors,
        warnings: validation.warnings,
      });
      continue;
    }

    const filename = `${safeFileName(tree.treeId)}.json`;
    const filePath = path.join(diagnosisTreesPath, filename);
    await fs.writeFile(filePath, JSON.stringify(tree, null, 2), "utf8");
    results.push({
      treeId: tree.treeId,
      status: "saved",
      warnings: validation.warnings,
    });
  }

  revalidateTag("diagnosis-trees", "max");
  return NextResponse.json({
    imported: results.filter((item) => item.status === "saved").length,
    results,
  });
}

export async function PATCH(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 변경할 수 없습니다." },
      { status: 403 }
    );
  }
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "관리자 접근이 필요합니다." },
      { status: 401 }
    );
  }
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return NextResponse.json(
      { error: "SUPABASE_NOT_CONFIGURED" },
      { status: 400 }
    );
  }

  const body = (await request.json()) as { treeId?: string; isActive?: boolean };
  const treeId = body.treeId?.trim();
  if (!treeId) {
    return NextResponse.json({ error: "treeId is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("diagnosis_trees")
    .update({ is_active: Boolean(body.isActive), updated_at: new Date().toISOString() })
    .eq("tree_id", treeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("diagnosis-trees", "max");
  return NextResponse.json({ ok: true });
}
