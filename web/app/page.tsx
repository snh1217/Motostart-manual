import Link from "next/link";
import models from "../data/models.json";
import ModelSelector from "./ModelSelector";
import { sortModelCodes } from "../lib/modelSort";

type ModelEntry = { id: string; name: string };

type HomeParams = {
  model?: string;
};

const modelCards = sortModelCodes(models as ModelEntry[]);
const keywordChips = [
  "엔진오일 용량",
  "냉각수",
  "브레이크액",
  "플러그",
  "퓨즈",
  "아이들링",
];

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<HomeParams>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const selectedModel =
    resolved?.model && modelCards.some((item) => item.id === resolved.model)
      ? resolved.model
      : "all";

  const scopeLabel =
    selectedModel === "all" ? "전체 모델" : `${selectedModel} 모델`;

  const selectorOptions = [
    { id: "all", label: "전체", href: "/" },
    ...modelCards.map((m) => ({
      id: m.id,
      label: m.id,
      href: `/?model=${m.id}`,
    })),
  ];

  return (
    <section className="space-y-10">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              ZONTES 매뉴얼 허브
            </h1>
            <p className="text-base text-slate-700">
              무엇을 찾고 계신가요? 검색창에 그대로 입력해 주세요.
            </p>
          </div>

          <ModelSelector
            options={selectorOptions}
            selected={selectedModel}
            title="모델 선택 (선택 사항)"
          />
          <p className="text-center text-xs text-slate-500">
            모델을 선택하면 검색 범위가 해당 모델로 좁아집니다. 선택하지 않으면 전체 모델에서 검색됩니다.
          </p>

          <form
            action="/search"
            method="get"
            className="mx-auto w-full max-w-2xl space-y-3"
          >
            <input type="hidden" name="model" value={selectedModel} />
            <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                name="q"
                placeholder="예: 엔진오일 용량, 헤드 토크, 퓨즈, 브레이크액"
                className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="whitespace-nowrap rounded-full bg-slate-900 px-5 py-2.5 text-base font-semibold text-white"
              >
                검색
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>현재 범위</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {scopeLabel}
              </span>
            </div>
          </form>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">
              자주 찾는 검색어
            </div>
            <div className="flex flex-wrap gap-3">
              {keywordChips.map((keyword) => (
                <Link
                  key={keyword}
                  href={`/search?q=${encodeURIComponent(keyword)}&model=${selectedModel}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  {keyword}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-700">바로가기</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href={`/search?q=${encodeURIComponent("토크")}&model=${selectedModel}`}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-base font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                스펙(토크/용량)
                <span className="mt-2 block text-sm font-normal text-slate-600">
                  토크·규격 빠르게 찾기
                </span>
              </Link>
              <Link
                href="/cases"
                className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-base font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                정비사례
                <span className="mt-2 block text-sm font-normal text-slate-600">
                  현장 사례 모음
                </span>
              </Link>
              <Link
                href="/wiring"
                className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-base font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                회로도
                <span className="mt-2 block text-sm font-normal text-slate-600">
                  회로도 바로보기
                </span>
              </Link>
              <Link
                href="/manuals"
                className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-base font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                매뉴얼
                <span className="mt-2 block text-sm font-normal text-slate-600">
                  원문 매뉴얼 목록
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
