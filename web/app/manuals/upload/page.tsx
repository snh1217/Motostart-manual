import Link from "next/link";
import UploadManualForm from "./UploadManualForm";

export default function ManualUploadPage() {
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">매뉴얼 업로드</h1>
          <Link
            href="/manuals"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            매뉴얼 목록으로
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          PDF 업로드 후 매뉴얼 목록에 등록됩니다. (Supabase manuals 테이블 사용)
        </p>
      </header>

      {isReadOnly ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          읽기 전용 모드에서는 업로드할 수 없습니다.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <UploadManualForm readOnly={isReadOnly} />
      </div>
    </section>
  );
}
