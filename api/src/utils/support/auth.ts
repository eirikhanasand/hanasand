import { createHash } from 'node:crypto'
import { validateSession } from '../auth/session.ts'
import { isTransientDatabaseError } from '#db'
import { independentSupport, queryOnce, withTransaction } from './db.ts'

let retryAuthorityAt = 0

type Session = NonNullable<Awaited<ReturnType<typeof validateSession>>>
export async function validateSupportSession(auth: Parameters<typeof validateSession>[0]): Promise<Session | null> {
    if (!independentSupport) return validateSession(auth)
    const hash = createHash('sha256').update(auth.token).digest('hex')
    const cached = async () => {
        const saved = (await queryOnce(`SELECT snapshot FROM support_auth_sessions WHERE token_hash=$1
            AND ($2::text IS NULL OR user_id=$2) AND expires_at>NOW()`, [hash, auth.id || null])).rows[0]?.snapshot
        return saved ? { ...saved, session: { ...saved.session, token: auth.token }, refreshed: { ...saved.refreshed, token: auth.token } } : null
    }
    // Probe again after a short connection outage instead of delaying every message.
    if (Date.now() < retryAuthorityAt) return cached()
    let session: Session | null
    try { session = await validateSession(auth); retryAuthorityAt = 0 }
    catch (error) {
        // Only connection failures permit a previously verified support session.
        // Invalid/revoked credentials always use the authoritative negative result below.
        if (!isTransientDatabaseError(error) && (error as Error).message !== 'timeout exceeded when trying to connect') throw error
        retryAuthorityAt = Date.now() + 3000
        return cached()
    }
    if (!session) {
        await queryOnce('DELETE FROM support_auth_sessions WHERE token_hash=$1', [hash])
        return null
    }
    const snapshot = { ...session, session: { ...session.session, token: undefined }, refreshed: { ...session.refreshed, token: undefined } }
    const expires = new Date(Math.min(Date.parse(session.refreshed.expires_at), Date.now() + 24 * 60 * 60 * 1000))
    await withTransaction(async query => {
        await query('INSERT INTO users(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name', [session.user.id, session.user.name])
        await query(`INSERT INTO support_auth_sessions(token_hash,user_id,snapshot,expires_at) VALUES($1,$2,$3::jsonb,$4)
            ON CONFLICT(token_hash) DO UPDATE SET snapshot=EXCLUDED.snapshot,expires_at=EXCLUDED.expires_at`, [hash, session.user.id, JSON.stringify(snapshot), expires])
        await query('DELETE FROM support_auth_sessions WHERE expires_at<NOW()')
    })
    return session
}
