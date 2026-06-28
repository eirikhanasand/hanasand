import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BellRing, Radar } from 'lucide-react'
import { DashboardPage } from '@/components/dashboard/ui'
import { demoDwmProductSnapshot, type DwmAlert, type DwmSeverity } from '@/utils/dwm/product'
import { formatTiDate, getTiAdminOverview, sourceById, type TiAdminCapture, type TiAdminDomain, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import AnalystWorkbenchClient, { type WorkbenchCase, type WorkbenchEvidence, type WorkbenchTimelineItem } from './ti/workbench/workbenchClient'

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
    const [liveAlerts, watchlists, operations, deliveries] = await Promise.all([
        loadDwmAlerts(),
        loadDwmWatchlists(),
        loadDwmOperations(),
        loadDwmDeliveries(),
    ])
    const fallbackAlerts = demoDwmProductSnapshot(new Date().toISOString()).alerts
    const alerts = liveAlerts.length ? liveAlerts : fallbackAlerts
    const readinessCases = buildReadinessCases({
        backendConfigured: Boolean(process.env.TI_SCRAPER_API_BASE),
        watchlists,
        operations,
        deliveries,
        liveAlertCount: liveAlerts.length,
        renderedAlertCount: alerts.length,
    })
    const cases = buildWorkbenchCases(overview, alerts, readinessCases)
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
                persistentCount={alerts.length}
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
                    <CompactStat label='DWM API routes' value={String(persistentCount)} tone='good' />
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

async function loadDwmWatchlists(): Promise<DwmWatchlistSummary[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/watchlists', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { watchlists?: DwmWatchlistSummary[] }
        return payload.watchlists || []
    } catch {
        return []
    }
}

async function loadDwmOperations(): Promise<DwmOperationsSnapshot | null> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return null

    try {
        const target = new URL('/v1/dwm/operations', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return null
        return await response.json() as DwmOperationsSnapshot
    } catch {
        return null
    }
}

async function loadDwmDeliveries(): Promise<DwmDeliveryItem[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/webhooks/deliveries', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { deliveries?: DwmDeliveryItem[] }
        return (payload.deliveries || []).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
    } catch {
        return []
    }
}

function buildWorkbenchCases(overview: TiAdminOverview, alerts: DwmAlert[], readinessCases: WorkbenchCase[]): WorkbenchCase[] {
    const alertCases = alerts.map(alertToCase)
    const domainCases = overview.domains.map(domain => domainToCase(domain, overview.captures))
    const captureCases = overview.captures.map(captureToCase)

    return [...readinessCases, ...alertCases, ...domainCases, ...captureCases]
        .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt))
}

