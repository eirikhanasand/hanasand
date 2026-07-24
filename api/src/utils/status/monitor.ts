import run from '#db'
import crypto from 'crypto'
import { activityCountDrop, latencyStatus, type MonitorStatus } from './monitorPolicy.ts'
import { recordMonitorResult } from './record.ts'

const apiBase = process.env.MONITOR_API_BASE || `http://127.0.0.1:${Number(process.env.PORT) || 8081}/api`
const publicApiBase = (process.env.MONITOR_PUBLIC_API_BASE || 'https://api.hanasand.com/api/v1').replace(/\/$/, '')
const webBase = (process.env.MONITOR_WEB_BASE || 'https://hanasand.com').replace(/\/$/, '')
const scraperBase = (process.env.TI_SCRAPER_API_BASE || 'http://ti-scraper:8097').replace(/\/$/, '')
type CheckResult = string | void | { status: MonitorStatus, message: string }

async function check(
    service: string,
    checkName: string,
    fn: () => Promise<CheckResult>,
    latencyThresholds?: { degraded: number, down: number }
) {
    const started = performance.now()
    try {
        const result = await fn()
        const latency = Math.round(performance.now() - started)
        const explicit = typeof result === 'object' && result ? result : undefined
        const status = explicit?.status || latencyStatus(latency, latencyThresholds)
        const message = explicit?.message || (typeof result === 'string' ? result : '')
        await recordMonitorResult(service, checkName, status, latency, status === 'up' ? message : message || `Response took ${latency} ms.`)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await recordMonitorResult(service, checkName, 'down', Math.round(performance.now() - started), message)
        console.error(`[synthetic-monitor] ${service}/${checkName}: ${message}`)
    }
}

async function fetchJson(path: string, options: RequestInit = {}, base = apiBase) {
    const response = await fetch(`${base}${path}`, {
        ...options,
        signal: options.signal || AbortSignal.timeout(15_000),
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
        signal: AbortSignal.timeout(15_000),
    })
    return { response, body: await response.text() }
}

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function hasToken(body: unknown): body is { token: string } {
    return Boolean(body && typeof body === 'object' && 'token' in body && typeof (body as { token?: unknown }).token === 'string')
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
            const { response, body } = await fetchJson('/ti/search', {
                method: 'POST',
                body: JSON.stringify({ query: 'APT29' }),
            }, publicApiBase)
            const result = object(body)
            if (response.status !== 200 || result?.mode !== 'scraper' || !Array.isArray(result.sources) || !Array.isArray(result.recentActivity)) {
                throw new Error(`Threat intelligence search is unavailable (${response.status})`)
            }
            return 'A canonical threat-intelligence search completed successfully.'
        }, { degraded: 3_000, down: 10_000 }),
        check('threat-intelligence', 'Scraper health', async () => {
            const { response, body } = await fetchJson('/v1/health', {}, scraperBase)
            const health = object(body)
            const storage = object(health?.storage)
            if (response.status !== 200 || health?.ok !== true || storage?.ok !== true) {
                throw new Error(`Threat-intelligence storage or service is unhealthy (${response.status}).`)
            }
            const pendingWrites = Number(storage.pendingWrites ?? 0)
            if (storage.lastWriteError) {
                throw new Error('Threat-intelligence storage has a write error.')
            }
            const collection = object(health.collection)
            const loops = ['public', 'publicDefault', 'restrictedMetadata']
                .map(name => [name, object(collection?.[name])] as const)
                .filter(([, loop]) => loop?.enabled !== false)
            const stale = loops.filter(([, loop]) => {
                const intervalMs = Math.max(60_000, Number(loop?.intervalSeconds ?? 300) * 3_000)
                const lastSuccess = Date.parse(String(loop?.lastSuccessAt ?? ''))
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
            return `Storage is healthy with ${pendingWrites} pending writes and ${loops.length} current collection loops.`
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
            const { response, body } = await fetchJson('/api/dwm/exposure-queue?limit=1', {}, webBase)
            const queue = object(body)
            const counts = object(queue?.counts)
            const freshness = object(queue?.freshness)
            const total = Number(counts?.total)
            if (response.status !== 200 || queue?.status !== 'live' || !Array.isArray(queue?.items) || !queue.items.length || total < 1) {
                throw new Error(`Latest customer activity is unavailable or empty (${response.status})`)
            }
            const ageMinutes = Number(freshness?.collectionAgeMinutes)
            const maxAgeMinutes = Number(freshness?.maxLiveAgeMinutes)
            if (!Number.isFinite(ageMinutes) || !Number.isFinite(maxAgeMinutes) || ageMinutes > maxAgeMinutes) {
                throw new Error(`Latest customer activity is stale (${Number.isFinite(ageMinutes) ? ageMinutes : 'unknown'} minutes).`)
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
            return `Latest customer activity returned ${total} retained records; newest collection is ${ageMinutes} minutes old.`
        }, { degraded: 3_000, down: 10_000 }),
        check('threat-intelligence', 'Processing backlog', async () => {
            const result = await run(`
                SELECT
                  count(*) FILTER (
                    WHERE record_type = 'analyst_metadata_review_task'
                      AND record->>'state' IN ('queued', 'running', 'retrying')
                      AND updated_at < NOW() - INTERVAL '30 minutes'
                  )::int AS stale_reviews,
                  count(*) FILTER (
                    WHERE record_type = 'collection_plan'
                      AND id LIKE 'source-feed-discovery-plan_%'
                      AND record->>'status' = 'failed'
                      AND COALESCE((record->>'consecutiveFailureCount')::int, 0) > 0
                      AND NULLIF(record->>'nextEligibleAt', '')::timestamptz < NOW()
                  )::int AS overdue_discovery,
                  count(*) FILTER (
                    WHERE record_type = 'evaluation_benchmark'
                      AND record->>'status' = 'annotating'
                      AND updated_at < NOW() - INTERVAL '4 hours'
                  )::int AS stalled_evaluations,
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
                FROM threat_intel.workflow_records
            `)
            const counts = result.rows[0] || {}
            const staleReviews = Number(counts.stale_reviews ?? 0)
            const overdueDiscovery = Number(counts.overdue_discovery ?? 0)
            const stalledEvaluations = Number(counts.stalled_evaluations ?? 0)
            const recentDeliveryFailures = Number(counts.recent_delivery_failures ?? 0)
            const message = `${staleReviews} stale reviews, ${overdueDiscovery} overdue discovery jobs, ${stalledEvaluations} stalled evaluations, ${recentDeliveryFailures} recent delivery failures.`
            if (staleReviews >= 1_000 || overdueDiscovery >= 10 || stalledEvaluations >= 2 || recentDeliveryFailures >= 10) {
                return { status: 'down', message }
            }
            if (staleReviews || overdueDiscovery || stalledEvaluations || recentDeliveryFailures >= 3) {
                return { status: 'degraded', message }
            }
            return message
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
