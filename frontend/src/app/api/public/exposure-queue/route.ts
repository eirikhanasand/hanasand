import { NextRequest, NextResponse } from 'next/server'
import { fetchSharedExposureQueue } from '@/utils/dwm/sharedExposureQueue'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const response = await fetchSharedExposureQueue(request.nextUrl.searchParams, { timeoutMs: 5_000 })
    const headers = new Headers(response.headers)
    headers.set('content-type', response.headers.get('content-type') || 'application/json')
    headers.set('cache-control', response.ok ? 'public, max-age=5, stale-while-revalidate=30' : 'no-store')
    return new NextResponse(response.body, { status: response.status, headers })
}
