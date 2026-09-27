import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
    const token = request.cookies.get('access_token')?.value
    const id = request.cookies.get('id')?.value
    if (!token || !id) return NextResponse.json({ ok: false }, { status: 401 })
    try {
        const response = await fetch(`${config.url.internal}/db/health`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}`, id }, signal: AbortSignal.timeout(4000) })
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
    } catch {
        return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
}
