import { cookies } from "next/headers";
import Link from "next/link";
import LoginCodeManager from "./LoginCodeManager";
import { SESSION_COOKIE, parseSessionValue } from "../../../lib/auth/session";

export const runtime = "nodejs";

export default async function LoginCodesPage() {
  const cookieStore = await cookies();
  const role = parseSessionValue(cookieStore.get(SESSION_COOKIE)?.value ?? null);

  if (role !== "admin") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">로그인 코드</h1>
        <p className="text-sm text-slate-600">관리자만 접근할 수 있습니다.</p>
        <Link
          href="/"
          className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          홈으로 이동
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">로그인 코드</h1>
        <p className="text-sm text-slate-600">
          일반/관리자 로그인 코드를 생성하고 배포할 수 있습니다.
        </p>
      </header>
      <LoginCodeManager />
    </section>
  );
}
