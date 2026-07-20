import { NextRequest, NextResponse } from 'next/server'
import tokenIsValid from './tokenIsValid'

export type ApiSessionIdentity = {
    id: string
    token: string
    roles: string[]
}

export default async function requireApiSession(request: NextRequest, allowedRoles?: string[]): Promise<{ identity: ApiSessionIdentity } | { response: NextResponse }> {
    const token = request.cookies.get('access_token')?.value || bearerToken(request.headers.get('authorization'))
    const id = request.cookies.get('id')?.value || request.headers.get('id') || ''
    if (!token || !id) return { response: authError(401, 'authentication_required', 'A valid Hanasand session is required.') }

    const validation = await tokenIsValid(token, id)
    if (!validation.valid) return { response: authError(401, 'invalid_session', 'The Hanasand session is invalid or expired.') }

    const roles = (validation.roles ?? [])
        .flatMap(role => [role.id, (role as Role & { role_id?: string }).role_id])
        .filter((role): role is string => Boolean(role))
    if (allowedRoles?.length && !roles.some(role => allowedRoles.includes(role))) {
        return { response: authError(403, 'operator_role_required', 'System administrator access is required.') }
    }

    return { identity: { id, token: validation.token || token, roles } }
}

function bearerToken(value: string | null) {
    return value?.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : ''
}

function authError(status: number, code: string, message: string) {
    return NextResponse.json({ ok: false, error: { code, message } }, { status })
}
