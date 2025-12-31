import Link from "next/link";
import { headers } from "next/headers";
import { getManualFileUrl } from "../../lib/manuals";
import { getTranslationByEntryId } from "../../lib/translation";
import type { TranslationItem } from "../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buildApiUrl = async (query: string) => {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}/api/translations?${query}` : `/api/translations?${query}`;
};

const inferModel = (entryId: string) => {
  const upper = entryId.toUpperCase();
  if (upper.includes("350D")) return "350D";
  if (upper.includes("350GK")) return "350GK";
  if (upper.includes("368G")) return "368G";
  if (upper.includes("368E")) return "368E";
  if (upper.includes("310M")) return "310M";
  if (upper.includes("125C")) return "125C";
  if (upper.includes("125D")) return "125D";
  if (upper.includes("125E")) return "125E";
  if (upper.includes("125M")) return "125M";
  return "UNKNOWN";
};

const loadTranslation = async (entryId: string, model?: string) => {
  try {
    const params = new URLSearchParams();
    params.set("entryId", entryId);
    if (model) params.set("model", model);
    const apiUrl = await buildApiUrl(params.toString());
    const response = await fetch(apiUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { items?: TranslationItem[] };
    return data.items?.[0] ?? null;
  } catch {
    return null;
  }
};

export default async function ViewerPage({
  searchParams,
}: {
  searchParams?: {
    entryId?: string;
    file?: string;
    title?: string;
    page?: string;
    model?: string;
  };
}) {
  const entryId = searchParams?.entryId ?? "";
  const file = searchParams?.file ?? "";
  const title = searchParams?.title ?? "매뉴얼";
  const page = searchParams?.page;
  const model = searchParams?.model ?? (entryId ? inferModel(entryId) : undefined);

  const pageHash = page ? `#page=${page}` : "";
  const fileUrl = file ? getManualFileUrl(file) : "";
  const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  const cacheBust =
    process.env.MANUALS_CACHE_BUST ?? process.env.MANUALS_VERSION ?? "";
  const proxiedUrl = fileUrl
    ? `/api/proxy-pdf?url=${encodeURIComponent(fileUrl)}${
        cacheBust ? `&v=${encodeURIComponent(cacheBust)}` : ""
      }`
    : "";
  const pdfUrl = isPreview ? proxiedUrl : fileUrl;
  const src = pdfUrl ? `${pdfUrl}${pageHash}` : "";

  const translation = entryId
    ? (await loadTranslation(entryId, model)) ?? (await getTranslationByEntryId(entryId))
    : null;

  const returnTo = entryId && file
    ? `/viewer?entryId=${encodeURIComponent(entryId)}&file=${encodeURIComponent(file)}&title=${encodeURIComponent(title)}&page=${encodeURIComponent(page ?? "")}`
    : "/viewer";

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-slate-600">
          {file ? `파일: ${file}` : "파일 정보가 없습니다."}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {src ? (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:border-slate-300"
          >
            원본 보기
          </a>
        ) : null}
      </div>

      {!src ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
          표시할 문서가 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[80vh] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <iframe title={title} src={src} className="h-full w-full" />
          </div>
          <div className="h-[80vh] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
            {translation ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-400">번역 제목</div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {translation.title_ko ?? "번역 제목 없음"}
                  </h2>
                </div>
                {translation.summary_ko ? (
                  <div>
                    <div className="text-xs text-slate-400">요약</div>
                    <p className="mt-1 text-sm text-slate-700">
                      {translation.summary_ko}
                    </p>
                  </div>
                ) : null}
                {translation.text_ko ? (
                  <div>
                    <div className="text-xs text-slate-400">전체 번역</div>
                    <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {translation.text_ko}
                    </pre>
                  </div>
                ) : null}
                {translation.updated_at ? (
                  <div className="text-xs text-slate-400">
                    업데이트: {translation.updated_at}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full flex-col justify-between text-sm text-slate-600">
                <div>
                  <p className="font-semibold">번역 없음</p>
                  <p className="mt-2">
                    번역 요청/추가가 필요하다면 아래 버튼으로 바로 입력하세요.
                  </p>
                  <div className="mt-4">
                    <Link
                      href={`/translations/new?entryId=${encodeURIComponent(entryId)}&title=${encodeURIComponent(title)}&returnTo=${encodeURIComponent(returnTo)}&model=${encodeURIComponent(model ?? "")}`}
                      className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      번역 추가
                    </Link>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                  PDF에서 필요한 문장을 복사해 붙여 넣고 요약을 작성하세요.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
