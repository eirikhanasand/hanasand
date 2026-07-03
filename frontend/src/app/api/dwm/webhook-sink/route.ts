import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    const receivedAt = new Date().toISOString()
    const eventId = request.headers.get('x-hanasand-event-id') || request.headers.get('x-webhook-id') || `dwm_sink_${Date.now()}`

    return NextResponse.json({
        schemaVersion: 'dwm.webhook_sink.acceptance.v1',
        accepted: true,
        eventId,
        receivedAt,
    }, {
        status: 202,
        headers: { 'cache-control': 'no-store' },
    })
}
