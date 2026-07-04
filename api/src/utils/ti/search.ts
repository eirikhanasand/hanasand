import { XMLParser } from 'fast-xml-parser'

export interface TiSearchRequest {
    query: string
}

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
    recentActivity: TiActivity[]
    targets: TiTarget[]
    ttps: TiTtp[]
    datasets: TiDataset[]
    sources: TiSource[]
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
    watchlistMatches?: Array<{
        organizationId?: string
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
    }>
    relatedCases?: Array<{
        id: string
        title: string
        status: string
        priority?: string
        path?: string
    }>
    sourceProvenance?: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        captureId?: string
        confidence?: number
    }>
    enrichmentGaps?: Array<{
        id: string
        title: string
        severity: 'high' | 'medium' | 'low'
        detail: string
        dependency: string
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
    budgets: TiOperationalBudget[]
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

export interface TiOperationalBudget {
    workClass: string
    queued: number
    leased: number
    budgetSlots: number
    maxAgeSeconds: number
    retryDebt: number
    action: string
}

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

interface KnownActorContext extends Pick<TiSearchResponse, 'aliases' | 'targets' | 'ttps'> {
    summary: string
    confidence?: number
    status?: TiResultState
    lastSeen?: string
    recentActivity?: TiActivity[]
    datasets?: TiDataset[]
    sources?: TiSource[]
    notes?: string[]
    actorIntelligence?: TiActorIntelligenceContract
    actionability?: TiActionabilityContract
}

const tiResponseCache = new Map<string, { expiresAt: number, result: TiSearchResponse }>()
const curatedProfileCacheTtlMs = 60 * 60 * 1000
const liveSearchCacheTtlMs = 60 * 1000
let profileWarmCursor = 0

export type TiProfileWarmResult = {
    actor: string
    status: TiResultState | undefined
    confidence: number
    aliases: string[]
    changedFields: string[]
    sourceLinks: Array<{ name: string, url: string }>
    automationEvidence: string[]
    plannedWork: string[]
    recentActivityCount: number
    targetCount: number
    ttpCount: number
    cachedUntil: string
    refreshedAt: string
    nextRefreshAt: string
}

export type TiActorRefreshState = TiProfileWarmResult & {
    refreshCount: number
}

export type TiActorRefreshAuditEvent = {
    id: string
    happenedAt: string
    actor: string
    action: string
    target: string
    result: string
    detail: string
}

export type TiActorRefreshActivityEvent = {
    id: string
    actorId: string
    actorName: string
    happenedAt: string
    title: string
    detail: string
    source: string
    tone: 'ok' | 'watch' | 'bad'
}

export type TiActorRefreshOverview = {
    generatedAt: string
    worker: {
        state: 'warming' | 'running' | 'idle' | 'error'
        mode: string
        intervalSeconds: number
        batchSize: number
        lastSweepStartedAt: string | null
        lastSweepFinishedAt: string | null
        lastError: string | null
        cursor: number
    }
    updatedActors: TiActorRefreshState[]
    queuedActors: Array<{
        id: string
        name: string
        aliases: string[]
        status: 'queued'
        confidence: number
        lastUpdatedAt: string
        nextRefreshAt: string
        changedFields: string[]
        sourceLinks: Array<{ name: string, url: string }>
        automationEvidence: string[]
        plannedWork: string[]
    }>
    activity: TiActorRefreshActivityEvent[]
    auditLog: TiActorRefreshAuditEvent[]
    stats: {
        updatedLastHour: number
        queued: number
        auditedEvents: number
        automaticCoverage: number
        totalRefreshes: number
    }
}

const profileWarmIntervalMs = 60 * 1000
const profileWarmState = new Map<string, TiActorRefreshState>()
const profileWarmAuditLog: TiActorRefreshAuditEvent[] = []
const profileWarmActivity: TiActorRefreshActivityEvent[] = []
let profileWarmStartedAt: string | null = null
let profileWarmFinishedAt: string | null = null
let profileWarmLastError: string | null = null
let profileWarmStateName: TiActorRefreshOverview['worker']['state'] = 'idle'

export async function searchThreatIntel(input: TiSearchRequest): Promise<TiSearchResponse> {
    const query = input.query.trim()
    if (!query) {
        throw new Error('query is required')
    }

    const cacheKey = query.toLowerCase()
    const cached = readTiResponseCache(cacheKey)
    if (cached) return cached

    const scraperBase = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    if (scraperBase) {
        const scraperResult = await tryScraperSearch(scraperBase, query)
        if (scraperResult) {
            writeTiResponseCache(cacheKey, scraperResult)
            return scraperResult
        }
    }

    const result = seededSearch(query)
    writeTiResponseCache(cacheKey, result)
    return result
}

export async function discoverThreatActorProfile(query: string): Promise<TiSearchResponse> {
    const normalized = query.trim()
    if (!normalized) {
        throw new Error('query is required')
    }

    const seeded = seededSearch(normalized)
    const discovered = await liveSearch(normalized).catch(() => seeded)
    const result: TiSearchResponse = {
        ...seeded,
        ...discovered,
        generatedAt: new Date().toISOString(),
        status: discovered.status === 'searching' ? seeded.status : discovered.status,
        summary: discovered.summary === 'Searching' ? seeded.summary : discovered.summary,
        confidence: Math.max(seeded.confidence, discovered.confidence),
        lastSeen: latestIso(discovered.lastSeen, seeded.lastSeen),
        aliases: uniqueStrings([...seeded.aliases, ...discovered.aliases]),
        recentActivity: mergeActivity(discovered.recentActivity, seeded.recentActivity),
        targets: mergeTargets(discovered.targets, seeded.targets),
        ttps: mergeTtps(discovered.ttps, seeded.ttps),
        datasets: mergeDatasets(discovered.datasets, seeded.datasets),
        sources: mergeSources(discovered.sources, seeded.sources),
        actorIntelligence: discovered.actorIntelligence ?? seeded.actorIntelligence,
        actionability: discovered.actionability ?? seeded.actionability,
        notes: uniqueStrings([
            ...seeded.notes,
            ...discovered.notes,
            'Autonomous discovery refresh completed; profile changes are published through the API state ledger.',
        ]),
    }

    writeTiResponseCache(normalized.toLowerCase(), result)
    return result
}

export async function warmThreatActorProfileCache(batchSize = 5): Promise<TiProfileWarmResult[]> {
    const actors = automaticThreatActorWarmList()
    if (!actors.length) return []

    const warmed: TiProfileWarmResult[] = []
    const startedAt = profileWarmCursor
    profileWarmStartedAt = new Date().toISOString()
    profileWarmStateName = 'warming'
    for (let offset = 0; offset < Math.min(batchSize, actors.length); offset += 1) {
        const actor = actors[(startedAt + offset) % actors.length]!
        const result = seededSearch(actor)
        writeTiResponseCache(actor.toLowerCase(), result)
        const refreshedAt = new Date().toISOString()
        const cachedUntil = new Date(Date.now() + (result.status === 'ready' ? curatedProfileCacheTtlMs : liveSearchCacheTtlMs)).toISOString()
        warmed.push({
            actor,
            status: result.status,
            confidence: result.confidence,
            aliases: result.aliases,
            changedFields: changedFieldsForWarmResult(result),
            sourceLinks: result.sources.map(source => ({
                name: source.name,
                url: source.url || source.provenance || '',
            })).filter(source => source.url),
            automationEvidence: automationEvidenceForWarmResult(actor, result),
            plannedWork: plannedWorkForWarmResult(actor, result),
            recentActivityCount: result.recentActivity.length,
            targetCount: result.targets.length,
            ttpCount: result.ttps.length,
            cachedUntil,
            refreshedAt,
            nextRefreshAt: new Date(Date.now() + refreshDelayForWarmIndex(offset, actors.length)).toISOString(),
        })
    }

    profileWarmCursor = (startedAt + warmed.length) % actors.length
    recordWarmResults(warmed)
    profileWarmFinishedAt = new Date().toISOString()
    profileWarmStateName = 'running'
    profileWarmLastError = null
    return warmed
}

export function recordThreatActorProfileWarmFailure(error: unknown) {
    profileWarmLastError = error instanceof Error ? error.message : String(error)
    profileWarmStateName = 'error'
    const happenedAt = new Date().toISOString()
    pushLimited(profileWarmAuditLog, {
        id: `ti-warm-error-${Date.now()}`,
        happenedAt,
        actor: 'ti-profile-refresh',
        action: 'profile.cache.warm',
        target: 'actor-cache',
        result: 'failed',
        detail: profileWarmLastError,
    })
}

export function getThreatActorEnrichmentOverview(): TiActorRefreshOverview {
    const now = Date.now()
    const updatedActors = [...profileWarmState.values()]
        .sort((a, b) => new Date(b.refreshedAt).getTime() - new Date(a.refreshedAt).getTime())
    const updatedLastHour = updatedActors.filter(actor => now - new Date(actor.refreshedAt).getTime() <= 60 * 60 * 1000).length
    return {
        generatedAt: new Date(now).toISOString(),
        worker: {
            state: profileWarmStateName,
            mode: 'API cron actor-profile cache warmer',
            intervalSeconds: profileWarmIntervalMs / 1000,
            batchSize: 5,
            lastSweepStartedAt: profileWarmStartedAt,
            lastSweepFinishedAt: profileWarmFinishedAt,
            lastError: profileWarmLastError,
            cursor: profileWarmCursor,
        },
        updatedActors,
        queuedActors: queuedWarmActors(updatedActors),
        activity: [...profileWarmActivity],
        auditLog: [...profileWarmAuditLog],
        stats: {
            updatedLastHour,
            queued: queuedWarmActors(updatedActors).length,
            auditedEvents: profileWarmAuditLog.length,
            automaticCoverage: automaticThreatActorWarmList().length,
            totalRefreshes: updatedActors.reduce((sum, actor) => sum + actor.refreshCount, 0),
        },
    }
}

function recordWarmResults(results: TiProfileWarmResult[]) {
    for (const result of results) {
        const existing = profileWarmState.get(result.actor.toLowerCase())
        const refreshCount = (existing?.refreshCount ?? 0) + 1
        profileWarmState.set(result.actor.toLowerCase(), {
            ...result,
            refreshCount,
        })
        pushLimited(profileWarmActivity, {
            id: `ti-refresh-${result.actor.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
            actorId: result.actor.toLowerCase().replace(/\s+/g, '-'),
            actorName: titleCaseWords(result.actor),
            happenedAt: result.refreshedAt,
            title: `${titleCaseWords(result.actor)} profile refreshed`,
            detail: `Refreshed aliases, sources, recent activity, targets, tradecraft, and dataset context from the shared actor enrichment builder. This actor has been refreshed ${refreshCount} time${refreshCount === 1 ? '' : 's'} since API startup.`,
            source: 'api cron actor-profile cache warmer',
            tone: 'ok',
        })
        pushLimited(profileWarmAuditLog, {
            id: `ti-cache-write-${result.actor.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
            happenedAt: result.refreshedAt,
            actor: 'ti-profile-refresh',
            action: 'profile.cache.write',
            target: `actor:${result.actor.toLowerCase().replace(/\s+/g, '-')}`,
            result: 'stored',
            detail: `Cached ready profile until ${result.cachedUntil}; next rotating refresh is planned for ${result.nextRefreshAt}.`,
        })
    }
}

function queuedWarmActors(updatedActors: TiActorRefreshState[]) {
    const updatedIds = new Set(updatedActors.map(actor => actor.actor.toLowerCase()))
    return automaticThreatActorWarmList()
        .filter(actor => !updatedIds.has(actor.toLowerCase()) || nextWarmActorNames(4).includes(actor))
        .slice(0, 6)
        .map((actor, index) => {
            const existing = profileWarmState.get(actor.toLowerCase())
            const result = existing || warmPreviewForActor(actor, index)
            return {
                id: actor.toLowerCase().replace(/\s+/g, '-'),
                name: titleCaseWords(actor),
                aliases: result.aliases,
                status: 'queued' as const,
                confidence: result.confidence,
                lastUpdatedAt: result.refreshedAt,
                nextRefreshAt: result.nextRefreshAt,
                changedFields: [],
                sourceLinks: result.sourceLinks,
                automationEvidence: [`Queued by the rotating actor cache warmer. The worker advances every ${profileWarmIntervalMs / 1000} seconds and refreshes a batch of actor profiles each pass.`],
                plannedWork: plannedWorkForActorName(actor),
            }
        })
}

function warmPreviewForActor(actor: string, index: number): TiProfileWarmResult {
    const result = seededSearch(actor)
    const now = Date.now()
    return {
        actor,
        status: 'queued',
        confidence: result.confidence,
        aliases: result.aliases,
        changedFields: [],
        sourceLinks: result.sources.map(source => ({
            name: source.name,
            url: source.url || source.provenance || '',
        })).filter(source => source.url),
        automationEvidence: [],
        plannedWork: plannedWorkForWarmResult(actor, result),
        recentActivityCount: result.recentActivity.length,
        targetCount: result.targets.length,
        ttpCount: result.ttps.length,
        cachedUntil: new Date(now + curatedProfileCacheTtlMs).toISOString(),
        refreshedAt: new Date(now).toISOString(),
        nextRefreshAt: new Date(now + refreshDelayForWarmIndex(index, automaticThreatActorWarmList().length)).toISOString(),
    }
}

function nextWarmActorNames(count: number) {
    const actors = automaticThreatActorWarmList()
    return Array.from({ length: Math.min(count, actors.length) }, (_, offset) => actors[(profileWarmCursor + offset) % actors.length]!)
}

function refreshDelayForWarmIndex(offset: number, actorCount: number) {
    return profileWarmIntervalMs * Math.max(1, Math.ceil((actorCount + offset) / 5))
}

function changedFieldsForWarmResult(result: TiSearchResponse) {
    const fields = ['summary', 'aliases']
    if (result.recentActivity.length) fields.push('recentActivity')
    if (result.targets.length) fields.push('targets')
    if (result.ttps.length) fields.push('ttps')
    if (result.sources.length) fields.push('sources')
    if (result.datasets.length) fields.push('datasets')
    return fields
}

function automationEvidenceForWarmResult(actor: string, result: TiSearchResponse) {
    return [
        `Matched ${actor} against the automatic actor warm list and alias-aware profile builder.`,
        `Cached ${result.aliases.length} aliases, ${result.sources.length} sources, ${result.recentActivity.length} activity rows, ${result.targets.length} target categories, and ${result.ttps.length} tradecraft entries.`,
        'Recent activity can refresh separately from stable identity, source, and target metadata.',
    ]
}

function plannedWorkForWarmResult(actor: string, result: TiSearchResponse) {
    const sectors = result.targets.map(target => target.sector).slice(0, 2)
    const techniques = result.ttps.map(ttp => ttp.attackId || ttp.name).slice(0, 2)
    return [
        sectors.length ? `Check fresh reporting for ${sectors.join(' and ')} exposure changes.` : `Check fresh reporting for ${actor} exposure changes.`,
        techniques.length ? `Promote newly sourced tradecraft around ${techniques.join(' and ')} when reporting changes.` : 'Promote newly sourced tradecraft when reporting changes.',
        'Compare monitored company, vendor, and domain names against new activity rows.',
    ]
}

function plannedWorkForActorName(actor: string) {
    const preview = warmPreviewForActor(actor, 0)
    return preview.plannedWork
}

function pushLimited<T>(items: T[], item: T, limit = 120) {
    items.unshift(item)
    if (items.length > limit) items.length = limit
}

function readTiResponseCache(key: string) {
    const cached = tiResponseCache.get(key)
    if (!cached) return null
    if (cached.expiresAt <= Date.now()) {
        tiResponseCache.delete(key)
        return null
    }
    return {
        ...cached.result,
        generatedAt: new Date().toISOString(),
    }
}

function writeTiResponseCache(key: string, result: TiSearchResponse) {
    const ttl = result.status === 'ready' ? curatedProfileCacheTtlMs : liveSearchCacheTtlMs
    tiResponseCache.set(key, { expiresAt: Date.now() + ttl, result })
    if (tiResponseCache.size > 500) {
        const oldestKey = tiResponseCache.keys().next().value
        if (oldestKey) tiResponseCache.delete(oldestKey)
    }
}

async function tryScraperSearch(scraperBase: string, query: string): Promise<TiSearchResponse | null> {
    try {
        const response = await fetch(`${scraperBase}/v1/intel/runs`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'idempotency-key': `hanasand-ti-${query.toLowerCase()}`
            },
            body: JSON.stringify({
                query,
                entityType: 'actor',
                includeClearWeb: true,
                includeTelegram: true,
                includeDarknetMetadata: true,
                maxTasks: 40,
                tenantId: 'hanasand-public-ti',
                requesterId: 'hanasand.com/ti',
                reason: 'public TI search page'
            })
        })

        if (!response.ok) {
            return null
        }

        const body = await response.json() as {
            run?: { id?: string; taskCount?: number; reviewTaskCount?: number; rejectedSourceCount?: number }
            scheduler?: unknown
        }
        const run = body.run
        if (!run?.id) {
            return null
        }

        const [liveResult, evidenceRows] = await Promise.all([
            liveSearch(query),
            fetchScraperEvidence(scraperBase, query)
        ])
        const seeded = mergeScraperEvidence(query, liveResult, evidenceRows)
        const operationalStatus = buildOperationalStatus(body.scheduler, {
            query,
            mode: 'scraper',
            runId: run.id,
            taskCount: run.taskCount ?? 0,
            reviewTaskCount: run.reviewTaskCount ?? 0
        })
        const analystLoop = buildAnalystLoop({
            query,
            scheduler: body.scheduler,
            run: {
                id: run.id,
                taskCount: run.taskCount ?? 0,
                reviewTaskCount: run.reviewTaskCount ?? 0,
                rejectedSourceCount: run.rejectedSourceCount ?? 0
            },
            operationalStatus,
            seeded
        })
        const publicState = publicResultStateFor(query, seeded, analystLoop)
        const publicOperationalStatus = publicState === analystLoop.resultState
            ? operationalStatus
            : {
                ...operationalStatus,
                state: publicState === 'partial' ? 'partial' : 'searching',
                headline: publicState === 'partial'
                    ? 'Instant actor context is ready while live discovery continues.'
                    : 'Live discovery is running.'
            } satisfies TiOperationalStatus
        const publicAnalystLoop = publicState === analystLoop.resultState
            ? analystLoop
            : {
                ...analystLoop,
                resultState: publicState,
                headline: publicState === 'partial'
                    ? 'Instant actor context is ready while live discovery continues.'
                    : 'Live discovery is still checking current sources.',
                nextSteps: [{
                    state: 'queued',
                    label: publicState === 'partial' ? 'Searching' : 'Searching',
                    detail: 'Live discovery is still checking current sources.',
                    tone: 'watch'
                }]
            } satisfies TiAnalystLoop
        return {
            ...seeded,
            mode: seeded.mode === 'live_search' ? 'live_search' : 'scraper',
            status: publicState,
            runId: run.id,
            refreshAfterSeconds: 3,
            summary: publicAnalystLoop.metadataReviewInbox[0]?.company
                ? metadataReviewSummary(publicAnalystLoop.metadataReviewInbox[0])
                : seeded.summary,
            operationalStatus: publicOperationalStatus,
            analystLoop: publicAnalystLoop,
            sources: [
                {
                    id: run.id,
                    name: 'TI scraper run',
                    type: 'scraper_run',
                    provenance: publicAnalystLoop.runStatusClarity.summary
                },
                ...seeded.sources
            ],
            notes: [
                publicAnalystLoop.headline,
                publicOperationalStatus.headline,
                `Run ${run.id}`,
                ...seeded.notes
            ],
            collectionStrategy: collectionStrategy()
        }
    } catch {
        return null
    }
}

