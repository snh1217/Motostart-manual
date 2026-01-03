import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import SpecsClient from "./SpecsClient";
import { loadSpecs } from "../../lib/specs";
import { sortModelCodes } from "../../lib/modelSort";
import type { ModelCode } from "../../lib/types";

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

  const modelList = await readJson<Array<{ id: ModelCode; name: string }>>(
    "models.json"
  );
  const sortedModelList = sortModelCodes(modelList);
  const modelSet = new Set(sortedModelList.map((item) => item.id));

  const selectedModel = modelSet.has(modelParam as ModelCode)
    ? (modelParam as ModelCode)
    : "all";
  const selectedCategory = typeof categoryParam === "string" ? categoryParam : "all";

  const shouldPrefetch =
    (selectedModel !== "all" || selectedCategory !== "all") &&
    !(selectedModel === "all" && selectedCategory === "all");
  const specs = shouldPrefetch
    ? await loadSpecs({
        model: selectedModel,
        category: selectedCategory,
      })
    : [];
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

  return (
    <SpecsClient
      specs={specs}
      modelList={sortedModelList}
      initialModel={selectedModel}
      initialCategory={selectedCategory}
      readOnly={isReadOnly}
    />
  );
}
