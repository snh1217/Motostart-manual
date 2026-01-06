"use client";

import { useEffect, useMemo, useState } from "react";
import { compareModelCode } from "../../lib/modelSort";

type ModelEntry = { id: string; name: string };

type ModelsClientProps = {
  models: ModelEntry[];
  readOnly: boolean;
};

export default function ModelsClient({ models, readOnly }: ModelsClientProps) {
  const [rows, setRows] = useState<ModelEntry[]>(models);
  const [loadingModels, setLoadingModels] = useState(models.length === 0);
  const [loadError, setLoadError] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (!adminToken) return;
    localStorage.setItem("ADMIN_TOKEN", adminToken);
  }, [adminToken]);

  useEffect(() => {
    if (models.length) {
      setRows(models);
      setLoadingModels(false);
      return;
    }

    let active = true;
    setLoadingModels(true);
    setLoadError("");

    fetch("/api/models", { cache: "no-store" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) {
          throw new Error(data?.error ?? "모델을 불러오지 못했습니다.");
        }
        if (!active) return;
        setRows(Array.isArray(data?.models) ? data.models : []);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "모델을 불러오지 못했습니다."
        );
      })
      .finally(() => {
        if (active) setLoadingModels(false);
      });

    return () => {
      active = false;
    };
  }, [models]);

  const sortedModels = useMemo(() => {
    return [...rows].sort((a, b) => compareModelCode(a.id, b.id));
  }, [rows]);

  const allSelected =
    sortedModels.length > 0 &&
    sortedModels.every((entry) => selectedIds.has(entry.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(sortedModels.map((entry) => entry.id)));
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

  const requireAdmin = () => {
    if (!adminToken.trim()) {
      setStatus("error");
      setMessage("Admin_Key를 입력해 주세요.");
      return false;
    }
    return true;
  };

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 추가할 수 없습니다.");
      return;
    }

    if (!requireAdmin()) return;

    if (!modelId.trim() || !modelName.trim()) {
      setStatus("error");
      setMessage("모델 코드와 이름을 입력해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/models/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          id: modelId.trim(),
          name: modelName.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "추가 실패");
      }

      setStatus("success");
      setMessage("모델이 추가되었습니다.");
      setModelId("");
      setModelName("");
      window.location.reload();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "추가 중 오류가 발생했습니다."
      );
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 삭제할 수 없습니다.");
      return;
    }

    if (!requireAdmin()) return;

    if (ids.length === 0) {
      setStatus("error");
      setMessage("삭제할 항목을 선택해 주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/models/delete", {
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
        <h1 className="text-2xl font-semibold tracking-tight">모델 관리</h1>
        <p className="text-slate-600">차량 모델을 추가하거나 삭제하세요.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="text-sm font-semibold text-slate-700">모델 추가</div>
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
              type="text"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              placeholder="모델 코드 (예: 350D)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              disabled={readOnly}
            />
            <input
              type="text"
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              placeholder="모델 이름 (예: ZONTES 350D)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              disabled={readOnly}
            />
            <button
              type="submit"
              disabled={status === "loading" || readOnly}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {status === "loading" ? "추가 중..." : "추가"}
            </button>
          </div>
        </form>
      </section>

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

      {message ? (
        <div
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-slate-600"
          }`}
        >
          {message}
        </div>
      ) : null}

      {loadError ? (
        <div className="text-sm text-red-600">{loadError}</div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[640px] text-left text-sm sm:min-w-full">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 font-semibold">모델 코드</th>
              <th className="px-4 py-3 font-semibold">모델 이름</th>
              <th className="px-4 py-3 font-semibold">삭제</th>
            </tr>
          </thead>
          <tbody>
            {loadingModels ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-slate-500"
                  colSpan={4}
                >
                  모델 불러오는 중...
                </td>
              </tr>
            ) : sortedModels.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-slate-500"
                  colSpan={4}
                >
                  등록된 모델이 없습니다.
                </td>
              </tr>
            ) : (
              sortedModels.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleOne(entry.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {entry.id}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{entry.name}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleDelete([entry.id])}
                      disabled={status === "loading" || readOnly}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
