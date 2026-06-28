import { createHash } from 'node:crypto'
import run from '#db'
import {
    automaticThreatActorWarmList,
    discoverThreatActorProfile,
    type TiActivity,
    type TiDataset,
    type TiSearchResponse,
    type TiSource,
    type TiTarget,
    type TiTtp,
} from './search.ts'

type PipelineState = 'idle' | 'running' | 'failed'

interface DiscoveryRecord {
    id: string
    actorKey: string
    actorName: string
    kind: 'activity' | 'source' | 'target' | 'ttp' | 'dataset'
    title: string
    detail: string
    sourceUrl: string
    sourceName: string
    payload: string
}

let pipelineState: PipelineState = 'idle'
let pipelineCursor = 0
let lastStartedAt: string | null = null
let lastFinishedAt: string | null = null
let lastError: string | null = null

export async function runDueThreatIntelPipeline(batchSize = 3) {
    if (pipelineState === 'running') return []
    pipelineState = 'running'
    lastStartedAt = new Date().toISOString()
    lastError = null

    try {
        const actors = automaticThreatActorWarmList()
        const selected = selectActors(actors, batchSize)
        const results = []
        for (const actor of selected) {
            results.push(await enrichAndPublishActor(actor))
        }
        lastFinishedAt = new Date().toISOString()
        pipelineState = 'idle'
        return results
    } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        pipelineState = 'failed'
        throw error
    }
}

export async function getThreatIntelPipelineOverview() {
    const [runs, snapshots, discoveries, counts] = await Promise.all([
        run(`
            SELECT id, actor_key, actor_name, status, mode, started_at, finished_at, changed_fields,
                   discovered_items, published_items, error, metadata
            FROM ti_actor_enrichment_runs
            ORDER BY started_at DESC
            LIMIT 25
        `),
        run(`
            SELECT actor_key, actor_name, source_count, activity_count, target_count, ttp_count, updated_at
            FROM ti_actor_profile_snapshots
            ORDER BY updated_at DESC
            LIMIT 25
        `),
        run(`
            SELECT id, actor_key, actor_name, kind, title, detail, source_url, source_name,
                   first_seen_at, last_seen_at, published_at
            FROM ti_actor_discoveries
            ORDER BY published_at DESC NULLS LAST, last_seen_at DESC
            LIMIT 50
        `),
        run(`
            SELECT
                COUNT(*)::int AS snapshots,
                COALESCE(SUM(source_count), 0)::int AS sources,
                COALESCE(SUM(activity_count), 0)::int AS activity,
                (SELECT COUNT(*)::int FROM ti_actor_discoveries WHERE published_at >= NOW() - INTERVAL '24 hours') AS published_24h,
                (SELECT COUNT(*)::int FROM ti_actor_enrichment_runs WHERE started_at >= NOW() - INTERVAL '24 hours') AS runs_24h
            FROM ti_actor_profile_snapshots
        `),
    ])

    const actors = automaticThreatActorWarmList()
    return {
        worker: {
            state: pipelineState,
            lastStartedAt,
            lastFinishedAt,
            lastError,
            intervalSeconds: 60,
            mode: 'autonomous_discovery_publish',
        },
        queue: {
            totalActors: actors.length,
            cursor: pipelineCursor,
            nextActors: selectPreviewActors(actors, 8),
        },
        stats: counts.rows[0] ?? {
            snapshots: 0,
            sources: 0,
            activity: 0,
            published_24h: 0,
            runs_24h: 0,
        },
        latestRuns: runs.rows,
        latestSnapshots: snapshots.rows,
        latestDiscoveries: discoveries.rows,
    }
}

async function enrichAndPublishActor(actor: string) {
    const actorKey = normalizeActorKey(actor)
    const actorName = titleCaseActor(actor)
    const started = await run(`
        INSERT INTO ti_actor_enrichment_runs (actor_key, actor_name, status, mode, metadata)
        VALUES ($1, $2, 'running', 'autonomous', $3::jsonb)
        RETURNING id
    `, [actorKey, actorName, JSON.stringify({ source: 'cron', actor })])
    const runId = String(started.rows[0].id)

    try {
        const profile = await discoverThreatActorProfile(actor)
        const previous = await run('SELECT profile, profile_hash FROM ti_actor_profile_snapshots WHERE actor_key = $1', [actorKey])
        const profileHash = stableHash(profile)
        const changedFields = changedProfileFields(previous.rows[0]?.profile as Partial<TiSearchResponse> | undefined, profile)
        const discoveries = extractDiscoveries(actorKey, actorName, profile)
        let publishedItems = 0

        for (const discovery of discoveries) {
            const existing = await run('SELECT id FROM ti_actor_discoveries WHERE id = $1', [discovery.id])
            const isNew = existing.rows.length === 0
            if (isNew) publishedItems += 1
            await run(`
                INSERT INTO ti_actor_discoveries (
                    id, actor_key, actor_name, kind, title, detail, source_url, source_name,
                    published_at, profile_run_id, payload
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                    last_seen_at = NOW(),
                    profile_run_id = EXCLUDED.profile_run_id,
                    payload = EXCLUDED.payload
            `, [
                discovery.id,
                discovery.actorKey,
                discovery.actorName,
                discovery.kind,
                discovery.title,
                discovery.detail,
                discovery.sourceUrl,
                discovery.sourceName,
                runId,
                discovery.payload,
            ])
        }

        await run(`
            INSERT INTO ti_actor_profile_snapshots (
                actor_key, actor_name, profile, profile_hash, source_count, activity_count,
                target_count, ttp_count, updated_at, last_run_id
            )
            VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, NOW(), $9)
            ON CONFLICT (actor_key) DO UPDATE SET
                actor_name = EXCLUDED.actor_name,
                profile = EXCLUDED.profile,
                profile_hash = EXCLUDED.profile_hash,
                source_count = EXCLUDED.source_count,
                activity_count = EXCLUDED.activity_count,
                target_count = EXCLUDED.target_count,
                ttp_count = EXCLUDED.ttp_count,
                updated_at = NOW(),
                last_run_id = EXCLUDED.last_run_id
        `, [
            actorKey,
            actorName,
            JSON.stringify(profile),
            profileHash,
            profile.sources.length,
            profile.recentActivity.length,
            profile.targets.length,
            profile.ttps.length,
            runId,
        ])

        await run(`
            UPDATE ti_actor_enrichment_runs
            SET status = 'succeeded',
                finished_at = NOW(),
                changed_fields = $2,
                discovered_items = $3,
                published_items = $4,
                metadata = $5::jsonb
            WHERE id = $1
        `, [
            runId,
            changedFields,
            discoveries.length,
            publishedItems,
            JSON.stringify({
                profileHash,
                previousHash: previous.rows[0]?.profile_hash ?? null,
                mode: profile.mode,
                status: profile.status,
                sourceCount: profile.sources.length,
                activityCount: profile.recentActivity.length,
            }),
        ])

        return { actor, actorKey, runId, status: 'succeeded', changedFields, discoveredItems: discoveries.length, publishedItems }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await run(`
            UPDATE ti_actor_enrichment_runs
            SET status = 'failed', finished_at = NOW(), error = $2
            WHERE id = $1
        `, [runId, message])
        throw error
    }
}

