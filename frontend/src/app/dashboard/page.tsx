import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BellRing, Building2, ListChecks, Radar } from 'lucide-react'
import { DashboardPage } from '@/components/dashboard/ui'
import { demoDwmProductSnapshot, type DwmAlert, type DwmAlertAnalystAction, type DwmAlertAnalystActionReadiness, type DwmSeverity } from '@/utils/dwm/product'
import { decodePublicTiHandoffPayload, PUBLIC_TI_HANDOFF_SOURCE } from '@/utils/ti/actorWorkbench'
import { formatTiDate, getTiAdminOverview, sourceById, type TiAdminCapture, type TiAdminDomain, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import AnalystWorkbenchClient, { type WorkbenchCase, type WorkbenchEvidence, type WorkbenchTimelineItem } from './ti/workbench/workbenchClient'
import { applyScope, buildOrgOperatingContext, buildProductProgressExternalState, buildPublicTiHandoffCase, buildReadinessCases, buildSourceProofReadinessFromProxy, parseProductProgressReadinessPayload, resolveDashboardViewerIdentity, type DashboardSourceProofProxyPayload, type DashboardViewerIdentity, type DwmAlertAccessState, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationInvite, type DwmOrganizationMember, type DwmOrganizationState, type DwmOrganizationSummary, type DwmOrganizationWebhookDestination, type DwmWatchlistSummary, type OperatorScope } from './operatorConsoleModel'
import WebhookDeliveryConsole, { type DashboardWebhookAlertOption } from './WebhookDeliveryConsole'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Operations Workbench',
    description: 'Start the day from a prioritized analyst queue with evidence, routing, workflow actions, notes, and source context.',
}

