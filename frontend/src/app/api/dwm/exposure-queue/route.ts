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
        status: 'waiting_for_collection',
        freshness: {
            latestClaimAt: null,
            ageMinutes: null,
            maxLiveAgeMinutes: 60,
        },
        parser: {
            service: 'hanasand-ai',
            aiEndpointConfigured: false,
            fallbackParser: 'metadata-safe-ransomware-claim-parser:v1',
        },
        scheduler: {
            state: 'due',
            cadenceSeconds: 300,
            sourceFamilies: ['darkweb_metadata', 'telegram_public', 'public_advisory'],
            ingestEndpoint: '/v1/dwm/exposure-claims/ingest',
        },
        counts: {
            visible: 0,
            needsReview: 0,
            metadataOnly: 0,
        },
        items: [],
    }, { status: 202, headers: { 'cache-control': 'no-store' } })
}
