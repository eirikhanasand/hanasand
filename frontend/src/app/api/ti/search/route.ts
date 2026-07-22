import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { proxyApiTiRequest } from '../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get('q')?.trim() || ''
    if (query.length < 2 || query.length > 200) {
        return NextResponse.json({ error: 'invalid_query', message: 'query must contain 2-200 characters' }, { status: 400, headers: { 'cache-control': 'no-store' } })
    }

    try {
        const response = await fetch(`${authApiUrl().replace(/\/$/, '')}/ti/search`, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query }),
            signal: AbortSignal.timeout(15_000),
        })
        return new NextResponse(await response.text(), {
            status: response.status,
            headers: { 'cache-control': 'no-store', 'content-type': response.headers.get('content-type') || 'application/json' },
        })
    } catch {
        return NextResponse.json({ error: 'ti_search_unavailable', message: 'Threat-intelligence search is temporarily unavailable.' }, { status: 502, headers: { 'cache-control': 'no-store' } })
    }
}

export async function POST(request: NextRequest) {
    return proxyApiTiRequest(request, '/ti/search', { method: 'POST' })
}
