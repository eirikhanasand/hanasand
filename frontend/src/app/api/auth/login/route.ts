import { NextRequest, NextResponse } from 'next/server'
import { setAuthCookies } from '../_authCookies'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function POST(req: NextRequest) {
    const { body, redirectPath, wantsRedirect } = await parseAuthBody(req)
    const id = body?.id?.trim()
    const password = body?.password

    if (!id || !password) {
        if (wantsRedirect) {
            return authRedirect(req, redirectPath, 'Username and password are required.')
        }
        return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    const upstream = await fetch(`${authApiUrl()}/auth/login/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        if (wantsRedirect) {
            return authRedirect(req, redirectPath, 'Authentication service is unavailable.')
        }
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    const responseText = await upstream.text()
    const data = parseJson(responseText)

    if (!upstream.ok) {
        if (wantsRedirect) {
            return authRedirect(req, redirectPath, data?.error || responseText || 'Unable to log in.')
        }
        return NextResponse.json(data || { error: responseText || 'Unable to log in.' }, { status: upstream.status })
    }
    if (!data?.token || !data?.id || !data?.name) {
        if (wantsRedirect) {
            return authRedirect(req, redirectPath, 'Login succeeded, but the session could not be created.')
        }
        return NextResponse.json({ error: 'Login succeeded, but the session could not be created.' }, { status: 502 })
    }

    if (wantsRedirect) {
        const response = NextResponse.redirect(new URL(safeRedirectPath(redirectPath), req.url), { status: 303 })
        setAuthCookies(req, response, data)
        return response
    }

    const response = NextResponse.json({
        name: data.name,
        id: data.id,
        avatar: data.avatar ?? null,
        expires_at: data.expires_at ?? null,
        roles: data.roles ?? [],
    })
    setAuthCookies(req, response, data)
    return response
}

async function parseAuthBody(req: NextRequest) {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const form = await req.formData()
        return {
            body: {
                id: String(form.get('username') || form.get('id') || ''),
                password: String(form.get('password') || ''),
            },
            redirectPath: String(form.get('redirectPath') || '/dashboard'),
            wantsRedirect: true,
        }
    }

    return {
        body: await req.json().catch(() => null) as { id?: string, password?: string } | null,
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

function authRedirect(req: NextRequest, redirectPath: string, error: string) {
    const url = new URL('/login', req.url)
    url.searchParams.set('path', safeRedirectPath(redirectPath))
    url.searchParams.set('error', error)
    return NextResponse.redirect(url, { status: 303 })
}

function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
        return '/dashboard'
    }

    return path
}
