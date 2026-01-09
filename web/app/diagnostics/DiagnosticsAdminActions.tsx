"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DiagnosticsAdminActionsProps = {
  id: string;
  model: string;
};

export default function DiagnosticsAdminActions({
  id,
  model,
}: DiagnosticsAdminActionsProps) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  const handleDelete = async () => {
    if (!adminToken.trim()) {
      window.alert("관리자 로그인 상태를 확인해 주세요.");
      return;
    }
    const ok = window.confirm("해당 진단기 항목을 삭제할까요?");
    if (!ok) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/diagnostics?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "삭제 실패");
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <button
        type="button"
        onClick={() =>
          router.push(`/diagnostics?model=${encodeURIComponent(model)}&edit=${encodeURIComponent(id)}`)
        }
        className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:border-slate-300"
      >
        수정
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:border-rose-300 disabled:opacity-60"
      >
        {deleting ? "삭제 중..." : "삭제"}
      </button>
    </div>
  );
}
