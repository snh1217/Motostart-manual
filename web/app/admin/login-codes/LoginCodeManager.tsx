"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";
type FilterMode = "all" | "active" | "inactive";

type LoginCodes = {
  adminLoginToken: string;
  userCodes: UserLoginCode[];
};

type UserLoginCode = {
  id: string;
  name: string;
  code: string;
  memo?: string;
  active?: boolean;
};

const emptyCodes: LoginCodes = {
  adminLoginToken: "",
  userCodes: [],
};

const generateCode = (prefix: string) => {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}-${token}`;
};

const escapeCsv = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

export default function LoginCodeManager() {
  const [codes, setCodes] = useState<LoginCodes>(emptyCodes);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [showUser, setShowUser] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");

  useEffect(() => {
    const loadCodes = async () => {
      setStatus("loading");
      setMessage("");
      try {
        const res = await fetch("/api/auth/codes", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "불러오기 실패");
        setCodes({
          adminLoginToken: data?.adminLoginToken ?? "",
          userCodes: Array.isArray(data?.userCodes) ? data.userCodes : [],
        });
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "불러오기 오류");
      }
    };
    void loadCodes();
  }, []);

  const createId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };

  const updateUserCode = (id: string, patch: Partial<UserLoginCode>) => {
    setCodes((prev) => ({
      ...prev,
      userCodes: (prev.userCodes ?? []).map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      ),
    }));
  };

  const addUserCode = () => {
    setCodes((prev) => ({
      ...prev,
      userCodes: [
        ...(prev.userCodes ?? []),
        {
          id: createId(),
          name: "",
          code: "",
          memo: "",
          active: true,
        },
      ],
    }));
  };

  const removeUserCode = (id: string) => {
    setCodes((prev) => ({
      ...prev,
      userCodes: (prev.userCodes ?? []).filter((entry) => entry.id !== id),
    }));
  };

  const handleSave = async () => {
    setStatus("loading");
    setMessage("");
    const trimmedCodes = (codes.userCodes ?? []).map((entry) => ({
      ...entry,
      name: entry.name.trim(),
      code: entry.code.trim(),
      memo: entry.memo?.trim() ?? "",
      active: entry.active !== false,
    }));
    const invalid = trimmedCodes.find((entry) => !entry.name || !entry.code);
    if (invalid) {
      setStatus("error");
      setMessage("일반 로그인 코드는 이름과 코드를 모두 입력해야 합니다.");
      return;
    }
    try {
      const res = await fetch("/api/auth/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          adminLoginToken: codes.adminLoginToken.trim(),
          userCodes: trimmedCodes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "저장 실패");
      setCodes({
        adminLoginToken: data?.adminLoginToken ?? "",
        userCodes: Array.isArray(data?.userCodes) ? data.userCodes : [],
      });
      setStatus("success");
      setMessage("로그인 코드가 저장되었습니다.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "저장 오류");
    }
  };

  const handleExportCsv = () => {
    const rows = (codes.userCodes ?? []).map((entry) => [
      entry.name ?? "",
      entry.code ?? "",
      entry.memo ?? "",
      entry.active === false ? "false" : "true",
    ]);
    const lines = [
      ["name", "code", "memo", "active"],
      ...rows,
    ].map((cols) => cols.map((value) => escapeCsv(String(value))).join(","));
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "login_codes.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const userCodes = codes.userCodes ?? [];
  const activeCount = userCodes.filter((entry) => entry.active !== false).length;
  const inactiveCount = userCodes.length - activeCount;
  const filteredCodes = userCodes.filter((entry) => {
    if (filter === "active") return entry.active !== false;
    if (filter === "inactive") return entry.active === false;
    return true;
  });

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">로그인 코드 관리</h2>
        <p className="text-sm text-slate-600">
          변경 사항은 즉시 적용됩니다. 관리자 코드를 바꾸면 새 코드로 다시 로그인해야
          합니다.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">일반 로그인 코드 목록</div>
              <div className="text-xs text-slate-500">
                대리점/협력사별로 이름과 코드를 등록합니다.
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>전체 {userCodes.length}</span>
              <span>·</span>
              <span>활성 {activeCount}</span>
              <span>·</span>
              <span>비활성 {inactiveCount}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  filter === "all"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setFilter("active")}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  filter === "active"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                활성
              </button>
              <button
                type="button"
                onClick={() => setFilter("inactive")}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  filter === "inactive"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                비활성
              </button>
            </div>
            {filteredCodes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                {userCodes.length === 0
                  ? "등록된 일반 로그인 코드가 없습니다. \"코드 추가\"로 시작하세요."
                  : "선택한 조건에 해당하는 코드가 없습니다."}
              </div>
            ) : null}
            {filteredCodes.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <div className="grid gap-2 md:grid-cols-[1fr_1.1fr_1fr_auto_auto] md:items-center">
                  <input
                    type="text"
                    value={entry.name}
                    onChange={(event) =>
                      updateUserCode(entry.id, { name: event.target.value })
                    }
                    placeholder="이름 (예: 서울대리점)"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type={showUser ? "text" : "password"}
                      value={entry.code}
                      onChange={(event) =>
                        updateUserCode(entry.id, { code: event.target.value })
                      }
                      placeholder="코드"
                      className="w-full flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateUserCode(entry.id, { code: generateCode("user") })
                      }
                      className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                    >
                      자동 생성
                    </button>
                  </div>
                  <input
                    type="text"
                    value={entry.memo ?? ""}
                    onChange={(event) =>
                      updateUserCode(entry.id, { memo: event.target.value })
                    }
                    placeholder="메모/담당자"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={entry.active !== false}
                      onChange={(event) =>
                        updateUserCode(entry.id, { active: event.target.checked })
                      }
                    />
                    활성
                  </label>
                  <button
                    type="button"
                    onClick={() => removeUserCode(entry.id)}
                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addUserCode}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                코드 추가
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                CSV 내보내기
              </button>
              <button
                type="button"
                onClick={() => setShowUser((prev) => !prev)}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                {showUser ? "코드 숨기기" : "코드 보기"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">관리자 로그인 코드</div>
              <div className="text-xs text-slate-500">
                관리자 로그인에 사용합니다.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdmin((prev) => !prev)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              {showAdmin ? "숨기기" : "보기"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type={showAdmin ? "text" : "password"}
              value={codes.adminLoginToken}
              onChange={(event) =>
                setCodes((prev) => ({ ...prev, adminLoginToken: event.target.value }))
              }
              placeholder="미설정"
              className="w-full flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                setCodes((prev) => ({
                  ...prev,
                  adminLoginToken: generateCode("admin"),
                }))
              }
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              자동 생성
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={status === "loading"}
        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {status === "loading" ? "저장 중..." : "저장"}
      </button>

      {message ? (
        <div
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
