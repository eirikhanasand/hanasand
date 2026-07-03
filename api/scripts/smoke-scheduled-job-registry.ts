import assert from 'node:assert/strict'
import { listUnifiedScheduledJobs, updateManagedCronJob } from '../src/utils/systemCron.ts'

const previousTiBase = process.env.TI_SCRAPER_API_BASE
delete process.env.TI_SCRAPER_API_BASE

const jobs = await listUnifiedScheduledJobs()
restoreTiBase()

const byId = new Map(jobs.map(job => [job.id, job]))

assert.ok(byId.has('forgejo-standby-sync'), 'Forgejo standby sync should remain registered.')
assert.ok(byId.has('forgejo-doctor'), 'Forgejo doctor should remain registered.')
assert.ok(byId.has('db-dashboard-monitor'), 'Database dashboard monitor should be registered.')
assert.ok(byId.has('ti-public-canary-collection'), 'TI collection loop should be registered even when TI backend is unavailable.')
assert.ok(byId.has('ti-exposure-queue-collection'), 'Exposure queue collection should be registered.')
assert.ok(byId.has('ti-exposure-parser'), 'Exposure parser should be registered.')
assert.ok(byId.has('ti-dwm-alert-generation'), 'DWM alert generation should be registered.')
assert.ok(byId.has('api-ti-autonomous-pipeline'), 'API autonomous TI pipeline should be registered.')
assert.ok(byId.has('api-agent-automations'), 'Agent automation dispatcher should be registered.')
assert.ok(byId.has('api-vulnerability-scanner'), 'Vulnerability image scanner should be registered.')

assert.equal(byId.get('ti-public-canary-collection')?.category, 'TI / Exposure')
assert.equal(byId.get('ti-exposure-queue-collection')?.controlMode, 'observable_only')
assert.equal(byId.get('ti-dwm-alert-generation')?.controlMode, 'run_only')
assert.ok(byId.get('forgejo-standby-sync')?.controls.includes('edit_schedule'), 'Forgejo schedule editing should stay available.')
assert.equal(byId.get('db-dashboard-monitor')?.category, 'Backup/Database')
assert.equal(byId.get('db-dashboard-monitor')?.service, 'database-monitor')
assert.equal(byId.get('db-dashboard-monitor')?.schedule, '* * * * *')
assert.ok(byId.get('db-dashboard-monitor')?.controls.includes('edit_schedule'), 'Database monitor schedule editing should stay available.')
assert.ok(byId.get('ti-public-canary-collection')?.controls.length, 'TI collection should expose safe controls.')
assert.ok(byId.get('ti-public-canary-collection')?.controls.includes('run_now'), 'TI collection should expose safe run-now control.')
assert.equal(byId.get('api-vulnerability-scanner')?.controlMode, 'safe_control')
assert.ok(byId.get('api-vulnerability-scanner')?.controls.includes('run_now'), 'Vulnerability scanner should expose manual run control.')
assert.equal(byId.get('api-vulnerability-scanner')?.status, 'blocked', 'A never-run vulnerability scanner should be visible as blocked/stale.')
assert.match(byId.get('api-vulnerability-scanner')?.lastError || '', /No vulnerability scan has completed|Docker|Scout|socket|Previous vulnerability scan/, 'Vulnerability scanner should expose the stale reason or exact scanner blocker.')

for (const job of jobs) {
    assert.ok(job.resourceUsage, `${job.id} should include resource telemetry.`)
    assert.ok(job.costEstimate, `${job.id} should include cost telemetry.`)
    assert.equal(job.costEstimate.electricityUsdPerKwh, 0.05)
}

