"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiagnosticEntry, DiagnosticLine, ModelCode } from "../../lib/types";

type AdminFormProps = {
  readOnly: boolean;
  saveTargetLabel?: string;
  initialEntry?: DiagnosticEntry | null;
  selectedModel?: string;
};

const defaultImage = "/diagnostics/placeholder.png";

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildId = (model: string, title: string) => {
  const modelSlug = normalizeSlug(model);
  const titleSlug = normalizeSlug(title);
  if (!modelSlug || !titleSlug) {
    return `diag-${Date.now()}`;
  }
  return `diag-${modelSlug}-${titleSlug}-${Date.now()}`;
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
};

export default function DiagnosticsAdminForm({
  readOnly,
  saveTargetLabel,
  initialEntry,
  selectedModel,
}: AdminFormProps) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [id, setId] = useState("");
  const [model, setModel] = useState<ModelCode>("368G");
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [image, setImage] = useState(defaultImage);
  const [imagePreview, setImagePreview] = useState("");
  const [videoColdUrl, setVideoColdUrl] = useState("");
  const [videoColdPreview, setVideoColdPreview] = useState("");
  const [videoHotUrl, setVideoHotUrl] = useState("");
  const [videoHotPreview, setVideoHotPreview] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DiagnosticLine[]>([
    { label: "항목", value: "값" },
  ]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);

  const isEditing = Boolean(initialEntry?.id);

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (initialEntry) {
      setId(initialEntry.id ?? "");
      setModel(initialEntry.model ?? "368G");
      setTitle(initialEntry.title ?? "");
      setSection(initialEntry.section ?? "");
      setImage(initialEntry.image ?? defaultImage);
      setVideoColdUrl(initialEntry.video_cold_url ?? "");
      setVideoHotUrl(initialEntry.video_hot_url ?? "");
      setNote(initialEntry.note ?? "");
      setLines(initialEntry.lines?.length ? initialEntry.lines : [{ label: "항목", value: "값" }]);
      setImagePreview("");
      setVideoColdPreview("");
      setVideoHotPreview("");
      return;
    }
    if (selectedModel && selectedModel !== "all") {
      setModel(selectedModel as ModelCode);
    }
  }, [initialEntry, selectedModel]);

  useEffect(() => {
    if (!isEditing) {
      setId(buildId(model, title));
    }
  }, [model, title, isEditing]);

  const modelLabel = useMemo(
    () => (selectedModel && selectedModel !== "all" ? selectedModel : model),
    [model, selectedModel]
  );
  const isModelLocked = Boolean(selectedModel && selectedModel !== "all");

  const updateLine = (idx: number, key: keyof DiagnosticLine, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, [key]: value } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, { label: "", value: "" }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    const nextModel =
      selectedModel && selectedModel !== "all" ? (selectedModel as ModelCode) : "368G";
    setId(buildId(nextModel, ""));
    setModel(nextModel);
    setTitle("");
    setSection("");
    setImage(defaultImage);
    setImagePreview("");
    setVideoColdUrl("");
    setVideoColdPreview("");
    setVideoHotUrl("");
    setVideoHotPreview("");
    setNote("");
    setLines([{ label: "항목", value: "값" }]);
  };

  const uploadFile = async (file: File) => {
    const prep = await fetch("/api/diagnostics/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: adminToken ? `Bearer ${adminToken}` : "",
      },
      body: JSON.stringify({
        model,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    });

    const prepData = await parseJsonResponse(prep);
    if (!prep.ok) {
      throw new Error((prepData?.error as string) ?? "업로드 준비 실패");
    }

    const signedUrl = prepData?.signedUrl as string | undefined;
    const publicUrl = prepData?.publicUrl as string | undefined;
    const contentType = (prepData?.contentType as string) ?? file.type;
    if (!signedUrl || !publicUrl) {
      throw new Error("업로드 URL을 가져오지 못했습니다.");
    }

    const uploadRes = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error("스토리지 업로드에 실패했습니다.");
    }

    return publicUrl;
  };

  const handleImageUpload = async (file?: File | null) => {
    if (!file) return;
    try {
      setImageUploading(true);
      setMessage("");
      const url = await uploadFile(file);
      setImage(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드 실패");
      setStatus("error");
    } finally {
      setImageUploading(false);
    }
  };

  const handleVideoUpload = async (
    file?: File | null,
    target?: "cold" | "hot"
  ) => {
    if (!file) return;
    try {
      setVideoUploading(true);
      setMessage("");
      const url = await uploadFile(file);
      if (target === "hot") {
        setVideoHotUrl(url);
      } else {
        setVideoColdUrl(url);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "동영상 업로드 실패");
      setStatus("error");
    } finally {
      setVideoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드입니다.");
      return;
    }
    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("관리자 로그인 상태를 확인해 주세요.");
      return;
    }
    if (!model.trim() || !title.trim() || !image.trim()) {
      setStatus("error");
      setMessage("필수 항목을 입력하세요.");
      return;
    }

    const payload = {
      id: id.trim(),
      model,
      title: title.trim(),
      section: section.trim() || undefined,
      image: image.trim(),
      video_cold_url: videoColdUrl.trim() || undefined,
      video_hot_url: videoHotUrl.trim() || undefined,
      note: note.trim() || undefined,
      lines: lines.filter((l) => l.label && l.value),
    };

    try {
      setStatus("loading");
      setMessage("");
      localStorage.setItem("ADMIN_TOKEN", adminToken);
      const res = await fetch("/api/diagnostics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data?.error as string) ?? "저장 실패");
      const target = saveTargetLabel ?? "저장소";
      setStatus("success");
      setMessage(`${target}에 저장되었습니다.`);
      resetForm();
      router.refresh();
      if (isEditing) {
        router.replace(`/diagnostics?model=${encodeURIComponent(modelLabel)}`);
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "오류가 발생했습니다.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${readOnly ? "opacity-60" : ""}`}>
      {readOnly ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          현재 환경에서는 저장이 비활성화되어 있습니다.
        </p>
      ) : null}

      {isEditing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          편집 중: {initialEntry?.title}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {isModelLocked ? (
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            모델: {modelLabel}
          </div>
        ) : (
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={model}
            onChange={(e) => setModel(e.target.value as ModelCode)}
            disabled={readOnly}
          >
            <option value="125C">125C</option>
            <option value="125D">125D</option>
            <option value="125E">125E</option>
            <option value="125M">125M</option>
            <option value="310M">310M</option>
            <option value="350D">350D</option>
            <option value="350GK">350GK</option>
            <option value="368E">368E</option>
            <option value="368G">368G</option>
          </select>
        )}
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={readOnly}
        />
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="섹션 (선택)"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          disabled={readOnly}
        />
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="이미지 URL (직접 입력 가능)"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          disabled={readOnly}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600">사진 업로드</div>
          <input
            type="file"
            accept="image/*"
            disabled={readOnly || imageUploading}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) {
                setImagePreview(URL.createObjectURL(file));
                handleImageUpload(file);
              }
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <img
              src={imagePreview || image}
              alt="진단기 이미지"
              className="h-40 w-full rounded-md object-contain bg-slate-100"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600">동영상 업로드 (냉간시)</div>
          <input
            type="file"
            accept="video/*"
            disabled={readOnly || videoUploading}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) {
                setVideoColdPreview(URL.createObjectURL(file));
                handleVideoUpload(file, "cold");
              }
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="냉간시 URL (직접 입력 가능)"
            value={videoColdUrl}
            onChange={(e) => setVideoColdUrl(e.target.value)}
            disabled={readOnly}
          />
          {videoColdPreview || videoColdUrl ? (
            <video
              src={videoColdPreview || videoColdUrl}
              controls
              className="h-40 w-full rounded-md bg-slate-100"
            />
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600">동영상 업로드 (열간시)</div>
          <input
            type="file"
            accept="video/*"
            disabled={readOnly || videoUploading}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) {
                setVideoHotPreview(URL.createObjectURL(file));
                handleVideoUpload(file, "hot");
              }
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="열간시 URL (직접 입력 가능)"
            value={videoHotUrl}
            onChange={(e) => setVideoHotUrl(e.target.value)}
            disabled={readOnly}
          />
          {videoHotPreview || videoHotUrl ? (
            <video
              src={videoHotPreview || videoHotUrl}
              controls
              className="h-40 w-full rounded-md bg-slate-100"
            />
          ) : null}
        </div>
      </div>

      <textarea
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        placeholder="비고 (선택)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        disabled={readOnly}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">라인</h3>
          <button
            type="button"
            onClick={addLine}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
            disabled={readOnly}
          >
            라인 추가
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-3 md:items-center">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="라벨"
                value={line.label}
                onChange={(e) => updateLine(idx, "label", e.target.value)}
                disabled={readOnly}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="값"
                value={line.value}
                onChange={(e) => updateLine(idx, "value", e.target.value)}
                disabled={readOnly}
              />
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="비고 (선택)"
                  value={line.note ?? ""}
                  onChange={(e) => updateLine(idx, "note", e.target.value)}
                  disabled={readOnly}
                />
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-500"
                  disabled={readOnly || lines.length <= 1}
                  aria-label="라인 삭제"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={status === "loading" || readOnly}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "loading" ? "저장 중..." : "저장"}
        </button>
      </div>

      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-slate-600"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
