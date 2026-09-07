import { NextResponse } from 'next/server'
import getPublicStatus from '@/utils/status/getPublicStatus'

export async function GET() {
    const status = await getPublicStatus()
    const publicStatus = status

    return NextResponse.json(publicStatus, {
        headers: {
            'cache-control': 'no-store, max-age=0',
        },
    })
}
