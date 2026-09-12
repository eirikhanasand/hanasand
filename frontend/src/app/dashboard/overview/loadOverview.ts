import { NextRequest } from 'next/server'
import { GET as getProduct } from '@/app/api/dwm/product/route'
import { GET as getCases } from '@/app/api/cases/route'
import type { DwmProductSnapshot } from '@/utils/dwm/product'

type CaseRow = { status?: string }
export type OverviewState = { status: 'ready', snapshot: DwmProductSnapshot, openCases: number | null } | { status: 'error', message: string }

// Reuse the authenticated route handlers without a browser or loopback HTTP round trip.
export async function loadOverview(cookieHeader: string, organizationId?: string): Promise<OverviewState> {
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
    const request = (path: string) => new NextRequest(`http://localhost/api/${path}${query}`, { headers: { cookie: cookieHeader } })
    try {
        const [snapshotResponse, casesResponse] = await Promise.all([
            getProduct(request('dwm/product')),
            getCases(request('cases')).catch(() => null),
        ])
        const body = await snapshotResponse.json().catch(() => null) as DwmProductSnapshot | { error?: { message?: string } } | null
        const errorMessage = body && 'error' in body ? body.error?.message : undefined
        if (!snapshotResponse.ok || !body || !('schemaVersion' in body)) throw new Error(errorMessage || 'Tenant monitoring is unavailable.')
        if (organizationId && body.tenantId !== organizationId) throw new Error('Organization monitoring returned an unexpected tenant scope.')
        const caseBody = casesResponse?.ok ? await casesResponse.json().catch(() => null) as { items?: CaseRow[], cases?: CaseRow[] } | null : null
        const cases = Array.isArray(caseBody?.items) ? caseBody.items : Array.isArray(caseBody?.cases) ? caseBody.cases : null
        const openCases = cases?.filter(row => !['closed', 'resolved', 'false_positive', 'suppressed'].includes(String(row.status || '').toLowerCase())).length ?? null
        return { status: 'ready', snapshot: body, openCases }
    } catch (error) {
        return { status: 'error', message: error instanceof Error ? error.message : 'Tenant monitoring is unavailable.' }
    }
}
