import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHash, randomUUID } from 'node:crypto'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { validateSession } from '#utils/auth/session.ts'
import { browserAccess, type BrowserAccess } from '../utils/ws/browserAccess.ts'

export type BrowserNetwork = 'regular' | 'tor'

export type BrowserQuota = BrowserAccess & {
    plan: string
    limit: null
    used: number
    active: number
    remaining: null
    resetsAt: string | null
    identityKind: 'anonymous' | 'user'
}

type BrowserRunStats = {
    runs24h: number
    darkwebRuns24h: number
}

export type BrowserRunRecord = {
    id: string
    target: string
    network: BrowserNetwork
    status: string
    startedAt: string
    checkCount?: number
    title?: string
    providerResults?: Record<string, BrowserProviderRunResult>
    reportUrl?: string
}
export type BrowserProviderRunResult = {
    status: 'clean' | 'suspicious' | 'blocked' | 'loading'
    label: string
}

type BrowserRunIdentity = {
    identityKind: 'anonymous' | 'user'
    quotaIdentity: string
    quotaPlan: string
    ownerId: string | null
    clientIdHash: string | null
    periodStart: Date | null
    resetsAt: Date | null
    access: BrowserAccess
}

type PrepareBrowserRunInput = {
    id: string
    target: string
    network: BrowserNetwork
    clientId?: string
    userId?: string
    sessionToken?: string
}

type BrowserReportParams = { id: string }
type BrowserReportQuery = { clientId?: string; token?: string }
type BrowserReportBody = { clientId?: string; report?: unknown }

const maxReportBytes = 2_000_000
let browserRunStatsCache: { expiresAt: number; value: BrowserRunStats } | null = null

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
                    limit: null,
                    used: 0,
                    remaining: null,
                    active: 0,
                    ...browserAccess('anonymous'),
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
            SELECT *
            FROM (
                SELECT DISTINCT ON (target)
                    id, target, network, status, title, created_at, metadata,
                    COUNT(*) OVER (PARTITION BY target)::int AS check_count
                FROM browser_runs
                WHERE owner_id = $1
                   OR ($2::text IS NOT NULL AND client_id_hash = $2)
                ORDER BY target, created_at DESC
            ) latest_runs
            ORDER BY created_at DESC
            LIMIT 12
        ` : `
            SELECT *
            FROM (
                SELECT DISTINCT ON (target)
                    id, target, network, status, title, created_at, metadata,
                    COUNT(*) OVER (PARTITION BY target)::int AS check_count
                FROM browser_runs
                WHERE client_id_hash = $1
                ORDER BY target, created_at DESC
            ) latest_runs
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

export async function getBrowserRunStats(_req: FastifyRequest, res: FastifyReply) {
    const now = Date.now()
    if (browserRunStatsCache && browserRunStatsCache.expiresAt > now) return res.header('cache-control', 'public, max-age=5').send(browserRunStatsCache.value)

    try {
        const result = await run(`
            SELECT
                COUNT(*)::int AS runs_24h,
                COUNT(*) FILTER (WHERE network = 'tor')::int AS darkweb_runs_24h
            FROM browser_runs
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        `)
        const value = {
            runs24h: Number(result.rows[0]?.runs_24h || 0),
            darkwebRuns24h: Number(result.rows[0]?.darkweb_runs_24h || 0),
        } satisfies BrowserRunStats
        browserRunStatsCache = { expiresAt: now + 5_000, value }
        return res.header('cache-control', 'public, max-age=5').send(value)
    } catch (error) {
        _req.log.error(error)
        return res.status(500).send({ error: 'Failed to load browser run stats.' })
    }
}

export async function getBrowserRunReport(req: FastifyRequest<{ Params: BrowserReportParams, Querystring: BrowserReportQuery }>, res: FastifyReply) {
    try {
        const row = await loadAccessibleBrowserRun(req, req.params.id, req.query?.clientId, req.query?.token)
        if (!row) return res.status(404).send({ error: 'Report not found.' })
        const report = row.metadata?.report
        if (!report) return res.status(404).send({ error: 'Report not saved.' })
        return res.send(report)
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load browser report.' })
    }
}

