import { NextRequest, NextResponse } from 'next/server'
import { setAuthCookies } from '../_authCookies'
import { authApiUrl } from '@/utils/auth/authApiUrl'

type AuthFailureInput = {
    req: NextRequest
    id: string
    redirectPath: string
    statusCode: number
    errorCode: string
    message: string
    upstreamStatus?: number
}

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

    const requestId = requestIdFor(req)
    const upstream = await fetch(`${authApiUrl()}/auth/login/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
        body: JSON.stringify({ password }),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        await recordFrontendAuthFailure({
            req,
            id,
            redirectPath,
            statusCode: 502,
            errorCode: 'auth_service_unavailable',
            message: 'Authentication service is unavailable.',
        })
        if (wantsRedirect) {
            return authRedirect(req, redirectPath, 'Authentication service is unavailable.')
        }
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    const responseText = await upstream.text()
    const data = parseJson(responseText)

    if (!upstream.ok) {
        await recordFrontendAuthFailure({
            req,
            id,
            redirectPath,
            statusCode: upstream.status,
            errorCode: normalizeErrorCode(data?.code || data?.error || responseText || `http_${upstream.status}`),
            message: normalizeMessage(data?.error || data?.message || responseText || 'Unable to log in.'),
            upstreamStatus: upstream.status,
        })
        if (wantsRedirect) {
            return authRedirect(req, redirectPath, data?.error || responseText || 'Unable to log in.')
        }
        return NextResponse.json(data || { error: responseText || 'Unable to log in.' }, { status: upstream.status })
    }
    if (!data?.token || !data?.id || !data?.name) {
        await recordFrontendAuthFailure({
            req,
            id,
            redirectPath,
            statusCode: 502,
            errorCode: 'session_create_failed',
            message: 'Login succeeded, but the session could not be created.',
            upstreamStatus: upstream.status,
        })
        if (wantsRedirect) {
            return authRedirect(req, redirectPath, 'Login succeeded, but the session could not be created.')
        }
        return NextResponse.json({ error: 'Login succeeded, but the session could not be created.' }, { status: 502 })
    }

    if (wantsRedirect) {
        const response = redirectTo(safeRedirectPath(redirectPath))
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

function authRedirect(_req: NextRequest, redirectPath: string, error: string) {
    const search = new URLSearchParams({
        path: safeRedirectPath(redirectPath),
        error,
    })
    return redirectTo(`/login?${search.toString()}`)
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

async function recordFrontendAuthFailure(input: AuthFailureInput) {
    const requestId = requestIdFor(input.req)
    const path = '/api/auth/login'
    const event = {
        service: 'hanasand-frontend',
        host: 'next-auth-route',
        level: input.statusCode >= 500 ? 'error' : 'warn',
        message: `POST ${path} failed with ${input.statusCode} ${input.errorCode}`,
        metadata: {
            category: 'http_response_error',
            surface: 'auth',
            method: 'POST',
            path,
            status_code: input.statusCode,
            upstream_status: input.upstreamStatus || null,
            error_code: input.errorCode,
            error_message: input.message,
            request_id: requestId,
            user_id: input.id,
            redirect_path: safeRedirectPath(input.redirectPath),
            ip: ipFor(input.req),
            user_agent: (input.req.headers.get('user-agent') || '').slice(0, 300),
            referer: (input.req.headers.get('referer') || input.req.headers.get('referrer') || '').slice(0, 500),
        },
    }

    console.warn(JSON.stringify({
        event: 'frontend_auth_failure',
        status_code: input.statusCode,
        error_code: input.errorCode,
        request_id: requestId,
        user_id: input.id,
        redirect_path: safeRedirectPath(input.redirectPath),
    }))

    const token = process.env.VM_API_TOKEN
    if (!token) return

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 750)
    try {
        await fetch(`${authApiUrl().replace(/\/$/, '')}/logs/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'x-request-id': requestId,
            },
            body: JSON.stringify(event),
            cache: 'no-store',
            signal: controller.signal,
        })
    } catch {
        // Console fallback above keeps the failure visible in runtime logs if the API is down.
    } finally {
        clearTimeout(timeout)
    }
}

function requestIdFor(req: NextRequest) {
    return req.headers.get('x-request-id') || crypto.randomUUID()
}

function ipFor(req: NextRequest) {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]?.trim() || ''
    return req.headers.get('x-real-ip') || ''
}

function normalizeErrorCode(value: unknown) {
    if (typeof value !== 'string') return 'login_failed'
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120) || 'login_failed'
}

function normalizeMessage(value: unknown) {
    if (typeof value !== 'string') return 'Unable to log in.'
    return value.trim().slice(0, 500) || 'Unable to log in.'
}
