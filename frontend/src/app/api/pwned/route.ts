import { NextRequest, NextResponse } from 'next/server'

const PWNED_PROXY_TIMEOUT_MS = Number(process.env.PWNED_PROXY_TIMEOUT_MS || 12_000)
const PWNED_RANGE_API = process.env.HIBP_PWNED_RANGE_API || 'https://api.pwnedpasswords.com/range'

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
            headers: {
                'Add-Padding': 'true',
                'User-Agent': 'hanasand-bloom-hash-lookup',
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(PWNED_PROXY_TIMEOUT_MS),
        })
    } catch {
        return NextResponse.json({ error: 'Unable to check the Bloom exposure dataset right now.' }, { status: 503 })
    }

    if (!response.ok) {
        return NextResponse.json({ error: 'Unable to check the Bloom exposure dataset right now.' }, { status: response.status })
    }

    const range = await response.text().catch(() => '')
    return NextResponse.json({
        schemaVersion: 'pwned.range_proxy.v1',
        prefix,
        range,
        privacy: 'Only the first five SHA-1 characters were sent to the range service. The full hash and underlying secret stay outside the request.',
    }, {
        headers: { 'cache-control': 'no-store' },
    })
}
