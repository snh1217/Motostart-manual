"use client";

import { useEffect, useState } from "react";

type TreeSummary = {
  treeId: string;
  title: string;
  category: string;
  supportedModels: string[];
  nodeCount: number;
  version?: number;
  isActive?: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
  source?: string;
  errors: string[];
  warnings: string[];
};

type UploadResult = {
  imported: number;
  results: Array<{
    treeId: string;
    status: string;
    errors?: string[];
    warnings?: string[];
  }>;
};

export default function DiagnosisTreeAdmin() {
  const [adminToken, setAdminToken] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [trees, setTrees] = useState<TreeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ADMIN_TOKEN");
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (adminToken) localStorage.setItem("ADMIN_TOKEN", adminToken);
  }, [adminToken]);

  const loadTrees = async () => {
    if (!adminToken.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/diagnosis/trees", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const raw = await response.text();
      const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(data?.error ?? "목록을 불러오지 못했습니다.");
      }
      setTrees((data.items ?? []) as TreeSummary[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken.trim()) {
      void loadTrees();
    }
  }, [adminToken]);

  const toggleActive = async (treeId: string, isActive: boolean) => {
    if (!adminToken.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/diagnosis/trees", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ treeId, isActive }),
      });
      const raw = await response.text();
      const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(data?.error ?? "활성화 변경 실패");
      }
      await loadTrees();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "활성화 변경 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminToken.trim()) {
      setMessage("관리자 코드를 입력해 주세요.");
      return;
    }
    if (!file) {
      setMessage("JSON 파일을 선택해 주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/diagnosis/trees", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      });
      const raw = await response.text();
      const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(data?.error ?? "업로드 실패");
      }
      setUploadResult(data as UploadResult);
      setMessage("진단 트리 업로드가 완료되었습니다.");
      setFile(null);
      (event.target as HTMLFormElement).reset();
      await loadTrees();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="관리자 코드"
          className="w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={loadTrees}
          disabled={loading || !adminToken.trim()}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
        >
          목록 새로고침
        </button>
      </div>

      <form onSubmit={handleUpload} className="space-y-3">
        <input
          type="file"
          accept=".json"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "업로드 중..." : "JSON 업로드"}
        </button>
      </form>
      <p className="text-[11px] text-slate-500">
        업로드 시 같은 tree_id는 version이 증가합니다. 롤백은 이전 JSON을 다시 업로드해
        복원하세요.
      </p>

      {message ? (
        <div className="text-sm text-slate-600">{message}</div>
      ) : null}

      {uploadResult?.results?.length ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          업로드 결과: {uploadResult.imported}건 저장
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-700">현재 등록된 트리</div>
        {trees.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {trees.map((tree) => (
              <div
                key={tree.treeId}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800">{tree.title}</div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                    {tree.nodeCount} nodes
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {tree.source ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                      {tree.source.toUpperCase()}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      tree.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100"
                    }`}
                  >
                    {tree.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                  {typeof tree.version === "number" ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                      v{tree.version}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">
                  <span className="font-semibold">Tree ID:</span> {tree.treeId}
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Category:</span> {tree.category}
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Models:</span>{" "}
                  {tree.supportedModels.join(", ")}
                </div>
                {tree.updatedAt ? (
                  <div className="mt-1">
                    <span className="font-semibold">Updated:</span> {tree.updatedAt}
                  </div>
                ) : null}
                {tree.updatedBy ? (
                  <div className="mt-1">
                    <span className="font-semibold">Updated by:</span> {tree.updatedBy}
                  </div>
                ) : null}
                {tree.source === "db" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(tree.treeId, !tree.isActive)}
                      disabled={loading}
                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                    >
                      {tree.isActive ? "비활성화" : "활성화"}
                    </button>
                  </div>
                ) : null}
                {tree.errors.length ? (
                  <div className="mt-2 text-rose-600">
                    오류: {tree.errors.join(" / ")}
                  </div>
                ) : null}
                {tree.warnings.length ? (
                  <div className="mt-2 text-amber-600">
                    경고: {tree.warnings.join(" / ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            등록된 진단 트리가 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}
