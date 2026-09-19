import { NextResponse } from 'next/server'
import getPublicStatus from '@/utils/status/getPublicStatus'

export async function GET(request: Request) {
    const params = new URL(request.url).searchParams
    const incidentId = params.get('incident') || undefined
    const status = await getPublicStatus({ incidentId, summary: params.get('summary') === 'true', dashboard: params.get('history') !== 'true' })
    const publicStatus = status

    return NextResponse.json(publicStatus, {
        headers: {
            'cache-control': 'no-store, max-age=0',
        },
    })
}
