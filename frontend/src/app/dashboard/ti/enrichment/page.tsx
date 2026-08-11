import Link from 'next/link'
import { ArrowRight, ExternalLink, Radio, Users } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview, type TiActivityEvent, type TiEnrichedActor } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default async function TiEnrichmentPage() {
    const { updatedActors, activity, worker, stats } = await getTiEnrichmentOverview()
    const actors = [...updatedActors].sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt))
    const recentActivity = activity.slice(0, 12)
    const sourceCount = new Set(actors.flatMap(actor => actor.sourceLinks.map(source => source.name))).size

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Actor profiles'
                description='Threat actors and groups observed in retained public intelligence.'
            />

            <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                <div className='flex flex-wrap items-start justify-between gap-4'>
                    <div>
                        <div className='flex items-center gap-2'>
                            <Radio className='h-5 w-5 text-ui-success' />
                            <h2 className='text-lg font-semibold text-ui-text'>Automated monitoring</h2>
                            <StatusPill label={worker.state === 'error' ? 'attention' : 'active'} tone={worker.state === 'error' ? 'bad' : 'ok'} />
                        </div>
                        <p className='mt-1 max-w-2xl text-sm text-ui-muted'>Profiles are built from captured source evidence automatically. Open a profile to see its public intelligence and evidence trail.</p>
                    </div>
                    <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised'>
                        View sources
                        <ArrowRight className='h-4 w-4' />
                    </Link>
                </div>
                <div className='mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                    <Metric label='Profiles observed' value={String(actors.length)} />
                    <Metric label='Evidence rows' value={String(activity.length)} />
                    <Metric label='Sources represented' value={String(sourceCount)} />
                    <Metric label='New in 24 hours' value={String(stats.updatedLastHour)} />
                </div>
            </DashboardPanel>

            {!actors.length ? (
                <DashboardPanel className='border-ui-border bg-ui-panel p-10 text-center'>
                    <Users className='mx-auto h-8 w-8 text-ui-primary' />
                    <h2 className='mt-3 text-lg font-semibold text-ui-text'>No actor profiles yet</h2>
                    <p className='mx-auto mt-1 max-w-md text-sm leading-6 text-ui-muted'>Actor profiles appear automatically when collected public intelligence identifies a named actor or group. Start with the source inventory to see what is connected.</p>
                    <Link href='/dashboard/ti/sources' className='mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas hover:opacity-90'>
                        Open source inventory
                        <ArrowRight className='h-4 w-4' />
                    </Link>
                </DashboardPanel>
            ) : (
                <div className='grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]'>
                    <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                        <PanelHeader title='Observed profiles' subtitle='Most recently observed profiles first.' />
                        <div className='divide-y divide-ui-border'>
                            {actors.map(actor => <ActorRow key={actor.id} actor={actor} />)}
                        </div>
                    </DashboardPanel>
                    <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                        <PanelHeader title='Latest evidence' subtitle='Recent retained observations linked to their source.' />
                        <div className='divide-y divide-ui-border'>
                            {recentActivity.map(event => <ActivityRow key={event.id} event={event} />)}
                        </div>
                    </DashboardPanel>
                </div>
            )}
        </DashboardPage>
    )
}

function ActorRow({ actor }: { actor: TiEnrichedActor }) {
    return (
        <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-ui-raised'>
            <div className='min-w-0'>
                <Link href={`/ti/${encodeURIComponent(actor.id)}`} className='font-semibold text-ui-text hover:text-ui-primary'>{actor.name}</Link>
                <p className='mt-1 text-xs text-ui-muted'>{actor.sourceLinks.length} source{actor.sourceLinks.length === 1 ? '' : 's'} · {actor.automationEvidence.length} evidence row{actor.automationEvidence.length === 1 ? '' : 's'}</p>
            </div>
            <div className='flex items-center gap-4 text-right'>
                <div>
                    <p className='text-[10px] font-semibold uppercase text-ui-muted'>Last update</p>
                    <p className='mt-1 text-xs font-semibold text-ui-text'>{formatTiDate(actor.lastUpdatedAt)}</p>
                </div>
                <Link href={`/ti/${encodeURIComponent(actor.id)}`} aria-label={`Open ${actor.name} profile`} className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                    Open
                    <ArrowRight className='h-3.5 w-3.5' />
                </Link>
            </div>
        </div>
    )
}

function ActivityRow({ event }: { event: TiActivityEvent }) {
    return (
        <div className='px-4 py-3'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <Link href={`/ti/${encodeURIComponent(event.actorId)}`} className='font-semibold text-ui-text hover:text-ui-primary'>{event.actorName}</Link>
                    <p className='mt-1 line-clamp-2 text-sm text-ui-muted'>{event.title}</p>
                </div>
                <span className='shrink-0 text-xs text-ui-muted'>{formatTiDate(event.happenedAt)}</span>
            </div>
            <p className='mt-2 flex items-center gap-1 text-xs text-ui-primary'><ExternalLink className='h-3 w-3' />{event.source}</p>
        </div>
    )
}

function PanelHeader({ title, subtitle }: { title: string, subtitle: string }) {
    return <div className='border-b border-ui-border px-4 py-3'><h2 className='text-base font-semibold text-ui-text'>{title}</h2><p className='mt-1 text-sm text-ui-muted'>{subtitle}</p></div>
}

function Metric({ label, value }: { label: string, value: string }) {
    return <div className='rounded-md border border-ui-border bg-ui-canvas px-3 py-2'><p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p><p className='mt-1 text-lg font-semibold text-ui-text'>{value}</p></div>
}

function StatusPill({ label, tone }: { label: string, tone: 'ok' | 'bad' }) {
    return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone === 'ok' ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'}`}>{label}</span>
}
