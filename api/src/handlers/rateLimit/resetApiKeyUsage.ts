import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { listApiKeys } from '#utils/auth/apiKeys.ts'
import { recordAdminAuditEvent, requireAuditReason } from '#utils/adminAudit.ts'
import { resetApiKeyRateLimitBuckets } from '#plugins/rateLimit.ts'

export default async function resetApiKeyUsageHandler(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')

    const access = await tokenWrapper(req, res)
    if (!access.valid) return res.status(401).send({ error: access.error || 'Unauthorized.' })

    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) return res.status(403).send({ error: role.error || 'Missing system_admin role.' })

    let reason: string
    try {
        reason = requireAuditReason((req.body as { reason?: unknown } | undefined)?.reason, 'API usage reset reason')
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'API usage reset reason is required.' })
    }

    const apiKey = (await listApiKeys()).find(key => key.id === req.params.id)
    if (!apiKey) return res.status(404).send({ error: 'API key not found.' })

    const resetCount = await resetApiKeyRateLimitBuckets(apiKey.id)
    await recordAdminAuditEvent(req, {
        actionType: 'support.api_key.usage_reset',
        actorId: access.authenticatedId || access.id || '',
        targetType: 'api_key',
        targetId: apiKey.id,
        entityId: apiKey.id,
        severity: 'warning',
        outcome: 'success',
        reason,
        context: {
            schemaVersion: 'support.api_key.usage_reset.v1',
            ownerId: apiKey.ownerId,
            keyPrefix: apiKey.keyPrefix,
            resetBucketCount: resetCount,
            mutation: 'rate_limit_buckets_only',
        },
    })

    return res.send({
        reset: {
            apiKeyId: apiKey.id,
            ownerId: apiKey.ownerId,
            keyPrefix: apiKey.keyPrefix,
            resetBucketCount: resetCount,
            auditAction: 'support.api_key.usage_reset',
        },
    })
}
