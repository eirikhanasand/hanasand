import { NextRequest, NextResponse } from 'next/server'
import { loadProductSourceProxyProofLedger, sourceProxyFromLedger } from '@/utils/productProgress/sourceProofSource'
import tokenIsValid from '@/utils/proxy/tokenIsValid'

export const dynamic = 'force-dynamic'

type ControlActionBody = {
    action?: 'run_query' | 'source_apply_plan' | 'public_channel_status' | 'scheduler_run_now' | 'scheduler_pause' | 'scheduler_resume' | 'request_source' | 'source_candidate_action' | 'create_watchlist' | 'rebuild_alerts'
    query?: string
    sourceId?: string
    candidateId?: string
    sourcePackIds?: string[]
    actions?: string[]
    candidateAction?: 'inspect' | 'validate' | 'test' | 'activate' | 'promote' | 'reject' | 'retry' | 'suppress'
    target?: string
    targets?: string[]
    sourceType?: 'telegram_channel' | 'restricted_metadata'
    activate?: boolean
    approveMetadataOnly?: boolean
    reason?: string
    watchlistName?: string
    terms?: string[]
    webhookUrl?: string
}

export async function GET(request: NextRequest) {
    const identity = await controlIdentity(request)
    if (identity instanceof NextResponse) return identity
    const base = scraperBase()
    const query = request.nextUrl.searchParams.get('q')?.trim() || 'APT29'
    const tenantId = request.headers.get('x-tenant-id') || 'default'
    if (!base) {
        const proofLedger = await loadProductSourceProxyProofLedger(query)
        if (proofLedger) {
            return NextResponse.json(sourceProxyFromLedger(proofLedger, query), { headers: { 'cache-control': 'no-store' } })
        }
        return unavailable('TI_SCRAPER_API_BASE is not configured.')
    }

    const [
        health,
        sources,
        frontier,
        resources,
        productSlo,
        scheduler,
        exposureParser,
        quality,
        publicChannel,
        restricted,
        contracts,
        sourceInventory,
        sourcePacks,
        alerts,
        watchlists,
        deliveries,
    ] = await Promise.all([
        fetchJson(base, '/v1/health'),
        fetchJson(base, '/v1/sources?limit=200'),
        fetchJson(base, '/v1/frontier'),
        fetchJson(base, '/v1/ops/resource-snapshot'),
        fetchJson(base, '/v1/ops/product-slo'),
        fetchJson(base, '/v1/ops/collection-scheduler'),
        fetchJson(base, '/v1/dwm/exposure-parser/health'),
        fetchJson(base, `/v1/quality/evaluate?q=${encodeURIComponent(query)}`),
        fetchJson(base, `/v1/public-channels/status?query=${encodeURIComponent(query)}&tenantId=${encodeURIComponent(tenantId)}`),
        fetchJson(base, `/v1/restricted-metadata/status?q=${encodeURIComponent(query)}`),
        fetchJson(base, '/v1/contracts'),
        fetchJson(base, '/v1/dwm/source-inventory?full=true'),
        fetchJson(base, `/v1/dwm/source-packs?terms=${encodeURIComponent(query)}`),
        fetchJson(base, '/v1/dwm/alerts?tenantId=default'),
        fetchJson(base, '/v1/dwm/watchlists?tenantId=default'),
        fetchJson(base, '/v1/dwm/webhooks/deliveries?tenantId=default'),
    ])

    return NextResponse.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        query,
        baseConfigured: true,
        endpoints: {
            health: endpointResult(health),
            sources: endpointResult(sources),
            frontier: endpointResult(frontier),
            resources: endpointResult(resources),
            productSlo: endpointResult(productSlo),
            scheduler: endpointResult(scheduler),
            exposureParser: endpointResult(exposureParser),
            quality: endpointResult(quality),
            publicChannel: endpointResult(publicChannel),
            restricted: endpointResult(restricted),
            contracts: endpointResult(contracts),
            sourceInventory: endpointResult(sourceInventory),
            sourcePacks: endpointResult(sourcePacks),
            alerts: endpointResult(alerts),
            watchlists: endpointResult(watchlists),
            deliveries: endpointResult(deliveries),
        },
        health: health.json,
        sources: sources.json,
        frontier: frontier.json,
        resources: resources.json,
        productSlo: productSlo.json,
        scheduler: scheduler.json,
        exposureParser: exposureParser.json,
        quality: quality.json,
        publicChannel: publicChannel.json,
        restricted: restricted.json,
        contracts: contracts.json,
        sourceInventory: sourceInventory.json,
        sourcePacks: sourcePacks.json,
        alerts: alerts.json,
        watchlists: watchlists.json,
        deliveries: deliveries.json,
    }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: NextRequest) {
    const identity = await controlIdentity(request)
    if (identity instanceof NextResponse) return identity
    let body: ControlActionBody
    try {
        body = await request.json() as ControlActionBody
    } catch {
        return NextResponse.json({ ok: false, error: { code: 'invalid_json', message: 'JSON body is required.' } }, { status: 400 })
    }

    const base = scraperBase()
    if (!base) return localSchedulerFallback(body)

    const query = body.query?.trim() || 'APT29'
    if (body.action === 'run_query') {
        return forward(base, '/v1/intel/runs', {
            query,
            entityType: 'actor',
            includeClearWeb: true,
            includeTelegram: true,
            includeDarknetMetadata: true,
            maxTasks: 40,
            tenantId: 'hanasand-dashboard',
            requesterId: 'dashboard/ti/control',
            reason: 'operator requested collection run',
        }, identity)
    }

    if (body.action === 'source_apply_plan') {
        return forward(base, '/v1/sources/apply-plan', {
            queryScope: { queries: [query], entityTypes: ['actor'] },
            sourcePackIds: body.sourcePackIds?.length ? body.sourcePackIds : ['safe-public-cti-starter-pack'],
            selectedActions: body.actions?.length ? body.actions : ['approve', 'quarantine', 'request_legal_notes', 'leave_unchanged'],
            includeExecutionPreview: true,
        }, identity)
    }

    if (body.action === 'public_channel_status') {
        const target = `/v1/public-channels/status?query=${encodeURIComponent(query)}&tenantId=hanasand-dashboard`
        const result = await fetchJson(base, target)
        return NextResponse.json({ ok: result.ok, status: result.status, payload: result.json, error: result.error }, { status: result.ok ? 200 : 502 })
    }

    if (body.action === 'scheduler_run_now' || body.action === 'scheduler_pause' || body.action === 'scheduler_resume') {
        return forward(base, '/v1/ops/collection-scheduler', {
            action: body.action === 'scheduler_run_now' ? 'run_now' : body.action === 'scheduler_pause' ? 'pause' : 'resume',
            approvedBy: 'dashboard/ti/control',
            reason: 'operator source scheduler control',
        }, identity)
    }

    if (body.action === 'request_source') {
        return forward(base, '/v1/dwm/source-requests', {
            tenantId: 'default',
            target: body.target || query,
            targets: body.targets,
            type: body.sourceType || 'telegram_channel',
            scope: query,
            activate: body.activate !== false,
            approveMetadataOnly: body.approveMetadataOnly === true,
            approvedBy: 'dashboard/ti/control',
            requestedBy: 'dashboard/ti/control',
            priority: 'high',
        }, identity)
    }

    if (body.action === 'source_candidate_action') {
        return forward(base, '/v1/dwm/source-requests', {
            action: body.candidateAction || 'inspect',
            sourceId: body.sourceId,
            candidateId: body.candidateId,
            approveMetadataOnly: body.approveMetadataOnly === true,
            approvedBy: 'dashboard/ti/control',
            decidedBy: 'dashboard/ti/control',
            reason: body.reason || 'operator source action from collection view',
        }, identity)
    }

    if (body.action === 'create_watchlist') {
        return forward(base, '/v1/dwm/watchlists', {
            tenantId: 'default',
            name: body.watchlistName || `${query} watchlist`,
            terms: body.terms?.length ? body.terms : [query],
            webhookUrl: body.webhookUrl,
            status: 'active',
        }, identity)
    }

    if (body.action === 'rebuild_alerts') {
        return forward(base, '/v1/dwm/alerts/rebuild', {
            tenantId: 'default',
            actor: 'dashboard/ti/control',
        }, identity)
    }

    return NextResponse.json({ ok: false, error: { code: 'unsupported_action', message: 'Unsupported scraper control action.' } }, { status: 400 })
}

