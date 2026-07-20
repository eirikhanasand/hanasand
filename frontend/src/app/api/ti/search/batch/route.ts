import { NextRequest } from 'next/server'
import { proxyApiTiRequest } from '../../../dwm/_tiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    return proxyApiTiRequest(request, '/ti/search/batch', { method: 'POST' })
}
