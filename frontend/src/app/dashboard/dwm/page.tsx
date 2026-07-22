import { DashboardPage } from '@/components/dashboard/ui'
import type { DwmProductSnapshot } from '@/utils/dwm/product'
import { decodePublicTiHandoffPayload, PUBLIC_TI_HANDOFF_SOURCE } from '@/utils/ti/actorWorkbench'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DwmAnalystPortal, type DwmView } from './dwm-analyst-portal'

export const dynamic = 'force-dynamic'

export default async function DashboardDwmPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const [params, cookieStore] = await Promise.all([searchParams, cookies()])
    const identityId = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    if (!identityId || !token) redirect('/login?path=%2Fdashboard%2Fdwm')

    const organizationId = firstParam(params?.organizationId)?.trim() || undefined
    const tenantId = organizationId || identityId
    const initialAlertId = firstParam(params?.alert)
    const publicTiHandoff = firstParam(params?.handoff) === PUBLIC_TI_HANDOFF_SOURCE
        ? decodePublicTiHandoffPayload(firstParam(params?.payload), firstParam(params?.intent))
        : null

    return (
        <DashboardPage className='gap-2 sm:gap-3'>
            <DwmAnalystPortal
                key={`${tenantId}:${organizationId || 'personal'}`}
                tenantId={tenantId}
                organizationId={organizationId}
                snapshot={loadingSnapshot(tenantId)}
                operations={null}
                alerts={[]}
                deliveries={[]}
                dataHealth={loadingDataHealth()}
                initialAlertId={initialAlertId}
                publicTiHandoff={publicTiHandoff}
                view={normalizeDwmView(firstParam(params?.panel))}
            />
        </DashboardPage>
    )
}

function loadingSnapshot(tenantId: string): DwmProductSnapshot {
    return {
        schemaVersion: 'dwm.product.v1',
        generatedAt: '',
        tenantId,
        watchlist: [],
        alerts: [],
        sourceCoverage: [],
        actorOverviews: [],
        onDemandQueue: [],
        readiness: {
            decision: 'blocked_missing_watchlist',
            blockers: ['Live monitoring state is loading.'],
            advantages: [],
            nextWorkItem: '',
        },
    }
}

function loadingDataHealth() {
    return {
        snapshot: { state: 'missing' as const, label: 'Monitoring loading', detail: 'Loading the persisted tenant watchlist and alert state.' },
        operations: { state: 'missing' as const, label: 'Collection loading', detail: 'Loading retained source and capture state.' },
        alerts: { state: 'missing' as const, label: 'Alerts loading', detail: 'Loading persisted tenant alerts.' },
        deliveries: { state: 'missing' as const, label: 'Deliveries loading', detail: 'Loading persisted delivery attempts.' },
    }
}

function normalizeDwmView(value: string | undefined): DwmView {
    return value === 'watchlists' || value === 'sources' || value === 'delivery' || value === 'actors' || value === 'actions' ? value : 'cases'
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
}
