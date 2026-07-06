import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

type MonitorRow = {
    service: string
    check_name: string
    status: 'up' | 'degraded' | 'down'
    latency_ms: number
    message: string | null
    checked_at: string
    uptime_30d: string
}

type HistoryRow = {
    service: string
    check_name: string
    date: string
    status: 'up' | 'degraded' | 'down'
}

type IncidentRow = {
    service: string
    check_name: string
    status: 'degraded' | 'down'
    message: string | null
    checked_at: string
}

export default async function getStatus(_req: FastifyRequest, res: FastifyReply) {
    const result = await run(`
        WITH latest AS (
            SELECT DISTINCT ON (service, check_name)
                service, check_name, status, latency_ms, message, checked_at
            FROM service_monitor_results
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
            WHERE checked_at >= NOW() - INTERVAL '30 days'
            GROUP BY service, check_name
        )
        SELECT latest.*, COALESCE(uptime.uptime_30d, 0)::text AS uptime_30d
        FROM latest
        LEFT JOIN uptime USING (service, check_name)
        ORDER BY latest.service ASC, latest.check_name ASC
    `)
    const historyResult = await run(`
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
        WHERE checked_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY service, check_name, checked_at::date
        ORDER BY service ASC, check_name ASC, date ASC
    `)
    const incidentResult = await run(`
        SELECT service, check_name, status, message, checked_at
        FROM service_monitor_results
        WHERE checked_at >= NOW() - INTERVAL '30 days'
          AND status <> 'up'
        ORDER BY service ASC, check_name ASC, checked_at ASC
    `)

    const checks = (result.rows as MonitorRow[]).map(toPublicMonitorRow)
    const incidents = buildIncidents(incidentResult.rows as IncidentRow[], checks)
    const history = buildHistory(historyResult.rows as HistoryRow[], incidents)
    const overall = checks.length && checks.every(check => check.status === 'up')
        ? 'up'
        : checks.some(check => check.status === 'down')
            ? 'down'
            : 'degraded'

    return res.send({
        overall,
        generated_at: new Date().toISOString(),
        checks,
        history,
        incidents,
    })
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

function buildIncidents(rows: IncidentRow[], checks: MonitorRow[]) {
    const latestByCheck = new Map(checks.map(check => [`${check.service}\n${check.check_name}`, check]))
    const groups: IncidentRow[][] = []
    const maxGapMs = 15 * 60 * 1000

    for (const row of rows) {
        const previous = groups[groups.length - 1]?.at(-1)
        const sameCheck = previous && previous.service === row.service && previous.check_name === row.check_name
        const closeEnough = previous && Date.parse(row.checked_at) - Date.parse(previous.checked_at) <= maxGapMs
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
        const resolved = latest?.status === 'up' || Date.parse(latest?.checked_at || '') > Date.parse(last.checked_at)
        const status = group.some(row => row.status === 'down') ? 'down' as const : 'degraded' as const
        const message = first.message || last.message || `${first.check_name} reported ${status}.`

        return {
            id: slug(`${first.service}-${first.check_name}-${first.checked_at}`),
            service: first.service,
            check_name: first.check_name,
            title: `${first.check_name} ${status === 'down' ? 'interruption' : 'instability'}`,
            impact: status === 'down' ? 'Outage' : 'Instability',
            status: resolved ? 'resolved' as const : 'investigating' as const,
            started_at: first.checked_at,
            resolved_at: resolved ? latest?.checked_at || last.checked_at : null,
            summary: message,
            cause: message,
            updates: [
                { at: first.checked_at, status: 'investigating', message },
                ...(group.length > 1 ? [{ at: last.checked_at, status: 'monitoring', message: last.message || message }] : []),
                ...(resolved ? [{ at: latest?.checked_at || last.checked_at, status: 'resolved', message: `${first.check_name} returned to normal.` }] : []),
            ],
        }
    }).sort((left, right) => Date.parse(right.started_at) - Date.parse(left.started_at))
}

function slug(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
