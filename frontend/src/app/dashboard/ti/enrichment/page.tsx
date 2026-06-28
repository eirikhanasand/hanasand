import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, ListChecks, PlayCircle, Radio } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview, type TiEnrichedActor } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default async function TiEnrichmentPage() {
    const { updatedActors, queuedActors, stats, worker, pipeline } = await getTiEnrichmentOverview()
    const runs = pipeline?.latestRuns || []
    const failedRuns = runs.filter(run => run.status === 'failed')
    const nextActors = pipeline?.queue.nextActors || queuedActors.map(actor => actor.name).slice(0, 8)
    const allActors = [...updatedActors, ...queuedActors]
    const nextActorRows = nextActors.map((name, index) => {
        const actor = allActors.find(item => sameActor(item.name, name) || sameActor(item.id, name))
        const snapshot = pipeline?.latestSnapshots.find(item => sameActor(item.actor_name, name) || sameActor(item.actor_key, name))
        const run = runs.find(item => sameActor(item.actor_name, name) || sameActor(item.actor_key, name))
        return { name, index, actor, snapshot, run }
    })

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Enrichment queue'
                description='Actor refreshes, pipeline runs, published discoveries, and queue health.'
            />

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Worker' value={worker.state} tone={worker.state === 'running' ? 'ok' : worker.state === 'error' || worker.state === 'unavailable' ? 'bad' : 'watch'} icon={<Radio className='h-4 w-4' />} />
                <Metric title='Queue' value={`${stats.queued}`} icon={<ListChecks className='h-4 w-4' />} />
                <Metric title='Updated 1h' value={`${stats.updatedLastHour}`} icon={<CheckCircle2 className='h-4 w-4' />} />
                <Metric title='Runs 24h' value={`${pipeline?.stats.runs_24h ?? runs.length}`} icon={<PlayCircle className='h-4 w-4' />} />
                <Metric title='Failures' value={`${failedRuns.length}`} tone={failedRuns.length ? 'bad' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='overflow-hidden'>
                <div className='border-b border-[#e0e5ed] bg-[#fbfcfe] p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Pipeline status</h2>
                            <p className='mt-1 text-sm text-[#667085]'>{worker.mode}</p>
                        </div>
                        <div className='grid gap-2 text-xs font-semibold sm:grid-cols-3'>
                            <StatusPill label={`sweep ${worker.lastSweepFinishedAt ? shortTime(worker.lastSweepFinishedAt) : 'none'}`} tone='neutral' />
                            <StatusPill label={`${worker.intervalSeconds}s interval`} tone='neutral' />
                            <StatusPill label={`${worker.batchSize || 0} actors/pass`} tone='neutral' />
                        </div>
                    </div>
                    {worker.lastError ? <p className='mt-3 rounded-lg border border-[#ffd5d0] bg-[#fff4f2] p-3 text-sm text-[#a33428]'>{worker.lastError}</p> : null}
                </div>

                <div className='grid gap-4 p-4 xl:grid-cols-[0.85fr_1.15fr]'>
                    <div className='overflow-hidden rounded-lg border border-[#e0e5ed] bg-white'>
                        <div className='border-b border-[#edf0f5] px-4 py-3'>
                            <p className='text-xs font-semibold uppercase text-[#667085]'>Next actor refreshes</p>
                        </div>
                        <div className='divide-y divide-[#edf0f5]'>
                            {nextActorRows.map(row => (
                                <div key={`${row.name}-${row.index}`} className='grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto] md:items-center'>
                                    <div className='min-w-0'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <span className='font-semibold text-[#171a21]'>{row.actor?.name || row.snapshot?.actor_name || row.name}</span>
                                            <StatusPill label={`#${row.index + 1}`} tone='neutral' />
                                            {row.run ? <StatusPill label={row.run.status} tone={row.run.status === 'failed' ? 'bad' : row.run.status === 'running' ? 'watch' : 'ok'} /> : null}
                                        </div>
                                        <div className='mt-2 grid gap-2 text-xs text-[#667085] sm:grid-cols-3'>
                                            <QueueField label='sources' value={String(row.snapshot?.source_count ?? row.actor?.sourceLinks.length ?? 0)} />
                                            <QueueField label='activity' value={String(row.snapshot?.activity_count ?? row.actor?.automationEvidence.length ?? 0)} />
                                            <QueueField label='next' value={row.actor?.nextRefreshAt ? shortTime(row.actor.nextRefreshAt) : row.run?.finished_at ? shortTime(row.run.finished_at) : 'queued'} />
                                        </div>
                                    </div>
                                    <Link href={`/ti/${encodeURIComponent(row.actor?.id || row.snapshot?.actor_key || row.name)}`} className='inline-flex h-9 items-center justify-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                                        Open
                                    </Link>
                                </div>
                            ))}
                            {!nextActorRows.length ? <p className='p-4 text-sm text-[#667085]'>No queued actors.</p> : null}
                        </div>
                    </div>

                    <div className='overflow-hidden rounded-lg border border-[#e0e5ed] bg-white'>
                        <div className='border-b border-[#edf0f5] px-4 py-3'>
                            <p className='text-xs font-semibold uppercase text-[#667085]'>Latest runs</p>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                                <thead className='bg-[#fbfcfe] text-left text-xs font-semibold uppercase text-[#667085]'>
                                    <tr>
                                        <th className='px-4 py-3'>Actor</th>
                                        <th className='px-4 py-3'>Status</th>
                                        <th className='px-4 py-3'>Changed</th>
                                        <th className='px-4 py-3'>Published</th>
                                        <th className='px-4 py-3'>Finished</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-[#edf0f5]'>
                                    {runs.slice(0, 8).map(run => (
                                        <tr key={run.id} className='hover:bg-[#fbfcfe]'>
                                            <td className='px-4 py-3 font-semibold text-[#171a21]'>{run.actor_name}</td>
                                            <td className='px-4 py-3'><StatusPill label={run.status} tone={run.status === 'failed' ? 'bad' : run.status === 'running' ? 'watch' : 'ok'} /></td>
                                            <td className='px-4 py-3 text-[#596170]'>{run.changed_fields.length ? run.changed_fields.join(', ') : '-'}</td>
                                            <td className='px-4 py-3 font-semibold text-[#171a21]'>{run.published_items}</td>
                                            <td className='whitespace-nowrap px-4 py-3 text-[#596170]'>{run.finished_at ? formatTiDate(run.finished_at) : 'Running'}</td>
                                        </tr>
                                    ))}
                                    {!runs.length ? (
                                        <tr>
                                            <td colSpan={5} className='px-4 py-8 text-center text-sm text-[#667085]'>No pipeline runs returned by the API yet.</td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[1.1fr_0.9fr]'>
                <DashboardPanel className='overflow-hidden'>
                    <div className='border-b border-[#e0e5ed] bg-[#fbfcfe] px-4 py-3'>
                        <h2 className='text-base font-semibold text-[#171a21]'>Actor queue</h2>
                    </div>
                    <ActorTable actors={[...updatedActors, ...queuedActors]} />
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-base font-semibold text-[#171a21]'>Published discoveries</h2>
                    <div className='mt-4 grid gap-3'>
                        {(pipeline?.latestDiscoveries || []).slice(0, 8).map(item => (
                            <article key={item.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4'>
                                <div className='flex flex-wrap items-start justify-between gap-2'>
                                    <div>
                                        <p className='text-xs font-semibold uppercase text-[#667085]'>{item.actor_name}</p>
                                        <p className='mt-1 font-semibold text-[#171a21]'>{item.title}</p>
                                    </div>
                                    <StatusPill label={item.kind} tone='neutral' />
                                </div>
                                <p className='mt-2 line-clamp-2 text-sm text-[#596170]'>{item.detail || item.source_name || 'Discovery metadata recorded.'}</p>
                                <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-[#667085]'>
                                    <span>{item.published_at ? formatTiDate(item.published_at) : 'unpublished'}</span>
                                    {item.source_url ? (
                                        <a href={item.source_url} target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-1 font-semibold text-[#3056d3]'>
                                            Source
                                            <ExternalLink className='h-3 w-3' />
                                        </a>
                                    ) : null}
                                </div>
                            </article>
                        ))}
                        {!pipeline?.latestDiscoveries?.length ? <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#667085]'>No discoveries published yet.</p> : null}
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function ActorTable({ actors }: { actors: TiEnrichedActor[] }) {
    return (
        <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                    <tr>
                        <th className='px-4 py-3'>Actor</th>
                        <th className='px-4 py-3'>Status</th>
                        <th className='px-4 py-3'>Confidence</th>
                        <th className='px-4 py-3'>Last update</th>
                        <th className='px-4 py-3'>Next refresh</th>
                        <th className='px-4 py-3'>Sources</th>
                        <th className='px-4 py-3 text-right'>Action</th>
                    </tr>
                </thead>
                <tbody className='divide-y divide-[#edf0f5] bg-white'>
                    {actors.map(actor => (
                        <tr key={`${actor.id}-${actor.status}`} className='hover:bg-[#fbfcfe]'>
                            <td className='px-4 py-4'>
                                <p className='font-semibold text-[#171a21]'>{actor.name}</p>
                                <p className='mt-1 max-w-xs truncate text-xs text-[#667085]'>{actor.aliases.length ? actor.aliases.join(', ') : 'No aliases'}</p>
                            </td>
                            <td className='px-4 py-4'><StatusPill label={actor.status} tone={actor.status === 'review' ? 'watch' : actor.status === 'queued' ? 'neutral' : 'ok'} /></td>
                            <td className='px-4 py-4 font-semibold text-[#171a21]'>{actor.confidence}%</td>
                            <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(actor.lastUpdatedAt)}</td>
                            <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(actor.nextRefreshAt)}</td>
                            <td className='px-4 py-4 text-[#596170]'>{actor.sourceLinks.length}</td>
                            <td className='px-4 py-4 text-right'>
                                <Link href={`/ti/${encodeURIComponent(actor.id)}`} className='inline-flex h-8 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>Open</Link>
                            </td>
                        </tr>
                    ))}
                    {!actors.length ? (
                        <tr>
                            <td colSpan={7} className='px-4 py-8 text-center text-sm text-[#667085]'>No actor queue data returned.</td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
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

function QueueField({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#edf0f5] bg-[#fbfcfe] px-2 py-1'>
            <p className='text-[9px] font-semibold uppercase text-[#8c95a5]'>{label}</p>
            <p className='mt-0.5 truncate font-semibold text-[#344054]'>{value}</p>
        </div>
    )
}

function sameActor(a: string, b: string) {
    return a.toLowerCase().replace(/[^a-z0-9]+/g, '-') === b.toLowerCase().replace(/[^a-z0-9]+/g, '-')
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
