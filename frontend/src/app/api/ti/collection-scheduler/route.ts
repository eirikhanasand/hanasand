import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    return proxyTiRequest(request, '/v1/ops/collection-scheduler', { method: 'GET' })
}