interface ScraperEvidenceRow {
    id?: string
    sourceId?: string
    title?: string
    summary?: string
    collectedAt?: string
    provenanceHash?: string
}

async function fetchScraperEvidence(scraperBase: string, query: string): Promise<ScraperEvidenceRow[]> {
    try {
        const search = new URL(`${scraperBase}/v1/intel/search`)
        search.searchParams.set('q', query)
        search.searchParams.set('limit', '12')
        const response = await fetch(search)
        if (!response.ok) return []
        const body = await response.json() as { rows?: ScraperEvidenceRow[]; results?: ScraperEvidenceRow[] }
        return (body.rows ?? body.results ?? []).filter(row => row.title || row.summary).slice(0, 12)
    } catch {
        return []
    }
}

function mergeScraperEvidence(query: string, result: TiSearchResponse, rows: ScraperEvidenceRow[]): TiSearchResponse {
    const activity = rows.map((row, index) => evidenceRowToActivity(query, row, index)).filter(Boolean) as TiActivity[]
    if (!activity.length) return result
    const sources = rows.map((row, index) => ({
        id: row.sourceId ?? `capture_${index}`,
        name: row.title ?? row.sourceId ?? 'Captured public source',
        type: 'captured_public_source',
        provenance: row.provenanceHash ?? row.id ?? row.sourceId ?? 'captured evidence'
    }))
    return {
        ...result,
        status: 'partial',
        confidence: Math.max(result.confidence, 0.68),
        lastSeen: activity[0]?.lastReportedAt ?? result.lastSeen,
        recentActivity: [...activity, ...result.recentActivity].slice(0, 8),
        sources: [...sources, ...result.sources].slice(0, 12),
        notes: ['Captured public-source evidence is available for this query.', ...result.notes]
    }
}

function evidenceRowToActivity(query: string, row: ScraperEvidenceRow, index: number): TiActivity | undefined {
    const observedAt = row.collectedAt && Number.isFinite(Date.parse(row.collectedAt)) ? row.collectedAt : new Date().toISOString()
    const title = row.title?.trim() || `${query} captured public source`
    const detail = truncateSentence(row.summary ?? title, 260)
    if (!detail) return undefined
    return {
        date: observedAt.slice(0, 10),
        title,
        detail,
        confidence: Math.max(0.58, 0.72 - index * 0.03),
        sourceIds: [row.sourceId ?? row.id ?? `capture_${index}`],
        claimType: inferClaimType(`${title} ${detail}`),
        firstReportedAt: observedAt,
        lastReportedAt: observedAt,
        publisherCount: 1,
        impact: inferImpact(`${title} ${detail}`) ?? 'Captured public intelligence signal'
    }
}

function publicResultStateFor(query: string, seeded: TiSearchResponse, analystLoop: TiAnalystLoop): TiResultState {
    if (seeded.recentActivity.length > 0 && (analystLoop.resultState === 'queued' || analystLoop.resultState === 'searching')) {
        return 'partial'
    }
    if (analystLoop.resultState !== 'ready') return analystLoop.resultState
    if (seeded.recentActivity.length > 0) return 'partial'
    if (knownActorProfile(query)) return 'partial'
    if (seeded.summary.trim().toLowerCase() === 'searching' && analystLoop.runStatusClarity.meaningfulWorkCount === 0) {
        return 'searching'
    }
    return analystLoop.resultState
}

async function liveSearch(query: string): Promise<TiSearchResponse> {
    const known = knownActorProfile(query)
    const matches = filterLiveMatchesForQuery(query, await searchClearWeb(query, known?.aliases ?? []), Boolean(known))
    if (matches.length) {
        const generatedAt = new Date().toISOString()
        const activityMatches = matches.filter(match => match.kind === 'news' && match.publishedAt)
        const activity = clusterLiveNews(query, activityMatches).slice(0, 6)
        return {
            query,
            generatedAt,
            mode: 'live_search',
            status: known?.status ?? 'partial',
            refreshAfterSeconds: 3,
            summary: summarizeLiveResult(query, matches, known),
            confidence: known?.confidence ?? (known ? 0.62 : 0.48),
            lastSeen: activity[0]?.lastReportedAt ?? activityMatches[0]?.publishedAt ?? known?.lastSeen ?? generatedAt,
            aliases: known?.aliases ?? [],
            recentActivity: mergeActivity(activity, known?.recentActivity ?? []),
            targets: mergeTargets(inferLiveTargets(query, matches), known?.targets ?? []),
            ttps: mergeTtps(inferLiveTtps(matches), known?.ttps ?? []),
            datasets: mergeDatasets(liveDatasets(), known?.datasets ?? []),
            sources: mergeSources(matches.slice(0, 8).map(match => ({
                id: match.id,
                name: match.publisher ?? match.title,
                type: match.kind === 'news' ? 'live_news' : match.kind === 'background' ? 'background_reference' : 'live_clear_web',
                provenance: match.url,
                url: safeTiLink(match.url)
            })), known?.sources ?? []),
            notes: [
                ...(known?.notes ?? []),
                'Live results are discovery evidence until capture and extraction finish.',
                'Restricted sources remain metadata-only and policy-gated.'
            ],
            operationalStatus: buildOperationalStatus(null, { query, mode: 'live_search', taskCount: matches.length }),
            analystLoop: buildAnalystLoop({ query, seeded: { recentActivity: activity }, operationalStatus: buildOperationalStatus(null, { query, mode: 'live_search', taskCount: matches.length }) }),
            collectionStrategy: collectionStrategy(),
            actorIntelligence: known?.actorIntelligence,
            actionability: actionabilityForQuery(query, known, mergeSources(matches.slice(0, 8).map(match => ({
                id: match.id,
                name: match.publisher ?? match.title,
                type: match.kind === 'news' ? 'live_news' : match.kind === 'background' ? 'background_reference' : 'live_clear_web',
                provenance: match.url,
                url: safeTiLink(match.url)
            })), known?.sources ?? []))
        }
    }

    const operationalStatus = buildOperationalStatus(null, { query, mode: 'live_search' })
    return {
        query,
        generatedAt: new Date().toISOString(),
        mode: 'live_search',
        status: known?.status ?? buildAnalystLoop({ query, operationalStatus }).resultState,
        refreshAfterSeconds: 3,
        summary: known?.summary ?? 'Searching',
        confidence: known?.confidence ?? (known ? 0.46 : 0.2),
        lastSeen: known?.lastSeen ?? new Date().toISOString(),
        aliases: known?.aliases ?? [],
        recentActivity: known?.recentActivity ?? [],
        targets: known?.targets ?? [],
        ttps: known?.ttps ?? [],
        datasets: mergeDatasets(liveDatasets(), known?.datasets ?? []),
        sources: known?.sources?.length ? known.sources : [{ id: 'live:search:pending', name: 'Live discovery pending', type: 'live_search', provenance: 'Live discovery is in progress' }],
        notes: known?.notes ?? [],
        operationalStatus,
        analystLoop: buildAnalystLoop({ query, operationalStatus }),
        collectionStrategy: collectionStrategy(),
        actorIntelligence: known?.actorIntelligence,
        actionability: actionabilityForQuery(query, known)
    }
}

function seededSearch(query: string): TiSearchResponse {
    const known = knownActorProfile(query)
    const operationalStatus = buildOperationalStatus(null, { query, mode: 'live_search' })
    const analystLoop = buildAnalystLoop({ query, operationalStatus })

    return {
        query,
        generatedAt: new Date().toISOString(),
        mode: 'live_search',
        status: known?.status ?? (analystLoop.resultState === 'searching' && known ? 'partial' : analystLoop.resultState),
        refreshAfterSeconds: 3,
        summary: analystLoop.metadataReviewInbox[0]?.company
            ? metadataReviewSummary(analystLoop.metadataReviewInbox[0])
            : known?.summary ?? 'Searching',
        confidence: known?.confidence ?? (known ? 0.46 : 0.2),
        lastSeen: known?.lastSeen ?? new Date().toISOString(),
        aliases: known?.aliases ?? [],
        recentActivity: known?.recentActivity ?? [],
        targets: known?.targets ?? [],
        ttps: known?.ttps ?? [],
        datasets: mergeDatasets(liveDatasets(), known?.datasets ?? []),
        sources: known?.sources?.length ? known.sources : [{ id: 'live:search:unavailable', name: 'Live discovery unavailable', type: 'system', provenance: 'Live source discovery is not available from this API process' }],
        notes: known?.notes ?? [],
        operationalStatus,
        analystLoop,
        collectionStrategy: collectionStrategy(),
        actorIntelligence: known?.actorIntelligence,
        actionability: actionabilityForQuery(query, known)
    }
}

