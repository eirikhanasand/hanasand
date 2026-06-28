import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../_tiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    return proxyTiRequest(request, '/v1/dwm/source-requests', { method: 'POST' })
}
