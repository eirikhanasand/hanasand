import { randomUUID } from 'crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { createApiKey, listApiKeys } from '#utils/auth/apiKeys.ts'
import { serviceAccountEndpoints, validateServiceAccountScopes } from '#utils/auth/serviceAccountScopes.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'

async function authorize(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const auth = await tokenWrapper(req, res)
    if (!auth.valid) { res.status(401).send({ error: 'Unauthorized.' }); return null }
    if (!(await hasRole(req, res, 'system_admin')).valid) { res.status(403).send({ error: 'Service account management requires a system administrator.' }); return null }
    return auth.id
}

export async function serviceAccountSelf(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const auth = await tokenWrapper(req, res)
    if (!auth.valid) return res.status(401).send({ error: 'Unauthorized.' })
    const result = await run('SELECT id, name, created_at FROM users WHERE id = $1 AND account_type = \'service\'', [auth.id!])
    if (!result.rows.length) return res.status(403).send({ error: 'A service account key is required.' })
    const key = (req as FastifyRequest & { apiKeyAuth?: { serviceAccount?: boolean, apiKey: { scopes: ApiKeyScopeRule[] } } }).apiKeyAuth
    if (!key?.serviceAccount) return res.status(403).send({ error: 'A service account key is required.' })
    const pages = key.apiKey.scopes.some(scope => scope.enabled && scope.method === 'GET' && scope.route === '/api/db') ? ['/db'] : []
    return res.send({ ...result.rows[0], pages })
}

export async function getServiceAccounts(req: FastifyRequest, res: FastifyReply) {
    if (!await authorize(req, res)) return
    const [users, keys] = await Promise.all([
        run('SELECT id, name, active, created_at FROM users WHERE account_type = \'service\' ORDER BY name'),
        listApiKeys(),
    ])
    return res.send({ endpoints: serviceAccountEndpoints.map(({ method, route, label }) => ({ method, route, label })), accounts: users.rows.map(user => ({
        ...user,
        keys: keys.filter(key => key.ownerId === user.id),
    })) })
}

export async function postServiceAccount(req: FastifyRequest, res: FastifyReply) {
    const actorId = await authorize(req, res)
    if (!actorId) return
    const body = (req.body || {}) as { name?: unknown, scopes?: unknown }
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100 || !validateServiceAccountScopes(body.scopes)) {
        return res.status(400).send({ error: 'Enter a name (up to 100 characters) and select at least one supported endpoint.' })
    }
    const name = body.name.trim()
    const scopes = body.scopes.map((scope, index) => ({ ...scope, id: `scope_${index}`, enabled: true,
        limits: { perSecond: 5, perMinute: 60, perHour: 1000, perDay: 10000 } }))
    const created = await withTransaction(async query => {
        const id = `svc_${randomUUID()}`
        await query('INSERT INTO users (id, name, password, avatar, account_type) VALUES ($1, $2, $3, \'\', \'service\')', [id, name, `!service:${randomUUID()}`])
        return createApiKey({ ownerId: id, name, tier: 'custom', scopes }, query)
    })
    await recordSystemEvent(req, { actionType: 'service_account.created', actorId, targetType: 'service_account', targetId: created.apiKey.ownerId!, context: { scopes: body.scopes } })
    return res.status(201).send(created)
}

export async function deleteServiceAccount(req: FastifyRequest, res: FastifyReply) {
    const actorId = await authorize(req, res)
    if (!actorId) return
    const { id } = req.params as { id: string }
    const deleted = await withTransaction(async query => {
        const result = await query('UPDATE users SET active = FALSE, deactivated_at = NOW(), deactivated_by = $2 WHERE id = $1 AND account_type = \'service\' RETURNING id', [id, actorId])
        if (!result.rows.length) return false
        await query('UPDATE api_keys SET enabled = FALSE, updated_at = NOW() WHERE owner_id = $1', [id])
        await query('UPDATE tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [id])
        return true
    })
    if (!deleted) return res.status(404).send({ error: 'Service account not found.' })
    await recordSystemEvent(req, { actionType: 'service_account.revoked', actorId, targetType: 'service_account', targetId: id })
    return res.send({ message: 'Service account deleted. Its credentials are revoked; usage history is retained.' })
}
