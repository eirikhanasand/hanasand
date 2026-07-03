import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import config from '@/config'

type Context = {
    params: Promise<{ path?: string[] }>
}

const hopByHopHeaders = new Set([
    'connection',
    'content-encoding',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
])

const BACKEND_PROXY_TIMEOUT_MS = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 12_000)

async function handler(req: NextRequest, context: Context) {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || bearerToken(req.headers.get('authorization')) || ''
    const id = cookieStore.get('id')?.value || req.headers.get('id') || ''
    if (!token || !id) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const params = await context.params
    const path = (params.path || []).map(segment => encodeURIComponent(segment)).join('/')
    const target = new URL(`${config.url.api}/${path}`)
    target.search = req.nextUrl.search

    const headers = new Headers()
    req.headers.forEach((value, key) => {
        const lower = key.toLowerCase()
        if (!hopByHopHeaders.has(lower) && lower !== 'authorization' && lower !== 'cookie' && lower !== 'id' && !lower.startsWith('x-impersonation')) {
            headers.set(key, value)
        }
    })
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('id', id)

    const impersonationToken = cookieStore.get('impersonation_token')?.value
    if (impersonationToken) {
        headers.set('x-impersonation-token', impersonationToken)
    }

    let response: Response
    try {
        response = await fetch(target, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
            duplex: 'half',
            cache: 'no-store',
            signal: AbortSignal.timeout(BACKEND_PROXY_TIMEOUT_MS),
        } as RequestInit & { duplex: 'half' })
    } catch (error) {
        const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        return NextResponse.json({
            error: isTimeout
                ? 'The backend service did not respond in time. Try again shortly; the dashboard is still available.'
                : 'The backend service is unavailable right now. Try again shortly.',
        }, { status: 503 })
    }

    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
        const lower = key.toLowerCase()
        if (!hopByHopHeaders.has(lower) && lower !== 'set-cookie' && lower !== 'x-access-token' && lower !== 'x-access-token-expires-at') {
            responseHeaders.set(key, value)
        }
    })

    const next = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    })

    const refreshedToken = response.headers.get('x-access-token')
    if (refreshedToken) {
        setProxyAuthCookie(req, next, 'access_token', refreshedToken, {
            sameSite: 'lax',
            path: '/',
            expires: response.headers.get('x-access-token-expires-at')
                ? new Date(response.headers.get('x-access-token-expires-at') as string)
                : undefined,
        })
    }

    return next
}

function bearerToken(value: string | null) {
    if (!value?.startsWith('Bearer ')) {
        return ''
    }

    return value.slice('Bearer '.length).trim()
}

function setProxyAuthCookie(
    req: NextRequest,
    response: NextResponse,
    name: string,
    value: string,
    options: {
        sameSite: 'lax'
        path: string
        expires: Date | undefined
    },
) {
    const secure = req.nextUrl.protocol === 'https:' || requestHostname(req).endsWith('hanasand.com')
    const cookieOptions = {
        ...options,
        secure,
    }
    response.cookies.set(name, value, cookieOptions)
    if (requestHostname(req).endsWith('hanasand.com')) {
        response.cookies.set(name, value, {
            ...cookieOptions,
            domain: '.hanasand.com',
        })
    }
}

function requestHostname(req: NextRequest) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.hostname
    return host.split(':')[0]
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
