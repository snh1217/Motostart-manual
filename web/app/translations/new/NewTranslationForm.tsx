"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  entryId: string;
  title: string;
  returnTo: string;
};

export default function NewTranslationForm({ entryId, title, returnTo }: Props) {
  const [titleKo, setTitleKo] = useState("");
  const [summaryKo, setSummaryKo] = useState("");
  const [textKo, setTextKo] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entryId);
      setMessage("메뉴얼 ID를 복사했습니다.");
    } catch {
      setMessage("복사에 실패했습니다.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!entryId) {
      setStatus("error");
      setMessage("entryId가 필요합니다.");
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/translations/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          title_ko: titleKo,
          summary_ko: summaryKo,
          text_ko: textKo,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "저장 실패");
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs text-slate-500">메뉴얼 ID</div>
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
          placeholder="요약 내용을 입력하세요."
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
          placeholder="본문 내용을 입력하세요."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "saving" ? "저장 중..." : "저장"}
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
