"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ManualEditFormProps = {
  entry: {
    id: string;
    model: string;
    manual_type: string;
    section: string;
    title: string;
    language: string;
    pages: { start: number; end: number };
    source_pdf?: string | null;
    file: string;
  };
};

type UpdateResponse = {
  ok?: boolean;
  error?: string;
};

const manualTypes = ["engine", "chassis", "user", "wiring"] as const;

type ManualType = (typeof manualTypes)[number];

export default function ManualEditForm({ entry }: ManualEditFormProps) {
  const router = useRouter();
  const [model, setModel] = useState(entry.model);
  const [manualType, setManualType] = useState<ManualType>(
    (entry.manual_type as ManualType) || "engine"
  );
  const [section, setSection] = useState(entry.section);
  const [title, setTitle] = useState(entry.title);
  const [language, setLanguage] = useState(entry.language || "ko");
  const [sourcePdf, setSourcePdf] = useState(entry.source_pdf ?? "");
  const [pagesStart, setPagesStart] = useState(String(entry.pages?.start ?? 1));
  const [pagesEnd, setPagesEnd] = useState(String(entry.pages?.end ?? 1));
  const [adminToken, setAdminToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  const parseJson = (text: string) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminToken.trim()) {
      setMessage("ADMIN_TOKEN을 입력해 주세요.");
      return;
    }
    if (!model.trim() || !section.trim() || !title.trim()) {
      setMessage("모델, 섹션, 제목을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      id: entry.id,
      model: model.trim().toUpperCase(),
      manual_type: manualType,
      section: section.trim(),
      title: title.trim(),
      language: language.trim() || "ko",
      source_pdf: sourcePdf.trim(),
      pages_start: Number(pagesStart) || 1,
      pages_end: Number(pagesEnd) || Number(pagesStart) || 1,
    };

    try {
      localStorage.setItem("ADMIN_TOKEN", adminToken);
      const res = await fetch("/api/manuals/update", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      const data = (text ? parseJson(text) : null) as UpdateResponse | null;
      if (!res.ok || !data?.ok) {
        throw new Error((data?.error ?? text) || "수정 실패");
      }
      router.push(`/manuals?model=${encodeURIComponent(payload.model)}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="text"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="모델 코드"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <select
          value={manualType}
          onChange={(event) => setManualType(event.target.value as ManualType)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="engine">엔진</option>
          <option value="chassis">차대</option>
          <option value="user">사용자</option>
          <option value="wiring">회로도</option>
        </select>
        <input
          type="text"
          value={section}
          onChange={(event) => setSection(event.target.value)}
          placeholder="섹션"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="제목"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          placeholder="언어"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={sourcePdf}
          onChange={(event) => setSourcePdf(event.target.value)}
          placeholder="원본 PDF 파일명 (선택)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="number"
          value={pagesStart}
          onChange={(event) => setPagesStart(event.target.value)}
          placeholder="시작 페이지"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={pagesEnd}
          onChange={(event) => setPagesEnd(event.target.value)}
          placeholder="끝 페이지"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2 text-xs text-slate-500">
        <div>매뉴얼 ID: {entry.id}</div>
        <div>파일: {entry.file}</div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="ADMIN_TOKEN"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
      {message ? <p className="text-sm text-rose-600">{message}</p> : null}
    </form>
  );
}
