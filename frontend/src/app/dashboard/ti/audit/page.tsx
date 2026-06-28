import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, Radio } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default async function TiAuditPage() {
    const { auditLog, stats, worker } = await getTiEnrichmentOverview()
    const sortedEvents = [...auditLog].sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    const failedEvents = sortedEvents.filter(event => !['ok', 'ready', 'success', 'completed', 'published'].includes(event.result.toLowerCase()))
    const lastEvent = sortedEvents[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Audit log'
                description='Management actions, queue decisions, worker events, and profile-cache changes.'
            />

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Events' value={`${stats.auditedEvents || sortedEvents.length}`} icon={<ClipboardList className='h-4 w-4' />} />
                <Metric title='Failures' value={`${failedEvents.length}`} tone={failedEvents.length ? 'bad' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Refreshes' value={`${stats.totalRefreshes}`} icon={<CheckCircle2 className='h-4 w-4' />} />
                <Metric title='Worker' value={worker.state} tone={worker.state === 'running' ? 'ok' : worker.state === 'error' || worker.state === 'unavailable' ? 'bad' : 'watch'} icon={<Radio className='h-4 w-4' />} />
                <Metric title='Last action' value={lastEvent ? shortTime(lastEvent.happenedAt) : 'None'} icon={<Clock3 className='h-4 w-4' />} />
            </div>

            <div className='grid gap-4 xl:grid-cols-[0.85fr_1.15fr]'>
                <DashboardPanel className='p-5'>
                    <h2 className='text-base font-semibold text-[#171a21]'>Needs review</h2>
                    <div className='mt-4 grid gap-3'>
                        {failedEvents.slice(0, 6).map(event => (
                            <article key={event.id} className='rounded-lg border border-[#ffd5d0] bg-[#fffaf8] p-4'>
                                <div className='flex flex-wrap items-start justify-between gap-2'>
                                    <div>
                                        <p className='font-mono text-xs font-semibold uppercase text-[#667085]'>{event.action}</p>
                                        <p className='mt-1 font-semibold text-[#171a21]'>{event.target}</p>
                                    </div>
                                    <StatusPill label={event.result} tone='bad' />
                                </div>
                                <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                                    <AuditFact label='Age' value={shortAge(event.happenedAt)} />
                                    <AuditFact label='Actor' value={event.actor} />
                                    <AuditFact label='Target' value={event.target} />
                                    <AuditFact label='Route' value={auditRouteLabel(event)} />
                                </div>
                                <p className='mt-3 text-sm text-[#596170]'>{event.detail}</p>
                                <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
                                    <span className='text-xs text-[#667085]'>{formatTiDate(event.happenedAt)}</span>
                                    <Link className='rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-xs font-semibold text-[#3056d3] hover:border-[#b8c5ff] hover:bg-[#f4f7ff]' href={auditEventHref(event)}>
                                        Open console
                                    </Link>
                                </div>
                            </article>
                        ))}
                        {!failedEvents.length ? <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#667085]'>No failed or blocked audit events.</p> : null}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='overflow-hidden'>
                    <div className='border-b border-[#e0e5ed] bg-[#fbfcfe] px-4 py-3'>
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                            <h2 className='text-base font-semibold text-[#171a21]'>Event log</h2>
                            <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                                <StatusPill label={`worker ${worker.state}`} tone={worker.state === 'running' ? 'ok' : 'watch'} />
                                <span className='rounded-full border border-[#d8dee9] bg-white px-2 py-1 text-[#596170]'>cursor {worker.cursor}</span>
                            </div>
                        </div>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                            <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                                <tr>
                                    <th className='px-4 py-3'>Time</th>
                                    <th className='px-4 py-3'>Actor</th>
                                    <th className='px-4 py-3'>Action</th>
                                    <th className='px-4 py-3'>Target</th>
                                    <th className='px-4 py-3'>Result</th>
                                    <th className='px-4 py-3'>Detail</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-[#edf0f5] bg-white'>
                                {sortedEvents.map(event => (
                                    <tr key={event.id} className='align-top hover:bg-[#fbfcfe]'>
                                        <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(event.happenedAt)}</td>
                                        <td className='px-4 py-4 font-mono text-[#171a21]'>{event.actor}</td>
                                        <td className='px-4 py-4 font-mono text-[#3056d3]'>{event.action}</td>
                                        <td className='px-4 py-4 font-mono text-[#344054]'>
                                            <Link className='hover:text-[#3056d3] hover:underline' href={auditEventHref(event)}>{event.target}</Link>
                                        </td>
                                        <td className='px-4 py-4'><StatusPill label={event.result} tone={failedEvents.includes(event) ? 'bad' : 'ok'} /></td>
                                        <td className='px-4 py-4 text-[#596170]'>{event.detail}</td>
                                    </tr>
                                ))}
                                {!sortedEvents.length ? (
                                    <tr>
                                        <td colSpan={6} className='px-4 py-8 text-center text-sm text-[#667085]'>No audit events returned by the API.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function Metric({ title, value, icon, tone = 'neutral' }: { title: string, value: string, icon: ReactNode, tone?: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='p-4'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-xs font-semibold uppercase text-[#667085]'>{title}</p>
                {icon}
            </div>
            <p className='mt-3 text-2xl font-semibold capitalize text-[#171a21]'>{value}</p>
        </DashboardPanel>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function AuditFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-[#f3d4ca] bg-white px-2 py-1.5'>
            <p className='text-[9px] font-semibold uppercase text-[#8c95a5]'>{label}</p>
            <p className='mt-0.5 truncate text-xs font-semibold text-[#344054]' title={value}>{value}</p>
        </div>
    )
}

function auditEventHref(event: { action: string, target: string }) {
    const action = event.action.toLowerCase()
    if (action.includes('source') || event.target.startsWith('source:')) return '/dashboard/ti/sources'
    if (action.includes('domain') || event.target.includes('.')) return '/dashboard/ti/domains'
    if (action.includes('actor') || action.includes('profile') || action.includes('enrich')) return '/dashboard/ti/enrichment'
    if (action.includes('alert') || action.includes('watchlist') || action.includes('webhook')) return '/dashboard/ti/workbench'
    return '/dashboard/ti/workbench'
}

function auditRouteLabel(event: { action: string, target: string }) {
    const href = auditEventHref(event)
    if (href.endsWith('/sources')) return 'source ops'
    if (href.endsWith('/domains')) return 'domain queue'
    if (href.endsWith('/enrichment')) return 'actor enrichment'
    return 'case workbench'
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'bg-[#e9f8ef]', text: 'text-[#147a3b]' }
    if (tone === 'watch') return { bg: 'bg-[#fff4d6]', text: 'text-[#8a5a00]' }
    if (tone === 'bad') return { bg: 'bg-[#fff4f2]', text: 'text-[#a33428]' }
    return { bg: 'bg-[#eef3ff]', text: 'text-[#3056d3]' }
}

function shortTime(value: string) {
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}

function shortAge(value: string) {
    const delta = Date.now() - new Date(value).getTime()
    if (!Number.isFinite(delta)) return 'unknown'
    const minutes = Math.max(0, Math.round(delta / 60_000))
    if (minutes < 60) return `${minutes}m`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours}h`
    return `${Math.round(hours / 24)}d`
}