const controlRequests: Array<{ path: string, body: Record<string, unknown> }> = []
const now = '2026-07-03T10:00:00.000Z'
const tiMock = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
        const url = new URL(request.url)
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({})) as Record<string, unknown>
            controlRequests.push({ path: url.pathname, body })
            if (url.pathname === '/v1/ops/collection-scheduler') return json(tiSchedulerPayload())
            if (url.pathname === '/v1/dwm/alerts/rebuild') return json({ ok: true, rebuiltAt: now })
            return json({ error: 'not found' }, 404)
        }

        if (url.pathname === '/v1/ops/collection-scheduler') return json(tiSchedulerPayload())
        if (url.pathname === '/v1/dwm/exposure-queue') return json({
            status: 'live',
            scheduler: { cadenceSeconds: 300 },
            freshness: {
                latestCollectedAt: '2026-07-03T09:59:30.000Z',
                latestClaimAt: '2026-07-03T09:59:00.000Z',
                nextExpectedCollection: '2026-07-03T10:04:30.000Z',
            },
            counts: { visible: 4, needsReview: 1 },
        })
        if (url.pathname === '/v1/dwm/exposure-parser/health') return json({
            status: 'ready',
            generatedAt: '2026-07-03T10:00:00.000Z',
            latencyMs: 42,
        })
        if (url.pathname === '/v1/dwm/alerts/generation-readiness') return json({
            generatedAt: '2026-07-03T10:00:00.000Z',
            blockers: [],
            candidateCount: 3,
            latestEvidenceAt: '2026-07-03T09:58:00.000Z',
        })
        if (url.pathname === '/v1/ops/resource-snapshot') return json({
            service: 'ti-scraper',
            memory: { rssMb: 321, heapUsedMb: 123 },
            queue: { queued: 7 },
            workers: [],
        })
        if (url.pathname === '/v1/dwm/source-packs') return json({
            readiness: { ready: true, blockers: [] },
            lastRun: { updatedAt: '2026-07-03T09:57:00.000Z' },
            counts: { candidateCount: 5, packCount: 2 },
            generatedAt: '2026-07-03T10:00:00.000Z',
        })
        if (url.pathname === '/v1/frontier') return json({ queued: 7, tasks: [{ id: 'task_public_ti' }] })
        return json({ error: 'not found' }, 404)
    },
})

process.env.TI_SCRAPER_API_BASE = `http://127.0.0.1:${tiMock.port}`
try {
    const liveJobs = await listUnifiedScheduledJobs()
    const liveById = new Map(liveJobs.map(job => [job.id, job]))

    assert.equal(liveById.get('ti-public-canary-collection')?.status, 'running')
    assert.equal(liveById.get('ti-public-canary-collection')?.lastRunAt, '2026-07-03T09:59:00.000Z')
    assert.equal(liveById.get('ti-public-canary-collection')?.nextRunAt, '2026-07-03T10:04:00.000Z')
    assert.ok(liveById.get('ti-public-canary-collection')?.controls.includes('run_now'), 'Live TI collection should expose run-now control.')
    assert.equal(liveById.get('ti-exposure-queue-collection')?.logExcerpt, '4 visible claims, 1 need review.')
    assert.equal(liveById.get('ti-exposure-parser')?.averageRuntimeMs, 42)
    assert.equal(liveById.get('ti-dwm-alert-generation')?.controlMode, 'run_only')
    assert.equal(liveById.get('ti-frontier-queue')?.resourceUsage.queueDepth, 7)
    assert.equal(liveById.get('ti-public-canary-collection')?.resourceUsage.memoryRssMb, 321)

    await updateManagedCronJob('ti-public-canary-collection', { enabled: false })
    await updateManagedCronJob('ti-public-canary-collection', { enabled: true })
    await updateManagedCronJob('ti-public-canary-collection', { action: 'run_now' })
    await updateManagedCronJob('ti-dwm-alert-generation', { action: 'run_now' })

    assert.deepEqual(controlRequests.map(request => [request.path, request.body.action]), [
        ['/v1/ops/collection-scheduler', 'pause'],
        ['/v1/ops/collection-scheduler', 'resume'],
        ['/v1/ops/collection-scheduler', 'run_now'],
        ['/v1/dwm/alerts/rebuild', undefined],
    ])
} finally {
    restoreTiBase()
    tiMock.stop(true)
}

console.log(`Scheduled job registry smoke passed with ${jobs.length} offline jobs and live TI scraper mapping.`)

function tiSchedulerPayload() {
    return {
        schemaVersion: 'ti.collection_scheduler_status.v1',
        generatedAt: now,
        scheduler: {
            enabled: true,
            running: true,
            intervalSeconds: 300,
            lastRun: {
                id: 'run_public_canary_latest',
                status: 'completed',
                captureCount: 12,
                failedTaskCount: 0,
                createdAt: '2026-07-03T09:59:00.000Z',
                updatedAt: '2026-07-03T09:59:45.000Z',
            },
            lastSuccessfulRun: { updatedAt: '2026-07-03T09:59:45.000Z' },
            nextRunAt: '2026-07-03T10:04:00.000Z',
        },
        parser: { aiEndpointConfigured: true },
        failures: [],
    }
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

function restoreTiBase() {
    if (previousTiBase === undefined) {
        delete process.env.TI_SCRAPER_API_BASE
    } else {
        process.env.TI_SCRAPER_API_BASE = previousTiBase
    }
}
