import Link from 'next/link'
import { CheckCircle2, Clock3, ExternalLink, ListChecks } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview, type TiEnrichedActor } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default function TiEnrichmentPage() {
    const { updatedActors, queuedActors, stats } = getTiEnrichmentOverview()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Actor enrichment'
                description='Automatic actor-profile enrichment queue, recent refreshes, source packs, and planned background work.'
            />

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <Stat title='Updated last hour' value={`${stats.updatedLastHour}`} />
                <Stat title='Queued next' value={`${stats.queued}`} />
                <Stat title='Coverage' value={`${stats.automaticCoverage} actors`} />
                <Stat title='Mode' value='24/7 sweep' />
            </div>

            <DashboardPanel className='p-5'>
                <div className='flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-[#147a3b]' />
                    <h2 className='text-lg font-semibold text-[#171a21]'>Recently enriched</h2>
                </div>
                <div className='mt-4 grid gap-4 xl:grid-cols-2'>
                    {updatedActors.map(actor => <ActorCard key={actor.id} actor={actor} />)}
                </div>
            </DashboardPanel>

            <DashboardPanel className='p-5'>
                <div className='flex items-center gap-2'>
                    <Clock3 className='h-4 w-4 text-[#8a5a00]' />
                    <h2 className='text-lg font-semibold text-[#171a21]'>Next for enrichment</h2>
                </div>
                <div className='mt-4 grid gap-4 xl:grid-cols-2'>
                    {queuedActors.map(actor => <ActorCard key={actor.id} actor={actor} queued />)}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function ActorCard({ actor, queued }: { actor: TiEnrichedActor, queued?: boolean }) {
    return (
        <article className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h3 className='text-base font-semibold text-[#171a21]'>{actor.name}</h3>
                    <p className='mt-1 text-xs text-[#667085]'>{actor.aliases.length ? actor.aliases.join(', ') : 'No aliases recorded yet'}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${queued ? 'bg-[#fff4d6] text-[#8a5a00]' : 'bg-[#e9f8ef] text-[#147a3b]'}`}>{actor.status}</span>
            </div>
            <div className='mt-4 grid gap-2 sm:grid-cols-2'>
                <Info label='Last updated' value={formatTiDate(actor.lastUpdatedAt)} />
                <Info label='Next refresh' value={formatTiDate(actor.nextRefreshAt)} />
                <Info label='Confidence' value={`${Math.round(actor.confidence * 100)}%`} />
                <Info label='Changed fields' value={actor.changedFields.length ? actor.changedFields.join(', ') : 'Queued'} />
            </div>
            <div className='mt-4'>
                <p className='text-xs font-semibold uppercase text-[#667085]'>Planned work</p>
                <ul className='mt-2 grid gap-2 text-sm leading-6 text-[#596170]'>
                    {actor.plannedWork.map(item => <li key={item}>- {item}</li>)}
                </ul>
            </div>
            <div className='mt-4'>
                <p className='text-xs font-semibold uppercase text-[#667085]'>Automation evidence</p>
                <ul className='mt-2 grid gap-2 text-sm leading-6 text-[#596170]'>
                    {actor.automationEvidence.map(item => <li key={item}>- {item}</li>)}
                </ul>
            </div>
            <div className='mt-4 flex flex-wrap gap-2'>
                <Link href={`/ti/${encodeURIComponent(actor.id)}`} className='inline-flex h-9 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white hover:bg-[#2b2f39]'>
                    Open profile
                </Link>
                {actor.sourceLinks.slice(0, 3).map(source => (
                    <a key={source.url} href={source.url} target='_blank' rel='noopener noreferrer' className='inline-flex h-9 items-center gap-1 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                        {source.name}
                        <ExternalLink className='h-3 w-3' />
                    </a>
                ))}
            </div>
        </article>
    )
}

function Stat({ title, value }: { title: string, value: string }) {
    return (
        <DashboardPanel className='p-4'>
            <div className='flex items-center justify-between text-[#667085]'>
                <p className='text-xs font-semibold uppercase'>{title}</p>
                <ListChecks className='h-4 w-4' />
            </div>
            <p className='mt-3 text-xl font-semibold text-[#171a21]'>{value}</p>
        </DashboardPanel>
    )
}

function Info({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}
