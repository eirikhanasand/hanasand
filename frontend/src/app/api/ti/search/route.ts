import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    return proxyTiRequest(request, '/api/ti/search', { method: 'GET' })
}

export async function POST(request: NextRequest) {
    return proxyTiRequest(request, '/api/ti/search', { method: 'POST' })
}
