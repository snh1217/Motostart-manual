"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function PartUploadForm() {
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoModel, setPhotoModel] = useState("368G");
  const [photoPartId, setPhotoPartId] = useState("part-demo");
  const [photoResult, setPhotoResult] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (adminToken) localStorage.setItem("ADMIN_TOKEN", adminToken);
  }, [adminToken]);

  const uploadData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus("error");
      setMessage("CSV/XLSX 파일을 선택해 주세요.");
      return;
    }
    setStatus("loading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parts/import", {
        method: "POST",
        headers: {
          Authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "업로드 실패");
      setStatus("success");
      setMessage(
        `가져오기 완료: 추가 ${data.imported ?? 0} / 건너뜀 ${data.skipped ?? 0} / 총 ${data.total ?? ""}`
      );
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "업로드 중 오류");
    }
  };
  const downloadTemplate = () => {
    const header = [
      "model",
      "name",
      "system",
      "summary",
      "tags",
      "photo_url",
      "photo_label",
      "photo_desc",
      "step_order",
      "step_title",
      "step_desc",
      "step_tools",
      "step_torque",
      "step_note",
    ];
    const sample = [
      "368G",
      "샘플 부품",
      "engine",
      "요약 예시",
      "릴레이,전장",
      "https://example.com/photo.jpg",
      "사진 라벨",
      "사진 설명",
      "1",
      "1단계 제목",
      "1단계 설명",
      "공구 예시",
      "10 N·m",
      "비고 예시",
    ];
    const csv = [header, sample]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return text.includes(",") || text.includes("\n") || text.includes("\"")
              ? `"${text.replace(/\"/g, "\"\"")}"`
              : text;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "parts_template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const uploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      setMessage("사진 파일을 선택해 주세요.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setMessage("");
    const formData = new FormData();
    formData.append("file", photoFile);
    formData.append("model", photoModel);
    formData.append("partId", photoPartId);

    try {
      const res = await fetch("/api/parts/upload", {
        method: "POST",
        headers: {
          Authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "업로드 실패");
      setStatus("success");
      setPhotoResult(data.url ?? data.path ?? null);
      setMessage("사진 업로드 완료: URL을 복사해 CSV에 기입하세요.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "업로드 중 오류");
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">관리자 업로드</h2>
        <input
          type="password"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          className="w-48 rounded-lg border border-slate-200 px-3 py-1 text-xs"
        />
      </div>

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          엑셀/CSV 업로드
        </summary>
        <div className="mt-3 space-y-3">
          <form onSubmit={uploadData} className="space-y-3">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                양식 다운로드
              </button>
              <button
                type="submit"
                disabled={status === "loading"}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {status === "loading" ? "업로드 중..." : "CSV/XLSX 업로드"}
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              지원 컬럼 예시: model, name(part), system, summary, tags, photo_url,
              photo_label
            </p>
            <p>step_order, step_title, step_desc, step_tools, step_torque, step_note</p>
            <p>같은 부품 이름/모델을 가진 행을 묶어 사진과 단계를 병합합니다.</p>
          </div>
        </div>
      </details>

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          사진 업로드 (Supabase Storage)
        </summary>
        <div className="mt-3 space-y-2">
          <form onSubmit={uploadPhoto} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={photoModel}
                onChange={(e) => setPhotoModel(e.target.value)}
                placeholder="모델 (예: 368G)"
                className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={photoPartId}
                onChange={(e) => setPhotoPartId(e.target.value)}
                placeholder="부품 ID"
                className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
            >
              {status === "loading" ? "업로드 중..." : "사진 업로드"}
            </button>
            {photoResult ? (
              <div className="text-xs text-slate-600">
                업로드 URL:{" "}
                <a href={photoResult} className="text-slate-800 underline" target="_blank">
                  {photoResult}
                </a>
              </div>
            ) : null}
          </form>
        </div>
      </details>

      {message ? (
        <div
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
