"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function WiringAdminAction() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const update = () => {
      const stored = localStorage.getItem("ADMIN_TOKEN");
      setIsAdmin(Boolean(stored && stored.trim()));
    };

    update();
    const handler = () => update();
    window.addEventListener("admin-token-changed", handler);
    return () => window.removeEventListener("admin-token-changed", handler);
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/wiring/upload"
        className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
      >
        회로도 업로드
      </Link>
    </div>
  );
}
