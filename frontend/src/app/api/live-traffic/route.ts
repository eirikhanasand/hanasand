import config from '@/config'
import { countryIsoForTrafficRecord, type TrafficBatch } from '@/utils/monitoring/liveTrafficMap'
import type { TrafficRecord } from '@/utils/monitoring/types'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = safeDecode(cookieStore.get('access_token')?.value || '')
        if (!token) {
            return new Response('Unauthorized', { status: 401 })
        }

        if (request.nextUrl.searchParams.get('mode') === 'snapshot') {
            const [metrics, records] = await Promise.all([
                fetch(`${config.url.cdn}/traffic/metrics`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                    cache: 'no-store',
                }),
                fetch(`${config.url.cdn}/traffic/records?limit=250&page=1`, {
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

        const response = await fetch(`${config.url.cdn}/traffic/live`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/event-stream',
                Connection: 'keep-alive',
            },
            cache: 'no-store',
        })

        if (!response.ok || !response.body) {
            return trafficSnapshotStream(token, request.signal)
        }

        return new Response(response.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        })
    } catch {
        const cookieStore = await cookies()
        const token = safeDecode(cookieStore.get('access_token')?.value || '')
        if (!token) return new Response('Unauthorized', { status: 401 })
        return trafficSnapshotStream(token, request.signal)
    }
}

function safeDecode(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

function trafficSnapshotStream(token: string, signal: AbortSignal) {
    const encoder = new TextEncoder()
    let stopped = false

    const stream = new ReadableStream({
        start(controller) {
            const write = (event: string, data: string) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
            }

            write('ready', 'snapshot')

            async function pushSnapshot() {
                if (stopped || signal.aborted) return
                try {
                    const response = await fetch(`${config.url.cdn}/traffic/records?limit=250&page=1`, {
                        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                        cache: 'no-store',
                        signal,
                    })
                    if (response.ok) {
                        const payload = await response.json() as { result?: TrafficRecord[] }
                        const batch = recordsToBatch(Array.isArray(payload.result) ? payload.result : [])
                        if (batch.length) {
                            write('traffic', JSON.stringify(batch))
                        }
                    }
                } catch {
                    if (!stopped && !signal.aborted) {
                        write('ready', 'snapshot-retrying')
                    }
                }

                if (!stopped && !signal.aborted) {
                    setTimeout(pushSnapshot, 4000)
                }
            }

            void pushSnapshot()
        },
        cancel() {
            stopped = true
        },
    })

    signal.addEventListener('abort', () => {
        stopped = true
    }, { once: true })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store',
            Connection: 'keep-alive',
        },
    })
}

function recordsToBatch(records: TrafficRecord[]): TrafficBatch[] {
    const counts = new Map<string, number>()
    for (const record of records.slice(0, 120)) {
        const iso = countryIsoForTrafficRecord(record)
        counts.set(iso, (counts.get(iso) || 0) + 1)
    }
    const timestamp = new Date().toISOString()
    return Array.from(counts, ([iso, count]) => ({ iso, count, timestamp }))
}
