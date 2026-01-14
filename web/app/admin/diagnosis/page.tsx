import DiagnosisTreeAdmin from "./DiagnosisTreeAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DiagnosisAdminPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">진단 트리 관리</h1>
        <p className="text-sm text-slate-600">
          JSON 파일을 업로드하면 정비진단 트리가 갱신됩니다.
        </p>
      </header>
      <DiagnosisTreeAdmin />
    </section>
  );
}
