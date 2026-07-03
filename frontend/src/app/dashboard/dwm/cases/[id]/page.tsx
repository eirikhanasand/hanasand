import { DashboardPage } from '@/components/dashboard/ui'
import { DwmCaseDetailClient } from './case-detail-client'

export const dynamic = 'force-dynamic'

export default async function DwmCaseDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const [{ id }, query] = await Promise.all([params, searchParams])
    const tenantId = firstParam(query?.tenantId)
    const organizationId = firstParam(query?.organizationId)
    const alertId = firstParam(query?.alertId)
    const routeRun = firstParam(query?.route)

    return (
        <DashboardPage className='gap-2 sm:gap-3'>
            <DwmCaseDetailClient caseId={id} tenantId={tenantId} organizationId={organizationId} alertId={alertId} routeRun={routeRun} />
        </DashboardPage>
    )
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
}
