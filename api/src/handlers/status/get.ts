import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { ensureStatusSnapshots } from '#utils/status/snapshotSchema.ts'
import { createDashboardSerializer, searchHealth } from '#utils/status/presentation.ts'

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
    samples?: number
    healthy_samples?: number
    degraded_samples?: number
    failed_samples?: number
    status: 'up' | 'degraded' | 'down' | 'unknown'
}

type IncidentRow = {
    service: string
    check_name: string
    status: 'degraded' | 'down'
    previous_status?: string
    previous_checked_at?: string | Date
    next_status?: string
    next_checked_at?: string | Date
    next_message?: string | null
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
let dashboardCache: { current: unknown, history: unknown, json: string } | undefined
const serializeDashboard = createDashboardSerializer()
let historySnapshot: Awaited<ReturnType<typeof loadStatusPayload>> | null = null

export default async function getStatus(req: FastifyRequest<{ Querystring: { summary?: string, incident?: string, dashboard?: string, check?: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const payload = await statusPayload(!req.query?.incident && (req.query?.summary === 'true' || Boolean(req.query?.check)))
    if (req.query?.check) {
        if (req.query.check !== 'public-search') return res.status(404).send({ error: 'Unknown status check.' })
        const health = searchHealth(payload as { checks: MonitorRow[] })
        return res.status(health.ok ? 200 : 503).send(health)
    }
    if (req.query?.dashboard === 'true') {
        if (dashboardCache?.current !== statusCache || dashboardCache?.history !== historySnapshot) {
            dashboardCache = { current: statusCache, history: historySnapshot, json: serializeDashboard(payload as ReturnType<typeof withHistory>) }
        }
        return res.type('application/json').send(dashboardCache!.json)
    }
    if (!req.query?.incident) return res.send(payload)
    const selected = selectStatusIncident(payload as ReturnType<typeof withHistory>, req.query.incident)
    if (selected.history_available) return res.send(selected)
    // On a fresh replica, read only this report from the persisted snapshot;
    // do not wait for the background 90-day history rebuild.
    const saved = await run(`
        SELECT payload->>'generated_at' AS generated_at,
            (SELECT COALESCE(jsonb_agg(incident), '[]'::jsonb)
             FROM jsonb_array_elements(payload->'incidents') incident
             WHERE incident->>'id' = $1 OR incident->'aliases' ? $1) AS incidents
        FROM service_status_snapshots WHERE id = 'history-v2'
    `, [req.query.incident])
    if (!saved.rows.length) return res.status(503).send({ error: 'Incident history is temporarily unavailable.' })
    return res.send({ ...selected, ...saved.rows[0], history_available: true })
}

export function selectStatusIncident<T extends { checks: unknown[], history: unknown[], incidents: { id: string, aliases?: string[] }[] }>(payload: T, id: string) {
    return { ...payload, checks: [], history: [], incidents: payload.incidents.filter(incident => incident.id === id || incident.aliases?.includes(id)) }
}

async function statusPayload(summary: boolean) {
    await ensureStatusSnapshots()
    if (!summary) refreshHistory()
    if (statusCache && expiresAt > Date.now()) return summary ? statusCache : withHistory(statusCache)
    statusInflight ||= loadStatusPayload(true).then(payload => {
        statusCache = payload.checks.length ? payload : { ...(statusCache || historySnapshot || payload), monitoring: 'unavailable' }
        expiresAt = Date.now() + STATUS_CACHE_MS
        prepareDashboard()
        return statusCache
    }).catch(error => {
        console.error('[production-monitor] current status unavailable:', error.message)
        expiresAt = Date.now() + STATUS_CACHE_MS
        if (statusCache) {
            statusCache = { ...statusCache, monitoring: 'unavailable' }
            prepareDashboard()
        }
        return statusCache || { ...(historySnapshot || { overall: 'unknown', generated_at: '', checks: [], history: [], incidents: [] }), monitoring: 'unavailable' }
    }).finally(() => { statusInflight = null })
    // A slow database refresh must not delay readers that already have evidence.
    const current = statusCache || await statusInflight
    return summary ? current : withHistory(current)
}

function prepareDashboard() {
    if (statusCache) dashboardCache = {
        current: statusCache,
        history: historySnapshot,
        json: serializeDashboard(withHistory(statusCache)),
    }
}

function withHistory(current: object) {
    const snapshot = historySnapshot
    const received = (current as { checks: MonitorRow[] }).checks
    const retained = snapshot?.checks.filter(old => !received.some(check => check.service === old.service && check.check_name === old.check_name)) || []
    const checks = [...received, ...retained].filter(isCurrentCheck).map(check => ({
        ...check,
        uptime_30d: snapshot?.checks.find(row => row.service === check.service && row.check_name === check.check_name)?.uptime_30d || 'unverified',
    }))
    return { ...current, ...(!received.length ? { monitoring: 'unavailable' } : {}), checks, history: snapshot?.history || [], incidents: snapshot?.incidents || [], history_generated_at: snapshot?.generated_at || '', history_available: Boolean(snapshot) }
}

function refreshHistory() {
    if (historyRefresh || Date.now() < historyRetryAt) return
    historyRetryAt = Date.now() + MONITOR_STALE_MS
    historyRefresh = (async () => {
        const saved = await run('SELECT payload, updated_at FROM service_status_snapshots WHERE id = \'history-v2\'')
        if (saved.rows[0]) {
            historySnapshot = saved.rows[0].payload
            if (!statusCache && historySnapshot) statusCache = { ...historySnapshot, history: [], incidents: [] }
            prepareDashboard()
            if (Date.now() - new Date(saved.rows[0].updated_at).getTime() < MONITOR_STALE_MS) return
        }
        // History scans never block current checks. A database lock shares one
        // refresh across API instances; the persisted snapshot survives restarts.
        await withTransaction(async query => {
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'service-status-history\', 0)) AS acquired')
            if (!lock.rows[0].acquired) return
            await query('SET LOCAL statement_timeout = \'60s\'')
            const payload = await loadStatusPayload(false, query)
            if (!payload.checks.length) throw new Error('No current monitor results; retaining the verified snapshot.')
            await query('INSERT INTO service_status_snapshots (id, payload) VALUES (\'history-v2\', $1::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()', [JSON.stringify(payload)])
            historySnapshot = payload
            prepareDashboard()
        })
    })().catch(error => {
        console.error('[production-monitor] status history unavailable:', error.message)
    }).finally(() => { historyRefresh = null })
}

async function loadStatusPayload(summary = false, query = run) {
    const tasks = [
        () => query(summary ? `
        SELECT payload->>'service' AS service, payload->>'check_name' AS check_name,
            payload->>'status' AS status, (payload->>'latency_ms')::int AS latency_ms,
            payload->>'message' AS message, payload->>'checked_at' AS checked_at,
            'unverified'::text AS uptime_30d
        FROM service_status_snapshots
        WHERE id LIKE 'check:%'
          AND NOT (payload->>'service' = 'core' AND payload->>'check_name' = 'API index')
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
            COUNT(*)::int AS samples,
            COUNT(*) FILTER (WHERE status = 'up')::int AS healthy_samples,
            COUNT(*) FILTER (WHERE status = 'degraded')::int AS degraded_samples,
            COUNT(*) FILTER (WHERE status = 'down')::int AS failed_samples,
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
                LEAD(checked_at) OVER status_history_window AS next_checked_at,
                LEAD(message) OVER status_history_window AS next_message
            FROM service_monitor_results
            WHERE checked_at >= NOW() - INTERVAL '90 days'
              AND NOT (service = 'core' AND check_name = 'API index')
            WINDOW status_history_window AS (PARTITION BY service, check_name ORDER BY checked_at)
        )
        SELECT service, check_name, status, message, checked_at,
            previous_status, previous_checked_at, next_status, next_checked_at, next_message
        FROM sequenced
        WHERE status IN ('down', 'degraded')
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

    const rawChecks = (result.rows as MonitorRow[]).filter(isCurrentCheck)
    const checks = rawChecks.map(row => toPublicMonitorRow(row))
    const incidentRows = incidentResult.rows as IncidentRow[]
    const incidents = buildIncidents(incidentRows)
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

export function buildIncidents(rows: IncidentRow[]) {
    const groups: IncidentRow[][] = []
    const maxGapMs = 15 * 60 * 1000
    for (const row of rows) {
        const previous = groups.at(-1)?.at(-1)
        // Rows are compacted, so continuity comes from the preceding raw sample,
        // not the distance between the retained first and last observations.
        const continuous = previous && previous.service === row.service && previous.check_name === row.check_name
            && previous.next_status !== 'up' && row.previous_status !== 'up'
            && time(row.checked_at) - time(row.previous_checked_at || previous.checked_at) <= maxGapMs
        if (continuous) groups.at(-1)!.push(row)
        else groups.push([row])
    }
    return groups.map(group => {
        const first = group[0]
        const last = group.at(-1)!
        const resolvedAt = last.next_status === 'up' && last.next_checked_at ? iso(last.next_checked_at) : null
        const outage = group.some(row => row.status === 'down')
        const summary = first.check_name.toLowerCase() === 'latest activity'
            ? 'Recent monitoring activity was delayed. The activity feed was not up to date.'
            : `${first.check_name} ${outage ? 'did not pass its availability check' : 'was operating outside its normal check limits'}.`
        const updates = group.filter((row, index) => index === 0 || index === group.length - 1
            || row.status !== group[index - 1].status || row.message !== group[index - 1].message).map((row, index) => ({
            at: iso(row.checked_at),
            status: index === 0 ? 'investigating' : 'monitoring',
            message: index === 0 ? 'Automated monitoring detected a problem with this component.'
                : row.status === 'down' ? 'The availability check was still failing.'
                    : 'The check was reporting degraded service. Recovery had not yet been confirmed.',
            evidence: row.message || 'No additional check details were recorded.',
        }))
        if (resolvedAt) updates.push({
            at: resolvedAt, status: 'resolved',
            message: 'A successful check confirmed recovery. This is the first recorded healthy result after the incident; no repair details were recorded.',
            evidence: last.next_message || 'The component passed its health check.',
        })
        const startedAt = iso(first.checked_at)
        return {
            id: slug(`${first.service}-${first.check_name}-${startedAt}`),
            aliases: group.filter((row, index) => index > 0 && time(row.checked_at) - time(group[index - 1].checked_at) > maxGapMs)
                .map(row => slug(`${row.service}-${row.check_name}-${iso(row.checked_at)}`)),
            service: first.service, check_name: first.check_name,
            title: `${first.check_name} ${outage ? 'interruption' : 'instability'}`,
            impact: outage ? 'Outage' : 'Instability',
            status: resolvedAt ? 'resolved' as const : 'investigating' as const,
            started_at: startedAt, resolved_at: resolvedAt,
            summary,
            cause: 'No confirmed root cause was recorded. The monitoring results below describe the symptoms, not a verified explanation.',
            updates: updates.reverse(),
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

function isCurrentCheck(check: { service: string, check_name: string }) {
    return !(check.service === 'auth' && ['User creation', 'Login', 'Delete account'].includes(check.check_name))
}
