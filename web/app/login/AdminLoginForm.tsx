"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status = "idle" | "loading" | "success" | "error";
type Role = "user" | "admin" | null;

const getNextPath = (value: string | null) => {
  if (!value) return "/";
  return value.startsWith("/") ? value : "/";
};

export default function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextPath = getNextPath(searchParams?.get("next") ?? null);

  const [tokenInput, setTokenInput] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    const trimmed = stored?.trim();
    if (trimmed) setTokenInput(trimmed);
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        const data = await res.json();
        setRole(data?.loggedIn ? (data?.role as Role) : null);
      } catch {
        setRole(null);
      }
    };
    void loadStatus();
  }, []);

  const broadcastTokenChange = () => {
    window.dispatchEvent(new Event("admin-token-changed"));
  };

  const broadcastSessionChange = () => {
    window.dispatchEvent(new Event("session-changed"));
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setStatus("error");
      setMessage("로그인 코드를 입력해 주세요.");
      return;
    }
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "로그인 실패");

      if (data?.adminToken) {
        localStorage.setItem("ADMIN_TOKEN", data.adminToken);
      } else {
        localStorage.removeItem("ADMIN_TOKEN");
      }
      setRole(data?.role ?? null);
      setStatus("success");
      setMessage(data?.role === "admin" ? "관리자 로그인 완료" : "로그인 완료");
      broadcastTokenChange();
      broadcastSessionChange();
      router.replace(nextPath);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "로그인 오류");
    }
  };

  const handleLogout = () => {
    const logout = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Ignore network failures.
      } finally {
        localStorage.removeItem("ADMIN_TOKEN");
        setRole(null);
        setTokenInput("");
        setStatus("success");
        setMessage("로그아웃 되었습니다.");
        broadcastTokenChange();
        broadcastSessionChange();
      }
    };
    void logout();
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">로그인</h2>
        <p className="text-sm text-slate-600">
          모든 사용자는 로그인 후 이용할 수 있습니다. 관리자 로그인 시 권한이 자동 반영됩니다.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-3">
        <input
          type="password"
          value={tokenInput}
          onChange={(event) => setTokenInput(event.target.value)}
          placeholder="로그인 코드"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "loading" ? "확인 중..." : "로그인"}
        </button>
      </form>

      <div className="text-sm text-slate-600">
        {role ? `현재 로그인됨 (${role === "admin" ? "관리자" : "일반"})` : "현재 로그아웃 상태"}
      </div>

      {role ? (
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          로그아웃
        </button>
      ) : null}

      {message ? (
        <div
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
