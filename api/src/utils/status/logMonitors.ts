import run from '#db'
import { recordMonitorResult } from './record.ts'

type MonitorDefinition = {
    service: string
    checkName: string
    category: string
    noEventMessage: string
}

const lookbackMinutes = Number(process.env.PRODUCTION_LOG_MONITOR_LOOKBACK_MINUTES || 5)
const downThreshold = Number(process.env.PRODUCTION_LOG_MONITOR_DOWN_THRESHOLD || 5)

const monitors: MonitorDefinition[] = [
    {
        service: 'frontend',
        checkName: 'Share page 4xx/5xx',
        category: 'share_page_http',
        noEventMessage: 'No workspace link errors were recorded.',
    },
    {
        service: 'realtime',
        checkName: 'Websocket failures',
        category: 'websocket_failure',
        noEventMessage: 'No realtime delivery failures were recorded.',
    },
    {
        service: 'terminal',
        checkName: 'Terminal failures',
        category: 'terminal_failure',
        noEventMessage: 'No workspace session failures were recorded.',
    },
    {
        service: 'vm',
        checkName: 'VM provisioning errors',
        category: 'vm_provisioning_error',
        noEventMessage: 'No workspace runtime errors were recorded.',
    },
]

export default async function runProductionLogMonitors() {
    await Promise.all(monitors.map(runMonitor))
}

async function runMonitor(monitor: MonitorDefinition) {
    const result = await run(`
        SELECT COUNT(*)::int AS count,
               MAX(created_at) AS last_seen
        FROM service_logs
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND metadata->>'category' = $2
    `, [lookbackMinutes, monitor.category])
    const row = result.rows[0] as { count: number, last_seen: string | null }
    const count = Number(row?.count || 0)
    const status = count === 0 ? 'up' : count >= downThreshold ? 'down' : 'degraded'
    const message = count === 0
        ? `${monitor.noEventMessage} Window: ${lookbackMinutes} minutes.`
        : `${count} event${count === 1 ? '' : 's'} in ${lookbackMinutes} minutes${row.last_seen ? `; latest ${row.last_seen}` : ''}.`

    await recordMonitorResult(monitor.service, monitor.checkName, status, 0, message)
}
