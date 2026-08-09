import { NextRequest, NextResponse } from 'next/server'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ path?: string[] }> }

export async function GET(request: NextRequest, context: Context) {
    const segments = (await context.params).path || []
    if (segments.length !== 1 || !['status', 'search'].includes(segments[0] || '')) {
        return failure(404, 'darkweb_route_not_found', 'The dark web read route was not found.')
    }

    const target = new URL(`/v1/darkweb/${segments[0]}`, tiScraperApiBase())
    if (segments[0] === 'search') {
        for (const name of ['limit', 'q', 'category', 'legalTriage', 'network', 'reviewState']) {
            const value = request.nextUrl.searchParams.get(name)
            if (value) target.searchParams.set(name, value)
        }
    }

    try {
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(12_000) })
        return new NextResponse(response.body, {
            status: response.status,
            headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store, max-age=0' },
        })
    } catch {
        return failure(503, 'darkweb_unavailable', 'The dark web index is temporarily unavailable.')
    }
}

function failure(status: number, code: string, message: string) {
    return NextResponse.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store, max-age=0' } })
}
