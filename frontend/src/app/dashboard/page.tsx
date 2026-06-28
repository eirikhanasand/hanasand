import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BellRing, Radar } from 'lucide-react'
import { DashboardPage } from '@/components/dashboard/ui'
import { demoDwmProductSnapshot, type DwmAlert, type DwmSeverity } from '@/utils/dwm/product'
import { formatTiDate, getTiAdminOverview, sourceById, type TiAdminCapture, type TiAdminDomain, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import AnalystWorkbenchClient, { type WorkbenchCase, type WorkbenchEvidence, type WorkbenchTimelineItem } from './ti/workbench/workbenchClient'
import { buildReadinessCases, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmOrganizationSummary, type DwmOrganizationWebhookDestination, type DwmWatchlistSummary, type OperatorScope } from './operatorConsoleModel'

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
    const [liveAlerts, watchlists, operations, deliveries] = await Promise.all([
        loadDwmAlerts(scope),
        loadDwmWatchlists(scope),
        loadDwmOperations(scope),
        loadDwmDeliveries(scope),
    ])
    const fallbackAlerts = demoDwmProductSnapshot(new Date().toISOString()).alerts
    const alerts = liveAlerts.length ? liveAlerts : fallbackAlerts
    const readinessCases = buildReadinessCases({
        backendConfigured: Boolean(process.env.TI_SCRAPER_API_BASE),
        scope,
        watchlists,
        operations,
        deliveries,
        organizationState,
        liveAlertCount: liveAlerts.length,
        renderedAlertCount: alerts.length,
    })
    const cases = buildWorkbenchCases(overview, alerts, readinessCases, liveAlerts.length > 0, scope)
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
            />

            <AnalystWorkbenchClient initialCases={cases} chrome='compact' />
        </DashboardPage>
    )
}

function OperatorTopBar({ firstName, caseCount, highPriorityCount, persistentCount }: { firstName: string, caseCount: number, highPriorityCount: number, persistentCount: number }) {
    return (
        <section className='rounded-lg border border-[#dfe5ee] bg-white px-3 py-2 shadow-sm'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Operations workbench</p>
                    <h1 className='truncate text-lg font-semibold text-[#171a21]'>{firstName}, work the queue.</h1>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <CompactStat label='Cases' value={String(caseCount)} />
                    <CompactStat label='High' value={String(highPriorityCount)} tone='warn' />
                    <CompactStat label='API-backed' value={String(persistentCount)} tone='good' />
                    <span className='rounded-lg border border-[#d8dee9] bg-[#fbfcfe] px-2.5 py-1.5 text-xs font-semibold text-[#596170]'>TI owner/notes session-local</span>
                    <Link href='/dashboard/dwm' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff]'>
                        <Radar className='h-4 w-4' />
                        DWM
                    </Link>
                    <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-9 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-xs font-semibold text-white transition hover:bg-[#2b2f39] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe]'>
                        <BellRing className='h-4 w-4' />
                        Delivery
                    </Link>
                </div>
            </div>
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

async function loadDwmAlerts(scope: OperatorScope): Promise<DwmAlert[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/alerts', base)
        applyScope(target, scope)
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { alerts?: DwmAlert[] }
        return payload.alerts || []
    } catch {
        return []
    }
}

async function loadDwmWatchlists(scope: OperatorScope): Promise<DwmWatchlistSummary[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/watchlists', base)
        applyScope(target, scope)
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { watchlists?: DwmWatchlistSummary[] }
        return payload.watchlists || []
    } catch {
        return []
    }
}

async function loadDwmOperations(scope: OperatorScope): Promise<DwmOperationsSnapshot | null> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return null

    try {
        const target = new URL('/v1/dwm/operations', base)
        applyScope(target, scope)
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return null
        return await response.json() as DwmOperationsSnapshot
    } catch {
        return null
    }
}

async function loadDwmDeliveries(scope: OperatorScope): Promise<DwmDeliveryItem[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/webhooks/deliveries', base)
        applyScope(target, scope)
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { deliveries?: DwmDeliveryItem[] }
        return (payload.deliveries || []).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
    } catch {
        return []
    }
}

