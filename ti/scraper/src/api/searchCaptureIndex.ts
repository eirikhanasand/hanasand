// @ts-nocheck
import { isSellableIntelText } from "../value/sellableIntel.ts";
import { derivedHints } from "./searchDerivedHints.ts";
import { termRegex } from "./searchTerm.ts";
import { sourceActivityWindowDays } from "../policy/sourceActivityWindow.ts";
type SearchDoc = { capture: any; text: string; title: string; collectedAt: string };
const cache = new WeakMap<object, { signature: string; docs: SearchDoc[] }>();
const norm = (value: unknown) => String(value ?? "").toLowerCase();
const words = (query: string) => norm(query).split(/[^a-z0-9.-]+/).filter((w) => w.length > 1);
const unique = (items: string[]) => [...new Set(items.filter(Boolean))];
export function findSearchCaptures(store: any, query: string, limit: number, tenantId?: string) {
  const docs = docsForStore(store).filter((doc) => (doc.capture?.tenantId || undefined) === tenantId);
  const terms = words(query);
  if (!terms.length) return docs.slice(0, limit).map((doc) => doc.capture);
  return docs
    .map((doc) => ({ doc, score: scoreDoc(doc, terms) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.collectedAt.localeCompare(a.doc.collectedAt) || String(a.doc.capture.id).localeCompare(String(b.doc.capture.id)))
    .slice(0, limit)
    .map((hit) => hit.doc.capture);
}

export function findActorSearchCaptures(store: any, identities: string[], limit: number, tenantId?: string) {
  const docs = docsForStore(store).filter((doc) => (doc.capture?.tenantId || undefined) === tenantId);
  const terms = unique(identities.map(normalizeIdentity).filter(Boolean));
  if (!terms.length) return [];
  return docs
    .map((doc) => ({ doc, score: scoreIdentityDoc(doc, terms) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.collectedAt.localeCompare(a.doc.collectedAt) || String(a.doc.capture.id).localeCompare(String(b.doc.capture.id)))
    .slice(0, limit)
    .map((hit) => hit.doc.capture);
}
function docsForStore(store: any): SearchDoc[] {
  const captures = store.listCaptures();
  const incidents = store.listIncidents?.() ?? [];
  const sources = new Map((store.listSources?.() ?? []).map((source: any) => [source.id, source]));
  const incidentTitles = new Map(incidents.map((incident: any) => [incident.captureId, incident.title]));
  const latestSourceUpdate = [...sources.values()].reduce((latest, source: any) => String(source.updatedAt ?? "") > latest ? String(source.updatedAt) : latest, "");
  const signature = `${captures.length}:${captures.at(-1)?.id ?? ""}:${captures.at(-1)?.contentHash ?? ""}:${incidents.length}:${incidents.at(-1)?.id ?? ""}:${sources.size}:${latestSourceUpdate}`;
  const previous = cache.get(store);
  if (previous?.signature === signature) return previous.docs;
  const docs = captures.filter((capture: any) => sellableCapture(capture, sources.get(capture.sourceId)))
    .map((capture: any) => docFor(withLegacyIncidentTitle(capture, incidentTitles.get(capture.id)), sources.get(capture.sourceId)))
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt) || String(a.capture.id).localeCompare(String(b.capture.id)));
  cache.set(store, { signature, docs });
  return docs;
}

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
  for (const term of terms) {
    if (term === "loader" && /\b(spec loader|classloader|class loader|bootloader|preloader)\b/i.test(doc.text)) continue;
    const re = termRegex(term);
    if (re.test(doc.title)) score += 6;
    if (re.test(doc.text)) score += 2;
    if (doc.capture.sourceId?.toLowerCase().includes(term)) score += 1;
  }
  return score;
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