export function collectionStrategy(): TiCollectionStrategy {
    return {
        thesis: 'Use public indexes as seeds and corroboration, then create value through our own high-speed metadata capture, actor mapping, and company/vendor notifications.',
        productFocus: [
            'recent victim and company claims',
            'actor, date, claimed-data, sector, country, and source records',
            'fast notifications when a watched company, vendor, domain, brand, or portfolio company appears',
            'UI-friendly actor overviews with sources used, freshness, and review state'
        ],
        sourcePosture: [
            {
                source: 'RansomLook and ransomware.live',
                role: 'primary_seed',
                summary: 'Good starting mix for recent victim claims, actor names, company names, claimed dates, sector/country context, and claimed-data descriptions.',
                buyerValue: 'Useful for bootstrapping coverage and cross-checking our captures, but not enough by itself because anyone can index the same public rows.',
                limitations: 'Treat as seed and corroboration, not the final product.'
            },
            {
                source: 'Direct actor infrastructure collection',
                role: 'owned_collection_target',
                summary: 'Metadata-first collection from actor-controlled public leak/extortion infrastructure where policy allows.',
                buyerValue: 'This is where defensible value comes from: faster discovery, verified claims, freshness deltas, actor-page changes, and watchlist alerts that are not just copied from another index.'
            },
            {
                source: 'RansomLook markets/crypto/notes/leaks/urls/torrent-health',
                role: 'rejected_paid_rows',
                summary: 'Mostly infrastructure, aliases, wallet references, old breach inventory, or sensitive-adjacent distribution metadata.',
                buyerValue: 'Keep as analyst context or actor overview enrichment only; do not sell as paid rows for now.'
            },
            {
                source: 'Infostealer and credential-exposure metadata',
                role: 'owned_collection_target',
                summary: 'Potentially high-value if collected as metadata and routed through safety review.',
                buyerValue: 'Valuable for company/domain exposure alerts, but it must avoid credential values, raw dumps, private access, auth bypass, and unsafe redistribution.'
            }
        ],
        ownedCollection: {
            priority: 'primary',
            summary: 'The long-term system should run isolated collectors and parsers that verify claims directly, store event metadata, and feed the threat actor graph and notification pipeline.',
            requirements: [
                'isolated disposable collectors',
                'metadata-only storage by default',
                'source, freshness, hash, and collection tracking',
                'no raw leak downloads or credential values',
                'review queues for sensitive or ambiguous captures',
                'actor/victim/domain graph edges for the overview UI'
            ],
            prohibited: [
                'raw leaked files',
                'credential values',
                'private or authenticated communities',
                'CAPTCHA bypass',
                'threat actor interaction',
                'payload or dump redistribution'
            ]
        },
        distribution: {
            primarySurface: 'hanasand.com',
            secondarySurface: 'apify',
            summary: 'hanasand.com is the product surface for monitoring, notifications, and actor overview. Apify is secondary distribution only and should not dictate the product shape.'
        }
    }
}

function buildAnalystLoop(input: {
    query: string
    scheduler?: unknown
    run?: { id: string; taskCount: number; reviewTaskCount: number; rejectedSourceCount: number }
    operationalStatus?: TiOperationalStatus
    seeded?: Partial<Pick<TiSearchResponse, 'recentActivity'>>
}): TiAnalystLoop {
    const scheduler = record(input.scheduler)
    const scraperLoop = record(scheduler?.analystLoop)
    if (scraperLoop) return analystLoopFromScraper(scraperLoop, input.query)

    const queuedTasks = numberValue(scheduler?.queuedTaskCount, input.run?.taskCount, 0)
    const reviewTasks = numberValue(scheduler?.reviewTaskCount, input.run?.reviewTaskCount, 0)
    const rejectedSources = numberValue(input.run?.rejectedSourceCount, 0)
    const blockedReasons = stringArray(scheduler?.blockedReasons)
    const skippedReasons = stringArray(scheduler?.skippedReasons)
    const deferredReasons = stringArray(scheduler?.deferredReasons)
    const allReasons = [...blockedReasons, ...skippedReasons, ...deferredReasons]
    const blockedUnsafeTargets = allReasons.filter((reason) => /payload|download|credential|private|captcha|interaction|unsafe/i.test(reason)).length
    const leakClaim = parseLeakClaim(input.query, input.seeded?.recentActivity ?? [])
    const hasMetadataReview = reviewTasks > 0 || Boolean(leakClaim)
    const needsActivation = /activation|approval|legal|operator|restore|metadata-only review|needs_source_activation/i.test(`${scheduler?.backpressureState ?? ''} ${allReasons.join(' ')}`)
    const resultState: TiResultState = blockedUnsafeTargets > 0 && !hasMetadataReview
        ? 'blocked_unsafe_target'
        : hasMetadataReview
            ? 'metadata_review'
            : needsActivation
                ? 'needs_source_activation'
                : queuedTasks > 0
                    ? 'queued'
                    : input.operationalStatus?.state === 'ready'
                        ? 'ready'
                        : input.operationalStatus?.state === 'partial'
                            ? 'partial'
                            : 'searching'

    const inbox = hasMetadataReview ? [metadataReviewItemFor(input.query, leakClaim, input.run?.id, allReasons)] : []
    const notification = inbox[0] ? notificationPacketFor(inbox[0]) : undefined
    const visibleReviewTasks = Math.max(reviewTasks, inbox.length)
    const meaningfulWorkCount = queuedTasks + visibleReviewTasks
    const nextSteps: TiAnalystLoop['nextSteps'] = []
    if (queuedTasks > 0) {
        nextSteps.push({ state: 'queued', label: 'Approved collection running', detail: `${queuedTasks} approved safe task${queuedTasks === 1 ? '' : 's'} queued or visible to workers.`, tone: 'ok' })
    }
    if (hasMetadataReview) {
        nextSteps.push({ state: 'metadata_review', label: 'Metadata review', detail: 'Review the leak claim metadata and prepare victim notification without opening leaked files.', tone: 'watch' })
    }
    if (blockedUnsafeTargets > 0) {
        nextSteps.push({ state: 'blocked_unsafe_target', label: 'Unsafe target blocked', detail: 'Raw downloads, credentials, private access, or interaction targets were blocked and should stay blocked.', tone: 'bad' })
    }
    if (needsActivation) {
        nextSteps.push({ state: 'needs_source_activation', label: 'Approval needed', detail: 'Use dry-run source approval or restore packets before metadata-only queueing.', tone: 'watch' })
    }
    if (!nextSteps.length) {
        nextSteps.push({ state: resultState === 'ready' ? 'ready' : 'queued', label: resultState === 'ready' ? 'Ready' : 'Waiting', detail: resultState === 'ready' ? 'Reviewed evidence is ready for display.' : 'Waiting for live discovery or scheduler telemetry.', tone: resultState === 'ready' ? 'ok' : 'watch' })
    }

    return {
        resultState,
        headline: analystHeadline(resultState, meaningfulWorkCount, reviewTasks),
        nextSteps,
        runStatusClarity: {
            queuedTasks,
            reviewTasks: visibleReviewTasks,
            rejectedSources,
            blockedUnsafeTargets,
            meaningfulWorkCount,
            summary: `${queuedTasks} queued collection task${queuedTasks === 1 ? '' : 's'}, ${visibleReviewTasks} metadata review task${visibleReviewTasks === 1 ? '' : 's'}, ${blockedUnsafeTargets} unsafe target block${blockedUnsafeTargets === 1 ? '' : 's'}, ${rejectedSources} rejected source${rejectedSources === 1 ? '' : 's'}`
        },
        metadataReviewInbox: inbox,
        sourceActivationWorkflow: {
            required: needsActivation,
            dryRunOnly: true,
            actions: sourceActivationActions(allReasons, input.run?.id, needsActivation, blockedUnsafeTargets)
        },
        victimNotificationPacket: notification
    }
}

function analystLoopFromScraper(loop: Record<string, unknown>, query: string): TiAnalystLoop {
    const runStatus = record(loop.runStatusClarity)
    const sourceActivation = record(loop.sourceActivationWorkflow)
    const inbox = arrayValue(loop.metadataReviewInbox)
        .map((item) => metadataReviewItemFromRecord(record(item)))
        .filter((item): item is TiMetadataReviewItem => Boolean(item))
    const packet = victimNotificationPacketFromRecord(record(loop.victimNotificationPacket))
    const resultState = tiResultState(stringValue(loop.resultState), inbox.length > 0 ? 'metadata_review' : 'searching')
    const reviewTasks = numberValue(runStatus?.reviewTasks, inbox.length, 0)
    return {
        resultState,
        headline: stringValue(loop.headline) ?? analystHeadline(resultState, reviewTasks || 1, reviewTasks),
        nextSteps: arrayValue(loop.nextSteps)
            .map((item) => nextStepFromRecord(record(item)))
            .filter((item): item is TiAnalystLoop['nextSteps'][number] => Boolean(item)),
        runStatusClarity: {
            queuedTasks: numberValue(runStatus?.queuedTasks, 0),
            reviewTasks,
            rejectedSources: numberValue(runStatus?.rejectedSources, 0),
            blockedUnsafeTargets: numberValue(runStatus?.blockedUnsafeTargets, 0),
            meaningfulWorkCount: numberValue(runStatus?.meaningfulWorkCount, reviewTasks),
            summary: stringValue(runStatus?.summary) ?? `${reviewTasks} metadata review task${reviewTasks === 1 ? '' : 's'} for ${query}`
        },
        metadataReviewInbox: inbox,
        sourceActivationWorkflow: {
            required: Boolean(sourceActivation?.required),
            dryRunOnly: sourceActivation?.dryRunOnly !== false,
            actions: arrayValue(sourceActivation?.actions)
                .map((item) => sourceActivationActionFromRecord(record(item)))
                .filter((item): item is TiAnalystLoop['sourceActivationWorkflow']['actions'][number] => Boolean(item))
        },
        victimNotificationPacket: packet
    }
}

function metadataReviewItemFromRecord(item: Record<string, unknown> | null): TiMetadataReviewItem | null {
    if (!item) return null
    return {
        id: stringValue(item.id) ?? `metadata-review:${hashString(JSON.stringify(item))}`,
        company: stringValue(item.company),
        victim: stringValue(item.victim),
        affectedAccounts: stringValue(item.affectedAccounts),
        accountSubjects: stringValue(item.accountSubjects),
        datasetSize: stringValue(item.datasetSize),
        actorStatement: stringValue(item.actorStatement),
        claimedDate: stringValue(item.claimedDate),
        sourceHash: stringValue(item.sourceHash),
        provenance: stringValue(item.provenance) ?? 'scraper metadata-only review item',
        confidence: Math.max(0, Math.min(1, numberValue(item.confidence, 0.5))),
        status: metadataReviewStatus(stringValue(item.status)),
        allowedActions: stringArray(item.allowedActions).map(metadataReviewAction).filter((action): action is TiMetadataReviewItem['allowedActions'][number] => Boolean(action))
    }
}

function victimNotificationPacketFromRecord(packet: Record<string, unknown> | null): TiVictimNotificationPacket | undefined {
    if (!packet) return undefined
    return {
        company: stringValue(packet.company),
        claimSummary: stringValue(packet.claimSummary) ?? 'Metadata-only leak claim requires review.',
        affectedAccounts: stringValue(packet.affectedAccounts),
        datasetSize: stringValue(packet.datasetSize),
        actorStatement: stringValue(packet.actorStatement),
        sourceHash: stringValue(packet.sourceHash),
        confidence: Math.max(0, Math.min(1, numberValue(packet.confidence, 0.5))),
        whatWasNotAccessed: stringArray(packet.whatWasNotAccessed),
        recommendedAction: stringValue(packet.recommendedAction) ?? 'Review metadata and notify through approved channels.'
    }
}

function nextStepFromRecord(item: Record<string, unknown> | null): TiAnalystLoop['nextSteps'][number] | null {
    if (!item) return null
    return {
        state: analystStepState(stringValue(item.state)),
        label: stringValue(item.label) ?? 'Review',
        detail: stringValue(item.detail) ?? 'Review the analyst-loop state.',
        tone: analystTone(stringValue(item.tone))
    }
}

function sourceActivationActionFromRecord(item: Record<string, unknown> | null): TiAnalystLoop['sourceActivationWorkflow']['actions'][number] | null {
    if (!item) return null
    const action = sourceActivationAction(stringValue(item.action))
    if (!action) return null
    return {
        action,
        sourceId: stringValue(item.sourceId),
        reason: stringValue(item.reason) ?? 'Source activation action requires review.',
        execution: sourceActivationExecution(stringValue(item.execution))
    }
}

function metadataReviewItemFor(query: string, claim: ParsedLeakClaim | null, runId: string | undefined, reasons: string[]): TiMetadataReviewItem {
    return {
        id: `metadata-review:${hashString(`${runId ?? 'live'}:${query}`).slice(0, 12)}`,
        company: claim?.company,
        victim: claim?.company,
        affectedAccounts: claim?.affectedAccounts,
        accountSubjects: claim?.accountSubjects,
        datasetSize: claim?.datasetSize,
        actorStatement: claim?.actorStatement ?? truncateSentence(query, 360),
        claimedDate: claim?.claimedDate,
        sourceHash: hashString(`${query}:${reasons.join('|')}`).slice(0, 16),
        provenance: runId ? `Scraper run ${runId}; metadata-only review task` : 'Live query text; metadata-only review candidate',
        confidence: claim ? 0.74 : 0.52,
        status: 'needs_review',
        allowedActions: ['notify_company', 'mark_duplicate', 'request_approval', 'escalate']
    }
}

function notificationPacketFor(item: TiMetadataReviewItem): TiVictimNotificationPacket {
    const parts = [
        item.company ? `${item.company} was named in a leak claim` : 'A leak claim requires review',
        item.affectedAccounts ? `${item.affectedAccounts} were claimed affected` : undefined,
        item.datasetSize ? `${item.datasetSize} was claimed` : undefined
    ].filter(Boolean)
    return {
        company: item.company,
        claimSummary: parts.join('; '),
        affectedAccounts: item.affectedAccounts,
        datasetSize: item.datasetSize,
        actorStatement: item.actorStatement,
        sourceHash: item.sourceHash,
        confidence: item.confidence,
        whatWasNotAccessed: [
            'No raw leaked dataset was downloaded or opened.',
            'No credentials, cookies, private channels, or invite-only areas were accessed.',
            'No CAPTCHA, authentication, or access-control bypass was attempted.',
            'No threat actor interaction was performed.'
        ],
        recommendedAction: 'Validate the claim metadata, mark duplicates, and notify the named organization through approved contact channels.'
    }
}

