"use client";

import { useEffect, useMemo, useState } from "react";

type RowError = {
  row: number;
  field: string;
  message: string;
  value?: string;
};

type PreviewResult = {
  total: number;
  models: string[];
  missingRequired: string[];
  errors: RowError[];
  warnings: string[];
};

type UploadResult = {
  imported: number;
  total: number;
  failed?: number;
  warnings?: string[];
  errorCsv?: string;
  models?: string[];
};

type UploadFormProps = {
  readOnly?: boolean;
  selectedModel: string;
};

const downloadCsv = (content: string, filename: string) => {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function UploadForm({ readOnly = false, selectedModel }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [applyDefaultModel, setApplyDefaultModel] = useState(true);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [previewMessage, setPreviewMessage] = useState("");

  const modelSelected = selectedModel !== "all";

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (adminToken) localStorage.setItem("ADMIN_TOKEN", adminToken);
  }, [adminToken]);

  useEffect(() => {
    setApplyDefaultModel(modelSelected);
  }, [modelSelected]);

  const canPreview = Boolean(file && adminToken.trim() && modelSelected && !readOnly);
  const isUploadDisabled = useMemo(() => {
    if (readOnly) return true;
    if (!file) return true;
    if (!adminToken.trim()) return true;
    if (!modelSelected) return true;
    if (preview?.missingRequired?.length) return true;
    return status === "loading";
  }, [readOnly, file, adminToken, modelSelected, preview, status]);

  const runPreview = async () => {
    if (!canPreview || !file) return;
    setPreviewStatus("loading");
    setPreviewMessage("");
    setPreview(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("defaultModel", selectedModel);
    formData.append("applyDefaultModel", applyDefaultModel ? "1" : "0");

    try {
      const response = await fetch("/api/cases/preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "미리보기 실패");
      }
      setPreview(data as PreviewResult);
      setPreviewStatus("ready");
    } catch (error) {
      setPreviewStatus("error");
      setPreviewMessage(
        error instanceof Error ? error.message : "미리보기 중 오류가 발생했습니다."
      );
    }
  };

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setPreviewStatus("idle");
      return;
    }
    if (canPreview) {
      void runPreview();
    }
  }, [file, applyDefaultModel, selectedModel, adminToken, readOnly]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 업로드할 수 없습니다.");
      return;
    }

    if (!modelSelected) {
      setStatus("error");
      setMessage("상단에서 모델을 선택한 뒤 업로드해 주세요.");
      return;
    }

    if (!file) {
      setStatus("error");
      setMessage("파일을 선택해 주세요.");
      return;
    }

    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("관리자 코드를 입력해 주세요.");
      return;
    }

    if (preview?.missingRequired?.length) {
      setStatus("error");
      setMessage("필수 컬럼 누락을 먼저 해결해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("defaultModel", selectedModel);
    formData.append("applyDefaultModel", applyDefaultModel ? "1" : "0");

    try {
      const response = await fetch("/api/cases/import", {
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
      setResult(data as UploadResult);
      setMessage("업로드가 완료되었습니다.");
      setFile(null);
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          type="file"
          accept=".csv,.xlsx"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          disabled={readOnly || !modelSelected}
        />
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={applyDefaultModel}
            onChange={(event) => setApplyDefaultModel(event.target.checked)}
            disabled={!modelSelected}
          />
          현재 선택된 모델을 기본값으로 적용
          <span className="text-xs text-slate-400">
            (파일의 model 값이 비어있을 때만 적용)
          </span>
        </label>
        {!modelSelected ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            상단에서 모델을 선택하면 업로드를 진행할 수 있습니다.
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={!canPreview}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
          >
            {previewStatus === "loading" ? "미리보기 중..." : "미리보기"}
          </button>
          <button
            type="submit"
            disabled={isUploadDisabled}
            className="min-w-[72px] whitespace-nowrap rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {status === "loading" ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </div>

      {previewStatus === "ready" && preview ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="font-semibold text-slate-700">업로드 미리보기</div>
          <div className="mt-2 space-y-1 text-xs">
            <div>총 {preview.total}행</div>
            <div>모델: {preview.models.length ? preview.models.join(", ") : "-"}</div>
            {preview.missingRequired.length ? (
              <div className="text-rose-600">
                필수 컬럼 누락: {preview.missingRequired.join(", ")}
              </div>
            ) : (
              <div className="text-emerald-600">필수 컬럼 OK</div>
            )}
            {preview.errors.length ? (
              <div className="text-rose-600">
                오류 {preview.errors.length}건 (예시):
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[11px]">
                  {preview.errors.slice(0, 5).map((err, idx) => (
                    <li key={`${err.row}-${err.field}-${idx}`}>
                      {err.row}행 {err.field}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview.warnings.length ? (
              <div className="text-amber-600">
                경고: {preview.warnings.join(" / ")}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {previewStatus === "error" && previewMessage ? (
        <div className="text-sm text-rose-600">{previewMessage}</div>
      ) : null}

      {message ? (
        <div
          className={`text-sm ${
            status === "error" ? "text-rose-600" : "text-slate-600"
          }`}
        >
          {message}
          {result ? (
            <span>
              {" "}
              (추가 {result.imported}건 / 실패 {result.failed ?? 0}건 / 총{" "}
              {result.total}건)
            </span>
          ) : null}
        </div>
      ) : null}

      {result?.errorCsv ? (
        <button
          type="button"
          onClick={() => downloadCsv(result.errorCsv ?? "", "cases_error_report.csv")}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          실패 행 리포트 다운로드
        </button>
      ) : null}

      {result?.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {result.warnings.join(" / ")}
        </div>
      ) : null}

      {status === "success" && result ? (
        <a
          href={`/cases?model=${encodeURIComponent(
            result.models?.length === 1 ? result.models[0] : selectedModel
          )}&system=all`}
          className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          등록된 사례 보기
        </a>
      ) : null}
    </form>
  );
}
