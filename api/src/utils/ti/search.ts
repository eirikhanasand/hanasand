export interface TiSearchRequest {
    query: string
}

export type TiResultState = 'queued' | 'searching' | 'partial' | 'ready' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation'

export interface TiActivity {
    date: string
    title: string
    detail: string
    confidence: number
    sourceIds: string[]
    url?: string
    claimType?: 'campaign' | 'victim_claim' | 'malware_activity' | 'vulnerability_exploitation' | 'infrastructure_activity' | 'general_activity'
    victimName?: string
    affectedSectors?: string[]
    countries?: string[]
    impact?: string
    firstReportedAt?: string
    lastReportedAt?: string
    publisherCount?: number
    corroboratingSourceIds?: string[]
    contradictingSourceIds?: string[]
}

export interface TiTarget {
    sector: string
    regions: string[]
    rationale: string
    confidence: number
}

export interface TiTtp {
    name: string
    attackId?: string
    tactic: string
    detail: string
    confidence: number
}

export interface TiDataset {
    name: string
    type: 'clear_web' | 'public_channel' | 'darknet_metadata' | 'vendor_report' | 'stix_export'
    coverage: string
    status: 'available' | 'planned' | 'metadata_only'
    url?: string
}

export interface TiSource {
    id: string
    name: string
    type: string
    provenance: string
    url?: string
    captureId?: string
    sourceRequestId?: string
    sourceFamily?: string
    parserStatus?: string
    reportDate?: string
    lastCollectedAt?: string
}

export interface TiActorIntelligenceContract {
    actorClass?: string
    attribution?: string
    firstSeen?: string
    lastSeen?: string
    motivation?: string[]
    malwareTools?: string[]
    campaigns?: string[]
    infrastructure?: string[]
    targetSectors?: string[]
    geographies?: string[]
    confidence?: number
    confidenceReasoning?: string[]
    sourceProvenance?: string[]
}

export interface TiActionabilityContract {
    schemaVersion?: 'ti.query.actionability.v1'
    alertDisposition?: 'ready_for_alert_review' | 'watchlist_required' | 'case_ready' | 'not_alertable' | 'needs_enrichment'
    shouldAlert?: boolean
    rationale?: string
    watchlistCandidates?: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        reason: string
        confidence?: number
    }>
    [key: string]: unknown
}

export interface TiSearchResponse {
    query: string
    queryKind?: 'actor' | 'domain' | 'cve' | 'indicator' | 'organization' | 'free_text'
    generatedAt: string
    mode: 'scraper' | 'seeded' | 'live_search'
    status?: TiResultState
    runId?: string
    refreshAfterSeconds?: number
    summary: string
    confidence: number
    lastSeen: string
    aliases: string[]
    recentActivity: TiActivity[]
    targets: TiTarget[]
    ttps: TiTtp[]
    datasets: TiDataset[]
    sources: TiSource[]
    notes: string[]
    operationalStatus?: unknown
    analystLoop?: unknown
    actorIntelligence?: TiActorIntelligenceContract
    actionability?: TiActionabilityContract
    [key: string]: unknown
}

const cache = new Map<string, { expiresAt: number, result: TiSearchResponse }>()

export async function searchThreatIntel(input: TiSearchRequest): Promise<TiSearchResponse> {
    const query = input.query.trim()
    if (!query) throw new Error('query is required')

    const queryKind = classifyTiQuery(query)
    const key = query.toLowerCase()
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.result, queryKind, generatedAt: new Date().toISOString() }
    }
    if (cached) cache.delete(key)

    const scraperBase = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    if (scraperBase) {
        const scraperResult = await fetchCanonicalScraperSearch(scraperBase, query)
        if (scraperResult) {
            const result = { ...scraperResult, queryKind, mode: 'scraper' as const }
            writeCache(key, result)
            return result
        }
    }

    const result = unavailableResult(query, queryKind)
    writeCache(key, result)
    return result
}

export function classifyTiQuery(query: string): NonNullable<TiSearchResponse['queryKind']> {
    const clean = query.trim()
    if (/^cve-\d{4}-\d{4,}$/i.test(clean)) return 'cve'
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(clean)) return 'domain'
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(clean) || /^(?:https?:\/\/|[a-f0-9]{32,128}$)/i.test(clean)) return 'indicator'
    if (/^(?:apt\d+|unc\d+|ta\d+)$/i.test(clean)) return 'actor'
    if (/\b(?:inc|corp|corporation|company|limited|ltd|llc|group|bank|university|hospital)\b/i.test(clean) || clean.includes(' ')) return 'organization'
    return 'free_text'
}

async function fetchCanonicalScraperSearch(scraperBase: string, query: string): Promise<TiSearchResponse | null> {
    try {
        const target = new URL('/v1/intel/search', `${scraperBase}/`)
        target.searchParams.set('q', query)
        target.searchParams.set('entityType', scraperEntityType(query))
        target.searchParams.set('limit', '50')
        const response = await fetch(target, { signal: AbortSignal.timeout(12_000) })
        if (!response.ok) return null
        const result = await response.json() as TiSearchResponse
        if (result.query.trim().toLowerCase() !== query.toLowerCase() || !Array.isArray(result.sources) || !Array.isArray(result.recentActivity)) return null
        return result
    } catch {
        return null
    }
}

function unavailableResult(query: string, queryKind: NonNullable<TiSearchResponse['queryKind']>): TiSearchResponse {
    const domainCandidate = queryKind === 'domain' ? [{
        kind: 'domain' as const,
        value: query.toLowerCase(),
        reason: 'Exact domain supplied by the user; organization watchlists support domain terms.',
        confidence: 1,
    }] : []
    return {
        query,
        queryKind,
        generatedAt: new Date().toISOString(),
        mode: 'live_search',
        status: 'searching',
        refreshAfterSeconds: 5,
        summary: 'Searching',
        confidence: 0,
        lastSeen: '',
        aliases: [],
        recentActivity: [],
        targets: [],
        ttps: [],
        datasets: [],
        sources: [],
        notes: ['Canonical TI collection is temporarily unavailable; no intelligence was inferred.'],
        actionability: { schemaVersion: 'ti.query.actionability.v1', alertDisposition: 'needs_enrichment', shouldAlert: false, rationale: 'No durable evidence is available.', watchlistCandidates: domainCandidate },
    }
}

function scraperEntityType(query: string) {
    const kind = classifyTiQuery(query)
    return kind === 'organization' ? 'free_text' : kind
}

function writeCache(key: string, result: TiSearchResponse) {
    cache.set(key, { expiresAt: Date.now() + 60_000, result })
    if (cache.size > 500) cache.delete(cache.keys().next().value!)
}
