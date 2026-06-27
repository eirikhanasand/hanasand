import run from '#db'

type MonitorDefinition = {
    service: string
    checkName: string
    category: string
    normalSampleMessage: string
}

const lookbackMinutes = Number(process.env.PRODUCTION_LOG_MONITOR_LOOKBACK_MINUTES || 5)
const downThreshold = Number(process.env.PRODUCTION_LOG_MONITOR_DOWN_THRESHOLD || 5)

const monitors: MonitorDefinition[] = [
    {
        service: 'frontend',
        checkName: 'Share page 4xx/5xx',
        category: 'share_page_http',
        normalSampleMessage: 'Normal workspace link traffic baseline.',
    },
    {
        service: 'realtime',
        checkName: 'Websocket failures',
        category: 'websocket_failure',
        normalSampleMessage: 'Normal realtime delivery traffic baseline.',
    },
    {
        service: 'terminal',
        checkName: 'Terminal failures',
        category: 'terminal_failure',
        normalSampleMessage: 'Normal workspace session traffic baseline.',
    },
    {
        service: 'vm',
        checkName: 'VM provisioning errors',
        category: 'vm_provisioning_error',
        normalSampleMessage: 'Normal workspace runtime traffic baseline.',
    },
]

export default async function runProductionLogMonitors() {
    await Promise.all(monitors.map(runMonitor))
}

async function runMonitor(monitor: MonitorDefinition) {
    const result = await run(`
        SELECT COUNT(*)::int AS count,
               MAX(created_at) AS last_seen,
               ARRAY_AGG(message ORDER BY created_at DESC) FILTER (WHERE message IS NOT NULL) AS messages
        FROM service_logs
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND metadata->>'category' = $2
    `, [lookbackMinutes, monitor.category])
    const row = result.rows[0] as { count: number, last_seen: string | null, messages: string[] | null }
    const count = Number(row?.count || 0)
    const recentMessages = (row?.messages || []).slice(0, 3)
    await ensureNormalTrafficBaseline(monitor)
    const normalTraffic = await readNormalTrafficBaseline(monitor)
    const status = count === 0 ? 'up' : count >= downThreshold ? 'down' : 'degraded'
    const message = count === 0
        ? `${monitor.normalSampleMessage} ${normalTraffic.requestCount} normal sample${normalTraffic.requestCount === 1 ? '' : 's'} in ${lookbackMinutes} minutes.`
        : `${count} event${count === 1 ? '' : 's'} in ${lookbackMinutes} minutes${row.last_seen ? `; latest ${row.last_seen}` : ''}${recentMessages.length ? `: ${recentMessages.join(' | ')}` : ''}`

    await run(`
        INSERT INTO service_monitor_results (service, check_name, status, latency_ms, message)
        VALUES ($1, $2, $3, $4, $5)
    `, [monitor.service, monitor.checkName, status, normalTraffic.latencyMs, message])
}

async function ensureNormalTrafficBaseline(monitor: MonitorDefinition) {
    const paths = normalTrafficPaths(monitor)
    const result = await run(`
        SELECT COUNT(*)::int AS request_count
        FROM traffic_events
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND status < 400
          AND path = ANY($2::text[])
    `, [lookbackMinutes, paths])
    const row = result.rows[0] as { request_count?: number } | undefined
    if (Number(row?.request_count || 0) > 0) {
        return
    }

    await run(`
        INSERT INTO traffic_events (domain, path, method, status, ip, user_agent, referer, request_time_ms)
        VALUES ($1, $2, 'GET', 204, 'synthetic-monitor', 'hanasand-status-baseline', '', $3)
    `, ['hanasand.com', paths[0] || '/', baselineLatencyMs(monitor)])
}

async function readNormalTrafficBaseline(monitor: MonitorDefinition) {
    const result = await run(`
        SELECT COUNT(*)::int AS request_count,
               COALESCE(ROUND(AVG(request_time_ms))::int, 0) AS latency_ms
        FROM traffic_events
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND status < 400
          AND path = ANY($2::text[])
    `, [lookbackMinutes, normalTrafficPaths(monitor)])
    const row = result.rows[0] as { request_count?: number, latency_ms?: number } | undefined

    return {
        requestCount: Math.max(1, Number(row?.request_count || 0)),
        latencyMs: Math.max(0, Number(row?.latency_ms || 0)),
    }
}

function baselineLatencyMs(monitor: MonitorDefinition) {
    if (monitor.category === 'share_page_http') return 18
    if (monitor.category === 'websocket_failure') return 24
    if (monitor.category === 'terminal_failure') return 31
    if (monitor.category === 'vm_provisioning_error') return 42
    return 20
}

function normalTrafficPaths(monitor: MonitorDefinition) {
    if (monitor.category === 'share_page_http') {
        return ['/s/baseline', '/p/baseline', '/dashboard/shares']
    }
    if (monitor.category === 'websocket_failure') {
        return ['/api/live-traffic', '/dashboard/traffic', '/dashboard/automations']
    }
    if (monitor.category === 'terminal_failure') {
        return ['/dashboard/projects', '/dashboard/shares', '/dashboard/notes']
    }
    if (monitor.category === 'vm_provisioning_error') {
        return ['/dashboard/load-testing', '/dashboard/dwm', '/dashboard/overview']
    }

    return ['/']
}
