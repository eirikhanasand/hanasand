import { NextResponse } from 'next/server'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const response = await fetch(new URL('/v1/public/coverage', tiScraperApiBase()), { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
        const body = await response.json().catch(() => ({ error: { code: 'invalid_response', message: 'Coverage data was not readable.' } }))
        return NextResponse.json(body, { status: response.status, headers: { 'cache-control': 'no-store, max-age=0' } })
    } catch {
        return NextResponse.json({ error: { code: 'coverage_unavailable', message: 'Coverage data is temporarily unavailable.' } }, { status: 503, headers: { 'cache-control': 'no-store, max-age=0' } })
    }
}
