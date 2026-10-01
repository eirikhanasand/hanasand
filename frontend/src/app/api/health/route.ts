import { NextResponse } from 'next/server'
import config from '@/config'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const response = await fetch(new URL('/health', config.url.api), {
            cache: 'no-store',
            signal: AbortSignal.timeout(2000),
        })
        if (!response.ok) throw new Error(`API health returned ${response.status}`)
        return NextResponse.json({
            ok: true,
            service: 'frontend',
            release: process.env.HANASAND_RELEASE_COMMIT || 'unknown',
            api: await response.json(),
        }, { headers: { 'cache-control': 'no-store' } })
    } catch {
        return NextResponse.json({ ok: false, service: 'frontend', error: 'API is unavailable' }, {
            status: 503,
            headers: { 'cache-control': 'no-store' },
        })
    }
}
