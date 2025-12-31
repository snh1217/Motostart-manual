import type { ReactNode } from "react";
import Link from "next/link";
import NavMenu from "./NavMenu";
import AppBridge from "./AppBridge";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AppBridge />
        <div className="border-b border-slate-200 bg-white">
          <nav className="mx-auto grid w-full max-w-6xl grid-cols-3 items-center px-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="MOTOSTAR"
                className="h-7 w-7 rounded-full object-contain"
              />
              <span className="text-sm font-semibold tracking-[0.2em]">
                MOTOSTAR
              </span>
            </Link>
            <div className="text-center text-sm font-semibold tracking-[0.35em] text-slate-700">
              MANUAL HUB
            </div>
            <div className="flex justify-end">
              <NavMenu />
            </div>
          </nav>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
