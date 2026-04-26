import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { createApiKey, normalizeApiKeyTier, validateApiKeyScopes } from '#utils/auth/apiKeys.ts'

export default async function postApiKeyHandler(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')

    const access = await tokenWrapper(req, res)
    if (!access.valid) {
        return res.status(401).send({ error: access.error || 'Unauthorized.' })
    }

    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        return res.status(403).send({ error: role.error || 'Missing system_admin role.' })
    }

    const body = req.body as Partial<ApiKeySummary> & { scopes?: ApiKeyScopeRule[] }
    if (!body?.ownerId || !body?.name) {
        return res.status(400).send({ error: 'Missing ownerId or name.' })
    }

    const scopeValidation = validateApiKeyScopes(body.scopes)
    if (!scopeValidation.valid) {
        return res.status(400).send({ error: scopeValidation.error || 'Invalid API key scopes.' })
    }

    const created = await createApiKey({
        ownerId: body.ownerId,
        name: body.name,
        tier: normalizeApiKeyTier(body.tier),
        description: body.description || null,
        enabled: body.enabled !== false,
        expiresAt: body.expiresAt || null,
        scopes: scopeValidation.scopes,
    })

    return res.status(201).send(created)
}
