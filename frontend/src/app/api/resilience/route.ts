import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export async function GET() {
    try {
        const response = await fetch(process.env.RESILIENCE_STATUS_URL || 'https://api.hanasand.com/api/resilience/status', { cache: 'no-store', signal: AbortSignal.timeout(3000) })
        const state = await response.json()
        return NextResponse.json(state, { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch {
        return NextResponse.json({ mode: 'unknown', readOnly: true, services: [], reason: 'Service status is reconnecting.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
}