export default async function Page({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const Cookies = await cookies()
    const Headers = await headers()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const impersonatingId = Cookies.get('impersonating_id')?.value || Headers.get('x-impersonating-id') || ''
    const impersonatingName = Cookies.get('impersonating_name')?.value || Headers.get('x-impersonating-name') || ''

    if (!name || !id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const overview = getTiAdminOverview()
    const organizationState = await loadDwmOrganizationState()
    const scope: OperatorScope = organizationState.selectedOrganization
        ? { tenantId: organizationState.selectedOrganization.tenantId, organizationId: organizationState.selectedOrganization.id }
        : { tenantId: 'default' }
    const viewerIdentity = resolveDashboardViewerIdentity({
        userId: impersonatingId || id,
        userName: impersonatingName || name,
        userEmail: Cookies.get('email')?.value || Cookies.get('user_email')?.value || Cookies.get('userEmail')?.value || Headers.get('x-user-email') || '',
        headerUserId: Headers.get('x-user-id') || '',
        headerActor: Headers.get('x-actor-id') || '',
        members: organizationState.members,
    })
    const [alertLoad, watchlists, operations, deliveries] = await Promise.all([
        loadDwmAlerts(scope, viewerIdentity),
        loadDwmWatchlists(scope, viewerIdentity),
        loadDwmOperations(scope, viewerIdentity),
        loadDwmDeliveries(scope, viewerIdentity),
    ])
    const [sourceProofReadiness, productProgressReadiness] = await Promise.all([
        loadDashboardSourceProof(Headers, watchlists),
        loadProductProgressReadiness(Headers, scope, viewerIdentity),
    ])
    const liveAlerts = alertLoad.alerts
    const alertVisibilityBlocked = alertLoad.accessState.status === 'identity_missing' || alertLoad.accessState.status === 'visibility_denied'
    const fallbackAlerts = alertVisibilityBlocked ? [] : demoDwmProductSnapshot(new Date().toISOString()).alerts
    const alerts = liveAlerts.length ? liveAlerts : fallbackAlerts
    const publicTiHandoff = firstParam(params?.handoff) === PUBLIC_TI_HANDOFF_SOURCE
        ? decodePublicTiHandoffPayload(firstParam(params?.payload), firstParam(params?.intent))
        : null
    const externalReadiness = {
        ...productProgressReadiness,
        sourceGrowth: productProgressReadiness.sourceGrowth?.status !== 'unavailable'
            ? productProgressReadiness.sourceGrowth
            : sourceProofReadiness,
    }
    const readinessCases = buildReadinessCases({
        backendConfigured: Boolean(process.env.TI_SCRAPER_API_BASE),
        scope,
        watchlists,
        operations,
        deliveries,
        organizationState,
        liveAlertCount: liveAlerts.length,
        renderedAlertCount: alerts.length,
        alertAccessState: alertLoad.accessState,
        externalReadiness,
    })
    const orgContext = buildOrgOperatingContext({
        backendConfigured: Boolean(process.env.TI_SCRAPER_API_BASE),
        scope,
        watchlists,
        organizationState,
        operations,
        deliveries,
        liveAlertCount: liveAlerts.length,
        liveAlertIds: liveAlerts.map(alert => alert.id),
        externalReadiness,
    })
    const handoffCases = buildPublicTiHandoffCase({
        decode: publicTiHandoff,
        scope,
        organizationState,
        watchlists,
        operations,
        liveAlertCount: liveAlerts.length,
    })
    const cases = buildWorkbenchCases(overview, alerts, [...handoffCases, ...readinessCases], liveAlerts.length > 0, scope, deliveries)
    const requestedCaseId = firstParam(params?.case)
    const initialSelectedId = cases.find(item => item.id === requestedCaseId)?.id
    const webhookAlertOptions = alerts.slice(0, 12).map(alert => webhookAlertOption(alert, scope))
    const displayName = impersonatingName || impersonatingId || name
    const firstName = displayName.split(/\s+/)[0] || displayName
    const highPriorityCount = cases.filter(item => item.severity === 'critical' || item.severity === 'high').length

    return (
        <DashboardPage className='gap-2 sm:gap-3'>
            {params?.notAllowed && (
                <div className='rounded-lg border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-sm font-medium text-[#93370d] shadow-sm'>
                    That console area is not included in this account. Start from the operations queue below.
                </div>
            )}

            <OperatorTopBar
                firstName={firstName}
                caseCount={cases.length}
                highPriorityCount={highPriorityCount}
                persistentCount={cases.filter(item => item.persistent).length}
                orgContext={orgContext}
            />

            <AnalystWorkbenchClient initialCases={cases} chrome='compact' orgContext={orgContext} initialSelectedId={initialSelectedId} />

            <WebhookDeliveryConsole
                organization={organizationState.selectedOrganization ? {
                    id: organizationState.selectedOrganization.id,
                    tenantId: organizationState.selectedOrganization.tenantId,
                    name: organizationState.selectedOrganization.name,
                    status: organizationState.selectedOrganization.status,
                } : undefined}
                initialDestinations={organizationState.webhooks}
                initialDeliveries={deliveries}
                alertOptions={webhookAlertOptions}
            />
        </DashboardPage>
    )
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
}

function OperatorTopBar({
    firstName,
    caseCount,
    highPriorityCount,
    persistentCount,
    orgContext,
}: {
    firstName: string
    caseCount: number
    highPriorityCount: number
    persistentCount: number
    orgContext: ReturnType<typeof buildOrgOperatingContext>
}) {
    const activeOrg = orgContext.organization
    const orgLabel = activeOrg?.name || activeOrg?.slug || 'Default tenant'
    const activeWatchlists = orgContext.readiness.activeWatchlistCount
    const watchedTerms = orgContext.readiness.termCount
    const activeWebhooks = orgContext.readiness.activeWebhookCount
    const sourceCoverage = orgContext.readiness.sourceCoverage
    const latestDelivery = orgContext.readiness.latestDelivery
    return (
        <section className='rounded-lg border border-[#dfe5ee] bg-white px-3 py-2 shadow-sm' data-dashboard-operator-strip='true'>
            <div className='flex items-center justify-between gap-3 sm:hidden'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Operations</p>
                    <h1 className='truncate text-base font-semibold text-[#171a21]'>{firstName}, work the queue.</h1>
                    <p className='mt-0.5 truncate text-xs font-medium text-[#667085]'>{orgLabel} · {caseCount} cases · {persistentCount} API-backed</p>
                </div>
                <span className='shrink-0 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#9a3412]'>{highPriorityCount} high</span>
            </div>
            <div className='hidden gap-3 sm:grid xl:grid-cols-[minmax(260px,1fr)_minmax(520px,2fr)_auto] xl:items-center'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Operations workbench</p>
                    <h1 className='truncate text-lg font-semibold text-[#171a21]'>{firstName}, work the queue.</h1>
                    <p className='mt-0.5 truncate text-xs font-medium text-[#667085]'>{orgLabel} · {orgContext.readiness.alertVisibilityPolicy} visibility</p>
                </div>
                <div className='grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4'>
                    <CompactStat label='Cases' value={String(caseCount)} />
                    <CompactStat label='High' value={String(highPriorityCount)} tone='warn' />
                    <CompactStat label='API-backed' value={String(persistentCount)} tone='good' />
                    <CompactStat label='Terms' value={String(watchedTerms)} />
                </div>
                <div className='flex flex-wrap items-center gap-2 xl:justify-end'>
                    <OperatorCommand href='/dashboard/dwm' label='Watchlists' value={`${activeWatchlists} active`} icon={ListChecks} />
                    <OperatorCommand href='/dashboard/ti/sources' label='Sources' value={sourceCoverage ? `${sourceCoverage.activeSourceCount} active` : 'inspect'} icon={Radar} />
                    <OperatorCommand href='/dashboard/automations?setup=dwm' label='Delivery' value={latestDelivery?.status || `${activeWebhooks} webhooks`} icon={BellRing} primary />
                </div>
            </div>
            {activeOrg && (
                <div className='mt-2 hidden min-w-0 items-center gap-2 border-t border-[#eef1f5] pt-2 text-xs font-medium text-[#596170] md:flex' data-dashboard-active-org={activeOrg.id}>
                    <Building2 className='h-4 w-4 shrink-0 text-[#3056d3]' />
                    <span className='truncate'>Org {activeOrg.id}</span>
                    <span className='shrink-0 text-[#98a2b3]'>·</span>
                    <span className='truncate'>{orgContext.members.length} members</span>
                    <span className='shrink-0 text-[#98a2b3]'>·</span>
                    <span className='truncate'>{orgContext.pendingInvites.length} invites pending</span>
                    <span className='shrink-0 text-[#98a2b3]'>·</span>
                    <span className='truncate'>{activeWebhooks} active delivery destinations</span>
                </div>
            )}
        </section>
    )
}

function CompactStat({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'warn' | 'good' }) {
    const toneClass = tone === 'warn'
        ? 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]'
        : tone === 'good'
            ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
            : 'border-[#d8dee9] bg-[#fbfcfe] text-[#344054]'
    return (
        <span className={`inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold ${toneClass}`}>
            <span className='text-[10px] uppercase opacity-75'>{label}</span>
            <span>{value}</span>
        </span>
    )
}

function OperatorCommand({
    href,
    label,
    value,
    icon: Icon,
    primary = false,
}: {
    href: string
    label: string
    value: string
    icon: typeof BellRing
    primary?: boolean
}) {
    const className = primary
        ? 'bg-[#171a21] text-white hover:bg-[#2b2f39] focus:ring-[#c7d2fe]'
        : 'border border-[#d8dee9] bg-white text-[#344054] hover:bg-[#f2f5f9] focus:ring-[#dbe5ff]'
    return (
        <Link href={href} className={`inline-flex h-9 min-w-32 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 ${className}`}>
            <Icon className='h-4 w-4 shrink-0' />
            <span>{label}</span>
            <span className={primary ? 'text-white/70' : 'text-[#667085]'}>{value}</span>
        </Link>
    )
}

async function loadDwmAlerts(scope: OperatorScope, identity: DashboardViewerIdentity): Promise<{ alerts: DwmAlert[], accessState: DwmAlertAccessState }> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return { alerts: [], accessState: { status: 'unavailable', message: 'TI scraper backend is not configured.' } }

    try {
        const target = new URL('/v1/dwm/alerts', base)
        applyScope(target, scope, identity)
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) {
            const failure = await readDwmApiFailure(response)
            return {
                alerts: [],
                accessState: {
                    status: failure.code === 'organization_visibility_denied' || response.status === 401 || response.status === 403
                        ? identity.source === 'anonymous' ? 'identity_missing' : 'visibility_denied'
                        : 'unavailable',
                    code: failure.code,
                    message: failure.message || `DWM alerts returned HTTP ${response.status}.`,
                    reason: failure.reason,
                    attemptedIdentity: identityPayload(identity),
                },
            }
        }
        const payload = await response.json() as { alerts?: DwmAlert[] }
        return { alerts: payload.alerts || [], accessState: { status: 'loaded', attemptedIdentity: identityPayload(identity) } }
    } catch {
        return { alerts: [], accessState: { status: 'unavailable', message: 'DWM alerts API could not be reached.', attemptedIdentity: identityPayload(identity) } }
    }
}

