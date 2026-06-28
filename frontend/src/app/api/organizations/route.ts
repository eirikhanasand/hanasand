import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    return proxyTiRequest(request, '/v1/organizations', { method: 'GET' })
}

export async function POST(request: NextRequest) {
    return proxyTiRequest(request, '/v1/organizations', { method: 'POST' })
}
