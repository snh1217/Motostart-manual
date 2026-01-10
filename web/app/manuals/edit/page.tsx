import Link from "next/link";
import { cookies } from "next/headers";
import { parseSessionValue, SESSION_COOKIE } from "../../../lib/auth/session";
import { hasSupabaseConfig, supabaseAdmin } from "../../../lib/supabase/server";
import ManualEditForm from "./ManualEditForm";

export default async function ManualEditPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; model?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const id = resolved?.id ?? "";
  const modelParam = resolved?.model ?? "";

  const role = parseSessionValue((await cookies()).get(SESSION_COOKIE)?.value ?? null);
  const isAdmin = role === "admin";

  const returnHref = modelParam
    ? `/manuals?model=${encodeURIComponent(modelParam)}`
    : "/manuals";

  if (!isAdmin) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼 수정</h1>
          <p className="text-sm text-slate-600">관리자만 수정할 수 있습니다.</p>
        </header>
        <Link
          href={returnHref}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          매뉴얼 목록으로
        </Link>
      </section>
    );
  }

  if (!hasSupabaseConfig || !supabaseAdmin) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼 수정</h1>
          <p className="text-sm text-slate-600">Supabase 설정이 필요합니다.</p>
        </header>
        <Link
          href={returnHref}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          매뉴얼 목록으로
        </Link>
      </section>
    );
  }

  if (!id) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼 수정</h1>
          <p className="text-sm text-slate-600">수정할 매뉴얼 ID가 없습니다.</p>
        </header>
        <Link
          href={returnHref}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          매뉴얼 목록으로
        </Link>
      </section>
    );
  }

  const { data, error } = await supabaseAdmin
    .from("manuals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼 수정</h1>
          <p className="text-sm text-slate-600">매뉴얼을 찾을 수 없습니다.</p>
        </header>
        <Link
          href={returnHref}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          매뉴얼 목록으로
        </Link>
      </section>
    );
  }

  const entry = {
    id: data.id,
    model: data.model,
    manual_type: data.manual_type,
    section: data.section,
    title: data.title,
    language: data.language,
    pages: data.pages ?? { start: 1, end: 1 },
    source_pdf: data.source_pdf ?? "",
    file: data.file,
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼 수정</h1>
          <Link
            href={returnHref}
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            매뉴얼 목록으로
          </Link>
        </div>
        <p className="text-sm text-slate-600">등록된 매뉴얼 정보를 수정합니다.</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <ManualEditForm entry={entry} />
      </div>
    </section>
  );
}
