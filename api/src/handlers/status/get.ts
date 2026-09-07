import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'

type MonitorRow = {
    service: string
    check_name: string
    status: 'up' | 'degraded' | 'down' | 'unknown'
    latency_ms: number
    message: string | null
    checked_at: string | Date
    uptime_30d: string
}

type HistoryRow = {
    service: string
    check_name: string
    date: string
    status: 'up' | 'degraded' | 'down' | 'unknown'
}

type IncidentRow = {
    service: string
    check_name: string
    status: 'degraded' | 'down'
    message: string | null
    checked_at: string | Date
}

const STATUS_CACHE_MS = 15_000
const MONITOR_STALE_MS = 5 * 60 * 1000
let statusCache: Awaited<ReturnType<typeof loadStatusPayload>> | null = null
let expiresAt = 0
let statusInflight: Promise<object> | null = null
let historyRefresh: Promise<void> | null = null
let historyRetryAt = 0
let historySnapshot: Awaited<ReturnType<typeof loadStatusPayload>> | null = null

export default async function getStatus(req: FastifyRequest<{ Querystring: { summary?: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    return res.send(await statusPayload(req.query?.summary === 'true'))
}

async function statusPayload(summary: boolean) {
    if (!summary) refreshHistory()
    if (statusCache && expiresAt > Date.now()) return summary ? statusCache : withHistory(statusCache)
    statusInflight ||= loadStatusPayload(true).then(payload => {
        if (payload.checks.length) statusCache = payload
        expiresAt = Date.now() + STATUS_CACHE_MS
        return payload
    }).catch(error => {
        console.error('[production-monitor] current status unavailable:', error.message)
        return { ...(statusCache || historySnapshot || { overall: 'unknown', generated_at: '', checks: [], history: [], incidents: [] }), monitoring: 'unavailable' }
    }).finally(() => { statusInflight = null })
    const current = await statusInflight
    return summary ? current : withHistory(current)
}

function withHistory(current: object) {
    const snapshot = historySnapshot
    const received = (current as { checks: MonitorRow[] }).checks
    const retained = snapshot?.checks.filter(old => !received.some(check => check.service === old.service && check.check_name === old.check_name)) || []
    const checks = [...received, ...retained].map(check => ({
        ...check,
        uptime_30d: snapshot?.checks.find(row => row.service === check.service && row.check_name === check.check_name)?.uptime_30d || 'unverified',
    }))
    return { ...current, ...(!received.length ? { monitoring: 'unavailable' } : {}), checks, history: snapshot?.history || [], incidents: snapshot?.incidents || [], history_generated_at: snapshot?.generated_at || '', history_available: Boolean(snapshot) }
}

function refreshHistory() {
    if (historyRefresh || Date.now() < historyRetryAt) return
    historyRetryAt = Date.now() + MONITOR_STALE_MS
    historyRefresh = (async () => {
        await run(`CREATE TABLE IF NOT EXISTS service_status_snapshots (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT NOW())`)
        const saved = await run(`SELECT payload, updated_at FROM service_status_snapshots WHERE id = 'history'`)
        if (saved.rows[0]) {
            historySnapshot = saved.rows[0].payload
            if (Date.now() - new Date(saved.rows[0].updated_at).getTime() < MONITOR_STALE_MS) return
        }
        // History scans never block current checks. A database lock shares one
        // refresh across API instances; the persisted snapshot survives restarts.
        await withTransaction(async query => {
            const lock = await query("SELECT pg_try_advisory_xact_lock(hashtextextended('service-status-history', 0)) AS acquired")
            if (!lock.rows[0].acquired) return
            await query("SET LOCAL statement_timeout = '60s'")
            const payload = await loadStatusPayload(false, query)
            if (!payload.checks.length) throw new Error('No current monitor results; retaining the verified snapshot.')
            await query(`INSERT INTO service_status_snapshots (id, payload) VALUES ('history', $1::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`, [JSON.stringify(payload)])
            historySnapshot = payload
        })
    })().catch(error => {
        console.error('[production-monitor] status history unavailable:', error.message)
    }).finally(() => { historyRefresh = null })
}

async function loadStatusPayload(summary = false, query = run) {
    const tasks = [
        () => query(summary ? `
        SELECT DISTINCT ON (service, check_name)
            service, check_name, status, latency_ms, message, checked_at,
            'unverified'::text AS uptime_30d
        FROM service_monitor_results
        WHERE checked_at >= NOW() - INTERVAL '5 minutes'
          AND NOT (service = 'core' AND check_name = 'API index')
        ORDER BY service, check_name, checked_at DESC
        ` : `
        WITH latest AS (
            SELECT DISTINCT ON (service, check_name)
                service, check_name, status, latency_ms, message, checked_at
            FROM service_monitor_results
            WHERE checked_at >= NOW() - INTERVAL '5 minutes'
              AND NOT (service = 'core' AND check_name = 'API index')
              -- Alert delivery is event-driven. An old mail failure remains
              -- useful history, but must not hold the live status down forever.
              AND NOT (
                service = 'production-monitor'
                AND check_name = 'Alert delivery'
                AND checked_at < NOW() - INTERVAL '30 minutes'
              )
            ORDER BY service, check_name, checked_at DESC
        ),
        uptime AS (
            SELECT
                service,
                check_name,
                ROUND(
                    100.0 * COUNT(*) FILTER (WHERE status = 'up')
                    / NULLIF(COUNT(*), 0),
                    2
                ) AS uptime_30d
            FROM service_monitor_results
            WHERE checked_at >= NOW() - INTERVAL '90 days'
              AND NOT (service = 'core' AND check_name = 'API index')
            GROUP BY service, check_name
        )
        SELECT latest.*, COALESCE(uptime.uptime_30d, 0)::text AS uptime_30d
        FROM latest
        LEFT JOIN uptime USING (service, check_name)
        ORDER BY latest.service ASC, latest.check_name ASC
    `),
        () => summary ? Promise.resolve({ rows: [] }) : query(`
        SELECT
            service,
            check_name,
            checked_at::date::text AS date,
            CASE
                WHEN BOOL_OR(status = 'down') THEN 'down'
                WHEN BOOL_OR(status = 'degraded') THEN 'degraded'
                ELSE 'up'
            END AS status
        FROM service_monitor_results
        WHERE checked_at >= CURRENT_DATE - INTERVAL '89 days'
          AND NOT (service = 'core' AND check_name = 'API index')
        GROUP BY service, check_name, checked_at::date
        ORDER BY service ASC, check_name ASC, date ASC
    `),
        () => summary ? Promise.resolve({ rows: [] }) : query(`
        WITH sequenced AS (
            SELECT
                service,
                check_name,
                status,
                message,
                checked_at,
                LAG(status) OVER status_history_window AS previous_status,
                LAG(checked_at) OVER status_history_window AS previous_checked_at,
                LEAD(status) OVER status_history_window AS next_status,
                LEAD(checked_at) OVER status_history_window AS next_checked_at
            FROM service_monitor_results
            WHERE checked_at >= NOW() - INTERVAL '90 days'
              AND NOT (service = 'core' AND check_name = 'API index')
            WINDOW status_history_window AS (PARTITION BY service, check_name ORDER BY checked_at)
        )
        SELECT service, check_name, status, message, checked_at
        FROM sequenced
        WHERE status <> 'up'
          AND (
            previous_status IS NULL
            OR previous_status = 'up'
            OR previous_status <> status
            OR previous_checked_at IS NULL
            OR checked_at - previous_checked_at > INTERVAL '15 minutes'
            OR next_status IS NULL
            OR next_status = 'up'
            OR next_status <> status
            OR next_checked_at IS NULL
            OR next_checked_at - checked_at > INTERVAL '15 minutes'
          )
        ORDER BY service ASC, check_name ASC, checked_at ASC
    `),
    ]
    const results = []
    for (const task of tasks) results.push(await task())
    const [result, historyResult, incidentResult] = results

    const rawChecks = result.rows as MonitorRow[]
    const checks = rawChecks.map(row => toPublicMonitorRow(row))
    const incidentRows = incidentResult.rows as IncidentRow[]
    const incidents = buildIncidents(incidentRows, checks)
    const history = buildHistory(historyResult.rows as HistoryRow[], incidents)
    const overall = !checks.length ? 'unknown' : checks.length && checks.every(check => check.status === 'up')
        ? 'up'
        : checks.some(check => check.status === 'down')
            ? 'down'
            : 'degraded'

    return {
        overall,
        monitoring: checks.length && checks.every(check => check.status !== 'unknown') ? 'live' : 'unavailable',
        generated_at: checks.length ? new Date(Math.max(...checks.map(check => time(check.checked_at)))).toISOString() : '',
        checks,
        history,
        incidents,
    }
}

function toPublicMonitorRow(row: MonitorRow): MonitorRow {
    if (Date.now() - time(row.checked_at) > MONITOR_STALE_MS) {
        return {
            ...row,
            status: 'unknown',
            message: `Monitoring stopped reporting after ${iso(row.checked_at)}.`,
        }
    }
    if (row.status !== 'up' || !row.message) {
        return row
    }

    return {
        ...row,
        message: normalTrafficMessage(row.message),
    }
}

function normalTrafficMessage(message: string) {
    if (/No share page (?:4xx\/5xx|availability) responses in the recent log window\./i.test(message)) {
        return 'Normal workspace link traffic baseline.'
    }
    if (/No (?:websocket|realtime delivery) failures in the recent log window\./i.test(message)) {
        return 'Normal realtime delivery traffic baseline.'
    }
    if (/No (?:terminal failures|workspace session issues) in the recent log window\./i.test(message)) {
        return 'Normal workspace session traffic baseline.'
    }
    if (/No (?:VM provisioning|workspace runtime) errors in the recent log window\./i.test(message)) {
        return 'Normal workspace runtime traffic baseline.'
    }

    return message
}

function buildHistory(rows: HistoryRow[], incidents: ReturnType<typeof buildIncidents>) {
    const incidentIdsByKey = new Map<string, string[]>()
    for (const incident of incidents) {
        for (const date of datesBetween(incident.started_at, incident.resolved_at || new Date().toISOString())) {
            const key = `${incident.service}\n${incident.check_name}\n${date}`
            incidentIdsByKey.set(key, [...(incidentIdsByKey.get(key) || []), incident.id])
        }
    }

    return rows.map(row => ({
        ...row,
        incident_ids: incidentIdsByKey.get(`${row.service}\n${row.check_name}\n${row.date}`) || [],
    }))
}

function datesBetween(startedAt: string, endedAt: string) {
    const dates: string[] = []
    const start = new Date(`${startedAt.slice(0, 10)}T00:00:00.000Z`)
    const end = new Date(`${endedAt.slice(0, 10)}T00:00:00.000Z`)
    for (const date = start; date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
        dates.push(date.toISOString().slice(0, 10))
    }
    return dates
}

function buildIncidents(rows: IncidentRow[], checks: MonitorRow[]) {
    const latestByCheck = new Map(checks.map(check => [`${check.service}\n${check.check_name}`, check]))
    const groups: IncidentRow[][] = []
    const maxGapMs = 15 * 60 * 1000

    for (const row of rows) {
        const previous = groups[groups.length - 1]?.at(-1)
        const sameCheck = previous && previous.service === row.service && previous.check_name === row.check_name
        const closeEnough = previous && time(row.checked_at) - time(previous.checked_at) <= maxGapMs
        if (sameCheck && closeEnough) {
            groups[groups.length - 1].push(row)
        } else {
            groups.push([row])
        }
    }

    return groups.map((group) => {
        const first = group[0]
        const last = group[group.length - 1]
        const latest = latestByCheck.get(`${first.service}\n${first.check_name}`)
        const resolved = latest?.status === 'up' || time(latest?.checked_at) > time(last.checked_at)
        const status = group.some(row => row.status === 'down') ? 'down' as const : 'degraded' as const
        const message = first.message || last.message || `${first.check_name} reported ${status}.`
        const startedAt = iso(first.checked_at)
        const resolvedAt = latest?.checked_at ? iso(latest.checked_at) : iso(last.checked_at)

        return {
            id: slug(`${first.service}-${first.check_name}-${startedAt}`),
            service: first.service,
            check_name: first.check_name,
            title: `${first.check_name} ${status === 'down' ? 'interruption' : 'instability'}`,
            impact: status === 'down' ? 'Outage' : 'Instability',
            status: resolved ? 'resolved' as const : 'investigating' as const,
            started_at: startedAt,
            resolved_at: resolved ? resolvedAt : null,
            summary: message,
            cause: message,
            updates: [
                { at: startedAt, status: 'investigating', message },
                ...(group.length > 1 ? [{ at: iso(last.checked_at), status: 'monitoring', message: last.message || message }] : []),
                ...(resolved ? [{ at: resolvedAt, status: 'resolved', message: `${first.check_name} returned to normal.` }] : []),
            ],
        }
    }).sort((left, right) => time(right.started_at) - time(left.started_at))
}

function iso(value: string | Date) {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function time(value: string | Date | undefined) {
    if (!value) return 0
    return new Date(value).getTime()
}

function slug(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
