"use client";

import { useMemo, useState } from "react";

type WiringViewerProps = {
  file: string;
  title: string;
  isImage: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function WiringViewer({ file, title, isImage }: WiringViewerProps) {
  const [zoom, setZoom] = useState(100);

  const pdfSrc = useMemo(() => {
    if (isImage) return file;
    const separator = file.includes("#") ? "&" : "#";
    return `${file}${separator}zoom=${zoom}`;
  }, [file, isImage, zoom]);

  const handleZoom = (delta: number) => {
    setZoom((current) => clamp(current + delta, 50, 300));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-slate-500">확대: {zoom}%</span>
        <button
          type="button"
          onClick={() => handleZoom(-10)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          축소
        </button>
        <button
          type="button"
          onClick={() => handleZoom(10)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          확대
        </button>
        <button
          type="button"
          onClick={() => setZoom(100)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          초기화
        </button>
      </div>

      <div className="h-[80vh] w-full overflow-auto rounded-2xl border border-slate-200 bg-white">
        {isImage ? (
          <img
            src={file}
            alt={title}
            style={{ width: `${zoom}%` }}
            className="h-auto max-w-none"
          />
        ) : (
          <iframe
            key={pdfSrc}
            title={title}
            src={pdfSrc}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}
