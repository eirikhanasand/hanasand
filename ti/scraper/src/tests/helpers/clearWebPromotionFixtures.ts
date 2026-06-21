import type { SearchResultHandoff } from "../../adapters/clearWebPromotion.ts";

export const observedAt = "2026-05-24T12:00:00.000Z";

export function handoff(rank: number, query: string, slug: string, title: string, snippet: string, publicChannelMatchState: SearchResultHandoff["publicChannelMatchState"]): SearchResultHandoff {
  return {
    query,
    runId: "run_clear_web_promotion",
    provider: "fixture_search",
    resultId: `result_${slug}`,
    title,
    snippet,
    url: `https://example.test/research/${slug}?utm=search#summary`,
    rank,
    observedAt,
    confidence: 0.78,
    publicChannelMatchState,
    publicChannelEvidenceIds: publicChannelMatchState === "matched" ? [`tg_public_${slug}`] : [],
    publicChannelMessageUrls: publicChannelMatchState === "matched" ? [`https://t.me/public_cti/${rank}`] : []
  };
}

export function failureHandoff(rank: number, query: string, slug: string, url?: string): SearchResultHandoff {
  return {
    query,
    runId: "run_clear_web_failures",
    provider: "fixture_search",
    resultId: `result_${slug}`,
    title: `${query} result`,
    snippet: `${query} campaign search result handoff.`,
    url: url ?? `https://failure.example.test/research/${slug}?utm=search#summary`,
    rank,
    observedAt: "2026-05-24T12:15:00.000Z",
    confidence: 0.7,
    publicChannelMatchState: "not_matched"
  };
}

export function failureByQuery<T extends { query: string }>(proofs: T[], query: string): T {
  const proof = proofs.find((item) => item.query === query);
  if (!proof) throw new Error(`Missing proof for ${query}`);
  return proof;
}
