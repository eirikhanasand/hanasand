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
        provenance?: string
        url?: string
    }>
    notes: string[]
    operationalStatus?: TiOperationalStatus
    analystLoop?: TiAnalystLoop
    collectionStrategy?: TiCollectionStrategy
    actorIntelligence?: TiActorIntelligenceContract
    actionability?: TiActionabilityContract
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
    indicators?: string[]
    targetSectors?: string[]
    geographies?: string[]
    confidence?: number
    confidenceReasoning?: string[]
    sourceProvenance?: string[]
    structuredProvenance?: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        reportDate?: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator' | 'vendor_disclosure' | 'webhook' | 'public_ti'
        parserStatus?: 'parsed' | 'partial' | 'queued' | 'failed' | 'missing_capture' | 'public_reference'
        lastCollectedAt?: string
        confidence?: number
        shownBecause: string
    }>
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
    watchlistMatches?: Array<{
        tenantId?: string
        organizationId?: string
        watchlistId?: string
        watchlistItemId?: string
        kind: 'company' | 'domain' | 'vendor'
        value: string
        route?: string
        casePath?: string
    }>
    relatedAlerts?: Array<{
        id: string
        title: string
        status: string
        severity?: string
        caseIdCandidate?: string
        casePath?: string
        source?: string
        tenantId?: string
        organizationId?: string
        dedupeKey?: string
        recommendedRoute?: string
        captureIds?: string[]
        evidenceCount?: number
        webhookDestinationIds?: string[]
        deliveryReadinessContext?: {
            schemaVersion?: 'dwm.alert_delivery_persistence.v1'
            state?: 'ready' | 'blocked' | 'closed' | 'suppressed' | 'delivered'
            ready?: boolean
            blockerCodes?: string[]
            casePath?: string
            selectedCaptureIds?: string[]
            webhookDestinationIds?: string[]
            entitlement?: {
                status?: string
                blockedReasons?: string[]
            }
        }
    }>
    relatedCases?: Array<{
        id: string
        title: string
        status: string
        priority?: string
        path?: string
    }>
    relatedWebhookDestinations?: Array<{
        id: string
        name: string
        status: 'active' | 'paused' | 'disabled'
        path?: string
    }>
    sourceProvenance?: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator' | 'vendor_disclosure' | 'webhook' | 'public_ti'
        parserStatus?: 'parsed' | 'partial' | 'queued' | 'failed' | 'missing_capture' | 'public_reference'
        reportDate?: string
        lastCollectedAt?: string
        confidence?: number
    }>
    enrichmentGaps?: Array<{
        id: string
        title: string
        severity: 'high' | 'medium' | 'low'
        detail: string
        dependency: string
        route?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator'
        requestedFields?: string[]
    }>
    handoffs?: {
        watchlist?: {
            method: 'POST'
            endpoint: string
            payloads: Array<{ kind: 'company' | 'domain' | 'vendor'; value: string; notes: string }>
            missing?: string[]
        }
        alertRebuild?: {
            method: 'POST'
            endpoint: string
            missing?: string[]
        }
        caseCreate?: {
            method: 'POST'
            endpoint: string
            payload?: { alertId: string; title?: string; priority?: string; note?: string }
            missing?: string[]
        }
        webhookDelivery?: {
            method: 'POST'
            endpoint: string
            payload?: Record<string, unknown>
            missing?: string[]
        }
    }
    entitlementReadiness?: {
        schemaVersion?: 'dwm.entitlement_readiness.v1'
        actions?: Record<string, {
            ownerLane?: string
            status?: 'allowed' | 'blocked' | 'permissive_no_policy' | 'needs_input'
            blockerCodes?: string[]
            route?: string
            dashboardText?: string
            helpdeskText?: string
            blockers?: Array<{
                schemaVersion?: 'dwm.entitlement_blocker.v1'
                ownerLane?: string
                actionId?: string
                blockerCode?: string
                route?: string
                supportText?: string
                dashboardText?: string
            }>
        }>
    }
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
    provenance?: string
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
        const raw = await response.json()
        const result = normalizeTiSearchResponse(raw, clean)
        writeCachedResult(key, result)
        return result
    } catch {
        return null
    }
}

type CapturedTiSearchRow = {
    id: string
    sourceId: string
    sourceName: string
    sourceFamily?: string
    title: string
    summary: string
    collectedAt?: string
    url?: string
    tags?: string[]
    provenanceHash?: string
    metadataOnly?: boolean
}

type CapturedTiSearchEnvelope = {
    query?: string
    status?: TiResultState
    summary?: string[] | string
    rows?: CapturedTiSearchRow[]
    results?: CapturedTiSearchRow[]
    runId?: string
    quality?: {
        score?: number
        status?: string
    }
    actorProfile?: {
        actor?: string
        datasets?: {
            evidenceStageCounts?: Record<string, number>
            sourceCount?: number
        }
    }
    collectionStrategy?: TiCollectionStrategy
}