function buildReadinessCases(input: {
    backendConfigured: boolean
    watchlists: DwmWatchlistSummary[]
    operations: DwmOperationsSnapshot | null
    deliveries: DwmDeliveryItem[]
    liveAlertCount: number
    renderedAlertCount: number
}): WorkbenchCase[] {
    const now = new Date().toISOString()
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const watchlistTerms = activeWatchlists.flatMap(item => item.terms || [])
    const webhookWatchlists = activeWatchlists.filter(item => item.webhookUrl)
    const activeSources = input.operations?.counts.activeSourceCount ?? 0
    const sourceCount = input.operations?.counts.sourceCount ?? 0
    const latestDelivery = input.deliveries[0]
    const deliveryFailures = input.deliveries.filter(item => item.status === 'failed' || item.status === 'skipped').length

    return [
        readinessCase({
            id: 'readiness_org_contract',
            kind: 'org_readiness',
            queue: 'Product readiness',
            title: 'Organization contract not wired',
            severity: 'high',
            status: 'blocked_contract',
            priority: 390,
            confidence: 100,
            subtitle: 'The dashboard has tenant IDs, but no real organization membership, create, join, or shared ownership route is exposed in this frontend/API slice.',
            recommendedAction: 'Do not claim team or org-level shared watchlists until an organization membership contract exists. Backend foundation should add org create/join/list membership and attach DWM watchlists to org ownership.',
            evidence: [{
                id: 'ev_org_contract_missing',
                sourceName: 'Frontend route audit',
                sourceFamily: 'product contract',
                captureMode: 'code path',
                redactionState: 'customer safe',
                contentHash: 'org-api-not-found',
                excerpt: 'Search found tenantId usage and DWM default tenant routing, but no organization create/join/list API for the dashboard surface.',
                observedAt: now,
                provenance: 'frontend/src/app/api + frontend/src/app/dashboard',
                confidence: 100,
            }],
            timeline: [{ id: 'org_contract_audit', at: now, title: 'Readiness audit', body: 'Organization entry point withheld because no backed route/API exists in this slice.' }],
            nextTasks: ['Define org membership API contract.', 'Attach watchlists and webhook destinations to org ownership.', 'Expose create/join only after the route exists.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Use default DWM tenant for now' }],
        }),
        readinessCase({
            id: 'readiness_watchlist',
            kind: 'watchlist_readiness',
            queue: 'Shared watchlists',
            title: activeWatchlists.length ? 'Shared watchlist active' : 'Create shared watchlist',
            severity: activeWatchlists.length ? 'medium' : 'high',
            status: activeWatchlists.length ? 'active' : 'missing_watchlist',
            priority: activeWatchlists.length ? 260 : 380,
            confidence: input.backendConfigured ? 92 : 65,
            subtitle: activeWatchlists.length
                ? `${activeWatchlists.length} active watchlist${activeWatchlists.length === 1 ? '' : 's'} with ${watchlistTerms.length} total term${watchlistTerms.length === 1 ? '' : 's'} ready for alert rebuilds.`
                : input.backendConfigured ? 'No active DWM watchlist returned for tenant default.' : 'TI scraper backend is not configured, so watchlist state cannot be loaded.',
            recommendedAction: activeWatchlists.length ? 'Review term coverage, then run alert rebuild after source coverage changes.' : 'Create a DWM watchlist with company, domain, vendor, brand, VIP, or product terms, then rebuild alerts.',
            evidence: [{
                id: 'ev_watchlist_route',
                sourceName: 'DWM watchlists API',
                sourceFamily: 'workflow route',
                captureMode: 'api contract',
                redactionState: 'customer safe',
                contentHash: '/api/dwm/watchlists',
                excerpt: activeWatchlists.length ? activeWatchlists.map(item => `${item.name}: ${(item.terms || []).map(term => term.value).join(', ')}`).join(' | ') : 'POST /api/dwm/watchlists accepts terms and optional webhookUrl; alert rebuild requires at least one active watchlist.',
                observedAt: activeWatchlists[0]?.updatedAt || now,
                provenance: 'GET/POST /api/dwm/watchlists',
                confidence: input.backendConfigured ? 92 : 65,
            }],
            timeline: [{ id: 'watchlist_readiness_at', at: activeWatchlists[0]?.updatedAt || now, title: activeWatchlists.length ? 'Watchlist loaded' : 'Watchlist required', body: activeWatchlists.length ? 'Watchlist data came from the DWM backend.' : 'Alert rebuild is blocked until watchlist terms exist.' }],
            nextTasks: ['Open DWM setup and save watchlist terms.', 'Run alert rebuild.', 'Confirm the watchlist has an owner once org support exists.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Edit watchlist' }],
        }),
        readinessCase({
            id: 'readiness_webhook',
            kind: 'webhook_readiness',
            queue: 'Webhook delivery',
            title: webhookWatchlists.length ? 'Webhook destination configured' : 'Configure webhook destination',
            severity: webhookWatchlists.length && !deliveryFailures ? 'medium' : 'high',
            status: webhookWatchlists.length ? 'destination_ready' : 'missing_webhook',
            priority: webhookWatchlists.length && !deliveryFailures ? 250 : 370,
            confidence: input.backendConfigured ? 90 : 64,
            subtitle: webhookWatchlists.length
                ? `${webhookWatchlists.length} active watchlist destination${webhookWatchlists.length === 1 ? '' : 's'} configured. Latest delivery: ${latestDelivery ? latestDelivery.status : 'none attempted'}.`
                : 'No active watchlist has a webhook URL. Discord can be used through a normal HTTPS webhook URL, but there is no Discord-specific app contract here.',
            recommendedAction: webhookWatchlists.length ? 'Test the destination, then send ready alerts and watch failures.' : 'Save a valid HTTPS webhook URL on a watchlist, test delivery, then send ready alerts.',
            evidence: [{
                id: 'ev_webhook_delivery',
                sourceName: 'DWM webhook delivery API',
                sourceFamily: 'workflow route',
                captureMode: 'api contract',
                redactionState: 'customer safe',
                contentHash: latestDelivery?.payloadHash || '/api/dwm/webhooks/test',
                excerpt: latestDelivery ? `${latestDelivery.status} delivery to ${latestDelivery.endpointHash} at ${latestDelivery.attemptedAt}.` : 'POST /api/dwm/webhooks/test and /api/dwm/webhooks/deliver exist; delivery fails honestly when webhookUrl is missing.',
                observedAt: latestDelivery?.attemptedAt || now,
                provenance: 'GET /api/dwm/webhooks/deliveries',
                confidence: input.backendConfigured ? 90 : 64,
            }],
            timeline: [{ id: 'webhook_readiness_at', at: latestDelivery?.attemptedAt || now, title: latestDelivery ? 'Latest webhook attempt' : 'Webhook destination required', body: latestDelivery ? `${latestDelivery.status}${latestDelivery.error ? `: ${latestDelivery.error}` : ''}` : 'No delivery destination is configured for the active watchlist.' }],
            nextTasks: ['Save a HTTPS webhook URL on the watchlist.', 'Run webhook test.', 'Send queued alerts and inspect delivery failures.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Configure webhook' }, { href: '/dashboard/automations?setup=dwm', label: 'Delivery setup' }],
        }),
        readinessCase({
            id: 'readiness_source_coverage',
            kind: 'source_readiness',
            queue: 'Source coverage',
            title: sourceCount ? 'Source coverage loaded' : 'Connect source coverage',
            severity: sourceCount && activeSources ? 'medium' : 'high',
            status: sourceCount && activeSources ? 'collecting' : 'missing_sources',
            priority: sourceCount && activeSources ? 245 : 360,
            confidence: input.operations ? 88 : 60,
            subtitle: input.operations ? `${activeSources}/${sourceCount} sources active. Latest run: ${input.operations.latestRun?.status || 'none'}.` : 'DWM operations API did not return source inventory for this dashboard.',
            recommendedAction: sourceCount && activeSources ? 'Keep source health above threshold and run collection after watchlist changes.' : 'Connect or approve public Telegram and metadata-only dark web sources before promising alert coverage.',
            evidence: [{
                id: 'ev_source_coverage',
                sourceName: 'DWM operations API',
                sourceFamily: 'source health',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: '/api/dwm/operations',
                excerpt: input.operations ? `${input.operations.counts.captureCount} captures, ${input.operations.counts.watchlistMatchCount} watchlist matches.` : 'GET /api/dwm/operations is the expected source-health route; no backend snapshot is configured locally.',
                observedAt: input.operations?.latestRun?.updatedAt || now,
                provenance: 'GET /api/dwm/operations',
                confidence: input.operations ? 88 : 60,
            }],
            timeline: [{ id: 'source_readiness_at', at: input.operations?.latestRun?.updatedAt || now, title: input.operations?.latestRun ? 'Latest collection run' : 'Source snapshot missing', body: input.operations?.latestRun ? `${input.operations.latestRun.status}: ${input.operations.latestRun.captureCount} captures.` : 'Source coverage cannot be verified without TI scraper backend.' }],
            nextTasks: ['Approve bounded public Telegram coverage.', 'Approve metadata-only dark web source coverage.', 'Run collection and rebuild alerts.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Run collection' }, { href: '/dashboard/ti/sources', label: 'Review TI sources' }],
        }),
        readinessCase({
            id: 'readiness_alert_generation',
            kind: 'alert_readiness',
            queue: 'Alert generation',
            title: input.liveAlertCount ? 'Real DWM alerts generated' : 'Generate real DWM alerts',
            severity: input.liveAlertCount ? 'medium' : 'high',
            status: input.liveAlertCount ? 'alerts_ready' : 'demo_or_empty',
            priority: input.liveAlertCount ? 240 : 350,
            confidence: input.liveAlertCount ? 90 : 58,
            subtitle: input.liveAlertCount ? `${input.liveAlertCount} saved DWM alert${input.liveAlertCount === 1 ? '' : 's'} loaded from backend.` : `${input.renderedAlertCount} fallback alert${input.renderedAlertCount === 1 ? '' : 's'} rendered so the workflow is inspectable, but real alert generation has not been verified.`,
            recommendedAction: input.liveAlertCount ? 'Work the ready alerts, replay evidence, and deliver customer notifications.' : 'Create watchlist terms, collect sources, rebuild alerts, and stop relying on fallback cases for sales demos.',
            evidence: [{
                id: 'ev_alert_generation',
                sourceName: 'DWM alerts API',
                sourceFamily: 'alert workflow',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: '/api/dwm/alerts',
                excerpt: input.liveAlertCount ? 'Alerts came from GET /v1/dwm/alerts for tenant default.' : 'The page is using fallback DWM cases because GET /v1/dwm/alerts returned no saved alerts or backend is absent.',
                observedAt: now,
                provenance: 'GET /api/dwm/alerts + POST /api/dwm/alerts/rebuild',
                confidence: input.liveAlertCount ? 90 : 58,
            }],
            timeline: [{ id: 'alert_readiness_at', at: now, title: input.liveAlertCount ? 'Alerts loaded' : 'Alert generation not proven', body: input.liveAlertCount ? 'Saved alerts are ready for triage.' : 'Alert rebuild needs active watchlist terms and source captures.' }],
            nextTasks: ['Save watchlist.', 'Run collection.', 'Rebuild alerts.', 'Work generated cases through delivery or suppression.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Rebuild alerts' }],
        }),
    ]
}

