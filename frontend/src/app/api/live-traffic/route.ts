import config from '@/config'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const streamHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'X-Accel-Buffering': 'no',
}

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = safeDecode(cookieStore.get('access_token')?.value || '')
        if (!token) {
            return new Response('Unauthorized', { status: 401 })
        }

        const domain = request.nextUrl.searchParams.get('domain')?.trim()
        const scope = new URLSearchParams(domain ? { domain } : {})
        const liveScope = new URLSearchParams(scope)
        const after = request.nextUrl.searchParams.get('after')
        if (after) liveScope.set('after', after)

        if (request.nextUrl.searchParams.get('mode') === 'snapshot') {
            const [metrics, records] = await Promise.all([
                fetch(`${config.url.cdn}/traffic/metrics?${scope}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                    cache: 'no-store',
                }),
                fetch(`${config.url.cdn}/traffic/records?limit=200&page=1&${scope}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                    cache: 'no-store',
                }),
            ])

            return Response.json({
                metrics: metrics.ok ? await metrics.json() : null,
                records: records.ok ? await records.json() : null,
                source: 'traffic_snapshot',
                updatedAt: new Date().toISOString(),
            }, {
                status: metrics.ok || records.ok ? 200 : 502,
                headers: { 'Cache-Control': 'no-store' },
            })
        }

        const response = await fetch(`${config.url.cdn}/traffic/live?${liveScope}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/event-stream',
                'Accept-Encoding': 'identity',
            },
            cache: 'no-store',
            signal: request.signal,
        })

        if (response.status === 401 || response.status === 403) {
            return new Response('Unauthorized', { status: response.status })
        }

        if (!response.ok || !response.body) {
            return new Response('Traffic stream unavailable', { status: 503 })
        }

        return new Response(response.body, {
            headers: streamHeaders,
        })
    } catch {
        const cookieStore = await cookies()
        const token = safeDecode(cookieStore.get('access_token')?.value || '')
        if (!token) return new Response('Unauthorized', { status: 401 })
        return new Response('Traffic stream unavailable', { status: 503 })
    }
}

function safeDecode(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}
