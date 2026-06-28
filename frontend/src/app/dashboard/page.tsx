import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { BellRing, Inbox, Radar, UserRound } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
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
    const liveAlerts = await loadDwmAlerts()
    const fallbackAlerts = demoDwmProductSnapshot(new Date().toISOString()).alerts
    const alerts = liveAlerts.length ? liveAlerts : fallbackAlerts
    const cases = buildWorkbenchCases(overview, alerts)
    const displayName = impersonatingName || impersonatingId || name
    const firstName = displayName.split(/\s+/)[0] || displayName

    return (
        <DashboardPage>
            {params?.notAllowed && (
                <div className='rounded-lg border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-sm font-medium text-[#93370d] shadow-sm'>
                    That console area is not included in this account. Start from the operations queue below.
                </div>
            )}

            <DashboardHeader
                eyebrow='Operations workbench'
                title={`${firstName}, start with the queue.`}
                description='Prioritize customer exposure work, inspect evidence, record decisions, and route DWM/TI findings without leaving the dashboard.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/dwm' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff]'>
                            <Radar className='h-4 w-4' />
                            DWM cases
                        </Link>
                        <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white transition hover:bg-[#2b2f39] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe]'>
                            <BellRing className='h-4 w-4' />
                            Alert delivery
                        </Link>
                    </div>
                )}
            />

            <section className='grid gap-3 md:grid-cols-3'>
                <MorningBrief label='Open work' value={String(cases.length)} detail={`${cases.filter(item => item.severity === 'critical' || item.severity === 'high').length} high-priority items`} />
                <MorningBrief label='Persistent actions' value={String(alerts.length)} detail='DWM decisions persist through the workflow API when configured.' />
                <MorningBrief label='Evidence ready' value={String(cases.filter(item => item.evidence.length).length)} detail='Each selected item includes source, timestamp, hash, and safe excerpt context.' />
            </section>

            <AnalystWorkbenchClient initialCases={cases} />

            <section className='grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
                <div className='min-w-0'>
                    <h2 className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                        <UserRound className='h-4 w-4 text-[#3056d3]' />
                        Persistence boundary
                    </h2>
                    <p className='mt-2 text-sm leading-6 text-[#596170]'>
                        DWM alert review, escalation, suppression, replay, and webhook send actions call the DWM API. General TI ownership and notes are session-local until case ownership persistence is added.
                    </p>
                </div>
                <Link href='/dashboard/ti/workbench' className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff]'>
                    <Inbox className='h-4 w-4' />
                    Full TI workbench
                </Link>
            </section>
        </DashboardPage>
    )
}

function MorningBrief({ label, value, detail }: { label: string, value: string, detail: string }) {
    return (
        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
            <p className='text-[10px] font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-2 text-2xl font-semibold text-[#171a21]'>{value}</p>
            <p className='mt-1 text-sm leading-5 text-[#596170]'>{detail}</p>
        </div>
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

function buildWorkbenchCases(overview: TiAdminOverview, alerts: DwmAlert[]): WorkbenchCase[] {
    const alertCases = alerts.map(alertToCase)
    const domainCases = overview.domains.map(domain => domainToCase(domain, overview.captures))
    const captureCases = overview.captures.map(captureToCase)

    return [...alertCases, ...domainCases, ...captureCases]
        .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt))
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