async function loadDwmWatchlists(scope: OperatorScope, identity: DashboardViewerIdentity): Promise<DwmWatchlistSummary[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/watchlists', base)
        applyScope(target, scope, identity)
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { watchlists?: DwmWatchlistSummary[] }
        return payload.watchlists || []
    } catch {
        return []
    }
}

async function loadDwmOperations(scope: OperatorScope, identity: DashboardViewerIdentity): Promise<DwmOperationsSnapshot | null> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return null

    try {
        const target = new URL('/v1/dwm/operations', base)
        applyScope(target, scope, identity)
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return null
        return await response.json() as DwmOperationsSnapshot
    } catch {
        return null
    }
}

async function loadDwmDeliveries(scope: OperatorScope, identity: DashboardViewerIdentity): Promise<DwmDeliveryItem[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/webhooks/deliveries', base)
        applyScope(target, scope, identity)
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { deliveries?: DwmDeliveryItem[] }
        return (payload.deliveries || []).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
    } catch {
        return []
    }
}

async function readDwmApiFailure(response: Response): Promise<{ code?: string, message?: string, reason?: string }> {
    try {
        const payload = await response.json() as { error?: { code?: string, message?: string, reason?: string } }
        return {
            code: payload.error?.code,
            message: payload.error?.message,
            reason: payload.error?.reason,
        }
    } catch {
        return {}
    }
}

function identityPayload(identity: DashboardViewerIdentity): DwmAlertAccessState['attemptedIdentity'] {
    return {
        userEmail: identity.userEmail,
        userId: identity.userId,
        actor: identity.actor,
        source: identity.source,
    }
}

