import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WiringEntry = {
  id: string;
  model: string;
  title: string;
  tags: string[];
  note?: string;
  file: string;
};

const manifestPaths = [
  path.resolve(process.cwd(), "data", "wiring_manifest.json"),
  path.resolve(process.cwd(), "public", "data", "wiring_manifest.json"),
];

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sanitizeFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "_");

const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const readManifest = async (filePath: string): Promise<WiringEntry[]> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? (parsed as WiringEntry[]) : [];
  } catch {
    return [];
  }
};

const writeManifest = async (filePath: string, entries: WiringEntry[]) => {
  const body = JSON.stringify(entries, null, 2);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body, "utf8");
};

const ensureUniqueId = (entries: WiringEntry[], baseId: string) => {
  let candidate = baseId;
  let counter = 2;
  const ids = new Set(entries.map((entry) => entry.id));
  while (ids.has(candidate)) {
    candidate = `${baseId}-${counter}`;
    counter += 1;
  }
  return candidate;
};

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 업로드할 수 없습니다." },
      { status: 403 }
    );
  }

  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const model = String(formData.get("model") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const providedId = String(formData.get("id") ?? "").trim();

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "업로드할 PDF 파일이 필요합니다." },
      { status: 400 }
    );
  }

  if (!model) {
    return NextResponse.json(
      { error: "모델명을 입력해 주세요." },
      { status: 400 }
    );
  }

  if (!title) {
    return NextResponse.json(
      { error: "회로도 제목을 입력해 주세요." },
      { status: 400 }
    );
  }

  const originalName = file.name || "wiring.pdf";
  const extension = path.extname(originalName).toLowerCase();
  const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
  if (!allowedExtensions.has(extension)) {
    return NextResponse.json(
      { error: "PDF 또는 이미지 파일만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }

  const safeModel = model.trim().toUpperCase();
  const safeFileName = sanitizeFileName(originalName);
  const wiringDir = path.resolve(
    process.cwd(),
    "public",
    "wiring",
    safeModel
  );
  const filePath = path.join(wiringDir, safeFileName);

  await fs.mkdir(wiringDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  const entries = await readManifest(manifestPaths[0]);
  const baseSlug = toSlug(title) || toSlug(path.basename(safeFileName, ".pdf"));
  const modelSlug = toSlug(safeModel) || safeModel.toLowerCase();
  const baseId = `${modelSlug}-${baseSlug || Date.now()}`;
  const id = providedId ? providedId : ensureUniqueId(entries, baseId);

  const entry: WiringEntry = {
    id,
    model: safeModel,
    title,
    tags: parseTags(tagsRaw),
    note: note || undefined,
    file: `/wiring/${safeModel}/${safeFileName}`,
  };

  const existingIndex = entries.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  await Promise.all(
    manifestPaths.map((manifestPath) => writeManifest(manifestPath, entries))
  );

  return NextResponse.json({ id: entry.id, file: entry.file });
}
