import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, Radio } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'

export const dynamic = 'force-dynamic'

export default async function TiAuditPage() {
    const { auditLog, stats, worker } = await getTiEnrichmentOverview()
    const sortedEvents = [...auditLog].sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    const failedEvents = sortedEvents.filter(event => !['ok', 'ready', 'success', 'completed', 'published'].includes(event.result.toLowerCase()))
    const lastEvent = sortedEvents[0]
    const failedIds = new Set(failedEvents.map(event => event.id))

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Audit log'
                description='Management actions, queue decisions, worker events, and profile-cache changes.'
            />

            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Events' value={`${stats.auditedEvents || sortedEvents.length}`} icon={<ClipboardList className='h-4 w-4' />} />
                <Metric title='Failures' value={`${failedEvents.length}`} tone={failedEvents.length ? 'bad' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Refreshes' value={`${stats.totalRefreshes}`} icon={<CheckCircle2 className='h-4 w-4' />} />
                <Metric title='Worker' value={operationalStateLabel(worker.state)} tone={worker.state === 'running' ? 'ok' : worker.state === 'error' || worker.state === 'unavailable' ? 'bad' : 'watch'} icon={<Radio className='h-4 w-4' />} />
                <Metric title='Last action' value={lastEvent ? shortTime(lastEvent.happenedAt) : 'Checking'} icon={<Clock3 className='h-4 w-4' />} />
            </div>

            <div className='grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]'>
                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='border-b border-ui-border bg-ui-raised px-3 py-2'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <div>
                                <h2 className='text-sm font-semibold text-ui-text'>Timeline</h2>
                                <p className='mt-0.5 text-[11px] text-ui-muted'>{sortedEvents.length} events sorted newest first</p>
                            </div>
                            <div className='flex flex-wrap gap-1.5 text-[11px] font-semibold'>
                                <StatusPill label={`worker ${operationalStateLabel(worker.state)}`} tone={worker.state === 'running' ? 'ok' : 'watch'} />
                                <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-ui-muted'>cursor {worker.cursor}</span>
                            </div>
                        </div>
                    </div>
                    <div className='max-h-[calc(100vh-18rem)] min-h-72 overflow-auto'>
                        <table className='min-w-full border-separate border-spacing-0 text-xs'>
                            <thead className='sticky top-0 z-10 bg-ui-panel/95 text-left text-[10px] font-semibold uppercase text-ui-muted backdrop-blur'>
                                <tr>
                                    <th className='border-b border-ui-border px-3 py-2'>Time</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Actor</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Action</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Target</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Result</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Detail</th>
                                </tr>
                            </thead>
                            <tbody className='bg-ui-panel'>
                                {sortedEvents.map(event => (
                                    <tr key={event.id} className='align-top transition hover:bg-ui-raised'>
                                        <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5 text-ui-muted'>{compactTime(event.happenedAt)}</td>
                                        <td className='max-w-28 border-b border-ui-border px-3 py-1.5 font-mono text-ui-text'>{event.actor}</td>
                                        <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5 font-mono font-semibold text-ui-primary'>{event.action}</td>
                                        <td className='max-w-44 border-b border-ui-border px-3 py-1.5 font-mono text-ui-text'>
                                            <Link className='hover:text-ui-primary hover:underline' href={auditEventHref(event)}>{event.target}</Link>
                                        </td>
                                        <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5'><StatusPill label={event.result} tone={failedIds.has(event.id) ? 'bad' : 'ok'} /></td>
                                        <td className='max-w-[34rem] border-b border-ui-border px-3 py-1.5 text-ui-muted'>
                                            <span className='line-clamp-2'>{event.detail}</span>
                                        </td>
                                    </tr>
                                ))}
                                {!sortedEvents.length ? (
                                    <tr>
                                        <td colSpan={6} className='px-4 py-8 text-center text-sm text-ui-muted'>Audit events stream here as they arrive.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='border-b border-ui-border bg-ui-raised px-3 py-2'>
                        <h2 className='text-sm font-semibold text-ui-text'>Events to review</h2>
                        <p className='mt-0.5 text-[11px] text-ui-muted'>{failedEvents.length} event{failedEvents.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className='max-h-[calc(100vh-19rem)] min-h-72 overflow-auto p-2'>
                        <div className='grid gap-1.5'>
                            {failedEvents.slice(0, 24).map(event => (
                                <Link key={event.id} href={auditEventHref(event)} className='grid gap-1 rounded-md border border-ui-border bg-ui-raised px-2.5 py-2 text-left transition hover:border-ui-primary hover:bg-ui-panel'>
                                    <div className='flex min-w-0 items-center justify-between gap-2'>
                                        <span className='truncate font-mono text-[11px] font-semibold text-ui-primary'>{event.action}</span>
                                        <StatusPill label={event.result} tone='bad' />
                                    </div>
                                    <p className='truncate font-mono text-[11px] text-ui-text'>{event.target}</p>
                                    <div className='flex min-w-0 items-center justify-between gap-2 text-[10px] text-ui-muted'>
                                        <span className='truncate'>{event.actor}</span>
                                        <span className='shrink-0'>{shortAge(event.happenedAt)}</span>
                                    </div>
                                </Link>
                            ))}
                            {!failedEvents.length ? <p className='rounded-md border border-dashed border-ui-border p-3 text-xs text-ui-muted'>Audit stream is live; no failed events in the current window.</p> : null}
                        </div>
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function Metric({ title, value, icon, tone = 'neutral' }: { title: string, value: string, icon: ReactNode, tone?: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-[10px] font-semibold uppercase text-ui-muted'>{title}</p>
                {icon}
            </div>
            <p className='mt-2 truncate text-lg font-semibold capitalize text-ui-text'>{value}</p>
        </DashboardPanel>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function auditEventHref(event: { action: string, target: string }) {
    const action = event.action.toLowerCase()
    if (action.includes('source') || event.target.startsWith('source:')) return '/dashboard/ti/sources'
    if (action.includes('domain') || event.target.includes('.')) return '/dashboard/ti/domains'
    if (action.includes('actor') || action.includes('profile') || action.includes('enrich')) return '/dashboard/ti/enrichment'
    if (action.includes('alert') || action.includes('watchlist') || action.includes('webhook')) return '/dashboard/ti/workbench'
    return '/dashboard/ti/workbench'
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'bg-ui-success/15', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'bg-ui-warning/15', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'bg-ui-danger/15', text: 'text-ui-danger' }
    return { bg: 'bg-ui-primary/15', text: 'text-ui-primary' }
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'review') return 'reviewing'
    return value.replaceAll('_', ' ')
}

function compactTime(value: string) {
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
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
    if (!Number.isFinite(delta)) return 'checking'
    const minutes = Math.max(0, Math.round(delta / 60_000))
    if (minutes < 60) return `${minutes}m`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours}h`
    return `${Math.round(hours / 24)}d`
}
