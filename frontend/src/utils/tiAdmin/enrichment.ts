import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'

export type TiEnrichmentStatus = 'ready' | 'running' | 'queued' | 'review'
export type TiWorkerState = 'active' | 'idle' | 'unavailable'

export type TiEnrichedActor = {
    id: string
    name: string
    aliases: string[]
    status: TiEnrichmentStatus
    confidence: number
    lastUpdatedAt: string
    nextRefreshAt: string
    changedFields: string[]
    sourceLinks: Array<{ name: string, url: string }>
    automationEvidence: string[]
    plannedWork: string[]
    refreshCount?: number
}

export type TiActivityEvent = {
    id: string
    actorId: string
    actorName: string
    happenedAt: string
    title: string
    detail: string
    source: string
    tone: 'ok' | 'watch' | 'bad'
}

export type TiProfileUpdate = {
    id: string
    actorId: string
    observedAt: string
    sourceId: string
    captureIds: string[]
    kind: string
    changedFields: string[]
    summary: string
}

export type TiManagementAuditEvent = {
    id: string
    happenedAt: string
    actor: string
    action: string
    target: string
    result: string
    detail: string
}

export type TiEnrichmentOverview = {
    generatedAt: string
    worker: {
        state: TiWorkerState
        mode: string
        intervalSeconds: number
        batchSize: number
        lastSweepStartedAt: string | null
        lastSweepFinishedAt: string | null
        lastError: string | null
        cursor: number
        lastRunId?: string | null
        lastRunAt?: string | null
        lastSuccessfulRunAt?: string | null
        snapshotFresh?: boolean
    }
    updatedActors: TiEnrichedActor[]
    queuedActors: TiEnrichedActor[]
    activity: TiActivityEvent[]
    updates: TiProfileUpdate[]
    auditLog: TiManagementAuditEvent[]
    stats: {
        updatedLastHour: number
        queued: number
        auditedEvents: number
        automaticCoverage: number
        totalRefreshes: number
        profilesProcessed: number
        profilesChanged: number
        sourceRecords: number
        evidenceRecords: number
        failures: number
    }
    pipeline?: TiPipelineOverview
}

export type TiPipelineOverview = {
    worker: {
        state: 'idle' | 'running' | 'failed'
        lastStartedAt: string | null
        lastFinishedAt: string | null
        lastError: string | null
        intervalSeconds: number
        mode: string
    }
    queue: {
        totalActors: number
        cursor: number
        nextActors: string[]
    }
    stats: {
        snapshots: number
        sources: number
        activity: number
        published_24h: number
        runs_24h: number
    }
    latestRuns: Array<{
        id: string
        actor_key: string
        actor_name: string
        status: string
        started_at: string
        finished_at: string | null
        changed_fields: string[]
        discovered_items: number
        published_items: number
        error: string | null
    }>
    latestSnapshots: Array<{
        actor_key: string
        actor_name: string
        source_count: number
        activity_count: number
        target_count: number
        ttp_count: number
        updated_at: string
    }>
    latestDiscoveries: Array<{
        id: string
        actor_key: string
        actor_name: string
        kind: string
        title: string
        detail: string
        source_url: string
        source_name: string
        first_seen_at: string
        last_seen_at: string
        published_at: string | null
    }>
}

// ponytail: serve the last snapshot immediately; a slow scraper must not block dashboard navigation.
const ENRICHMENT_CACHE_TTL_MS = 5_000
let enrichmentCache: { value: TiEnrichmentOverview, expiresAt: number, refreshing?: Promise<void> } | undefined

export async function getTiEnrichmentOverview(): Promise<TiEnrichmentOverview> {
    const now = Date.now()
    if (enrichmentCache?.expiresAt && enrichmentCache.expiresAt > now) return enrichmentCache.value
    if (enrichmentCache?.refreshing) return enrichmentCache.value

    const value = enrichmentCache?.value || passiveOverview([], [], undefined)
    enrichmentCache = { value, expiresAt: now + ENRICHMENT_CACHE_TTL_MS }
    enrichmentCache.refreshing = refreshEnrichmentCache().finally(() => {
        if (enrichmentCache?.refreshing) delete enrichmentCache.refreshing
    })
    return value
}

async function refreshEnrichmentCache() {
    const [profiles, updates, status] = await Promise.all([
        getPersistedActorProfiles(),
        getPersistedProfileUpdates(),
        getPersistedEnrichmentStatus(),
    ])
    enrichmentCache = { value: passiveOverview(profiles, updates, status), expiresAt: Date.now() + ENRICHMENT_CACHE_TTL_MS }
}

