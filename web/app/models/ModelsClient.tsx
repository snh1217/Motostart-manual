"use client";

import { useEffect, useMemo, useState } from "react";
import { compareModelCode } from "../../lib/modelSort";

type ModelEntry = {
  id: string;
  name: string;
  parts_engine_url?: string;
  parts_chassis_url?: string;
};

type ModelsClientProps = {
  models: ModelEntry[];
  readOnly: boolean;
};

type Status = "idle" | "loading" | "success" | "error";
type UploadKind = "engine" | "chassis";

const readJsonResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return { error: text || "NON_JSON_RESPONSE" };
};

export default function ModelsClient({ models, readOnly }: ModelsClientProps) {
  const [rows, setRows] = useState<ModelEntry[]>(models);
  const [loadingModels, setLoadingModels] = useState(models.length === 0);
  const [loadError, setLoadError] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [partsEngineUrl, setPartsEngineUrl] = useState("");
  const [partsChassisUrl, setPartsChassisUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

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
      .then(async (response) => ({ response, data: await readJsonResponse(response) }))
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
      setMessage("ADMIN_TOKEN을 입력해 주세요.");
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setModelId("");
    setModelName("");
    setPartsEngineUrl("");
    setPartsChassisUrl("");
    setEditingId(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 저장할 수 없습니다.");
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
      const response = await fetch(editingId ? "/api/models/update" : "/api/models/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          id: modelId.trim(),
          name: modelName.trim(),
          parts_engine_url: partsEngineUrl.trim(),
          parts_chassis_url: partsChassisUrl.trim(),
        }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data?.error ?? "저장 실패");
      }

      setStatus("success");
      setMessage(editingId ? "모델이 수정되었습니다." : "모델이 추가되었습니다.");
      resetForm();
      window.location.reload();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "저장 중 오류가 발생했습니다."
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

      const data = await readJsonResponse(response);
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

  const handleUpload = async (kind: UploadKind, file: File | null) => {
    if (!file) return;
    if (readOnly) {
      setStatus("error");
      setMessage("읽기 전용 모드에서는 업로드할 수 없습니다.");
      return;
    }
    if (!requireAdmin()) return;
    if (!modelId.trim() || !modelName.trim()) {
      setStatus("error");
      setMessage("모델 코드와 이름을 먼저 입력해 주세요.");
      return;
    }

    const normalizedId = modelId.trim().toUpperCase();
    setUploading((prev) => ({ ...prev, [`${normalizedId}-${kind}`]: true }));
    setStatus("loading");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", normalizedId);
      formData.append("kind", kind);

      const uploadRes = await fetch("/api/models/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      });
      const uploadData = await readJsonResponse(uploadRes);
      if (!uploadRes.ok) {
        throw new Error(uploadData?.error ?? "업로드 실패");
      }

      const updateRes = await fetch("/api/models/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          id: normalizedId,
          name: modelName.trim(),
          parts_engine_url:
            kind === "engine" ? uploadData.url : partsEngineUrl.trim(),
          parts_chassis_url:
            kind === "chassis" ? uploadData.url : partsChassisUrl.trim(),
        }),
      });
      const updateData = await readJsonResponse(updateRes);
      if (!updateRes.ok) {
        throw new Error(updateData?.error ?? "저장 실패");
      }

      setPartsEngineUrl(updateData.parts_engine_url ?? "");
      setPartsChassisUrl(updateData.parts_chassis_url ?? "");
      setRows((prev) =>
        prev.map((row) =>
          row.id === normalizedId
            ? {
                ...row,
                parts_engine_url: updateData.parts_engine_url ?? row.parts_engine_url,
                parts_chassis_url: updateData.parts_chassis_url ?? row.parts_chassis_url,
              }
            : row
        )
      );
      setStatus("success");
      setMessage("업로드 완료");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "업로드 오류");
    } finally {
      setUploading((prev) => ({ ...prev, [`${normalizedId}-${kind}`]: false }));
      setStatus("idle");
    }
  };

  const beginEdit = (entry: ModelEntry) => {
    setEditingId(entry.id);
    setModelId(entry.id);
    setModelName(entry.name ?? "");
    setPartsEngineUrl(entry.parts_engine_url ?? "");
    setPartsChassisUrl(entry.parts_chassis_url ?? "");
    setMessage("");
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">모델 관리</h1>
        <p className="text-slate-600">차량 모델 추가/수정/삭제를 진행하세요.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="text-sm font-semibold text-slate-700">
            {editingId ? "모델 수정" : "모델 추가"}
          </div>
          {editingId ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              편집 중: {editingId}
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <input
              type="password"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="ADMIN_TOKEN"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              disabled={readOnly}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                placeholder="모델 코드 (예: 350D)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={readOnly || Boolean(editingId)}
              />
              <input
                type="text"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                placeholder="모델 이름 (예: ZONTES 350D)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={readOnly}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="url"
                value={partsEngineUrl}
                onChange={(event) => setPartsEngineUrl(event.target.value)}
                placeholder="엔진 파츠리스트 PDF URL"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={readOnly}
              />
              <input
                type="url"
                value={partsChassisUrl}
                onChange={(event) => setPartsChassisUrl(event.target.value)}
                placeholder="차대 파츠리스트 PDF URL"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={readOnly}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <span>엔진 파츠리스트 PDF 업로드</span>
                <span className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                  파일 선택
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) =>
                      handleUpload("engine", event.target.files?.[0] ?? null)
                    }
                  />
                </span>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <span>차대 파츠리스트 PDF 업로드</span>
                <span className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                  파일 선택
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) =>
                      handleUpload("chassis", event.target.files?.[0] ?? null)
                    }
                  />
                </span>
              </label>
            </div>
            {(uploading[`${modelId.trim().toUpperCase()}-engine`] ||
              uploading[`${modelId.trim().toUpperCase()}-chassis`]) && (
              <div className="text-xs text-slate-500">업로드 중...</div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={status === "loading" || readOnly}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {status === "loading" ? "저장 중..." : editingId ? "수정 저장" : "추가"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  편집 취소
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">선택 {selectedIds.size}건</div>
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
          className={`text-sm ${status === "error" ? "text-red-600" : "text-slate-600"}`}
        >
          {message}
        </div>
      ) : null}

      {loadError ? <div className="text-sm text-red-600">{loadError}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[720px] text-left text-sm sm:min-w-full">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 font-semibold">모델 코드</th>
              <th className="px-4 py-3 font-semibold">모델 이름</th>
              <th className="px-4 py-3 font-semibold">엔진 파츠리스트</th>
              <th className="px-4 py-3 font-semibold">차대 파츠리스트</th>
              <th className="px-4 py-3 font-semibold">관리</th>
            </tr>
          </thead>
          <tbody>
            {loadingModels ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                  모델을 불러오는 중...
                </td>
              </tr>
            ) : sortedModels.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
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
                  <td className="px-4 py-3 font-medium text-slate-800">{entry.id}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.name}</td>
                  <td className="px-4 py-3">
                    {entry.parts_engine_url ? (
                      <a
                        href={entry.parts_engine_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        열기
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">미등록</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.parts_chassis_url ? (
                      <a
                        href={entry.parts_chassis_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        열기
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">미등록</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(entry)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete([entry.id])}
                        disabled={status === "loading" || readOnly}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                      >
                        삭제
                      </button>
                    </div>
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
