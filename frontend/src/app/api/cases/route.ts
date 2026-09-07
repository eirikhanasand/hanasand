import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../dwm/_tiProxy'

import { GET as monitoringCases } from './monitoring/route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const responses = await Promise.allSettled([
        proxyTiRequest(request, '/v1/cases', { method: 'GET' }), monitoringCases(request),
    ])
    const items: Record<string, unknown>[] = []
    const warnings: string[] = []
    let available = 0
    let metadata: Record<string, unknown> = {}
    let monitoringTotal = 0
    for (const [index, result] of responses.entries()) {
        if (result.status === 'fulfilled' && [401, 403].includes(result.value.status)) return result.value
        if (result.status === 'fulfilled' && result.value.ok) {
            const payload = await result.value.json()
            if (index === 0) metadata = payload
            else monitoringTotal = (payload.items || []).length
            if (index === 0 || !request.nextUrl.searchParams.has('cursor') && Number(request.nextUrl.searchParams.get('page') || 1) === 1) items.push(...(payload.items || payload.cases || []))
            available++
        } else warnings.push(`${index === 0 ? 'Intelligence' : 'Monitoring'} cases are unavailable. Retry to load them.`)
    }
    items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    return NextResponse.json({ ...metadata, items, cases: items, total: Number(metadata.total || 0) + monitoringTotal, warnings }, { status: available ? 200 : 503, headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: NextRequest) {
    return proxyTiRequest(request, '/v1/cases', { method: 'POST' })
}
