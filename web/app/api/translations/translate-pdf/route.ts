import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { TranslationServiceClient } from "@google-cloud/translate";
import { isAdminAuthorized, isReadOnlyMode } from "../../../../lib/auth/admin";
import { hasSupabaseConfig, supabaseAdmin } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const FONT_SIZE = 12;
const LINE_HEIGHT = FONT_SIZE * 1.6;
const PAGE_MARGIN = 48;

const fontPath = path.resolve(
  process.cwd(),
  "public",
  "fonts",
  "NotoSansCJKkr-Regular.otf"
);

const splitByLength = (text: string, maxLen: number) => {
  const chunks: string[] = [];
  let buffer = "";
  for (const line of text.split(/\r?\n/)) {
    const next = buffer ? `${buffer}\n${line}` : line;
    if (next.length > maxLen) {
      if (buffer) chunks.push(buffer);
      buffer = line;
    } else {
      buffer = next;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
};

const wrapLine = (line: string, measure: (value: string) => number, maxWidth: number) => {
  if (!line) return [""];
  const words = line.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measure(next) > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const renderPdf = async (text: string) => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = await fs.readFile(fontPath);
  const font = await pdfDoc.embedFont(fontBytes);

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let cursorY = A4_HEIGHT - PAGE_MARGIN;
  const maxWidth = A4_WIDTH - PAGE_MARGIN * 2;
  const measure = (value: string) => font.widthOfTextAtSize(value, FONT_SIZE);

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const wrappedLines = wrapLine(rawLine.trimEnd(), measure, maxWidth);
    for (const line of wrappedLines) {
      if (cursorY < PAGE_MARGIN + LINE_HEIGHT) {
        page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        cursorY = A4_HEIGHT - PAGE_MARGIN;
      }
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: FONT_SIZE,
        font,
      });
      cursorY -= LINE_HEIGHT;
    }
    cursorY -= LINE_HEIGHT * 0.3;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

const inferModel = (entryId: string) => {
  const upper = entryId.toUpperCase();
  if (upper.includes("350D")) return "350D";
  if (upper.includes("368G")) return "368G";
  if (upper.includes("368E")) return "368E";
  if (upper.includes("125M")) return "125M";
  if (upper.includes("125D")) return "125D";
  if (upper.includes("125E")) return "125E";
  if (upper.includes("125C")) return "125C";
  if (upper.includes("310M")) return "310M";
  return "UNKNOWN";
};

const normalizeText = (value: string) =>
  value.replace(/\u0000/g, "").replace(/\s+\n/g, "\n").trim();

export async function POST(request: Request) {
  if (isReadOnlyMode()) {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 번역할 수 없습니다." },
      { status: 403 }
    );
  }
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "관리자 토큰이 필요합니다." }, { status: 401 });
  }
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return NextResponse.json({ error: "Supabase 설정이 필요합니다." }, { status: 500 });
  }

  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION ?? "us";
  const processorId = process.env.GCP_PROCESSOR_ID;
  const bucket = process.env.TRANSLATIONS_PDF_BUCKET;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!projectId || !processorId || !bucket) {
    return NextResponse.json(
      { error: "GCP 또는 저장소 환경변수를 확인해 주세요." },
      { status: 500 }
    );
  }
  if (!credentialsPath && !credentialsJson) {
    return NextResponse.json(
      { error: "서비스 계정 키 환경변수가 필요합니다." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const entryId = String(formData.get("entryId") ?? "").trim();
  const file = formData.get("file");
  if (!entryId) {
    return NextResponse.json({ error: "매뉴얼 ID가 필요합니다." }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "PDF 파일이 필요합니다." }, { status: 400 });
  }
  const isPdf =
    file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  let clientOptions: { credentials?: Record<string, string>; projectId?: string } = {};
  if (credentialsJson) {
    try {
      const parsed = JSON.parse(credentialsJson) as Record<string, string>;
      clientOptions = {
        credentials: parsed,
        projectId: parsed.project_id ?? projectId,
      };
    } catch {
      return NextResponse.json(
        { error: "서비스 계정 키 JSON 형식이 올바르지 않습니다." },
        { status: 500 }
      );
    }
  }

  const docClient = new DocumentProcessorServiceClient(clientOptions);
  const processorName = docClient.processorPath(projectId, location, processorId);
  const [docResult] = await docClient.processDocument({
    name: processorName,
    rawDocument: {
      content: rawBuffer,
      mimeType: "application/pdf",
    },
  });

  const extractedText = normalizeText(docResult?.document?.text ?? "");
  if (!extractedText) {
    return NextResponse.json({ error: "PDF에서 텍스트를 추출하지 못했습니다." }, { status: 400 });
  }

  const translateClient = new TranslationServiceClient(clientOptions);
  const parent = `projects/${projectId}/locations/${location}`;
  const chunks = splitByLength(extractedText, 2500);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const [translation] = await translateClient.translateText({
      parent,
      contents: [chunk],
      mimeType: "text/plain",
      targetLanguageCode: "ko",
    });
    const translatedText = translation.translations?.[0]?.translatedText ?? "";
    translatedChunks.push(translatedText);
  }

  const translatedText = normalizeText(translatedChunks.join("\n"));
  const pdfBuffer = await renderPdf(translatedText);

  const safeEntryId = entryId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const objectPath = `translations/${safeEntryId}/${Date.now()}-ko.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(objectPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const model = inferModel(entryId);
  const { data: existing } = await supabaseAdmin
    .from("translations")
    .select("meta")
    .eq("model", model)
    .eq("entry_id", entryId)
    .maybeSingle();

  const { error: upsertError } = await supabaseAdmin
    .from("translations")
    .upsert(
      {
        model,
        entry_id: entryId,
        meta: {
          ...(existing?.meta ?? {}),
          pdf_ko_path: objectPath,
          pdf_ko_bucket: bucket,
        },
      },
      { onConflict: "model,entry_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data: signed } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(objectPath, 60 * 60 * 24 * 7);

  return NextResponse.json({
    ok: true,
    path: objectPath,
    url: signed?.signedUrl ?? null,
  });
}
