import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { compileLogQuery } from '#utils/logs/kql.ts'
import { readPendingProcessLogs } from '#utils/mill/processQueue.ts'
import { basicLogSearchPredicate } from '#utils/logs/searchText.ts'
import { dimensionLogWhere, foldLogCounts } from '#utils/logs/dimensions.ts'

export async function searchLogs(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    if (!(await hasRole(req, res, 'system_admin')).valid) return res.status(403).send({ error: 'Missing system_admin role.' })
    const input = req.query as { kql?: string, search?: string, service?: string, severity?: string, hours?: string, stats?: string }
    try {
        const compiled = compileLogQuery(input.kql || 'Logs | take 200')
        const params = [...compiled.params]
        const bind = (value: string | number) => { params.push(value); return `$${params.length}` }
        const hours = Number(input.hours || 24)
        if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 90) throw new Error('Time range must be between one hour and 90 days.')
        const where = ['ingestion_id = \'logs\'', 'processing_status = \'processed\'', `event_timestamp >= NOW() - ${bind(hours)} * INTERVAL '1 hour'`, ...compiled.where,
            'EXISTS (SELECT 1 FROM organizations o WHERE o.id = mill_events.organization_id AND o.status = \'active\')']
        if (input.search) where.push(basicLogSearchPredicate(bind(input.search)))
        if (input.service) where.push(`normalized->>'service' = ${bind(input.service)}`)
        if (input.severity === 'high,critical') where.push('normalized->>\'severity\' IN (\'high\', \'critical\')')
        else if (input.severity) {
            if (!['low', 'medium', 'high', 'critical'].includes(input.severity)) throw new Error('Invalid severity.')
            where.push(`normalized->>'severity' = ${bind(input.severity)}`)
        }
        const result = await withTransaction(async query => {
            await query('SET LOCAL statement_timeout = \'8s\'')
            const result = compiled.summarize
                ? await query(`SELECT ${compiled.fields[compiled.summarize]} AS value, COUNT(*)::int AS count FROM mill_events WHERE ${where.join(' AND ')} GROUP BY 1 ORDER BY count DESC LIMIT ${compiled.limit}`, params)
                : await query(`SELECT id, normalized, event_timestamp, organization_id FROM mill_events WHERE ${where.join(' AND ')} ORDER BY ${compiled.order} LIMIT ${compiled.limit}`, params)
            const status = await query('SELECT name, updated_at, last_error, last_id, recent_id, (SELECT COUNT(*)::int FROM mill_events WHERE ingestion_id = \'logs\' AND processing_status = \'skipped\') AS skipped_events FROM log_processing_cursors ORDER BY name')
            const progress = (await query('SELECT payload, last_error FROM log_catchup_progress WHERE id = TRUE')).rows[0]
            const catchup = typeof progress?.payload?.remaining === 'number' ? { ...progress.payload, last_error: progress.last_error } : null
            const pendingCommands = await readPendingProcessLogs(query)
            let counts: ReturnType<typeof foldLogCounts> = { counts: [], services: [] }
            let countersLastError: string | null = null
            if (input.stats === '1') {
                const compact = dimensionLogWhere(where)
                const projection = (await query('SELECT ready, last_error FROM mill_log_dimensions_state WHERE id = TRUE')).rows[0]
                const ready = compact && projection?.ready
                countersLastError = projection?.last_error || null
                const grouped = ready
                    ? await query(`SELECT severity, service, COUNT(*)::int AS count FROM mill_log_dimensions mill_events WHERE ${compact!.join(' AND ')} GROUP BY 1, 2`, params)
                    : await query(`SELECT normalized->>'severity' AS severity, normalized->>'service' AS service, COUNT(*)::int AS count FROM mill_events WHERE ${where.join(' AND ')} GROUP BY 1, 2`, params)
                counts = foldLogCounts(grouped.rows)
            }
            const primary = status.rows.find(row => row.name === 'service_logs')
            const stalled = status.rows.find(row => row.last_error)
            return { rows: result.rows, processing: primary ? { ...primary, catchup, pending_commands: pendingCommands, last_error: stalled ? `${stalled.name}: ${stalled.last_error}` : countersLastError ? `Log counters: ${countersLastError}` : null, sources: status.rows } : null, ...counts }
        })
        return res.send({ ...result, projection: compiled.projection, summarize: compiled.summarize, limit: compiled.limit, hours, generated_at: new Date().toISOString() })
    } catch (error) {
        const timeout = (error as { code?: string }).code === '57014'
        return res.status(timeout ? 503 : 400).send({ error: timeout ? 'Search took too long. Narrow the time range or add a service filter.' : error instanceof Error ? error.message : 'Unable to search logs.' })
    }
}
