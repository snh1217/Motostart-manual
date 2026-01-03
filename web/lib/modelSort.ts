export const splitModelCode = (value: string) => {
  const match = /^(\d+)(.*)$/.exec(value.trim());
  if (!match) {
    return { number: Number.POSITIVE_INFINITY, suffix: value.trim().toUpperCase() };
  }
  const number = Number(match[1]);
  const suffix = (match[2] ?? "").trim().toUpperCase();
  return { number: Number.isFinite(number) ? number : Number.POSITIVE_INFINITY, suffix };
};

export const compareModelCode = (a: string, b: string) => {
  const left = splitModelCode(a);
  const right = splitModelCode(b);
  if (left.number !== right.number) return left.number - right.number;
  return left.suffix.localeCompare(right.suffix);
};

export const sortModelCodes = <T extends { id: string }>(items: T[]) =>
  items.slice().sort((a, b) => compareModelCode(a.id, b.id));
