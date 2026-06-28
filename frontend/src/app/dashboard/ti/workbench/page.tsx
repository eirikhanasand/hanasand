import Link from 'next/link'
import { ArrowUpRight, Inbox, Radar } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import { demoDwmProductSnapshot, type DwmAlert, type DwmSeverity } from '@/utils/dwm/product'
import { formatTiDate, getTiAdminOverview, sourceById, type TiAdminCapture, type TiAdminDomain, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import AnalystWorkbenchClient, { type WorkbenchCase, type WorkbenchEvidence, type WorkbenchTimelineItem } from './workbenchClient'

export const dynamic = 'force-dynamic'

export default async function TiAnalystWorkbenchPage() {
    const overview = getTiAdminOverview()
    const liveAlerts = await loadDwmAlerts()
    const fallbackAlerts = demoDwmProductSnapshot(new Date().toISOString()).alerts
    const alerts = liveAlerts.length ? liveAlerts : fallbackAlerts
    const cases = buildWorkbenchCases(overview, alerts)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Analyst portal'
                title='Threat intelligence workbench'
                description='Prioritize alerts, inspect safe evidence, record decisions, and route customer-ready findings from one operator surface.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/dwm' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                            <Radar className='h-4 w-4' />
                            DWM console
                        </Link>
                        <Link href='/dashboard/ti/sources' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            <Inbox className='h-4 w-4' />
                            Source queues
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
            'Confirm whether this belongs in incident response, vendor risk, or analyst review.',
            'Deliver only redacted metadata and safe excerpts to customer workflows.',
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
        sourceLabel: domain.sourceIds.map(id => sourceById(id)?.name || id).join(', '),
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