type PersistedEnrichmentStatus = {
    worker: { state: TiWorkerState, lastRunAt: string | null, lastSuccessfulRunAt: string | null, currentFailure: string | null, snapshotFresh: boolean }
    latestRun: { id: string, status: string, actorCount: number, sourceCount: number, changedFieldCount: number, evidenceCount: number, failureCount: number, finishedAt: string | null } | null
}

async function getPersistedEnrichmentStatus(): Promise<PersistedEnrichmentStatus | undefined> {
    try {
        const target = new URL('/v1/intel/actor-enrichment/status', tiScraperApiBase())
        target.searchParams.set('tenantId', 'default')
        const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
        const response = await fetch(target, { cache: 'force-cache', next: { revalidate: 5 }, headers: serviceToken ? { 'x-hanasand-service-token': serviceToken } : undefined, signal: AbortSignal.timeout(2_000) })
        if (!response.ok) return undefined
        return await response.json() as PersistedEnrichmentStatus
    } catch {
        return undefined
    }
}

type PersistedActorProfile = {
    id: string
    canonicalName: string
    aliases: string[]
    confidence: number
    firstSeenAt: string
    lastSeenAt: string
    updatedAt: string
    sourceIds: string[]
    captureIds: string[]
    evidenceCount: number
    actorType: string
}

async function getPersistedActorProfiles(): Promise<PersistedActorProfile[]> {
    try {
        const base = tiScraperApiBase()
        const target = new URL('/v1/intel/actor-profiles', base)
        target.searchParams.set('tenantId', 'default')
        target.searchParams.set('limit', '100')
        const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
        const response = await fetch(target, {
            cache: 'force-cache',
            next: { revalidate: 5 },
            headers: serviceToken ? { 'x-hanasand-service-token': serviceToken } : undefined,
            signal: AbortSignal.timeout(5_000),
        })
        if (!response.ok) return []
        const payload = await response.json() as { actorProfiles?: unknown[] }
        return (payload.actorProfiles || []).map(profile => persistedProfile(profile)).filter((profile): profile is PersistedActorProfile => Boolean(profile))
    } catch {
        return []
    }
}

async function getPersistedProfileUpdates(): Promise<TiProfileUpdate[]> {
    try {
        const target = new URL('/v1/intel/evidence-deltas', tiScraperApiBase())
        target.searchParams.set('tenantId', 'default')
        target.searchParams.set('q', 'actor_profile')
        target.searchParams.set('limit', '100')
        const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
        const response = await fetch(target, { cache: 'force-cache', next: { revalidate: 5 }, headers: serviceToken ? { 'x-hanasand-service-token': serviceToken } : undefined, signal: AbortSignal.timeout(5_000) })
        if (!response.ok) return []
        const payload = await response.json() as { evidenceDeltas?: unknown[] }
        return (payload.evidenceDeltas || []).map(profileUpdate).filter((update): update is TiProfileUpdate => Boolean(update))
    } catch {
        return []
    }
}

function profileUpdate(value: unknown): TiProfileUpdate | undefined {
    if (!value || typeof value !== 'object') return undefined
    const record = value as Record<string, unknown>
    const id = stringValue(record.id)
    const actorId = stringValue(record.subjectId)
    const observedAt = stringValue(record.observedAt)
    if (!id || !actorId || !observedAt || record.subjectType !== 'actor_profile') return undefined
    const metadata = record.metadata && typeof record.metadata === 'object' ? record.metadata as Record<string, unknown> : {}
    const aliases = listValue(metadata.aliasesAdded).map(stringValue).filter(Boolean)
    const fields = Object.keys(metadata.characterization && typeof metadata.characterization === 'object' ? metadata.characterization as object : {})
    const changedFields = [...new Set([...aliases.map(alias => `alias: ${alias}`), ...fields])]
    return { id, actorId, observedAt, sourceId: stringValue(record.sourceId), captureIds: listValue(record.captureIds).map(stringValue).filter(Boolean), kind: stringValue(record.kind, 'updated'), changedFields, summary: changedFields.length ? changedFields.join(' · ') : 'New retained evidence linked to this profile.' }
}

