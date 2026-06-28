import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type ControlActionBody = {
    action?: 'run_query' | 'source_apply_plan' | 'public_channel_status' | 'canary_run' | 'request_source' | 'create_watchlist' | 'rebuild_alerts'
    query?: string
    sourceId?: string
    sourcePackIds?: string[]
    actions?: string[]
    target?: string
    targets?: string[]
    sourceType?: 'telegram_channel' | 'restricted_metadata'
    activate?: boolean
    approveMetadataOnly?: boolean
    watchlistName?: string
    terms?: string[]
    webhookUrl?: string
}

export async function GET(request: NextRequest) {
    const base = scraperBase()
    if (!base) return unavailable('TI_SCRAPER_API_BASE is not configured.')

    const query = request.nextUrl.searchParams.get('q')?.trim() || 'APT29'
    const tenantId = request.headers.get('x-tenant-id') || 'default'

    const [
        health,
        sources,
        frontier,
        resources,
        productSlo,
        canary,
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
        fetchJson(base, '/v1/ops/canary'),
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
            canary: endpointResult(canary),
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
        canary: canary.json,
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
    const base = scraperBase()
    if (!base) return unavailable('TI_SCRAPER_API_BASE is not configured.')

    let body: ControlActionBody
    try {
        body = await request.json() as ControlActionBody
    } catch {
        return NextResponse.json({ ok: false, error: { code: 'invalid_json', message: 'JSON body is required.' } }, { status: 400 })
    }

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
            reason: 'operator requested scraper control-room run',
        })
    }

    if (body.action === 'source_apply_plan') {
        return forward(base, '/v1/sources/apply-plan', {
            queryScope: { queries: [query], entityTypes: ['actor'] },
            sourcePackIds: body.sourcePackIds?.length ? body.sourcePackIds : ['safe-public-cti-starter-pack'],
            selectedActions: body.actions?.length ? body.actions : ['approve', 'quarantine', 'request_legal_notes', 'leave_unchanged'],
            includeExecutionPreview: true,
        })
    }

    if (body.action === 'public_channel_status') {
        const target = `/v1/public-channels/status?query=${encodeURIComponent(query)}&tenantId=hanasand-dashboard`
        const result = await fetchJson(base, target)
        return NextResponse.json({ ok: result.ok, status: result.status, payload: result.json, error: result.error }, { status: result.ok ? 200 : 502 })
    }

    if (body.action === 'canary_run') {
        return forward(base, '/v1/ops/canary/run', {
            operatorApproval: true,
            approvedBy: 'dashboard/ti/control',
            maxSources: 8,
            maxTasks: 12,
            generatedAt: new Date().toISOString(),
        })
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
            priority: 'high',
        })
    }

    if (body.action === 'create_watchlist') {
        return forward(base, '/v1/dwm/watchlists', {
            tenantId: 'default',
            name: body.watchlistName || `${query} watchlist`,
            terms: body.terms?.length ? body.terms : [query],
            webhookUrl: body.webhookUrl,
            status: 'active',
        })
    }

    if (body.action === 'rebuild_alerts') {
        return forward(base, '/v1/dwm/alerts/rebuild', {
            tenantId: 'default',
            actor: 'dashboard/ti/control',
        })
    }

    return NextResponse.json({ ok: false, error: { code: 'unsupported_action', message: 'Unsupported scraper control action.' } }, { status: 400 })
}

function scraperBase() {
    return process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
}

async function forward(base: string, path: string, body: unknown) {
    const result = await fetchJson(base, path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    return NextResponse.json({ ok: result.ok, status: result.status, payload: result.json, error: result.error }, { status: result.ok ? 200 : 502 })
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