function readinessCase(input: {
    id: string
    kind: WorkbenchCase['kind']
    queue: string
    title: string
    severity: WorkbenchCase['severity']
    status: string
    priority: number
    confidence: number
    subtitle: string
    recommendedAction: string
    evidence: WorkbenchEvidence[]
    timeline: WorkbenchTimelineItem[]
    nextTasks: string[]
    relatedLinks: WorkbenchCase['relatedLinks']
}): WorkbenchCase {
    const updatedAt = input.evidence[0]?.observedAt || new Date().toISOString()

    return {
        id: input.id,
        kind: input.kind,
        queue: input.queue,
        title: input.title,
        subtitle: input.subtitle,
        severity: input.severity,
        status: input.status,
        priority: input.priority,
        confidence: input.confidence,
        owner: input.kind === 'org_readiness' ? 'backend-foundation' : 'operator',
        createdAt: updatedAt,
        updatedAt,
        company: 'Hanasand DWM',
        matchedTerm: input.queue,
        actor: 'Product readiness',
        sourceLabel: input.evidence[0]?.sourceName || 'Dashboard readiness',
        recommendedAction: input.recommendedAction,
        routeLabel: input.queue.toLowerCase(),
        persistent: input.kind !== 'org_readiness',
        evidence: input.evidence,
        timeline: input.timeline,
        nextTasks: input.nextTasks,
        relatedLinks: input.relatedLinks,
    }
}

