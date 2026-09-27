import { NextRequest } from 'next/server'
import { POST as deliver } from '../deliver/route'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    return deliver(new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ ...body, dryRun: true, live: false }),
    }))
}
