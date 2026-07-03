import Link from 'next/link'
import { ArrowUpRight, Inbox, Radar } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import type { DwmAlert } from '@/utils/dwm/product'
import { formatTiDate, getTiAdminOverview, sourceById, type TiAdminCapture, type TiAdminDomain, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import AnalystWorkbenchClient, { type WorkbenchCase, type WorkbenchEvidence } from './workbenchClient'
import { dwmAlertToWorkbenchCase } from './dwmAlertAdapter'

export const dynamic = 'force-dynamic'

export default async function TiAnalystWorkbenchPage() {
    const overview = getTiAdminOverview()
    const [liveAlerts, liveCases, deliveries] = await Promise.all([
        loadDwmAlerts(),
        loadDwmCases(),
        loadDwmDeliveries(),
    ])
    const alertsWithCaseState = attachCasesToAlerts(liveAlerts, liveCases)
    const alertsWithDelivery = attachDeliveriesToAlerts(alertsWithCaseState, deliveries)
    const cases = buildWorkbenchCases(overview, alertsWithDelivery, liveCases)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Attack review'
                title='Recent attacks'
                description='Triage active exposure cases, inspect evidence, assign owners, and send findings when they are ready.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/dwm' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#26344d] bg-[#0f1726] px-3 text-sm font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033]'>
                            <Radar className='h-4 w-4' />
                            Dark web cases
                        </Link>
                        <Link href='/dashboard/ti/sources' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#315fe8] px-3 text-sm font-semibold text-white transition hover:bg-[#426ef0]'>
                            <Inbox className='h-4 w-4' />
                            Sources
                            <ArrowUpRight className='h-4 w-4' />
                        </Link>
                    </div>
                )}
            />

            <AnalystWorkbenchClient initialCases={cases} />
        </DashboardPage>
    )
}

async function loadDwmAlerts(): Promise<DwmAlert[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/alerts', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { alerts?: DwmAlert[] }
        return payload.alerts || []
    } catch {
        return []
    }
}

type WorkbenchDwmDelivery = {
    id: string
    tenantId?: string
    alertId: string
    watchlistId?: string
    webhookDestinationId?: string
    endpointHash: string
    dedupeKey?: string
    attemptedAt: string
    dryRun?: boolean
    payloadHash: string
    status: string
    httpStatus?: number
    error?: string
    deliveryKind?: string
}

type WorkbenchDwmCaseListItem = {
    id?: string
    caseId?: string
    title?: string
    summary?: string
    status?: string
    priority?: string
    severity?: WorkbenchCase['severity'] | string
    assignedOwner?: string
    organizationId?: string
    tenantId?: string
    alertId?: string
    dedupeKey?: string
    recommendedRoute?: string
    watchlistIds?: string[]
    watchlistItemIds?: string[]
    webhookDeliveryIds?: string[]
    webhookStatuses?: string[]
    createdAt?: string
    updatedAt?: string
    closedAt?: string
    latestEvent?: { id?: string, at?: string, title?: string, eventType?: string, summary?: string, body?: string }
    latestCaseAction?: { id?: string, at?: string, title?: string, eventType?: string, summary?: string, body?: string }
    timeline?: Array<{ id?: string, at?: string, title?: string, eventType?: string, summary?: string, body?: string }>
    nextAllowedActions?: Array<{ id?: string, label?: string, enabled?: boolean, disabledReason?: string }>
}

async function loadDwmCases(): Promise<WorkbenchDwmCaseListItem[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/cases', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { cases?: WorkbenchDwmCaseListItem[] }
        return (payload.cases || []).sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
    } catch {
        return []
    }
}

async function loadDwmDeliveries(): Promise<WorkbenchDwmDelivery[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/webhooks/deliveries', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { deliveries?: WorkbenchDwmDelivery[] }
        return (payload.deliveries || []).sort((a, b) => String(b.attemptedAt ?? '').localeCompare(String(a.attemptedAt ?? '')))
    } catch {
        return []
    }
}

