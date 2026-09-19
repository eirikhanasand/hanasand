import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { compileLogQuery } from '#utils/logs/kql.ts'

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
        if (input.search) where.push(`strpos(lower(normalized::text), lower(${bind(input.search)}::text)) > 0`)
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
            const status = await query('SELECT updated_at, last_error, last_id, recent_id, (SELECT COUNT(*)::int FROM mill_events WHERE ingestion_id = \'logs\' AND processing_status = \'skipped\') AS skipped_events FROM log_processing_cursors WHERE name = \'service_logs\'')
            const counts = input.stats === '1' ? await query(`SELECT normalized->>'severity' AS severity, COUNT(*)::int AS count FROM mill_events WHERE ${where.join(' AND ')} GROUP BY 1`, params) : { rows: [] }
            const services = input.stats === '1' ? await query(`SELECT normalized->>'service' AS service, COUNT(*)::int AS count FROM mill_events WHERE ${where.join(' AND ')} GROUP BY 1 ORDER BY count DESC LIMIT 10`, params) : { rows: [] }
            return { rows: result.rows, processing: status.rows[0] || null, counts: counts.rows, services: services.rows }
        })
        return res.send({ ...result, projection: compiled.projection, summarize: compiled.summarize, limit: compiled.limit, hours, generated_at: new Date().toISOString() })
    } catch (error) {
        const timeout = (error as { code?: string }).code === '57014'
        return res.status(timeout ? 503 : 400).send({ error: timeout ? 'Search took too long. Narrow the time range or add a service filter.' : error instanceof Error ? error.message : 'Unable to search logs.' })
    }
}
