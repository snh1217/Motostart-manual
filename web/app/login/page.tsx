import { Suspense } from "react";
import LoginForm from "./AdminLoginForm";

export const runtime = "nodejs";

export default function LoginPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <p className="text-sm text-slate-600">
          이용을 위해 로그인 코드가 필요합니다.
        </p>
      </header>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
