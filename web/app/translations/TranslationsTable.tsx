"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TranslationItem } from "../../lib/types";

type TranslationsTableProps = {
  items: TranslationItem[];
  readOnly: boolean;
  returnTo: string;
};

export default function TranslationsTable({
  items,
  readOnly,
  returnTo,
}: TranslationsTableProps) {
  const [rows, setRows] = useState<TranslationItem[]>(items);
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<"idle" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    setRows(items);
  }, [items]);

  const isAdmin = useMemo(() => Boolean(adminToken.trim()), [adminToken]);

  const handleDelete = async (entryId: string) => {
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 삭제할 수 없습니다.");
      return;
    }
    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("관리자 코드가 필요합니다.");
      return;
    }

    const ok = window.confirm("해당 번역을 삭제할까요?");
    if (!ok) return;

    try {
      const response = await fetch("/api/translations/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ entryId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "삭제에 실패했습니다.");
      }
      setRows((prev) => prev.filter((row) => row.entryId !== entryId));
      setStatus("idle");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-3">
      {message ? (
        <div className={`text-sm ${status === "error" ? "text-red-600" : "text-slate-600"}`}>
          {message}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[720px] text-left text-sm sm:min-w-full">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">매뉴얼 ID</th>
              <th className="px-4 py-3 font-semibold">한국어 제목</th>
              <th className="px-4 py-3 font-semibold">번역 PDF</th>
              <th className="px-4 py-3 font-semibold">업데이트</th>
              {isAdmin ? <th className="px-4 py-3 font-semibold">작업</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item) => (
                <tr key={item.entryId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.entryId}</td>
                  <td className="px-4 py-3 text-slate-700">{item.title_ko ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.pdf_ko_url ? (
                      <a
                        href={item.pdf_ko_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-800 underline"
                      >
                        PDF 열기
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.updated_at}</td>
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/translations/new?${new URLSearchParams({
                            entryId: item.entryId,
                            returnTo,
                          }).toString()}`}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                        >
                          수정
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.entryId)}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={isAdmin ? 5 : 4}>
                  검색 조건에 맞는 번역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
