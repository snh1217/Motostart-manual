"use client";

import { useEffect, useState } from "react";

type UploadManualFormProps = {
  readOnly?: boolean;
};

export default function UploadManualForm({ readOnly = false }: UploadManualFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("");
  const [manualType, setManualType] = useState("engine");
  const [section, setSection] = useState("");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("ko");
  const [docDate, setDocDate] = useState("");
  const [docCode, setDocCode] = useState("");
  const [sourcePdf, setSourcePdf] = useState("");
  const [pagesStart, setPagesStart] = useState("1");
  const [pagesEnd, setPagesEnd] = useState("1");
  const [entryId, setEntryId] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

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

    if (!file) {
      setStatus("error");
      setMessage("PDF 파일을 선택해 주세요.");
      return;
    }

    if (!model.trim() || !title.trim() || !section.trim()) {
      setStatus("error");
      setMessage("모델, 섹션, 제목을 입력해 주세요.");
      return;
    }

    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("ADMIN_TOKEN을 입력해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", model.trim());
    formData.append("manual_type", manualType);
    formData.append("section", section.trim());
    formData.append("title", title.trim());
    formData.append("language", language.trim());
    formData.append("doc_date", docDate.trim());
    formData.append("doc_code", docCode.trim());
    formData.append("source_pdf", sourcePdf.trim());
    formData.append("pages_start", pagesStart.trim());
    formData.append("pages_end", pagesEnd.trim());
    formData.append("id", entryId.trim());

    try {
      localStorage.setItem("ADMIN_TOKEN", adminToken);
      const response = await fetch("/api/manuals/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "업로드 실패");
      }

      setStatus("success");
      setMessage("매뉴얼 업로드 완료");
      setFile(null);
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "업로드 오류");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="text"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="모델 코드 (예: 350D)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <select
          value={manualType}
          onChange={(event) => setManualType(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        >
          <option value="engine">엔진</option>
          <option value="chassis">차대</option>
          <option value="user">사용자</option>
          <option value="wiring">회로도</option>
        </select>
        <input
          type="text"
          value={section}
          onChange={(event) => setSection(event.target.value)}
          placeholder="섹션 (예: Lubrication System)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="제목"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          placeholder="언어 (ko/en)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={docDate}
          onChange={(event) => setDocDate(event.target.value)}
          placeholder="문서일 (예: 2025-02-12)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={docCode}
          onChange={(event) => setDocCode(event.target.value)}
          placeholder="문서 코드"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={sourcePdf}
          onChange={(event) => setSourcePdf(event.target.value)}
          placeholder="원본 PDF 파일명"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={entryId}
          onChange={(event) => setEntryId(event.target.value)}
          placeholder="ID (비워두면 자동 생성)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="number"
          value={pagesStart}
          onChange={(event) => setPagesStart(event.target.value)}
          placeholder="시작 페이지"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="number"
          value={pagesEnd}
          onChange={(event) => setPagesEnd(event.target.value)}
          placeholder="끝 페이지"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="ADMIN_TOKEN"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
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
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "loading" ? "업로드 중..." : "업로드"}
        </button>
      </div>
      {message ? (
        <div
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-slate-600"
          }`}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
