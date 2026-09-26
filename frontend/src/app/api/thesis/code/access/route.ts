import { NextRequest, NextResponse } from 'next/server'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
export async function GET(request: NextRequest) {
    const session = await requireApiSession(request)
    if ('response' in session) return json({ authenticated: false, signInRequired: true }, session.response.status)
    try { return json({ authenticated: await isHanasandOrganizationMember(session.identity.token, session.identity.id), signInRequired: false }) }
    catch { return json({ error: 'Organization membership could not be checked. Please retry.' }, 503) }
}
