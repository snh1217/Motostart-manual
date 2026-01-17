import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { unstable_cache } from "next/cache";
import type { DiagnosisNode, DiagnosisTree } from "./types";
import { hasSupabaseConfig, supabaseReader } from "./supabase/server";

const treesDir = path.resolve(process.cwd(), "data", "diagnosis", "trees");

type TreeValidation = {
  errors: string[];
  warnings: string[];
};

const isQuestionNode = (
  node: DiagnosisNode
): node is Extract<DiagnosisNode, { type: "question" }> => node.type === "question";

const isStepNode = (
  node: DiagnosisNode
): node is Extract<DiagnosisNode, { type: "step" }> => node.type === "step";

const isResultNode = (
  node: DiagnosisNode
): node is Extract<DiagnosisNode, { type: "result" }> => node.type === "result";

const validateTreeLinks = (tree: DiagnosisTree): TreeValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
  const ids = new Set(nodes.map((node) => node.id));

  if (!ids.has(tree.startNodeId)) {
    errors.push(`startNodeId ${tree.startNodeId} is missing`);
  }

  nodes.forEach((node) => {
    if (isQuestionNode(node)) {
      if (!node.yesNextId || !ids.has(node.yesNextId)) {
        errors.push(`node ${node.id} yesNextId ${node.yesNextId} not found`);
      }
      if (!node.noNextId || !ids.has(node.noNextId)) {
        errors.push(`node ${node.id} noNextId ${node.noNextId} not found`);
      }
    }
    if (isStepNode(node)) {
      if (!node.nextId || !ids.has(node.nextId)) {
        errors.push(`node ${node.id} nextId ${node.nextId} not found`);
      }
    }
    if (isResultNode(node) && (!node.actions || node.actions.length === 0)) {
      warnings.push(`result node ${node.id} has no actions`);
    }
  });

  return { errors, warnings };
};

const detectCycles = (tree: DiagnosisTree): string[] => {
  const errors: string[] = [];
  const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => {
    if (isQuestionNode(node)) {
      adjacency.set(node.id, [node.yesNextId, node.noNextId]);
    } else if (isStepNode(node)) {
      adjacency.set(node.id, [node.nextId]);
    } else {
      adjacency.set(node.id, []);
    }
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (nodeId: string, pathStack: string[]) => {
    if (visiting.has(nodeId)) {
      errors.push(`cycle detected: ${[...pathStack, nodeId].join(" -> ")}`);
      return;
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    const next = adjacency.get(nodeId) ?? [];
    next.forEach((nextId) => dfs(nextId, [...pathStack, nodeId]));
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  dfs(tree.startNodeId, []);
  return errors;
};

export const validateDiagnosisTree = (tree: DiagnosisTree): TreeValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];

  if (!tree.treeId || !tree.title || !tree.category) {
    errors.push("treeId, title, category are required");
  }
  if (!Array.isArray(tree.nodes) || tree.nodes.length === 0) {
    errors.push("nodes are required");
  }
  if (!tree.startNodeId) {
    errors.push("startNodeId is required");
  }

  const nodeIds = new Set<string>();
  const resultCount = nodes.filter((node) => node.type === "result").length;
  if (resultCount === 0) {
    errors.push("at least one result node is required");
  }

  const allowedTypes = new Set(["question", "result", "step"]);
  nodes.forEach((node) => {
    if (nodeIds.has(node.id)) {
      errors.push(`duplicate node id ${node.id}`);
    }
    nodeIds.add(node.id);
    const hasText =
      Boolean((node as { text?: string }).text?.trim()) ||
      Boolean((node as { text_ko?: string }).text_ko?.trim()) ||
      Boolean((node as { text_en?: string }).text_en?.trim());
    if (!node.type || !hasText) {
      errors.push(`node ${node.id} missing type/text`);
    }
    if (!allowedTypes.has(node.type)) {
      errors.push(`node ${node.id} has invalid type ${node.type}`);
    }
    if (node.type === "question") {
      if (!(node as { yesNextId?: string }).yesNextId || !(node as { noNextId?: string }).noNextId) {
        errors.push(`question node ${node.id} missing yesNextId/noNextId`);
      }
    }
    if (node.type === "step" && !(node as { nextId?: string }).nextId) {
      errors.push(`step node ${node.id} missing nextId`);
    }
    if (node.type === "result") {
      const actions =
        (node as { actions?: string[] }).actions ??
        (node as { actions_ko?: string[] }).actions_ko ??
        (node as { actions_en?: string[] }).actions_en;
      if (!Array.isArray(actions) || actions.length === 0) {
        errors.push(`result node ${node.id} missing actions`);
      }
    }
  });

  if (nodes.length) {
    const linkValidation = validateTreeLinks(tree);
    errors.push(...linkValidation.errors);
    warnings.push(...linkValidation.warnings);
    errors.push(...detectCycles(tree));
  }

  const reachable = new Set<string>();
  const visit = (nodeId: string) => {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    const node = nodes.find((item) => item.id === nodeId);
    if (node && isQuestionNode(node)) {
      visit(node.yesNextId);
      visit(node.noNextId);
    }
    if (node && isStepNode(node)) {
      visit(node.nextId);
    }
  };
  if (tree.startNodeId) visit(tree.startNodeId);
  nodes.forEach((node) => {
    if (!reachable.has(node.id)) {
      warnings.push(`node ${node.id} is unreachable`);
    }
  });

  return { errors, warnings };
};

const readTreeFile = async (filePath: string): Promise<DiagnosisTree[]> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    if (!parsed || typeof parsed !== "object") return [];
    if (Array.isArray(parsed)) return parsed as DiagnosisTree[];
    return [parsed as DiagnosisTree];
  } catch {
    return [];
  }
};

