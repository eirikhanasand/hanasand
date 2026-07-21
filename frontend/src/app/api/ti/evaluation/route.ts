import { NextRequest, NextResponse } from 'next/server'
import requireApiSession from '@/utils/proxy/requireApiSession'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const session = await requireApiSession(request, ['system_admin', 'admin', 'administrator', 'analyst'])
    if ('response' in session) return session.response
    const base = process.env.TI_SCRAPER_API_BASE?.trim()
    if (!base) return failure(503, 'evaluation_unavailable', 'The evaluation service is unavailable.')

    const scope = request.nextUrl.searchParams.get('scope') || 'default'
    if (scope !== 'default' && scope !== 'global') return failure(400, 'invalid_evaluation_scope', 'Use the default or global evaluation scope.')
    const datasetSplit = request.nextUrl.searchParams.get('datasetSplit')
    if (datasetSplit && datasetSplit !== 'validation' && datasetSplit !== 'test') return failure(400, 'invalid_dataset_split', 'Use the validation or test dataset split.')
    const target = new URL('/v1/intel/evaluation', base)
    if (datasetSplit) target.searchParams.set('datasetSplit', datasetSplit)

    try {
        const response = await fetch(target, {
            headers: {
                authorization: `Bearer ${session.identity.token}`,
                id: session.identity.id,
                'x-actor-id': session.identity.id,
                'x-user-id': session.identity.id,
                ...(scope === 'default' ? { 'x-tenant-id': 'default' } : {}),
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(12_000),
        })
        return new NextResponse(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' } })
    } catch {
        return failure(503, 'evaluation_unavailable', 'The evaluation service did not respond.')
    }
}

function failure(status: number, code: string, message: string) {
    return NextResponse.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } })
}
