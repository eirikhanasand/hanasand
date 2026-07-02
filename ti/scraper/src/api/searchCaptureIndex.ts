// @ts-nocheck
import { isSellableIntelText } from "../value/sellableIntel.ts";
import { derivedHints } from "./searchDerivedHints.ts";
import { termRegex } from "./searchTerm.ts";
type SearchDoc = { capture: any; text: string; title: string; collectedAt: string };
const cache = new WeakMap<object, { signature: string; docs: SearchDoc[] }>();
const norm = (value: unknown) => String(value ?? "").toLowerCase();
const words = (query: string) => norm(query).split(/[^a-z0-9.-]+/).filter((w) => w.length > 1);
const unique = (items: string[]) => [...new Set(items.filter(Boolean))];
export function findSearchCaptures(store: any, query: string, limit: number) {
  const docs = docsForStore(store);
  const terms = words(query);
  if (!terms.length) return docs.slice(0, limit).map((doc) => doc.capture);
  return docs
    .map((doc) => ({ doc, score: scoreDoc(doc, terms) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.collectedAt.localeCompare(a.doc.collectedAt))
    .slice(0, limit)
    .map((hit) => hit.doc.capture);
}
function docsForStore(store: any): SearchDoc[] {
  const captures = store.listCaptures();
  const sources = new Map((store.listSources?.() ?? []).map((source: any) => [source.id, source]));
  const signature = `${captures.length}:${captures.at(-1)?.id ?? ""}:${captures.at(-1)?.contentHash ?? ""}:${sources.size}`;
  const previous = cache.get(store);
  if (previous?.signature === signature) return previous.docs;
  const docs = captures.filter(sellableCapture)
    .map((capture: any) => docFor(capture, sources.get(capture.sourceId)))
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  cache.set(store, { signature, docs });
  return docs;
}
function docFor(capture: any, source: any): SearchDoc {
  const text = searchableText(capture);
  return { capture, title: norm(capture.title), collectedAt: capture.collectedAt ?? "", text: unique([text, sourceHints(source), derivedHints(text)]).join(" ").toLowerCase() };
}
function sellableCapture(capture: any) {
  if (capture?.metadata?.exposureClaim || capture?.metadata?.leakSite) return true;
  return isSellableIntelText({ text: searchableText(capture), title: capture.title, sourceId: capture.sourceId, publishedAt: capture.publishedAt, collectedAt: capture.collectedAt });
}
function searchableText(capture: any) {
  const leak = capture.metadata?.leakSite ?? {};
  return unique([capture.id, capture.sourceId, capture.title, capture.body, capture.rawText, capture.metadata?.safeExcerpt, capture.metadata?.adapter, leak.actorName, leak.victimName, leak.claimedSector, leak.claimedCountry, leak.claimedDataCategory]).join(" ").toLowerCase();
}
function sourceHints(source: any) {
  return unique([source?.name, source?.metadata?.sourceFamily]).join(" ");
}
function scoreDoc(doc: SearchDoc, terms: string[]) {
  let score = 0;
  for (const term of terms) {
    if (term === "loader" && /\b(spec loader|classloader|class loader|bootloader|preloader)\b/i.test(doc.text)) continue;
    const re = termRegex(term);
    if (re.test(doc.title)) score += 6;
    if (re.test(doc.text)) score += 2;
    if (doc.capture.sourceId?.toLowerCase().includes(term)) score += 1;
  }
  return score;
}
