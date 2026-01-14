import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const headers = [
  "model",
  "system",
  "category",
  "symptomTitle",
  "diagnosisTreeId",
  "diagnosisResultId",
  "title",
  "description",
  "fixSteps",
  "tags",
  "references",
  "parts",
];

const toCsvValue = (value: string) => {
  const text = String(value ?? "");
  if (text.includes("\"") || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/\"/g, "\"\"")}"`;
  }
  return text;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format")?.toLowerCase() ?? "csv";
  const model = searchParams.get("model") ?? "";
  const category = searchParams.get("category") ?? "";
  const symptomTitle = searchParams.get("symptomTitle") ?? "";
  const diagnosisTreeId = searchParams.get("diagnosisTreeId") ?? "";
  const diagnosisResultId = searchParams.get("diagnosisResultId") ?? "";
  const title = searchParams.get("title") ?? symptomTitle;
  const description = searchParams.get("description") ?? "";

  const row = {
    model,
    system: "",
    category,
    symptomTitle,
    diagnosisTreeId,
    diagnosisResultId,
    title,
    description,
    fixSteps: "",
    tags: "",
    references: "",
    parts: "",
  };

  if (format === "xlsx") {
    const data = [headers, headers.map((key) => (row as Record<string, string>)[key] ?? "")];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "cases");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"cases_template.xlsx\"",
      },
    });
  }

  const csvLines = [
    headers.join(","),
    headers.map((key) => toCsvValue((row as Record<string, string>)[key] ?? "")).join(","),
  ];
  const csv = "\uFEFF" + csvLines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"cases_template.csv\"",
    },
  });
}
