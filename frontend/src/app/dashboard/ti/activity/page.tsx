import type { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Clock3, ExternalLink, Radio } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview, type TiActivityEvent } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default async function TiActivityPage() {
    const { activity, updatedActors, worker, stats, dataAvailable } = await getTiEnrichmentOverview()
    const sortedActivity = [...activity].sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    const badEvents = sortedActivity.filter(event => event.tone === 'bad')
    const watchEvents = sortedActivity.filter(event => event.tone === 'watch')
    const lastEvent = sortedActivity[0]

    if (!dataAvailable || (!activity.length && !updatedActors.length)) {
        const unavailable = !dataAvailable
        const failed = Boolean(worker.lastError)
        return (
            <DashboardPage>
                <DashboardPanel className='overflow-hidden p-0'>
                    <h1 className='border-b border-ui-border px-4 py-3 text-lg font-semibold text-ui-text'>Latest activity</h1>
                    <div className='flex min-h-56 flex-col items-center justify-center gap-2 px-4 py-16 text-center text-ui-muted' data-ti-activity-state={unavailable ? 'error' : failed ? 'attention' : 'empty'}>
                        <Activity className='mb-2 h-6 w-6' aria-hidden='true' />
                        <p className={`font-semibold ${unavailable || failed ? 'text-ui-danger' : 'text-ui-text'}`} role={unavailable || failed ? 'alert' : undefined}>{unavailable ? 'Activity is temporarily unavailable.' : failed ? 'The latest profile update failed.' : 'Welcome to activity'}</p>
                        <p className='max-w-md text-sm leading-6'>{unavailable ? 'We could not load the latest observations. Try again to check for updates.' : failed ? 'No observations are available yet. Try again to check whether profile updates have recovered.' : 'No observations yet. This page shows recorded actor profile changes and their linked evidence.'}</p>
                        <form action='/ti/activity' method='get'><button type='submit' className='mt-3 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold text-ui-text hover:border-ui-primary'>{unavailable || failed ? 'Try again' : 'Check for updates'}</button></form>
                    </div>
                </DashboardPanel>
            </DashboardPage>
        )
    }

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Latest activity'
                description='Automated collection and profile updates observed by Hanasand.'
            />

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Events' value={`${sortedActivity.length}`} icon={<Activity className='h-4 w-4' />} />
                <Metric title='Monitoring signals' value={`${badEvents.length + watchEvents.length}`} tone={badEvents.length ? 'bad' : watchEvents.length ? 'watch' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Actors updated' value={`${updatedActors.length}`} icon={<CheckCircle2 className='h-4 w-4' />} />
                <Metric title='Updated last hour' value={`${stats.updatedLastHour}`} icon={<Radio className='h-4 w-4' />} />
                <Metric title='Last event' value={lastEvent ? shortTime(lastEvent.happenedAt) : 'No events yet'} icon={<Clock3 className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Latest observations</h2>
                            <p className='mt-1 text-sm text-ui-muted'>Newest automated observations with linked sources first.</p>
                        </div>
                        <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                            <StatusPill label={operationalStateLabel(worker.state)} tone={worker.state === 'unavailable' ? 'bad' : worker.state === 'active' ? 'ok' : 'watch'} />
                            <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-1 text-ui-muted'>last sweep {worker.lastSweepFinishedAt ? shortTime(worker.lastSweepFinishedAt) : 'not recorded'}</span>
                            <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-1 text-ui-muted'>{updatedActors.length} actors loaded</span>
                        </div>
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <table className='min-w-full divide-y divide-ui-border text-sm'>
                        <thead className='bg-ui-raised text-left text-[11px] font-semibold uppercase text-ui-muted'>
                            <tr>
                                <th className='px-4 py-2'>Time</th>
                                <th className='px-4 py-2'>Actor</th>
                                <th className='px-4 py-2'>Change</th>
                                <th className='px-4 py-2'>Source</th>
                                <th className='px-4 py-2'>State</th>
                                <th className='px-4 py-2 text-right'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border bg-ui-panel'>
                            {sortedActivity.map(event => (
                                <tr key={event.id} className='align-top hover:bg-ui-raised'>
                                    <td className='whitespace-nowrap px-4 py-2.5 text-ui-muted'>{formatTiDate(event.happenedAt)}</td>
                                    <td className='px-4 py-2.5'>
                                        <Link href={`/ti/${encodeURIComponent(event.actorId)}`} className='font-semibold text-ui-text hover:text-ui-primary'>{event.actorName}</Link>
                                    </td>
                                    <td className='px-4 py-2.5'>
                                        <p className='font-semibold text-ui-text'>{event.title}</p>
                                        <div className='mt-1.5 grid gap-1.5 text-xs text-ui-muted md:grid-cols-2'>
                                            <ActivityFact label='detail' value={event.detail} />
                                            <ActivityFact label='age' value={relativeAge(event.happenedAt)} />
                                        </div>
                                    </td>
                                    <td className='px-4 py-2.5 text-ui-muted'>{event.source}</td>
                                    <td className='px-4 py-2.5'><StatusPill label={event.tone === 'bad' ? 'attention' : event.tone === 'watch' ? 'watching' : 'observed'} tone={event.tone} /></td>
                                    <td className='px-4 py-2.5 text-right'>
                                        <Link href={`/ti/${encodeURIComponent(event.actorId)}`} className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text hover:border-ui-primary'>
                                            Open
                                            <ExternalLink className='h-3 w-3' />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {!sortedActivity.length ? (
                                <tr>
                                    <td colSpan={6} className='px-4 py-8 text-center text-sm text-ui-muted'>No observations recorded yet for these actor profiles.</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </DashboardPanel>

            <div className='grid gap-3 xl:grid-cols-[0.9fr_1.1fr]'>
                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <h2 className='text-base font-semibold text-ui-text'>Monitoring status</h2>
                    <div className='mt-3 grid gap-2'>
                        {[...badEvents, ...watchEvents].slice(0, 6).map(event => <AttentionRow key={event.id} event={event} />)}
                        {worker.lastError ? <p role='alert' className='text-sm text-ui-danger'>The latest profile update failed. Check again for recovery.</p> : null}
                        {!worker.lastError && !badEvents.length && !watchEvents.length ? <p className='rounded-md border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>No monitoring issues in the latest observations.</p> : null}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <h2 className='text-base font-semibold text-ui-text'>Recently observed actors</h2>
                    <div className='mt-3 grid gap-2 md:grid-cols-2'>
                        {updatedActors.slice(0, 8).map(actor => (
                            <Link key={actor.id} href={`/ti/${encodeURIComponent(actor.id)}`} className='rounded-md border border-ui-border bg-ui-raised p-3 hover:border-ui-primary'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div>
                                        <p className='font-semibold text-ui-text'>{actor.name}</p>
                                        <p className='mt-1 text-xs text-ui-muted'>{actor.sourceLinks.length} sources · {actor.refreshCount ?? 0} refreshes</p>
                                    </div>
                                    <StatusPill label={operationalStateLabel(actor.status)} tone={actor.status === 'review' ? 'watch' : 'ok'} />
                                </div>
                                <p className='mt-2 text-xs text-ui-muted'>Updated {formatTiDate(actor.lastUpdatedAt)}</p>
                                <p className='mt-1 truncate text-sm text-ui-muted'>{actor.changedFields.length ? actor.changedFields.join(', ') : 'No field changes in the latest refresh'}</p>
                            </Link>
                        ))}
                        {!updatedActors.length ? <p className='text-sm text-ui-muted'>No actor profiles recorded yet.</p> : null}
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function Metric({ title, value, icon, tone = 'neutral' }: { title: string, value: string, icon: ReactNode, tone?: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-xs font-semibold uppercase text-ui-muted'>{title}</p>
                {icon}
            </div>
            <p className='mt-3 text-2xl font-semibold text-ui-text'>{value}</p>
        </DashboardPanel>
    )
}

function AttentionRow({ event }: { event: TiActivityEvent }) {
    return (
        <Link href={`/ti/${encodeURIComponent(event.actorId)}`} className='rounded-md border border-ui-border bg-ui-raised p-3 hover:border-ui-primary'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>{event.actorName}</p>
                    <p className='mt-1 font-semibold text-ui-text'>{event.title}</p>
                </div>
                <StatusPill label={event.tone === 'bad' ? 'attention' : 'watching'} tone={event.tone} />
            </div>
            <p className='mt-2 text-sm text-ui-muted'>{event.detail}</p>
            <div className='mt-2 grid gap-1.5 text-xs text-ui-muted sm:grid-cols-2'>
                <ActivityFact label='source' value={event.source} />
                <ActivityFact label='age' value={relativeAge(event.happenedAt)} />
            </div>
        </Link>
    )
}

function ActivityFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>
            <p className='text-[9px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-0.5 line-clamp-2 font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'border border-ui-success bg-ui-raised', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'border border-ui-warning bg-ui-raised', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'border border-ui-danger bg-ui-raised', text: 'text-ui-danger' }
    return { bg: 'border border-ui-primary bg-ui-raised', text: 'text-ui-primary' }
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'review') return 'reviewing'
    return value.replaceAll('_', ' ')
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

function relativeAge(value: string) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000))
    if (!Number.isFinite(minutes)) return 'checking'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}
