import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900">
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
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300">
                  <span className="flex h-4 w-4 flex-col items-center justify-center gap-1">
                    <span className="h-0.5 w-4 rounded-full bg-slate-600" />
                    <span className="h-0.5 w-4 rounded-full bg-slate-600" />
                    <span className="h-0.5 w-4 rounded-full bg-slate-600" />
                  </span>
                  메뉴
                </summary>
                <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  <Link
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    href="/"
                  >
                    홈
                  </Link>
                  <Link
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    href="/manuals"
                  >
                    매뉴얼
                  </Link>
                  <Link
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    href="/search"
                  >
                    검색
                  </Link>
                  <Link
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    href="/cases"
                  >
                    정비사례
                  </Link>
                  <Link
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    href="/wiring"
                  >
                    회로도
                  </Link>
                  <Link
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    href="/translations"
                  >
                    번역 관리
                  </Link>
                  <Link
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    href="/specs"
                  >
                    스펙
                  </Link>
                </div>
              </details>
            </div>
          </nav>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
