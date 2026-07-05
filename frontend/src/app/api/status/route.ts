import { NextResponse } from 'next/server'
import getStatus from '@/utils/status/getStatus'
import { publicStatusCoverageCheck, toPublicServiceStatus } from '@/utils/status/publicStatus'
import { loadProductDeployProofLedger } from '@/utils/productProgress/deployProofSource'

export async function GET() {
    const generatedAt = new Date().toISOString()
    const status = await getStatus().catch(() => ({
        overall: 'degraded' as const,
        generated_at: generatedAt,
        checks: [publicStatusCoverageCheck(generatedAt)],
    }))
    const publicStatus = toPublicServiceStatus(status)
    const productProgressDeployProof = await loadProductDeployProofLedger()

    return NextResponse.json(productProgressDeployProof
        ? { ...publicStatus, productProgressDeployProof }
        : publicStatus, {
        headers: {
            'cache-control': 'no-store, max-age=0',
        },
    })
}
