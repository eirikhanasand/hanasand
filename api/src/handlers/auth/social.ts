import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { AccountIdentityError } from '#utils/auth/accountIdentity.ts'
import { socialAccount } from '#utils/auth/socialAccounts.ts'
import { issueToken, validateSession } from '#utils/auth/session.ts'
import { authorizationUrl, digest, exchangeIdentity, isSocialProvider, providerConfig, redirectPath, secret, socialProviders } from '#utils/auth/socialOidc.ts'

async function ownAccount(req: FastifyRequest) {
    if (req.headers['x-impersonation-token']) return null
    const header = req.headers.authorization || ''
    if (!header.startsWith('Bearer ')) return null
    // Require a real user session; API keys cannot connect sign-in identities.
    const session = await validateSession({ token: header.slice(7) })
    return session?.user.id || null
}

export async function getSocialProviders(_req: FastifyRequest, res: FastifyReply) {
    return res.send({ providers: socialProviders.map(provider => ({ provider, configured: providerConfig(provider).configured })) })
}
export async function getSocialConnections(req: FastifyRequest, res: FastifyReply) {
    const actor = await ownAccount(req)
    if (!actor) return res.code(401).send({ error: 'Sign in to your own account first.' })
    const result = await run('SELECT provider, email, created_at FROM user_social_identities WHERE user_id = $1', [actor])
    return res.send({ connections: result.rows })
}
export async function postSocialStart(req: FastifyRequest, res: FastifyReply) {
    const { provider } = req.params as { provider: string }
    const body = (req.body || {}) as { binding?: string, redirectPath?: string, link?: boolean }
    if (!isSocialProvider(provider)) return res.code(404).send({ error: 'Unknown sign-in provider.' })
    if (!providerConfig(provider).configured) return res.code(503).send({ error: `${provider === 'google' ? 'Google' : 'Apple'} sign-in is awaiting provider setup.` })
    if (typeof body.binding !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.binding)) return res.code(400).send({ error: 'Invalid browser verification.' })
    let linkUserId: string | null = null
    if (body.link) {
        const actor = await ownAccount(req)
        if (!actor) return res.code(401).send({ error: 'Sign in to your own account before connecting a provider.' })
        linkUserId = actor
    }
    const state = secret(), nonce = secret(), verifier = secret()
    await run('DELETE FROM social_auth_transactions WHERE expires_at < NOW()')
    await run(`INSERT INTO social_auth_transactions (state_hash, provider, binding_hash, nonce, verifier, redirect_path, link_user_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [digest(state), provider, digest(body.binding), nonce, verifier, linkUserId ? '/profile' : redirectPath(body.redirectPath), linkUserId])
    return res.send({ url: authorizationUrl(provider, state, nonce, verifier) })
}
export async function postSocialCallback(req: FastifyRequest, res: FastifyReply) {
    const { provider } = req.params as { provider: string }
    const body = (req.body || {}) as { code?: string, state?: string, binding?: string, cancelled?: boolean }
    if (!isSocialProvider(provider)) return res.code(404).send({ error: 'Unknown sign-in provider.' })
    if (typeof body.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.state) || typeof body.binding !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.binding)) return res.code(400).send({ error: 'Sign-in expired. Please try again.' })
    // Atomic consumption prevents replay across either authentication worker.
    const result = await run('DELETE FROM social_auth_transactions WHERE state_hash=$1 AND provider=$2 AND binding_hash=$3 AND expires_at > NOW() RETURNING *', [digest(body.state), provider, digest(body.binding)])
    const transaction = result.rows[0]
    if (!transaction) return res.code(400).send({ error: 'Sign-in expired. Please try again.' })
    if (body.cancelled) return res.code(400).send({ error: 'Sign-in was cancelled.' })
    if (typeof body.code !== 'string' || !body.code || body.code.length > 4096) return res.code(400).send({ error: 'Missing sign-in code.' })
    try {
        const identity = await exchangeIdentity(provider, body.code, transaction.nonce, transaction.verifier)
        if (transaction.link_user_id) {
            const linked = await run(`INSERT INTO user_social_identities (provider, subject, user_id, email)
                SELECT $1,$2,id,$4 FROM users WHERE id=$3 AND active IS TRUE AND deletion_scheduled_at IS NULL
                ON CONFLICT DO NOTHING RETURNING user_id`, [provider, identity.subject, transaction.link_user_id, identity.email])
            if (!linked.rows.length) {
                const existing = await run('SELECT 1 FROM user_social_identities WHERE provider=$1 AND subject=$2 AND user_id=$3', [provider, identity.subject, transaction.link_user_id])
                if (!existing.rows.length) return res.code(409).send({ error: 'This provider is already connected, or the account is unavailable. Use the existing connection.' })
            }
            return res.send({ linked: true, redirectPath: `/profile/${encodeURIComponent(transaction.link_user_id)}?social=linked` })
        }
        const user = await socialAccount(provider, identity)
        if (!user) return res.code(403).send({ error: 'This account is inactive or scheduled for deletion.' })
        const session = await issueToken({ id: user.id, ip: req.ip, userAgent: String(req.headers['user-agent'] || '') })
        if (!session) return res.code(503).send({ error: 'Unable to create a session. Please try again.' })
        const roles = await run('SELECT r.id,r.name,r.description,r.priority FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1 ORDER BY r.priority,r.id', [user.id])
        await run('UPDATE user_social_identities SET last_used_at=NOW() WHERE provider=$1 AND subject=$2', [provider, identity.subject])
        return res.send({ ...user, avatar: user.avatar || '', roles: roles.rows, token: session.token, expires_at: session.expires_at, redirectPath: transaction.redirect_path })
    } catch (error) {
        if (error instanceof AccountIdentityError) return res.code(409).send({ error: error.message })
        // Never log authorization codes, provider tokens, secrets, or token response bodies.
        req.log.warn({ provider }, 'Social sign-in validation failed')
        return res.code(502).send({ error: 'Unable to verify sign-in with the provider. Please try again.' })
    }
}
