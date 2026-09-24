import type { CatchupProgress } from '@/app/dashboard/logs/catchupProgress'

export type LogEvent = { id: string, event_timestamp: string, normalized: { severity: string, level: string, log_type: string, service: string, host: string, message: string, process?: { executable?: string, command_line?: string }, detections?: Array<{ rule_id: string, summary: string, severity: string }>, rules_checked?: number, [key: string]: unknown } }
type PendingCommands = { count: number, has_more: boolean, oldest_queued_at: string | null }
export type ProcessingSource = { name: string, last_id?: string | null, recent_id?: string | null, history_end_id?: string | null }
export type LogSearchResult = { rows: LogEvent[], next_cursor?: string | null, counts: Array<{ severity: string, count: number }>, services: Array<{ service: string, count: number }>, processing: { updated_at: string, last_error?: string, skipped_events?: number, catchup?: CatchupProgress | null, sources?: ProcessingSource[], pending_commands?: PendingCommands } | null, generated_at?: string, summarize?: string, projection?: string[], limit: number }

export const logTables = ['Logs', 'ProcessLogs', 'SigninLogs', 'ApplicationLogs', 'HttpLogs', 'SystemLogs']
export function logSearchParams({ view, hours, advanced, appliedHql, table, search, service, severity }: {
    view: string, hours: string, advanced: boolean, appliedHql: string, table: string, search: string, service: string, severity: string
}) {
    const params = new URLSearchParams({ hours, hql: advanced && appliedHql ? appliedHql : `${table} | take 200` })
    if (search && !advanced) params.set('search', search)
    if (service !== 'all') params.set('service', service)
    if (view === 'realtime') params.set('severity', 'high,critical')
    else if (severity !== 'all') params.set('severity', severity)
    if (view === 'dashboard') params.set('stats', '1')
    if (view === 'search' && !advanced) params.set('paginate', '1')
    return params
}