function alertToCase(alert: DwmAlert): WorkbenchCase {
    const severity = normalizeSeverity(alert.severity)
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
        owner: 'unassigned',
        createdAt: alert.firstSeenAt,
        updatedAt: alert.firstSeenAt,
        company: alert.company,
        matchedTerm: alert.matchedTerm.value,
        actor: alert.actor || alert.sourceFamily.replaceAll('_', ' '),
        sourceLabel: `${alert.sourceCount} ${pluralize('source', alert.sourceCount)}`,
        recommendedAction: alert.recommendedAction,
        routeLabel: alert.webhookDelivery.recommendedRoute.replaceAll('_', ' '),
        persistent: true,
        evidence: alert.evidence.map(item => ({
            id: item.id,
            sourceName: item.sourceName,
            sourceFamily: item.sourceFamily.replaceAll('_', ' '),
            captureMode: item.captureMode.replaceAll('_', ' '),
            redactionState: item.redactionState.replaceAll('_', ' '),
            contentHash: item.contentHash,
            excerpt: item.excerpt,
            observedAt: alert.firstSeenAt,
            provenance: `${item.sourceFamily.replaceAll('_', ' ')} · ${alert.webhookDelivery.dedupeKey}`,
            confidence: alert.confidence,
        })),
        timeline,
        nextTasks: [
            'Validate company identity and matched domain.',
            'Confirm the customer route before delivery.',
            'Use only redacted metadata and safe excerpts in the outbound workflow.',
        ],
        relatedLinks: [
            { href: '/dashboard/dwm', label: 'Open DWM console' },
            { href: '/dashboard/automations?setup=dwm', label: 'Webhook subscription' },
        ],
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

type DwmWatchlistSummary = {
    id: string
    tenantId: string
    name: string
    terms: Array<{ value: string, kind?: string }>
    webhookUrl?: string
    status: 'active' | 'paused'
    createdAt: string
    updatedAt: string
}

type DwmOperationsSnapshot = {
    counts: {
        sourceCount: number
        activeSourceCount: number
        captureCount: number
        watchlistMatchCount: number
    }
    latestRun?: {
        status: string
        updatedAt: string
        captureCount: number
    }
}

type DwmDeliveryItem = {
    id: string
    alertId: string
    watchlistId: string
    endpointHash: string
    attemptedAt: string
    payloadHash: string
    status: string
    error?: string
}
