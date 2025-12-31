"use client";

import { useEffect, useState } from "react";

type UploadResult = {
  imported: number;
  total: number;
};

type UploadFormProps = {
  readOnly?: boolean;
};

export default function UploadForm({ readOnly = false }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [adminToken, setAdminToken] = useState("");

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
      setMessage("파일을 선택해 주세요.");
      return;
    }

    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("관리자코드를 입력해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      localStorage.setItem("ADMIN_TOKEN", adminToken);
      const response = await fetch("/api/translations/import", {
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
      setResult({ imported: data.imported, total: data.total });
      setMessage("업로드가 완료되었습니다.");
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3">
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="관리자코드"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            disabled={readOnly}
          />
          <button
            type="submit"
            disabled={status === "loading" || readOnly}
            className="min-w-[72px] whitespace-nowrap rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {status === "loading" ? "업로드 중..." : "업로드"}
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
          {result ? ` (추가 ${result.imported}건 / 총 ${result.total}건)` : ""}
        </div>
      ) : null}
    </form>
  );
}
