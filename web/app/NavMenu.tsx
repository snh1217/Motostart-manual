"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type MenuItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

type SessionRole = "user" | "admin" | null;

const items: MenuItem[] = [
  { href: "/", label: "홈" },
  { href: "/search", label: "검색" },
  { href: "/specs", label: "토크/규격" },
  { href: "/diagnostics", label: "진단기" },
  { href: "/diagnosis", label: "정비진단" },
  { href: "/cases", label: "정비사례" },
  { href: "/parts", label: "부품/절차" },
  { href: "/wiring", label: "회로도" },
  { href: "/manuals", label: "매뉴얼(원문)" },
  { href: "/admin/login-codes", label: "로그인 코드", adminOnly: true },
  { href: "/admin/diagnosis", label: "진단 트리", adminOnly: true },
  { href: "/translations", label: "번역 관리", adminOnly: true },
  { href: "/models", label: "모델 관리", adminOnly: true },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionRole, setSessionRole] = useState<SessionRole>(null);
  const isLoginPage = pathname === "/login";

  const syncAdminState = () => {
    try {
      const stored = localStorage.getItem("ADMIN_TOKEN");
      setIsAdmin(Boolean(stored && stored.trim()));
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    syncAdminState();
  }, []);

  const syncSessionState = async () => {
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      const data = await res.json();
      setSessionRole(data?.loggedIn ? (data?.role as SessionRole) : null);
    } catch {
      setSessionRole(null);
    }
  };

  useEffect(() => {
    void syncSessionState();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleTokenChange = () => {
      syncAdminState();
    };
    window.addEventListener("admin-token-changed", handleTokenChange);
    return () => window.removeEventListener("admin-token-changed", handleTokenChange);
  }, []);

  useEffect(() => {
    const handleSessionChange = () => {
      void syncSessionState();
    };
    window.addEventListener("session-changed", handleSessionChange);
    return () => window.removeEventListener("session-changed", handleSessionChange);
  }, []);

  const handleAdminLogout = () => {
    const logout = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Ignore network failures.
      } finally {
        localStorage.removeItem("ADMIN_TOKEN");
        setIsAdmin(false);
        setSessionRole(null);
        window.dispatchEvent(new Event("admin-token-changed"));
        window.dispatchEvent(new Event("session-changed"));
        router.push(`/login?next=${encodeURIComponent(pathname ?? "/")}`);
      }
    };
    void logout();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-disabled={isLoginPage}
        disabled={isLoginPage}
        onClick={() => {
          if (isLoginPage) return;
          setOpen((prev) => !prev);
        }}
        className={`flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition ${
          isLoginPage
            ? "cursor-not-allowed opacity-50"
            : "hover:border-slate-300 hover:cursor-pointer"
        }`}
      >
        <span className="flex h-4 w-4 flex-col items-center justify-center gap-1">
          <span className="h-0.5 w-4 rounded-full bg-slate-600" />
          <span className="h-0.5 w-4 rounded-full bg-slate-600" />
          <span className="h-0.5 w-4 rounded-full bg-slate-600" />
        </span>
        메뉴
      </button>
      {open && !isLoginPage ? (
        <div className="absolute right-0 mt-2 w-56 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {items
            .filter((item) => (item.adminOnly ? isAdmin : true))
            .filter(
              (item) =>
                item.href !== "/translations" ||
                process.env.NEXT_PUBLIC_TRANSLATIONS_ENABLED === "1"
            )
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:cursor-pointer"
              >
                {item.label}
              </Link>
            ))}
          <div className="mt-2 border-t border-slate-100 pt-2">
            {sessionRole ? (
              <button
                type="button"
                onClick={handleAdminLogout}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:cursor-pointer"
              >
                {isAdmin ? "관리자 로그아웃" : "로그아웃"}
              </button>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(pathname ?? "/")}`}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:cursor-pointer"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
