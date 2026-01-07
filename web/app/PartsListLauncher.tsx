"use client";

import { useEffect, useMemo, useState } from "react";

type ModelEntry = {
  id: string;
  name?: string;
  parts_engine_url?: string;
  parts_chassis_url?: string;
};

type PartsItem = {
  id: string;
  name?: string;
  engineUrl?: string;
  chassisUrl?: string;
};

const fetchModels = async (): Promise<ModelEntry[]> => {
  const response = await fetch("/api/models", { cache: "no-store" });
  if (!response.ok) throw new Error("LOAD_FAILED");
  const data = await response.json();
  return Array.isArray(data?.models) ? data.models : [];
};

export default function PartsListLauncher() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PartsItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    fetchModels()
      .then((models) => {
        if (!active) return;
        const filtered = models
          .map((model) => ({
            id: model.id,
            name: model.name,
            engineUrl: model.parts_engine_url || undefined,
            chassisUrl: model.parts_chassis_url || undefined,
          }))
          .filter((model) => model.engineUrl || model.chassisUrl);
        setItems(filtered);
      })
      .catch(() => {
        if (active) setError("파츠리스트를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const title = useMemo(() => {
    if (loading) return "불러오는 중...";
    if (error) return "오류";
    return "파츠리스트 선택";
  }, [loading, error]);

  const openUrl = (url?: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
      >
        파츠리스트
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-8">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                <p className="text-sm text-slate-600">
                  등록된 파츠리스트가 있는 모델만 표시됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
              >
                닫기
              </button>
            </div>

            {loading ? (
              <div className="mt-6 text-sm text-slate-500">로딩 중...</div>
            ) : error ? (
              <div className="mt-6 text-sm text-red-600">{error}</div>
            ) : items.length === 0 ? (
              <div className="mt-6 text-sm text-slate-500">
                등록된 파츠리스트가 없습니다.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {item.id}
                    </div>
                    {item.name ? (
                      <div className="text-xs text-slate-500">{item.name}</div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.engineUrl ? (
                        <button
                          type="button"
                          onClick={() => openUrl(item.engineUrl)}
                          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          엔진 파츠리스트
                        </button>
                      ) : null}
                      {item.chassisUrl ? (
                        <button
                          type="button"
                          onClick={() => openUrl(item.chassisUrl)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          차대 파츠리스트
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
