"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  entryId: string;
  title: string;
  returnTo: string;
  model?: string;
  readOnly?: boolean;
  initialTitleKo?: string;
  initialSummaryKo?: string;
  initialTextKo?: string;
  initialPdfUrl?: string;
};

export default function NewTranslationForm({
  entryId,
  title,
  returnTo,
  model,
  readOnly = false,
  initialTitleKo,
  initialSummaryKo,
  initialTextKo,
  initialPdfUrl,
}: Props) {
  const [titleKo, setTitleKo] = useState(initialTitleKo ?? "");
  const [summaryKo, setSummaryKo] = useState(initialSummaryKo ?? "");
  const [textKo, setTextKo] = useState(initialTextKo ?? "");
  const [pdfUrl, setPdfUrl] = useState(initialPdfUrl ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [adminToken, setAdminToken] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    setTitleKo(initialTitleKo ?? "");
    setSummaryKo(initialSummaryKo ?? "");
    setTextKo(initialTextKo ?? "");
    setPdfUrl(initialPdfUrl ?? "");
  }, [initialTitleKo, initialSummaryKo, initialTextKo, initialPdfUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entryId);
      setMessage("매뉴얼 ID를 복사했습니다.");
    } catch {
      setMessage("복사에 실패했습니다.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 저장할 수 없습니다.");
      return;
    }

    if (!entryId) {
      setStatus("error");
      setMessage("entryId가 필요합니다.");
      return;
    }

    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("관리자 토큰을 입력해 주세요.");
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      localStorage.setItem("ADMIN_TOKEN", adminToken);
      const response = await fetch("/api/translations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          entryId,
          model,
          title_ko: titleKo,
          summary_ko: summaryKo,
          text_ko: textKo,
          pdf_ko_url: pdfUrl.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "저장 실패");
      }

      setStatus("saved");
      setMessage("저장되었습니다.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "저장 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {readOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          읽기 전용 모드입니다. 번역 저장이 비활성화됩니다.
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs text-slate-500">매뉴얼 ID</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={entryId}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
          >
            ID 복사
          </button>
        </div>
        {title ? <div className="mt-2 text-xs text-slate-500">{title}</div> : null}
        {model ? <div className="mt-1 text-xs text-slate-500">모델: {model}</div> : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="adminToken">
          관리자 토큰
        </label>
        <input
          id="adminToken"
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="관리자 코드"
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="titleKo">
          한글 제목
        </label>
        <input
          id="titleKo"
          value={titleKo}
          onChange={(event) => setTitleKo(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="예: 좌측 크랭크케이스 커버 및 CVT"
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="summaryKo">
          한글 요약
        </label>
        <textarea
          id="summaryKo"
          value={summaryKo}
          onChange={(event) => setSummaryKo(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          rows={3}
          placeholder="요약 내용을 입력하세요"
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="textKo">
          한글 본문
        </label>
        <textarea
          id="textKo"
          value={textKo}
          onChange={(event) => setTextKo(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          rows={8}
          placeholder="본문 내용을 입력하세요"
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="pdfUrl">
          번역 PDF URL (선택)
        </label>
        <input
          id="pdfUrl"
          value={pdfUrl}
          onChange={(event) => setPdfUrl(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="https://.../translated.pdf"
          disabled={readOnly}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving" || readOnly}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "saving" ? "저장 중.." : "저장"}
        </button>
        <Link
          href={returnTo}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          돌아가기
        </Link>
        {message ? (
          <span
            className={`text-sm ${
              status === "error" ? "text-red-600" : "text-slate-600"
            }`}
          >
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
