"use client";

import { useRef } from "react";

const systemLabels: Record<string, string> = {
  all: "전체",
  engine: "엔진",
  chassis: "차체",
  electrical: "전장",
  other: "기타",
};

export default function PartFilters({
  model,
  system,
  modelOptions,
  q,
  view,
}: {
  model: string;
  system: string;
  modelOptions: string[];
  q: string;
  view: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleViewChange = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      method="get"
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600">보기 형식</div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "data", label: "데이터뷰" },
            { id: "card", label: "카드뷰" },
            { id: "list", label: "리스트뷰" },
          ].map((option) => (
            <label key={option.id} className="cursor-pointer">
              <input
                type="radio"
                name="view"
                value={option.id}
                defaultChecked={view === option.id}
                onChange={handleViewChange}
                className="peer sr-only"
              />
              <span className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 transition peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600">모델 선택</div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "전체" },
            ...modelOptions.map((item) => ({ id: item, label: item })),
          ].map((option) => (
            <label key={option.id} className="cursor-pointer">
              <input
                type="radio"
                name="model"
                value={option.id}
                defaultChecked={model === option.id}
                className="peer sr-only"
              />
              <span className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 transition peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600">시스템 선택</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(systemLabels).map(([id, label]) => (
            <label key={id} className="cursor-pointer">
              <input
                type="radio"
                name="system"
                value={id}
                defaultChecked={system === id}
                className="peer sr-only"
              />
              <span className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 transition peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder="예: 클러치 커버, 점화코일, 볼트"
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          검색
        </button>
      </div>
    </form>
  );
}
