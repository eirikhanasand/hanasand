import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHash, randomUUID } from 'node:crypto'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { validateSession } from '#utils/auth/session.ts'
import { browserResultId } from '../utils/ws/browserResultIdentity.ts'
import { BrowserLeaseExpiredError } from '../utils/ws/browserLease.ts'
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
    resultId: string
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

export const maxBrowserReportBytes = 32_000_000
let browserRunStatsCache: { expiresAt: number; value: BrowserRunStats } | null = null

export async function getBrowserRuns(req: FastifyRequest<{ Querystring: { clientId?: string; history?: string; offset?: string } }>, res: FastifyReply) {
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
        if (req.query.history === 'all') {
            const offset = Number(req.query.offset || 0)
            if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).send({ error: 'Invalid history offset.' })
            const scope = identity.ownerId ? '(owner_id = $1 OR ($2::text IS NOT NULL AND client_id_hash = $2))' : 'client_id_hash = $1'
            const result = await run(`
                SELECT id, target, network, status, title, created_at, metadata - 'report' AS metadata
                FROM browser_runs WHERE ${scope}
                ORDER BY created_at DESC, id DESC
                LIMIT 51 OFFSET $${params.length + 1}
            `, [...params, offset])
            return res.header('cache-control', 'private, no-store').send({
                runs: result.rows.slice(0, 50).map(rowToRunRecord),
                nextOffset: result.rows.length > 50 ? offset + 50 : null,
            })
        }
        const result = await run(identity.ownerId ? `
            SELECT *
            FROM (
                SELECT DISTINCT ON (result_id)
                    id, target, network, status, title, created_at, metadata - 'report' AS metadata,
                    COUNT(*) OVER (PARTITION BY result_id)::int AS check_count
                FROM browser_runs
                WHERE owner_id = $1
                   OR ($2::text IS NOT NULL AND client_id_hash = $2)
                ORDER BY result_id, created_at DESC
            ) latest_runs
            ORDER BY created_at DESC
            LIMIT 12
        ` : `
            SELECT *
            FROM (
                SELECT DISTINCT ON (result_id)
                    id, target, network, status, title, created_at, metadata - 'report' AS metadata,
                    COUNT(*) OVER (PARTITION BY result_id)::int AS check_count
                FROM browser_runs
                WHERE client_id_hash = $1
                ORDER BY result_id, created_at DESC
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
        if (!report || Buffer.byteLength(encoded, 'utf8') > maxBrowserReportBytes) return res.status(400).send({ error: 'Report is missing or too large.' })
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
            resultId: browserResultId(String(row.target)),
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
            INSERT INTO browser_runs (id, owner_id, quota_identity, quota_plan, client_id_hash, target, network, status, metadata, result_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'running', $8::jsonb, $9::uuid)
            ON CONFLICT (id) DO NOTHING
            RETURNING id, target, network, status, title, created_at
        `, [input.id, identity.ownerId, identity.quotaIdentity, identity.quotaPlan, identity.clientIdHash, input.target, input.network,
            JSON.stringify({ identityKind: identity.identityKind, leaseExpiresAt: new Date(Date.now() + 120_000).toISOString() }), browserResultId(input.target)])
        if (!result.rows.length) return { allowed: false as const, quota, reason: 'run_exists' as const }
        return { allowed: true as const, run: rowToRunRecord(result.rows[0]), quota: { ...quota, active: quota.active + 1, used: quota.used + 1 } }
    })
}

