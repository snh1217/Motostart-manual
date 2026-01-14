import ModelSelector from "../ModelSelector";
import DiagnosisClient from "./DiagnosisClient";
import { loadModels } from "../../lib/models";
import { loadActiveDiagnosisTrees } from "../../lib/diagnosisTrees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DiagnosisPage({
  searchParams,
}: {
  searchParams?: Promise<{ model?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const models = await loadModels();
  const modelIds = models.map((model) => model.id);
  const selectedParam = resolved?.model ?? "all";
  const selectedModel = modelIds.includes(selectedParam) ? selectedParam : "all";

  const modelOptions = [
    { id: "all", label: "모델 선택", href: "/diagnosis" },
    ...modelIds.map((id) => ({
      id,
      label: id,
      href: `/diagnosis?model=${encodeURIComponent(id)}`,
    })),
  ];

  const trees = await loadActiveDiagnosisTrees();
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">정비진단</h1>
        <p className="text-sm text-slate-600">
          모델을 선택한 뒤 증상에 맞는 진단 항목을 따라 예/아니오 질문을 진행하세요.
        </p>
        <ModelSelector options={modelOptions} selected={selectedModel} title="모델 선택 (필수)" />
      </header>

      <DiagnosisClient selectedModel={selectedModel} trees={trees} />
    </section>
  );
}