function selectActors(actors: string[], batchSize: number) {
    const selected: string[] = []
    const limit = Math.max(1, Math.min(batchSize, actors.length))
    for (let offset = 0; offset < limit; offset += 1) {
        selected.push(actors[(pipelineCursor + offset) % actors.length]!)
    }
    pipelineCursor = (pipelineCursor + selected.length) % actors.length
    return selected
}

function selectPreviewActors(actors: string[], count: number) {
    return Array.from({ length: Math.min(count, actors.length) }, (_, offset) => actors[(pipelineCursor + offset) % actors.length]!)
}

function extractDiscoveries(actorKey: string, actorName: string, profile: TiSearchResponse): DiscoveryRecord[] {
    return [
        ...profile.recentActivity.map(item => activityDiscovery(actorKey, actorName, item)),
        ...profile.sources.map(item => sourceDiscovery(actorKey, actorName, item)),
        ...profile.targets.map(item => targetDiscovery(actorKey, actorName, item)),
        ...profile.ttps.map(item => ttpDiscovery(actorKey, actorName, item)),
        ...profile.datasets.map(item => datasetDiscovery(actorKey, actorName, item)),
    ]
}

function activityDiscovery(actorKey: string, actorName: string, item: TiActivity): DiscoveryRecord {
    return discovery(actorKey, actorName, 'activity', item.title, item.detail, item.url ?? '', item.sourceIds[0] ?? '', item)
}

function sourceDiscovery(actorKey: string, actorName: string, item: TiSource): DiscoveryRecord {
    return discovery(actorKey, actorName, 'source', item.name, item.provenance, item.url ?? item.provenance, item.name, item)
}

function targetDiscovery(actorKey: string, actorName: string, item: TiTarget): DiscoveryRecord {
    return discovery(actorKey, actorName, 'target', item.sector, item.rationale, '', '', item)
}

function ttpDiscovery(actorKey: string, actorName: string, item: TiTtp): DiscoveryRecord {
    return discovery(actorKey, actorName, 'ttp', item.name, item.detail, '', item.attackId ?? '', item)
}

function datasetDiscovery(actorKey: string, actorName: string, item: TiDataset): DiscoveryRecord {
    return discovery(actorKey, actorName, 'dataset', item.name, item.coverage, item.url ?? '', item.type, item)
}

function discovery(
    actorKey: string,
    actorName: string,
    kind: DiscoveryRecord['kind'],
    title: string,
    detail: string,
    sourceUrl: string,
    sourceName: string,
    payload: unknown,
): DiscoveryRecord {
    const normalizedTitle = title.trim() || `${kind} update`
    const normalizedDetail = detail.trim()
    return {
        id: stableHash([actorKey, kind, normalizedTitle.toLowerCase(), normalizedDetail.toLowerCase(), sourceUrl].join('\n')),
        actorKey,
        actorName,
        kind,
        title: normalizedTitle,
        detail: normalizedDetail,
        sourceUrl: sourceUrl.trim(),
        sourceName: sourceName.trim(),
        payload: JSON.stringify(payload),
    }
}

function changedProfileFields(previous: Partial<TiSearchResponse> | undefined, current: TiSearchResponse) {
    if (!previous) return ['summary', 'aliases', 'recentActivity', 'targets', 'ttps', 'sources', 'datasets']
    const fields: Array<keyof TiSearchResponse> = ['summary', 'aliases', 'recentActivity', 'targets', 'ttps', 'sources', 'datasets']
    return fields.filter(field => stableJson(previous[field]) !== stableJson(current[field]))
}

function stableHash(value: unknown) {
    return createHash('sha256').update(stableJson(value)).digest('hex')
}

function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
    if (value && typeof value === 'object') {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
            .join(',')}}`
    }
    return JSON.stringify(value)
}

function normalizeActorKey(actor: string) {
    return actor.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function titleCaseActor(actor: string) {
    if (/^apt\d+$/i.test(actor.trim())) return actor.trim().toUpperCase()
    return actor.trim().replace(/\b\w/g, char => char.toUpperCase())
}