function attachCasesToAlerts(alerts: DwmAlert[], cases: WorkbenchDwmCaseListItem[]): DwmAlert[] {
    if (!cases.length) return alerts
    const caseByAlertId = new Map<string, WorkbenchDwmCaseListItem>()
    for (const item of cases) {
        const alertId = String(item.alertId || '')
        if (alertId) caseByAlertId.set(alertId, item)
    }
    return alerts.map(alert => {
        const caseRow = caseByAlertId.get(alert.id)
        if (!caseRow) return alert
        const caseId = String(caseRow.caseId || caseRow.id || '')
        const organizationId = caseRow.organizationId
        return {
            ...alert,
            organizationId: organizationId || (alert as DwmAlert & { organizationId?: string }).organizationId,
            caseId: caseId || (alert as DwmAlert & { caseId?: string }).caseId,
            casePath: caseId ? caseApiHref(caseRow) : (alert as DwmAlert & { casePath?: string }).casePath,
            assignedOwner: caseRow.assignedOwner || (alert as DwmAlert & { assignedOwner?: string }).assignedOwner,
            workflowStatus: caseRow.status || (alert as DwmAlert & { workflowStatus?: string }).workflowStatus,
            updatedAt: caseRow.updatedAt || (alert as DwmAlert & { updatedAt?: string }).updatedAt,
        } as DwmAlert
    })
}

function attachDeliveriesToAlerts(alerts: DwmAlert[], deliveries: WorkbenchDwmDelivery[]): DwmAlert[] {
    if (!deliveries.length) return alerts
    return alerts.map(alert => ({
        ...alert,
        deliveries: deliveries.filter(delivery => delivery.alertId === alert.id),
    }))
}

function buildWorkbenchCases(overview: TiAdminOverview, alerts: DwmAlert[], liveCases: WorkbenchDwmCaseListItem[] = []): WorkbenchCase[] {
    const alertCases = alerts.map(dwmAlertToWorkbenchCase)
    const alertIds = new Set(alerts.map(alert => alert.id))
    const linkedCaseRows = liveCases
        .filter(item => String(item.alertId || '') && !alertIds.has(String(item.alertId)))
        .map(dwmCaseToWorkbenchCase)
    const domainCases = overview.domains.map(domain => domainToCase(domain, overview.captures))
    const captureCases = overview.captures.map(captureToCase)

    return [...linkedCaseRows, ...alertCases, ...domainCases, ...captureCases]
        .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt))
}

