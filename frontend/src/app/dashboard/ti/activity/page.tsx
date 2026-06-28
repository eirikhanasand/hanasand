import type { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Clock3, ExternalLink, Radio } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview, type TiActivityEvent } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default async function TiActivityPage() {
    const { activity, updatedActors, worker, stats } = await getTiEnrichmentOverview()
    const sortedActivity = [...activity].sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    const badEvents = sortedActivity.filter(event => event.tone === 'bad')
    const watchEvents = sortedActivity.filter(event => event.tone === 'watch')
    const lastEvent = sortedActivity[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Activity queue'
                description='Actor changes, source-backed updates, and enrichment events ready for review.'
            />

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Events' value={`${sortedActivity.length}`} icon={<Activity className='h-4 w-4' />} />
                <Metric title='Needs review' value={`${badEvents.length + watchEvents.length}`} tone={badEvents.length ? 'bad' : watchEvents.length ? 'watch' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Actors updated' value={`${updatedActors.length}`} icon={<CheckCircle2 className='h-4 w-4' />} />
                <Metric title='Updated last hour' value={`${stats.updatedLastHour}`} icon={<Radio className='h-4 w-4' />} />
                <Metric title='Last event' value={lastEvent ? shortTime(lastEvent.happenedAt) : 'None'} icon={<Clock3 className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='overflow-hidden'>
                <div className='border-b border-[#e0e5ed] bg-[#fbfcfe] p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Review stream</h2>
                            <p className='mt-1 text-sm text-[#667085]'>Newest source-backed actor changes first.</p>
                        </div>
                        <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                            <StatusPill label={worker.state} tone={worker.state === 'error' || worker.state === 'unavailable' ? 'bad' : worker.state === 'running' ? 'ok' : 'watch'} />
                            <span className='rounded-full border border-[#d8dee9] bg-white px-2 py-1 text-[#596170]'>last sweep {worker.lastSweepFinishedAt ? shortTime(worker.lastSweepFinishedAt) : 'none'}</span>
                            <span className='rounded-full border border-[#d8dee9] bg-white px-2 py-1 text-[#596170]'>{worker.batchSize || 0} actors/pass</span>
                        </div>
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <table className='min-w-full divide-y divide-[#e0e5ed] text-sm'>
                        <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                            <tr>
                                <th className='px-4 py-3'>Time</th>
                                <th className='px-4 py-3'>Actor</th>
                                <th className='px-4 py-3'>Change</th>
                                <th className='px-4 py-3'>Source</th>
                                <th className='px-4 py-3'>Review</th>
                                <th className='px-4 py-3 text-right'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#edf0f5] bg-white'>
                            {sortedActivity.map(event => (
                                <tr key={event.id} className='align-top hover:bg-[#fbfcfe]'>
                                    <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(event.happenedAt)}</td>
                                    <td className='px-4 py-4'>
                                        <Link href={`/ti/${encodeURIComponent(event.actorId)}`} className='font-semibold text-[#171a21] hover:text-[#3056d3]'>{event.actorName}</Link>
                                    </td>
                                    <td className='px-4 py-4'>
                                        <p className='font-semibold text-[#171a21]'>{event.title}</p>
                                        <div className='mt-2 grid gap-2 text-xs text-[#667085] md:grid-cols-2'>
                                            <ActivityFact label='detail' value={event.detail} />
                                            <ActivityFact label='age' value={relativeAge(event.happenedAt)} />
                                        </div>
                                    </td>
                                    <td className='px-4 py-4 text-[#596170]'>{event.source}</td>
                                    <td className='px-4 py-4'><StatusPill label={event.tone === 'bad' ? 'review' : event.tone === 'watch' ? 'watch' : 'ok'} tone={event.tone} /></td>
                                    <td className='px-4 py-4 text-right'>
                                        <Link href={`/ti/${encodeURIComponent(event.actorId)}`} className='inline-flex h-8 items-center gap-1 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                                            Open
                                            <ExternalLink className='h-3 w-3' />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {!sortedActivity.length ? (
                                <tr>
                                    <td colSpan={6} className='px-4 py-8 text-center text-sm text-[#667085]'>No activity events reported by the API worker yet.</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[0.9fr_1.1fr]'>
                <DashboardPanel className='p-5'>
                    <h2 className='text-base font-semibold text-[#171a21]'>Needs attention</h2>
                    <div className='mt-4 grid gap-3'>
                        {[...badEvents, ...watchEvents].slice(0, 6).map(event => <AttentionRow key={event.id} event={event} />)}
                        {!badEvents.length && !watchEvents.length ? <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#667085]'>No review events in the current stream.</p> : null}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-base font-semibold text-[#171a21]'>Recently updated actors</h2>
                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        {updatedActors.slice(0, 8).map(actor => (
                            <Link key={actor.id} href={`/ti/${encodeURIComponent(actor.id)}`} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div>
                                        <p className='font-semibold text-[#171a21]'>{actor.name}</p>
                                        <p className='mt-1 text-xs text-[#667085]'>{actor.sourceLinks.length} sources · {actor.refreshCount ?? 0} refreshes</p>
                                    </div>
                                    <StatusPill label={actor.status} tone={actor.status === 'review' ? 'watch' : 'ok'} />
                                </div>
                                <p className='mt-3 text-xs text-[#596170]'>Updated {formatTiDate(actor.lastUpdatedAt)}</p>
                                <p className='mt-2 truncate text-sm text-[#596170]'>{actor.changedFields.length ? actor.changedFields.join(', ') : 'No field changes listed'}</p>
                            </Link>
                        ))}
                        {!updatedActors.length ? <p className='text-sm text-[#667085]'>No actor refreshes have been recorded yet.</p> : null}
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
            <p className='mt-3 text-2xl font-semibold text-[#171a21]'>{value}</p>
        </DashboardPanel>
    )
}

function AttentionRow({ event }: { event: TiActivityEvent }) {
    return (
        <Link href={`/ti/${encodeURIComponent(event.actorId)}`} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 hover:border-[#c8d1df]'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>{event.actorName}</p>
                    <p className='mt-1 font-semibold text-[#171a21]'>{event.title}</p>
                </div>
                <StatusPill label={event.tone === 'bad' ? 'review' : 'watch'} tone={event.tone} />
            </div>
            <p className='mt-2 text-sm text-[#596170]'>{event.detail}</p>
            <div className='mt-3 grid gap-2 text-xs text-[#667085] sm:grid-cols-2'>
                <ActivityFact label='source' value={event.source} />
                <ActivityFact label='age' value={relativeAge(event.happenedAt)} />
            </div>
        </Link>
    )
}

function ActivityFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#edf0f5] bg-white px-2 py-1'>
            <p className='text-[9px] font-semibold uppercase text-[#8c95a5]'>{label}</p>
            <p className='mt-0.5 line-clamp-2 font-semibold text-[#344054]'>{value}</p>
        </div>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
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

function relativeAge(value: string) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000))
    if (!Number.isFinite(minutes)) return 'unknown'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}
