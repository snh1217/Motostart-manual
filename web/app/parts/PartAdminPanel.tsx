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

const toJson = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    return null;
  }
};

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
  const [photosText, setPhotosText] = useState(
    '[{"id":"ph-1","url":"https://...","label":"좌측","tags":["볼트"]}]'
  );
  const [stepsText, setStepsText] = useState(
    '[{"order":1,"title":"커버 분리","desc":"볼트 4개 해체","photoIds":["ph-1"]}]'
  );

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (adminToken) localStorage.setItem("ADMIN_TOKEN", adminToken);
  }, [adminToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const parsedPhotos = toJson(photosText) as PartPhoto[] | null;
    const parsedSteps = toJson(stepsText) as PartStep[] | null;

    if (!parsedPhotos || !parsedSteps) {
      setStatus("error");
      setMessage("photos/steps JSON을 올바르게 입력해 주세요.");
      return;
    }

    const payload: PartEntry = {
      ...form,
      tags: form.tags ?? [],
      photos: parsedPhotos,
      steps: parsedSteps,
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
      if (!res.ok) {
        throw new Error(data?.error ?? "저장 실패");
      }
      setStatus("success");
      setMessage(`저장 완료 (${data.source ?? "local"})`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "저장 중 오류");
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
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

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">사진 JSON</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              rows={6}
              value={photosText}
              onChange={(e) => setPhotosText(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              예) {"[{\"id\":\"ph-1\",\"url\":\"https://...\",\"label\":\"좌측\",\"tags\":[\"볼트\"]}]"}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">단계 JSON</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              rows={6}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              예) {"[{\"order\":1,\"title\":\"커버 분리\",\"desc\":\"볼트 4개 해체\",\"photoIds\":[\"ph-1\"]}]"}
            </p>
          </div>
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
