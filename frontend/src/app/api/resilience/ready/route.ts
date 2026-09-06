import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export function GET() {
    return NextResponse.json({ ok: true, service: 'frontend', site: process.env.RESILIENCE_SITE || 'unknown', release: process.env.HANASAND_RELEASE_COMMIT || 'unknown' }, { headers: { 'cache-control': 'no-store' } })
}
