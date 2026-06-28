import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    return proxyTiRequest(request, '/v1/dwm/webhooks/deliveries', { method: 'GET' })
}
