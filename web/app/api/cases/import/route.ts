import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { parseCsv, parseXlsx } from "../../../../lib/importers";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";

type CaseRow = {
  id: string;
  model: string;
  system: string;
  symptom: string;
  action: string;
  photo_1?: string;
  photo_2?: string;
  photo_3?: string;
};

const normalizeModel = (model: string): string => {
  return model.replace(/\s+/g, "").toUpperCase();
};

const normalizeSystem = (system: string): string => {
  const trimmed = system.trim();
  if (trimmed === "엔진") return "engine";
  if (trimmed === "차대") return "chassis";
  if (trimmed === "전장") return "electrical";
  return trimmed.toLowerCase();
};

const requiredFields = ["model", "system", "symptom", "action"] as const;

const buildCaseRow = (row: Record<string, string>, index: number): CaseRow | null => {
  const missingRequired = requiredFields.some((field) => !row[field]);
  if (missingRequired) return null;

  return {
    id: `case-${Date.now()}-${index}`,
    model: normalizeModel(row.model),
    system: normalizeSystem(row.system),
    symptom: row.symptom.trim(),
    action: row.action.trim(),
    photo_1: row.photo_1?.trim() || undefined,
    photo_2: row.photo_2?.trim() || undefined,
    photo_3: row.photo_3?.trim() || undefined,
  };
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

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 업로드할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "관리자 토큰이 필요합니다." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

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

  const importedCases: CaseRow[] = [];
  rows.forEach((row, index) => {
    const caseRow = buildCaseRow(row, index);
    if (caseRow) importedCases.push(caseRow);
  });

  if (hasSupabaseConfig && supabaseAdmin) {
    const payload = importedCases.map((item) => ({
      model: item.model,
      system: item.system,
      symptom: item.symptom,
      action: item.action,
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
      total: payload.length,
      models: Array.from(new Set(payload.map((item) => item.model))),
      systems: Array.from(new Set(payload.map((item) => item.system))),
    });
  }

  const casesPath = path.resolve(process.cwd(), "data", "cases.json");
  const existingCases = await readExistingCases(casesPath);

  const combined = [...existingCases, ...importedCases];
  await fs.mkdir(path.dirname(casesPath), { recursive: true });
  await fs.writeFile(casesPath, JSON.stringify(combined, null, 2), "utf8");

  const models = Array.from(new Set(combined.map((item) => item.model)));
  const systems = Array.from(new Set(combined.map((item) => item.system)));

  return NextResponse.json({
    imported: importedCases.length,
    total: combined.length,
    models,
    systems,
  });
}
