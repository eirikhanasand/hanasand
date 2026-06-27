import Link from 'next/link'
import { BellRing, Bot, Code2, ExternalLink, Fingerprint, KeyRound, MessageSquareText, Radar, ShieldAlert, ShieldCheck, TicketCheck, Webhook } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { demoDwmProductSnapshot, dwmWebhookPayload, type DwmAlert } from '@/utils/dwm/product'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default function DashboardDwmPage() {
    const snapshot = demoDwmProductSnapshot()
    const primaryAlert = snapshot.alerts[0]
    const criticalCount = snapshot.alerts.filter(alert => alert.severity === 'critical').length
    const activeSourceCount = snapshot.sourceCoverage.reduce((sum, source) => sum + source.activeCount, 0)
    const telegramSourceCount = snapshot.sourceCoverage.find(source => source.family === 'telegram_public')?.activeCount || 0
    const darkwebSourceCount = snapshot.sourceCoverage.find(source => source.family === 'darkweb_metadata')?.activeCount || 0

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
                <Stat title='Dark web sources' value={String(darkwebSourceCount)} detail='metadata-only active sources' icon={<ShieldCheck className='h-4 w-4' />} />
                <Stat title='Critical alerts' value={String(criticalCount)} detail='ready for customer routing' icon={<TicketCheck className='h-4 w-4' />} />
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

            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Live exposure queue</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Rows are shaped for review, routing, and fast response rather than bulk scraped-result browsing.</p>
                        </div>
                        <Radar className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-5 grid gap-2'>
                        {snapshot.alerts.map((alert) => (
                            <div key={alert.id} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 md:grid-cols-[1fr_auto] md:items-center'>
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <h3 className='font-semibold text-[#171a21]'>{alert.company}</h3>
                                        {alert.actor && <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'>{alert.actor}</span>}
                                        <span className={severityClass(alert.severity)}>{alert.severity}</span>
                                        <span className='rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold text-[#475467]'>{alert.confidence}% confidence</span>
                                    </div>
                                    <p className='mt-1 text-sm text-[#596170]'>Matched <span className='font-mono'>{alert.matchedTerm.value}</span> from {sourceFamilyLabel(alert.sourceFamily)} · {alert.artifactType.replaceAll('_', ' ')}</p>
                                    <p className='mt-2 line-clamp-2 text-sm leading-6 text-[#3d4656]'>{alert.claimSummary}</p>
                                    <div className='mt-3 flex flex-wrap gap-2'>
                                        {alert.evidence.map(item => (
                                            <span key={item.id} className='rounded-full border border-[#d8dee9] bg-white px-2 py-1 text-[11px] font-semibold text-[#596170]'>
                                                {item.captureMode} · {item.redactionState} · {item.contentHash}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className='flex flex-col items-start gap-2 text-xs md:items-end'>
                                    <span className='rounded-full bg-[#f3fbf6] px-2 py-1 font-semibold text-[#147a3b]'>{alert.reviewState.replaceAll('_', ' ')}</span>
                                    <span className='text-[#667085]'>{relativeTimeLabel(alert.firstSeenAt)}</span>
                                    <span className='rounded-full bg-[#eef3ff] px-2 py-1 font-semibold text-[#3056d3]'>{alert.webhookDelivery.recommendedRoute.replaceAll('_', ' ')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Webhook payload</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Small enough for incident routing, detailed enough for action.</p>
                        </div>
                        <Webhook className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-4 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-3'>
                        <pre className='max-h-96 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-5 text-[#344054]'>{JSON.stringify(primaryAlert ? dwmWebhookPayload(primaryAlert) : {}, null, 2)}</pre>
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

function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-[#fff0eb] px-2 py-0.5 text-xs font-semibold text-[#c2410c]'
    if (severity === 'high') return 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#b45309]'
    return 'rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'
}

function readinessLabel(decision: string) {
    if (decision === 'production_ready_with_live_sources') return 'Production-ready contract'
    if (decision === 'blocked_missing_watchlist') return 'Watchlist required'
    return 'Preview contract with live-source blockers'
}

function sourceFamilyLabel(family: DwmAlert['sourceFamily']) {
    return family.replaceAll('_', ' ')
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

function ValueCard({ icon, title, body }: { icon: ReactNode, title: string, body: string }) {
    return (
        <DashboardPanel className='p-5'>
            <div className='text-[#3056d3]'>{icon}</div>
            <h2 className='mt-3 text-base font-semibold text-[#171a21]'>{title}</h2>
            <p className='mt-2 text-sm leading-6 text-[#596170]'>{body}</p>
        </DashboardPanel>
    )
}