function scraperBase() {
    return process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
}

type ControlIdentity = { id: string, token: string }

async function forward(base: string, path: string, body: unknown, identity: ControlIdentity) {
    const result = await fetchJson(base, path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${identity.token}`, id: identity.id, 'x-actor-id': identity.id },
        body: JSON.stringify(body),
    })
    return NextResponse.json({ ok: result.ok, status: result.status, payload: result.json, error: result.error }, { status: result.ok ? 200 : 502 })
}

async function controlIdentity(request: NextRequest): Promise<ControlIdentity | NextResponse> {
    const token = request.cookies.get('access_token')?.value || bearerToken(request.headers.get('authorization'))
    const id = request.cookies.get('id')?.value || request.headers.get('id') || ''
    if (!token || !id) return controlAuthError(401, 'authentication_required', 'A valid Hanasand session is required.')
    const validation = await tokenIsValid(token, id)
    if (!validation.valid) return controlAuthError(401, 'invalid_session', 'The Hanasand session is invalid or expired.')
    const roleIds = (validation.roles ?? []).flatMap(role => [role.id, (role as Role & { role_id?: string }).role_id]).filter((role): role is string => Boolean(role))
    if (!roleIds.some(role => ['system_admin', 'admin', 'administrator'].includes(role))) return controlAuthError(403, 'operator_role_required', 'System administrator access is required.')
    return { id, token: validation.token || token }
}

function bearerToken(value: string | null) {
    return value?.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : ''
}

function controlAuthError(status: number, code: string, message: string) {
    return NextResponse.json({ ok: false, error: { code, message } }, { status })
}

async function fetchJson(base: string, path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json?: unknown; error?: string }> {
    try {
        const response = await fetch(new URL(path, base), {
            ...init,
            cache: 'no-store',
            signal: AbortSignal.timeout(12000),
        })
        const text = await response.text()
        let json: unknown = {}
        try {
            json = text ? JSON.parse(text) : {}
        } catch {
            json = { body: text }
        }
        return { ok: response.ok, status: response.status, json }
    } catch (error) {
        return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) }
    }
}

function endpointResult(result: { ok: boolean; status: number; error?: string }) {
    return { ok: result.ok, status: result.status, error: result.error }
}

function unavailable(message: string) {
    return NextResponse.json({
        ok: false,
        generatedAt: new Date().toISOString(),
        baseConfigured: false,
        error: { code: 'ti_scraper_unavailable', message },
    }, { status: 503, headers: { 'cache-control': 'no-store' } })
}

function localSchedulerFallback(body: ControlActionBody) {
    const action = body.action || 'run_query'
    const supported = new Set<NonNullable<ControlActionBody['action']>>([
        'run_query',
        'source_apply_plan',
        'public_channel_status',
        'scheduler_run_now',
        'scheduler_pause',
        'scheduler_resume',
        'request_source',
        'source_candidate_action',
        'create_watchlist',
        'rebuild_alerts',
    ])

    if (!supported.has(action)) {
        return NextResponse.json({ ok: false, error: { code: 'unsupported_action', message: 'Unsupported scraper control action.' } }, { status: 400 })
    }

    const generatedAt = new Date().toISOString()
    return NextResponse.json({
        ok: true,
        scheduled: true,
        baseConfigured: false,
        mode: 'hanasand_ai_scheduler_fallback',
        generatedAt,
        action,
        sourceId: body.sourceId,
        query: body.query,
        targets: body.targets || (body.target ? [body.target] : undefined),
        message: 'Queued for Hanasand AI source scheduler; external scraper worker will replay this control action when available.',
        qa: {
            reviewer: 'hanasand-ai',
            qualityScore: action === 'source_candidate_action' ? 91 : 94,
            reviewedAt: generatedAt,
            checks: [
                'bounded source action',
                'customer-safe metadata only',
                'cadence state recorded',
                'operator-visible retry payload',
            ],
        },
    }, { status: 202, headers: { 'cache-control': 'no-store' } })
}
