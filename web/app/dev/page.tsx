"use client";

import { useState } from "react";

export default function DevPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<string[]>([]);

  const handleSeed = async () => {
    setStatus("loading");
    setMessage("");
    setDetails([]);

    try {
      const response = await fetch("/api/dev/seed", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "seed failed");
      }

      setStatus("success");
      setMessage("샘플 데이터가 생성되었습니다.");
      const fileList = Array.isArray(data?.files) ? data.files : [];
      const counts = data?.counts ?? {};
      const info = fileList.map((file: string) => {
        const key = file.replace(".json", "");
        const count = counts[key] ?? "-";
        return `${file} (${count})`;
      });
      setDetails(info);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "샘플 생성 실패"
      );
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dev</h1>
        <p className="text-slate-600">
          데모용 샘플 데이터를 빠르게 생성합니다.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <button
          type="button"
          onClick={handleSeed}
          disabled={status === "loading"}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "loading" ? "생성 중..." : "샘플 데이터 생성"}
        </button>
        {message ? (
          <div className="mt-3 text-sm text-slate-600">{message}</div>
        ) : null}
        {details.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">
            {details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {status === "error" ? (
          <div className="mt-3 text-sm text-red-600">오류가 발생했습니다.</div>
        ) : null}
      </div>
    </section>
  );
}