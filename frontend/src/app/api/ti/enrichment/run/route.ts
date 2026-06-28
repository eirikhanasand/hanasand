import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const body = await request.text()
        const response = await fetch(`${config.url.api}/ti/enrichment/run`, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'content-type': 'application/json' },
            body,
            signal: AbortSignal.timeout(20000),
        })
        const text = await response.text()
        const payload = text ? JSON.parse(text) as unknown : {}
        return NextResponse.json(payload, { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: {
                code: 'ti_enrichment_run_failed',
                message: error instanceof Error ? error.message : String(error),
            },
        }, { status: 502 })
    }
}