async function loadDashboardSourceProof(Headers: Headers, watchlists: DwmWatchlistSummary[]) {
    const route = sourceProofRoute(Headers, watchlists)
    if (!route.url) {
        return buildSourceProofReadinessFromProxy(null, {
            route: route.label,
            checkedAt: new Date().toISOString(),
        })
    }

    try {
        const response = await fetch(route.url, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        const payload = await response.json() as DashboardSourceProofProxyPayload
        return buildSourceProofReadinessFromProxy({ ...payload, ok: response.ok && payload.ok !== false }, {
            route: route.label,
            checkedAt: new Date().toISOString(),
        })
    } catch {
        return buildSourceProofReadinessFromProxy(null, {
            route: route.label,
            checkedAt: new Date().toISOString(),
        })
    }
}

async function loadProductProgressReadiness(Headers: Headers, scope: OperatorScope, identity: DashboardViewerIdentity) {
    const route = productProgressRoute(Headers, scope, identity)
    if (!route.url) {
        return buildProductProgressExternalState(null, {
            checkedAt: new Date().toISOString(),
        })
    }

    try {
        const response = await fetch(route.url, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) {
            return buildProductProgressExternalState(null, {
                checkedAt: new Date().toISOString(),
            })
        }
        const payload = parseProductProgressReadinessPayload(await response.json())
        return buildProductProgressExternalState(payload, {
            checkedAt: new Date().toISOString(),
            staleAfterMinutes: 120,
        })
    } catch {
        return buildProductProgressExternalState(null, {
            checkedAt: new Date().toISOString(),
        })
    }
}

function productProgressRoute(Headers: Headers, scope: OperatorScope, identity: DashboardViewerIdentity) {
    const host = Headers.get('x-forwarded-host') || Headers.get('host')
    const proto = Headers.get('x-forwarded-proto') || 'http'
    const label = '/api/product-progress'
    if (!host) return { label }
    const url = new URL(label, `${proto}://${host}`)
    if (scope.organizationId) {
        url.searchParams.set('organizationId', scope.organizationId)
    } else {
        url.searchParams.set('tenantId', scope.tenantId)
    }
    if (identity.userEmail) url.searchParams.set('userEmail', identity.userEmail)
    if (identity.userId) url.searchParams.set('userId', identity.userId)
    if (identity.actor) url.searchParams.set('actor', identity.actor)
    return { url, label }
}

function sourceProofRoute(Headers: Headers, watchlists: DwmWatchlistSummary[]) {
    const host = Headers.get('x-forwarded-host') || Headers.get('host')
    const proto = Headers.get('x-forwarded-proto') || 'http'
    const query = sourceProofQuery(watchlists)
    const label = `/api/ti/scraper/control?q=${encodeURIComponent(query)}`
    if (!host) return { label }
    const url = new URL('/api/ti/scraper/control', `${proto}://${host}`)
    url.searchParams.set('q', query)
    return { url, label }
}

function sourceProofQuery(watchlists: DwmWatchlistSummary[]) {
    const terms = watchlists
        .filter(watchlist => watchlist.status === 'active')
        .flatMap(watchlist => watchlist.terms || [])
        .map(term => term.value.trim())
        .filter(Boolean)
    return terms.slice(0, 4).join(',') || 'watchlist terms'
}

async function loadDwmOrganizationState(): Promise<DwmOrganizationState> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return { organizations: [], members: [], pendingInvites: [], webhooks: [] }

    try {
        const orgTarget = new URL('/v1/organizations', base)
        const orgResponse = await fetch(orgTarget, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!orgResponse.ok) return { organizations: [], members: [], pendingInvites: [], webhooks: [] }
        const orgPayload = await orgResponse.json() as { organizations?: DwmOrganizationSummary[] }
        const organizations = (orgPayload.organizations || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        const selectedOrganization = organizations.find(item => item.status === 'active') || organizations[0]
        if (!selectedOrganization) return { organizations, members: [], pendingInvites: [], webhooks: [] }

        const webhookTarget = new URL(`/v1/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks`, base)
        const membersTarget = new URL(`/v1/organizations/${encodeURIComponent(selectedOrganization.id)}/members`, base)
        const [webhookResponse, membersResponse] = await Promise.all([
            fetch(webhookTarget, { cache: 'no-store', signal: AbortSignal.timeout(2500) }),
            fetch(membersTarget, { cache: 'no-store', signal: AbortSignal.timeout(2500) }),
        ])
        const webhookPayload = webhookResponse.ok ? await webhookResponse.json() as { destinations?: DwmOrganizationWebhookDestination[] } : { destinations: [] }
        const memberPayload = membersResponse.ok ? await membersResponse.json() as { members?: DwmOrganizationMember[], pendingInvites?: DwmOrganizationInvite[] } : { members: [], pendingInvites: [] }
        return {
            organizations,
            selectedOrganization,
            members: (memberPayload.members || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
            pendingInvites: (memberPayload.pendingInvites || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
            webhooks: (webhookPayload.destinations || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        }
    } catch {
        return { organizations: [], members: [], pendingInvites: [], webhooks: [] }
    }
}

function buildWorkbenchCases(overview: TiAdminOverview, alerts: DwmAlert[], readinessCases: WorkbenchCase[], liveAlerts: boolean, scope: OperatorScope, deliveries: DwmDeliveryItem[]): WorkbenchCase[] {
    const alertCases = alerts.map(alert => alertToCase(alert, liveAlerts, scope, deliveries))
    const domainCases = overview.domains.map(domain => domainToCase(domain, overview.captures))
    const captureCases = overview.captures.map(captureToCase)

    return [...readinessCases, ...alertCases, ...domainCases, ...captureCases]
        .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt))
}

function webhookAlertOption(alert: DwmAlert, scope: OperatorScope): DashboardWebhookAlertOption {
    const workflowAlert = alert as DwmWorkflowAlert
    const evidenceTimestamp = alert.evidence[0]?.observedAt || alert.evidence[0]?.firstSeenAt || alert.evidenceSummary?.lastObservedAt || alert.lastSeenAt || alert.firstSeenAt
    const caseId = workflowAlert.caseId || workflowAlert.caseIdCandidate || workflowAlert.workflowContext?.caseIdCandidate
    const organizationId = workflowAlert.organizationId || workflowAlert.workflowContext?.organizationId || scope.organizationId
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''

    return {
        id: alert.id,
        title: alert.company || alert.matchedTerm.value,
        severity: alert.severity,
        confidence: alert.confidence,
        watchlistTerm: alert.matchedTerm.value,
        sourceFamily: alert.sourceFamily,
        evidenceCount: alert.evidenceSummary?.evidenceCount || alert.evidence.length,
        evidenceTimestamp,
        routeLabel: alert.webhookDelivery.recommendedRoute.replaceAll('_', ' '),
        routeUrl: `/api/dwm/alerts/${encodeURIComponent(alert.id)}${query}`,
        caseId,
        casePath: caseId ? `/api/cases/${encodeURIComponent(caseId)}${query}` : undefined,
        summary: alert.claimSummary,
        dedupeKey: alert.webhookDelivery.dedupeKey,
    }
}

function alertToCase(alert: DwmAlert, liveAlert: boolean, scope: OperatorScope, deliveries: DwmDeliveryItem[]): WorkbenchCase {
    const workflowAlert = alert as DwmWorkflowAlert
    const severity = normalizeSeverity(alert.severity)
    const caseId = workflowAlert.caseId || workflowAlert.caseIdCandidate || workflowAlert.workflowContext?.caseIdCandidate
    const casePath = caseId ? `/api/cases/${encodeURIComponent(caseId)}${scope.organizationId ? `?organizationId=${encodeURIComponent(scope.organizationId)}` : ''}` : undefined
    const deliveryState = workflowAlert.deliveryState || 'pending_review'
    const watchlistIds = workflowAlert.workflowContext?.watchlistIds || []
    const webhookDestinationIds = workflowAlert.webhookContext?.webhookDestinationIds || workflowAlert.workflowContext?.webhookDestinationIds || []
    const organizationId = workflowAlert.organizationId || workflowAlert.workflowContext?.organizationId || scope.organizationId
    const alertDeliveries = deliveries.filter(delivery => delivery.alertId === alert.id)
    const latestDelivery = latestDeliveryAttempt(alertDeliveries)
    const deliveryHistoryHref = alertDeliveryHistoryHref(alert.id, scope, latestDelivery)
    const dwmWorkspaceHref = dwmAlertWorkspaceHref(alert.id, scope)
    const actionReadiness = alertAnalystActionReadiness(alert)
    const workflowPath = [
        {
            id: `${alert.id}_path_org`,
            label: 'Organization',
            status: organizationId ? 'ready' : 'needs_action',
            owner: organizationId ? 'operator' : 'backend-foundation',
            source: 'GET /api/organizations',
            entityId: organizationId,
            href: organizationId ? `/api/organizations/${encodeURIComponent(organizationId)}/members` : '/api/organizations',
            detail: organizationId ? `Alert scoped to organization ${organizationId}.` : 'Alert has no organization scope; using tenant fallback.',
        },
        {
            id: `${alert.id}_path_watchlist`,
            label: 'Shared watchlist',
            status: watchlistIds.length ? 'ready' : liveAlert ? 'needs_action' : 'blocked',
            owner: 'operator',
            source: 'GET/POST /api/dwm/watchlists',
            entityId: watchlistIds.join(', ') || undefined,
            href: dwmWorkspaceHref,
            detail: watchlistIds.length ? `Matched watchlist ${watchlistIds.join(', ')}.` : 'No watchlist IDs returned with this alert.',
        },
        {
            id: `${alert.id}_path_case`,
            label: 'Analyst case',
            status: liveAlert && caseId ? 'ready' : liveAlert ? 'needs_action' : 'blocked',
            owner: 'analyst',
            source: 'POST /api/cases',
            entityId: caseId,
            href: casePath,
            detail: liveAlert ? caseId ? `Case candidate ${caseId}.` : 'Open a backed case from this alert.' : 'Fallback alert cannot open a backed case.',
        },
        {
            id: `${alert.id}_path_webhook`,
            label: 'Webhook delivery',
            status: deliveryState === 'delivered' ? 'ready' : webhookDestinationIds.length || workflowAlert.webhookContext?.hasWebhookRoute ? 'needs_action' : liveAlert ? 'blocked' : 'blocked',
            owner: 'operator',
            source: 'POST /api/dwm/webhooks/deliver',
            entityId: webhookDestinationIds.join(', ') || workflowAlert.webhookDelivery.dedupeKey,
            href: deliveryHistoryHref,
            detail: latestDelivery
                ? `Latest ${latestDelivery.status} delivery ${latestDelivery.id}; ${alertDeliveries.length} attempt${alertDeliveries.length === 1 ? '' : 's'} in the delivery ledger.`
                : `Delivery state: ${deliveryState}. No delivery ledger row matched this alert.`,
        },
    ] satisfies WorkbenchCase['workflowPath']
    const timeline: WorkbenchTimelineItem[] = [
        {
            id: `${alert.id}_seen`,
            at: alert.firstSeenAt,
            title: 'Alert created',
            body: `${alert.matchedTerm.value} matched ${alert.sourceCount} ${pluralize('source', alert.sourceCount)}.`,
        },
        {
            id: `${alert.id}_route`,
            at: alert.firstSeenAt,
            title: 'Recommended route',
            body: alert.routingContext?.reason || alert.webhookDelivery.recommendedRoute.replaceAll('_', ' '),
        },
        ...(alert.matchContext ? [{
            id: `${alert.id}_match_context`,
            at: alert.firstSeenAt,
            title: 'Match reason',
            body: `${alert.matchContext.termKind}:${alert.matchContext.normalizedTerm} matched ${alert.matchContext.matchedFieldHints.join(', ') || 'alert evidence'}.`,
        }] : []),
        ...(actionReadiness ? [{
            id: `${alert.id}_action_readiness`,
            at: alert.lastSeenAt || alert.firstSeenAt,
            title: 'Analyst actions',
            body: alertActionReadinessSummary(actionReadiness),
        }] : []),
        ...deliveryTimelineItems(alertDeliveries),
    ]

    return {
        id: alert.id,
        kind: 'dwm_alert',
        queue: severity === 'critical' ? 'Incident response' : alert.webhookDelivery.recommendedRoute.replaceAll('_', ' '),
        title: alert.company,
        subtitle: alert.claimSummary,
        severity,
        status: alert.reviewState || 'needs_review',
        priority: severityPriority(severity) + alert.confidence,
        confidence: alert.confidence,
        owner: workflowAlert.assignedOwner || 'unassigned',
        createdAt: alert.firstSeenAt,
        updatedAt: alert.firstSeenAt,
        company: alert.company,
        matchedTerm: alert.matchedTerm.value,
        actor: alert.actor || alert.sourceFamily.replaceAll('_', ' '),
        sourceLabel: `${alert.sourceCount} ${pluralize('source', alert.sourceCount)}`,
        recommendedAction: alert.recommendedAction,
        routeLabel: alert.webhookDelivery.recommendedRoute.replaceAll('_', ' '),
        persistent: liveAlert,
        evidence: alert.evidence.map(item => ({
            id: item.id,
            sourceName: item.sourceName,
            sourceFamily: item.sourceFamily.replaceAll('_', ' '),
            captureMode: item.captureMode.replaceAll('_', ' '),
            redactionState: item.redactionState.replaceAll('_', ' '),
            contentHash: item.contentHash,
            excerpt: item.excerpt,
            observedAt: item.observedAt || item.firstSeenAt || alert.firstSeenAt,
            provenance: item.provenance ? `${item.provenance.sourceId} · ${item.provenance.captureId} · ${item.provenance.captureMode}` : `${item.sourceFamily.replaceAll('_', ' ')} · ${alert.webhookDelivery.dedupeKey}`,
            confidence: alert.confidence,
            metadata: alertEvidenceMetadata(alert, item),
        })),
        timeline,
        nextTasks: [
            liveAlert ? `Owner: analyst. Alert ID: ${alert.id}.` : `Owner: analyst. ${alert.id} is fallback-only until live alerts load.`,
            caseId ? `Case ID: ${caseId}. Update the backed case before closing.` : 'Open a backed analyst case before customer delivery.',
            actionReadiness ? alertActionReadinessSummary(actionReadiness) : 'Action status is not returned with this alert.',
            latestDelivery
                ? `Latest delivery ${latestDelivery.id} is ${latestDelivery.status}; open the ledger before notifying the customer.`
                : webhookDestinationIds.length ? `Webhook destination IDs: ${webhookDestinationIds.join(', ')}.` : 'Configure/test webhook destination before sending.',
        ],
        relatedLinks: [
            { href: `/api/dwm/alerts/${encodeURIComponent(alert.id)}`, label: 'Alert API' },
            ...(casePath ? [{ href: casePath, label: 'Case API' }] : []),
            { href: deliveryHistoryHref, label: 'Delivery history' },
            { href: dwmWorkspaceHref, label: 'Open DWM workspace' },
            { href: '/dashboard/automations?setup=dwm', label: 'Webhook subscription' },
        ],
        workflowPath,
        caseDetailHref: casePath,
        deliveryEvidence: alertDeliveries.map(delivery => ({
            id: delivery.id,
            alertId: delivery.alertId,
            status: delivery.status,
            deliveryKind: delivery.deliveryKind,
            attemptedAt: delivery.attemptedAt,
            webhookDestinationId: delivery.webhookDestinationId,
            endpointHash: delivery.endpointHash,
            payloadHash: delivery.payloadHash,
            httpStatus: delivery.httpStatus,
            error: delivery.error,
        })),
        missingDependency: !liveAlert
            ? 'This is a fallback alert. It cannot load /api/cases/:id or delivery rows until live DWM alerts are returned by the backend.'
            : !casePath
                ? 'No case ID is attached yet. Use Open case to create the backed /api/cases record.'
                : !alertDeliveries.length
                    ? 'No webhook delivery rows returned from /api/dwm/webhooks/deliveries. Run Send alert or Test org webhook to create delivery evidence.'
                    : undefined,
        actions: liveAlert ? [
            {
                id: 'open_case',
                label: caseId ? 'Update case' : 'Open case',
                method: 'POST',
                href: '/api/cases',
                body: {
                    ...actionScope(scope),
                    alertId: alert.id,
                    sourceId: alert.id,
                    title: `${severity.toUpperCase()} ${alert.company}`,
                    summary: alert.claimSummary,
                    priority: severity,
                    reopen: true,
                    ...alertActionRequestGuard(actionReadiness, 'case_link', { includeIdempotencyKey: true }),
                },
                disabledReason: alertActionDisabledReason(actionReadiness, 'case_link'),
            },
            {
                id: 'send_alert',
                label: 'Send alert',
                method: 'POST',
                href: '/api/dwm/webhooks/deliver',
                body: { ...actionScope(scope), alertId: alert.id, limit: 1, ...alertActionRequestGuard(actionReadiness, 'deliver', { includeDeliveryDedupeKey: true }) },
                disabledReason: alertActionDisabledReason(actionReadiness, 'deliver'),
            },
            ...alertWorkflowActions(alert, deliveryState, scope, actionReadiness),
        ] : [],
    }
}

function alertEvidenceMetadata(alert: DwmAlert, item: DwmAlert['evidence'][number]) {
    return [
        { label: 'Matched term', value: `${alert.matchedTerm.kind}:${alert.matchedTerm.value}` },
        alert.matchContext?.matchType ? { label: 'Match type', value: alert.matchContext.matchType.replaceAll('_', ' ') } : undefined,
        alert.matchContext?.matchedFieldHints?.length ? { label: 'Matched fields', value: alert.matchContext.matchedFieldHints.join(', ') } : undefined,
        alert.routingContext?.reason ? { label: 'Routing reason', value: alert.routingContext.reason } : undefined,
        alert.routingContext?.customerVisibleEvidence ? { label: 'Customer evidence', value: alert.routingContext.customerVisibleEvidence.replaceAll('_', ' ') } : undefined,
        alert.evidenceSummary ? { label: 'Evidence window', value: `${alert.evidenceSummary.evidenceCount} item${alert.evidenceSummary.evidenceCount === 1 ? '' : 's'}; ${alert.evidenceSummary.publicSafeCount} customer-safe` } : undefined,
        alert.evidenceSummary?.sourceFamilyCounts?.[item.sourceFamily] !== undefined ? { label: 'Family coverage', value: `${alert.evidenceSummary.sourceFamilyCounts[item.sourceFamily]} ${item.sourceFamily.replaceAll('_', ' ')} item${alert.evidenceSummary.sourceFamilyCounts[item.sourceFamily] === 1 ? '' : 's'}` } : undefined,
        item.provenance?.retentionClass ? { label: 'Retention', value: item.provenance.retentionClass } : undefined,
        item.provenance?.collector ? { label: 'Collector', value: item.provenance.collector } : undefined,
    ].filter((meta): meta is { label: string, value: string } => Boolean(meta?.value))
}

function alertWorkflowActions(alert: DwmAlert, deliveryState: string, scope: OperatorScope, readiness?: DwmAlertAnalystActionReadiness) {
    const href = `/api/dwm/alerts/${encodeURIComponent(alert.id)}`
    const scoped = { ...actionScope(scope), alertId: alert.id }
    const closeDeliveryState = deliveryState === 'delivered' ? 'delivered' : 'muted'
    const transitionGuard = alertActionRequestGuard(readiness, 'transition')
    return [
        {
            id: 'replay_alert',
            label: 'Replay',
            method: 'POST' as const,
            href: `/api/dwm/alerts/${encodeURIComponent(alert.id)}/replay`,
            body: { ...scoped, action: 'replay', ...alertActionRequestGuard(readiness, 'replay', { includeIdempotencyKey: true }) },
            disabledReason: alertActionDisabledReason(readiness, 'replay'),
        },
        {
            id: 'review_alert',
            label: 'Review alert',
            method: 'PATCH' as const,
            href,
            body: { ...scoped, reviewState: 'reviewing', deliveryState: 'pending_review', note: 'Analyst review started.', ...transitionGuard },
            disabledReason: alertActionDisabledReason(readiness, 'transition'),
        },
        {
            id: 'escalate_alert',
            label: 'Escalate alert',
            method: 'PATCH' as const,
            href,
            body: { ...scoped, reviewState: 'route_to_customer', deliveryState: 'ready_to_send', note: 'Escalated for customer or incident response.', ...transitionGuard },
            disabledReason: alertActionDisabledReason(readiness, 'transition'),
        },
        {
            id: 'suppress_alert',
            label: 'Suppress alert',
            method: 'PATCH' as const,
            href,
            body: { ...scoped, reviewState: 'false_positive', deliveryState: 'muted', note: 'Suppressed as low-value or false positive.', ...alertActionRequestGuard(readiness, 'suppress', { includeIdempotencyKey: true }) },
            disabledReason: alertActionDisabledReason(readiness, 'suppress'),
        },
        {
            id: 'close_alert',
            label: 'Close alert',
            method: 'PATCH' as const,
            href,
            body: { ...scoped, reviewState: 'resolved', deliveryState: closeDeliveryState, note: 'Closed from analyst workbench.', ...alertActionRequestGuard(readiness, 'close', { includeIdempotencyKey: true }) },
            disabledReason: alertActionDisabledReason(readiness, deliveryState === 'delivered' ? 'close' : 'close'),
        },
    ]
}

function alertAnalystActionReadiness(alert: DwmAlert): DwmAlertAnalystActionReadiness | undefined {
    const readiness = alert.sourceHandoffReadiness?.analystWorkflowConsumer?.actionReadiness
    return readiness?.schemaVersion === 'dwm.alert_analyst_action_readiness.v1' ? readiness : undefined
}

function alertActionDisabledReason(readiness: DwmAlertAnalystActionReadiness | undefined, action: DwmAlertAnalystAction) {
    if (!readiness) return undefined
    const row = readiness.actions?.find(item => item.action === action)
    if (!row) return `Backend action status did not return ${action}.`
    if (row.ready) return undefined
    const blockers = row.blockerCodes?.length ? row.blockerCodes.join(', ') : 'not ready'
    return `${action.replaceAll('_', ' ')} blocked by backend action status: ${blockers}.`
}

function alertActionRequestGuard(readiness: DwmAlertAnalystActionReadiness | undefined, action: DwmAlertAnalystAction, options: { includeIdempotencyKey?: boolean, includeDeliveryDedupeKey?: boolean } = {}) {
    if (!readiness) return {}
    const row = readiness.actions?.find(item => item.action === action)
    const expectedWorkflowEventCount = readiness.expectedWorkflowEventCount ?? row?.workflowEventCount
    return {
        ...(expectedWorkflowEventCount !== undefined ? { expectedWorkflowEventCount } : {}),
        ...(row?.casePath ? { casePath: row.casePath } : {}),
        ...(options.includeIdempotencyKey && row?.idempotencyKey ? { idempotencyKey: row.idempotencyKey } : {}),
        ...(options.includeDeliveryDedupeKey && row?.deliveryDedupeKey ? { deliveryDedupeKey: row.deliveryDedupeKey } : {}),
    }
}

function alertActionReadinessSummary(readiness: DwmAlertAnalystActionReadiness) {
    const ready = readiness.readyActions?.length ? readiness.readyActions.join(', ') : 'none'
    const blocked = readiness.blockedActions?.length ? readiness.blockedActions.join(', ') : 'none'
    const eventCount = readiness.expectedWorkflowEventCount ?? readiness.actions?.[0]?.workflowEventCount
    return `Ready actions: ${ready}. Blocked actions: ${blocked}.${eventCount === undefined ? '' : ` Workflow events: ${eventCount}.`}`
}

function latestDeliveryAttempt(deliveries: DwmDeliveryItem[]) {
    return [...deliveries].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))[0]
}

