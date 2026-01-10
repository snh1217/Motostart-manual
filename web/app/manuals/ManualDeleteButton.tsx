"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ManualDeleteButtonProps = {
  id: string;
  file?: string;
  title?: string;
};

type DeleteResponse = {
  ok?: boolean;
  error?: string;
  storageError?: string | null;
};

export default function ManualDeleteButton({
  id,
  file,
  title,
}: ManualDeleteButtonProps) {
  const router = useRouter();
  const [adminToken, setAdminToken] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!adminToken.trim()) {
      window.alert("관리자 로그인 상태를 확인해 주세요.");
      return;
    }

    const ok = window.confirm(
      title ? `매뉴얼 '${title}'를 삭제할까요?` : "해당 매뉴얼을 삭제할까요?"
    );
    if (!ok) return;

    try {
      setDeleting(true);
      const res = await fetch("/api/manuals/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, file }),
      });
      const text = await res.text();
      const data = (text ? parseJson(text) : null) as DeleteResponse | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? text || "삭제 실패");
      }
      if (data?.storageError) {
        window.alert(`DB 삭제 완료. 파일 삭제 오류: ${data.storageError}`);
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:border-rose-300 disabled:opacity-60"
    >
      {deleting ? "삭제 중..." : "삭제"}
    </button>
  );
}
