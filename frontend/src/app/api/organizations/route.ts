import { NextRequest, NextResponse } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { mirrorOrganizationToDwm } from '@/app/api/organizations/_organizationWatchlistDwmBridge'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    return proxyOrganizationApiRequest(request, '/organizations', { method: 'GET' })
}

export async function POST(request: NextRequest) {
    const response = await proxyOrganizationApiRequest(request, '/organizations', { method: 'POST' })
    if (!response.ok) return response
    const payload = await response.clone().json() as Record<string, unknown>
    const dwmOrganizationBridge = await mirrorOrganizationToDwm(request, payload)
    return NextResponse.json({ ...payload, dwmOrganizationBridge }, {
        status: response.status,
        headers: { 'cache-control': 'no-store' },
    })
}
