import Link from "next/link";

export type ModelOption = { id: string; label: string; href: string };

type ModelSelectorProps = {
  options: ModelOption[];
  selected: string;
  title?: string;
};

export default function ModelSelector({
  options,
  selected,
  title = "모델 선택",
}: ModelSelectorProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
        {options.map((opt) => (
          <Link
            key={opt.id}
            href={opt.href}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              selected === opt.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
