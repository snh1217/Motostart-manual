import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import SpecsClient from "./SpecsClient";
import type { ModelCode, SpecRow } from "../../lib/types";

const knownModels: ModelCode[] = [
  "125C",
  "125D",
  "125E",
  "125M",
  "310M",
  "350D",
  "350GK",
  "368E",
  "368G",
];

const readJson = cache(async <T,>(filename: string): Promise<T> => {
  const filePath = path.resolve(process.cwd(), "data", filename);
  const raw = await fs.readFile(filePath, "utf8");
  const sanitized = raw.replace(/^\uFEFF/, "");
  return JSON.parse(sanitized) as T;
});

export default async function SpecsPage({
  searchParams,
}: {
  searchParams?: Promise<{ model?: string; category?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const modelParam = resolvedSearchParams?.model;
  const categoryParam = resolvedSearchParams?.category;

  const selectedModel = knownModels.includes(modelParam as ModelCode)
    ? (modelParam as ModelCode)
    : "all";
  const selectedCategory = typeof categoryParam === "string" ? categoryParam : "all";

  const modelList = await readJson<Array<{ id: ModelCode; name: string }>>(
    "models.json"
  );
  const specs = await readJson<SpecRow[]>("specs.json");
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

  return (
    <SpecsClient
      specs={specs}
      modelList={modelList}
      initialModel={selectedModel}
      initialCategory={selectedCategory}
      readOnly={isReadOnly}
    />
  );
}
