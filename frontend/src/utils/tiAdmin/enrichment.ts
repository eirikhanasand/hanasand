import config from '@/config'

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
}

type ApiWarmActor = {
    actor: string
    status?: TiEnrichmentStatus
    confidence?: number
    aliases?: string[]
    changedFields?: string[]
    sourceLinks?: Array<{ name: string, url: string }>
    automationEvidence?: string[]
    plannedWork?: string[]
    refreshedAt?: string
    nextRefreshAt?: string
    refreshCount?: number
}

type ApiQueuedActor = Omit<ApiWarmActor, 'actor' | 'refreshedAt'> & {
    id?: string
    name?: string
    lastUpdatedAt?: string
}

type ApiOverview = Omit<TiEnrichmentOverview, 'updatedActors' | 'queuedActors'> & {
    updatedActors?: ApiWarmActor[]
    queuedActors?: ApiQueuedActor[]
}

export async function getTiEnrichmentOverview(): Promise<TiEnrichmentOverview> {
    try {
        const response = await fetch(`${config.url.api}/ti/enrichment`, {
            cache: 'no-store',
            next: { revalidate: 0 },
        })
        if (!response.ok) {
            return unavailableOverview(`API returned ${response.status}`)
        }

        const overview = await response.json() as ApiOverview
        return {
            generatedAt: overview.generatedAt || new Date().toISOString(),
            worker: overview.worker || unavailableOverview('Missing worker state').worker,
            updatedActors: (overview.updatedActors || []).map(mapUpdatedActor),
            queuedActors: (overview.queuedActors || []).map(mapQueuedActor),
            activity: overview.activity || [],
            auditLog: overview.auditLog || [],
            stats: {
                updatedLastHour: overview.stats?.updatedLastHour ?? 0,
                queued: overview.stats?.queued ?? 0,
                auditedEvents: overview.stats?.auditedEvents ?? 0,
                automaticCoverage: overview.stats?.automaticCoverage ?? 0,
                totalRefreshes: overview.stats?.totalRefreshes ?? 0,
            },
        }
    } catch (error) {
        return unavailableOverview(error instanceof Error ? error.message : String(error))
    }
}

export async function getTiActorById(id: string) {
    const overview = await getTiEnrichmentOverview()
    return [...overview.updatedActors, ...overview.queuedActors].find(actor => actor.id === id) || null
}

function mapUpdatedActor(actor: ApiWarmActor): TiEnrichedActor {
    const id = actor.actor.toLowerCase().replace(/\s+/g, '-')
    return {
        id,
        name: titleCaseWords(actor.actor),
        aliases: actor.aliases || [],
        status: actor.status === 'queued' ? 'queued' : 'ready',
        confidence: actor.confidence ?? 0,
        lastUpdatedAt: actor.refreshedAt || new Date(0).toISOString(),
        nextRefreshAt: actor.nextRefreshAt || new Date().toISOString(),
        changedFields: actor.changedFields || [],
        sourceLinks: actor.sourceLinks || [],
        automationEvidence: actor.automationEvidence || [],
        plannedWork: actor.plannedWork || [],
        refreshCount: actor.refreshCount,
    }
}

function mapQueuedActor(actor: ApiQueuedActor): TiEnrichedActor {
    const rawName = actor.name || actor.id || 'Queued actor'
    const id = (actor.id || rawName).toLowerCase().replace(/\s+/g, '-')
    return {
        id,
        name: rawName,
        aliases: actor.aliases || [],
        status: 'queued',
        confidence: actor.confidence ?? 0,
        lastUpdatedAt: actor.lastUpdatedAt || new Date().toISOString(),
        nextRefreshAt: actor.nextRefreshAt || new Date().toISOString(),
        changedFields: actor.changedFields || [],
        sourceLinks: actor.sourceLinks || [],
        automationEvidence: actor.automationEvidence || [],
        plannedWork: actor.plannedWork || [],
        refreshCount: actor.refreshCount,
    }
}

function unavailableOverview(reason: string): TiEnrichmentOverview {
    const now = new Date().toISOString()
    return {
        generatedAt: now,
        worker: {
            state: 'unavailable',
            mode: 'API actor refresh worker unavailable',
            intervalSeconds: 60,
            batchSize: 0,
            lastSweepStartedAt: null,
            lastSweepFinishedAt: null,
            lastError: reason,
            cursor: 0,
        },
        updatedActors: [],
        queuedActors: [],
        activity: [{
            id: 'ti-worker-unavailable',
            actorId: 'system',
            actorName: 'Actor refresh worker',
            happenedAt: now,
            title: 'Actor enrichment state unavailable',
            detail: `The dashboard could not read live worker state from the API: ${reason}.`,
            source: 'frontend enrichment dashboard',
            tone: 'bad',
        }],
        auditLog: [{
            id: 'ti-worker-unavailable',
            happenedAt: now,
            actor: 'admin-console',
            action: 'worker.state.read',
            target: 'api:/ti/enrichment',
            result: 'unavailable',
            detail: reason,
        }],
        stats: {
            updatedLastHour: 0,
            queued: 0,
            auditedEvents: 1,
            automaticCoverage: 0,
            totalRefreshes: 0,
        },
    }
}

function titleCaseWords(value: string) {
    return value
        .split(/[\s-]+/)
        .filter(Boolean)
        .map(word => word.toUpperCase().startsWith('APT') ? word.toUpperCase() : `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
        .join(' ')
}