function deliveryTimelineItems(deliveries: DwmDeliveryItem[]): WorkbenchTimelineItem[] {
    return [...deliveries]
        .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
        .slice(0, 3)
        .map(delivery => ({
            id: `${delivery.id}_delivery_attempt`,
            at: delivery.attemptedAt,
            title: 'Webhook delivery attempt',
            body: [
                `${delivery.status}${delivery.httpStatus ? ` HTTP ${delivery.httpStatus}` : ''}`,
                delivery.webhookDestinationId ? `destination ${delivery.webhookDestinationId}` : undefined,
                delivery.deliveryKind ? `kind ${delivery.deliveryKind}` : undefined,
                delivery.error ? `error ${delivery.error}` : undefined,
            ].filter(Boolean).join(' · '),
        }))
}

function alertDeliveryHistoryHref(alertId: string, scope: OperatorScope, delivery?: DwmDeliveryItem) {
    const params = new URLSearchParams()
    if (scope.organizationId) params.set('organizationId', scope.organizationId)
    else params.set('tenantId', scope.tenantId)
    params.set('alertId', alertId)
    if (delivery?.id) params.set('deliveryId', delivery.id)
    if (delivery?.webhookDestinationId) params.set('webhookDestinationId', delivery.webhookDestinationId)
    return `/api/dwm/webhooks/deliveries?${params.toString()}`
}

