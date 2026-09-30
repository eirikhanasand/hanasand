import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { createApiKey } from '#utils/auth/apiKeys.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { ingestPushEvent, parsePushEvent, PushEventError } from '#utils/pushMonitoring.ts'
import { loadAutomation } from './automations.ts'

export async function postPushMonitoringKey(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) return res.status(401).send({ error: 'Unauthorized.' })
    const internalAccess = await hasHanasandInternalRouteAccess(req)
    const automation = await loadAutomation(req.params.id, auth.id, internalAccess.valid, true)
    if (!automation || automation.monitoring_type !== 'push') return res.status(404).send({ error: 'External check not found.' })
    const created = await withTransaction(async query => {
        const current = (await query('SELECT status FROM agent_automations WHERE id=$1 FOR UPDATE', [automation.id])).rows[0]
        if (!current || current.status === 'archived') return null
        const old = (await query('SELECT api_key_id FROM monitoring_push_sources WHERE automation_id=$1', [automation.id])).rows[0]
        const key = await createApiKey({ ownerId: automation.owner_id, organizationId: automation.organization_id, name: `${automation.name} sender`, tier: 'custom',
            scopes: [{ id: 'external-events', method: 'POST', route: '/api/automations/:id/events', enabled: true,
                limits: { perSecond: 5, perMinute: 60, perHour: 1000, perDay: 10000 } }] }, query)
        if (old?.api_key_id) await query('UPDATE api_keys SET enabled=FALSE, updated_at=NOW() WHERE id=$1', [old.api_key_id])
        await query(`INSERT INTO monitoring_push_sources (automation_id,api_key_id) VALUES ($1,$2)
            ON CONFLICT (automation_id) DO UPDATE SET api_key_id=EXCLUDED.api_key_id`, [automation.id, key.apiKey.id])
        return key
    })
    if (!created) return res.status(404).send({ error: 'External check not found.' })
    await recordSystemEvent(req, { actionType: 'monitoring.sender_key_created', actorId: auth.id,
        targetType: 'automation', targetId: automation.id, context: { apiKeyId: created.apiKey.id } })
    return res.status(201).send({ secret: created.secret, endpoint: `/api/automations/${encodeURIComponent(automation.id)}/events` })
}

export async function postPushMonitoringEvent(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const key = (req as FastifyRequest & { apiKeyAuth?: { apiKey: { id: string } } }).apiKeyAuth
    if (!key) return res.status(401).send({ error: 'Send the check’s API key in X-API-Key.' })
    try {
        return res.status(201).send(await ingestPushEvent(req.params.id, key.apiKey.id, parsePushEvent(req.body)))
    } catch (error) {
        if (error instanceof PushEventError) return res.status(error.statusCode).send({ error: error.message })
        throw error
    }
}
