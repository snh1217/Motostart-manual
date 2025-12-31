import Link from "next/link";
import wiringData from "../../../data/wiring_manifest.json";
import WiringViewer from "./WiringViewer";

const wiringEntries = wiringData as Array<{
  id: string;
  model: string;
  title: string;
  tags: string[];
  note?: string;
  file: string;
}>;

export default async function WiringDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const entry = wiringEntries.find((item) => item.id === resolvedParams.id);
  const lowerFile = entry?.file.toLowerCase() ?? "";
  const isImage =
    lowerFile.endsWith(".png") ||
    lowerFile.endsWith(".jpg") ||
    lowerFile.endsWith(".jpeg");

  if (!entry) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">회로도</h1>
        <p className="text-slate-600">회로도를 찾을 수 없습니다.</p>
        <Link className="text-sm text-slate-500 underline" href="/wiring">
          목록으로 돌아가기
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link className="text-sm text-slate-500 underline" href="/wiring">
          목록으로 돌아가기
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
            {entry.model}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
            {entry.title}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">{entry.title}</h1>
        {entry.note ? (
          <p className="text-sm text-slate-600">{entry.note}</p>
        ) : null}
      </header>

      <div className="flex items-center gap-3 text-sm">
        <a
          href={entry.file}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:border-slate-300"
        >
          새 탭에서 열기
        </a>
      </div>

      <WiringViewer file={entry.file} title={entry.title} isImage={isImage} />
    </section>
  );
}
