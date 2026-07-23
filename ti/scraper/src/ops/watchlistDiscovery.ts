import { StaticWebAdapter } from "../adapters/staticWeb.ts";
import { publicAdvisoryFetcher } from "../api/exposureQueueRoutes.ts";
import { createCollectionPlan } from "../planner/intelligencePlanner.ts";
import { sourceCollectionLane } from "../policy/collectionPolicy.ts";
import { privateTarget } from "../registry/sourceRegistry.ts";
import { isSellableIntelText } from "../value/sellableIntel.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";

const MAX_TERMS_PER_QUERY = 20;
const MAX_QUERY_CHARACTERS = 800;

export async function scheduleWatchlistDiscoveryRuns(options: any, generatedAt = nowIso()) {
  const store = options.store;
  if (typeof options.runExecutor !== "function" || typeof store?.listDwmWatchlists !== "function") {
    return { scheduledRunCount: 0, skippedRunCount: 0, reason: "scheduler_unavailable" };
  }
  const providers = store.listSources().filter(isQueryProvider).slice(0, 2);
  if (!providers.length) return { scheduledRunCount: 0, skippedRunCount: 0, reason: "no_verified_query_provider" };
  // Query cadence is the durable daily org job; provider failure backoff still applies to every query.
  const plannerProviders = providers.map((source: any) => ({
    ...source,
    crawlState: { ...(source.crawlState ?? {}), nextEligibleAt: source.crawlState?.backoffUntil }
  }));

  const existingPlanIds = new Set((store.listPlans?.() ?? []).map((plan: any) => plan.id));
  const jobs = organizationJobs(store.listDwmWatchlists(), generatedAt)
    .filter((job) => !existingPlanIds.has(job.id));
  const maxTasks = Math.max(1, Math.min(Number(options.maxTasks ?? 25), 25));
  const maxJobs = Math.max(1, Math.min(Number(options.watchlistDiscoveryMaxJobs ?? 5), Math.floor(maxTasks / providers.length)));
  const selected = jobs.slice(0, maxJobs);
  const prepared: Array<{ runId: string }> = [];

  for (const job of selected) {
    const plan = createCollectionPlan({
      id: job.id,
      tenantId: job.tenantId,
      query: job.query,
      entityType: "free_text",
      includeClearWeb: true,
      includeTelegram: false,
      includeDarknetMetadata: false,
      budgetClass: "broad_daily_sweep",
      maxTasks: providers.length,
      createdAt: generatedAt,
      requesterId: "scheduled-watchlist-discovery",
      reason: "active organization watchlist scheduled public discovery"
    }, plannerProviders, options.frontier);
    const runId = stableId("watchlist-discovery-run", plan.id);
    const planning = {
      organizationId: job.organizationId,
      watchlistIds: job.watchlistIds,
      terms: job.terms,
      cadenceWindow: job.cadenceWindow
    };
    const tasks = plan.tasks.map((task: any) => ({
      ...task,
      tenantId: job.tenantId,
      runId,
      planId: plan.id,
      planning: { ...task.planning, watchlistDiscovery: planning }
    }));
    store.savePlan({
      ...plan,
      request: { ...plan.request, organizationId: job.organizationId, watchlistIds: job.watchlistIds },
      tasks
    });
    store.saveRun({
      id: runId,
      tenantId: job.tenantId,
      planId: plan.id,
      requestId: plan.request.id,
      requestHash: stableId("watchlist-discovery-request", `${job.tenantId}:${job.organizationId}:${job.query}:${job.cadenceWindow}`),
      status: "queued",
      createdAt: generatedAt,
      updatedAt: generatedAt,
      taskCount: tasks.length,
      reviewTaskCount: 0,
      rejectedSourceCount: plan.rejected.length,
      captureCount: 0,
      incidentCount: 0
    });
    prepared.push({ runId });
  }

  for (const job of prepared) await options.runExecutor(job.runId);
  return {
    scheduledRunCount: prepared.length,
    skippedRunCount: Math.max(0, jobs.length - selected.length),
    reason: prepared.length ? "scheduled" : "already_scheduled",
    runIds: prepared.map((job) => job.runId)
  };
}

