import Link from "next/link";
import specsData from "../../data/specs.json";
import modelsData from "../../data/models.json";
import type { ModelCode, SpecRow } from "../../lib/types";

const knownModels: ModelCode[] = ["350D", "368G", "125M"];
const categoryTabs = [
  { id: "all", label: "전체" },
  { id: "torque", label: "Torque" },
  { id: "oil", label: "Oil" },
  { id: "clearance", label: "Clearance" },
  { id: "consumable", label: "Consumable" },
];

const modelList = modelsData as Array<{ id: ModelCode; name: string }>;
const specs = specsData as SpecRow[];

export default async function SpecsPage({
  searchParams,
}: {
  searchParams?: Promise<{ model?: string; category?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const modelParam = resolvedSearchParams?.model;
  const categoryParam = resolvedSearchParams?.category;

  const selectedModel = knownModels.includes(modelParam as ModelCode)
    ? (modelParam as ModelCode)
    : "all";
  const selectedCategory = categoryTabs.some((tab) => tab.id === categoryParam)
    ? (categoryParam as string)
    : "all";

  const filteredSpecs = specs.filter((row) => {
    const matchesModel = selectedModel === "all" || row.model === selectedModel;
    const matchesCategory =
      selectedCategory === "all" || row.category === selectedCategory;
    return matchesModel && matchesCategory;
  });

  const buildQuery = (nextModel: string, nextCategory: string) => {
    const params = new URLSearchParams();
    if (nextModel !== "all") params.set("model", nextModel);
    if (nextCategory !== "all") params.set("category", nextCategory);
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">스펙</h1>
        <p className="text-slate-600">모델별 핵심 스펙을 빠르게 확인하세요.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">모델</span>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/specs${buildQuery("all", selectedCategory)}`}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              selectedModel === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            전체
          </Link>
          {modelList.map((model) => (
            <Link
              key={model.id}
              href={`/specs${buildQuery(model.id, selectedCategory)}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                selectedModel === model.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {model.id}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {categoryTabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/specs${buildQuery(selectedModel, tab.id)}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              selectedCategory === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">모델</th>
              <th className="px-4 py-3 font-semibold">카테고리</th>
              <th className="px-4 py-3 font-semibold">항목</th>
              <th className="px-4 py-3 font-semibold">값</th>
              <th className="px-4 py-3 font-semibold">비고</th>
            </tr>
          </thead>
          <tbody>
            {filteredSpecs.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-slate-500"
                  colSpan={5}
                >
                  표시할 스펙이 없습니다.
                </td>
              </tr>
            ) : (
              filteredSpecs.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.model}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.category}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{row.item}</td>
                  <td className="px-4 py-3 text-slate-800">{row.value}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.note ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
