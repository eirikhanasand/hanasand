import { NextRequest, NextResponse } from 'next/server'
import { demoDwmProductSnapshot } from '@/utils/dwm/product'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
    const snapshot = demoDwmProductSnapshot(new Date().toISOString())
    const terms = request.nextUrl.searchParams.get('watchlist') || request.nextUrl.searchParams.get('terms')
    if (!terms) {
        return NextResponse.json(snapshot, { headers: { 'cache-control': 'no-store' } })
    }

    const requestedTerms = terms.split(/[,\n]/).map(term => term.trim()).filter(Boolean)
    return NextResponse.json({
        ...snapshot,
        watchlist: requestedTerms.map(value => ({ value, kind: value.includes('.') ? 'domain' : 'unknown' })),
        requestedTerms,
    }, { headers: { 'cache-control': 'no-store' } })
}