export async function postBrowserRunReport(req: FastifyRequest<{ Params: BrowserReportParams, Body: BrowserReportBody }>, res: FastifyReply) {
    try {
        const row = await loadAccessibleBrowserRun(req, req.params.id, req.body?.clientId)
        if (!row) return res.status(404).send({ error: 'Run not found.' })
        const report = req.body?.report
        const encoded = JSON.stringify(report)
        if (!report || encoded.length > maxReportBytes) return res.status(400).send({ error: 'Report is missing or too large.' })
        const token = row.metadata?.reportToken || randomUUID()
        await run(`
            UPDATE browser_runs
            SET metadata = metadata || $2::jsonb,
                updated_at = NOW()
            WHERE id = $1
        `, [req.params.id, JSON.stringify({
            report,
            reportToken: token,
            reportSavedAt: new Date().toISOString(),
        })])
        return res.send({
            ok: true,
            reportUrl: browserReportViewerUrl(req.params.id, token),
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to save browser report.' })
    }
}

export async function prepareBrowserRun(input: PrepareBrowserRunInput): Promise<
    { allowed: true; run: BrowserRunRecord; quota: BrowserQuota } |
    { allowed: false; quota: BrowserQuota | null; reason: 'concurrency_limit' | 'identity_required' | 'run_exists' }
> {
    const identity = await browserRunIdentityForSocket(input)
    if (!identity) return { allowed: false, quota: null, reason: 'identity_required' }
    return withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [identity.quotaIdentity])
        const quota = await loadBrowserQuota(identity, query)
        if (quota.active >= quota.concurrentLimit) return { allowed: false as const, quota, reason: 'concurrency_limit' as const }
        const result = await query(`
            INSERT INTO browser_runs (id, owner_id, quota_identity, quota_plan, client_id_hash, target, network, status, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'running', $8::jsonb)
            ON CONFLICT (id) DO NOTHING
            RETURNING id, target, network, status, title, created_at
        `, [input.id, identity.ownerId, identity.quotaIdentity, identity.quotaPlan, identity.clientIdHash, input.target, input.network,
            JSON.stringify({ identityKind: identity.identityKind, leaseExpiresAt: new Date(Date.now() + 120_000).toISOString() })])
        if (!result.rows.length) return { allowed: false as const, quota, reason: 'run_exists' as const }
        return { allowed: true as const, run: rowToRunRecord(result.rows[0]), quota: { ...quota, active: quota.active + 1, used: quota.used + 1 } }
    })
}

export async function refreshBrowserRunLease(id: string) {
    const result = await run(`UPDATE browser_runs SET metadata = metadata || jsonb_build_object('leaseExpiresAt', NOW() + INTERVAL '2 minutes')
        WHERE id = $1 AND status IN ('running', 'unreachable')
            AND (metadata->>'leaseExpiresAt')::timestamptz > NOW()`, [id])
    if (!result.rowCount) throw new Error('Browser run lease expired')
}

export async function finishBrowserRun(id: string, status: 'ended' | 'failed' | 'unreachable' = 'ended', title = '') {
    if (!id) return
    await run(`
        UPDATE browser_runs
        SET status = CASE
                WHEN $2 = 'ended' AND status IN ('failed', 'unreachable') THEN status
                ELSE $2
            END,
            title = COALESCE(NULLIF($3, ''), title),
            metadata = CASE WHEN $2 IN ('ended', 'failed')
                THEN metadata || jsonb_build_object('leaseExpiresAt', NOW()) ELSE metadata END,
            updated_at = NOW()
        WHERE id = $1
    `, [id, status, title])
}

export async function updateBrowserRunProviderResult(id: string, provider: string, result: BrowserProviderRunResult) {
    if (!id || !/^[a-z0-9_-]+$/i.test(provider)) return
    await run(`
        UPDATE browser_runs
        SET metadata = metadata || jsonb_build_object('providerResults', COALESCE(metadata->'providerResults', '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb)),
            updated_at = NOW()
        WHERE id = $1
    `, [id, provider, JSON.stringify(result)])
}

