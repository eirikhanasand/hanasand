import { DashboardPage } from '@/components/dashboard/ui'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
import { cookies, headers } from 'next/headers'
import { DwmCaseDetailClient, type CaseDetail, type CaseExport } from './case-detail-client'

export const dynamic = 'force-dynamic'

export default async function DwmCaseDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const [{ id }, query] = await Promise.all([params, searchParams])
    const tenantId = firstParam(query?.tenantId)?.trim() || 'default'
    const organizationId = firstParam(query?.organizationId)
    const alertId = firstParam(query?.alertId)
    const routeRun = firstParam(query?.route)
    const scraperHeaders = await dwmCaseScraperHeaders()
    const [initialDetail, initialExportPayload] = await Promise.all([
        loadCaseDetail(id, { tenantId, organizationId, alertId }, scraperHeaders),
        loadCaseExport(id, { tenantId, organizationId, alertId }, scraperHeaders),
    ])

    return (
        <DashboardPage className='gap-2 sm:gap-3'>
            <DwmCaseDetailClient
                caseId={id}
                tenantId={tenantId}
                organizationId={organizationId}
                alertId={alertId}
                routeRun={routeRun}
                initialDetail={initialDetail}
                initialExportPayload={initialExportPayload}
            />
        </DashboardPage>
    )
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
}

async function loadCaseDetail(caseId: string, scope: DwmCaseScope, requestHeaders: HeadersInit): Promise<CaseDetail | undefined> {
    return loadCasePayload<CaseDetail>(caseId, '/v1/cases', scope, requestHeaders)
}

async function loadCaseExport(caseId: string, scope: DwmCaseScope, requestHeaders: HeadersInit): Promise<CaseExport | undefined> {
    return loadCasePayload<CaseExport>(caseId, '/v1/cases', { ...scope, shape: 'full' }, requestHeaders, 'export')
}

async function loadCasePayload<T>(caseId: string, route: string, scope: DwmCaseScope & { shape?: string }, requestHeaders: HeadersInit, suffix?: string): Promise<T | undefined> {
    const base = tiScraperApiBase()
    if (!base) return undefined

    try {
        const target = new URL(`${route}/${encodeURIComponent(caseId)}${suffix ? `/${suffix}` : ''}`, base)
        target.searchParams.set('tenantId', scope.tenantId)
        if (scope.organizationId) target.searchParams.set('organizationId', scope.organizationId)
        if (scope.alertId) target.searchParams.set('alertId', scope.alertId)
        if (scope.shape) target.searchParams.set('shape', scope.shape)

        const response = await fetch(target, { cache: 'no-store', headers: requestHeaders, signal: AbortSignal.timeout(5000) })
        if (!response.ok) return undefined
        return await response.json() as T
    } catch {
        return undefined
    }
}

async function dwmCaseScraperHeaders(): Promise<HeadersInit> {
    const cookieStore = await cookies()
    const requestHeaders = await headers()
    const token = cookieStore.get('access_token')?.value || bearerToken(requestHeaders.get('authorization')) || ''
    const id = cookieStore.get('id')?.value || requestHeaders.get('id') || ''

    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(id ? { id } : {}),
        ...(id ? { 'x-actor-id': id, 'x-user-id': id } : {}),
    }
}

function bearerToken(value: string | null) {
    if (!value?.startsWith('Bearer ')) return ''
    return value.slice('Bearer '.length).trim()
}

type DwmCaseScope = {
    tenantId: string
    organizationId?: string
    alertId?: string
}
