import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import ModelsClient from "./ModelsClient";
import type { ModelCode } from "../../lib/types";

type ModelEntry = { id: ModelCode | string; name: string };

const readJson = cache(async <T,>(filename: string): Promise<T> => {
  const filePath = path.resolve(process.cwd(), "data", filename);
  const raw = await fs.readFile(filePath, "utf8");
  const sanitized = raw.replace(/^\uFEFF/, "");
  return JSON.parse(sanitized) as T;
});

export default async function ModelsPage() {
  const models = await readJson<ModelEntry[]>("models.json");
  const isReadOnly = process.env.READ_ONLY_MODE === "1";

  return <ModelsClient models={models} readOnly={isReadOnly} />;
}