export async function collectWatchlistDiscoveryEvidence(input: {
  store: any;
  source: any;
  task: any;
  discoveryItems: any[];
  fetcher: typeof fetch;
  generatedAt: string;
  timeoutMs: number;
  maxBytes: number;
  nativeFetch: boolean;
}) {
  const context = input.task.planning?.watchlistDiscovery;
  if (!context?.organizationId || !input.task.tenantId || !Array.isArray(context.terms)) return [];
  const terms = context.terms.filter((term: any) => cleanTerm(term?.value));
  const candidates = input.discoveryItems.slice(0, Math.max(1, Math.min(Number(input.source.metadata?.maxItemsPerFetch ?? 4), 10)));
  const collected: any[] = [];

  for (const candidate of candidates) {
    const candidateText = `${candidate.title ?? ""} ${candidate.rawText ?? candidate.body ?? ""}`;
    const matched = terms.filter((term: any) => termOccursInText(candidateText, term.value));
    if (!matched.length || !cyberIncidentText(candidateText)) continue;
    const requestedUrl = httpsUrl(candidate.url);
    if (!requestedUrl) continue;
    const candidateSourceId = stableId("src_watchlist_public", `${input.task.tenantId}:${context.organizationId}:${requestedUrl}`);
    const publicSource = {
      id: candidateSourceId,
      tenantId: input.task.tenantId,
      name: `Public incident report ${new URL(requestedUrl).hostname}`,
      type: "static_web",
      url: requestedUrl,
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.7,
      crawlFrequencySeconds: 86_400,
      legalNotes: "Public incident reporting collected without credentials, form submission, downloads, or access-control bypass.",
      createdAt: input.generatedAt,
      updatedAt: input.generatedAt,
      metadata: {
        tenantId: input.task.tenantId,
        organizationId: context.organizationId,
        sourceFamily: "public_advisory",
        collectionMode: "scheduled_public_web_page",
        productionCollection: true,
        discoveryProviderSourceId: input.source.id
      }
    };
    const adapter = new StaticWebAdapter({
      fetcher: publicAdvisoryFetcher(input.nativeFetch ? undefined : input.fetcher, input.timeoutMs),
      timeoutMs: input.timeoutMs
    });
    const result = await adapter.collect(publicSource as any, {
      id: stableId("task_watchlist_public", `${input.task.id}:${requestedUrl}`),
      tenantId: input.task.tenantId,
      sourceId: candidateSourceId,
      sourceType: "static_web",
      targetUrl: requestedUrl,
      status: "queued",
      retryCount: 0,
      maxBytes: Math.max(64_000, Math.min(input.maxBytes, 2_000_000))
    } as any);
    const page = result.items[0];
    const text = String(page?.rawText ?? "").replace(/\s+/g, " ").trim().slice(0, 24_000);
    const pageMatches = matched.filter((term: any) => termOccursInText(text, term.value));
    const publishedAt = publicationTimestampFromHtml(String(page?.html ?? ""));
    if (!page || !publishedAt || !pageMatches.length || !cyberIncidentText(text) || !isSellableIntelText({
      text,
      title: page.title,
      sourceId: candidateSourceId,
      publishedAt,
      collectedAt: page.collectedAt,
      now: input.generatedAt,
      maxAgeDays: 30
    })) continue;
    if (Date.parse(publishedAt) > Date.parse(page.collectedAt) + 300_000) continue;
    const canonicalUrl = httpsUrl(page.url);
    if (!canonicalUrl) continue;

    const sourceId = stableId("src_watchlist_public", `${input.task.tenantId}:${context.organizationId}:${canonicalUrl}`);
    const existingSource = input.store.getSource?.(sourceId);
    input.store.saveSource({ ...publicSource, id: sourceId, name: `Public incident report ${new URL(canonicalUrl).hostname}`, url: canonicalUrl, createdAt: existingSource?.createdAt ?? input.generatedAt });
    const { html: _html, ...safePage } = page as any;
    collected.push({
      ...safePage,
      tenantId: input.task.tenantId,
      organizationId: context.organizationId,
      sourceId,
      url: canonicalUrl,
      rawText: text,
      body: text,
      publishedAt,
      metadata: {
        ...page.metadata,
        provenance: { ...page.metadata?.provenance, sourceId },
        organizationId: context.organizationId,
        sourceFamily: "public_advisory",
        scheduledWatchlistDiscovery: true,
        matchedWatchlistTerms: pageMatches.map((term: any) => ({ id: term.id, watchlistId: term.watchlistId, value: term.value })),
        discoveryProvider: {
          sourceId: input.source.id,
          resultHash: hashContent(`${candidate.url}:${candidate.title}:${candidate.contentHash}`),
          retainedAsEvidence: false
        },
        reportTimestamps: [{
          role: "publisher",
          timestamp: publishedAt,
          sourceId,
          evidencePath: "page.publicationTimestamp",
          extractionMethod: "source_field",
          parserVersion: "scheduled-watchlist-public-page:v1"
        }],
        extractionProfile: "public_advisory",
        review: { state: "needs_review", reason: "Scheduled public incident evidence requires automated or analyst confirmation" }
      }
    });
  }
  return collected;
}