export const loadDiagnosisTrees = async (): Promise<DiagnosisTree[]> => {
  try {
    const entries = await fs.readdir(treesDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(treesDir, entry.name));
    const items = await Promise.all(jsonFiles.map(readTreeFile));
    return items.flat().filter(Boolean) as DiagnosisTree[];
  } catch {
    return [];
  }
};

const mapDbTree = (row: Record<string, unknown>): DiagnosisTree | null => {
  const nodes = Array.isArray(row.nodes) ? (row.nodes as DiagnosisNode[]) : [];
  if (!row.tree_id || !row.start_node_id || !nodes.length) return null;
  return {
    treeId: String(row.tree_id),
    title: (row.title_ko as string) || (row.title_en as string) || String(row.tree_id),
    title_ko: row.title_ko as string | undefined,
    title_en: row.title_en as string | undefined,
    category: String(row.category ?? "General"),
    supportedModels: Array.isArray(row.supported_models)
      ? (row.supported_models as string[])
      : [],
    startNodeId: String(row.start_node_id),
    nodes,
  };
};

const fetchActiveTrees = async (): Promise<DiagnosisTree[]> => {
  if (!hasSupabaseConfig || !supabaseReader) return [];
  const { data, error } = await supabaseReader
    .from("diagnosis_trees")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  const mapped = (data as Record<string, unknown>[]).map(mapDbTree).filter(Boolean);
  const validated = (mapped as DiagnosisTree[]).filter((tree) => {
    const validation = validateDiagnosisTree(tree);
    return validation.errors.length === 0;
  });
  return validated;
};

export const loadActiveDiagnosisTrees = unstable_cache(
  async (): Promise<DiagnosisTree[]> => {
    const dbTrees = await fetchActiveTrees();
    if (dbTrees.length) return dbTrees;
    return loadDiagnosisTrees();
  },
  ["diagnosis-trees"],
  { revalidate: 60 }
);

export const getDiagnosisTree = async (
  treeId: string
): Promise<DiagnosisTree | null> => {
  const trees = await loadActiveDiagnosisTrees();
  return trees.find((tree) => tree.treeId === treeId) ?? null;
};

export const diagnosisTreesPath = treesDir;