function dwmAlertWorkspaceHref(alertId: string, scope: OperatorScope) {
    const params = new URLSearchParams()
    params.set('alert', alertId)
    if (scope.organizationId) params.set('organizationId', scope.organizationId)
    else params.set('tenantId', scope.tenantId)
    return `/dashboard/dwm?${params.toString()}`
}

function domainToCase(domain: TiAdminDomain, captures: TiAdminCapture[]): WorkbenchCase {
    const relatedCaptures = captures.filter(capture => capture.domain === domain.domain)
    const latestCapture = relatedCaptures.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]
    const severity = domain.status === 'review' ? 'high' : domain.status === 'watching' ? 'medium' : 'low'
    const evidence: WorkbenchEvidence[] = relatedCaptures.map(capture => captureEvidence(capture))

    return {
        id: `domain_${domain.domain}`,
        kind: 'ti_domain',
        queue: domain.status === 'review' ? 'Domain review' : 'Watchlist monitoring',
        title: domain.company,
        subtitle: `${domain.domain} matched ${domain.resultCount} ${pluralize('result', domain.resultCount)} across ${domain.sourceIds.length} ${pluralize('source', domain.sourceIds.length)}.`,
        severity,
        status: domain.status,
        priority: severityPriority(severity) + domain.resultCount,
        confidence: relatedCaptures.length ? 78 : 62,
        owner: 'source-ops',
        createdAt: latestCapture?.publishedAt || domain.lastSeenAt,
        updatedAt: domain.lastSeenAt,
        company: domain.company,
        matchedTerm: domain.matchedTerms.join(', '),
        actor: latestCapture?.actor || 'Source correlation',
        sourceLabel: domain.sourceIds.map(sourceId => sourceById(sourceId)?.name || sourceId).join(', '),
        recommendedAction: domain.status === 'review'
            ? 'Open the related captures, verify the match belongs to the customer, then route as a DWM alert or mark it quiet.'
            : 'Keep monitoring and promote only if another source corroborates the match or risk increases.',
        routeLabel: domain.status === 'review' ? 'analyst review' : 'source watch',
        persistent: false,
        evidence,
        timeline: [
            {
                id: `domain_${domain.domain}_last_seen`,
                at: domain.lastSeenAt,
                title: 'Domain last seen',
                body: `${domain.domain} appeared in the TI corpus at ${formatTiDate(domain.lastSeenAt)}.`,
            },
            {
                id: `domain_${domain.domain}_sources`,
                at: domain.lastSeenAt,
                title: 'Sources attached',
                body: domain.sourceIds.map(sourceId => sourceById(sourceId)?.name || sourceId).join(', '),
            },
        ],
        nextTasks: [
            'Check source families and matched terms for false-positive risk.',
            'Promote corroborated findings into DWM customer routing.',
            'Record the analyst decision rationale.',
        ],
        relatedLinks: [
            { href: `/dashboard/ti/domains/${encodeURIComponent(domain.domain)}`, label: 'Open domain' },
            { href: '/dashboard/ti/sources', label: 'Review sources' },
        ],
    }
}

