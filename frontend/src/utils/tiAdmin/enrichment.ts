import { getTiAdminOverview } from '@/utils/tiAdmin/ops'

export type TiEnrichmentStatus = 'ready' | 'running' | 'queued' | 'review'

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
        state: 'warming' | 'running' | 'idle' | 'error' | 'unavailable'
        mode: string
        intervalSeconds: number
        batchSize: number
        lastSweepStartedAt: string | null
        lastSweepFinishedAt: string | null
        lastError: string | null
        cursor: number
    }
    updatedActors: TiEnrichedActor[]
    queuedActors: TiEnrichedActor[]
    activity: TiActivityEvent[]
    auditLog: TiManagementAuditEvent[]
    stats: {
        updatedLastHour: number
        queued: number
        auditedEvents: number
        automaticCoverage: number
        totalRefreshes: number
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

export async function getTiEnrichmentOverview(): Promise<TiEnrichmentOverview> {
    const overview = await getTiAdminOverview(null, { limit: 50, includeCandidates: true })
    return passiveOverview(overview)
}

function passiveOverview(overview: Awaited<ReturnType<typeof getTiAdminOverview>>): TiEnrichmentOverview {
    const actors = new Map<string, TiEnrichedActor>()
    const activity = overview.captures.map((capture) => {
        const actorName = capture.actor || capture.sourceName
        const actorId = actorName.toLowerCase().replace(/\s+/g, '-')
        const existing = actors.get(actorId)
        actors.set(actorId, existing || {
            id: actorId,
            name: actorName,
            aliases: [],
            status: 'ready',
            confidence: 1,
            lastUpdatedAt: capture.capturedAt,
            nextRefreshAt: capture.capturedAt,
            changedFields: [],
            sourceLinks: capture.pageUrl ? [{ name: capture.sourceName, url: capture.pageUrl }] : [],
            automationEvidence: [capture.resultSummary || 'Captured by automated source collection.'],
            plannedWork: [],
            refreshCount: 1,
        })
        return {
            id: capture.id,
            actorId,
            actorName,
            happenedAt: capture.capturedAt,
            title: capture.title || 'New intelligence captured',
            detail: capture.resultSummary || `${capture.sourceName} produced a retained capture.`,
            source: capture.sourceName,
            tone: 'ok' as const,
        }
    })
    const latest = overview.runs[0]
    const updatedLastHour = activity.filter((event) => Date.now() - Date.parse(event.happenedAt) <= 3_600_000).length
    return {
        generatedAt: new Date().toISOString(),
        worker: {
            state: 'idle',
            mode: 'automated monitoring',
            intervalSeconds: 300,
            batchSize: overview.sources.length,
            lastSweepStartedAt: latest?.startedAt || null,
            lastSweepFinishedAt: latest?.finishedAt || latest?.startedAt || null,
            lastError: null,
            cursor: 0,
        },
        updatedActors: [...actors.values()],
        queuedActors: [],
        activity,
        auditLog: [],
        stats: {
            updatedLastHour,
            queued: 0,
            auditedEvents: 0,
            automaticCoverage: overview.sources.length,
            totalRefreshes: activity.length,
        },
    }
}

export async function getTiActorById(id: string) {
    const overview = await getTiEnrichmentOverview()
    return [...overview.updatedActors, ...overview.queuedActors].find(actor => actor.id === id) || null
}
