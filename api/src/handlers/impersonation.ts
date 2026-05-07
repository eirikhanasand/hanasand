import type { FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type RoleRow = { id: string, name?: string }
type StartBody = { target_id?: string, reason?: string }

function isAdminRole(role: RoleRow) {
    const id = role.id.toLowerCase()
    const name = (role.name || '').toLowerCase()
    return id === 'administrator'
        || id === 'system_admin'
        || id === 'user_admin'
        || id.includes('admin')
        || name.includes('admin')
}

function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

async function actorHasImpersonationAccess(actorId: string) {
    const result = await run(`
        SELECT r.id, r.name
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
    `, [actorId])
    return (result.rows as RoleRow[]).some(isAdminRole)
}

async function getActiveUser(id: string) {
    const result = await run(`
        SELECT id, name, avatar
        FROM users
        WHERE id = $1
          AND active IS TRUE
          AND deletion_scheduled_at IS NULL
        LIMIT 1
    `, [id])
    return result.rows[0] as { id: string, name: string, avatar?: string | null } | undefined
}

async function audit(req: FastifyRequest, sessionId: string | null, actorId: string, targetId: string, actionPath: string) {
    await run(`
        INSERT INTO impersonation_events (session_id, actor_id, target_id, method, path, ip, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
        sessionId,
        actorId,
        targetId,
        req.method || '',
        actionPath,
        req.ip,
        String(req.headers['user-agent'] || ''),
    ]).catch(error => {
        req.log.warn({ error, actorId, targetId, actionPath }, 'Failed to audit impersonation lifecycle event')
    })
}

export async function startImpersonation(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id || actor.impersonating) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }
    if (!await actorHasImpersonationAccess(actor.id)) {
        return res.status(403).send({ error: 'Only admins can impersonate users.' })
    }

    const body = req.body as StartBody | undefined
    const targetId = String(body?.target_id || '').trim()
    if (!targetId) {
        return res.status(400).send({ error: 'Missing target user.' })
    }
    if (targetId === actor.id) {
        return res.status(400).send({ error: 'You are already viewing your own account.' })
    }

    const target = await getActiveUser(targetId)
    if (!target) {
        return res.status(404).send({ error: 'Impersonated user not found.' })
    }

    const rawToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)
    const reason = String(body?.reason || '').slice(0, 500)
    const session = await run(`
        INSERT INTO impersonation_sessions (token_hash, actor_id, target_id, reason, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, expires_at
    `, [hashToken(rawToken), actor.id, target.id, reason, expiresAt.toISOString()])
    const row = session.rows[0] as { id: string, created_at: string, expires_at: string }
    await audit(req, row.id, actor.id, target.id, '/api/impersonation/start')

    return res.send({
        token: rawToken,
        session: {
            id: row.id,
            actor_id: actor.id,
            target,
            created_at: row.created_at,
            expires_at: row.expires_at,
        },
    })
}

export async function stopImpersonation(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.authenticatedId) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }

    const token = String(req.headers['x-impersonation-token'] || '')
    if (!token) {
        return res.send({ ok: true })
    }

    const result = await run(`
        UPDATE impersonation_sessions
        SET revoked_at = NOW(),
            revoked_by = $2
        WHERE token_hash = $1
          AND actor_id = $2
          AND revoked_at IS NULL
        RETURNING id, actor_id, target_id
    `, [hashToken(token), actor.authenticatedId])
    const row = result.rows[0] as { id: string, actor_id: string, target_id: string } | undefined
    if (row) {
        await audit(req, row.id, row.actor_id, row.target_id, '/api/impersonation/stop')
    }
    return res.send({ ok: true })
}

export async function getImpersonationEvents(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id || actor.impersonating) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }
    if (!await actorHasImpersonationAccess(actor.id)) {
        return res.status(403).send({ error: 'Only admins can view impersonation history.' })
    }

    const result = await run(`
        SELECT
            e.id,
            e.session_id,
            e.actor_id,
            actor.name AS actor_name,
            e.target_id,
            target.name AS target_name,
            e.method,
            e.path,
            e.ip,
            e.user_agent,
            e.created_at
        FROM impersonation_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target ON target.id = e.target_id
        ORDER BY e.created_at DESC
        LIMIT 200
    `)
    return res.send({ events: result.rows })
}

export async function getImpersonationCurrent(req: FastifyRequest, res: FastifyReply) {
    const token = String(req.headers['x-impersonation-token'] || '')
    if (!token) {
        return res.send({ active: false })
    }
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.impersonating) {
        return res.status(401).send({ error: actor.error || 'Invalid impersonation session.' })
    }
    return res.send({
        active: true,
        actor_id: actor.authenticatedId,
        target_id: actor.id,
    })
}
