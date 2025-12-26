"use client";

import { useState } from "react";

type CopyButtonProps = {
  text: string;
  label?: string;
};

export default function CopyButton({ text, label = "복사" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
    >
      {copied ? "복사됨" : label}
    </button>
  );
}