function applyScope(target: URL, scope: OperatorScope) {
    if (scope.organizationId) {
        target.searchParams.set('organizationId', scope.organizationId)
        return
    }
    target.searchParams.set('tenantId', scope.tenantId)
}

async function loadDwmOrganizationState(): Promise<DwmOrganizationState> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return { organizations: [], webhooks: [] }

    try {
        const orgTarget = new URL('/v1/organizations', base)
        const orgResponse = await fetch(orgTarget, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!orgResponse.ok) return { organizations: [], webhooks: [] }
        const orgPayload = await orgResponse.json() as { organizations?: DwmOrganizationSummary[] }
        const organizations = (orgPayload.organizations || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        const selectedOrganization = organizations.find(item => item.status === 'active') || organizations[0]
        if (!selectedOrganization) return { organizations, webhooks: [] }

        const webhookTarget = new URL(`/v1/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks`, base)
        const webhookResponse = await fetch(webhookTarget, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!webhookResponse.ok) return { organizations, selectedOrganization, webhooks: [] }
        const webhookPayload = await webhookResponse.json() as { destinations?: DwmOrganizationWebhookDestination[] }
        return {
            organizations,
            selectedOrganization,
            webhooks: (webhookPayload.destinations || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        }
    } catch {
        return { organizations: [], webhooks: [] }
    }
}

function buildWorkbenchCases(overview: TiAdminOverview, alerts: DwmAlert[], readinessCases: WorkbenchCase[], liveAlerts: boolean, scope: OperatorScope): WorkbenchCase[] {
    const alertCases = alerts.map(alert => alertToCase(alert, liveAlerts, scope))
    const domainCases = overview.domains.map(domain => domainToCase(domain, overview.captures))
    const captureCases = overview.captures.map(captureToCase)

    return [...readinessCases, ...alertCases, ...domainCases, ...captureCases]
        .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt))
}

function alertToCase(alert: DwmAlert, liveAlert: boolean, scope: OperatorScope): WorkbenchCase {
    const workflowAlert = alert as DwmWorkflowAlert
    const severity = normalizeSeverity(alert.severity)
    const caseId = workflowAlert.caseId || workflowAlert.caseIdCandidate || workflowAlert.workflowContext?.caseIdCandidate
    const casePath = caseId ? `/api/cases/${encodeURIComponent(caseId)}${scope.organizationId ? `?organizationId=${encodeURIComponent(scope.organizationId)}` : ''}` : undefined
    const deliveryState = workflowAlert.deliveryState || 'pending_review'
    const watchlistIds = workflowAlert.workflowContext?.watchlistIds || []
    const webhookDestinationIds = workflowAlert.webhookContext?.webhookDestinationIds || workflowAlert.workflowContext?.webhookDestinationIds || []
    const organizationId = workflowAlert.organizationId || workflowAlert.workflowContext?.organizationId || scope.organizationId
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
            href: '/dashboard/dwm',
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
            href: '/api/dwm/webhooks/deliveries',
            detail: `Delivery state: ${deliveryState}.`,
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
            body: alert.webhookDelivery.recommendedRoute.replaceAll('_', ' '),
        },
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
        })),
        timeline,
        nextTasks: [
            liveAlert ? `Owner: analyst. Alert ID: ${alert.id}.` : `Owner: analyst. ${alert.id} is fallback-only until live alerts load.`,
            caseId ? `Case ID: ${caseId}. Update the backed case before closing.` : 'Open a backed analyst case before customer delivery.',
            webhookDestinationIds.length ? `Webhook destination IDs: ${webhookDestinationIds.join(', ')}.` : 'Configure/test webhook destination before sending.',
        ],
        relatedLinks: [
            { href: `/api/dwm/alerts/${encodeURIComponent(alert.id)}`, label: 'Alert API' },
            ...(casePath ? [{ href: casePath, label: 'Case API' }] : []),
            { href: '/dashboard/dwm', label: 'Open DWM console' },
            { href: '/dashboard/automations?setup=dwm', label: 'Webhook subscription' },
        ],
        workflowPath,
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
                },
            },
            {
                id: 'send_alert',
                label: 'Send alert',
                method: 'POST',
                href: '/api/dwm/webhooks/deliver',
                body: { ...actionScope(scope), alertId: alert.id, limit: 1 },
            },
        ] : [],
    }
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
