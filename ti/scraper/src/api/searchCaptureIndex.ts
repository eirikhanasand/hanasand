import { isSellableIntelText } from "../value/sellableIntel.ts";
import { derivedHints } from "./searchDerivedHints.ts";
import { termRegex } from "./searchTerm.ts";
import { sourceActivityWindowDays } from "../policy/sourceActivityWindow.ts";
type SearchDoc = { capture: any; text: string; title: string; collectedAt: string };
type CachedDoc = { doc?: SearchDoc; postingKeys: string[]; tenantKey: string };
type SearchIndex = { revision: number; records: Map<string, CachedDoc>; postings: Map<string, Set<string>>; tenantIds: Map<string, Set<string>> };
const cache = new WeakMap<object, SearchIndex>();
const norm = (value: unknown) => String(value ?? "").toLowerCase();
const words = (query: string) => norm(query).split(/[^a-z0-9.-]+/).filter((w) => w.length > 1);
const unique = (items: string[]) => [...new Set(items.filter(Boolean))];
export function warmSearchCaptureIndex(store: any) {
  const index = indexForStore(store);
  return { captureCount: index.records.size, indexedCaptureCount: [...index.tenantIds.values()].reduce((count, ids) => count + ids.size, 0) };
}
export function findSearchCaptures(store: any, query: string, limit: number, tenantId?: string) {
  const index = indexForStore(store);
  const terms = words(query);
  const docs = docsForIds(index, terms.length ? intersectPostings(index, terms, tenantId) : index.tenantIds.get(tenantKey(tenantId)) ?? []);
  if (!terms.length) return docs.sort(compareDocs).slice(0, limit).map((doc) => doc.capture);
  return docs
    .map((doc) => ({ doc, score: scoreDoc(doc, terms) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || compareDocs(a.doc, b.doc))
    .slice(0, limit)
    .map((hit) => hit.doc.capture);
}

export function findActorSearchCaptures(store: any, identities: string[], limit: number, tenantId?: string) {
  const index = indexForStore(store);
  const terms = unique(identities.map(normalizeIdentity).filter(Boolean));
  if (!terms.length) return [];
  const ids = new Set(terms.flatMap((term) => [...intersectPostings(index, words(term), tenantId)]));
  return docsForIds(index, ids)
    .map((doc) => ({ doc, score: scoreIdentityDoc(doc, terms) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || compareDocs(a.doc, b.doc))
    .slice(0, limit)
    .map((hit) => hit.doc.capture);
}
function indexForStore(store: any): SearchIndex {
  const index = cache.get(store) ?? { revision: 0, records: new Map(), postings: new Map(), tenantIds: new Map() };
  const changes = store.listSearchCaptureChanges?.(index.revision);
  if (!changes) throw new Error("Search capture change index is unavailable");
  if (changes.revision === index.revision) return index;
  const captureIds = changes.captures.map((capture: any) => capture.id);
  const incidentTitles = new Map((store.listIncidentsByCaptureIds?.(captureIds) ?? []).map((incident: any) => [incident.captureId, incident.title]));
  for (const capture of changes.captures) {
    removeCachedDoc(index, capture.id);
    const source = store.getSource?.(capture.sourceId);
    const candidate = withLegacyIncidentTitle(capture, incidentTitles.get(capture.id));
    const doc = sellableCapture(candidate, source) ? docFor(candidate, source) : undefined;
    const tenant = tenantKey(capture.tenantId || undefined);
    const postingKeys = doc ? indexedTerms(doc).map((term) => postingKey(tenant, term)) : [];
    index.records.set(capture.id, { doc, postingKeys, tenantKey: tenant });
    if (doc) {
      addTo(index.tenantIds, tenant, capture.id);
      for (const key of postingKeys) addTo(index.postings, key, capture.id);
    }
  }
  index.revision = changes.revision;
  cache.set(store, index);
  return index;
}

function addTo(index: Map<string, Set<string>>, key: string, id: string) { index.set(key, new Set([...(index.get(key) ?? []), id])); }
function removeFrom(index: Map<string, Set<string>>, key: string, id: string) { const ids = index.get(key); ids?.delete(id); if (!ids?.size) index.delete(key); }
function removeCachedDoc(index: SearchIndex, id: string) {
  const previous = index.records.get(id);
  if (!previous?.doc) return;
  removeFrom(index.tenantIds, previous.tenantKey, id);
  for (const key of previous.postingKeys) removeFrom(index.postings, key, id);
}
function tenantKey(tenantId?: string) { return tenantId ?? ""; }
function postingKey(tenant: string, term: string) { return `${tenant}\u0000${term}`; }
function indexedTerms(doc: SearchDoc) {
  const tokens = `${doc.title} ${doc.text} ${doc.capture.sourceId ?? ""}`.match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g) ?? [];
  return unique(tokens.flatMap((token) => [token, ...token.split(/[.-]/)])).filter((term) => term.length > 1);
}
function intersectPostings(index: SearchIndex, terms: string[], tenantId?: string): Set<string> {
  if (!terms.length) return new Set();
  const tenant = tenantKey(tenantId);
  const sets = terms.map((term) => index.postings.get(postingKey(tenant, term)) ?? new Set<string>()).sort((a, b) => a.size - b.size);
  return new Set([...sets[0]].filter((id) => sets.slice(1).every((ids) => ids.has(id))));
}
function docsForIds(index: SearchIndex, ids: Iterable<string>) { return [...ids].flatMap((id) => index.records.get(id)?.doc ?? []); }
function compareDocs(a: SearchDoc, b: SearchDoc) { return b.collectedAt.localeCompare(a.collectedAt) || String(a.capture.id).localeCompare(String(b.capture.id)); }

function withLegacyIncidentTitle(capture: any, incidentTitle: unknown) {
  if (capture.title || capture.metadata?.title || typeof incidentTitle !== "string") return capture;
  const title = incidentTitle.trim();
  if (!title || /^https?:\/\//i.test(title) || title === capture.url) return capture;
  return { ...capture, title, searchTitleSource: "legacy_incident" };
}
function docFor(capture: any, source: any): SearchDoc {
  const text = searchableText(capture);
  return { capture, title: norm(capture.title), collectedAt: capture.collectedAt ?? "", text: unique([text, sourceHints(source), derivedHints(text)]).join(" ").toLowerCase() };
}
function sellableCapture(capture: any, source: any) {
  if (capture?.metadata?.exposureClaim || capture?.metadata?.leakSite) return true;
  return isSellableIntelText({ text: searchableText(capture), title: capture.title, sourceId: capture.sourceId, publishedAt: capture.publishedAt, collectedAt: capture.collectedAt, maxAgeDays: sourceActivityWindowDays(source) });
}
function searchableText(capture: any) {
  const leak = capture.metadata?.leakSite ?? {};
  const ransomwareGroup = capture.metadata?.ransomwareGroup ?? {};
  return unique([capture.id, capture.sourceId, capture.title, capture.body, capture.rawText, capture.metadata?.title, capture.metadata?.safeExcerpt, capture.metadata?.adapter, capture.metadata?.actorName, capture.metadata?.actor, leak.actorName, leak.victimName, leak.claimedSector, leak.claimedCountry, leak.claimedDataCategory, ransomwareGroup.actorName, ...(ransomwareGroup.aliases ?? [])]).join(" ").toLowerCase();
}
function sourceHints(source: any) {
  return unique([source?.name, source?.metadata?.sourceFamily]).join(" ");
}
function scoreDoc(doc: SearchDoc, terms: string[]) {
  let score = 0;
  let matched = 0;
  for (const term of terms) {
    if (term === "loader" && /\b(spec loader|classloader|class loader|bootloader|preloader)\b/i.test(doc.text)) continue;
    const re = termRegex(term);
    const termScore = (re.test(doc.title) ? 6 : 0)
      + (re.test(doc.text) ? 2 : 0)
      + (doc.capture.sourceId?.toLowerCase().includes(term) ? 1 : 0);
    if (termScore) matched++;
    score += termScore;
  }
  return matched === terms.length ? score : 0;
}

function scoreIdentityDoc(doc: SearchDoc, terms: string[]) {
  const title = normalizeIdentity(doc.title);
  const text = normalizeIdentity(doc.text);
  return terms.reduce((score, term) => {
    const re = termRegex(term);
    return score + (re.test(title) ? 6 : 0) + (re.test(text) ? 2 : 0);
  }, 0);
}

function normalizeIdentity(value: unknown) {
  return norm(value).replace(/[^a-z0-9]+/g, " ").trim();
}