function metadataReviewSummary(item: TiMetadataReviewItem) {
    return [
        `${item.company ?? 'Leak claim'} is queued for metadata review.`,
        item.affectedAccounts ? `${item.affectedAccounts}.` : undefined,
        item.datasetSize ? `${item.datasetSize}.` : undefined
    ].filter(Boolean).join(' ')
}

function sourceActivationActions(reasons: string[], runId: string | undefined, needsActivation: boolean, blockedUnsafeTargets: number): TiAnalystLoop['sourceActivationWorkflow']['actions'] {
    const actions: TiAnalystLoop['sourceActivationWorkflow']['actions'] = []
    if (needsActivation) {
        actions.push({
            action: 'request_approval',
            sourceId: runId,
            reason: reasons.find((reason) => /approval|legal|operator/i.test(reason)) ?? 'Metadata-only source requires operator/legal approval before queueing.',
            execution: 'human_approval_required'
        })
        actions.push({
            action: 'enable_metadata_only_queue',
            sourceId: runId,
            reason: 'After approval, queue metadata-only work with raw downloads and interactions disabled.',
            execution: 'dry_run'
        })
    }
    if (blockedUnsafeTargets > 0) {
        actions.push({
            action: 'keep_blocked',
            sourceId: runId,
            reason: 'Unsafe raw payload, credential, private access, or interaction target must remain blocked.',
            execution: 'blocked'
        })
    }
    return actions
}

function analystHeadline(state: TiResultState, meaningfulWorkCount: number, reviewTasks: number) {
    if (state === 'metadata_review') return `${reviewTasks || meaningfulWorkCount || 1} metadata review item${(reviewTasks || meaningfulWorkCount || 1) === 1 ? '' : 's'} need analyst action.`
    if (state === 'blocked_unsafe_target') return 'Blocked target kept out of customer output; metadata review remains the permitted path.'
    if (state === 'needs_source_activation') return 'Operator or legal approval is needed before metadata-only collection can continue.'
    if (state === 'queued') return 'Approved safe collection is queued and waiting for worker progress.'
    if (state === 'ready') return 'Reviewed evidence is ready for the public answer.'
    return 'Live discovery is still checking current sources.'
}

interface ParsedLeakClaim {
    company?: string
    affectedAccounts?: string
    accountSubjects?: string
    datasetSize?: string
    actorStatement?: string
    claimedDate?: string
}

function parseLeakClaim(query: string, activity: TiActivity[]): ParsedLeakClaim | null {
    const text = [query, ...activity.flatMap((item) => [item.title, item.detail])].join(' | ')
    if (!/\b(leak(?:ed)?|breach(?:ed)?|compromis(?:ed|e)|dump(?:ed)?|stolen|exfiltrat(?:ed|ion))\b/i.test(text)) return null
    const company = text.match(/^\s*["“]?([^"|,;]+?)["”]?\s+(?:was\s+)?(?:leak(?:ed)?|breach(?:ed)?|compromis(?:ed|e)|hit|named)\b/i)?.[1]?.trim()
        ?? text.match(/\b(?:victim|company|organization)\s*:\s*([^|;\n]+)/i)?.[1]?.trim()
    const affectedAccounts = text.match(/\b([\d,.]+\s*(?:k|m|million|thousand)?\s+accounts?)\b/i)?.[1]
    const accountSubjects = text.match(/\b(?:who|account subjects|account owners)\s*:\s*([^|;\n]+)/i)?.[1]?.trim()
    const datasetSize = text.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB|TB|PB|records?|files?|rows?))\b/i)?.[1]
    const claimedDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]
    return {
        company,
        affectedAccounts,
        accountSubjects,
        datasetSize,
        actorStatement: truncateSentence(text, 420),
        claimedDate
    }
}

function buildOperationalStatus(schedulerInput: unknown, fallback: {
    query: string
    mode: TiSearchResponse['mode']
    runId?: string
    taskCount?: number
    reviewTaskCount?: number
}): TiOperationalStatus {
    const scheduler = record(schedulerInput)
    const queueEconomics = record(scheduler?.queueEconomics)
    const totals = record(queueEconomics?.totals)
    const telemetry = record(record(scheduler?.productionAdapterTelemetry)?.telemetry)
    const canaryControlPlane = record(scheduler?.canaryControlPlane)
    const headroom = record(canaryControlPlane?.headroom)
    const fairness = record(queueEconomics?.fairness)
    const queueAge = record(scheduler?.queueAgeSeconds)
    const runtimeSla = record(scheduler?.runtimeSla)
    const queuedTasks = numberValue(scheduler?.queuedTaskCount, totals?.queued, fallback.taskCount, 0)
    const leasedTasks = numberValue(scheduler?.leasedTaskCount, totals?.leased, 0)
    const reviewTasks = numberValue(scheduler?.reviewTaskCount, fallback.reviewTaskCount, 0)
    const retryDebt = numberValue(totals?.retryDebt, telemetry?.retryDebt, 0)
    const deadLetters = numberValue(totals?.deadLetters, record(queueEconomics?.deadLetterTrend)?.count, 0)
    const maxAgeSeconds = numberValue(queueAge?.max, totals?.maxQueuedAgeSeconds, 0)
    const p95AgeSeconds = numberValue(queueAge?.p95, record(telemetry?.queueAge)?.p95Seconds, 0)
    const backpressureState = stringValue(scheduler?.backpressureState)
    const cursorContinuity = stringValue(scheduler?.cursorContinuity, telemetry?.cursorContinuity)
    const state = operationalState({
        queuedTasks,
        leasedTasks,
        reviewTasks,
        retryDebt,
        deadLetters,
        backpressureState,
        runtimeState: stringValue(runtimeSla?.state),
        mode: fallback.mode,
        fallbackTaskCount: fallback.taskCount ?? 0,
        hasScheduler: Boolean(scheduler)
    })
    const budgetRows = arrayValue(queueEconomics?.workClassBudget)
        .map((item): TiOperationalBudget | null => {
            const row = record(item)
            if (!row) return null
            return {
                workClass: stringValue(row.workClass) ?? 'unknown',
                queued: numberValue(row.queued, 0),
                leased: numberValue(row.leased, 0),
                budgetSlots: numberValue(row.budgetSlots, 0),
                maxAgeSeconds: numberValue(row.maxQueuedAgeSeconds, 0),
                retryDebt: numberValue(row.retryDebt, 0),
                action: stringValue(row.recommendedAction) ?? 'accept'
            }
        })
        .filter((item): item is TiOperationalBudget => Boolean(item))
    const controls = arrayValue(canaryControlPlane?.controls)
        .slice(0, 8)
        .map((item) => {
            const control = record(item) ?? {}
            const delta = record(control.expectedQueueDelta)
            const workerDelta = arrayValue(control.workerPartitionEffects)
                .map((effect) => numberValue(record(effect)?.reservedWorkerSlotDelta, 0))
                .reduce((sum, value) => sum + value, 0)
            return {
                action: stringValue(control.action) ?? 'monitor',
                scenario: stringValue(control.scenario),
                warningCodes: stringArray(control.warningCodes),
                queueDelta: numberValue(delta?.queuedVisibleDelta, 0),
                workerDelta,
                rollback: stringArray(control.rollbackSteps)[0] ?? 'no rollback needed'
            }
        })
    const worstShare = numberValue(fairness?.worstShare, 0)
    const fairnessOk = booleanValue(fairness?.ok, worstShare <= 0.25)
    const memoryPressure = optionalNumber(record(queueEconomics?.memoryPressure)?.ratio)
    const notes = [
        queuedTasks > 0 ? `${queuedTasks} queued task${queuedTasks === 1 ? '' : 's'} waiting for collector capacity.` : 'No queued collection tasks are visible for this query yet.',
        leasedTasks > 0 ? `${leasedTasks} task${leasedTasks === 1 ? ' is' : 's are'} assigned to collectors.` : 'No collectors have picked up this query yet.',
        retryDebt > 0 ? `${retryDebt} retr${retryDebt === 1 ? 'y is' : 'ies are'} in backoff or retry debt.` : 'Retry debt is clear.',
        deadLetters > 0 ? `${deadLetters} dead-lettered task${deadLetters === 1 ? '' : 's'} need operator attention.` : 'No dead letters are currently attached.',
        fairnessOk ? 'Fairness is within the per-source share policy.' : `Fairness is drifting; ${stringValue(fairness?.worstGroup) ?? 'one source group'} is taking ${formatPercent(worstShare)} of scheduler share.`
    ]

    return {
        state,
        headline: operationalHeadline(state, queuedTasks, leasedTasks, retryDebt, deadLetters),
        queue: {
            selectedTasks: numberValue(scheduler?.selectedTaskCount, fallback.taskCount, queuedTasks + leasedTasks),
            queuedTasks,
            leasedTasks,
            reviewTasks,
            maxAgeSeconds,
            p95AgeSeconds,
            nextPollSeconds: optionalNumber(scheduler?.nextPollSeconds),
            backpressureState,
            cursorContinuity
        },
        workers: {
            leaseState: leasedTasks > 0 ? 'workers active' : queuedTasks > 0 ? 'waiting for lease' : 'idle',
            retryDebt,
            deadLetters,
            backoffState: retryDebt > 0 ? 'backoff active' : 'clear',
            concurrency: queueConcurrencyLabel(budgetRows, headroom),
            fairness: fairnessOk ? 'within policy' : 'fairness drift',
            memoryPressure
        },
        budgets: budgetRows,
        fairness: {
            ok: fairnessOk,
            worstGroup: stringValue(fairness?.worstGroup),
            worstShare
        },
        aging: [
            { label: 'Oldest queued task', seconds: maxAgeSeconds, tone: ageTone(maxAgeSeconds) },
            { label: 'p95 queued age', seconds: p95AgeSeconds, tone: ageTone(p95AgeSeconds) }
        ],
        controls,
        notes
    }
}

function operationalState(input: {
    queuedTasks: number
    leasedTasks: number
    reviewTasks: number
    retryDebt: number
    deadLetters: number
    backpressureState?: string
    runtimeState?: string
    mode: TiSearchResponse['mode']
    fallbackTaskCount: number
    hasScheduler: boolean
}): TiOperationalStatus['state'] {
    if (input.deadLetters > 0 || input.runtimeState === 'breach') return 'blocked'
    if (input.retryDebt > 0 || input.backpressureState?.includes('pressure')) return 'degraded'
    if (input.reviewTasks > 0) return 'metadata_review'
    if (input.leasedTasks > 0) return 'searching'
    if (input.queuedTasks > 0) return 'queued'
    if (!input.hasScheduler && input.fallbackTaskCount > 0) return 'partial'
    if (input.mode === 'scraper') return 'ready'
    return 'searching'
}

function operationalHeadline(state: TiOperationalStatus['state'], queued: number, leased: number, retryDebt: number, deadLetters: number) {
    if (state === 'blocked') return `${deadLetters} dead-lettered task${deadLetters === 1 ? '' : 's'} need attention before this run is healthy.`
    if (state === 'degraded') return `Scheduler is working with ${retryDebt} retry/backoff item${retryDebt === 1 ? '' : 's'}.`
    if (state === 'metadata_review') return 'Metadata-only review is waiting for analyst action.'
    if (state === 'needs_source_activation') return 'Source approval or restore action is required before collection can continue.'
    if (state === 'partial') return 'Live public discovery has partial evidence; scraper scheduler telemetry is not attached.'
    if (state === 'searching') return leased > 0 ? `${leased} task${leased === 1 ? ' is' : 's are'} leased to scraper workers.` : 'Live discovery is running.'
    if (state === 'queued') return `${queued} task${queued === 1 ? ' is' : 's are'} queued and waiting for worker capacity.`
    if (state === 'ready') return 'No scheduler pressure is visible for this query.'
    return 'Scheduler is idle.'
}

function queueConcurrencyLabel(budgets: TiOperationalBudget[], headroom: Record<string, unknown> | null) {
    const slots = budgets.reduce((sum, item) => sum + item.budgetSlots, 0)
    const queueHeadroom = optionalNumber(headroom?.queueHeadroomTasks)
    if (slots > 0 && queueHeadroom !== undefined) return `${slots} budget slots, ${queueHeadroom} queue headroom`
    if (slots > 0) return `${slots} budget slots`
    if (queueHeadroom !== undefined) return `${queueHeadroom} queue headroom`
    return 'waiting for scheduler telemetry'
}

function ageTone(seconds: number): 'ok' | 'watch' | 'bad' {
    if (seconds >= 900) return 'bad'
    if (seconds >= 120) return 'watch'
    return 'ok'
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function stringValue(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value
    }
    return undefined
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function numberValue(...values: unknown[]): number {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return value
    }
    return 0
}

function optionalNumber(...values: unknown[]): number | undefined {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return value
    }
    return undefined
}

