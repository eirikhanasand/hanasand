import { DashboardPage } from '@/components/dashboard/ui'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DwmCaseDetailClient } from './case-detail-client'

export const dynamic = 'force-dynamic'

export default async function DwmCaseDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const [{ id }, query, cookieStore] = await Promise.all([params, searchParams, cookies()])
    const identityId = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    if (!identityId || !token) redirect(`/login?path=${encodeURIComponent(`/dashboard/dwm/cases/${id}`)}`)

    const organizationId = firstParam(query?.organizationId)?.trim() || undefined
    const tenantId = organizationId || identityId

    return (
        <DashboardPage className='gap-2 sm:gap-3'>
            <DwmCaseDetailClient
                key={`${tenantId}:${id}`}
                caseId={id}
                tenantId={tenantId}
                organizationId={organizationId}
                alertId={firstParam(query?.alertId)}
                routeRun={firstParam(query?.route)}
            />
        </DashboardPage>
    )
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
}
