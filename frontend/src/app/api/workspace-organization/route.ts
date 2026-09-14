import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { readWorkspace, WORKSPACE_COOKIE, type Workspace } from '@/utils/organizations/workspace'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
    const session = await requireApiSession(request)
    if ('response' in session) return session.response
    const store = await cookies()
    const userId = store.get('impersonating_id')?.value || session.identity.id
    return NextResponse.json({ workspace: readWorkspace(store.get(WORKSPACE_COOKIE)?.value, userId) }, { headers: { 'cache-control': 'no-store' } })
}
export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host')
    if (origin && new URL(origin).host !== host) return NextResponse.json({ error: 'Cross-site workspace changes are not allowed.' }, { status: 403 })
    const session = await requireApiSession(request)
    if ('response' in session) return session.response
    const store = await cookies()
    const userId = store.get('impersonating_id')?.value || session.identity.id
    let body: { org?: unknown }
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Choose an organization.' }, { status: 400 }) }
    if (!body || typeof body.org !== 'string' || body.org.length > 200) return NextResponse.json({ error: 'Choose an organization.' }, { status: 400 })
    const organizationId = body.org.trim()
    let name = 'Personal workspace'
    if (organizationId) {
        try {
            const response = await fetch(`${authApiUrl().replace(/\/$/, '')}/organizations/${encodeURIComponent(organizationId)}`, {
                cache: 'no-store', signal: AbortSignal.timeout(8000),
                headers: { Authorization: `Bearer ${session.identity.token}`, id: session.identity.id,
                    ...(store.get('impersonation_token')?.value ? { 'x-impersonation-token': store.get('impersonation_token')!.value } : {}) },
            })
            if (!response.ok) return NextResponse.json({ error: response.status === 403 || response.status === 404 ? 'You do not have access to this organization.' : 'Organization access could not be checked. Please retry.' }, { status: [403, 404].includes(response.status) ? response.status : 503 })
            const payload = await response.json()
            const organization = payload.organization || payload
            if (organization.id !== organizationId || organization.lifecycleStatus !== 'active') return NextResponse.json({ error: 'This organization is not active.' }, { status: 403 })
            name = organization.name || organization.slug || organizationId
        } catch { return NextResponse.json({ error: 'Organization access could not be checked. Please retry.' }, { status: 503 }) }
    }
    const workspace: Workspace = { userId, organizationId, name }
    const response = NextResponse.json({ workspace }, { headers: { 'cache-control': 'no-store' } })
    response.cookies.set(WORKSPACE_COOKIE, JSON.stringify(workspace), { httpOnly: true, secure: request.nextUrl.protocol === 'https:' || Boolean(host?.endsWith('hanasand.com')), sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90 })
    return response
}