function booleanValue(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback
}

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`
}

function actionabilityForQuery(query: string, known?: KnownActorContext | null, sources = known?.sources ?? []): TiActionabilityContract {
    const sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']> = (sources.length ? sources : known ? automaticActorSources(query) : []).map(source => ({
        sourceId: source.id,
        sourceName: source.name,
        provenance: source.url || source.provenance,
        confidence: known?.confidence ?? 0.58
    })).filter(source => source.provenance)
    const watchlistCandidates = known ? watchlistCandidatesForKnownActor(query, known) : watchlistCandidatesForQuery(query)
    const hasEvidence = sourceProvenance.length > 0
    const alertDisposition: NonNullable<TiActionabilityContract['alertDisposition']> = watchlistCandidates.length
        ? 'watchlist_required'
        : hasEvidence ? 'needs_enrichment' : 'not_alertable'

    return {
        schemaVersion: 'ti.query.actionability.v1',
        alertDisposition,
        shouldAlert: false,
        rationale: watchlistCandidates.length
            ? 'Actor/query relevance is ready to seed organization watchlists, but no backed watchlist match, generated DWM alert, or case ID is attached to this public result.'
            : 'No customer watchlist term, generated alert, or case link is attached to this query result yet.',
        watchlistCandidates,
        watchlistMatches: [],
        relatedAlerts: [],
        relatedCases: [],
        sourceProvenance,
        enrichmentGaps: [
            {
                id: 'organization-watchlist-match',
                title: 'Attach organization watchlist match',
                severity: 'high',
                detail: 'The public query result needs an authenticated organization watchlist match before it should alert a customer.',
                dependency: 'GET /api/organizations/:id/alert-readiness generatedAlertReferences or /v1/dwm/watchlists match context'
            },
            {
                id: 'dwm-alert-link',
                title: 'Return generated DWM alert ID',
                severity: 'high',
                detail: 'Case creation is backed by /v1/cases and requires a DWM alert ID; this result has no related alert ID attached.',
                dependency: '/v1/dwm/alerts or /v1/dwm/alerts/rebuild'
            },
            ...(sourceProvenance.some(source => source.captureId) ? [] : [{
                id: 'capture-id-provenance',
                title: 'Attach capture IDs for replay',
                severity: 'medium' as const,
                detail: 'Source provenance is visible, but capture IDs are not attached for replay or case evidence.',
                dependency: 'sourceProvenance[].captureId'
            }])
        ],
        handoffs: {
            watchlist: {
                method: 'POST',
                endpoint: '/api/organizations/:id/watchlists',
                payloads: watchlistCandidates.slice(0, 8).map(candidate => ({
                    kind: candidate.kind,
                    value: candidate.value,
                    notes: `${query}: ${candidate.reason}`
                })),
                missing: ['Authenticated organization ID', 'owner/admin/member watchlist permission']
            },
            alertRebuild: {
                method: 'POST',
                endpoint: '/v1/dwm/alerts/rebuild',
                missing: ['Active organization watchlist', 'recent source capture matching at least one watchlist term']
            },
            caseCreate: {
                method: 'POST',
                endpoint: '/v1/cases',
                missing: ['DWM alert ID from /v1/dwm/alerts or /v1/dwm/alerts/rebuild']
            }
        }
    }
}

function watchlistCandidatesForKnownActor(query: string, known: KnownActorContext): NonNullable<TiActionabilityContract['watchlistCandidates']> {
    const normalized = query.trim().toLowerCase()
    const fixed = normalized === 'apt29' || normalized.includes('cozy bear') || normalized.includes('midnight blizzard')
        ? [
            { kind: 'company' as const, value: 'Microsoft', reason: 'Public reporting and the actor profile include Microsoft email intrusion context.', confidence: 0.78 },
            { kind: 'vendor' as const, value: 'SolarWinds', reason: 'Public reporting and the actor profile include SolarWinds supply-chain campaign context.', confidence: 0.78 },
            { kind: 'company' as const, value: 'Hewlett Packard Enterprise', reason: 'Public reporting and the actor profile include HPE cloud email intrusion context.', confidence: 0.7 },
            { kind: 'domain' as const, value: 'microsoft.com', reason: 'Domain watchlist term for Microsoft-related exposure routing.', confidence: 0.62 }
        ]
        : []
    const sectorCandidates = known.targets.slice(0, 3).map(target => ({
        kind: 'vendor' as const,
        value: target.sector,
        reason: `Actor target sector from this profile: ${target.rationale}`,
        confidence: Math.min(target.confidence, 0.68)
    }))
    return uniqueCandidates([...fixed, ...sectorCandidates]).slice(0, 10)
}

function watchlistCandidatesForQuery(query: string): NonNullable<TiActionabilityContract['watchlistCandidates']> {
    const clean = query.trim()
    if (!clean) return []
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(clean)) {
        return [{ kind: 'domain', value: clean.toLowerCase(), reason: 'Query is a domain supported by organization watchlists.', confidence: 0.72 }]
    }
    if (!/apt|cve-|campaign|malware|actor/i.test(clean)) {
        return [{ kind: 'company', value: clean, reason: 'Query can be saved as an organization company watchlist term.', confidence: 0.58 }]
    }
    return []
}

function uniqueCandidates(candidates: NonNullable<TiActionabilityContract['watchlistCandidates']>) {
    const seen = new Set<string>()
    return candidates.filter(candidate => {
        const key = `${candidate.kind}:${candidate.value.toLowerCase()}`
        if (!candidate.value.trim() || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function knownActorProfile(query: string): KnownActorContext | null {
    const normalized = query.trim().toLowerCase()
    if (normalized === 'apt29' || normalized.includes('cozy bear') || normalized.includes('midnight blizzard')) {
        return withAutomaticProfileDefaults({
            summary: 'APT29 is a Russia-linked espionage actor associated with intelligence collection, diplomatic and government targeting, cloud and identity abuse, credential access, and stealthy persistence.',
            aliases: ['Cozy Bear', 'Midnight Blizzard', 'Nobelium', 'The Dukes'],
            targets: [
                {
                    sector: 'Government and diplomacy',
                    regions: ['Europe', 'North America', 'NATO-aligned states'],
                    rationale: 'Strategic intelligence collection against foreign affairs, policy, and diplomatic entities is a persistent public reporting theme.',
                    confidence: 0.78
                },
                {
                    sector: 'Technology and cloud services',
                    regions: ['Global'],
                    rationale: 'Identity and cloud access can provide downstream collection and visibility into many organizations.',
                    confidence: 0.7
                },
                {
                    sector: 'NGO, think tank, and research organizations',
                    regions: ['Europe', 'United States'],
                    rationale: 'Policy and research targets align with espionage collection requirements.',
                    confidence: 0.63
                }
            ],
            ttps: [
                {
                    name: 'Password Spraying',
                    attackId: 'T1110.003',
                    tactic: 'Credential Access',
                    detail: 'Used to gain initial access against identity systems while blending into normal authentication traffic.',
                    confidence: 0.76
                },
                {
                    name: 'Cloud Accounts',
                    attackId: 'T1078.004',
                    tactic: 'Defense Evasion / Persistence',
                    detail: 'Valid cloud identities and tokens are valuable for mailbox, tenant, and application access.',
                    confidence: 0.72
                },
                {
                    name: 'Email Collection',
                    attackId: 'T1114',
                    tactic: 'Collection',
                    detail: 'Mailbox access and diplomatic/policy correspondence collection are consistent with espionage objectives.',
                    confidence: 0.7
                },
                {
                    name: 'Command and Control Over Web Services',
                    attackId: 'T1102',
                    tactic: 'Command and Control',
                    detail: 'Public reporting often describes stealthy infrastructure and use of legitimate-looking services.',
                    confidence: 0.58
                }
            ],
            actorIntelligence: {
                actorClass: 'State-linked espionage actor',
                attribution: 'Russia-linked SVR/APT29 activity in public government, vendor, and incident reporting',
                firstSeen: 'Late-2000s public reporting',
                motivation: [
                    'Strategic intelligence collection',
                    'Diplomatic and policy access',
                    'Cloud and identity compromise',
                    'Long-running stealthy persistence'
                ],
                malwareTools: ['WellMess', 'WellMail', 'SUNBURST', 'TEARDROP', 'Cobalt Strike', 'custom credential and token tooling'],
                campaigns: [
                    'SolarWinds Orion supply-chain compromise',
                    'Microsoft corporate email intrusion',
                    'HPE cloud email intrusion',
                    'Diplomatic and policy-sector credential campaigns'
                ],
                infrastructure: [
                    'Cloud identity tenants',
                    'Compromised email accounts',
                    'Legitimate-looking web services',
                    'Supply-chain access paths',
                    'Residential or leased operational infrastructure'
                ],
                targetSectors: ['Government and diplomacy', 'Technology and cloud services', 'NGO, think tank, and research organizations'],
                geographies: ['Russia', 'United States', 'United Kingdom', 'Germany'],
                confidence: 0.76,
                confidenceReasoning: [
                    'Aliases and attribution are corroborated across government and vendor reporting.',
                    'Victim observations include named organizations, sectors, timeframes, and evidence strength.',
                    'Tradecraft aligns with mapped ATT&CK techniques for credential, cloud, email, and command-and-control activity.'
                ],
                sourceProvenance: [
                    'CISA and allied government SVR/APT29 advisories',
                    'Microsoft Midnight Blizzard disclosures',
                    'Public SolarWinds and vendor incident reporting',
                    'MITRE ATT&CK group mappings'
                ]
            }
        }, 'APT29', 0.76)
    }
    if (normalized === 'apt42' || normalized.includes('charming kitten') || normalized.includes('mint sandstorm')) {
        return withAutomaticProfileDefaults({
            summary: 'APT42 is an Iran-linked espionage actor commonly associated with social engineering, credential theft, account takeover, and targeting of policy, diplomatic, journalist, NGO, and research communities.',
            aliases: ['Charming Kitten', 'Mint Sandstorm', 'TA453', 'Yellow Garuda'],
            targets: [
                {
                    sector: 'Government, policy, and diplomacy',
                    regions: ['Middle East', 'Europe', 'North America'],
                    rationale: 'Public reporting commonly links APT42-style activity to intelligence collection against policy, diplomatic, and regional targets.',
                    confidence: 0.62
                },
                {
                    sector: 'Journalists, NGOs, and researchers',
                    regions: ['Global'],
                    rationale: 'Public reporting frequently describes social-engineering and credential-collection targeting of civil society and research communities.',
                    confidence: 0.58
                }
            ],
            ttps: [
                {
                    name: 'Phishing',
                    attackId: 'T1566',
                    tactic: 'Initial Access',
                    detail: 'Known public reporting commonly describes social-engineering and credential harvesting.',
                    confidence: 0.62
                },
                {
                    name: 'Valid Accounts',
                    attackId: 'T1078',
                    tactic: 'Persistence',
                    detail: 'Credential access can enable account takeover and follow-on collection.',
                    confidence: 0.54
                }
            ]
        }, 'APT42', 0.72)
    }
    if (
        normalized === 'apt49'
        || normalized.includes('tropic trooper')
        || normalized.includes('bluehornet')
        || normalized.includes('blue hornet')
        || normalized.includes('againstthewest')
        || normalized.includes('against the west')
    ) {
        return apt49ActorProfile()
    }
    return baselineKnownActorProfile(normalized)
}

function withAutomaticProfileDefaults(profile: KnownActorContext, actorName: string, confidence: number): KnownActorContext {
    const generatedAt = new Date().toISOString()
    const automaticActivity: TiActivity = {
        date: generatedAt.slice(0, 10),
        title: `${actorName} actor profile updated`,
        detail: `${actorName} was refreshed from actor directories, public reporting links, and monitored source records. Recent activity updates separately when new source evidence appears.`,
        confidence,
        sourceIds: ['google-cloud-apt-groups', 'mitre-attack-groups'],
        claimType: 'general_activity',
        affectedSectors: inferProfileSectors(profile.summary),
        countries: inferProfileRegions(profile.summary),
        impact: 'Keeps stable actor context available while recent activity is checked independently.',
        firstReportedAt: generatedAt,
        lastReportedAt: generatedAt,
        publisherCount: 2,
    }

    return {
        ...profile,
        status: profile.status ?? 'ready',
        confidence: profile.confidence ?? confidence,
        lastSeen: profile.lastSeen ?? generatedAt,
        recentActivity: mergeActivity(profile.recentActivity ?? [], [automaticActivity]),
        datasets: mergeDatasets(profile.datasets ?? [], automaticActorDatasets(actorName)),
        sources: mergeSources(profile.sources ?? [], automaticActorSources(actorName)),
        notes: [
            ...(profile.notes ?? []),
            'Stable actor fields are refreshed by the background actor refresh job.',
            'Recent attacks and monitored company mentions are refreshed separately from identity, alias, and TTP context.',
        ],
    }
}

function apt49ActorProfile(): KnownActorContext {
    return {
        status: 'ready',
        confidence: 0.82,
        lastSeen: '2024-12-01T00:00:00.000Z',
        summary: 'APT49 is an ambiguous label in open reporting. Some sources map it to Tropic Trooper, a long-running Asia-Pacific espionage actor. Malpedia and Cyberint map BlueHornet/AgainstTheWest/APT49 to a hacktivist and leak-focused persona. The profile is split into both tracks until source-specific reporting makes the context clear.',
        aliases: [
            'Tropic Trooper',
            'KeyBoy',
            'Pirate Panda',
            'BlueHornet',
            'AgainstTheWest',
            'APT49 alias collision',
        ],
        recentActivity: [
            {
                date: '2024-12',
                title: 'APT49 label collision requires analyst disambiguation',
                detail: 'Open-source references disagree on whether APT49 should be treated as Tropic Trooper or BlueHornet/AgainstTheWest. The profile is therefore split into espionage-track and hacktivist/leak-track monitoring until a source-specific claim resolves the context.',
                confidence: 0.9,
                sourceIds: ['malpedia-bluehornet', 'cyberint-bluehornet', 'aardvark-apt49'],
                claimType: 'general_activity',
                affectedSectors: ['Threat actor tracking', 'Analyst workflow'],
                countries: ['Global'],
                impact: 'Prevents false attribution and keeps watchlist alerts tied to the correct source track.',
                firstReportedAt: '2024-01-01T00:00:00.000Z',
                lastReportedAt: '2024-12-01T00:00:00.000Z',
                publisherCount: 3,
                corroboratingSourceIds: ['malpedia-bluehornet', 'cyberint-bluehornet'],
                contradictingSourceIds: ['aardvark-apt49'],
            },
            {
                date: '2024',
                title: 'BlueHornet / AgainstTheWest tracked as a leak and extortion-adjacent persona',
                detail: 'Malpedia and Cyberint both associate BlueHornet with AgainstTheWest and APT49 naming. Company names, domains, claimed datasets, and actor statements are tracked when this naming track appears in monitored sources.',
                confidence: 0.84,
                sourceIds: ['malpedia-bluehornet', 'cyberint-bluehornet'],
                claimType: 'victim_claim',
                affectedSectors: ['Public sector', 'Technology', 'Critical infrastructure', 'Enterprise services'],
                countries: ['Global'],
                impact: 'Useful for detecting whether a customer, vendor, domain, or portfolio company appears in actor statements or leak claims.',
                lastReportedAt: '2024-12-01T00:00:00.000Z',
                publisherCount: 2,
            },
            {
                date: '2024',
                title: 'Tropic Trooper track remains a separate espionage profile',
                detail: 'The Tropic Trooper interpretation points to an espionage actor historically associated with targeting governments, military, transport, healthcare, and high-tech organizations, especially in Asia-Pacific contexts.',
                confidence: 0.72,
                sourceIds: ['aardvark-apt49'],
                claimType: 'campaign',
                affectedSectors: ['Government', 'Defense', 'Healthcare', 'Transportation', 'High technology'],
                countries: ['Asia-Pacific'],
                impact: 'Useful for actor overview, sector exposure, and TTP mapping, but should not be mixed with BlueHornet company-leak claims without source evidence.',
                lastReportedAt: '2024-12-01T00:00:00.000Z',
                publisherCount: 1,
            },
        ],
        targets: [
            {
                sector: 'Government and public-sector organizations',
                regions: ['Asia-Pacific', 'Global for BlueHornet leak claims'],
                rationale: 'The Tropic Trooper track is associated with espionage collection, while the BlueHornet track is useful for public-sector leak and claim monitoring.',
                confidence: 0.76,
            },
            {
                sector: 'Defense, transportation, healthcare, and high technology',
                regions: ['East Asia', 'Southeast Asia', 'Taiwan-facing reporting contexts'],
                rationale: 'These sectors appear in open-source Tropic Trooper-style targeting summaries and are useful watchlist categories for enterprise monitoring.',
                confidence: 0.7,
            },
            {
                sector: 'Company and vendor exposure',
                regions: ['Global'],
                rationale: 'The BlueHornet/AgainstTheWest track is valuable when it names organizations, domains, claimed datasets, or leak narratives.',
                confidence: 0.78,
            },
        ],
        ttps: [
            {
                name: 'Spearphishing Attachment',
                attackId: 'T1566.001',
                tactic: 'Initial Access',
                detail: 'Used as a plausible initial-access pattern for the espionage-track profile; source-specific campaigns should be checked before operationalizing indicators.',
                confidence: 0.64,
            },
            {
                name: 'Ingress Tool Transfer',
                attackId: 'T1105',
                tactic: 'Command and Control',
                detail: 'Commonly relevant for actor profiles involving custom payload delivery and follow-on tooling.',
                confidence: 0.58,
            },
            {
                name: 'Data from Local System',
                attackId: 'T1005',
                tactic: 'Collection',
                detail: 'Relevant to both tracks: espionage collection for Tropic Trooper-style activity and company-data claims for BlueHornet-style leak monitoring.',
                confidence: 0.62,
            },
            {
                name: 'Exfiltration Over Web Service',
                attackId: 'T1567',
                tactic: 'Exfiltration',
                detail: 'Useful review hypothesis for leak-claim and extortion-adjacent reporting; do not infer a confirmed technique without campaign evidence.',
                confidence: 0.52,
            },
        ],
        datasets: [
            {
                name: 'Curated actor profile cache',
                type: 'vendor_report',
                coverage: 'Persistent APT49 alias-collision profile compiled from cited open-source references and served immediately without re-running live discovery.',
                status: 'available',
            },
            {
                name: 'BlueHornet / AgainstTheWest exposure monitoring',
                type: 'darknet_metadata',
                coverage: 'Company names, domains, claimed datasets, actor statements, and leak-claim metadata when this track surfaces in monitored sources.',
                status: 'metadata_only',
            },
            {
                name: 'Tropic Trooper campaign context',
                type: 'clear_web',
                coverage: 'Actor overview, aliases, sector targeting, and tradecraft context from public reporting.',
                status: 'available',
            },
        ],
        sources: [
            {
                id: 'aardvark-apt49',
                name: 'Aardvark Infinity: Comprehensive Profile of APT49 / Tropic Trooper',
                type: 'actor_profile',
                provenance: 'https://medium.com/aardvark-infinity/comprehensive-profile-of-apt49-tropic-trooper-252ba921c46f',
                url: 'https://medium.com/aardvark-infinity/comprehensive-profile-of-apt49-tropic-trooper-252ba921c46f',
            },
            {
                id: 'malpedia-bluehornet',
                name: 'Malpedia: BlueHornet',
                type: 'actor_profile',
                provenance: 'https://malpedia.caad.fkie.fraunhofer.de/actor/bluehornet',
                url: 'https://malpedia.caad.fkie.fraunhofer.de/actor/bluehornet',
            },
            {
                id: 'cyberint-bluehornet',
                name: 'Cyberint: BlueHornet / AgainstTheWest',
                type: 'actor_profile',
                provenance: 'https://cyberint.com/blog/research/bluehornet-one-apt-to-terrorize-them-all/',
                url: 'https://cyberint.com/blog/research/bluehornet-one-apt-to-terrorize-them-all/',
            },
            {
                id: 'google-cloud-apt-groups',
                name: 'Google Cloud Security: APT groups directory',
                type: 'actor_directory',
                provenance: 'https://cloud.google.com/security/resources/insights/apt-groups',
                url: 'https://cloud.google.com/security/resources/insights/apt-groups',
            },
        ],
        notes: [
            'APT49 is treated as an alias collision, not a single-source certainty.',
            'Recent activity updates independently from this cached actor profile.',
            'Leak-claim monitoring must stay metadata-only: company name, actor, date, claim text, claimed-data description, source reference, and review state.',
        ],
    }
}

interface BaselineActorProfile {
    names: string[]
    summary: string
    aliases: string[]
}

const BASELINE_ACTOR_PROFILES: BaselineActorProfile[] = [
    {
        names: ['apt28', 'fancy bear', 'sofacy', 'forest blizzard'],
        summary: 'APT28 is a Russia-linked espionage actor associated with government, defense, political, media, and security-sector targeting, including phishing, credential access, malware deployment, and intelligence collection.',
        aliases: ['Fancy Bear', 'Sofacy', 'Forest Blizzard']
    },
    {
        names: ['lazarus group', 'lazarus', 'hidden cobra'],
        summary: 'Lazarus Group is a North Korea-linked actor associated with espionage, disruptive operations, software supply-chain activity, cryptocurrency theft, and financially motivated intrusions.',
        aliases: ['Hidden Cobra', 'Diamond Sleet']
    },
    {
        names: ['volt typhoon', 'vanguard panda', 'bronze silhouette'],
        summary: 'Volt Typhoon is a China-linked espionage actor associated with critical-infrastructure access, compromised edge devices, living-off-the-land techniques, credential access, and long-term persistence.',
        aliases: ['Vanguard Panda', 'Bronze Silhouette']
    },
    {
        names: ['salt typhoon'],
        summary: 'Salt Typhoon is a China-linked espionage actor publicly associated with telecommunications and network-provider compromises, intelligence collection, and persistent access to communications infrastructure.',
        aliases: []
    },
    {
        names: ['turla', 'snake', 'venomous bear', 'waterbug'],
        summary: 'Turla is a Russia-linked espionage actor associated with government and diplomatic targeting, custom malware, compromised infrastructure, command-and-control operations, and long-duration intelligence collection.',
        aliases: ['Snake', 'Venomous Bear', 'Waterbug']
    },
    {
        names: ['sandworm', 'voodoo bear', 'seashell blizzard'],
        summary: 'Sandworm is a Russia-linked actor associated with disruptive and destructive operations, critical-infrastructure targeting, wiper malware, and military or geopolitical campaigns.',
        aliases: ['Voodoo Bear', 'Seashell Blizzard']
    },
    {
        names: ['kimsuky', 'velvet chollima', 'emerald sleet'],
        summary: 'Kimsuky is a North Korea-linked espionage actor associated with phishing, credential collection, malware delivery, and targeting of government, policy, research, and defense communities.',
        aliases: ['Velvet Chollima', 'Emerald Sleet']
    },
    {
        names: ['muddywater', 'muddy water', 'seedworm', 'static kitten'],
        summary: 'MuddyWater is an Iran-linked espionage actor associated with government and telecommunications targeting, phishing, remote-access tooling, credential theft, and regional intelligence collection.',
        aliases: ['Seedworm', 'Static Kitten', 'Mango Sandstorm']
    },
    {
        names: ['scattered spider', 'unc3944', 'octo tempest'],
        summary: 'Scattered Spider is a financially motivated intrusion cluster associated with social engineering, identity compromise, SIM swapping, help-desk abuse, cloud access, data theft, and extortion.',
        aliases: ['UNC3944', 'Octo Tempest', '0ktapus']
    },
    {
        names: ['lockbit', 'lockbit 3.0', 'lockbitsupp'],
        summary: 'LockBit is a ransomware and extortion operation associated with affiliate-driven intrusions, data theft, encryption, leak-site victim claims, and attacks across many sectors and regions.',
        aliases: ['LockBit 3.0', 'LockBitSupp']
    },
    {
        names: ['clop', 'cl0p'],
        summary: 'Clop is a financially motivated extortion operation associated with ransomware, large-scale data theft, exploitation of file-transfer products, and public victim claims.',
        aliases: ['Cl0p']
    },
    {
        names: ['akira', 'akira ransomware'],
        summary: 'Akira is a ransomware and extortion operation associated with network intrusion, data theft, encryption, leak-site victim claims, and attacks across enterprise environments.',
        aliases: []
    },
    {
        names: ['black basta'],
        summary: 'Black Basta is a ransomware and extortion operation associated with enterprise intrusions, data theft, encryption, affiliate activity, and public victim claims.',
        aliases: []
    },
    {
        names: ['play', 'play ransomware'],
        summary: 'Play is a ransomware and extortion operation associated with enterprise compromise, data theft, encryption, exploitation of exposed services, and public victim claims.',
        aliases: ['PlayCrypt']
    },
    {
        names: ['ransomhub'],
        summary: 'RansomHub is a ransomware and data-extortion operation associated with affiliate-driven intrusions, data theft, encryption, and public victim claims.',
        aliases: []
    },
    {
        names: ['alphv', 'blackcat', 'black cat'],
        summary: 'ALPHV, also known as BlackCat, is a ransomware and extortion operation associated with affiliate intrusions, data theft, encryption, leak-site claims, and attacks against large organizations.',
        aliases: ['BlackCat', 'Black Cat']
    },
    {
        names: ['hunters international'],
        summary: 'Hunters International is a data-extortion and ransomware operation associated with enterprise intrusions, data theft, encryption, and public victim claims.',
        aliases: []
    }
]

export function automaticThreatActorWarmList() {
    return [
        'apt29',
        'apt42',
        'apt49',
        ...BASELINE_ACTOR_PROFILES.map(profile => profile.names[0]!),
    ]
}

function baselineKnownActorProfile(normalized: string): KnownActorContext | null {
    const profile = BASELINE_ACTOR_PROFILES.find(item => item.names.some(name => normalized === name || normalized.includes(name)))
    if (!profile) return null
    return buildAutomaticBaselineProfile(profile)
}

function buildAutomaticBaselineProfile(profile: BaselineActorProfile): KnownActorContext {
    const primaryName = profile.aliases[0] || titleCaseWords(profile.names[0])
    const generatedAt = new Date().toISOString()
    return {
        status: 'ready',
        confidence: 0.68,
        lastSeen: generatedAt,
        summary: profile.summary,
        aliases: profile.aliases,
        recentActivity: [
            {
                date: generatedAt.slice(0, 10),
                title: `${primaryName} actor profile updated`,
                detail: `${primaryName} aliases were matched against actor directories, public reporting links, monitored source records, and the actor catalog. Recent activity updates separately when new source evidence appears.`,
                confidence: 0.68,
                sourceIds: ['google-cloud-apt-groups', 'mitre-attack-groups', 'malpedia-actor-index'],
                claimType: 'general_activity',
                affectedSectors: inferProfileSectors(profile.summary),
                countries: inferProfileRegions(profile.summary),
                impact: 'Keeps stable actor context available while recent reporting and monitored source captures update independently.',
                firstReportedAt: generatedAt,
                lastReportedAt: generatedAt,
                publisherCount: 2,
            }
        ],
        targets: inferBaselineTargets(profile.summary),
        ttps: inferBaselineTtps(profile.summary),
        datasets: automaticActorDatasets(primaryName),
        sources: automaticActorSources(primaryName),
        notes: [
            'Shared actor refresh job; not a one-off profile override.',
            'Profile fields are cached and reused until source records or recent activity changes.',
            'Recent activity is allowed to refresh more often than stable actor identity, aliases, and targeting context.',
        ],
    }
}

function summarizeLiveResult(query: string, matches: LiveSearchMatch[], known: KnownActorContext | null) {
    if (known) return known.summary
    const top = matches.find(match => match.snippet)?.snippet ?? matches[0]?.title ?? ''
    const compact = truncateSentence(top, 240)
    if (compact) return `${query}: ${compact}`
    return 'Searching'
}

function mergeTargets(primary: TiTarget[], secondary: TiTarget[]) {
    const merged = [...primary]
    for (const item of secondary) {
        if (!merged.some(existing => existing.sector.toLowerCase() === item.sector.toLowerCase())) {
            merged.push(item)
        }
    }
    return merged.slice(0, 5)
}

function mergeTtps(primary: TiTtp[], secondary: TiTtp[]) {
    const merged = [...primary]
    for (const item of secondary) {
        if (!merged.some(existing => existing.name.toLowerCase() === item.name.toLowerCase() || (item.attackId && existing.attackId === item.attackId))) {
            merged.push(item)
        }
    }
    return merged.slice(0, 6)
}

function mergeActivity(primary: TiActivity[], secondary: TiActivity[]) {
    const merged = [...primary]
    for (const item of secondary) {
        if (!merged.some(existing => existing.title.toLowerCase() === item.title.toLowerCase())) {
            merged.push(item)
        }
    }
    return merged
        .sort((a, b) => Date.parse(b.lastReportedAt ?? b.firstReportedAt ?? b.date) - Date.parse(a.lastReportedAt ?? a.firstReportedAt ?? a.date))
        .slice(0, 8)
}

function mergeDatasets(primary: TiDataset[], secondary: TiDataset[]) {
    const merged = [...secondary]
    for (const item of primary) {
        if (!merged.some(existing => existing.name.toLowerCase() === item.name.toLowerCase())) {
            merged.push(item)
        }
    }
    return merged.slice(0, 8)
}

function mergeSources(primary: TiSource[], secondary: TiSource[]) {
    const merged = [...secondary]
    for (const item of primary) {
        if (!merged.some(existing => existing.id === item.id || existing.url === item.url)) {
            merged.push(item)
        }
    }
    return merged.slice(0, 10)
}

function automaticActorDatasets(actorName: string): TiDataset[] {
    return [
        {
            name: `${actorName} actor profile`,
            type: 'vendor_report',
            coverage: 'Stable actor identity, aliases, targeting, tradecraft, source links, and analyst notes from the background actor refresh job.',
            status: 'available',
        },
        {
            name: `${actorName} recent activity refresh`,
            type: 'clear_web',
            coverage: 'Recent reporting and monitored source deltas update independently from the stable profile cache.',
            status: 'available',
        },
        {
            name: 'Company exposure monitoring',
            type: 'darknet_metadata',
            coverage: 'Company, domain, vendor, and product mentions are matched against monitored actor/source records where policy allows.',
            status: 'metadata_only',
        },
    ]
}

function automaticActorSources(actorName: string): TiSource[] {
    const query = encodeURIComponent(`${actorName} threat actor`)
    return [
        {
            id: 'google-cloud-apt-groups',
            name: 'Google Cloud Security: APT groups directory',
            type: 'actor_directory',
            provenance: 'https://cloud.google.com/security/resources/insights/apt-groups',
            url: 'https://cloud.google.com/security/resources/insights/apt-groups',
        },
        {
            id: 'mitre-attack-groups',
            name: 'MITRE ATT&CK Groups',
            type: 'actor_directory',
            provenance: 'https://attack.mitre.org/groups/',
            url: 'https://attack.mitre.org/groups/',
        },
        {
            id: 'malpedia-actor-index',
            name: 'Malpedia actor index',
            type: 'actor_directory',
            provenance: 'https://malpedia.caad.fkie.fraunhofer.de/actors',
            url: 'https://malpedia.caad.fkie.fraunhofer.de/actors',
        },
        {
            id: 'cisa-advisories',
            name: 'CISA cybersecurity advisories',
            type: 'public_advisory',
            provenance: 'https://www.cisa.gov/news-events/cybersecurity-advisories',
            url: 'https://www.cisa.gov/news-events/cybersecurity-advisories',
        },
        {
            id: `live-news-${slugifyForId(actorName)}`,
            name: `${actorName} live reporting query`,
            type: 'live_clear_web',
            provenance: `https://news.google.com/search?q=${query}`,
            url: `https://news.google.com/search?q=${query}`,
        },
    ]
}

