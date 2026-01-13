"use client";

import { useEffect, useState } from "react";
import type { DiagnosticEntry } from "../../lib/types";
import AdminForm from "./AdminForm";

type DiagnosticsAdminShellProps = {
  readOnly: boolean;
  saveTargetLabel: string;
  selectedModel: string;
  initialEntry: DiagnosticEntry | null;
  initialOpen: boolean;
  modeLabel: string;
  modeTone: string;
  modeHelp: string;
  connectionTone: string;
  connectionLabel: string;
  isReadOnly: boolean;
  dbCount: number;
  jsonCount: number;
  jsonHash: string;
  latestUpdated: string;
};

export default function DiagnosticsAdminShell({
  readOnly,
  saveTargetLabel,
  selectedModel,
  initialEntry,
  initialOpen,
  modeLabel,
  modeTone,
  modeHelp,
  connectionTone,
  connectionLabel,
  isReadOnly,
  dbCount,
  jsonCount,
  jsonHash,
  latestUpdated,
}: DiagnosticsAdminShellProps) {
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    if (initialEntry?.id) {
      setOpen(true);
    }
  }, [initialEntry?.id]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">관리자 입력</h2>
          <p className="text-sm text-slate-600">관리자 로그인 상태에서 저장됩니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
        >
          {open ? "닫기" : "열기"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 ${modeTone}`}>{modeLabel}</span>
        <span className="text-slate-500">{modeHelp}</span>
        <span className="flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
          <span className={`h-2 w-2 rounded-full ${connectionTone}`} />
          {connectionLabel}
        </span>
        {isReadOnly ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
            읽기 전용 모드
          </span>
        ) : null}
        <span className="text-slate-500">
          DB: {dbCount}건 / JSON: {jsonCount}건 · 최근 업데이트: {latestUpdated} · JSON 해시:{" "}
          {jsonHash}
        </span>
      </div>

      {open ? (
        <div className="mt-4">
          <AdminForm
            readOnly={readOnly}
            saveTargetLabel={saveTargetLabel}
            initialEntry={initialEntry}
            selectedModel={selectedModel}
            onSaved={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </div>
      ) : null}
    </section>
  );
}
