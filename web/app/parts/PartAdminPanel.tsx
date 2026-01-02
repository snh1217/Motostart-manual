"use client";

import { useEffect, useState } from "react";
import type { PartEntry, PartPhoto, PartStep } from "../../lib/types";

type Status = "idle" | "loading" | "success" | "error";

const systems = [
  { id: "engine", label: "엔진" },
  { id: "chassis", label: "차대" },
  { id: "electrical", label: "전장" },
  { id: "other", label: "기타" },
];

const emptyPhoto = (): PartPhoto => ({ id: "", url: "", label: "", tags: [] });
const emptyStep = (): PartStep => ({
  order: 1,
  title: "",
  desc: "",
  tools: "",
  torque: "",
  note: "",
  photoIds: [],
});

export default function PartAdminPanel() {
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<PartEntry>({
    id: "",
    model: "368G",
    system: "engine",
    name: "",
    summary: "",
    tags: [],
    photos: [emptyPhoto()],
    steps: [emptyStep()],
  });

  // 사진 업로드 상태
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (adminToken) localStorage.setItem("ADMIN_TOKEN", adminToken);
  }, [adminToken]);

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
      return { ...prev, photos: photos.length ? photos : [emptyPhoto()] };
    });
  };

  const updateStep = (idx: number, key: keyof PartStep, value: string | number | string[]) => {
    setForm((prev) => {
      const steps = [...(prev.steps ?? [])];
      steps[idx] = { ...steps[idx], [key]: value } as PartStep;
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
      return { ...prev, steps: steps.length ? steps : [emptyStep()] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const payload: PartEntry = {
      ...form,
      tags: form.tags?.filter(Boolean) ?? [],
      photos: (form.photos ?? []).map((ph, i) => ({
        ...ph,
        id: ph.id || `ph-${i + 1}`,
        tags: (ph.tags as string[])?.filter(Boolean) ?? [],
      })),
      steps: (form.steps ?? []).map((st, i) => ({
        ...st,
        order: Number(st.order) || i + 1,
        photoIds: st.photoIds ?? [],
      })),
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
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "저장 중 오류");
    }
  };

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
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
      // 업로드된 URL을 첫 번째 사진에 채우기 (또는 새로운 사진 추가)
      setForm((prev) => {
        const photos = [...(prev.photos ?? [])];
        const targetIdx = photos.findIndex((p) => !p.url);
        if (targetIdx >= 0) {
          photos[targetIdx] = { ...photos[targetIdx], url: data.url ?? data.path ?? "" };
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
      setUploadMessage(err instanceof Error ? err.message : "업로드 오류");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">관리자 입력</h2>
          <p className="text-xs text-slate-500">ADMIN_TOKEN 필요 · Supabase 우선 저장</p>
        </div>
        <input
          type="password"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          className="w-48 rounded-lg border border-slate-200 px-3 py-1 text-sm"
        />
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="ID (예: part-368g-cvt)"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            required
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
            onChange={(e) =>
              setForm({ ...form, system: e.target.value as PartEntry["system"] })
            }
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

        {/* 사진 입력 */}
        <div className="rounded-xl border border-slate-200 p-3 space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>사진</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => handlePhotoUpload(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
          </div>
          {uploadMessage ? (
            <div className="text-xs text-slate-600">{uploadMessage}</div>
          ) : null}
          {form.photos?.map((photo, idx) => (
            <div
              key={`photo-${idx}`}
              className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2"
            >
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>사진 #{idx + 1}</span>
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
                  placeholder="사진 ID (예: ph-1)"
                  value={photo.id}
                  onChange={(e) => updatePhoto(idx, "id", e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="라벨"
                  value={photo.label ?? ""}
                  onChange={(e) => updatePhoto(idx, "label", e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                  placeholder="URL"
                  value={photo.url}
                  onChange={(e) => updatePhoto(idx, "url", e.target.value)}
                  required
                />
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

        {/* 단계 입력 */}
        <div className="rounded-xl border border-slate-200 p-3 space-y-3">
          <div className="text-sm font-semibold text-slate-700">단계</div>
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
                  required
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
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                  placeholder="연결할 사진 ID들 (쉼표 구분, 예: ph-1,ph-2)"
                  value={(step.photoIds ?? []).join(",")}
                  onChange={(e) =>
                    updateStep(
                      idx,
                      "photoIds",
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
            onClick={addStep}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            단계 추가
          </button>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "loading" ? "저장 중..." : "저장"}
        </button>

        {message ? (
          <div
            className={`text-sm ${
              status === "error" ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {message}
          </div>
        ) : null}
      </form>
    </section>
  );
}
