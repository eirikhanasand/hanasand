import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const token = request.cookies.get('access_token')?.value
    const id = request.cookies.get('id')?.value
    if (!token || !id) return NextResponse.json({ message: 'Sign in to browse databases.' }, { status: 401 })
    try {
        const response = await fetch(`${config.url.internal}/db/browse?${request.nextUrl.searchParams}`, {
            cache: 'no-store', headers: { Authorization: `Bearer ${token}`, id }, signal: AbortSignal.timeout(5000),
        })
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
    } catch {
        return NextResponse.json({ message: 'Database preview unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
}