function dwmCaseToWorkbenchCase(row: WorkbenchDwmCaseListItem): WorkbenchCase {
    const caseId = String(row.caseId || row.id || 'case')
    const alertId = String(row.alertId || '')
    const rowId = alertId || caseId
    const hasAlertRef = Boolean(alertId)
    const severity = normalizeWorkbenchSeverity(row.severity || row.priority)
    const route = String(row.recommendedRoute || 'case_review').replaceAll('_', ' ')
    const webhookStatuses = row.webhookStatuses || []
    const webhookDeliveryIds = row.webhookDeliveryIds || []
    const updatedAt = row.updatedAt || row.latestEvent?.at || row.createdAt || new Date().toISOString()
    const watchlistItemIds = row.watchlistItemIds || []
    const timeline = (row.timeline || [])
        .slice(0, 8)
        .map((event, index) => ({
            id: String(event.id || `${caseId}_timeline_${index}`),
            at: String(event.at || updatedAt),
            title: String(event.title || event.eventType || 'Case event').replaceAll('_', ' '),
            body: String(event.summary || event.body || event.eventType || 'Case event recorded.'),
        }))

    return {
        id: rowId,
        kind: 'dwm_alert',
        queue: 'Case queue',
        title: row.title || caseId,
        subtitle: row.summary || `${caseId} is ${row.status || 'open'} with ${webhookDeliveryIds.length} webhook delivery ${pluralize('row', webhookDeliveryIds.length)}.`,
        severity,
        status: row.status || 'open',
        priority: severityPriority(severity) + 30 + webhookDeliveryIds.length,
        confidence: webhookDeliveryIds.length ? 86 : 78,
        owner: row.assignedOwner || 'unassigned',
        createdAt: row.createdAt || updatedAt,
        updatedAt,
        company: row.title || row.organizationId || 'DWM case',
        matchedTerm: watchlistItemIds[0] || row.dedupeKey || rowId,
        actor: 'DWM case',
        sourceLabel: webhookStatuses.length ? `${webhookStatuses.join(', ')} delivery` : 'case timeline',
        recommendedAction: row.nextAllowedActions?.find(action => action.enabled)?.label || 'Open the case detail, review the timeline, then record the next analyst action.',
        routeLabel: route,
        persistent: true,
        evidence: [],
        timeline,
        nextTasks: [
            'Open the case detail and inspect evidence/provenance.',
            webhookDeliveryIds.length ? 'Review webhook delivery state before closing.' : 'Send or test webhook delivery when evidence is customer-safe.',
            'Record rationale before suppressing, escalating, or closing.',
        ],
        relatedLinks: [
            { href: caseApiHref(row), label: 'Open case' },
            ...(hasAlertRef ? [{ href: `/api/dwm/alerts/${encodeURIComponent(alertId)}`, label: 'Open alert detail' }] : []),
        ],
        workflowPath: [
            {
                id: 'alert_ref',
                label: 'Alert',
                status: hasAlertRef ? 'ready' : 'needs_action',
                owner: 'alert',
                source: 'case alert reference',
                detail: hasAlertRef ? `Alert ${alertId}` : 'Alert reference is syncing.',
                entityId: alertId || undefined,
                href: hasAlertRef ? `/api/dwm/alerts/${encodeURIComponent(alertId)}` : undefined,
            },
            {
                id: 'case_ref',
                label: 'Case',
                status: 'ready',
                owner: 'case',
                source: 'case file',
                detail: `${caseId} · ${row.status || 'open'} · owner ${row.assignedOwner || 'unassigned'}.`,
                entityId: caseId,
                href: caseApiHref(row),
            },
            {
                id: 'delivery_ref',
                label: 'Delivery',
                status: webhookDeliveryIds.length ? webhookStatuses.includes('failed') ? 'blocked' : 'ready' : 'needs_action',
                owner: 'webhook',
                source: 'delivery ledger',
                detail: webhookDeliveryIds.length ? `${webhookDeliveryIds.length} delivery ${pluralize('row', webhookDeliveryIds.length)}: ${webhookStatuses.join(', ') || 'recorded'}.` : 'No webhook delivery is attached yet.',
                entityId: webhookDeliveryIds[0],
            },
        ],
        actions: [
            { id: 'replay_alert', label: 'Replay', method: 'POST', href: `/api/dwm/alerts/${encodeURIComponent(rowId)}/replay`, body: { organizationId: row.organizationId, action: 'replay' }, disabledReason: hasAlertRef ? undefined : 'Alert reference is syncing before replay can run.' },
            { id: 'send_alert', label: 'Send', method: 'POST', href: '/api/dwm/webhooks/deliver', body: { organizationId: row.organizationId, alertId: rowId, limit: 1 }, disabledReason: hasAlertRef ? undefined : 'Alert reference is syncing before delivery can run.' },
        ],
        caseDetailHref: caseApiHref(row),
        deliveryEvidence: [],
    }
}

function caseApiHref(row: WorkbenchDwmCaseListItem) {
    const caseId = String(row.caseId || row.id || '')
    const params = new URLSearchParams()
    if (row.organizationId) params.set('organizationId', row.organizationId)
    if (row.alertId) params.set('alertId', row.alertId)
    const query = params.toString()
    return `/api/cases/${encodeURIComponent(caseId || 'case')}${query ? `?${query}` : ''}`
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
        sourceLabel: domain.sourceIds.map(id => sourceById(id)?.name || id).join(', '),
        recommendedAction: domain.status === 'review'
            ? 'Open the related captures, verify the match belongs to the customer, then route as a DWM alert or keep it on low-noise watch.'
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
                body: domain.sourceIds.map(id => sourceById(id)?.name || id).join(', '),
            },
        ],
        nextTasks: [
            'Check the source families and matched terms for false-positive risk.',
            'Promote corroborated findings into DWM customer routing.',
            'Add an analyst note with the decision rationale.',
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
        contentHash: capture.metadata.find(item => item.label === 'Alert key')?.value || capture.id,
        excerpt: capture.resultSummary,
        metadata: capture.metadata,
    }
}

function severityPriority(severity: WorkbenchCase['severity']) {
    if (severity === 'critical') return 400
    if (severity === 'high') return 300
    if (severity === 'medium') return 200
    return 100
}

function normalizeWorkbenchSeverity(value: string | undefined): WorkbenchCase['severity'] {
    if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value
    if (value === 'urgent' || value === 'p1') return 'critical'
    if (value === 'review' || value === 'p2') return 'high'
    return 'medium'
}

function pluralize(word: string, count: number) {
    return count === 1 ? word : `${word}s`
}
