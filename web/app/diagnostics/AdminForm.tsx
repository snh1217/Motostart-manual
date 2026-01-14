"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiagnosticEntry, DiagnosticLine, ModelCode } from "../../lib/types";

type AdminFormProps = {
  readOnly: boolean;
  saveTargetLabel?: string;
  initialEntry?: DiagnosticEntry | null;
  selectedModel?: string;
  onSaved?: () => void;
  onCancel?: () => void;
};

type ImageSlot = {
  url: string;
  preview: string;
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

const normalizeLine = (line: Partial<DiagnosticLine> & Record<string, unknown>): DiagnosticLine => {
  const source =
    typeof line.source === "string"
      ? line.source
      : typeof line.label === "string"
        ? line.label
        : "";
  const translation = typeof line.translation === "string" ? line.translation : "";
  const data =
    typeof line.data === "string"
      ? line.data
      : typeof line.value === "string"
        ? line.value
        : "";
  const analysis = typeof line.analysis === "string" ? line.analysis : "";
  const note = typeof line.note === "string" ? line.note : "";

  return { source, translation, data, analysis, note };
};

export default function DiagnosticsAdminForm({
  readOnly,
  saveTargetLabel,
  initialEntry,
  selectedModel,
  onSaved,
  onCancel,
}: AdminFormProps) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [id, setId] = useState("");
  const [model, setModel] = useState<ModelCode>("368G");
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [images, setImages] = useState<ImageSlot[]>([{ url: "", preview: "" }]);
  const [videoColdUrl, setVideoColdUrl] = useState("");
  const [videoColdPreview, setVideoColdPreview] = useState("");
  const [videoHotUrl, setVideoHotUrl] = useState("");
  const [videoHotPreview, setVideoHotPreview] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DiagnosticLine[]>([
    { source: "", translation: "", data: "", analysis: "", note: "" },
  ]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [ocrLoadingIndex, setOcrLoadingIndex] = useState<number | null>(null);
  const [ocrMessage, setOcrMessage] = useState("");

  const isEditing = Boolean(initialEntry?.id);

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (initialEntry) {
      const legacyVideo = (initialEntry as { video_url?: string })?.video_url ?? "";
      const initialImages = Array.isArray(initialEntry.images)
        ? initialEntry.images
        : initialEntry.image
          ? [initialEntry.image]
          : [];
      setId(initialEntry.id ?? "");
      setModel(initialEntry.model ?? "368G");
      setTitle(initialEntry.title ?? "");
      setSection(initialEntry.section ?? "");
      setImages(
        initialImages.length
          ? initialImages.map((url) => ({ url, preview: "" }))
          : [{ url: "", preview: "" }]
      );
      const coldVideo = initialEntry.video_cold_url ?? "";
      const hotVideo = initialEntry.video_hot_url ?? "";
      setVideoColdUrl(coldVideo || (hotVideo ? "" : legacyVideo));
      setVideoHotUrl(hotVideo);
      setNote(initialEntry.note ?? "");
      setLines(
        initialEntry.lines?.length
          ? initialEntry.lines.map((line) => normalizeLine(line as DiagnosticLine))
          : [{ source: "", translation: "", data: "", analysis: "", note: "" }]
      );
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

  const addLine = () =>
    setLines((prev) => [...prev, { source: "", translation: "", data: "", analysis: "", note: "" }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const updateImageSlot = (idx: number, payload: Partial<ImageSlot>) => {
    setImages((prev) =>
      prev.map((slot, index) => (index === idx ? { ...slot, ...payload } : slot))
    );
  };

  const addImageSlot = () => setImages((prev) => [...prev, { url: "", preview: "" }]);
  const removeImageSlot = (idx: number) => {
    setImages((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, index) => index !== idx);
    });
  };

  const resetForm = () => {
    const nextModel =
      selectedModel && selectedModel !== "all" ? (selectedModel as ModelCode) : "368G";
    setId(buildId(nextModel, ""));
    setModel(nextModel);
    setTitle("");
    setSection("");
    setImages([{ url: "", preview: "" }]);
    setVideoColdUrl("");
    setVideoColdPreview("");
    setVideoHotUrl("");
    setVideoHotPreview("");
    setNote("");
    setLines([{ source: "", translation: "", data: "", analysis: "", note: "" }]);
  };

  const applyOcrText = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").replace(/[|]/g, "").trim())
      .filter((line) => line.length >= 2)
      .filter((line) => /[A-Za-z0-9]/.test(line))
      .filter((line) => !/^data\s*\(\d+\s*\/\s*\d+\)/i.test(line))
      .filter((line) => !/^XCM-PT/i.test(line));
    const extracted: DiagnosticLine[] = rows.map((line) => {
      const colonIndex = Math.max(line.lastIndexOf(":"), line.lastIndexOf("："));
      if (colonIndex > 0) {
        const source = line.slice(0, colonIndex).trim();
        return {
          source,
          translation: "",
          data: line.slice(colonIndex + 1).trim(),
          analysis: "",
          note: "",
        };
      }
      const spaced = line.split(/\s{2,}/).filter(Boolean);
      if (spaced.length > 1) {
        const source = spaced.shift() ?? "";
        return {
          source: source.trim(),
          translation: "",
          data: spaced.join(" ").trim(),
          analysis: "",
          note: "",
        };
      }
      return { source: line, translation: "", data: "", analysis: "", note: "" };
    });

    setLines((prev) => {
      const isEmpty =
        prev.length === 1 &&
        !prev[0].source &&
        !prev[0].translation &&
        !prev[0].data &&
        !prev[0].analysis &&
        !prev[0].note;
      return isEmpty ? extracted : [...prev, ...extracted];
    });
  };

  const preprocessImage = async (src: string) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return src;

    const cropLeft = Math.floor(width * 0.08);
    const cropRight = Math.floor(width * 0.08);
    const cropTop = Math.floor(height * 0.2);
    const cropBottom = Math.floor(height * 0.15);
    const cropWidth = Math.max(1, width - cropLeft - cropRight);
    const cropHeight = Math.max(1, height - cropTop - cropBottom);

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.filter = "grayscale(1) contrast(1.6) brightness(1.1)";
    ctx.drawImage(image, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return canvas.toDataURL("image/png");
  };

  const runOcrForSlot = async (slot: ImageSlot, index: number) => {
    const src = slot.preview || slot.url;
    if (!src) {
      setOcrMessage("텍스트 추출할 사진을 먼저 선택하세요.");
      return;
    }
    try {
      setOcrLoadingIndex(index);
      setOcrMessage("텍스트 추출 중입니다...");
      const { createWorker } = await import("tesseract.js");
      const processed = await preprocessImage(src);
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: 6,
        user_defined_dpi: "300",
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_./%:+- ",
        preserve_interword_spaces: "1",
      });
      const result = await worker.recognize(processed);
      await worker.terminate();
      const text = result?.data?.text ?? "";
      if (!text.trim()) {
        setOcrMessage("추출된 텍스트가 없습니다.");
        return;
      }
      applyOcrText(text);
      setOcrMessage("텍스트 추출 완료.");
    } catch (error) {
      setOcrMessage(error instanceof Error ? error.message : "텍스트 추출 실패");
    } finally {
      setOcrLoadingIndex(null);
    }
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
      throw new Error((prepData?.error as string) ?? "업로드 준비에 실패했습니다.");
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
      const errorText = await uploadRes.text().catch(() => "");
      throw new Error(errorText ? `스토리지 업로드 실패: ${errorText}` : "스토리지 업로드에 실패했습니다.");
    }

    return publicUrl;
  };

  const handleImageUpload = async (file?: File | null, targetIndex?: number) => {
    if (!file || targetIndex === undefined) return;
    try {
      setImageUploading(true);
      setMessage("");
      const url = await uploadFile(file);
      updateImageSlot(targetIndex, { url });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드 실패");
      setStatus("error");
    } finally {
      setImageUploading(false);
    }
  };

  const handleVideoUpload = async (file?: File | null, target?: "cold" | "hot") => {
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

    const cleanedImages = images.map((slot) => slot.url.trim()).filter(Boolean);
    if (!model.trim() || !title.trim() || cleanedImages.length === 0) {
      setStatus("error");
      setMessage("필수 항목을 입력해 주세요.");
      return;
    }

    const payload: DiagnosticEntry = {
      id: id.trim(),
      model,
      title: title.trim(),
      section: section.trim() || undefined,
      image: cleanedImages[0],
      images: cleanedImages.length ? cleanedImages : undefined,
      video_cold_url: videoColdUrl.trim() || undefined,
      video_hot_url: videoHotUrl.trim() || undefined,
      note: note.trim() || undefined,
      lines: lines
        .map((line) => normalizeLine(line))
        .filter((line) => line.source && line.data),
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
      onSaved?.();
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
          현재 운영에서 저장이 비활성화되어 있습니다.
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
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-600">사진 업로드</div>
          <button
            type="button"
            onClick={addImageSlot}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
            disabled={readOnly || imageUploading}
          >
            사진 추가
          </button>
        </div>
        <div className="space-y-3">
          {images.map((slot, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                사진 {idx + 1}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runOcrForSlot(slot, idx)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
                    disabled={readOnly || imageUploading || ocrLoadingIndex === idx}
                  >
                    {ocrLoadingIndex === idx ? "추출 중..." : "텍스트 추출"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImageSlot(idx)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500"
                    disabled={readOnly || images.length <= 1}
                  >
                    제거
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_160px]">
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={readOnly || imageUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) {
                        updateImageSlot(idx, { preview: URL.createObjectURL(file) });
                        handleImageUpload(file, idx);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="사진 URL (직접 입력 가능)"
                    value={slot.url}
                    onChange={(e) => updateImageSlot(idx, { url: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <img
                    src={slot.preview || slot.url || defaultImage}
                    alt={`진단기 사진 ${idx + 1}`}
                    className="h-32 w-full rounded-md object-contain"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {ocrMessage ? <p className="text-xs text-slate-500">{ocrMessage}</p> : null}
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
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-5 md:items-center">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="원문 항목"
                value={line.source}
                onChange={(e) => updateLine(idx, "source", e.target.value)}
                disabled={readOnly}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="번역 항목"
                value={line.translation ?? ""}
                onChange={(e) => updateLine(idx, "translation", e.target.value)}
                disabled={readOnly}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="데이터"
                value={line.data}
                onChange={(e) => updateLine(idx, "data", e.target.value)}
                disabled={readOnly}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="데이터 분석"
                value={line.analysis ?? ""}
                onChange={(e) => updateLine(idx, "analysis", e.target.value)}
                disabled={readOnly}
              />
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="비고"
                  value={line.note ?? ""}
                  onChange={(e) => updateLine(idx, "note", e.target.value)}
                  disabled={readOnly}
                />
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-500"
                  disabled={readOnly || lines.length <= 1}
                  aria-label="라인 제거"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={status === "loading" || readOnly}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "loading" ? "저장 중..." : "저장"}
        </button>
        {isEditing ? (
          <button
            type="button"
            onClick={() => {
              resetForm();
              onCancel?.();
              router.replace(`/diagnostics?model=${encodeURIComponent(modelLabel)}`);
            }}
            disabled={status === "loading"}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            수정 취소
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-slate-600"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
