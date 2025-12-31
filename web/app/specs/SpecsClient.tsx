"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModelCode, SpecRow } from "../../lib/types";

const categoryTabs = [
  { id: "all", label: "전체" },
  { id: "torque", label: "Torque" },
  { id: "oil", label: "Oil" },
  { id: "clearance", label: "Clearance" },
  { id: "consumable", label: "Consumable" },
];

type SpecsClientProps = {
  specs: SpecRow[];
  modelList: Array<{ id: ModelCode; name: string }>;
  initialModel: ModelCode | "all";
  initialCategory: string;
  readOnly: boolean;
};

export default function SpecsClient({
  specs,
  modelList,
  initialModel,
  initialCategory,
  readOnly,
}: SpecsClientProps) {
  const [selectedModel, setSelectedModel] = useState<ModelCode | "all">(
    initialModel
  );
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return categoryTabs.some((tab) => tab.id === initialCategory)
      ? initialCategory
      : "all";
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adminToken, setAdminToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) {
      setAdminToken(stored);
      setIsAdmin(Boolean(stored.trim()));
    }
  }, []);

  useEffect(() => {
    if (!adminToken) return;
    localStorage.setItem("ADMIN_TOKEN", adminToken);
    setIsAdmin(Boolean(adminToken.trim()));
  }, [adminToken]);

  const filteredSpecs = useMemo(() => {
    return specs.filter((row) => {
      const matchesModel =
        selectedModel === "all" || row.model === selectedModel;
      const matchesCategory =
        selectedCategory === "all" || row.category === selectedCategory;
      return matchesModel && matchesCategory;
    });
  }, [specs, selectedModel, selectedCategory]);

  const allSelected =
    filteredSpecs.length > 0 &&
    filteredSpecs.every((row) => selectedIds.has(row.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredSpecs.map((row) => row.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 업로드할 수 없습니다.");
      return;
    }

    if (!uploadFile) {
      setStatus("error");
      setMessage("엑셀 또는 CSV 파일을 선택해 주세요.");
      return;
    }

    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("Admin_Key를 입력해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const response = await fetch("/api/specs/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "업로드 실패");
      }

      setStatus("success");
      setMessage(
        `업로드 완료: 추가 ${data.imported}건 / 갱신 ${data.updated}건 / 총 ${data.total}건`
      );
      setUploadFile(null);
      (event.target as HTMLFormElement).reset();
      window.location.reload();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "업로드 중 오류가 발생했습니다."
      );
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 삭제할 수 없습니다.");
      return;
    }

    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("Admin_Key를 입력해 주세요.");
      return;
    }

    if (ids.length === 0) {
      setStatus("error");
      setMessage("삭제할 항목을 선택해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/specs/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ ids }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "삭제 실패");
      }

      setStatus("success");
      setMessage(`삭제 완료: ${data.deleted}건`);
      setSelectedIds(new Set());
      window.location.reload();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">스펙</h1>
        <p className="text-slate-600">모델별 핵심 스펙을 빠르게 확인하세요.</p>
      </header>

      {isAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <form onSubmit={handleUpload} className="space-y-3">
            <div className="text-sm font-semibold text-slate-700">
              엑셀 업로드
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="password"
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="관리자코드"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={readOnly}
              />
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) =>
                  setUploadFile(event.target.files?.[0] ?? null)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={readOnly}
              />
              <button
                type="submit"
                disabled={status === "loading" || readOnly}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {status === "loading" ? "업로드 중..." : "업로드"}
              </button>
            </div>
            <div className="text-xs text-slate-500">
              필드: model, category, item, value, note, id (선택)
            </div>
          </form>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">모델</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedModel("all")}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              selectedModel === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            전체
          </button>
          {modelList.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => setSelectedModel(model.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                selectedModel === model.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {model.id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedCategory(tab.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              selectedCategory === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            선택 {selectedIds.size}건
          </div>
          <button
            type="button"
            onClick={() => handleDelete(Array.from(selectedIds))}
            disabled={status === "loading" || readOnly}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
          >
            선택 삭제
          </button>
        </div>
      ) : null}

      {message ? (
        <div
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-slate-600"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              {isAdmin ? (
                <th className="px-4 py-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-semibold">모델</th>
              <th className="px-4 py-3 font-semibold">카테고리</th>
              <th className="px-4 py-3 font-semibold">항목</th>
              <th className="px-4 py-3 font-semibold">값</th>
              <th className="px-4 py-3 font-semibold">비고</th>
              {isAdmin ? (
                <th className="px-4 py-3 font-semibold">삭제</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filteredSpecs.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-slate-500"
                  colSpan={isAdmin ? 7 : 5}
                >
                  표시할 스펙이 없습니다.
                </td>
              </tr>
            ) : (
              filteredSpecs.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                      />
                    </td>
                  ) : null}
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
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete([row.id])}
                        disabled={status === "loading" || readOnly}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                      >
                        삭제
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
