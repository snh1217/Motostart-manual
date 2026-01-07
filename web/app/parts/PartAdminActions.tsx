"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "loading" | "error";

export default function PartAdminActions({ id }: { id: string }) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  const handleDelete = async () => {
    if (!confirm("부품 정보를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/parts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "삭제 실패");
      router.push("/parts");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "삭제 오류");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <button
        type="button"
        onClick={() => router.push(`/parts?edit=${encodeURIComponent(id)}`)}
        className="rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-slate-300"
      >
        수정
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={status === "loading"}
        className="rounded-full border border-red-200 px-3 py-1.5 font-semibold text-red-600 hover:border-red-300 disabled:opacity-60"
      >
        {status === "loading" ? "삭제 중..." : "삭제"}
      </button>
      {!adminToken ? (
        <span className="text-xs text-amber-600">관리자 토큰이 필요합니다.</span>
      ) : null}
      {message ? <span className="text-xs text-red-600">{message}</span> : null}
    </div>
  );
}
