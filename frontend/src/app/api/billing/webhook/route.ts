import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    const body = await request.text()
    const response = await fetch(`${authApiUrl().replace(/\/$/, '')}/billing/webhook`, {
        method: 'POST',
        headers: {
            'content-type': 'application/octet-stream',
            ...(request.headers.get('stripe-signature') ? { 'stripe-signature': request.headers.get('stripe-signature')! } : {}),
        },
        body,
        cache: 'no-store',
    })
    return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
