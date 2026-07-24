import { NextRequest } from 'next/server'
import { fetchSharedExposureQueue } from '@/utils/dwm/sharedExposureQueue'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const response = await fetchSharedExposureQueue(request.nextUrl.searchParams)
        return new Response(await response.text(), {
            status: response.status,
            headers: {
                'cache-control': 'no-store',
                'content-type': response.headers.get('content-type') || 'application/json',
            },
        })
    } catch {
        return Response.json({ error: { code: 'ti_backend_unavailable', message: 'Threat activity is temporarily unavailable.' } }, { status: 503 })
    }
}
