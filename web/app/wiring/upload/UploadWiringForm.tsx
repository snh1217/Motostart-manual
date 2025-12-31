"use client";

import { useEffect, useState } from "react";

type UploadResult = {
  id: string;
  file: string;
};

type UploadWiringFormProps = {
  readOnly?: boolean;
};

export default function UploadWiringForm({
  readOnly = false,
}: UploadWiringFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [entryId, setEntryId] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

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
      setMessage("PDF 또는 이미지 파일을 선택해 주세요.");
      return;
    }

    if (!model.trim()) {
      setStatus("error");
      setMessage("모델명을 입력해 주세요. 예: 350D");
      return;
    }

    if (!title.trim()) {
      setStatus("error");
      setMessage("회로도 제목을 입력해 주세요.");
      return;
    }

    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("관리자 토큰을 입력해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", model);
    formData.append("title", title);
    formData.append("tags", tags);
    formData.append("note", note);
    formData.append("id", entryId);

    try {
      localStorage.setItem("ADMIN_TOKEN", adminToken);
      const response = await fetch("/api/wiring/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "업로드 실패");
      }

      setStatus("success");
      setResult({ id: data.id, file: data.file });
      setMessage("회로도가 추가되었습니다.");
      setFile(null);
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "업로드 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="text"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="모델명 (예: 350D)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="회로도 제목 (예: Starting / Ignition)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="태그 (쉼표로 구분)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="text"
          value={entryId}
          onChange={(event) => setEntryId(event.target.value)}
          placeholder="ID (선택, 비워두면 자동 생성)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="설명 (선택)"
        className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        disabled={readOnly}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="관리자코드"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
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
          {result ? ` (ID: ${result.id})` : ""}
        </div>
      ) : null}
    </form>
  );
}
