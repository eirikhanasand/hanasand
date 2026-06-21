import { hashContent } from "../utils.ts";

export const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
export const round = (value: number) => Math.round(value * 1000) / 1000;
export const hash = (value: string) => hashContent(value).slice(0, 16);
export const countBy = (values: string[]) => values.reduce((out, value) => ({ ...out, [value]: (out[value] ?? 0) + 1 }), {} as Record<string, number>);
export const dedupe = (repairs: any[]) => {
  const seen = new Set();
  return repairs.filter((r) => {
    const key = `${r.sourceId}:${r.category}:${r.canonicalUrlHash ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
