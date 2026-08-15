import run from '#db'
import crypto from 'crypto'
import { activityCountDrop, activityFreshnessMinutes, latencyStatus, type MonitorStatus, watchlistProcessingStatus } from './monitorPolicy.ts'
import { recordMonitorResult } from './record.ts'

const apiBase = process.env.MONITOR_API_BASE || `http://127.0.0.1:${Number(process.env.PORT) || 8081}/api`
const publicApiBase = (process.env.MONITOR_PUBLIC_API_BASE || 'https://api.hanasand.com/api/v1').replace(/\/$/, '')
const webBase = (process.env.MONITOR_WEB_BASE || 'https://hanasand.com').replace(/\/$/, '')
const scraperBase = (process.env.TI_SCRAPER_API_BASE || 'http://ti-scraper:8097').replace(/\/$/, '')
const modelClientBase = (process.env.HANASAND_MODEL_CLIENT_HEALTH_BASE || 'http://hanasand_ai_model_client:18182').replace(/\/$/, '')
const MONITOR_REQUEST_TIMEOUT_MS = 5_000
type CheckResult = string | void | { status: MonitorStatus, message: string }
type MonitorRecorder = typeof recordMonitorResult

export async function check(
    service: string,
    checkName: string,
    fn: () => Promise<CheckResult>,
    latencyThresholds?: { degraded: number, down: number },
    recorder: MonitorRecorder = recordMonitorResult,
) {
    const started = performance.now()
    try {
        const result = await fn()
        const latency = Math.round(performance.now() - started)
        const explicit = typeof result === 'object' && result ? result : undefined
        const status = explicit?.status || latencyStatus(latency, latencyThresholds)
        const message = explicit?.message || (typeof result === 'string' ? result : '')
        await recorder(service, checkName, status, latency, status === 'up' ? message : message || `Response took ${latency} ms.`)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await recorder(service, checkName, 'down', Math.round(performance.now() - started), message)
        console.error(`[synthetic-monitor] ${service}/${checkName}: ${message}`)
    }
}

export async function fetchJson(path: string, options: RequestInit = {}, base = apiBase, timeoutMs = MONITOR_REQUEST_TIMEOUT_MS) {
    const response = await fetch(`${base}${path}`, {
        ...options,
        signal: options.signal || AbortSignal.timeout(timeoutMs),
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
        },
    })

    const text = await response.text()
    let body: unknown
    try {
        body = text ? JSON.parse(text) : null
    } catch {
        body = text
    }
    return { response, body }
}

async function fetchPage(path: string, headers: Record<string, string> = {}) {
    const response = await fetch(`${webBase}${path}`, {
        headers,
        signal: AbortSignal.timeout(MONITOR_REQUEST_TIMEOUT_MS),
    })
    return { response, body: await response.text() }
}

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function hasToken(body: unknown): body is { token: string } {
    return Boolean(body && typeof body === 'object' && 'token' in body && typeof (body as { token?: unknown }).token === 'string')
}

function remainingMonitorTimeout(deadline: number) {
    return Math.max(1, deadline - Date.now())
}