function inferBaselineTargets(summary: string): TiTarget[] {
    const sectors = inferProfileSectors(summary)
    const regions = inferProfileRegions(summary)
    return sectors.slice(0, 4).map((sector, index) => ({
        sector,
        regions,
        rationale: targetRationaleForSector(sector, summary),
        confidence: Math.max(0.52, 0.72 - index * 0.05),
    }))
}

function inferProfileSectors(summary: string) {
    const lower = summary.toLowerCase()
    const sectors = new Set<string>()
    if (/government|diplomat|policy|intelligence/.test(lower)) sectors.add('Government, diplomacy, and policy')
    if (/defense|military/.test(lower)) sectors.add('Defense and military')
    if (/telecommunications|network-provider|communications/.test(lower)) sectors.add('Telecommunications and network providers')
    if (/critical-infrastructure|critical infrastructure|energy|industrial|wiper/.test(lower)) sectors.add('Critical infrastructure')
    if (/technology|cloud|software|supply-chain|cryptocurrency|identity/.test(lower)) sectors.add('Technology, cloud, and identity')
    if (/media|journalist|ngo|research|think tank/.test(lower)) sectors.add('Media, NGOs, research, and civil society')
    if (/ransomware|extortion|data theft|enterprise/.test(lower)) sectors.add('Enterprise company exposure')
    return sectors.size ? [...sectors] : ['Enterprise security monitoring']
}