function captureToCase(capture: TiAdminCapture): WorkbenchCase {
    const source = sourceById(capture.sourceId)
    const severity = source?.risk === 'restricted' ? 'high' : source?.status === 'candidate' ? 'medium' : 'low'

    return {
        id: `capture_${capture.id}`,
        kind: 'source_capture',
        queue: 'Evidence review',
        title: capture.title,
        subtitle: capture.resultSummary,
        severity,
        status: 'needs_review',
        priority: severityPriority(severity) + 8,
        confidence: source?.risk === 'restricted' ? 82 : 70,
        owner: capture.owner,
        createdAt: capture.publishedAt,
        updatedAt: capture.capturedAt,
        company: capture.domain,
        matchedTerm: capture.domain,
        actor: capture.actor,
        sourceLabel: source?.name || capture.sourceId,
        recommendedAction: 'Verify the captured metadata is customer-safe, attach the useful fields, and either promote it to a case or suppress it as benign.',
        routeLabel: 'evidence review',
        persistent: false,
        evidence: [captureEvidence(capture)],
        timeline: [
            {
                id: `${capture.id}_published`,
                at: capture.publishedAt,
                title: 'Observed by source',
                body: capture.pageType,
            },
            {
                id: `${capture.id}_captured`,
                at: capture.capturedAt,
                title: 'Capture normalized',
                body: capture.screenshotLabel,
            },
        ],
        nextTasks: [
            'Validate redaction state and metadata boundaries.',
            'Compare with domain and actor context before routing.',
            'Suppress noisy source output if it does not map to a customer workflow.',
        ],
        relatedLinks: [
            { href: `/dashboard/ti/sources/${capture.sourceId}`, label: 'Open source' },
            { href: `/dashboard/ti/domains/${encodeURIComponent(capture.domain)}`, label: 'Open domain' },
        ],
    }
}

