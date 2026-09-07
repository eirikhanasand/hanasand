import { clientHeaders } from '@/utils/auth/clientHeaders'
import { NextRequest, NextResponse } from 'next/server'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import { setAuthCookies } from '../_authCookies'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function POST(req: NextRequest) {
    const { body, redirectPath, wantsRedirect } = await parseAuthBody(req)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const password = body?.password
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!name || !id || !password || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (wantsRedirect) {
            return authRedirect(req, '/register', 'Name, username, valid email, and password are required.')
        }
        return NextResponse.json({ error: 'Name, username, valid email, and password are required.' }, { status: 400 })
    }
    if (reservedUsernames.includes(id.toLowerCase())) {
        if (wantsRedirect) {
            return authRedirect(req, '/register', 'This username is reserved.')
        }
        return NextResponse.json({ error: 'This username is reserved.' }, { status: 400 })
    }

    const upstream = await fetch(`${authApiUrl()}/user`, {
        method: 'POST',
        headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, id, password, email }),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        if (wantsRedirect) {
            return authRedirect(req, '/register', 'Authentication service is unavailable.')
        }
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    const responseText = await upstream.text()
    const data = parseJson(responseText)

    if (!upstream.ok) {
        if (wantsRedirect) {
            return authRedirect(req, '/register', String(data?.error || responseText || 'Unable to create account.'))
        }
        return NextResponse.json(data || { error: responseText || 'Unable to create account.' }, { status: upstream.status })
    }
    if (!data?.id || !data?.name) {
        if (wantsRedirect) {
            return authRedirect(req, '/register', 'Account created, but the session could not be created.')
        }
        return NextResponse.json({ error: 'Account created, but the session could not be created.' }, { status: 502 })
    }

    const loginData = data.token ? data : await createLoginSession(req, data.id, password)
    if (!loginData?.token || !loginData?.id || !loginData?.name) {
        if (wantsRedirect) {
            return authRedirect(req, '/register', 'Account created, but the session could not be created.')
        }
        return NextResponse.json({ error: 'Account created, but the session could not be created.' }, { status: 502 })
    }

    if (wantsRedirect) {
        const response = redirectTo(safeRedirectPath(redirectPath))
        setAuthCookies(req, response, loginData)
        return response
    }

    const response = NextResponse.json({
        name: loginData.name,
        id: loginData.id,
        avatar: loginData.avatar ?? null,
        expires_at: loginData.expires_at ?? null,
        roles: loginData.roles ?? [],
    })
    setAuthCookies(req, response, loginData)
    return response
}

async function parseAuthBody(req: NextRequest) {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const form = await req.formData()
        return {
            body: {
                name: String(form.get('name') || ''),
                id: String(form.get('username') || form.get('id') || ''),
                password: String(form.get('password') || ''),
                email: String(form.get('email') || ''),
            },
            redirectPath: String(form.get('redirectPath') || '/dashboard'),
            wantsRedirect: true,
        }
    }

    return {
        body: await req.json().catch(() => null) as { name?: string, id?: string, password?: string, email?: string } | null,
        redirectPath: '/dashboard',
        wantsRedirect: false,
    }
}

function parseJson(text: string) {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

async function createLoginSession(req: NextRequest, id: string, password: string) {
    const upstream = await fetch(`${authApiUrl()}/auth/login/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
    }).catch(() => null)

    if (!upstream?.ok) {
        return null
    }

    return parseJson(await upstream.text())
}

function authRedirect(_req: NextRequest, path: string, error: string) {
    const search = new URLSearchParams({ error })
    return redirectTo(`${path}?${search.toString()}`)
}

function redirectTo(path: string) {
    return new NextResponse(null, {
        status: 303,
        headers: { Location: path },
    })
}

function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
        return '/dashboard'
    }

    return path
}
