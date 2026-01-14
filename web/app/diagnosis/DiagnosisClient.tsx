"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import type { DiagnosisNode, DiagnosisTree } from "../../lib/types";

type DiagnosisClientProps = {
  selectedModel: string;
  trees: DiagnosisTree[];
};

const buildNodeMap = (tree: DiagnosisTree) => {
  const map = new Map<string, DiagnosisNode>();
  tree.nodes.forEach((node) => map.set(node.id, node));
  return map;
};

const supportsModel = (tree: DiagnosisTree, model: string) =>
  tree.supportedModels.includes(model);

const buildMaxDepth = (tree: DiagnosisTree) => {
  const nodeMap = buildNodeMap(tree);
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const dfs = (nodeId: string): number => {
    if (memo.has(nodeId)) return memo.get(nodeId) ?? 1;
    if (visiting.has(nodeId)) return 1;
    visiting.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node || node.type === "result") {
      visiting.delete(nodeId);
      memo.set(nodeId, 1);
      return 1;
    }
    const depth =
      1 + Math.max(dfs(node.yesNextId ?? ""), dfs(node.noNextId ?? ""));
    visiting.delete(nodeId);
    memo.set(nodeId, depth);
    return depth;
  };

  return dfs(tree.startNodeId);
};

const buildTemplateUrl = (
  format: "csv" | "xlsx",
  model: string,
  tree: DiagnosisTree,
  node: DiagnosisNode
) => {
  const params = new URLSearchParams({
    format,
    model,
    category: tree.category,
    symptomTitle: tree.symptomTitle ?? tree.title,
    diagnosisTreeId: tree.treeId,
    diagnosisResultId: node.id,
    title: tree.title,
    description: node.text,
  });
  return `/api/cases/template?${params.toString()}`;
};

export default function DiagnosisClient({ selectedModel, trees }: DiagnosisClientProps) {
  const modelSelected = selectedModel !== "all";
  const availableTrees = useMemo(() => {
    if (!modelSelected) return [];
    return trees.filter((tree) => supportsModel(tree, selectedModel));
  }, [modelSelected, selectedModel, trees]);

  const categories = useMemo(() => {
    const set = new Set(availableTrees.map((tree) => tree.category));
    return Array.from(set).sort();
  }, [availableTrees]);

  const categoriesKey = categories.join("|");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    categories[0] ?? null
  );
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setSelectedCategory(categories[0] ?? null);
    setActiveTreeId(null);
    setHistory([]);
  }, [selectedModel, categoriesKey]);

  const activeTree = activeTreeId
    ? availableTrees.find((tree) => tree.treeId === activeTreeId) ?? null
    : null;
  const nodeMap = useMemo(
    () => (activeTree ? buildNodeMap(activeTree) : new Map()),
    [activeTree]
  );
  const currentNode = history.length ? nodeMap.get(history[history.length - 1]) : null;
  const maxDepth = activeTree ? buildMaxDepth(activeTree) : 0;
  const answeredCount = history.filter((nodeId) => nodeMap.get(nodeId)?.type === "question")
    .length;
  const breadcrumb = history
    .map((nodeId) => nodeMap.get(nodeId)?.text)
    .filter((value): value is string => Boolean(value));

  const categoryTrees = selectedCategory
    ? availableTrees.filter((tree) => tree.category === selectedCategory)
    : availableTrees;

  const handleTreeSelect = (treeId: string) => {
    const tree = availableTrees.find((item) => item.treeId === treeId);
    if (!tree) return;
    setActiveTreeId(treeId);
    setHistory([tree.startNodeId]);
  };

  const handleAnswer = (answer: "yes" | "no") => {
    if (!currentNode || currentNode.type !== "question") return;
    const nextId = answer === "yes" ? currentNode.yesNextId : currentNode.noNextId;
    if (!nextId) return;
    setHistory((prev) => [...prev, nextId]);
  };

  const handleNextStep = () => {
    if (!currentNode || currentNode.type !== "step") return;
    if (!currentNode.nextId) return;
    setHistory((prev) => [...prev, currentNode.nextId]);
  };

  const handleBack = () => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleRestart = () => {
    if (!activeTree) return;
    setHistory([activeTree.startNodeId]);
  };

  if (!modelSelected) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
        모델을 선택하면 정비진단을 시작할 수 있습니다.
      </div>
    );
  }

  if (!availableTrees.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
        선택한 모델에 등록된 진단 트리가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-700">진단 카테고리</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selectedCategory === category
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {!activeTree ? (
        <section className="grid gap-4 md:grid-cols-2">
          {categoryTrees.map((tree) => (
            <button
              key={tree.treeId}
              type="button"
              onClick={() => handleTreeSelect(tree.treeId)}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300"
            >
              <div className="text-xs font-semibold text-slate-500">{tree.category}</div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{tree.title}</h3>
              {tree.symptomTitle ? (
                <p className="mt-2 text-sm text-slate-600">{tree.symptomTitle}</p>
              ) : null}
              <div className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                시작하기
              </div>
            </button>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">{activeTree.category}</p>
              <h2 className="text-xl font-semibold text-slate-900">{activeTree.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTreeId(null);
                  setHistory([]);
                }}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                다른 진단 선택
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                다시 시작
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            진행 {Math.max(answeredCount, 1)}/{Math.max(maxDepth, 1)}
            {breadcrumb.length ? (
              <div className="mt-2 text-xs text-slate-500">
                경로: {breadcrumb.join(" > ")}
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {currentNode ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-lg font-semibold text-slate-900">{currentNode.text}</p>
                  {currentNode.type === "question" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAnswer("yes")}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        예
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAnswer("no")}
                        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        아니오
                      </button>
                    </div>
                  ) : currentNode.type === "step" ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        다음
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">
                          조치 가이드
                        </div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {currentNode.actions.map((action) => (
                            <li key={action}>{action}</li>
                          ))}
                        </ul>
                      </div>
                      {currentNode.links?.length ? (
                        <div>
                          <div className="text-sm font-semibold text-slate-700">
                            관련 링크
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {currentNode.links.map((linkItem, index) => {
                              const isExternal = linkItem.urlOrRoute.startsWith("http");
                              return (
                                <a
                                  key={`${linkItem.type}-${index}`}
                                  href={linkItem.urlOrRoute}
                                  target={isExternal ? "_blank" : undefined}
                                  rel={isExternal ? "noreferrer" : undefined}
                                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                                >
                                  {linkItem.label}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link
                          href={`/cases?model=${encodeURIComponent(
                            selectedModel
                          )}&diagnosisTreeId=${encodeURIComponent(
                            activeTree.treeId
                          )}&diagnosisResultId=${encodeURIComponent(currentNode.id)}`}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                        >
                          관련 정비사례 보기
                        </Link>
                        <a
                          href={buildTemplateUrl("csv", selectedModel, activeTree, currentNode)}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        >
                          사례 업로드 초안(CSV)
                        </a>
                        <a
                          href={buildTemplateUrl("xlsx", selectedModel, activeTree, currentNode)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                        >
                          XLSX 다운로드
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={history.length <= 1}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    뒤로가기
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
                진단 노드를 불러오지 못했습니다.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
