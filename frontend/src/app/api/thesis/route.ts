import { NextRequest, NextResponse } from 'next/server'
import { canEditThesis, readThesis, validThesis, writeThesis } from '@/utils/thesis'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const access = await requireApiSession(request)
    if ('response' in access) return access.response
    try {
        if (!await isHanasandOrganizationMember(access.identity.token, access.identity.id)) return NextResponse.json({ error: 'Hanasand organization membership is required.' }, { status: 403 })
        return NextResponse.json(await readThesis(access.identity.token, access.identity.id), { headers: { 'Cache-Control': 'no-store' } })
    } catch {
        return NextResponse.json({ error: 'The thesis could not be loaded.' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }
    const access = await requireApiSession(request)
    if ('response' in access) return access.response
    try {
        if (!await isHanasandOrganizationMember(access.identity.token, access.identity.id)) return NextResponse.json({ error: 'Hanasand organization membership is required.' }, { status: 403 })
    } catch { return NextResponse.json({ error: 'Organization membership could not be checked.' }, { status: 503 }) }
    if (!await canEditThesis(access.identity.token, access.identity.id)) {
        return NextResponse.json({ error: 'Hanasand organization owners and editors can edit the thesis.' }, { status: 403 })
    }
    const document = await request.json().catch(() => null)
    if (!validThesis(document)) return NextResponse.json({ error: 'Enter a non-empty title of at most 500 characters.' }, { status: 400 })
    try {
        const response = await writeThesis(document, access.identity.token, access.identity.id)
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
    } catch {
        return NextResponse.json({ error: 'The thesis could not be saved. Your draft is kept in this browser.' }, { status: 500 })
    }
}

// sendBeacon uses POST when the page is being hidden or closed.
export const POST = PUT
