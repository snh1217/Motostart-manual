import Link from "next/link";
import models from "../data/models.json";
import type { ModelCode } from "../lib/types";

const modelCards = models as Array<{ id: ModelCode; name: string }>;

export default function HomePage() {
  return (
    <section className="space-y-10">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              ZONTES 매뉴얼 허브
            </h1>
            <p className="text-sm text-slate-600">
              필요한 정보만 빠르게 찾는 정비용 인덱스
            </p>
          </div>

          <form
            action="/search"
            method="get"
            className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2"
          >
            <input
              name="q"
              placeholder="예: 헤드 토크값, 드레인볼트"
              className="w-full bg-transparent text-sm text-slate-700 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white"
            >
              검색
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">모델 선택</h2>
          <span className="text-xs text-slate-500">
            바로 매뉴얼로 이동합니다.
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {modelCards.map((model) => (
            <Link
              key={model.id}
              href={`/manuals?model=${model.id}`}
              className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
            >
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {model.id}
              </span>
              {model.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}