function persistedProfile(value: unknown): PersistedActorProfile | undefined {
    if (!value || typeof value !== 'object') return undefined
    const profile = value as Record<string, unknown>
    const id = stringValue(profile.id)
    const canonicalName = stringValue(profile.canonicalName, profile.name)
    if (!id || !canonicalName) return undefined
    return {
        id,
        canonicalName,
        aliases: listValue(profile.aliases).map(stringValue).filter(Boolean),
        confidence: numberValue(profile.confidence),
        firstSeenAt: stringValue(profile.firstSeenAt),
        lastSeenAt: stringValue(profile.lastSeenAt, profile.updatedAt),
        updatedAt: stringValue(profile.updatedAt, profile.lastSeenAt),
        sourceIds: listValue(profile.sourceIds).map(stringValue).filter(Boolean),
        captureIds: listValue(profile.captureIds).map(stringValue).filter(Boolean),
        evidenceCount: numberValue(profile.evidenceCount),
        actorType: stringValue(profile.actorType, 'actor'),
    }
}

function passiveOverview(profiles: PersistedActorProfile[], updates: TiProfileUpdate[], status?: PersistedEnrichmentStatus): TiEnrichmentOverview {
    const actors = new Map<string, TiEnrichedActor>()
    for (const profile of profiles) {
        const links = profile.sourceIds.map(sourceId => ({ name: sourceId, url: '' }))
        actors.set(profile.id, {
            id: profile.id,
            name: profile.canonicalName,
            aliases: profile.aliases,
            status: 'ready',
            confidence: profile.confidence,
            lastUpdatedAt: profile.updatedAt || profile.lastSeenAt,
            nextRefreshAt: profile.lastSeenAt,
            changedFields: [],
            sourceLinks: uniqueSources(links),
            automationEvidence: profile.captureIds,
            plannedWork: [],
            refreshCount: profile.evidenceCount,
        })
    }
    const activity = updates.map((update) => {
        const actor = actors.get(update.actorId)
        const source = update.sourceId || 'retained evidence'
        return {
            id: update.id,
            actorId: update.actorId,
            actorName: actor?.name || update.actorId,
            happenedAt: update.observedAt,
            title: update.summary,
            detail: update.changedFields.join(' · ') || 'Profile evidence updated.',
            source,
            tone: 'ok' as const,
        }
    })
    const updatedLastHour = activity.filter((event) => Date.now() - Date.parse(event.happenedAt) <= 3_600_000).length
    return {
        generatedAt: new Date().toISOString(),
        worker: {
            state: status?.worker.state ?? 'unavailable',
            mode: 'automated monitoring',
            intervalSeconds: 300,
            batchSize: profiles.length,
            lastSweepStartedAt: status?.latestRun?.finishedAt || null,
            lastSweepFinishedAt: status?.worker.lastSuccessfulRunAt || null,
            lastError: status?.worker.currentFailure || null,
            cursor: 0,
            lastRunId: status?.latestRun?.id || null,
            lastRunAt: status?.worker.lastRunAt || null,
            lastSuccessfulRunAt: status?.worker.lastSuccessfulRunAt || null,
            snapshotFresh: status?.worker.snapshotFresh ?? false,
        },
        updatedActors: [...actors.values()],
        queuedActors: [],
        activity,
        updates,
        auditLog: [],
        stats: {
            updatedLastHour,
            queued: 0,
            auditedEvents: 0,
            automaticCoverage: profiles.length,
            totalRefreshes: activity.length,
            profilesProcessed: status?.latestRun?.actorCount ?? 0,
            profilesChanged: status?.latestRun?.changedFieldCount ?? 0,
            sourceRecords: status?.latestRun?.sourceCount ?? 0,
            evidenceRecords: status?.latestRun?.evidenceCount ?? 0,
            failures: status?.latestRun?.failureCount ?? 0,
        },
    }
}

function uniqueSources(sources: Array<{ name: string, url: string }>) {
    return [...new Map(sources.map(source => [`${source.name}:${source.url}`, source])).values()]
}

function stringValue(...values: unknown[]) {
    return values.map(value => typeof value === 'string' ? value.trim() : '').find(Boolean) || ''
}

function listValue(value: unknown) {
    return Array.isArray(value) ? value : []
}

function numberValue(...values: unknown[]) {
    for (const value of values) {
        const number = Number(value)
        if (Number.isFinite(number) && number >= 0) return number
    }
    return 0
}

export async function getTiActorById(id: string) {
    const overview = await getTiEnrichmentOverview()
    return [...overview.updatedActors, ...overview.queuedActors].find(actor => actor.id === id) || null
}
