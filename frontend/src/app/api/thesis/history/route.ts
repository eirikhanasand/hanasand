import { NextRequest, NextResponse } from 'next/server'
import { canEditThesis } from '@/utils/thesis'
import config from '@/config'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const access = await requireApiSession(request)
    if ('response' in access) return access.response
    const { token, id } = access.identity
    try { if (!await isHanasandOrganizationMember(token, id)) return NextResponse.json({ error: 'Hanasand organization membership is required.' }, { status: 403 }) } catch { return NextResponse.json({ error: 'Organization membership could not be checked.' }, { status: 503 }) }
    if (!await canEditThesis(token, id)) return NextResponse.json({ error: 'Hanasand organization owners and editors can view thesis history.' }, { status: 403 })
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
