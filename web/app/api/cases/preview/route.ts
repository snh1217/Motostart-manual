import { NextResponse } from "next/server";
import { parseCsv, parseXlsx } from "../../../../lib/importers";
import { isAdminAuthorized } from "../../../../lib/auth/admin";
import { loadModels } from "../../../../lib/models";

type RowError = {
  row: number;
  field: string;
  message: string;
  value?: string;
};

const normalizeModel = (model: string): string => {
  return model.replace(/\s+/g, "").toUpperCase();
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

export async function POST(request: Request) {
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
  const models = await loadModels();
  const supportedModels = new Set(models.map((model) => normalizeModel(model.id)));

  const errors: RowError[] = [];
  const warnings: string[] = [];
  const modelSet = new Set<string>();

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
      warnings.push(`모델 불일치 경고: ${rowNumber}행`);
    }

    const title = row.title?.trim() || row.symptomTitle?.trim() || row.symptom?.trim() || "";
    if (!title) {
      errors.push({
        row: rowNumber,
        field: "title",
        message: "title 또는 symptom 값이 필요합니다.",
      });
    }

    const fixSteps = row.fixSteps?.trim() || row.action?.trim() || "";
    if (!fixSteps) {
      errors.push({
        row: rowNumber,
        field: "fixSteps",
        message: "fixSteps 또는 action 값이 필요합니다.",
      });
    }

    if (resolvedModel) modelSet.add(resolvedModel);
  });

  return NextResponse.json({
    total: rows.length,
    models: Array.from(modelSet),
    missingRequired: missingRequired,
    errors,
    warnings,
  });
}
