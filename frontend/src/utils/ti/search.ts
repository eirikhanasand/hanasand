import config from '@/config'

const cacheTtlMs = 60_000
const memoryCache = new Map<string, { expiresAt: number; result: TiSearchResponse }>()
const browserCachePrefix = 'hanasand:ti-search:'

export interface TiSearchResponse {
    query: string
    generatedAt: string
    mode: 'scraper' | 'seeded' | 'live_search'
    status?: TiResultState
    runId?: string
    refreshAfterSeconds?: number
    summary: string
    confidence: number
    lastSeen: string
    aliases: string[]
    recentActivity: Array<{
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
    }>
    targets: Array<{
        sector: string
        regions: string[]
        rationale: string
        confidence: number
    }>
    ttps: Array<{
        name: string
        attackId?: string
        tactic: string
        detail: string
        confidence: number
    }>
    datasets: Array<{
        name: string
        type: string
        coverage: string
        status: string
        url?: string
    }>
    sources: Array<{
        id: string
        name: string
        type: string
        provenance: string
        url?: string
    }>
    notes: string[]
    operationalStatus?: TiOperationalStatus
    analystLoop?: TiAnalystLoop
    collectionStrategy?: TiCollectionStrategy
}

export interface TiCollectionStrategy {
    thesis: string
    productFocus: string[]
    sourcePosture: Array<{
        source: string
        role: 'primary_seed' | 'corroboration' | 'context_only' | 'rejected_paid_rows' | 'owned_collection_target'
        summary: string
        buyerValue: string
        limitations?: string
    }>
    ownedCollection: {
        priority: 'primary'
        summary: string
        requirements: string[]
        prohibited: string[]
    }
    distribution: {
        primarySurface: 'hanasand.com'
        secondarySurface: 'apify'
        summary: string
    }
}

export type TiResultState = 'queued' | 'searching' | 'partial' | 'ready' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation'

export interface TiOperationalStatus {
    state: 'idle' | 'queued' | 'searching' | 'partial' | 'ready' | 'blocked' | 'degraded' | 'metadata_review' | 'needs_source_activation'
    headline: string
    queue: {
        selectedTasks: number
        queuedTasks: number
        leasedTasks: number
        reviewTasks: number
        maxAgeSeconds: number
        p95AgeSeconds: number
        nextPollSeconds?: number
        backpressureState?: string
        cursorContinuity?: string
    }
    workers: {
        leaseState: string
        retryDebt: number
        deadLetters: number
        backoffState: string
        concurrency: string
        fairness: string
        memoryPressure?: number
    }
    budgets: Array<{
        workClass: string
        queued: number
        leased: number
        budgetSlots: number
        maxAgeSeconds: number
        retryDebt: number
        action: string
    }>
    fairness: {
        ok: boolean
        worstGroup?: string
        worstShare: number
    }
    aging: Array<{
        label: string
        seconds: number
        tone: 'ok' | 'watch' | 'bad'
    }>
    controls: Array<{
        action: string
        scenario?: string
        warningCodes: string[]
        queueDelta: number
        workerDelta: number
        rollback: string
    }>
    notes: string[]
}

export interface TiAnalystLoop {
    resultState: TiResultState
    headline: string
    nextSteps: Array<{
        state: 'queued' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation' | 'ready'
        label: string
        detail: string
        tone: 'ok' | 'watch' | 'bad'
    }>
    runStatusClarity: {
        queuedTasks: number
        reviewTasks: number
        rejectedSources: number
        blockedUnsafeTargets: number
        meaningfulWorkCount: number
        summary: string
    }
    metadataReviewInbox: TiMetadataReviewItem[]
    sourceActivationWorkflow: {
        required: boolean
        dryRunOnly: boolean
        actions: Array<{
            action: 'request_approval' | 'restore_source' | 'enable_metadata_only_queue' | 'keep_blocked'
            sourceId?: string
            reason: string
            execution: 'dry_run' | 'human_approval_required' | 'blocked'
        }>
    }
    victimNotificationPacket?: TiVictimNotificationPacket
}

export interface TiMetadataReviewItem {
    id: string
    company?: string
    victim?: string
    affectedAccounts?: string
    accountSubjects?: string
    datasetSize?: string
    actorStatement?: string
    claimedDate?: string
    sourceHash?: string
    provenance: string
    confidence: number
    status: 'needs_review' | 'queued_metadata_only' | 'duplicate' | 'escalated'
    allowedActions: Array<'notify_company' | 'mark_duplicate' | 'request_approval' | 'escalate'>
}

export interface TiVictimNotificationPacket {
    company?: string
    claimSummary: string
    affectedAccounts?: string
    datasetSize?: string
    actorStatement?: string
    sourceHash?: string
    confidence: number
    whatWasNotAccessed: string[]
    recommendedAction: string
}

export default async function searchThreatIntel(query: string): Promise<TiSearchResponse | null> {
    const clean = query.trim()
    if (!clean) return null

    const key = clean.toLowerCase()
    const cached = readCachedResult(key)
    if (cached) return cached

    let response: Response
    try {
        response = await fetch(`${config.url.api}/ti/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: clean })
        })
    } catch {
        return null
    }

    if (!response.ok) {
        return null
    }

    try {
        const result = await response.json() as TiSearchResponse
        writeCachedResult(key, result)
        return result
    } catch {
        return null
    }
}

function readCachedResult(key: string) {
    const now = Date.now()
    const memoryHit = memoryCache.get(key)
    if (memoryHit && memoryHit.expiresAt > now) {
        return memoryHit.result
    }
    if (memoryHit) memoryCache.delete(key)

    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(`${browserCachePrefix}${key}`)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { expiresAt?: number; result?: TiSearchResponse }
        if (!parsed.expiresAt || parsed.expiresAt <= now || !parsed.result?.query) {
            window.localStorage.removeItem(`${browserCachePrefix}${key}`)
            return null
        }
        return parsed.result
    } catch {
        return null
    }
}

function writeCachedResult(key: string, result: TiSearchResponse) {
    if (result.status === 'queued' || result.status === 'searching') {
        return
    }

    const record = { expiresAt: Date.now() + cacheTtlMs, result }
    memoryCache.set(key, record)

    if (typeof window === 'undefined') return

    try {
        window.localStorage.setItem(`${browserCachePrefix}${key}`, JSON.stringify(record))
    } catch {
        // Storage can be unavailable in private or locked-down browser contexts.
    }
}
