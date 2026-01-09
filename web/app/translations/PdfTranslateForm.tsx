"use client";

import { useEffect, useState } from "react";

type PdfTranslateFormProps = {
  readOnly?: boolean;
};

export default function PdfTranslateForm({ readOnly = false }: PdfTranslateFormProps) {
  const [entryId, setEntryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 업로드할 수 없습니다.");
      return;
    }
    if (!entryId.trim()) {
      setStatus("error");
      setMessage("매뉴얼 ID를 입력해 주세요.");
      return;
    }
    if (!file) {
      setStatus("error");
      setMessage("PDF 파일을 선택해 주세요.");
      return;
    }
    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("관리자 코드를 입력해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setResultUrl(null);

    try {
      localStorage.setItem("ADMIN_TOKEN", adminToken);
      const uploadResponse = await fetch("/api/translations/upload-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          entryId: entryId.trim(),
          filename: file.name,
          contentType: file.type || "application/pdf",
        }),
      });

      const uploadText = await uploadResponse.text();
      let uploadData: Record<string, unknown> = {};
      if (uploadText) {
        try {
          uploadData = JSON.parse(uploadText) as Record<string, unknown>;
        } catch {
          uploadData = { error: uploadText };
        }
      }
      if (!uploadResponse.ok) {
        throw new Error((uploadData?.error as string) ?? "업로드 준비 실패");
      }

      const signedUrl = uploadData?.signedUrl as string | undefined;
      const originalPath = uploadData?.path as string | undefined;
      const contentType = (uploadData?.contentType as string) ?? "application/pdf";
      if (!signedUrl || !originalPath) {
        throw new Error("업로드 URL을 가져오지 못했습니다.");
      }

      const uploadToStorage = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: file,
      });

      if (!uploadToStorage.ok) {
        throw new Error("스토리지 업로드에 실패했습니다.");
      }

      const response = await fetch("/api/translations/translate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          entryId: entryId.trim(),
          originalPath,
        }),
      });

      const rawText = await response.text();
      let data: Record<string, unknown> = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          data = { error: rawText };
        }
      }
      if (!response.ok) {
        throw new Error((data?.error as string) ?? "PDF 번역 실패");
      }
      setStatus("success");
      setMessage("PDF 번역이 완료되었습니다.");
      setResultUrl((data?.url as string) ?? null);
      setFile(null);
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "PDF 번역 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3">
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="관리자 코드"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={entryId}
          onChange={(event) => setEntryId(event.target.value)}
          placeholder="매뉴얼 ID (예: 350D_engine_001)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            disabled={readOnly}
          />
          <button
            type="submit"
            disabled={status === "loading" || readOnly}
            className="min-w-[88px] whitespace-nowrap rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {status === "loading" ? "번역 중.." : "PDF 번역"}
          </button>
        </div>
      </div>
      {message ? (
        <div
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-slate-600"
          }`}
        >
          {message}
          {resultUrl ? (
            <>
              {" "}
              <a
                href={resultUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-800 underline"
              >
                결과 PDF 열기
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