export default async function runSyntheticMonitor() {
    const runId = `monitor_${Date.now()}`
    const password = `Mm22!!${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}Aa`
    let token = ''

    await check('auth', 'User creation', async () => {
        const { response, body } = await fetchJson('/user', {
            method: 'POST',
            body: JSON.stringify({ id: runId, name: 'Monitor User', password }),
        })
        if (response.status !== 201 || !hasToken(body)) {
            throw new Error(`Unexpected signup response ${response.status}`)
        }
        token = body.token
    })

    await check('auth', 'Login', async () => {
        const { response, body } = await fetchJson(`/auth/login/${runId}`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        })
        if (response.status !== 200 || !hasToken(body)) {
            throw new Error(`Unexpected login response ${response.status}`)
        }
        token = body.token
    })

    await Promise.all([
        check('core', 'API health', async () => {
            const { response, body } = await fetchJson('/openapi.json', {}, publicApiBase)
            const contract = object(body)
            if (response.status !== 200 || typeof contract?.openapi !== 'string' || !object(contract.paths)) {
                throw new Error(`Unexpected public API contract response ${response.status}`)
            }
            return 'The public API contract endpoint responded successfully.'
        }),
        check('website', 'Public website', async () => {
            const { response, body } = await fetchPage('/')
            if (response.status !== 200 || !body.toLowerCase().includes('hanasand')) throw new Error(`Unexpected website response ${response.status}`)
            return 'The public website rendered successfully.'
        }),
        check('threat-intelligence', 'Public search', async () => {
            const deadline = Date.now() + MONITOR_REQUEST_TIMEOUT_MS
            const request = () => fetchJson('/ti/search', {
                method: 'POST',
                body: JSON.stringify({ query: 'APT29' }),
            }, publicApiBase, remainingMonitorTimeout(deadline))
            let result = await request()
            const valid = (value: typeof result) => {
                const body = object(value.body)
                return value.response.status === 200 && body?.mode === 'scraper' && Array.isArray(body.sources) && Array.isArray(body.recentActivity)
            }
            for (let attempt = 0; !valid(result) && attempt < 2 && Date.now() < deadline; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, remainingMonitorTimeout(deadline))))
                if (Date.now() >= deadline) break
                result = await request()
            }
            if (!valid(result)) {
                throw new Error(`Threat intelligence search is unavailable (${result.response.status})`)
            }
            return 'A canonical threat-intelligence search completed successfully.'
        }, { degraded: 3_000, down: 10_000 }),
        check('threat-intelligence', 'Scraper health', async () => {
            const { response, body } = await fetchJson('/v1/health', { signal: AbortSignal.timeout(45_000) }, scraperBase)
            const health = object(body)
            const storage = object(health?.storage)
            if (response.status !== 200 || health?.ok !== true || storage?.ok !== true) {
                throw new Error(`Threat-intelligence storage or service is unhealthy (${response.status}).`)
            }
            const memory = object(health?.memory)
            if (memory?.status === 'critical') {
                throw new Error(`Threat-intelligence scraper memory is critical (${String(memory.containerHeadroomMb ?? 'unknown')} MB headroom).`)
            }
            const pendingWrites = Number(storage.pendingWrites ?? 0)
            if (storage.lastWriteError) {
                throw new Error('Threat-intelligence storage has a write error.')
            }
            if (pendingWrites >= SCRAPER_PENDING_WRITES_DEGRADED_THRESHOLD) {
                return {
                    status: 'degraded',
                    message: `Threat-intelligence storage has ${pendingWrites} pending writes.`,
                }
            }
            const collection = object(health.collection)
            const loops = ['public', 'publicDefault', 'restrictedMetadata']
                .map(name => [name, object(collection?.[name])] as const)
                .filter(([, loop]) => loop?.enabled !== false)
            const stale = loops.filter(([, loop]) => {
                const intervalMs = Math.max(60_000, Number(loop?.intervalSeconds ?? 300) * 3_000)
                const lastSuccess = Date.parse(String(loop?.lastSuccessAt ?? loop?.lastCycleAt ?? ''))
                return !Number.isFinite(lastSuccess) || Date.now() - lastSuccess > intervalMs
            })
            const errors = loops.filter(([, loop]) =>
                Number(loop?.consecutiveErrorCount ?? 0) > 0
                || object(loop?.latestResult)?.status === 'failed')
            if (stale.length || errors.length) {
                return {
                    status: stale.length ? 'down' : 'degraded',
                    message: `Collection problems: ${[...new Set([...stale, ...errors].map(([name]) => name))].join(', ')}.`,
                }
            }
            if (memory?.status === 'warn') {
                return {
                    status: 'degraded',
                    message: `Scraper memory is near its limit (${String(memory.containerHeadroomMb ?? 'unknown')} MB headroom).`,
                }
            }
            return `Storage is healthy with ${pendingWrites} pending writes and ${loops.length} current collection loops.`
        }),
        check('threat-intelligence', 'Source operations', async () => {
            const token = process.env.TI_SCRAPER_SERVICE_TOKEN
            if (!token) throw new Error('Threat-intelligence source-operations authentication is not configured.')
            const { response, body } = await fetchJson('/v1/intel/source-operations?summary=true', {
                headers: { 'x-hanasand-service-token': token },
                signal: AbortSignal.timeout(MONITOR_REQUEST_TIMEOUT_MS),
            }, scraperBase)
            const summary = object(object(body)?.summary)
            if (response.status !== 200 || !summary || !Number.isFinite(Number(summary.sourceCount))) {
                throw new Error(`Threat-intelligence source operations are unavailable (${response.status}).`)
            }
            if (summary.measurementState !== 'measured') {
                return {
                    status: 'degraded',
                    message: `Source operations returned ${String(summary.sourceCount)} sources, but health metrics are not currently measured.`,
                }
            }
            const failed = Number(summary.failedSourceCount ?? 0)
            const degraded = Number(summary.degradedSourceCount ?? 0)
            const sourceCount = Number(summary.sourceCount)
            const impacted = failed + degraded
            const fleetDegradedThreshold = Math.max(3, Math.ceil(sourceCount * SOURCE_OPERATIONS_DEGRADED_RATIO))
            if (impacted >= fleetDegradedThreshold) {
                return {
                    status: 'degraded',
                    message: `Source operations returned ${String(summary.sourceCount)} sources; ${failed} failed and ${degraded} degraded.`,
                }
            }
            if (impacted > 0) return {
                status: 'up',
                message: `Source operations returned ${String(summary.sourceCount)} sources; ${failed} failed and ${degraded} degraded at source level, below the fleet threshold.`,
            }
            return {
                status: 'up',
                message: `Source operations returned ${String(summary.sourceCount)} registered sources.`,
            }
        }, { degraded: 3_000, down: 15_000 }),
        check('threat-intelligence', 'AI model service', async () => {
            let response: Response
            let body: unknown
            try {
                ({ response, body } = await fetchJson('/health', {}, modelClientBase))
            } catch (error) {
                // The model client intentionally uses host networking, so its
                // container name is unreachable from the API container. The
                // API's local runtime endpoint is the authoritative fallback.
                ({ response, body } = await fetchJson('/ai/models'))
                const connected = object(body)?.connected
                if (response.status !== 200 || !Array.isArray(connected) || connected.length === 0) throw error
                return 'Hanasand AI model service is ready through the connected API runtime.'
            }
            const health = object(body)
            const modelHealth = object(health?.modelHealth)
            if (response.status !== 200 || health?.connected !== true || modelHealth?.ready !== true) {
                const blocker = typeof health?.blocker === 'string' ? ` ${health.blocker}` : ''
                throw new Error(`Hanasand AI model service is unavailable (${response.status}).${blocker}`)
            }
            return `Hanasand AI model service is ready (${String(health.model ?? 'unknown')}).`
        }),
        check('browser-sandbox', 'Browser workspace', async () => {
            const { response, body } = await fetchPage('/browser')
            if (response.status !== 200 || !body.includes('Browser')) throw new Error(`Unexpected browser workspace response ${response.status}`)
            return 'The browser investigation workspace rendered successfully.'
        }),
        check('dark-web-monitoring', 'Monitoring workspace', async () => {
            const { response, body } = await fetchPage('/dashboard/dwm', {
                Cookie: `id=${encodeURIComponent(runId)}; access_token=${encodeURIComponent(token)}`,
            })
            if (response.status !== 200 || !body.includes('Dark web monitoring')) throw new Error(`Unexpected monitoring workspace response ${response.status}`)
            return 'The authenticated dark-web monitoring workspace rendered successfully.'
        }),
        check('dark-web-monitoring', 'Latest activity', async () => {
            const deadline = Date.now() + MONITOR_REQUEST_TIMEOUT_MS
            const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
            let { response, body } = await fetchJson('/v1/dwm/exposure-queue?limit=1&tenantId=default', {
                headers: serviceToken ? { 'x-hanasand-service-token': serviceToken } : {},
            }, scraperBase, remainingMonitorTimeout(deadline))
            for (let attempt = 0; response.status >= 500 && attempt < 2 && Date.now() < deadline; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, remainingMonitorTimeout(deadline))))
                if (Date.now() >= deadline) break
                const retry = await fetchJson('/v1/dwm/exposure-queue?limit=1&tenantId=default', {
                    headers: serviceToken ? { 'x-hanasand-service-token': serviceToken } : {},
                }, scraperBase, remainingMonitorTimeout(deadline))
                response = retry.response
                body = retry.body
            }
            const queue = object(body)
            const counts = object(queue?.counts)
            const freshness = object(queue?.freshness)
            const total = Number(counts?.total)
            if (response.status !== 200 || !['live', 'stale'].includes(String(queue?.status)) || !Array.isArray(queue?.items) || !queue.items.length || total < 1) {
                throw new Error(`Latest customer activity is unavailable or empty (${response.status})`)
            }
            const ageMinutes = activityFreshnessMinutes(freshness ?? {})
            const maxAgeMinutes = Number(freshness?.maxLiveAgeMinutes)
            if (ageMinutes === undefined || !Number.isFinite(ageMinutes) || !Number.isFinite(maxAgeMinutes) || ageMinutes > maxAgeMinutes) {
                const scheduler = await fetchJson('/v1/ops/collection-scheduler?tenantId=default&limit=1', {
                    headers: { 'x-hanasand-service-token': serviceToken },
                }, scraperBase)
                const schedulerBody = object(scheduler.body)
                const schedulerState = object(schedulerBody?.scheduler)
                const sourceHealth = object(schedulerBody?.sourceHealth)
                const blockers = Array.isArray(schedulerBody?.operationalBlockers) ? schedulerBody.operationalBlockers : []
                const collectorHealthy = scheduler.response.status === 200
                    && schedulerState?.enabled === true
                    && schedulerState?.running === false
                    && Number(sourceHealth?.healthy ?? 0) > 0
                    && !blockers.some((blocker: any) => blocker?.severity === 'blocker')
                if (collectorHealthy) {
                    return `Collector healthy; no new customer claims within the freshness window (${Number.isFinite(ageMinutes) ? ageMinutes : 'unknown'} minutes).`
                }
                return {
                    status: 'degraded',
                    message: `Latest customer activity is stale (${Number.isFinite(ageMinutes) ? ageMinutes : 'unknown'} minutes).`,
                }
            }
            const prior = await run(`
                SELECT status, message
                FROM service_monitor_results
                WHERE service = 'dark-web-monitoring' AND check_name = 'Latest activity'
                ORDER BY checked_at DESC
                LIMIT 1
            `)
            const drop = activityCountDrop(total, prior.rows[0])
            if (drop) return drop
            return `Latest customer activity returned ${total} retained records; newest successful collection check is ${ageMinutes} minutes old.`
        }, { degraded: 3_000, down: 10_000 }),
        check('dark-web-monitoring', 'Watchlist processing', async () => {
            const [result, scraper] = await Promise.all([run(`
                SELECT
                  (SELECT count(DISTINCT item.organization_id)::int
                   FROM public.organization_watchlist_items item
                   JOIN public.organizations organization ON organization.id = item.organization_id
                   WHERE item.status = 'active' AND item.archived_at IS NULL AND organization.status = 'active') AS configured_organizations,
                  (SELECT count(DISTINCT record->>'organizationId')::int
                   FROM threat_intel.workflow_records
                   WHERE record_type = 'dwm_watchlist'
                     AND record->>'orgSharedWatchlist' = 'true'
                     AND record->>'status' = 'active') AS runtime_organizations
            `), fetchJson('/v1/health', { signal: AbortSignal.timeout(350) }, scraperBase)])
            const row = result.rows[0] as { configured_organizations?: number; runtime_organizations?: number } | undefined
            const configured = Number(row?.configured_organizations ?? 0)
            const runtime = Number(row?.runtime_organizations ?? 0)
            return watchlistProcessingStatus(configured, runtime, scraper.response.status === 200)
        }),
        check('threat-intelligence', 'Processing backlog', async () => {
            const result = await run(`
                WITH latest_review_tasks AS (
                  SELECT DISTINCT ON (record->>'id') record, updated_at
                  FROM threat_intel.workflow_records
                  WHERE record_type = 'analyst_metadata_review_task'
                    AND record->>'recordKind' = 'automatic_intelligence_review_task'
                  ORDER BY record->>'id', updated_at DESC
                )
                SELECT
                  (SELECT count(*)::int FROM latest_review_tasks
                    WHERE record->>'state' IN ('queued', 'running', 'retrying')
                      AND record->>'promptVersion' NOT IN (
                        'ti.automatic_intelligence_review.prompt.v1',
                        'ti.automatic_intelligence_review.prompt.v2',
                        'ti.automatic_intelligence_review.prompt.v3'
                      )
                      AND updated_at < NOW() - INTERVAL '30 minutes'
                  ) AS stale_reviews,
                  COALESCE(
                    EXTRACT(EPOCH FROM (NOW() - (SELECT MIN(updated_at) FROM latest_review_tasks
                      WHERE record->>'state' IN ('queued', 'running', 'retrying')
                        AND record->>'promptVersion' NOT IN (
                          'ti.automatic_intelligence_review.prompt.v1',
                          'ti.automatic_intelligence_review.prompt.v2',
                          'ti.automatic_intelligence_review.prompt.v3'
                        ))) / 60)::int,
                    0
                  ) AS oldest_review_age_minutes,
                  (SELECT count(*)::int FROM threat_intel.workflow_records
                    WHERE record_type = 'collection_plan'
                      AND id LIKE 'source-feed-discovery-plan_%'
                      AND record->>'status' = 'failed'
                      AND COALESCE((record->>'consecutiveFailureCount')::int, 0) > 0
                      AND NULLIF(record->>'nextEligibleAt', '')::timestamptz < NOW()
                  ) AS overdue_discovery,
                  (SELECT count(*)::int FROM threat_intel.workflow_records
                    WHERE record_type = 'evaluation_benchmark'
                      AND record->>'status' = 'annotating'
                      AND record->'protocol'->>'version' = 'ti.independent_extraction_benchmark.v4'
                      AND updated_at < NOW() - INTERVAL '4 hours'
                  ) AS stalled_evaluations,
                  (
                    SELECT count(*)::int
                    FROM threat_intel.sources source
                    WHERE source.collection_executable
                      AND (
                        source.record->'metadata'->'sourcePortfolioVerification' IS NOT NULL
                        OR source.record->'metadata'->'sourceFeedDiscovery' IS NOT NULL
                      )
                      AND COALESCE(source.record->'metadata'->'automaticSourceReview'->>'state', '') <> 'approved'
                      AND EXISTS (
                        SELECT 1
                        FROM threat_intel.captures capture
                        WHERE capture.source_id = source.id
                          AND capture.tenant_id IS NOT DISTINCT FROM source.tenant_id
                      )
                  ) AS unreviewed_sources,
                  (
                    SELECT count(*)::int
                    FROM public.dwm_webhook_deliveries failed
                    WHERE failed.status = 'failed'
                      AND failed.updated_at >= NOW() - INTERVAL '24 hours'
                      AND NOT EXISTS (
                        SELECT 1
                        FROM public.dwm_webhook_deliveries recovered
                        WHERE recovered.destination_id IS NOT DISTINCT FROM failed.destination_id
                          AND recovered.idempotency_key = failed.idempotency_key
                          AND recovered.status = 'delivered'
                          AND recovered.updated_at > failed.updated_at
                      )
                  ) AS recent_delivery_failures
            `)
            const counts = result.rows[0] || {}
            const staleReviews = Number(counts.stale_reviews ?? 0)
            const oldestReviewAgeMinutes = Number(counts.oldest_review_age_minutes ?? 0)
            const overdueDiscovery = Number(counts.overdue_discovery ?? 0)
            const stalledEvaluations = Number(counts.stalled_evaluations ?? 0)
            const unreviewedSources = Number(counts.unreviewed_sources ?? 0)
            const recentDeliveryFailures = Number(counts.recent_delivery_failures ?? 0)
            const message = `${staleReviews} stale reviews (oldest ${oldestReviewAgeMinutes} minutes), ${overdueDiscovery} overdue discovery jobs, ${stalledEvaluations} stalled evaluations, ${unreviewedSources} captured sources without automatic review, ${recentDeliveryFailures} recent delivery failures.`
            // ponytail: automatic review is intentionally paused in production; its old
            // queue is an operator backlog, not a runtime outage or a reason to restart it.
            if (overdueDiscovery >= 10 || stalledEvaluations >= 2 || recentDeliveryFailures >= 10) {
                return { status: 'down', message }
            }
            if (overdueDiscovery || stalledEvaluations || recentDeliveryFailures >= 3) {
                return { status: 'degraded', message }
            }
            return staleReviews === 0
                ? `Collection processing is current; automatic review is disabled and ${unreviewedSources} captured sources have no optional automatic review.`
                : message
        }),
        check('content', 'Articles', async () => {
            const { response } = await fetchJson('/articles')
            if (response.status >= 500) throw new Error(`Unexpected articles response ${response.status}`)
        }),
        check('content', 'Thoughts', async () => {
            const { response } = await fetchJson('/thoughts')
            if (response.status >= 500) throw new Error(`Unexpected thoughts response ${response.status}`)
        }),
        check('security', 'Password check', async () => {
            const { response } = await fetchJson('/pwned', {
                method: 'POST',
                body: JSON.stringify({ password }),
            })
            if (response.status >= 500) throw new Error(`Unexpected pwned response ${response.status}`)
        }),
    ])

    await check('auth', 'Delete account', async () => {
        const { response } = await fetchJson('/user/self', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, id: runId },
            body: JSON.stringify({ id: runId }),
        })
        if (response.status !== 200) {
            throw new Error(`Unexpected delete response ${response.status}`)
        }
    })

    await run('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await run('DELETE FROM login_events WHERE user_id = $1', [runId]).catch(() => {})
    await run('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
}
