import { NextResponse } from 'next/server'
import getStatus from '@/utils/status/getStatus'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'
import { loadProductDeployProofLedger } from '@/utils/productProgress/deployProofSource'

export async function GET() {
    const status = await getStatus()
    const publicStatus = toPublicServiceStatus(status)

    return NextResponse.json(publicStatus, {
        headers: {
            'cache-control': 'no-store, max-age=0',
        },
    })
}
