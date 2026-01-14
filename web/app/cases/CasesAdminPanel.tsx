"use client";

import { useEffect, useState } from "react";
import UploadForm from "./UploadForm";

type CasesAdminPanelProps = {
  readOnly: boolean;
  selectedModel: string;
};

export default function CasesAdminPanel({ readOnly, selectedModel }: CasesAdminPanelProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const update = () => {
      const stored = localStorage.getItem("ADMIN_TOKEN");
      setIsAdmin(Boolean(stored && stored.trim()));
    };

    update();
    const handler = () => update();
    window.addEventListener("admin-token-changed", handler);
    return () => window.removeEventListener("admin-token-changed", handler);
  }, []);

  if (!isAdmin) return null;

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">양식 다운로드</h2>
        <p className="mt-1 text-sm text-slate-600">
          엑셀 또는 CSV 양식을 내려받아 작성하세요.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/cases_template.xlsx"
          >
            양식 다운로드(엑셀)
          </a>
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            href="/templates/cases_template.csv"
          >
            양식 다운로드(CSV)
          </a>
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          ??: model, title(or symptom), fixSteps(or action) / ??: category,
          symptomTitle, diagnosisTreeId, diagnosisResultId, tags, references
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">업로드</h2>
        <p className="mt-1 text-sm text-slate-600">
          CSV 또는 XLSX 파일을 업로드하세요.
        </p>
        <div className="mt-4">
          <UploadForm readOnly={readOnly} selectedModel={selectedModel} />
        </div>
      </section>
    </>
  );
}
