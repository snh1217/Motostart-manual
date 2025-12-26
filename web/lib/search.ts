const synonymMap: Record<string, string[]> = {
  "헤드": ["head", "cylinder head"],
  "토크": ["torque", "tightening torque", "n·m", "nm"],
  "볼트": ["bolt", "screw"],
  "오일": ["oil", "engine oil", "oil capacity", "oil volume", "oil quantity"],
  "휠": ["wheel"],
  "너트": ["nut"],
  "휠너트": ["wheel nut", "lug nut"],
  "드레인": ["drain"],
};

const stopwords = new Set([
  "토크",
  "토크값",
  "값",
  "규격",
  "볼트",
  "너트",
  "체결",
  "조임",
  "tighten",
  "torque",
  "value",
  "spec",
]);

const meaningfulTokens = new Set([
  "휠",
  "너트",
  "휠너트",
  "드레인",
  "오일",
  "헤드",
  "wheel",
  "nut",
  "wheel nut",
  "lug nut",
  "drain",
  "oil",
  "head",
  "cylinder head",
]);

export const normalizeQuery = (q: string): string => {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeSpecText = (text: string): string => {
  return normalizeQuery(text)
    .replace(/드레인\s*볼트/g, "드레인볼트")
    .replace(/휠\s*너트/g, "휠너트")
    .replace(/토크\s*값/g, "토크")
    .replace(/토크값/g, "토크")
    .replace(/엔진\s*오일/g, "엔진오일")
    .replace(/오일\s*량/g, "오일")
    .replace(/오일량/g, "오일")
    .trim();
};

const tokenize = (q: string): string[] => {
  const normalized = normalizeSpecText(q);
  if (!normalized) return [];

  const baseTokens = normalized.split(" ").filter(Boolean);
  const expanded = new Set<string>(baseTokens);

  for (const token of baseTokens) {
    if (token.length >= 4 && token.length <= 6) {
      for (let size = 2; size <= 4; size += 1) {
        for (let i = 0; i <= token.length - size; i += 1) {
          expanded.add(token.slice(i, i + size));
        }
      }
    }

    for (const [key, synonyms] of Object.entries(synonymMap)) {
      if (token.includes(key)) {
        synonyms.forEach((synonym) => expanded.add(synonym));
      }
    }
  }

  return Array.from(expanded);
};

export const scoreSpecMatch = (
  query: string,
  target: string
): { score: number; meaningfulMatches: number } => {
  const normalizedTarget = normalizeSpecText(target);
  if (!normalizedTarget) return { score: 0, meaningfulMatches: 0 };

  const tokens = tokenize(query);
  if (tokens.length === 0) return { score: 0, meaningfulMatches: 0 };

  let scoreSum = 0;
  let meaningfulMatches = 0;

  for (const token of tokens) {
    if (!normalizedTarget.includes(token)) continue;
    if (meaningfulTokens.has(token)) {
      scoreSum += 5;
      meaningfulMatches += 1;
    } else if (stopwords.has(token)) {
      scoreSum += 1;
    } else {
      scoreSum += 2;
    }
  }

  const normalizedQuery = normalizeSpecText(query);
  if (normalizedQuery && normalizedTarget.includes(normalizedQuery)) {
    scoreSum += 8;
  }

  return { score: scoreSum, meaningfulMatches };
};

export const expandTokens = (q: string): string[] => {
  const baseTokens = tokenize(q);
  const expanded = new Set<string>();

  for (const token of baseTokens) {
    expanded.add(token);

    for (const [key, synonyms] of Object.entries(synonymMap)) {
      if (token.includes(key)) {
        synonyms.forEach((synonym) => expanded.add(synonym));
      }
    }
  }

  return Array.from(expanded);
};

export const makeSnippet = (text: string, tokens: string[]): string => {
  const normalizedText = text.toLowerCase();
  const normalizedTokens = tokens.map((token) => token.toLowerCase());

  let matchIndex = -1;
  for (const token of normalizedTokens) {
    matchIndex = normalizedText.indexOf(token);
    if (matchIndex !== -1) break;
  }

  if (matchIndex === -1) {
    return text.slice(0, 140).trim();
  }

  const start = Math.max(0, matchIndex - 60);
  const end = Math.min(text.length, matchIndex + 80);
  return text.slice(start, end).trim();
};

export const makeSummary = (text: string): string => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const sentenceSplit = cleaned.split(/(?<=[.!?。])\s+/);
  const firstSentence = sentenceSplit.find((sentence) => sentence.length >= 40);
  if (firstSentence) return firstSentence.slice(0, 140).trim();

  return cleaned.slice(0, 140).trim();
};

export const makeSummaryFromTokens = (
  text: string,
  tokens: string[]
): string => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const sentences = cleaned.split(/(?<=[.!?。])\s+/);
  let bestSentence = "";
  let bestScore = 0;

  for (const sentence of sentences) {
    const sentenceScore = score(sentence, tokens);
    if (sentenceScore > bestScore) {
      bestScore = sentenceScore;
      bestSentence = sentence;
    }
  }

  if (bestSentence) {
    return bestSentence.slice(0, 140).trim();
  }

  return makeSummary(cleaned);
};

export const score = (text: string, tokens: string[]): number => {
  const normalizedText = text.toLowerCase();
  const normalizedTokens = tokens.map((token) => token.toLowerCase());
  let count = 0;

  for (const token of normalizedTokens) {
    if (token && normalizedText.includes(token)) {
      count += 1;
    }
  }

  return count;
};
