import UploadWiringForm from "./UploadWiringForm";

export default function WiringUploadPage() {
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">회로도 업로드</h1>
        <p className="text-sm text-slate-600">
          PDF 또는 이미지를 업로드하면 목록과 매니페스트가 함께 갱신됩니다.
        </p>
      </header>

      {isReadOnly ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          읽기 전용 모드에서는 업로드할 수 없습니다.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <UploadWiringForm readOnly={isReadOnly} />
      </div>
    </section>
  );
}
