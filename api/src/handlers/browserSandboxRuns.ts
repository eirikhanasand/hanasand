import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHash } from 'node:crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { validateSession } from '#utils/auth/session.ts'

export type BrowserNetwork = 'regular' | 'tor'

export type BrowserQuota = {
    plan: string
    limit: number
    used: number
    remaining: number
    resetsAt: string | null
    identityKind: 'anonymous' | 'user'
}

export type BrowserRunRecord = {
    id: string
    target: string
    network: BrowserNetwork
    status: string
    startedAt: string
    title?: string
}

type BrowserRunIdentity = {
    identityKind: 'anonymous' | 'user'
    quotaIdentity: string
    quotaPlan: string
    ownerId: string | null
    clientIdHash: string | null
    periodStart: Date | null
    resetsAt: Date | null
    limit: number
}

type PrepareBrowserRunInput = {
    id: string
    target: string
    network: BrowserNetwork
    clientId?: string
    userId?: string
    sessionToken?: string
}

const anonymousRunLimit = 3
const dailyPlanLimits: Record<string, number> = {
    free: 5,
    starter: 20,
    team: 100,
    business: 500,
    volume: 2000,
}

export async function getBrowserRuns(req: FastifyRequest<{ Querystring: { clientId?: string } }>, res: FastifyReply) {
    try {
        const user = await tokenWrapper(req, res)
        const clientId = cleanClientId(req.query?.clientId)
        const identity = user.valid && user.id
            ? await browserRunIdentityForUser(user.id, clientId)
            : browserRunIdentityForClient(clientId)

        if (!identity) {
            return res.send({
                runs: [],
                quota: {
                    plan: 'anonymous',
                    limit: anonymousRunLimit,
                    used: 0,
                    remaining: anonymousRunLimit,
                    resetsAt: null,
                    identityKind: 'anonymous',
                } satisfies BrowserQuota,
            })
        }

        const quota = await loadBrowserQuota(identity)
        const params = identity.ownerId
            ? [identity.ownerId, identity.clientIdHash]
            : [identity.clientIdHash]
        const result = await run(identity.ownerId ? `
            SELECT id, target, network, status, title, created_at
            FROM browser_runs
            WHERE owner_id = $1
               OR ($2::text IS NOT NULL AND client_id_hash = $2)
            ORDER BY created_at DESC
            LIMIT 12
        ` : `
            SELECT id, target, network, status, title, created_at
            FROM browser_runs
            WHERE client_id_hash = $1
            ORDER BY created_at DESC
            LIMIT 12
        `, params)

        return res.send({
            runs: result.rows.map(rowToRunRecord),
            quota,
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load browser runs.' })
    }
}

export async function prepareBrowserRun(input: PrepareBrowserRunInput): Promise<{ allowed: true; run: BrowserRunRecord | null; quota: BrowserQuota | null } | { allowed: false; quota: BrowserQuota; reason: 'quota_exhausted' }> {
    const identity = await browserRunIdentityForSocket(input)
    if (!identity) return { allowed: true, run: null, quota: null }

    const quota = await loadBrowserQuota(identity)
    if (quota.remaining <= 0) {
        return { allowed: false, quota, reason: 'quota_exhausted' }
    }

    const result = await run(`
        INSERT INTO browser_runs (id, owner_id, quota_identity, quota_plan, client_id_hash, target, network, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'running', $8::jsonb)
        ON CONFLICT (id)
        DO UPDATE SET
            target = EXCLUDED.target,
            network = EXCLUDED.network,
            status = 'running',
            updated_at = NOW(),
            metadata = browser_runs.metadata || EXCLUDED.metadata
        RETURNING id, target, network, status, title, created_at
    `, [
        input.id,
        identity.ownerId,
        identity.quotaIdentity,
        identity.quotaPlan,
        identity.clientIdHash,
        input.target,
        input.network,
        JSON.stringify({ identityKind: identity.identityKind }),
    ])

    const nextQuota = await loadBrowserQuota(identity)
    return {
        allowed: true,
        run: rowToRunRecord(result.rows[0]),
        quota: nextQuota,
    }
}

export async function finishBrowserRun(id: string, status: 'ended' | 'failed' = 'ended', title = '') {
    if (!id) return
    await run(`
        UPDATE browser_runs
        SET status = $2,
            title = COALESCE(NULLIF($3, ''), title),
            updated_at = NOW()
        WHERE id = $1
    `, [id, status, title])
}

async function browserRunIdentityForSocket(input: { clientId?: string; userId?: string; sessionToken?: string }) {
    const sessionToken = cleanText(input.sessionToken)
    const userId = cleanText(input.userId)
    const clientId = cleanClientId(input.clientId)
    if (sessionToken) {
        const session = await validateSession({ id: userId || undefined, token: sessionToken })
        if (session?.user?.id) return browserRunIdentityForUser(session.user.id, clientId)
    }
    return browserRunIdentityForClient(clientId)
}

async function browserRunIdentityForUser(userId: string, clientId?: string): Promise<BrowserRunIdentity> {
    const planResult = await run(`
        SELECT plan
        FROM browser_subscriptions
        WHERE owner_id = $1
          AND active IS TRUE
        LIMIT 1
    `, [userId])
    const plan = cleanText(planResult.rows[0]?.plan) || 'free'
    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const resetsAt = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)
    return {
        identityKind: 'user',
        quotaIdentity: `browser:user:${userId}`,
        quotaPlan: plan,
        ownerId: userId,
        clientIdHash: clientId ? hashValue(clientId) : null,
        periodStart,
        resetsAt,
        limit: dailyPlanLimits[plan] ?? dailyPlanLimits.free,
    }
}

function browserRunIdentityForClient(clientId?: string): BrowserRunIdentity | null {
    const clean = cleanClientId(clientId)
    if (!clean) return null
    return {
        identityKind: 'anonymous',
        quotaIdentity: `browser:anonymous:${hashValue(clean)}`,
        quotaPlan: 'anonymous',
        ownerId: null,
        clientIdHash: hashValue(clean),
        periodStart: null,
        resetsAt: null,
        limit: anonymousRunLimit,
    }
}

async function loadBrowserQuota(identity: BrowserRunIdentity): Promise<BrowserQuota> {
    const params = identity.periodStart
        ? [identity.quotaIdentity, identity.periodStart.toISOString()]
        : [identity.quotaIdentity]
    const result = await run(identity.periodStart ? `
        SELECT COUNT(*)::int AS used
        FROM browser_runs
        WHERE quota_identity = $1
          AND created_at >= $2::timestamptz
    ` : `
        SELECT COUNT(*)::int AS used
        FROM browser_runs
        WHERE quota_identity = $1
    `, params)
    const used = Number(result.rows[0]?.used || 0)
    return {
        plan: identity.quotaPlan,
        limit: identity.limit,
        used,
        remaining: Math.max(0, identity.limit - used),
        resetsAt: identity.resetsAt ? identity.resetsAt.toISOString() : null,
        identityKind: identity.identityKind,
    }
}

function rowToRunRecord(row: Record<string, any>): BrowserRunRecord {
    return {
        id: String(row.id || ''),
        target: String(row.target || ''),
        network: row.network === 'tor' ? 'tor' : 'regular',
        status: String(row.status || 'running'),
        startedAt: new Date(row.created_at || Date.now()).toISOString(),
        title: String(row.title || ''),
    }
}

function cleanClientId(value: unknown) {
    const text = cleanText(value)
    return /^[a-zA-Z0-9_.:-]{8,160}$/.test(text) ? text : ''
}

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex')
}
