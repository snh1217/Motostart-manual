"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

const items: MenuItem[] = [
  { href: "/", label: "홈" },
  { href: "/search", label: "검색" },
  { href: "/specs", label: "토크/규격" },
  { href: "/diagnostics", label: "진단기" },
  { href: "/cases", label: "정비사례" },
  { href: "/wiring", label: "회로도" },
  { href: "/manuals", label: "매뉴얼(원문)" },
  { href: "/translations", label: "번역 관리", adminOnly: true },
  { href: "/models", label: "모델 관리", adminOnly: true },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ADMIN_TOKEN");
      setIsAdmin(Boolean(stored && stored.trim()));
      if (stored && stored.trim()) {
        setTokenInput(stored);
      }
    } catch {
      setIsAdmin(false);
    }
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
    setShowAdminForm(false);
  }, [pathname]);

  const handleAdminLogin = () => {
    if (!tokenInput.trim()) return;
    localStorage.setItem("ADMIN_TOKEN", tokenInput.trim());
    setIsAdmin(true);
    setTokenInput(tokenInput.trim());
    setShowAdminForm(false);
    window.dispatchEvent(new Event("admin-token-changed"));
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("ADMIN_TOKEN");
    setIsAdmin(false);
    setTokenInput("");
    setShowAdminForm(false);
    window.dispatchEvent(new Event("admin-token-changed"));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
      >
        <span className="flex h-4 w-4 flex-col items-center justify-center gap-1">
          <span className="h-0.5 w-4 rounded-full bg-slate-600" />
          <span className="h-0.5 w-4 rounded-full bg-slate-600" />
          <span className="h-0.5 w-4 rounded-full bg-slate-600" />
        </span>
        메뉴
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {items
            .filter((item) => (item.adminOnly ? isAdmin : true))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          <div className="mt-2 border-t border-slate-100 pt-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleAdminLogout}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                관리자 로그아웃
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowAdminForm((prev) => !prev)}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  관리자 로그인
                </button>
                {showAdminForm ? (
                  <div className="mt-2 space-y-2 px-2 pb-2">
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(event) => setTokenInput(event.target.value)}
                      placeholder="ADMIN_TOKEN"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAdminLogin}
                      className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      확인
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}