"use client";

import { useEffect, useMemo, useState } from "react";
import type { PartEntry, PartPhoto, PartStep } from "../../lib/types";
import { useRouter } from "next/navigation";

type Status = "idle" | "loading" | "success" | "error";

const systems = [
  { id: "engine", label: "엔진" },
  { id: "chassis", label: "차체" },
  { id: "electrical", label: "전장" },
  { id: "other", label: "기타" },
];

const emptyPhoto = (): PartPhoto => ({ id: "", url: "", label: "", tags: [], desc: "" });
const emptyStep = (): PartStep => ({
  order: 1,
  title: "",
  desc: "",
  tools: "",
  torque: "",
  note: "",
  photoIds: [],
});

export default function PartAdminPanel({
  initialEntry,
}: {
  initialEntry?: PartEntry | null;
}) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const isEditing = Boolean(initialEntry?.id);

  const [form, setForm] = useState<PartEntry>({
    id: "",
    model: "368G",
    system: "engine",
    name: "",
    summary: "",
    tags: [],
    photos: [],
    steps: [],
  });

  const autoId = useMemo(() => {
    const model = String(form.model ?? "").trim().toLowerCase();
    const system = String(form.system ?? "").trim().toLowerCase();
    const name = String(form.name ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const base = ["part", model, system, name].filter(Boolean).join("-");
    return base || `part-${Date.now()}`;
  }, [form.model, form.system, form.name]);

  // 사진 업로드 상태
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const [expandedPreviews, setExpandedPreviews] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (adminToken) localStorage.setItem("ADMIN_TOKEN", adminToken);
  }, [adminToken]);

  useEffect(() => {
    if (!initialEntry) return;
    setForm({
      id: initialEntry.id ?? "",
      model: initialEntry.model ?? "368G",
      system: initialEntry.system ?? "engine",
      name: initialEntry.name ?? "",
      summary: initialEntry.summary ?? "",
      tags: initialEntry.tags ?? [],
      photos: initialEntry.photos ?? [],
      steps: initialEntry.steps ?? [],
    });
    setUploadMessage("");
    setUploadErrors({});
    setPreviewUrls({});
    setExpandedPreviews({});
  }, [initialEntry]);

  const updatePhoto = (idx: number, key: keyof PartPhoto, value: string | string[]) => {
    setForm((prev) => {
      const photos = [...(prev.photos ?? [])];
      photos[idx] = { ...photos[idx], [key]: value } as PartPhoto;
      return { ...prev, photos };
    });
  };

  const addPhoto = () => {
    setForm((prev) => ({ ...prev, photos: [...(prev.photos ?? []), emptyPhoto()] }));
  };

  const removePhoto = (idx: number) => {
    setForm((prev) => {
      const photos = [...(prev.photos ?? [])];
      photos.splice(idx, 1);
      return { ...prev, photos };
    });
  };

  const updateStep = (idx: number, key: keyof PartStep, value: string | number | string[]) => {
    setForm((prev) => {
      const steps = [...(prev.steps ?? [])];
      steps[idx] = { ...steps[idx], [key]: value } as PartStep;
      return { ...prev, steps };
    });
  };

  const toggleStepPhotoId = (stepIndex: number, photoId: string) => {
    setForm((prev) => {
      const steps = [...(prev.steps ?? [])];
      const step = steps[stepIndex];
      if (!step) return prev;
      const current = new Set(step.photoIds ?? []);
      if (current.has(photoId)) {
        current.delete(photoId);
      } else {
        current.add(photoId);
      }
      steps[stepIndex] = { ...step, photoIds: Array.from(current) };
      return { ...prev, steps };
    });
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [...(prev.steps ?? []), { ...emptyStep(), order: (prev.steps?.length ?? 0) + 1 }],
    }));
  };

  const removeStep = (idx: number) => {
    setForm((prev) => {
      const steps = [...(prev.steps ?? [])];
      steps.splice(idx, 1);
      return { ...prev, steps };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const cleanedPhotos = (form.photos ?? [])
      .filter(
        (ph) => ph.url || ph.label || ph.id || ((ph.tags as string[])?.length ?? 0) > 0
      )
      .map((ph, i) => ({
        ...ph,
        id: `ph-${i + 1}`,
        tags: (ph.tags as string[])?.filter(Boolean) ?? [],
      }));

    const cleanedSteps = (form.steps ?? [])
      .filter(
        (st) =>
          st.title ||
          st.desc ||
          st.tools ||
          st.torque ||
          st.note ||
          (st.photoIds?.length ?? 0) > 0
      )
      .map((st, i) => ({
        ...st,
        order: Number(st.order) || i + 1,
        photoIds: st.photoIds ?? [],
      }));

    const payload: PartEntry = {
      ...form,
      id: form.id?.trim() || `${autoId}-${Date.now()}`,
      tags: form.tags?.filter(Boolean) ?? [],
      photos: cleanedPhotos,
      steps: cleanedSteps,
    };

    try {
      const res = await fetch("/api/parts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "저장 실패");
      setStatus("success");
      setMessage(`저장 완료 (${data.source ?? "local"})`);
      setForm({
        id: "",
        model: "368G",
        system: "engine",
        name: "",
        summary: "",
        tags: [],
        photos: [],
        steps: [],
      });
      setUploadMessage("");
      setUploadErrors({});
      setPreviewUrls({});
      setExpandedPreviews({});
      if (isEditing) {
        router.replace("/parts");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "저장 오류");
    }
  };

  const handlePhotoUpload = async (file: File | null, targetIdx?: number) => {
    if (!file) return;
    if (typeof targetIdx === "number") {
      const localUrl = URL.createObjectURL(file);
      setPreviewUrls((prev) => ({ ...prev, [targetIdx]: localUrl }));
      setUploadErrors((prev) => {
        const next = { ...prev };
        delete next[targetIdx];
        return next;
      });
    }
    setUploadingIndex(typeof targetIdx === "number" ? targetIdx : null);
    setUploading(true);
    setUploadMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", form.model);
      formData.append("partId", form.id || "part");

      const res = await fetch("/api/parts/upload", {
        method: "POST",
        headers: {
          Authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "업로드 실패");
      // 업로드된 URL을 해당 사진에 채웁니다.
      setForm((prev) => {
        const photos = [...(prev.photos ?? [])];
        let nextIndex = typeof targetIdx === "number" ? targetIdx : -1;
        if (nextIndex < 0) {
          nextIndex = photos.findIndex((p) => !p.url);
        }
        if (nextIndex >= 0) {
          photos[nextIndex] = { ...photos[nextIndex], url: data.url ?? data.path ?? "" };
        } else {
          photos.push({
            id: `ph-${photos.length + 1}`,
            url: data.url ?? data.path ?? "",
            label: "",
            tags: [],
          });
        }
        return { ...prev, photos };
      });
      setUploadMessage("사진 업로드 완료: URL이 입력되었습니다.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "업로드 오류";
      if (typeof targetIdx === "number") {
        setUploadErrors((prev) => ({ ...prev, [targetIdx]: errorMessage }));
      } else {
        setUploadMessage(errorMessage);
      }
    } finally {
      setUploading(false);
      setUploadingIndex(null);
    }
  };

  const photoCount = form.photos?.length ?? 0;
  const stepCount = form.steps?.length ?? 0;
  const photoOptions = (form.photos ?? []).map((photo, index) => ({
    id: photo.id?.trim() || `ph-${index + 1}`,
    name: photo.label?.trim() || `사진 ${index + 1}`,
    url: photo.url,
  }));

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">부품 직접 입력</h2>
          <p className="text-xs text-slate-500">
            기본 정보만 입력해도 저장됩니다. 상세 정보가 필요할 때만 펼쳐주세요.
          </p>
        </div>
        <input
          type="password"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          className="w-48 rounded-lg border border-slate-200 px-3 py-1 text-sm"
        />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {isEditing ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span>편집 중: {initialEntry?.id}</span>
            <button
              type="button"
              onClick={() => router.replace("/parts")}
              className="rounded-full border border-amber-200 px-2 py-1 text-xs text-amber-800 hover:border-amber-300"
            >
              편집 취소
            </button>
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">기본 정보</span>
            <span className="text-xs text-slate-500">* 필수</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder={`ID 자동 생성: ${autoId}`}
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            >
              <option value="all" disabled>
                모델 선택
              </option>
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
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.system}
              onChange={(e) => setForm({ ...form, system: e.target.value as PartEntry["system"] })}
            >
              {systems.map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.label}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="부품/섹션 이름"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
        </div>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            추가 정보 (요약/태그)
          </summary>
          <div className="mt-3 space-y-2">
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="요약/비고"
              rows={2}
              value={form.summary ?? ""}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="태그 (쉼표 구분)"
              value={form.tags?.join(",") ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </details>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            사진 {photoCount ? `(${photoCount})` : ""}
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>URL을 직접 입력하거나 업로드로 자동 채울 수 있습니다.</span>
            </div>
            {uploadMessage ? <div className="text-xs text-slate-600">{uploadMessage}</div> : null}
            {photoCount === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                아직 등록된 사진이 없습니다. "사진 추가"를 눌러 시작하세요.
              </div>
            ) : null}
            {form.photos?.map((photo, idx) => (
              <div
                key={`photo-${idx}`}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2"
              >
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>사진 #{idx + 1}</span>
                  <label className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300">
                    파일 선택
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(e) => handlePhotoUpload(e.target.files?.[0] ?? null, idx)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300"
                  >
                    삭제
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="이름"
                    value={photo.label ?? ""}
                    onChange={(e) => updatePhoto(idx, "label", e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="사진 설명"
                    value={photo.desc ?? ""}
                    onChange={(e) => updatePhoto(idx, "desc", e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="URL"
                    value={photo.url}
                    onChange={(e) => updatePhoto(idx, "url", e.target.value)}
                  />
                  {uploadingIndex === idx ? (
                    <div className="md:col-span-2 text-xs text-slate-500">업로드 중...</div>
                  ) : null}
                  {uploadErrors[idx] ? (
                    <div className="md:col-span-2 text-xs text-amber-600">
                      업로드 실패: {uploadErrors[idx]}
                    </div>
                  ) : null}
                  {photo.url || previewUrls[idx] ? (
                    <div className="md:col-span-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPreviews((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
                          className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300"
                        >
                          {expandedPreviews[idx] ? "미리보기 축소" : "미리보기 확대"}
                        </button>
                        {(photo.url || previewUrls[idx]) ? (
                          <a
                            href={photo.url || previewUrls[idx]}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300"
                          >
                            원본 보기
                          </a>
                        ) : null}
                      </div>
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <img
                          src={photo.url || previewUrls[idx]}
                          alt={photo.label ?? `사진 ${idx + 1}`}
                          className={`w-full object-contain ${
                            expandedPreviews[idx] ? "h-64" : "h-32"
                          }`}
                        />
                      </div>
                    </div>
                  ) : null}
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="태그 (쉼표 구분)"
                    value={(photo.tags as string[])?.join(",") ?? ""}
                    onChange={(e) =>
                      updatePhoto(
                        idx,
                        "tags",
                        e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addPhoto}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              사진 추가
            </button>
          </div>
        </details>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            단계 {stepCount ? `(${stepCount})` : ""}
          </summary>
          <div className="mt-3 space-y-3">
            {stepCount === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                아직 등록된 단계가 없습니다. "단계 추가"로 시작하세요.
              </div>
            ) : null}
            {form.steps?.map((step, idx) => (
              <div
                key={`step-${idx}`}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>단계 #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300"
                  >
                    삭제
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    type="number"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="순번"
                    value={step.order}
                    onChange={(e) => updateStep(idx, "order", Number(e.target.value))}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="제목"
                    value={step.title}
                    onChange={(e) => updateStep(idx, "title", e.target.value)}
                  />
                  <textarea
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="설명"
                    rows={2}
                    value={step.desc ?? ""}
                    onChange={(e) => updateStep(idx, "desc", e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="공구"
                    value={step.tools ?? ""}
                    onChange={(e) => updateStep(idx, "tools", e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="토크"
                    value={step.torque ?? ""}
                    onChange={(e) => updateStep(idx, "torque", e.target.value)}
                  />
                  <textarea
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="주의/비고"
                    rows={1}
                    value={step.note ?? ""}
                    onChange={(e) => updateStep(idx, "note", e.target.value)}
                  />
                  <div className="md:col-span-2 space-y-2">
                    <div className="text-xs font-semibold text-slate-600">연결 사진 선택</div>
                    <div
                      className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = event.dataTransfer.getData("text/plain");
                        if (id) toggleStepPhotoId(idx, id);
                      }}
                    >
                      사진 이름을 드래그하거나 눌러 연결합니다.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {photoOptions.length === 0 ? (
                        <span className="text-xs text-slate-400">등록된 사진이 없습니다.</span>
                      ) : (
                        photoOptions.map((photo) => {
                          const selected = (step.photoIds ?? []).includes(photo.id);
                          return (
                            <button
                              key={`${photo.id}-${idx}`}
                              type="button"
                              draggable
                              onDragStart={(event) =>
                                event.dataTransfer.setData("text/plain", photo.id)
                              }
                              onClick={() => toggleStepPhotoId(idx, photo.id)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                selected
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                              title={photo.url ?? ""}
                            >
                              {photo.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addStep}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              단계 추가
            </button>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {status === "loading" ? "저장중..." : "저장"}
          </button>
          {message ? (
            <div className={`text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>
              {message}
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}