export async function refreshBrowserRunLease(id: string) {
    const result = await run(`UPDATE browser_runs SET metadata = metadata || jsonb_build_object('leaseExpiresAt', NOW() + INTERVAL '2 minutes')
        WHERE id = $1 AND status IN ('running', 'unreachable')
            AND (metadata->>'leaseExpiresAt')::timestamptz > NOW()`, [id])
    if (!result.rowCount) throw new BrowserLeaseExpiredError('Browser run lease expired')
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
        resultId: browserResultId(String(row.target || '')),
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

export async function persistBrowserRunEvidence(id: string, payload: Record<string, any>) {
    if (!['frame', 'tool_capture', 'console', 'pageerror', 'downloads', 'status', 'navigation_error', 'error', 'ended'].includes(payload?.type)) return
    await run('INSERT INTO browser_run_evidence (run_id, payload) VALUES ($1, $2::jsonb)', [id, JSON.stringify(payload)])
}

export async function getBrowserResult(req: FastifyRequest<{ Params: { id: string }; Querystring: { clientId?: string; run?: string } }>, res: FastifyReply) {
    try {
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id)) return res.status(404).send({ error: 'Result not found.' })
        const user = await tokenWrapper(req, res)
        const clientId = cleanClientId(req.query?.clientId)
        const rows = await run(`SELECT id, target, network, status, created_at, title FROM browser_runs
            WHERE result_id = $1::uuid AND (owner_id = $2 OR client_id_hash = $3)
            ORDER BY created_at DESC, id DESC`, [req.params.id, user.valid ? user.id : null, clientId ? hashValue(clientId) : null])
        const selected = req.query?.run ? rows.rows.find(row => row.id === req.query.run) : rows.rows[0]
        if (!selected) return res.status(404).send({ error: 'Result not found or unavailable to this account.' })
        const stored = await run('SELECT metadata FROM browser_runs WHERE id = $1', [selected.id])
        const evidence = await run('SELECT payload FROM browser_run_evidence WHERE run_id = $1 ORDER BY id', [selected.id])
        return res.header('cache-control', 'private, no-store').send(buildStoredBrowserReport(selected, stored.rows[0]?.metadata?.report, evidence.rows.map(row => row.payload), rows.rows))
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Could not load the saved browser result.' })
    }
}

export function buildStoredBrowserReport(selected: Record<string, any>, saved: any, events: Record<string, any>[], versions: Record<string, any>[]) {
    const captures = events.filter(event => event.type === 'frame' || event.type === 'tool_capture').map(event => ({
        ...event,
        kind: event.type === 'frame' ? 'page' : 'tool',
        label: event.type === 'frame' ? 'Screenshot' : event.name || 'Provider',
        image: event.image ? `data:image/jpeg;base64,${event.image}` : undefined,
    }))
    const logs = (provider: boolean) => events.filter(event => ['console', 'pageerror'].includes(event.type) && (event.source === 'provider') === provider)
        .map(event => `${event.name ? `[${event.name}] ` : ''}[${event.level || (event.type === 'pageerror' ? 'error' : 'log')}] ${event.text || event.message || ''}${event.url ? ` (${event.url}${event.line ? `:${event.line}` : ''})` : ''}`)
    const latest = [...events].reverse().find(event => event.networkSummary)?.networkSummary
    const pageCaptures = captures.filter(capture => capture.kind === 'page')
    const providerCaptures = new Map<string, Record<string, any>>()
    for (const event of events.filter(event => event.type === 'tool_capture')) providerCaptures.set(event.id || event.name, event)
    const providerReports = [...providerCaptures.values()].filter(event => event.id !== 'webcrack' || event.deobfuscatedCode).map(event => ({
        tool: event.name || event.id,
        url: event.url,
        status: event.error ? 'Unavailable' : 'Results',
        ...event.toolAnalysis,
        deobfuscatedCode: event.deobfuscatedCode,
        signals: event.toolAnalysis?.extractedSignals || [],
        error: event.error,
    }))
    return {
        ...saved,
        analystSummary: saved?.analystSummary || { narrative: `Loaded ${selected.target} and captured ${pageCaptures.length} screenshots.` },
        target: selected.target,
        finalUrl: captures.filter(capture => capture.kind === 'page').at(-1)?.url || saved?.finalUrl || selected.target,
        status: { ...saved?.status, run: selected.status },
        exportedAt: saved?.exportedAt || selected.created_at,
        captures: captures.length ? captures : saved?.captures || [],
        consoleEvents: events.length ? logs(false) : saved?.consoleEvents || [],
        providerConsoleEvents: events.length ? logs(true) : saved?.providerConsoleEvents || [],
        analystReport: { ...saved?.analystReport, ...(providerReports.length ? { providerReports } : {}), ...(latest ? { networkEvidence: {
            ...saved?.analystReport?.networkEvidence,
            requests: latest.requestCount, responses: latest.responseCount, domains: latest.uniqueDomainCount,
            blockedOrFailed: latest.blockedOrFailed, contactedDomains: latest.contactedDomains,
            downloads: latest.downloads, recentRequests: latest.recentRequests,
        } } : {}) },
        evidenceEvents: events.filter(event => !['frame', 'tool_capture', 'console', 'pageerror'].includes(event.type)),
        runId: selected.id,
        runs: versions.map(row => ({ id: row.id, startedAt: row.created_at, status: row.status })),
    }
}
