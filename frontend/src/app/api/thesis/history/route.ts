import { NextRequest, NextResponse } from 'next/server'
import { canEditThesis } from '@/utils/thesis'
import config from '@/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const token = request.cookies.get('access_token')?.value
    const id = request.cookies.get('id')?.value
    if (!await canEditThesis(token, id)) return NextResponse.json({ error: 'Only eirikhanasand can view thesis history.' }, { status: 403 })
    const revision = request.nextUrl.searchParams.get('revision')
    const before = request.nextUrl.searchParams.get('before')
    if ([revision, before].some(value => value !== null && !/^\d+$/.test(value))) return NextResponse.json({ error: 'Invalid history version.' }, { status: 400 })
    const suffix = revision !== null ? `/${revision}` : before !== null ? `?before=${before}` : ''
    try {
        const response = await fetch(`${config.url.api}/thesis/history${suffix}`, {
            headers: { Authorization: `Bearer ${token}`, id: id! },
            cache: 'no-store',
            signal: AbortSignal.timeout(10000),
        })
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
    } catch {
        return NextResponse.json({ error: 'History could not be loaded.' }, { status: 500 })
    }
}