export async function browserPaidExtensionAllowed(id: string) {
    if (!id) return false
    const result = await run('SELECT owner_id FROM browser_runs WHERE id = $1', [id])
    const owner = result.rows[0]?.owner_id
    return owner ? (await browserRunIdentityForUser(owner)).access.paid : false
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
    const result = await run(`
        SELECT EXISTS (SELECT 1 FROM billing_entitlements WHERE user_id = $1 AND plan_id = 'browser' AND active IS TRUE) AS paid,
            (SELECT plan FROM browser_subscriptions WHERE owner_id = $1 AND active IS TRUE LIMIT 1) AS legacy_plan
    `, [userId])
    const plan = result.rows[0]?.paid ? 'browser' : cleanText(result.rows[0]?.legacy_plan) || 'free'
    const now = new Date()
    return {
        identityKind: 'user', quotaIdentity: `browser:user:${userId}`, quotaPlan: plan,
        ownerId: userId, clientIdHash: clientId ? hashValue(clientId) : null,
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        resetsAt: null, access: browserAccess(plan),
    }
}

function browserRunIdentityForClient(clientId?: string): BrowserRunIdentity | null {
    const clean = cleanClientId(clientId)
    if (!clean) return null
    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const resetsAt = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)
    return {
        identityKind: 'anonymous',
        quotaIdentity: `browser:anonymous:${hashValue(clean)}`,
        quotaPlan: 'anonymous',
        ownerId: null,
        clientIdHash: hashValue(clean),
        periodStart,
        resetsAt,
        access: browserAccess('anonymous'),
    }
}

async function loadBrowserQuota(identity: BrowserRunIdentity, query: typeof run = run): Promise<BrowserQuota> {
    const result = await query(`
        SELECT COUNT(*) FILTER (WHERE created_at >= $2::timestamptz)::int AS used,
            COUNT(*) FILTER (WHERE status IN ('running', 'unreachable') AND
                COALESCE((metadata->>'leaseExpiresAt')::timestamptz, updated_at + INTERVAL '2 minutes') > NOW())::int AS active
        FROM browser_runs WHERE quota_identity = $1
    `, [identity.quotaIdentity, identity.periodStart?.toISOString() || new Date(0).toISOString()])
    return {
        ...identity.access, plan: identity.quotaPlan, limit: null, used: Number(result.rows[0]?.used || 0),
        active: Number(result.rows[0]?.active || 0), remaining: null, resetsAt: null, identityKind: identity.identityKind,
    }
}

function rowToRunRecord(row: Record<string, any>): BrowserRunRecord {
    const reportToken = row.metadata?.reportToken
    return {
        id: String(row.id || ''),
        target: String(row.target || ''),
        network: row.network === 'tor' ? 'tor' : 'regular',
        status: String(row.status || 'running'),
        startedAt: new Date(row.created_at || Date.now()).toISOString(),
        checkCount: Math.max(1, Number(row.check_count || 1)),
        title: String(row.title || ''),
        providerResults: providerResultsValue(row.metadata?.providerResults),
        reportUrl: reportToken ? browserReportViewerUrl(String(row.id || ''), String(reportToken)) : undefined,
    }
}

function providerResultsValue(value: unknown): Record<string, BrowserProviderRunResult> | undefined {
    if (!value || typeof value !== 'object') return undefined
    const out: Record<string, BrowserProviderRunResult> = {}
    for (const [key, result] of Object.entries(value as Record<string, any>)) {
        if (!/^[a-z0-9_-]+$/i.test(key) || !result || typeof result !== 'object') continue
        const status = ['clean', 'suspicious', 'blocked', 'loading'].includes(result.status) ? result.status : 'loading'
        const label = cleanText(result.label)
        if (label) out[key] = { status, label }
    }
    return Object.keys(out).length ? out : undefined
}

async function loadAccessibleBrowserRun(req: FastifyRequest, id: string, clientId?: string, token?: string) {
    const result = await run('SELECT * FROM browser_runs WHERE id = $1 LIMIT 1', [id])
    const row = result.rows[0] as (Record<string, any> & { metadata?: Record<string, any> }) | undefined
    if (!row) return null
    if (token && row.metadata?.reportToken === token) return row

    const user = await tokenWrapper(req, {} as FastifyReply).catch(() => ({ valid: false, id: '' }))
    if (user.valid && user.id && row.owner_id === user.id) return row
    const clientHash = cleanClientId(clientId) ? hashValue(cleanClientId(clientId)) : ''
    if (clientHash && row.client_id_hash === clientHash) return row
    return null
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

function browserReportViewerUrl(id: string, token: string) {
    return `/browser/report?run=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`
}
