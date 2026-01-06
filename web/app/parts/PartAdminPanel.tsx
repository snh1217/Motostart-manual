"use client";

import { useEffect, useMemo, useState } from "react";
import type { PartEntry, PartPhoto, PartStep } from "../../lib/types";

type Status = "idle" | "loading" | "success" | "error";

const systems = [
  { id: "engine", label: "?îÏßÑ" },
  { id: "chassis", label: "Ï∞®Î?" },
  { id: "electrical", label: "?ÑÏû•" },
  { id: "other", label: "Í∏∞Ì?" },
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

  // ?¨ÏßÑ ?ÖÎ°ú???ÅÌÉú
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});

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
      id: form.id?.trim() || autoId,
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
      if (!res.ok) throw new Error(data?.error ?? "?Ä???§Ìå®");
      setStatus("success");
      setMessage(`?Ä???ÑÎ£å (${data.source ?? "local"})`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "?Ä??Ï§??§Î•ò");
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
      if (!res.ok) throw new Error(data?.error ?? "?ÖÎ°ú???§Ìå®");
      // ?ÖÎ°ú?úÎêú URL??Ï≤?Î≤àÏß∏ ?¨ÏßÑ??Ï±ÑÏö∞Í∏?(?êÎäî ?àÎ°ú???¨ÏßÑ Ï∂îÍ?)
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
      setUploadMessage("?¨ÏßÑ ?ÖÎ°ú???ÑÎ£å: URL???ÖÎ†•?òÏóà?µÎãà??");
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "?ÖÎ°ú???§Î•ò");
    } finally {
      setUploading(false);
    }
  };

  const photoCount = form.photos?.length ?? 0;
  const stepCount = form.steps?.length ?? 0;
  const photoOptions = (form.photos ?? []).map((photo, index) => ({
    id: photo.id?.trim() || `ph-${index + 1}`,
    name: photo.label?.trim() || `?¨ÏßÑ ${index + 1}`,
    url: photo.url,
  }));

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Î∂Ä??ÏßÅÏ†ë ?ÖÎ†•</h2>
          <p className="text-xs text-slate-500">
            Í∏∞Î≥∏ ?ïÎ≥¥Îß??ÖÎ†•?¥ÎèÑ ?Ä?•Îê©?àÎã§. ?ÅÏÑ∏ ?ïÎ≥¥???ÑÏöî???åÎßå ?ºÏ≥êÏ£ºÏÑ∏??
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
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Í∏∞Î≥∏ ?ïÎ≥¥</span>
            <span className="text-xs text-slate-500">* ?ÑÏàò</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder={`ID ?êÎèô ?ùÏÑ±: ${autoId}`}
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            >
              <option value="all" disabled>
                Î™®Îç∏ ?†ÌÉù
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
              placeholder="Î∂Ä???πÏÖò ?¥Î¶Ñ"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
        </div>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Ï∂îÍ? ?ïÎ≥¥ (?îÏïΩ/?úÍ∑∏)
          </summary>
          <div className="mt-3 space-y-2">
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="?îÏïΩ/ÎπÑÍ≥†"
              rows={2}
              value={form.summary ?? ""}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="?úÍ∑∏ (?ºÌëú Íµ¨Î∂Ñ)"
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
            ?¨ÏßÑ {photoCount ? `(${photoCount})` : ""}
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>URL??ÏßÅÏ†ë ?ÖÎ†•?òÍ±∞???ÖÎ°ú?úÎ°ú ?êÎèô Ï±ÑÏö∏ ???àÏäµ?àÎã§.</span>
            </div>
            {uploadMessage ? (
              <div className="text-xs text-slate-600">{uploadMessage}</div>
            ) : null}
            {photoCount === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                ?ÑÏßÅ ?±Î°ù???¨ÏßÑ???ÜÏäµ?àÎã§. "?¨ÏßÑ Ï∂îÍ?"Î•??åÎü¨ ?úÏûë?òÏÑ∏??
              </div>
            ) : null}
            {form.photos?.map((photo, idx) => (
              <div
                key={`photo-${idx}`}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2"
              >
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>?¨ÏßÑ #{idx + 1}</span>
                  <label className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300">
                    ?åÏùº ?†ÌÉù
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
                    ??†ú
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Name"
                    value={photo.label ?? ""}
                    onChange={(e) => updatePhoto(idx, "label", e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Photo note"
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
                    <div className="md:col-span-2 text-xs text-slate-500">Uploading...</div>
                  ) : null}
                  {uploadErrors[idx] ? (
                    <div className="md:col-span-2 text-xs text-amber-600">Upload failed: {uploadErrors[idx]}</div>
                  ) : null}
                  {(photo.url || previewUrls[idx]) ? (
                    <div className="md:col-span-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img
                        src={photo.url || previewUrls[idx]}
                        alt={photo.label ?? `Photo ${idx + 1}`}
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="Tags (comma)"
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
                    )
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addPhoto}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              ?¨ÏßÑ Ï∂îÍ?
            </button>
          </div>
        </details>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            ?®Í≥Ñ {stepCount ? `(${stepCount})` : ""}
          </summary>
          <div className="mt-3 space-y-3">
            {stepCount === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                ?ÑÏßÅ ?±Î°ù???®Í≥ÑÍ∞Ä ?ÜÏäµ?àÎã§. "?®Í≥Ñ Ï∂îÍ?"Î°??úÏûë?òÏÑ∏??
              </div>
            ) : null}
            {form.steps?.map((step, idx) => (
              <div
                key={`step-${idx}`}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>?®Í≥Ñ #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300"
                  >
                    ??†ú
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    type="number"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="?úÎ≤à"
                    value={step.order}
                    onChange={(e) => updateStep(idx, "order", Number(e.target.value))}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="?úÎ™©"
                    value={step.title}
                    onChange={(e) => updateStep(idx, "title", e.target.value)}
                  />
                  <textarea
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="?§Î™Ö"
                    rows={2}
                    value={step.desc ?? ""}
                    onChange={(e) => updateStep(idx, "desc", e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Í≥µÍµ¨"
                    value={step.tools ?? ""}
                    onChange={(e) => updateStep(idx, "tools", e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="?†ÌÅ¨"
                    value={step.torque ?? ""}
                    onChange={(e) => updateStep(idx, "torque", e.target.value)}
                  />
                  <textarea
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    placeholder="Ï£ºÏùò/ÎπÑÍ≥†"
                    rows={1}
                    value={step.note ?? ""}
                    onChange={(e) => updateStep(idx, "note", e.target.value)}
                  />
                  <div className="md:col-span-2 space-y-2">
                    <div className="text-xs font-semibold text-slate-600">
                      ?∞Í≤∞ ?¨ÏßÑ ?†ÌÉù
                    </div>
                    <div
                      className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = event.dataTransfer.getData("text/plain");
                        if (id) toggleStepPhotoId(idx, id);
                      }}
                    >
                      ?¨ÏßÑ ?¥Î¶Ñ???¥Î¶≠?òÍ±∞???åÏñ¥???ìÏúºÎ©??∞Í≤∞?©Îãà??
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {photoOptions.length === 0 ? (
                        <span className="text-xs text-slate-400">
                          ?±Î°ù???¨ÏßÑ???ÜÏäµ?àÎã§.
                        </span>
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
              ?®Í≥Ñ Ï∂îÍ?
            </button>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {status === "loading" ? "?Ä??Ï§?.." : "?Ä??}
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
        </div>
      </form>
    </section>
  );
}
