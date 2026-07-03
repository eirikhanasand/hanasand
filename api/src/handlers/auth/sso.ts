import { randomUUID } from 'crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import { issueToken } from '#utils/auth/session.ts'
import { getReservedUsernameReason, normalizeUsername } from '#utils/auth/reservedUsernames.ts'
import {
    assertAllowedSsoUser,
    buildOidcAuthorizationUrl,
    exchangeOidcCode,
    fetchOidcUserinfo,
    loadOidcConfig,
    oidcConfigMissing,
    safeRedirectPath,
    ssoUserIdCandidate,
    verifyState,
    type OidcUserinfo,
} from '#utils/auth/ssoOidc.ts'

type SsoCallbackBody = {
    code?: string
    state?: string
}

type UserRow = {
    id: string
    name: string
    avatar: string | null
    active: boolean
    deletion_scheduled_at?: string | null
}

export async function getSsoStart(req: FastifyRequest, res: FastifyReply) {
    const config = loadOidcConfig()
    const missing = oidcConfigMissing(config)
    if (missing.length > 0) {
        return res.status(503).send({
            error: 'SSO is not configured.',
            code: 'sso_not_configured',
            missing,
        })
    }

    const query = req.query as { redirectPath?: string } | undefined
    return res.redirect(buildOidcAuthorizationUrl(config, safeRedirectPath(query?.redirectPath)))
}

export async function postSsoCallback(req: FastifyRequest, res: FastifyReply) {
    const config = loadOidcConfig()
    const missing = oidcConfigMissing(config)
    if (missing.length > 0) {
        return res.status(503).send({
            error: 'SSO is not configured.',
            code: 'sso_not_configured',
            missing,
        })
    }

    const { code, state } = req.body as SsoCallbackBody ?? {}
    if (!code || !state) {
        return res.status(400).send({ error: 'Missing SSO code or state.', code: 'sso_callback_missing_fields' })
    }

    const statePayload = verifyState(state, config.stateSecret)
    if (!statePayload || statePayload.provider !== config.provider) {
        return res.status(400).send({ error: 'SSO callback state is invalid or expired.', code: 'sso_state_invalid' })
    }

    try {
        const accessToken = await exchangeOidcCode(config, code)
        const userinfo = await fetchOidcUserinfo(config, accessToken)
        const allowed = assertAllowedSsoUser(config, userinfo)
        if (!allowed.ok) {
            return res.status(403).send({ error: allowed.error || 'SSO user is not allowed.', code: 'sso_user_not_allowed' })
        }

        const user = await findOrProvisionSsoUser(userinfo, config.autoProvision)
        if (!user) {
            return res.status(403).send({
                error: 'SSO user is valid but is not provisioned in Hanasand.',
                code: 'sso_user_not_provisioned',
            })
        }
        if (user.active === false || user.deletion_scheduled_at) {
            return res.status(403).send({ error: 'This account is not active.', code: 'sso_account_inactive' })
        }

        const roles = await rolesForUser(user.id)
        const session = await issueToken({
            id: user.id,
            ip: req.ip,
            userAgent: String(req.headers['user-agent'] || ''),
        })
        if (!session) {
            return res.status(503).send({ error: 'SSO succeeded, but the session could not be created.', code: 'sso_session_failed' })
        }

        return res.send({
            id: user.id,
            name: user.name,
            avatar: user.avatar ?? '',
            roles,
            token: session.token,
            expires_at: session.expires_at,
            authProvider: config.provider,
            redirectPath: statePayload.redirectPath,
        })
    } catch (error) {
        req.log.warn({ error }, 'SSO callback failed')
        return res.status(502).send({ error: 'SSO provider could not complete login.', code: 'sso_provider_failed' })
    }
}

async function findOrProvisionSsoUser(userinfo: OidcUserinfo, autoProvision: boolean): Promise<UserRow | null> {
    const email = String(userinfo.email || '').trim().toLowerCase()
    const externalId = String(userinfo.sub || '').trim()
    const existing = await run(`
        SELECT u.id, u.name, u.avatar, u.active, u.deletion_scheduled_at
        FROM users u
        LEFT JOIN mail_accounts ma ON ma.user_id = u.id
        WHERE lower(u.id) = lower($1)
           OR lower(ma.mail_address) = lower($2)
           OR lower(u.id) = lower($2)
        LIMIT 1
    `, [ssoUserIdCandidate(userinfo), email || externalId])

    if (existing.rows[0]) {
        return existing.rows[0] as UserRow
    }
    if (!autoProvision) {
        return null
    }

    const id = await availableSsoUserId(userinfo)
    const name = String(userinfo.name || userinfo.email || id).trim()
    const password = await bcrypt.hash(randomUUID(), 10)
    const response = await run(
        `INSERT INTO users (id, name, password, avatar)
         VALUES ($1, $2, $3, '')
         ON CONFLICT (id) DO NOTHING
         RETURNING id, name, avatar, active, deletion_scheduled_at`,
        [id, name, password],
    )
    if (!response.rows[0]) {
        return null
    }

    const userQuery = await loadSQL('assignUserRole.sql')
    await run(userQuery, [id])
    return response.rows[0] as UserRow
}

async function availableSsoUserId(userinfo: OidcUserinfo) {
    const base = normalizeSsoUserId(ssoUserIdCandidate(userinfo), userinfo)
    for (let index = 0; index < 6; index++) {
        const candidate = index === 0 ? base : `${base}-${index + 1}`
        const exists = await run('SELECT 1 FROM users WHERE lower(id) = lower($1) LIMIT 1', [candidate])
        if (!exists.rows.length) {
            return candidate
        }
    }
    return `${base}-${randomUUID().slice(0, 8)}`
}

function normalizeSsoUserId(value: string, userinfo: OidcUserinfo) {
    const normalized = normalizeUsername(value)
        .replace(/[^a-z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '')
        .slice(0, 48)
    const fallback = `sso-${String(userinfo.sub || randomUUID()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24).toLowerCase()}`
    const candidate = normalized || fallback
    return getReservedUsernameReason(candidate) ? `sso-${candidate}`.slice(0, 48) : candidate
}

async function rolesForUser(userId: string) {
    const roleResponse = await run(`
        SELECT r.id, r.name, r.description, r.priority
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
        ORDER BY r.priority ASC, r.id ASC
    `, [userId])
    return roleResponse.rows
}