function normalizeTiSearchResponse(raw: unknown, fallbackQuery: string): TiSearchResponse {
    if (isTiSearchResponse(raw)) return raw
    if (!isRecord(raw)) throw new Error('Invalid TI search response')

    const envelope = raw as CapturedTiSearchEnvelope
    const rows = (Array.isArray(envelope.rows) && envelope.rows.length ? envelope.rows : envelope.results ?? [])
        .filter(isCapturedTiSearchRow)
    if (!rows.length) {
        throw new Error('TI search response has no normalized rows')
    }

    const query = stringValue(envelope.query) || fallbackQuery
    const generatedAt = newestDate(rows.map(row => row.collectedAt)) || new Date().toISOString()
    const confidence = typeof envelope.quality?.score === 'number' ? envelope.quality.score : 0.68
    const status: TiResultState = envelope.status === 'ready' || envelope.status === 'partial' ? envelope.status : 'ready'
    const summary = Array.isArray(envelope.summary)
        ? envelope.summary.find(item => typeof item === 'string' && item.trim()) || `Found ${rows.length} captured source rows for ${query}.`
        : stringValue(envelope.summary) || `Found ${rows.length} captured source rows for ${query}.`
    const sources = uniqueBy(rows.map(row => ({
        id: row.sourceId,
        name: row.sourceName,
        type: row.sourceFamily || 'source_capture',
        provenance: row.url || row.sourceName,
        url: row.url,
    })), source => source.id)
    const structuredProvenance = rows.map(row => ({
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        provenance: row.url || row.sourceName,
        reportDate: row.collectedAt,
        captureId: row.id,
        sourceRequestId: row.sourceId,
        sourceFamily: 'source_capture' as const,
        parserStatus: 'parsed' as const,
        lastCollectedAt: row.collectedAt,
        confidence,
        shownBecause: `${row.sourceName} captured source evidence for ${query}.`,
    }))

    return {
        query,
        generatedAt,
        mode: 'scraper',
        status,
        runId: stringValue(envelope.runId),
        summary,
        confidence,
        lastSeen: generatedAt,
        aliases: aliasesForCapturedRows(query, rows),
        recentActivity: rows.map(row => ({
            date: row.collectedAt || generatedAt,
            title: compactCapturedTitle(row.title, query),
            detail: compactCapturedSummary(row.summary, query),
            confidence,
            sourceIds: [row.sourceId],
            url: row.url,
            claimType: claimTypeForTags(row.tags ?? []),
            firstReportedAt: row.collectedAt,
            lastReportedAt: row.collectedAt,
            publisherCount: 1,
            corroboratingSourceIds: [row.sourceId],
        })),
        targets: targetsForCapturedRows(rows),
        ttps: ttpsForCapturedRows(rows),
        datasets: [{
            name: 'Captured source evidence',
            type: 'source_capture',
            coverage: `${rows.length} captured source row${rows.length === 1 ? '' : 's'}`,
            status: 'ready',
        }],
        sources,
        notes: [`${rows.length} captured source row${rows.length === 1 ? '' : 's'} available for source review and case evidence.`],
        actorIntelligence: {
            actorClass: /lockbit/i.test(query) ? 'Ransomware and extortion actor' : 'Threat intelligence query',
            attribution: `${query} source coverage is backed by captured public-intelligence rows.`,
            firstSeen: oldestDate(rows.map(row => row.collectedAt)) || generatedAt,
            lastSeen: generatedAt,
            motivation: /lockbit/i.test(query) ? ['Financial extortion', 'Data theft pressure', 'Victim publication leverage'] : undefined,
            malwareTools: /lockbit/i.test(query) ? ['LockBit ransomware'] : undefined,
            campaigns: rows.map(row => compactCapturedTitle(row.title, query)).slice(0, 6),
            infrastructure: rows.filter(row => /onion|infrastructure|rss|feed|source/i.test(`${row.sourceName} ${row.title}`)).map(row => row.sourceName).slice(0, 6),
            indicators: rows.map(row => domainFromUrl(row.url)).filter((value): value is string => Boolean(value)).slice(0, 8),
            confidence,
            confidenceReasoning: [
                `${rows.length} captured source row${rows.length === 1 ? '' : 's'} support this actor profile.`,
                'Capture IDs are available for source review and case handoff.',
            ],
            sourceProvenance: rows.map(row => row.url || row.sourceName).slice(0, 8),
            structuredProvenance,
        },
        actionability: {
            schemaVersion: 'ti.query.actionability.v1',
            alertDisposition: 'ready_for_alert_review',
            shouldAlert: true,
            rationale: `${rows.length} captured source row${rows.length === 1 ? '' : 's'} can seed watchlist, alert review, and case evidence.`,
            watchlistCandidates: watchlistCandidatesForCapturedRows(query, rows),
            sourceProvenance: structuredProvenance,
            enrichmentGaps: [],
            handoffs: {
                watchlist: {
                    method: 'POST',
                    endpoint: '/v1/dwm/watchlists',
                    payloads: watchlistCandidatesForCapturedRows(query, rows).map(candidate => ({
                        kind: candidate.kind,
                        value: candidate.value,
                        notes: candidate.reason,
                    })),
                    missing: ['authenticated organization context'],
                },
                alertRebuild: {
                    method: 'POST',
                    endpoint: '/v1/dwm/alerts/rebuild',
                    missing: ['saved organization watchlist match'],
                },
                caseCreate: {
                    method: 'POST',
                    endpoint: '/v1/cases',
                    missing: ['generated alert ID'],
                },
            },
        },
        collectionStrategy: envelope.collectionStrategy,
    }
}