export function activeWatchlistDiscoveryTerms(store: any, task: any) {
  const context = task.planning?.watchlistDiscovery;
  if (!context?.organizationId || !task.tenantId || !Array.isArray(context.terms) || !Array.isArray(context.watchlistIds)) return [];
  const current = new Set((store.listDwmWatchlists?.() ?? [])
    .filter((watchlist: any) => watchlist.status === "active"
      && watchlist.tenantId === task.tenantId
      && watchlist.organizationId === context.organizationId
      && context.watchlistIds.includes(String(watchlist.id)))
    .flatMap((watchlist: any) => (watchlist.terms ?? [])
      .filter((term: any) => !["paused", "disabled", "archived"].includes(String(term?.status)))
      .map((term: any) => `${String(watchlist.id)}:${cleanTerm(typeof term === "string" ? term : term?.value)?.toLowerCase()}`)));
  return context.terms.filter((term: any) => current.has(`${term.watchlistId}:${cleanTerm(term.value)?.toLowerCase()}`));
}

function organizationJobs(watchlists: any[], generatedAt: string) {
  const groups = new Map<string, { tenantId: string; organizationId: string; watchlistIds: Set<string>; terms: Map<string, any> }>();
  for (const watchlist of watchlists) {
    const tenantId = String(watchlist?.tenantId ?? "").trim();
    const organizationId = String(watchlist?.organizationId ?? "").trim();
    if (watchlist?.status !== "active" || !tenantId || !organizationId) continue;
    const key = `${tenantId}:${organizationId}`;
    const group = groups.get(key) ?? { tenantId, organizationId, watchlistIds: new Set(), terms: new Map() };
    group.watchlistIds.add(String(watchlist.id));
    for (const [index, raw] of (Array.isArray(watchlist.terms) ? watchlist.terms : []).entries()) {
      const value = cleanTerm(typeof raw === "string" ? raw : raw?.value);
      if (!value || ["paused", "disabled", "archived"].includes(String(raw?.status))) continue;
      const normalized = value.toLowerCase();
      if (!group.terms.has(normalized)) group.terms.set(normalized, {
        id: String(raw?.id ?? stableId("watch-term", `${watchlist.id}:${index}:${normalized}`)),
        watchlistId: String(watchlist.id),
        value
      });
    }
    groups.set(key, group);
  }
  const cadenceWindow = generatedAt.slice(0, 10);
  return [...groups.values()].flatMap((group) => chunks([...group.terms.values()]).map((terms) => {
    const query = terms.map((term) => `"${term.value.replace(/["\\]/g, " ")}"`).join(" OR ");
    return {
      id: stableId("watchlist-discovery-plan", `${group.tenantId}:${group.organizationId}:${hashContent(query)}:${cadenceWindow}`),
      tenantId: group.tenantId,
      organizationId: group.organizationId,
      watchlistIds: [...group.watchlistIds].sort(),
      terms,
      query,
      cadenceWindow
    };
  })).sort((a, b) => `${a.tenantId}:${a.organizationId}:${a.id}`.localeCompare(`${b.tenantId}:${b.organizationId}:${b.id}`));
}

function chunks(terms: any[]) {
  const result: any[][] = [];
  let current: any[] = [];
  let characters = 0;
  for (const term of terms.sort((a, b) => a.value.localeCompare(b.value))) {
    const cost = term.value.length + (current.length ? 6 : 2);
    if (current.length && (current.length >= MAX_TERMS_PER_QUERY || characters + cost > MAX_QUERY_CHARACTERS)) {
      result.push(current);
      current = [];
      characters = 0;
    }
    current.push(term);
    characters += cost;
  }
  if (current.length) result.push(current);
  return result;
}

function isQueryProvider(source: any) {
  return sourceCollectionLane(source) === "public"
    && String(source.url ?? "").includes("{query}")
    && source.metadata?.sourceFamily === "public_news_search";
}

function cleanTerm(value: unknown) {
  const term = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return term.length >= 2 && term.length <= 100 ? term : undefined;
}

function termOccursInText(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function cyberIncidentText(text: string) {
  return /\b(?:cyber(?:attack| attack|angrep)|ransomware|data breach|security incident|compromis(?:e|ed)|dataangrep|sikkerhetshendelse|datainnbrudd|løsepengevirus|stjålet|phishing|malware|credential theft)\b/i.test(text);
}

function publicationTimestampFromHtml(html: string) {
  const candidates: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = htmlAttribute(tag, "property") || htmlAttribute(tag, "name") || htmlAttribute(tag, "itemprop");
    if (/^(?:article:published_time|datepublished|date|pubdate|publish-date)$/i.test(key ?? "")) candidates.push(htmlAttribute(tag, "content") ?? "");
  }
  candidates.push(html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ?? "");
  candidates.push(html.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1] ?? "");
  return candidates.map(validTimestamp).find(Boolean);
}

function htmlAttribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1];
}

function validTimestamp(value: unknown) {
  const timestamp = String(value ?? "").trim();
  return Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : undefined;
}

function httpsUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" && !url.username && !url.password && !privateTarget(url.hostname) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
