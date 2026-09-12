import { NextResponse } from 'next/server'
import getPublicStatus from '@/utils/status/getPublicStatus'

export async function GET(request: Request) {
    const incidentId = new URL(request.url).searchParams.get('incident') || undefined
    const status = await getPublicStatus({ incidentId })
    const publicStatus = status

    return NextResponse.json(publicStatus, {
        headers: {
            'cache-control': 'no-store, max-age=0',
        },
    })
}
