import { NextRequest, NextResponse } from 'next/server'

const PWNED_PROXY_TIMEOUT_MS = Number(process.env.PWNED_PROXY_TIMEOUT_MS || 12_000)
const PWNED_RANGE_API = process.env.COMPACT_PWNED_RANGE_API || 'http://pwned-index:8099/range'

export async function POST(request: NextRequest) {
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prefix = String((body as { prefix?: unknown })?.prefix || '').trim().toUpperCase()
    if (!/^[A-F0-9]{5}$/.test(prefix)) {
        return NextResponse.json({ error: 'A valid SHA-1 hash prefix is required.' }, { status: 400 })
    }

    let response: Response
    try {
        response = await fetch(`${PWNED_RANGE_API}/${prefix}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(PWNED_PROXY_TIMEOUT_MS),
        })
    } catch {
        return NextResponse.json({ error: 'Unable to check the Bloom exposure dataset right now.' }, { status: 503 })
    }

    if (!response.ok || response.headers.get('content-type') !== 'application/vnd.hanasand.pwned-prefix') {
        return NextResponse.json({ error: 'Unable to check the Bloom exposure dataset right now.' }, { status: 503 })
    }

    return new NextResponse(response.body, {
        headers: { 'cache-control': 'no-store', 'content-type': 'application/vnd.hanasand.pwned-prefix', 'x-content-type-options': 'nosniff' },
    })
}
