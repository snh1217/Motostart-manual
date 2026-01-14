import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { parseCsv, parseXlsx } from "../../../../lib/importers";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";
import { loadModels } from "../../../../lib/models";

type CaseRow = {
  id: string;
  model: string;
  system?: string;
  category?: string;
  symptom?: string;
  symptomTitle?: string;
  title?: string;
  description?: string;
  fixSteps?: string;
  action?: string;
  parts?: string;
  tags?: string;
  references?: string;
  diagnosisTreeId?: string;
  diagnosisResultId?: string;
  photo_1?: string;
  photo_1_desc?: string;
  photo_2?: string;
  photo_2_desc?: string;
  photo_3?: string;
  photo_3_desc?: string;
  photo_4?: string;
  photo_4_desc?: string;
  photo_5?: string;
  photo_5_desc?: string;
};

type RowError = {
  row: number;
  field: string;
  message: string;
  value?: string;
};

const normalizeModel = (model: string): string => {
  return model.replace(/\s+/g, "").toUpperCase();
};

const normalizeSystem = (system: string): string => {
  const trimmed = system.trim();
  if (trimmed === "엔진") return "engine";
  if (trimmed === "차체") return "chassis";
  if (trimmed === "전장") return "electrical";
  return trimmed.toLowerCase();
};

const buildErrorCsv = (errors: RowError[]) => {
  const header = ["row", "field", "message", "value"];
  const rows = errors.map((err) => [
    err.row,
    err.field,
    err.message,
    err.value ?? "",
  ]);
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return text.includes(",") || text.includes("\n") || text.includes("\"")
            ? `"${text.replace(/\"/g, "\"\"")}"`
            : text;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
};

const getMissingRequiredColumns = (
  rows: Record<string, string>[],
  applyDefaultModel: boolean
) => {
  const columns = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => columns.add(key)));

  const missing: string[] = [];
  if (!columns.has("model") && !applyDefaultModel) missing.push("model");
  if (!columns.has("title") && !columns.has("symptomTitle") && !columns.has("symptom")) {
    missing.push("title/symptom");
  }
  if (!columns.has("fixSteps") && !columns.has("action")) missing.push("fixSteps/action");
  return missing;
};

const readExistingCases = async (filePath: string): Promise<CaseRow[]> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CaseRow[]) : [];
  } catch {
    return [];
  }
};

