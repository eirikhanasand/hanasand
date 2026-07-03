import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const response = await proxyTiRequest(request, '/v1/dwm/exposure-queue', { method: 'GET' })
    if (response.status !== 503 && response.status !== 502) {
        return response
    }

    return NextResponse.json({
        schemaVersion: 'dwm.exposure_queue.v1',
        generatedAt: new Date().toISOString(),
        status: 'checking',
        freshness: {
            latestClaimAt: null,
            ageMinutes: null,
            maxLiveAgeMinutes: 60,
        },
        scheduler: {
            state: 'checking',
            cadenceSeconds: 300,
        },
        counts: {
            visible: 0,
            total: 0,
            needsReview: 0,
            metadataOnly: 0,
        },
        page: {
            limit: Number(request.nextUrl.searchParams.get('limit') || 20),
            offset: Number(request.nextUrl.searchParams.get('offset') || 0),
            total: 0,
            nextOffset: null,
            hasMore: false,
        },
        items: [],
    }, { status: 202, headers: { 'cache-control': 'no-store' } })
}
