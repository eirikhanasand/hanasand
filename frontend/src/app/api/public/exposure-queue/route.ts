import { NextRequest, NextResponse } from 'next/server'
import { fetchSharedExposureQueue } from '@/utils/dwm/sharedExposureQueue'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const response = await fetchSharedExposureQueue(request.nextUrl.searchParams, { timeoutMs: 5_000 })
    const headers = new Headers(response.headers)
    headers.set('content-type', response.headers.get('content-type') || 'application/json')
    // The scraper owns an atomic, indefinitely retained snapshot cache. Keep
    // browser/proxy caches out of this response so every refresh reaches that
    // fast snapshot and never pins an older result in a client.
    headers.set('cache-control', response.ok ? 'private, no-store' : 'no-store')
    return new NextResponse(response.body, { status: response.status, headers })
}