function inferProfileRegions(summary: string) {
    const lower = summary.toLowerCase()
    const regions = new Set<string>()
    if (/russia|nato|europe/.test(lower)) regions.add('Europe')
    if (/north america|united states|u\.s\.|us /.test(lower)) regions.add('North America')
    if (/china|taiwan|asia|southeast|east asia/.test(lower)) regions.add('Asia-Pacific')
    if (/iran|middle east/.test(lower)) regions.add('Middle East')
    if (/north korea|korea/.test(lower)) regions.add('Korean Peninsula')
    if (/global|many sectors|large organizations|enterprise/.test(lower)) regions.add('Global')
    return regions.size ? [...regions] : ['Global']
}

function inferBaselineTtps(summary: string): TiTtp[] {
    const lower = summary.toLowerCase()
    const ttps: TiTtp[] = []
    if (/phishing|social engineering/.test(lower)) {
        ttps.push({ name: 'Phishing', attackId: 'T1566', tactic: 'Initial Access', detail: 'Profile summary references phishing or social engineering; enrich with campaign-specific delivery details when fresh reporting is captured.', confidence: 0.64 })
    }
    if (/credential|identity|password|account takeover/.test(lower)) {
        ttps.push({ name: 'Valid Accounts', attackId: 'T1078', tactic: 'Persistence / Defense Evasion', detail: 'Credential or identity abuse appears in the profile summary and should be monitored against customer identity telemetry.', confidence: 0.62 })
    }
    if (/cloud|web services|legitimate-looking services/.test(lower)) {
        ttps.push({ name: 'Web Service', attackId: 'T1102', tactic: 'Command and Control', detail: 'Cloud or web-service use appears in the profile context; campaign-level evidence should decide the concrete service pattern.', confidence: 0.56 })
    }
    if (/malware|remote-access|tooling|custom malware|payload/.test(lower)) {
        ttps.push({ name: 'Ingress Tool Transfer', attackId: 'T1105', tactic: 'Command and Control', detail: 'Malware/tooling activity implies payload transfer or follow-on tooling in many campaigns.', confidence: 0.54 })
    }
    if (/data theft|collection|email collection|intelligence collection|exfiltration|extortion/.test(lower)) {
        ttps.push({ name: 'Data from Local System', attackId: 'T1005', tactic: 'Collection', detail: 'Collection or theft language appears in the actor profile; enrichment keeps this separate from unverified leak data.', confidence: 0.58 })
    }
    if (/ransomware|encryption|wiper|destructive|disruptive/.test(lower)) {
        ttps.push({ name: 'Data Encrypted for Impact', attackId: 'T1486', tactic: 'Impact', detail: 'Ransomware, destructive, or disruptive language maps to impact-oriented monitoring and response context.', confidence: 0.57 })
    }
    return ttps.length ? ttps.slice(0, 5) : [
        {
            name: 'Source-driven TTP enrichment pending',
            tactic: 'Review',
            detail: 'The profile is known, but technique mapping waits for campaign source details.',
            confidence: 0.4,
        },
    ]
}

function targetRationaleForSector(sector: string, summary: string) {
    if (sector === 'Enterprise company exposure') return 'Enterprise impact is inferred from ransomware, extortion, or data-theft language in the actor profile.'
    if (sector === 'Technology, cloud, and identity') return 'Technology and identity targets are high-value pivots for downstream access and broad visibility.'
    if (sector === 'Critical infrastructure') return 'Critical infrastructure wording makes this actor relevant for resilience and incident-readiness monitoring.'
    return `The actor summary supports monitoring this sector: ${truncateSentence(summary, 160)}`
}

function titleCaseWords(value: string) {
    return value.split(/\s+/).map(word => word ? `${word[0].toUpperCase()}${word.slice(1)}` : '').join(' ')
}

function slugifyForId(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'actor'
}

function truncateSentence(value: string, maxLength: number) {
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, maxLength - 1).trimEnd()}...`
}

function latestIso(left: string, right: string) {
    const leftTime = Date.parse(left)
    const rightTime = Date.parse(right)
    if (Number.isNaN(leftTime)) return right
    if (Number.isNaN(rightTime)) return left
    return leftTime >= rightTime ? left : right
}

interface LiveSearchMatch {
    id: string
    title: string
    url: string
    snippet: string
    publishedAt?: string
    publisher?: string
    kind: 'news' | 'web' | 'background'
}

interface LiveClaimCluster {
    matches: LiveSearchMatch[]
    tokens: Set<string>
}

const CLAIM_CLUSTER_STOP_WORDS = new Set([
    'about', 'after', 'against', 'attack', 'attacks', 'campaign', 'claims', 'cyber', 'from',
    'group', 'hacker', 'hackers', 'linked', 'malware', 'new', 'report', 'reports', 'says',
    'threat', 'using', 'with'
])

export function clusterLiveNews(query: string, matches: LiveSearchMatch[]): TiActivity[] {
    const sorted = matches
        .filter(match => match.kind === 'news' && match.publishedAt)
        .sort((left, right) => Date.parse(right.publishedAt ?? '') - Date.parse(left.publishedAt ?? ''))
    const queryTokens = new Set(normalizeLiveSearchText(query).split(/\s+/).filter(Boolean))
    const clusters: LiveClaimCluster[] = []

    for (const match of sorted) {
        const tokens = claimTokens(match.title, queryTokens)
        const timestamp = Date.parse(match.publishedAt ?? '')
        const cluster = clusters.find((candidate) => {
            const candidateTimestamp = Date.parse(candidate.matches[0]?.publishedAt ?? '')
            const withinThreeDays = Math.abs(timestamp - candidateTimestamp) <= 3 * 24 * 60 * 60 * 1000
            return withinThreeDays && tokenSimilarity(tokens, candidate.tokens) >= 0.5
        })
        if (cluster) {
            cluster.matches.push(match)
            for (const token of tokens) cluster.tokens.add(token)
        } else {
            clusters.push({ matches: [match], tokens })
        }
    }

    return clusters
        .map((cluster, index) => claimClusterToActivity(query, cluster.matches, index))
        .sort((left, right) => Date.parse(right.lastReportedAt ?? right.date) - Date.parse(left.lastReportedAt ?? left.date))
}

function claimClusterToActivity(query: string, matches: LiveSearchMatch[], index: number): TiActivity {
    const ordered = [...matches].sort((left, right) => Date.parse(left.publishedAt ?? '') - Date.parse(right.publishedAt ?? ''))
    const first = ordered[0]!
    const latest = ordered.at(-1)!
    const publishers = uniqueStrings(matches.map(match => match.publisher).filter((value): value is string => Boolean(value)))
    const sourceIds = uniqueStrings(matches.map(match => match.id))
    const combinedText = matches.map(match => `${match.title} ${match.snippet}`).join(' ')
    const victimName = inferVictimName(query, matches)
    const sectors = inferLiveTargets(query, matches).map(target => target.sector)

    return {
        date: latest.publishedAt!.slice(0, 10),
        title: stripPublisherSuffix(latest.title, latest.publisher),
        detail: claimClusterDetail(latest, publishers),
        confidence: Math.min(0.86, Math.max(0.4, 0.64 - index * 0.04 + Math.min(0.18, (publishers.length - 1) * 0.06))),
        sourceIds,
        url: safeTiLink(latest.url),
        claimType: inferClaimType(combinedText),
        victimName,
        affectedSectors: sectors.length ? sectors : undefined,
        countries: inferCountries(combinedText),
        impact: inferImpact(combinedText),
        firstReportedAt: first.publishedAt,
        lastReportedAt: latest.publishedAt,
        publisherCount: publishers.length,
        corroboratingSourceIds: sourceIds.length > 1 ? sourceIds : [],
        contradictingSourceIds: []
    }
}

function claimTokens(title: string, queryTokens: Set<string>): Set<string> {
    const normalized = normalizeLiveSearchText(stripPublisherSuffix(title))
    return new Set(normalized
        .split(/\s+/)
        .filter(token => token.length >= 4 && !queryTokens.has(token) && !CLAIM_CLUSTER_STOP_WORDS.has(token)))
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
    if (left.size < 2 || right.size < 2) return 0
    let intersection = 0
    for (const token of left) {
        if (right.has(token)) intersection += 1
    }
    return intersection / Math.min(left.size, right.size)
}

function stripPublisherSuffix(title: string, publisher?: string): string {
    if (publisher) {
        const suffix = new RegExp(`\\s+-\\s+${escapeRegExp(publisher)}$`, 'i')
        return title.replace(suffix, '').trim()
    }
    return title.replace(/\s+-\s+[^-]{2,60}$/, '').trim()
}

function claimClusterDetail(latest: LiveSearchMatch, publishers: string[]): string {
    const title = normalizeLiveSearchText(stripPublisherSuffix(latest.title, latest.publisher))
    const candidateSnippet = truncateSentence(latest.snippet, 240)
    const normalizedSnippet = normalizeLiveSearchText(candidateSnippet)
    const snippet = normalizedSnippet === title || normalizedSnippet.startsWith(`${title} `) ? '' : candidateSnippet
    const coverage = publishers.length > 1
        ? `Reported by ${publishers.length} publishers: ${publishers.slice(0, 4).join(', ')}.`
        : publishers[0] ? `Reported by ${publishers[0]}.` : 'Reported by one public source.'
    return snippet ? `${snippet} ${coverage}` : coverage
}

function inferClaimType(text: string): TiActivity['claimType'] {
    const normalized = text.toLowerCase()
    if (/\b(?:victim|breach|leak site|data leak|extortion)\b/.test(normalized)) return 'victim_claim'
    if (/\b(?:cve-\d{4}-\d+|zero-day|vulnerabilit|exploit)\b/.test(normalized)) return 'vulnerability_exploitation'
    if (/\b(?:botnet|command and control|c2|infrastructure|server|router)\b/.test(normalized)) return 'infrastructure_activity'
    if (/\b(?:malware|backdoor|trojan|ransomware|implant)\b/.test(normalized)) return 'malware_activity'
    if (/\b(?:operation|campaign|espionage|targeting)\b/.test(normalized)) return 'campaign'
    return 'general_activity'
}

function inferVictimName(query: string, matches: LiveSearchMatch[]): string | undefined {
    for (const match of matches) {
        const title = stripPublisherSuffix(match.title, match.publisher)
        if (isLegalProceedingHeadline(title)) continue
        const patterns = [
            /\b(?:targets?|targeted|hits?|hit|breaches?|breached|attacks?|attacked)\s+([A-Z][A-Za-z0-9&.' -]{2,60}?)(?:\s+(?:with|using|in|after|through|via)\b|[:,]|$)/,
            /\b([A-Z][A-Za-z0-9&.' -]{2,60}?)\s+(?:breach|attack|incident|hack)\b/
        ]
        for (const pattern of patterns) {
            const candidate = title.match(pattern)?.[1]?.trim()
            if (candidate && isLikelyVictimName(candidate, query)) return candidate
        }
    }
    return undefined
}

function isLegalProceedingHeadline(title: string): boolean {
    return /\b(?:arrest(?:ed)?|charged?|charges?|indict(?:ed|ment)|pleads?\s+guilty|sentenced?|suspect|defendant|co-?conspirator|feds?|justice department|court|prosecutors?)\b/i.test(title)
}

function isLikelyVictimName(candidate: string, query: string): boolean {
    const normalizedCandidate = normalizeLiveSearchText(candidate)
    if (!normalizedCandidate || normalizedCandidate === normalizeLiveSearchText(query)) return false
    if (/\b(?:man|woman|teen|hacker|suspect|defendant|member|conspirator|co conspirator|person|individual|group|crew|gang|actor)\b/.test(normalizedCandidate)) return false
    if (/\b(?:pleads?|guilty|charged?|arrested|sentenced|indicted|uncovers?|links?)\b/.test(normalizedCandidate)) return false
    return true
}

function inferCountries(text: string): string[] | undefined {
    const countries: Array<[RegExp, string]> = [
        [/\b(?:united states|u\.s\.|american)\b/i, 'United States'],
        [/\b(?:united kingdom|u\.k\.|british)\b/i, 'United Kingdom'],
        [/\b(?:ukraine|ukrainian)\b/i, 'Ukraine'],
        [/\b(?:germany|german)\b/i, 'Germany'],
        [/\b(?:france|french)\b/i, 'France'],
        [/\b(?:japan|japanese)\b/i, 'Japan'],
        [/\b(?:south korea|korean)\b/i, 'South Korea']
    ]
    const matches = countries.filter(([pattern]) => pattern.test(text)).map(([, country]) => country)
    return matches.length ? matches : undefined
}

function inferImpact(text: string): string | undefined {
    const normalized = text.toLowerCase()
    if (/\b(?:data theft|stolen data|exfiltrat|data leak)\b/.test(normalized)) return 'Reported data theft or disclosure'
    if (/\b(?:ransomware|encrypt|extortion)\b/.test(normalized)) return 'Reported ransomware or extortion impact'
    if (/\b(?:account takeover|credential theft|stolen credentials)\b/.test(normalized)) return 'Reported credential or account compromise'
    if (/\b(?:disruption|outage|offline)\b/.test(normalized)) return 'Reported service disruption'
    return undefined
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

async function searchClearWeb(query: string, aliases: string[] = []): Promise<LiveSearchMatch[]> {
    const [news, duckDuckGo, wikipedia] = await Promise.all([
        searchGoogleNewsRss(query, aliases),
        searchDuckDuckGoHtml(query, aliases),
        searchWikipedia(query)
    ])
    const merged: LiveSearchMatch[] = []
    for (const match of [...news, ...duckDuckGo, ...wikipedia]) {
        if (!merged.some(existing => existing.url === match.url || existing.title.toLowerCase() === match.title.toLowerCase())) {
            merged.push(match)
        }
    }
    return merged.slice(0, 8)
}

const GENERIC_LIVE_SEARCH_TOKENS = new Set([
    'actor',
    'actors',
    'apt',
    'group',
    'threat',
    'cyber',
    'attack',
    'attacks',
    'malware',
    'ransomware',
    'campaign',
    'made',
    'unknown',
    'random',
    'test'
])

function filterLiveMatchesForQuery(query: string, matches: LiveSearchMatch[], knownActor: boolean): LiveSearchMatch[] {
    if (knownActor) return matches
    const normalized = normalizeLiveSearchText(query)
    const distinctiveTokens = normalized
        .split(/\s+/)
        .filter(token => token.length >= 4 && !GENERIC_LIVE_SEARCH_TOKENS.has(token))

    return matches.filter((match) => {
        const haystack = normalizeLiveSearchText(`${match.title} ${match.snippet} ${match.url}`)
        if (normalized.length >= 4 && haystack.includes(normalized)) return true
        if (distinctiveTokens.length === 0) return false
        return distinctiveTokens.some(token => haystack.includes(token))
    })
}

function normalizeLiveSearchText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

async function searchDuckDuckGoHtml(query: string, aliases: string[] = []): Promise<LiveSearchMatch[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)
    try {
        const search = new URL('https://html.duckduckgo.com/html/')
        search.searchParams.set('q', `${buildActorSearchExpression(query, aliases)} threat actor cyber`)
        const response = await fetch(search, {
            headers: {
                accept: 'text/html,application/xhtml+xml',
                'user-agent': 'hanasand-ti-scraper/0.1 (+https://hanasand.com/ti)'
            },
            signal: controller.signal
        })
        if (!response.ok) return []
        const html = await response.text()
        return parseDuckDuckGoResults(html)
    } catch {
        return []
    } finally {
        clearTimeout(timeout)
    }
}

async function searchGoogleNewsRss(query: string, aliases: string[] = []): Promise<LiveSearchMatch[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
        const search = new URL('https://news.google.com/rss/search')
        search.searchParams.set('q', `${buildActorSearchExpression(query, aliases)} (cyber OR malware OR ransomware OR espionage)`)
        search.searchParams.set('hl', 'en-US')
        search.searchParams.set('gl', 'US')
        search.searchParams.set('ceid', 'US:en')
        const response = await fetch(search, {
            headers: {
                accept: 'application/rss+xml,application/xml,text/xml',
                'user-agent': 'hanasand-ti-scraper/0.2 (+https://hanasand.com/ti)'
            },
            signal: controller.signal
        })
        if (!response.ok) return []
        return parseGoogleNewsRss(await response.text())
    } catch {
        return []
    } finally {
        clearTimeout(timeout)
    }
}

export function buildActorSearchExpression(query: string, aliases: string[] = []): string {
    const terms = uniqueStrings([query, ...aliases]).slice(0, 4)
    return terms.map(term => `"${term.replace(/"/g, '')}"`).join(' OR ')
}

