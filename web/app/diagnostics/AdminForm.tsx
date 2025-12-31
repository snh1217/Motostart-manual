"use client";

import { useEffect, useState } from "react";
import type { DiagnosticLine, ModelCode } from "../../lib/types";

export default function DiagnosticsAdminForm({
  readOnly,
  saveTargetLabel,
}: {
  readOnly: boolean;
  saveTargetLabel?: string;
}) {
  const [id, setId] = useState("");
  const [model, setModel] = useState<ModelCode>("368G");
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [image, setImage] = useState("/diagnostics/placeholder.png");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DiagnosticLine[]>([
    { label: "항목", value: "값" },
  ]);
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  const updateLine = (idx: number, key: keyof DiagnosticLine, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, [key]: value } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, { label: "", value: "" }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드입니다.");
      return;
    }
    if (!id.trim() || !model.trim() || !title.trim() || !image.trim() || !adminToken.trim()) {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "저장 실패");
      const target = saveTargetLabel ?? "저장소";
      setStatus("success");
      setMessage(`${target}에 저장되었습니다. (목록은 새로고침 필요)`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "오류가 발생했습니다.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${readOnly ? "opacity-60" : ""}`}>
      {readOnly ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          현재 환경에서는 저장이 비활성화되어 있습니다.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="ID (예: 368g-diag-002)"
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={readOnly}
        />
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
          placeholder="이미지 경로 (/diagnostics/...)"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          disabled={readOnly}
        />
        <input
          type="password"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="ADMIN_TOKEN"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          disabled={readOnly}
        />
      </div>
      <textarea
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        placeholder="노트 (선택)"
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