const loadExistingDupKeys = async (): Promise<Set<string>> => {
  if (hasSupabaseConfig && supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from("cases").select("*");
    if (error || !Array.isArray(data)) return new Set();
    const keys = data
      .filter((item) => item.diagnosisResultId)
      .map(
        (item) =>
          `${item.model ?? ""}|${item.title ?? item.symptomTitle ?? item.symptom ?? ""}|${
            item.diagnosisResultId ?? ""
          }`
      );
    return new Set(keys);
  }

  const casesPath = path.resolve(process.cwd(), "data", "cases.json");
  const existingCases = await readExistingCases(casesPath);
  const keys = existingCases
    .filter((item) => item.diagnosisResultId)
    .map(
      (item) =>
        `${item.model}|${item.title ?? item.symptomTitle ?? item.symptom ?? ""}|${item.diagnosisResultId ?? ""}`
    );
  return new Set(keys);
};

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

  const formData = await request.formData();
  const file = formData.get("file");
  const defaultModel = String(formData.get("defaultModel") ?? "").trim();
  const applyDefaultModel = String(formData.get("applyDefaultModel") ?? "") === "1";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const extension = fileName.split(".").pop() ?? "";

  let rows: Record<string, string>[] = [];
  try {
    if (extension === "csv") {
      const content = await file.text();
      rows = parseCsv(content);
    } else if (extension === "xlsx") {
      const buffer = await file.arrayBuffer();
      rows = parseXlsx(buffer);
    } else {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다." },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "파싱 오류" },
      { status: 400 }
    );
  }

  const missingRequired = getMissingRequiredColumns(rows, applyDefaultModel);
  if (missingRequired.length) {
    return NextResponse.json(
      { error: `필수 컬럼 누락: ${missingRequired.join(", ")}` },
      { status: 400 }
    );
  }

  const models = await loadModels();
  const supportedModels = new Set(models.map((model) => normalizeModel(model.id)));

  const importedCases: CaseRow[] = [];
  const errors: RowError[] = [];
  const warnings: string[] = [];
  const incomingDupKeys = new Set<string>();
  const needsDupCheck = rows.some((row) => row.diagnosisResultId?.trim());
  const existingDupKeys = needsDupCheck ? await loadExistingDupKeys() : new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawModel = row.model?.trim() ?? "";
    const resolvedModel = rawModel
      ? normalizeModel(rawModel)
      : applyDefaultModel && defaultModel
        ? normalizeModel(defaultModel)
        : "";

    if (!resolvedModel) {
      errors.push({ row: rowNumber, field: "model", message: "model 값이 필요합니다." });
      return;
    }

    if (supportedModels.size && !supportedModels.has(resolvedModel)) {
      errors.push({
        row: rowNumber,
        field: "model",
        message: "지원되지 않는 model 입니다.",
        value: resolvedModel,
      });
      return;
    }

    if (
      rawModel &&
      applyDefaultModel &&
      defaultModel &&
      normalizeModel(rawModel) !== normalizeModel(defaultModel)
    ) {
      warnings.push(`모델 불일치 경고: ${rowNumber}행 (파일 ${rawModel}, 선택 ${defaultModel})`);
    }

    const title = row.title?.trim() || row.symptomTitle?.trim() || row.symptom?.trim() || "";
    if (!title) {
      errors.push({
        row: rowNumber,
        field: "title",
        message: "title 또는 symptom 값이 필요합니다.",
      });
      return;
    }

    const fixSteps = row.fixSteps?.trim() || row.action?.trim() || "";
    if (!fixSteps) {
      errors.push({
        row: rowNumber,
        field: "fixSteps",
        message: "fixSteps 또는 action 값이 필요합니다.",
      });
      return;
    }

    const category = row.category?.trim() || row.system?.trim() || "";
    const system = row.system?.trim()
      ? normalizeSystem(row.system)
      : row.category?.trim()
        ? normalizeSystem(row.category)
        : "";
    const diagnosisTreeId = row.diagnosisTreeId?.trim() || "";
    const diagnosisResultId = row.diagnosisResultId?.trim() || "";

    if (diagnosisResultId) {
      const key = `${resolvedModel}|${title}|${diagnosisResultId}`;
      if (incomingDupKeys.has(key)) {
        warnings.push(`중복 감지: 파일 내 ${rowNumber}행`);
      }
      if (existingDupKeys.has(key)) {
        warnings.push(`중복 감지: 기존 데이터와 ${rowNumber}행`);
      }
      incomingDupKeys.add(key);
    }

    importedCases.push({
      id: `case-${Date.now()}-${index}`,
      model: resolvedModel,
      system: system || undefined,
      category: category || undefined,
      symptom: row.symptom?.trim() || title,
      symptomTitle: row.symptomTitle?.trim() || row.symptom?.trim() || title,
      title,
      description: row.description?.trim() || row.symptom?.trim() || "",
      fixSteps,
      action: row.action?.trim() || fixSteps,
      parts: row.parts?.trim() || undefined,
      tags: row.tags?.trim() || undefined,
      references: row.references?.trim() || undefined,
      diagnosisTreeId: diagnosisTreeId || undefined,
      diagnosisResultId: diagnosisResultId || undefined,
      photo_1: row.photo_1?.trim() || undefined,
      photo_1_desc: row.photo_1_desc?.trim() || undefined,
      photo_2: row.photo_2?.trim() || undefined,
      photo_2_desc: row.photo_2_desc?.trim() || undefined,
      photo_3: row.photo_3?.trim() || undefined,
      photo_3_desc: row.photo_3_desc?.trim() || undefined,
      photo_4: row.photo_4?.trim() || undefined,
      photo_4_desc: row.photo_4_desc?.trim() || undefined,
      photo_5: row.photo_5?.trim() || undefined,
      photo_5_desc: row.photo_5_desc?.trim() || undefined,
    });
  });

  if (hasSupabaseConfig && supabaseAdmin) {
    const payload = importedCases.map((item) => ({
      model: item.model,
      system: item.system ?? null,
      category: item.category ?? null,
      symptom: item.symptom ?? null,
      symptomTitle: item.symptomTitle ?? null,
      title: item.title ?? null,
      description: item.description ?? null,
      fixSteps: item.fixSteps ?? null,
      action: item.action ?? null,
      parts: item.parts ?? null,
      tags: item.tags ?? null,
      references: item.references ?? null,
      diagnosisTreeId: item.diagnosisTreeId ?? null,
      diagnosisResultId: item.diagnosisResultId ?? null,
    }));

    if (payload.length) {
      const { error } = await supabaseAdmin.from("cases").insert(payload);
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      imported: payload.length,
      failed: errors.length,
      total: payload.length + errors.length,
      models: Array.from(new Set(payload.map((item) => item.model))),
      warnings,
      errors,
      errorCsv: errors.length ? buildErrorCsv(errors) : undefined,
    });
  }

  const casesPath = path.resolve(process.cwd(), "data", "cases.json");
  const existingCases = await readExistingCases(casesPath);

  const combined = [...existingCases, ...importedCases];
  await fs.mkdir(path.dirname(casesPath), { recursive: true });
  await fs.writeFile(casesPath, JSON.stringify(combined, null, 2), "utf8");

  const modelsSet = new Set(combined.map((item) => item.model));

  return NextResponse.json({
    imported: importedCases.length,
    failed: errors.length,
    total: importedCases.length + errors.length,
    storedTotal: combined.length,
    models: Array.from(modelsSet),
    warnings,
    errors,
    errorCsv: errors.length ? buildErrorCsv(errors) : undefined,
  });
}