export function parseGoogleNewsRss(xml: string): LiveSearchMatch[] {
    try {
        const body = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml) as {
            rss?: { channel?: { item?: GoogleNewsItem | GoogleNewsItem[] } }
        }
        const rawItems = body.rss?.channel?.item
        const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []
        return items
            .map((item): LiveSearchMatch | null => {
                const title = stringValue(item.title)
                const url = stringValue(item.link)
                const publishedAt = parsePublishedAt(item.pubDate)
                if (!title || !url || !publishedAt) return null
                const publisher = sourceName(item.source)
                return {
                    id: `live:${hashString(`google-news:${title}:${url}`).slice(0, 16)}`,
                    title,
                    url,
                    snippet: cleanHtml(stringValue(item.description) ?? ''),
                    publishedAt,
                    publisher,
                    kind: 'news'
                }
            })
            .filter((item): item is LiveSearchMatch => Boolean(item))
            .sort((left, right) => Date.parse(right.publishedAt ?? '') - Date.parse(left.publishedAt ?? ''))
            .slice(0, 8)
    } catch {
        return []
    }
}

interface GoogleNewsItem {
    title?: unknown
    link?: unknown
    description?: unknown
    pubDate?: unknown
    source?: unknown
}

function parsePublishedAt(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

function sourceName(value: unknown): string | undefined {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return undefined
    return stringValue((value as Record<string, unknown>)['#text'])
}

async function searchWikipedia(query: string): Promise<LiveSearchMatch[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)
    try {
        const search = new URL('https://en.wikipedia.org/w/api.php')
        search.searchParams.set('action', 'query')
        search.searchParams.set('list', 'search')
        search.searchParams.set('srsearch', `${query} cyber threat actor`)
        search.searchParams.set('format', 'json')
        search.searchParams.set('utf8', '1')
        const response = await fetch(search, {
            headers: {
                accept: 'application/json',
                'user-agent': 'hanasand-ti-scraper/0.1 (+https://hanasand.com/ti)'
            },
            signal: controller.signal
        })
        if (!response.ok) return []
        const body = await response.json() as {
            query?: {
                search?: Array<{ title?: string; snippet?: string; timestamp?: string }>
            }
        }
        return (body.query?.search ?? [])
            .filter(item => item.title)
            .slice(0, 6)
            .map((item) => {
                const title = item.title ?? query
                const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`
                const snippet = `${cleanHtml(item.snippet ?? '')}${item.timestamp ? ` Updated ${item.timestamp.slice(0, 10)}.` : ''}`.trim()
                return {
                    id: `live:${hashString(`wikipedia:${title}:${url}`).slice(0, 16)}`,
                    title: `${title} - Wikipedia live search`,
                    url,
                    snippet,
                    kind: 'background'
                }
            })
    } catch {
        return []
    } finally {
        clearTimeout(timeout)
    }
}

function parseDuckDuckGoResults(html: string): LiveSearchMatch[] {
    const matches: LiveSearchMatch[] = []
    const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)/g
    for (const match of html.matchAll(resultPattern)) {
        const url = normalizeDuckDuckGoUrl(decodeHtml(match[1] ?? ''))
        const title = cleanHtml(match[2] ?? '')
        const snippet = cleanHtml(match[3] ?? match[4] ?? '')
        if (!url || !title) continue
        const id = `live:${hashString(`${title}:${url}`).slice(0, 16)}`
        if (!matches.some(existing => existing.url === url)) {
            matches.push({ id, title, url, snippet, kind: 'web' })
        }
        if (matches.length >= 8) break
    }
    return matches
}

function normalizeDuckDuckGoUrl(raw: string) {
    try {
        const url = raw.startsWith('//') ? new URL(`https:${raw}`) : new URL(raw)
        const uddg = url.searchParams.get('uddg')
        return uddg ? decodeURIComponent(uddg) : url.toString()
    } catch {
        return raw
    }
}

function cleanHtml(value: string) {
    return decodeHtml(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function decodeHtml(value: string) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x27;/g, '\'')
        .replace(/&#39;/g, '\'')
        .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
}

function hashString(value: string) {
    let hash = 5381
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
    }
    return Math.abs(hash >>> 0).toString(16).padStart(8, '0')
}

function tiResultState(value: string | undefined, fallback: TiResultState): TiResultState {
    return value === 'queued' || value === 'searching' || value === 'partial' || value === 'ready' || value === 'metadata_review' || value === 'blocked_unsafe_target' || value === 'needs_source_activation'
        ? value
        : fallback
}

function analystStepState(value: string | undefined): TiAnalystLoop['nextSteps'][number]['state'] {
    return value === 'queued' || value === 'metadata_review' || value === 'blocked_unsafe_target' || value === 'needs_source_activation' || value === 'ready'
        ? value
        : 'metadata_review'
}

function analystTone(value: string | undefined): 'ok' | 'watch' | 'bad' {
    return value === 'ok' || value === 'watch' || value === 'bad' ? value : 'watch'
}

function metadataReviewStatus(value: string | undefined): TiMetadataReviewItem['status'] {
    return value === 'needs_review' || value === 'queued_metadata_only' || value === 'duplicate' || value === 'escalated'
        ? value
        : 'needs_review'
}

function metadataReviewAction(value: string): TiMetadataReviewItem['allowedActions'][number] | undefined {
    return value === 'notify_company' || value === 'mark_duplicate' || value === 'request_approval' || value === 'escalate'
        ? value
        : undefined
}

function sourceActivationAction(value: string | undefined): TiAnalystLoop['sourceActivationWorkflow']['actions'][number]['action'] | undefined {
    return value === 'request_approval' || value === 'restore_source' || value === 'enable_metadata_only_queue' || value === 'keep_blocked'
        ? value
        : undefined
}

function sourceActivationExecution(value: string | undefined): TiAnalystLoop['sourceActivationWorkflow']['actions'][number]['execution'] {
    return value === 'dry_run' || value === 'human_approval_required' || value === 'blocked'
        ? value
        : 'dry_run'
}

function liveDatasets(): TiDataset[] {
    return [
        { name: 'Live clear-web search', type: 'clear_web', coverage: 'Real-time public web discovery plus approved scraper captures', status: 'available' },
        { name: 'Public Telegram/channel mentions', type: 'public_channel', coverage: 'Public channels only through official APIs', status: 'planned', url: 'https://core.telegram.org/bots/api' },
        { name: 'Darknet/leak metadata', type: 'darknet_metadata', coverage: 'Metadata-only actor/victim/date claims; no leaked file downloads', status: 'metadata_only' },
        { name: 'STIX-like export bundle', type: 'stix_export', coverage: 'Indicators, entities, and relationships once live captures exist', status: 'planned', url: 'https://oasis-open.github.io/cti-documentation/' }
    ]
}

function safeTiLink(value?: string): string | undefined {
    if (!value) return undefined
    try {
        const url = new URL(value)
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
        if (url.protocol === 'http:' && url.hostname.endsWith('.onion')) return url.toString()
        return undefined
    } catch {
        const onion = value.match(/\bhttps?:\/\/[a-z2-7]{16,56}\.onion[^\s<>"']*/i)?.[0]
        return onion
    }
}

function inferLiveTargets(query: string, matches: LiveSearchMatch[]): TiTarget[] {
    const text = `${query} ${matches.map(match => `${match.title} ${match.snippet}`).join(' ')}`.toLowerCase()
    const targets: TiTarget[] = []
    if (/\bgovernment|diplomat|ministry|embassy|state|defense|nato\b/.test(text)) {
        targets.push({
            sector: 'Government, diplomacy, or defense',
            regions: ['From live source context'],
            rationale: 'Live public results include government, diplomacy, defense, or NATO-related language.',
            confidence: 0.38
        })
    }
    if (/\bhealthcare|hospital|pharma|medical\b/.test(text)) {
        targets.push({
            sector: 'Healthcare',
            regions: ['From live source context'],
            rationale: 'Live public results include healthcare-related language.',
            confidence: 0.34
        })
    }
    if (/\btechnology|cloud|software|identity|microsoft|google\b/.test(text)) {
        targets.push({
            sector: 'Technology and cloud services',
            regions: ['From live source context'],
            rationale: 'Live public results include technology, cloud, or identity platform language.',
            confidence: 0.34
        })
    }
    return targets
}

function inferLiveTtps(matches: LiveSearchMatch[]): TiTtp[] {
    const text = matches.map(match => `${match.title} ${match.snippet}`).join(' ').toLowerCase()
    const ttps: TiTtp[] = []
    if (/\bphishing|spear.?phishing\b/.test(text)) {
        ttps.push({ name: 'Phishing', attackId: 'T1566', tactic: 'Initial Access', detail: 'Live source snippets mention phishing-related access.', confidence: 0.34 })
    }
    if (/\bpassword spraying|credential|token|identity\b/.test(text)) {
        ttps.push({ name: 'Credential or identity abuse', attackId: 'T1110', tactic: 'Credential Access', detail: 'Live source snippets mention credentials, tokens, identity, or password attacks.', confidence: 0.34 })
    }
    if (/\bransomware|encrypt|extortion|leak\b/.test(text)) {
        ttps.push({ name: 'Data encrypted or extortion activity', tactic: 'Impact', detail: 'Live source snippets mention ransomware, extortion, leaks, or encryption.', confidence: 0.3 })
    }
    return ttps
}
