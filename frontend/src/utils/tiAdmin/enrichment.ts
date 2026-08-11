import { getTiAdminOverview } from '@/utils/tiAdmin/ops'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import config from '@/config'
import { cookies } from 'next/headers'

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
        state: 'warming' | 'running' | 'idle' | 'ready' | 'error' | 'unavailable'
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
    updates: TiProfileUpdate[]
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
    const [overview, profiles, updates, audit] = await Promise.all([
        getTiAdminOverview(null, { limit: 50, includeCandidates: true }),
        getPersistedActorProfiles(),
        getPersistedProfileUpdates(),
        getPersistedAuditLog(),
    ])
    return passiveOverview(overview, profiles, updates, audit.events, audit.available)
}

async function getPersistedAuditLog(): Promise<{ events: TiManagementAuditEvent[], available: boolean }> {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('access_token')?.value
        const id = cookieStore.get('id')?.value
        if (!token || !id) return { events: [], available: false }
        const response = await fetch(`${config.url.api}/admin/audit-events?limit=200`, {
            headers: { Authorization: `Bearer ${decodeURIComponent(token)}`, id },
            cache: 'no-store',
            signal: AbortSignal.timeout(5_000),
        })
        if (!response.ok) return { events: [], available: false }
        const payload = await response.json() as { events?: unknown[] }
        return { events: (payload.events || []).map(auditEvent).filter((event): event is TiManagementAuditEvent => Boolean(event)), available: true }
    } catch {
        return { events: [], available: false }
    }
}

function auditEvent(value: unknown): TiManagementAuditEvent | undefined {
    if (!value || typeof value !== 'object') return undefined
    const event = value as Record<string, unknown>
    const detail = event.detail && typeof event.detail === 'object' ? event.detail as Record<string, unknown> : {}
    const action = stringValue(event.action_type, detail.actionType, 'audit event')
    const target = stringValue(event.target_name, event.target_id, event.target_type, event.organization_name, 'system')
    const happenedAt = stringValue(event.created_at)
    if (!happenedAt) return undefined
    return {
        id: stringValue(event.id, `${happenedAt}:${action}:${target}`),
        happenedAt,
        actor: stringValue(event.actor_name, event.actor_id, 'system'),
        action,
        target,
        result: stringValue(event.outcome, 'unknown'),
        detail: stringValue(event.reason, event.source, detail.source, detail.service, 'Recorded management event.'),
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

function passiveOverview(overview: Awaited<ReturnType<typeof getTiAdminOverview>>, profiles: PersistedActorProfile[], updates: TiProfileUpdate[], auditLog: TiManagementAuditEvent[], auditAvailable: boolean): TiEnrichmentOverview {
    const actors = new Map<string, TiEnrichedActor>()
    const capturesById = new Map(overview.captures.map(capture => [capture.id, capture]))
    const profileByCaptureId = new Map(profiles.flatMap(profile => profile.captureIds.map(captureId => [captureId, profile] as const)))
    for (const profile of profiles) {
        const links = profile.sourceIds.map(sourceId => {
            const capture = profile.captureIds.map(captureId => capturesById.get(captureId)).find(capture => capture?.sourceId === sourceId)
            return capture ? { name: capture.sourceName, url: capture.pageUrl } : undefined
        }).filter((source): source is { name: string, url: string } => Boolean(source))
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
    const activity = overview.captures.map((capture) => {
        const profile = profileByCaptureId.get(capture.id)
        const actorName = profile?.canonicalName || (capture.actor && capture.actor !== 'Not extracted' ? capture.actor : capture.sourceName)
        const actorId = profile?.id || actorName.toLowerCase().replace(/\s+/g, '-')
        const existing = [...actors.values()].find(actor => actor.name.toLowerCase() === actorName.toLowerCase()) || actors.get(actorId)
        if (existing) {
            existing.lastUpdatedAt = [existing.lastUpdatedAt, capture.capturedAt].sort().at(-1) || existing.lastUpdatedAt
            existing.refreshCount = (existing.refreshCount || 0) + 1
            existing.automationEvidence.push(capture.resultSummary || 'Captured by automated source collection.')
            if (capture.pageUrl && !existing.sourceLinks.some(source => source.name === capture.sourceName && source.url === capture.pageUrl)) existing.sourceLinks.push({ name: capture.sourceName, url: capture.pageUrl })
        } else {
            actors.set(actorId, {
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
        }
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
            state: auditAvailable ? 'ready' : 'unavailable',
            mode: 'automated monitoring',
            intervalSeconds: 300,
            batchSize: overview.sources.length,
            lastSweepStartedAt: latest?.startedAt || null,
            lastSweepFinishedAt: latest?.finishedAt || latest?.startedAt || null,
            lastError: auditAvailable ? null : 'Audit API unavailable',
            cursor: 0,
        },
        updatedActors: [...actors.values()],
        queuedActors: [],
        activity,
        updates,
        auditLog,
        stats: {
            updatedLastHour,
            queued: 0,
            auditedEvents: auditLog.length,
            automaticCoverage: overview.sources.length,
            totalRefreshes: activity.length,
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