function isTiSearchResponse(value: unknown): value is TiSearchResponse {
    return isRecord(value)
        && typeof value.query === 'string'
        && typeof value.summary === 'string'
        && Array.isArray(value.recentActivity)
        && Array.isArray(value.sources)
}

function isCapturedTiSearchRow(value: unknown): value is CapturedTiSearchRow {
    return isRecord(value)
        && typeof value.id === 'string'
        && typeof value.sourceId === 'string'
        && typeof value.sourceName === 'string'
        && typeof value.title === 'string'
        && typeof value.summary === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : undefined
}

function aliasesForCapturedRows(query: string, rows: CapturedTiSearchRow[]) {
    const values = new Set<string>([query])
    rows.forEach(row => {
        if (/lockbit/i.test(`${row.title} ${row.sourceName}`)) values.add('LockBit')
        if (/lockbit2/i.test(`${row.title} ${row.sourceName}`)) values.add('LockBit 2.0')
        if (/lockbit3/i.test(`${row.title} ${row.sourceName}`)) values.add('LockBit 3.0')
    })
    return Array.from(values).slice(0, 8)
}

function watchlistCandidatesForCapturedRows(query: string, rows: CapturedTiSearchRow[]): NonNullable<TiActionabilityContract['watchlistCandidates']> {
    return aliasesForCapturedRows(query, rows).map(value => ({
        kind: 'vendor' as const,
        value,
        reason: `${value} appears in captured public-intelligence source evidence.`,
        confidence: 0.72,
    }))
}

function targetsForCapturedRows(rows: CapturedTiSearchRow[]): TiSearchResponse['targets'] {
    const tags = rows.flatMap(row => row.tags ?? [])
    if (!tags.some(tag => /victim|breach|leak|extortion|ransomware/i.test(tag))) return []
    return [{
        sector: 'Organizations exposed to ransomware and extortion activity',
        regions: ['Global'],
        rationale: 'Captured source rows include ransomware, victim, breach, leak, or extortion terms.',
        confidence: 0.66,
    }]
}

function ttpsForCapturedRows(rows: CapturedTiSearchRow[]): TiSearchResponse['ttps'] {
    const tags = new Set(rows.flatMap(row => row.tags ?? []).map(tag => tag.toLowerCase()))
    const ttps: TiSearchResponse['ttps'] = []
    if (tags.has('ransomware')) ttps.push({ name: 'Data Encrypted for Impact', attackId: 'T1486', tactic: 'Impact', detail: 'Captured source rows reference ransomware activity.', confidence: 0.66 })
    if (tags.has('extortion') || tags.has('leak')) ttps.push({ name: 'Exfiltration and extortion pressure', tactic: 'Exfiltration', detail: 'Captured source rows reference leak or extortion context.', confidence: 0.62 })
    if (tags.has('exploit') || tags.has('cve')) ttps.push({ name: 'Exploit or vulnerability-driven access', tactic: 'Initial Access', detail: 'Captured source rows reference exploit or CVE context.', confidence: 0.58 })
    return ttps
}

function claimTypeForTags(tags: string[]): TiSearchResponse['recentActivity'][number]['claimType'] {
    if (tags.some(tag => /victim|breach|leak|extortion/i.test(tag))) return 'victim_claim'
    if (tags.some(tag => /malware|ransomware/i.test(tag))) return 'malware_activity'
    if (tags.some(tag => /exploit|cve/i.test(tag))) return 'vulnerability_exploitation'
    return 'general_activity'
}

function compactCapturedTitle(value: string, query: string) {
    const cleaned = value.replace(/^NFE\/5\.0\s+/i, '').replace(/\s+-\s+Google News.*$/i, '').replace(/\s+/g, ' ').trim()
    return cleaned.length ? cleaned.slice(0, 140) : `${query} captured source activity`
}

function compactCapturedSummary(value: string, query: string) {
    const cleaned = value.replace(/^Google News [^\n]+\n/i, '').replace(/\s+/g, ' ').trim()
    return cleaned.length ? cleaned.slice(0, 260) : `${query} source evidence captured for analyst review.`
}

function newestDate(values: Array<string | undefined>) {
    return values.filter((value): value is string => Boolean(value)).sort().at(-1)
}

function oldestDate(values: Array<string | undefined>) {
    return values.filter((value): value is string => Boolean(value)).sort()[0]
}

function domainFromUrl(value?: string) {
    if (!value) return undefined
    try {
        return new URL(value).hostname.replace(/^www\./, '')
    } catch {
        return undefined
    }
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
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
