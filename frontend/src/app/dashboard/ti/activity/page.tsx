import Link from 'next/link'
import { Activity, ExternalLink } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default function TiActivityPage() {
    const { activity, updatedActors } = getTiEnrichmentOverview()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Recent actor activity'
                description='Recently updated actors, enrichment events, and source-backed profile changes.'
            />

            <div className='grid gap-4 lg:grid-cols-[0.95fr_1.05fr]'>
                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-[#171a21]'>Updated actors</h2>
                    <div className='mt-4 grid gap-3'>
                        {updatedActors.map(actor => (
                            <Link key={actor.id} href={`/ti/${encodeURIComponent(actor.id)}`} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 transition hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'>
                                <div className='flex flex-wrap items-center justify-between gap-3'>
                                    <h3 className='text-base font-semibold text-[#171a21]'>{actor.name}</h3>
                                    <span className='rounded-full bg-[#e9f8ef] px-2 py-1 text-xs font-semibold text-[#147a3b]'>{Math.round(actor.confidence * 100)}% confidence</span>
                                </div>
                                <p className='mt-2 text-xs text-[#667085]'>Updated {formatTiDate(actor.lastUpdatedAt)} · next {formatTiDate(actor.nextRefreshAt)}</p>
                                <p className='mt-2 text-sm leading-6 text-[#596170]'>{actor.changedFields.join(', ')}</p>
                            </Link>
                        ))}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center gap-2'>
                        <Activity className='h-4 w-4 text-[#3056d3]' />
                        <h2 className='text-lg font-semibold text-[#171a21]'>Activity stream</h2>
                    </div>
                    <div className='mt-4 grid gap-3'>
                        {activity.map(event => (
                            <article key={event.id} className='rounded-lg border border-[#e0e5ed] bg-white p-4'>
                                <div className='flex flex-wrap items-start justify-between gap-3'>
                                    <div>
                                        <p className='text-xs font-semibold uppercase text-[#3056d3]'>{event.actorName}</p>
                                        <h3 className='mt-1 text-sm font-semibold text-[#171a21]'>{event.title}</h3>
                                    </div>
                                    <span className='text-xs text-[#667085]'>{formatTiDate(event.happenedAt)}</span>
                                </div>
                                <p className='mt-2 text-sm leading-6 text-[#596170]'>{event.detail}</p>
                                <p className='mt-2 inline-flex items-center gap-1 text-xs text-[#667085]'>
                                    {event.source}
                                    <ExternalLink className='h-3 w-3 text-[#3056d3]' />
                                </p>
                            </article>
                        ))}
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}
