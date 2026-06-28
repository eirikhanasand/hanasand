import Link from 'next/link'
import { Activity, BellRing, Bot, Code2, ExternalLink, Fingerprint, KeyRound, MessageSquareText, Radar, ShieldAlert, ShieldCheck, TicketCheck, Webhook } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { demoDwmProductSnapshot, dwmWebhookPayload, type DwmProductSnapshot } from '@/utils/dwm/product'
import { DwmAlertInbox } from './dwm-alert-inbox'
import { DwmWorkflowActions } from './dwm-workflow-actions'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function DashboardDwmPage() {
    const [snapshot, operations, savedAlerts, deliveries] = await Promise.all([loadDwmSnapshot(), loadDwmOperations(), loadDwmAlerts(), loadDwmDeliveries()])
    const alerts = savedAlerts.length ? savedAlerts : snapshot.alerts
    const primaryAlert = alerts[0]
    const criticalCount = alerts.filter(alert => alert.severity === 'critical').length
    const activeSourceCount = snapshot.sourceCoverage.reduce((sum, source) => sum + source.activeCount, 0)
    const telegramCoverage = snapshot.sourceCoverage.find(source => source.family === 'telegram_public')
    const darkwebCoverage = snapshot.sourceCoverage.find(source => source.family === 'darkweb_metadata')
    const telegramSourceCount = telegramCoverage?.activeCount || 0
    const darkwebSourceCount = darkwebCoverage?.activeCount || 0

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Dark web monitoring'
                title='Telegram and dark web exposure console'
                description='Monitor company, vendor, domain, identity, token, session, and actor mentions with source tracking, review queues, and webhook delivery.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            <BellRing className='h-4 w-4' />
                            Subscribe webhook
                        </Link>
                        <Link href='/solutions/dwm' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                            Public page
                        </Link>
                    </div>
                )}
            />

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <Stat title='Telegram sources' value={String(telegramSourceCount)} detail='active public-channel sources' icon={<MessageSquareText className='h-4 w-4' />} />
                <Stat title='Dark web sources' value={`${darkwebSourceCount}/${darkwebCoverage?.sourceCount || 0}`} detail='active metadata sources' icon={<ShieldCheck className='h-4 w-4' />} />
                <Stat title='Critical alerts' value={String(criticalCount)} detail='matched to saved watchlists' icon={<TicketCheck className='h-4 w-4' />} />
                <Stat title='Source graph' value={String(activeSourceCount)} detail='active monitored sources' icon={<Webhook className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='p-5'>
                <div className='grid gap-5 lg:grid-cols-[0.8fr_1.2fr]'>
                    <div>
                        <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Product readiness</p>
                        <h2 className='mt-1 text-lg font-semibold text-[#171a21]'>{readinessLabel(snapshot.readiness.decision)}</h2>
                        <p className='mt-2 text-sm leading-6 text-[#596170]'>{snapshot.readiness.nextWorkItem}</p>
                    </div>
                    <div className='grid gap-3 md:grid-cols-2'>
                        <div className='rounded-lg border border-[#fde2d6] bg-[#fff7f3] p-3'>
                            <h3 className='text-sm font-semibold text-[#9a3412]'>Remaining blockers</h3>
                            <ul className='mt-2 grid gap-2 text-sm leading-5 text-[#7c2d12]'>
                                {snapshot.readiness.blockers.map(blocker => <li key={blocker}>- {blocker}</li>)}
                            </ul>
                        </div>
                        <div className='rounded-lg border border-[#d6e9de] bg-[#f4fbf7] p-3'>
                            <h3 className='text-sm font-semibold text-[#147a3b]'>Differentiators</h3>
                            <ul className='mt-2 grid gap-2 text-sm leading-5 text-[#275f3a]'>
                                {snapshot.readiness.advantages.map(advantage => <li key={advantage}>- {advantage}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            </DashboardPanel>

            <DwmWorkflowActions initialTerms={snapshot.watchlist.map(term => term.value)} />

            {operations && (
                <div className='grid gap-4 xl:grid-cols-[1.05fr_0.95fr]'>
                    <DashboardPanel className='p-5'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold text-[#171a21]'>Collection proof</h2>
                                <p className='mt-1 text-sm text-[#596170]'>{operations.zeroAlertExplanation.message}</p>
                            </div>
                            <Activity className='h-5 w-5 text-[#3056d3]' />
                        </div>
                        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
                            <MiniStat title='Captures' value={String(operations.counts.captureCount)} />
                            <MiniStat title='Latest run' value={operations.latestRun ? `${operations.latestRun.captureCount} captures` : 'none'} />
                            <MiniStat title='Watchlist hits' value={String(operations.counts.watchlistMatchCount)} />
                        </div>
                        <div className='mt-4 grid gap-2'>
                            {operations.latestCaptures.slice(0, 6).map(capture => (
                                <div key={capture.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <span className='font-mono text-xs font-semibold text-[#171a21]'>{capture.sourceName}</span>
                                        <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{capture.family.replaceAll('_', ' ')}</span>
                                        <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{capture.redactionState.replaceAll('_', ' ')}</span>
                                        <span className='text-xs text-[#667085]'>{relativeTimeLabel(capture.collectedAt)}</span>
                                    </div>
                                    <p className='mt-2 line-clamp-2 text-sm leading-6 text-[#3d4656]'>{capture.safeExcerpt}</p>
                                    <p className='mt-2 font-mono text-[11px] text-[#667085]'>{capture.contentHash}</p>
                                </div>
                            ))}
                        </div>
                    </DashboardPanel>

                    <DashboardPanel className='p-5'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold text-[#171a21]'>Threat actor overviews</h2>
                                <p className='mt-1 text-sm text-[#596170]'>Actor cards built from live sources, metadata, captures, and matched alerts.</p>
                            </div>
                            <Fingerprint className='h-5 w-5 text-[#3056d3]' />
                        </div>
                        <div className='mt-4 grid gap-2'>
                            {snapshot.actorOverviews.length === 0 && (
                                <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-3 text-sm text-[#596170]'>
                                    No named actors in recent safe metadata yet.
                                </div>
                            )}
                            {snapshot.actorOverviews.slice(0, 6).map(actor => (
                                <div key={actor.actor} className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
                                    <div className='flex flex-wrap items-center justify-between gap-2'>
                                        <div>
                                            <h3 className='text-sm font-semibold text-[#171a21]'>{actor.actor}</h3>
                                            <p className='mt-1 text-xs text-[#667085]'>{actor.sourceFamilies.map(family => family.replaceAll('_', ' ')).join(', ')}</p>
                                        </div>
                                        <span className='rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{actor.confidence}%</span>
                                    </div>
                                    <p className='mt-2 text-sm leading-6 text-[#3d4656]'>{actor.summary}</p>
                                    <div className='mt-3 grid grid-cols-3 gap-2'>
                                        <MiniStat title='Sources' value={String(actor.sourceCount)} />
                                        <MiniStat title='Captures' value={String(actor.captureCount)} />
                                        <MiniStat title='State' value={actor.watchState.replaceAll('_', ' ')} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DashboardPanel>

                    <DashboardPanel className='p-5'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold text-[#171a21]'>Source health</h2>
                                <p className='mt-1 text-sm text-[#596170]'>{operations.counts.activeSourceCount}/{operations.counts.sourceCount} sources active.</p>
                            </div>
                            <ShieldCheck className='h-5 w-5 text-[#3056d3]' />
                        </div>
                        <div className='mt-4 grid gap-2'>
                            {operations.sourceHealth.slice(0, 10).map(source => (
                                <div key={source.sourceId} className='grid gap-2 rounded-lg border border-[#e0e5ed] bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center'>
                                    <div className='min-w-0'>
                                        <p className='truncate text-sm font-semibold text-[#171a21]'>{source.sourceName}</p>
                                        <p className='mt-1 text-xs text-[#667085]'>{source.family.replaceAll('_', ' ')} · {source.approvedMetadataOnly ? 'metadata only' : 'public source'}</p>
                                    </div>
                                    <span className='rounded-full bg-[#f4fbf7] px-2 py-1 text-xs font-semibold text-[#147a3b]'>{source.status}</span>
                                </div>
                            ))}
                        </div>
                    </DashboardPanel>
                </div>
            )}

            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Live exposure queue</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Review, route, and respond to real matches without turning the product into a scraped-row dump.</p>
                        </div>
                        <Radar className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-5'>
                        <DwmAlertInbox alerts={alerts} />
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Customer delivery</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Webhook payload preview and delivery history.</p>
                        </div>
                        <Webhook className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-4 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-3'>
                        <pre className='max-h-96 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-5 text-[#344054]'>{JSON.stringify(primaryAlert ? dwmWebhookPayload(primaryAlert) : {}, null, 2)}</pre>
                    </div>
                    <div className='mt-4 grid gap-2'>
                        {deliveries.length === 0 && (
                            <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-3 text-sm text-[#596170]'>
                                No webhook attempts yet.
                            </div>
                        )}
                        {deliveries.slice(0, 5).map(delivery => (
                            <div key={delivery.id} className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className={delivery.status === 'delivered' ? 'rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold text-[#147a3b]' : delivery.status === 'failed' ? 'rounded-full bg-[#fff7f3] px-2 py-0.5 text-xs font-semibold text-[#9a3412]' : 'rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'}>
                                        {delivery.status.replaceAll('_', ' ')}
                                    </span>
                                    <span className='text-xs text-[#667085]'>{relativeTimeLabel(delivery.attemptedAt)}</span>
                                    <span className='font-mono text-[11px] text-[#667085]'>{delivery.endpointHash}</span>
                                </div>
                                <p className='mt-2 font-mono text-[11px] text-[#596170]'>{delivery.dedupeKey}</p>
                                {delivery.error && <p className='mt-2 text-xs text-[#9a3412]'>{delivery.error}</p>}
                            </div>
                        ))}
                    </div>
                    <div className='mt-4 flex flex-wrap gap-2'>
                        <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            <BellRing className='h-4 w-4' />
                            Subscribe
                        </Link>
                        <Link href='/developers' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                            <Code2 className='h-4 w-4' />
                            API docs
                        </Link>
                    </div>
                </DashboardPanel>
            </div>

            <div className='grid gap-4 xl:grid-cols-[0.9fr_1.1fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Source coverage</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Coverage is tracked as source families with health, approval, parser state, and metadata boundaries.</p>
                        </div>
                        <ShieldAlert className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-5 grid gap-3'>
                        {snapshot.sourceCoverage.map(source => (
                            <div key={source.family} className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <h3 className='font-semibold text-[#171a21]'>{source.label}</h3>
                                    <span className='rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{source.activeCount}/{source.sourceCount} · {source.health}</span>
                                </div>
                                <p className='mt-2 text-sm leading-6 text-[#596170]'>{source.detail}</p>
                            </div>
                        ))}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>On-demand collection requests</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Submit Telegram channels, markets, actors, sectors, languages, or vendor scopes as approval packets.</p>
                        </div>
                        <ExternalLink className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-5 grid gap-3'>
                        {snapshot.onDemandQueue.map(request => (
                            <div key={request.id} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 md:grid-cols-[1fr_auto] md:items-center'>
                                <div>
                                    <h3 className='font-mono text-sm font-semibold text-[#171a21]'>{request.target}</h3>
                                    <p className='mt-1 text-sm text-[#596170]'>{request.type.replaceAll('_', ' ')} · {request.scope}</p>
                                    <p className='mt-2 text-sm leading-6 text-[#3d4656]'>{request.nextAction}</p>
                                </div>
                                <span className={request.priority === 'high' || request.priority === 'critical' ? 'rounded-full bg-[#fff0eb] px-2 py-1 text-xs font-semibold text-[#c2410c]' : 'rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'}>
                                    {request.priority}
                                </span>
                            </div>
                        ))}
                    </div>
                </DashboardPanel>
            </div>

            <div className='grid gap-4 lg:grid-cols-4'>
                <ValueCard icon={<Fingerprint className='h-4 w-4' />} title='Infostealer context' body='Flag corporate URLs, saved sessions, cookies, autofill, and resale context without storing raw stolen data.' />
                <ValueCard icon={<KeyRound className='h-4 w-4' />} title='Token and key risk' body='Route OAuth, API key, IAM, and service-account hints to the right identity-response workflow.' />
                <ValueCard icon={<Bot className='h-4 w-4' />} title='Telegram-first monitoring' body='Make Telegram channels, mirrors, and broker rooms a first-class source family with health and parser state.' />
                <ValueCard icon={<ShieldCheck className='h-4 w-4' />} title='Metadata-only safety' body='Restricted sources retain source timing, hashes, screenshots, redaction state, and provenance without leak downloads.' />
            </div>
        </DashboardPage>
    )
}

async function loadDwmSnapshot(): Promise<DwmProductSnapshot> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return demoDwmProductSnapshot(new Date().toISOString())

    try {
        const target = new URL('/v1/dwm/product', base)
        target.searchParams.set('tenantId', 'default')
        target.searchParams.set('demo', 'false')

        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        if (!response.ok) return demoDwmProductSnapshot(new Date().toISOString())
        return await response.json() as DwmProductSnapshot
    } catch {
        return demoDwmProductSnapshot(new Date().toISOString())
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

async function loadDwmAlerts(): Promise<DwmAlertInboxItem[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/alerts', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) return []
        const payload = await response.json() as { alerts?: DwmAlertInboxItem[] }
        return payload.alerts || []
    } catch {
        return []
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

function readinessLabel(decision: string) {
    if (decision === 'production_ready_with_live_sources') return 'Ready with live sources'
    if (decision === 'blocked_missing_watchlist') return 'Watchlist required'
    return 'Not ready yet'
}

function relativeTimeLabel(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000))
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    return `${hours} hr ago`
}

function Stat({ title, value, detail, icon }: { title: string, value: string, detail: string, icon: ReactNode }) {
    return (
        <DashboardPanel className='p-4'>
            <div className='flex items-center justify-between text-[#667085]'>
                <p className='text-xs font-semibold uppercase'>{title}</p>
                {icon}
            </div>
            <p className='mt-3 text-xl font-semibold text-[#171a21]'>{value}</p>
            <p className='mt-1 text-sm text-[#596170]'>{detail}</p>
        </DashboardPanel>
    )
}

function MiniStat({ title, value }: { title: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
            <p className='text-[10px] font-semibold uppercase text-[#667085]'>{title}</p>
            <p className='mt-1 text-base font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}

function ValueCard({ icon, title, body }: { icon: ReactNode, title: string, body: string }) {
    return (
        <DashboardPanel className='p-5'>
            <div className='text-[#3056d3]'>{icon}</div>
            <h2 className='mt-3 text-base font-semibold text-[#171a21]'>{title}</h2>
            <p className='mt-2 text-sm leading-6 text-[#596170]'>{body}</p>
        </DashboardPanel>
    )
}

type DwmOperationsSnapshot = {
    schemaVersion: 'dwm.operations.v1'
    generatedAt: string
    tenantId: string
    watchlistTerms: string[]
    counts: {
        sourceCount: number
        activeSourceCount: number
        telegramSourceCount: number
        darkwebMetadataSourceCount: number
        captureCount: number
        latestCaptureCount: number
        watchlistMatchCount: number
        latestRunStatus?: string
        latestRunCaptureCount?: number
    }
    latestRun?: {
        id: string
        status: string
        updatedAt: string
        taskCount: number
        captureCount: number
        error?: string
    }
    latestCaptures: Array<{
        id: string
        sourceId: string
        sourceName: string
        family: string
        collectedAt: string
        storageKind: string
        redactionState: string
        contentHash: string
        safeExcerpt: string
        matchedWatchTerms: string[]
    }>
    sourceHealth: Array<{
        sourceId: string
        sourceName: string
        family: string
        status: string
        trustScore?: number
        lastCollectedAt?: string
        approvedMetadataOnly: boolean
    }>
    zeroAlertExplanation: {
        state: string
        message: string
    }
}

type DwmAlertInboxItem = DwmProductSnapshot['alerts'][number] & {
    deliveryState?: string
    workflowNote?: string
}

type DwmDeliveryItem = {
    id: string
    tenantId: string
    alertId: string
    watchlistId: string
    endpointHash: string
    dedupeKey: string
    attemptedAt: string
    dryRun?: boolean
    payloadHash: string
    status: string
    httpStatus?: number
    error?: string
}