function captureEvidence(capture: TiAdminCapture): WorkbenchEvidence {
    return {
        id: capture.id,
        sourceName: sourceById(capture.sourceId)?.name || capture.sourceId,
        sourceFamily: capture.pageType,
        captureMode: 'metadata only',
        redactionState: 'customer safe',
        contentHash: capture.metadata.find(item => item.label === 'Dedupe key')?.value || capture.id,
        excerpt: capture.resultSummary,
        observedAt: capture.capturedAt,
        provenance: `${capture.sourceId} · ${capture.pageType}`,
        confidence: sourceById(capture.sourceId)?.risk === 'restricted' ? 82 : 70,
        metadata: capture.metadata,
    }
}

function normalizeSeverity(severity: DwmSeverity): WorkbenchCase['severity'] {
    return severity
}

function severityPriority(severity: WorkbenchCase['severity']) {
    if (severity === 'critical') return 400
    if (severity === 'high') return 300
    if (severity === 'medium') return 200
    return 100
}

function pluralize(word: string, count: number) {
    return count === 1 ? word : `${word}s`
}

function actionScope(scope: OperatorScope) {
    return scope.organizationId ? { organizationId: scope.organizationId } : { tenantId: scope.tenantId }
}

type DwmWorkflowAlert = DwmAlert & {
    tenantId?: string
    organizationId?: string
    watchlistIds?: string[]
    caseId?: string
    caseIdCandidate?: string
    casePath?: string
    deliveryState?: string
    assignedOwner?: string
    workflowContext?: {
        organizationId?: string
        watchlistIds?: string[]
        webhookDestinationIds?: string[]
        caseIdCandidate?: string
        casePath?: string
    }
    webhookContext?: {
        hasWebhookRoute?: boolean
        webhookDestinationIds?: string[]
        caseIdCandidate?: string
        casePath?: string
    }
}
