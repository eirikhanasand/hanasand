import { NextResponse } from 'next/server'
import getStatus from '@/utils/status/getStatus'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'

export async function GET() {
    const status = await getStatus()
    return NextResponse.json(toPublicServiceStatus(status), {
        headers: {
            'cache-control': 'no-store, max-age=0',
        },
    })
}
