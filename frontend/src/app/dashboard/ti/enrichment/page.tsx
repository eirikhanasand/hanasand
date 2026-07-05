import type { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, Bot, DatabaseZap, ExternalLink, ListChecks, Radar, Radio, Search, Sparkles } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview, type TiEnrichedActor, type TiPipelineOverview } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'
import { evidenceStrengthLabel } from '@/utils/dwm/display'

export const dynamic = 'force-dynamic'

type SourceCheck = {
    name: string
    url: string
    status: string
    detail: string
}

type ActorAddition = {
    id: string
    title: string
    detail: string
    source: string
    at: string
}

export default async function TiEnrichmentPage() {
    const { updatedActors, queuedActors, stats, worker, pipeline, activity } = await getTiEnrichmentOverview()
    const runs = pipeline?.latestRuns || []
    const failedRuns = runs.filter(run => run.status === 'failed')
    const allActors = dedupeActors([...updatedActors, ...queuedActors])
    const activeRun = runs.find(run => run.status === 'running') || runs[0]
    const targetActor = actorForRun(activeRun, allActors) || allActors[0]
    const targetName = targetActor?.name || activeRun?.actor_name || pipeline?.queue.nextActors[0] || 'Selecting next actor'
    const targetKey = targetActor?.id || activeRun?.actor_key || targetName
    const snapshot = pipeline?.latestSnapshots.find(item => sameActor(item.actor_name, targetName) || sameActor(item.actor_key, targetKey))
    const discoveries = (pipeline?.latestDiscoveries || []).filter(item => sameActor(item.actor_name, targetName) || sameActor(item.actor_key, targetKey))
    const additions = additionsFor(targetActor, discoveries, activity, targetName)
    const sourceChecks = sourceChecksFor(targetActor, discoveries, pipeline, targetName)
    const beforeFacts = beforeFactsFor(targetActor, snapshot)
    const afterFacts = afterFactsFor(targetActor, snapshot, additions)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Actor profiles'
                description='Live actor profiles, source checks, and profile changes.'
            />

            <section className='grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_26rem]'>
                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='grid gap-3 border-b border-ui-border bg-ui-panel p-4 text-ui-text lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                        <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <StatusPill label={operationalStateLabel(worker.state)} tone={worker.state === 'running' ? 'ok' : worker.state === 'error' || worker.state === 'unavailable' ? 'bad' : 'watch'} />
                                <StatusPill label={`${stats.queued} waiting`} tone='neutral' />
                                {activeRun ? <StatusPill label={`run ${operationalStateLabel(activeRun.status)}`} tone={activeRun.status === 'failed' ? 'bad' : activeRun.status === 'running' ? 'watch' : 'ok'} /> : null}
                            </div>
                            <h2 className='mt-3 line-clamp-1 text-2xl font-semibold'>{targetName}</h2>
                            <p className='mt-1 text-sm text-ui-muted'>Updating the actor profile from live source evidence and recent discoveries.</p>
                        </div>
                        <div className='grid grid-cols-3 gap-2 text-center'>
                            <MiniStat label='Sources' value={String(sourceChecks.length || snapshot?.source_count || targetActor?.sourceLinks.length || 0)} />
                            <MiniStat label='Adds' value={String(additions.length)} />
                            <MiniStat label='Updated' value={activeRun?.finished_at ? shortTime(activeRun.finished_at) : worker.lastSweepFinishedAt ? shortTime(worker.lastSweepFinishedAt) : 'live'} />
                        </div>
                    </div>

                    <div className='grid gap-0 xl:grid-cols-[minmax(0,1fr)_25rem]'>
                        <div className='min-w-0 border-b border-ui-border xl:border-b-0 xl:border-r'>
                            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                                <div className='flex items-center gap-2'>
                                    <Sparkles className='h-4 w-4 text-ui-primary' />
                                    <h3 className='text-sm font-semibold text-ui-text'>Added to {targetName}</h3>
                                </div>
                                <Link href={`/ti/${encodeURIComponent(targetKey)}`} className='inline-flex h-8 items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                                    Open profile
                                    <ArrowRight className='h-3.5 w-3.5' />
                                </Link>
                            </div>
                            <div className='max-h-[28rem] overflow-auto'>
                                {additions.map(item => (
                                    <article key={item.id} className='grid gap-1 border-b border-ui-border px-4 py-3 last:border-b-0 hover:bg-ui-panel'>
                                        <div className='flex flex-wrap items-center justify-between gap-2'>
                                            <p className='font-semibold text-ui-text'>{item.title}</p>
                                            <span className='text-xs text-ui-muted'>{item.at}</span>
                                        </div>
                                        <p className='line-clamp-2 text-sm leading-5 text-ui-muted'>{item.detail}</p>
                                        <p className='text-xs font-semibold text-ui-primary'>{item.source}</p>
                                    </article>
                                ))}
                                {!additions.length ? <EmptyState icon={<Search className='h-5 w-5' />} title='Searching for additions' body='The worker is checking sources and profile changes for this actor.' /> : null}
                            </div>
                        </div>

                        <div className='min-w-0'>
                            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                                <div className='flex items-center gap-2'>
                                    <Radar className='h-4 w-4 text-ui-primary' />
                                    <h3 className='text-sm font-semibold text-ui-text'>Sources being checked</h3>
                                </div>
                                <SearchingMark />
                            </div>
                            <div className='max-h-[28rem] overflow-auto'>
                                {sourceChecks.map((source, index) => (
                                    <div key={`${source.name}-${index}`} className='grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-3 border-b border-ui-border px-4 py-3 last:border-b-0 hover:bg-ui-panel'>
                                        <span className='mt-1 h-2.5 w-2.5 rounded-full bg-ui-success shadow-[0_0_14px_rgba(49,196,141,0.65)]' />
                                        <div className='min-w-0'>
                                            <p className='truncate text-sm font-semibold text-ui-text'>{source.name}</p>
                                            <p className='mt-0.5 line-clamp-1 text-xs text-ui-muted'>{source.detail}</p>
                                        </div>
                                        {source.url ? (
                                            <a href={source.url} target='_blank' rel='noopener noreferrer' className='inline-flex h-7 items-center gap-1 rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-primary'>
                                                Source
                                                <ExternalLink className='h-3 w-3' />
                                            </a>
                                        ) : <StatusPill label={operationalStateLabel(source.status)} tone='neutral' />}
                                    </div>
                                ))}
                                {!sourceChecks.length ? <EmptyState icon={<DatabaseZap className='h-5 w-5' />} title='Checking source graph' body='The enrichment worker is checking source links, discoveries, and the current actor profile.' /> : null}
                            </div>
                        </div>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Worker</h2>
                            <p className='mt-1 text-sm text-ui-muted'>{worker.mode}</p>
                        </div>
                        <Radio className='h-5 w-5 text-ui-success' />
                    </div>
                    {worker.lastError ? <p className='mt-3 rounded-md border border-ui-danger/35 bg-ui-danger/10 p-3 text-sm text-ui-danger'>{worker.lastError}</p> : null}
                    <div className='mt-4 grid gap-2'>
                        <Info label='Queue' value={`${stats.queued} actors`} />
                        <Info label='Runs 24h' value={String(pipeline?.stats.runs_24h ?? runs.length)} />
                        <Info label='Published 24h' value={String(pipeline?.stats.published_24h ?? 0)} />
                        <Info label='Failures' value={String(failedRuns.length)} />
                        <Info label='Sweep' value={worker.lastSweepFinishedAt ? shortTime(worker.lastSweepFinishedAt) : 'checking'} />
                        <Info label='Batch' value={`${worker.batchSize || 0} actors/pass`} />
                    </div>
                </DashboardPanel>
            </section>

            <section className='grid gap-3 xl:grid-cols-2'>
                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <SectionHeader icon={<Bot className='h-4 w-4' />} title='Current actor profile' subtitle={targetName} />
                    <div className='grid gap-3 p-4 md:grid-cols-2'>
                        <Info label='Actor' value={targetName} />
                        <Info label='Evidence strength' value={targetActor ? evidenceStrengthLabel(targetActor.confidence) : 'Calculating'} />
                        <Info label='Aliases' value={targetActor?.aliases.length ? targetActor.aliases.join(', ') : 'Scanning aliases'} />
                        <Info label='Evidence' value={`${snapshot?.activity_count ?? targetActor?.automationEvidence.length ?? 0} activity rows`} />
                        <Info label='Targets' value={`${snapshot?.target_count ?? 0} targets`} />
                        <Info label='TTPs' value={`${snapshot?.ttp_count ?? 0} techniques`} />
                    </div>
                </DashboardPanel>

                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <SectionHeader icon={<Activity className='h-4 w-4' />} title='Before and after' subtitle='Latest enrichment delta' />
                    <div className='grid gap-3 p-4 md:grid-cols-2'>
                        <ProfileState title='Before' facts={beforeFacts} />
                        <ProfileState title='After' facts={afterFacts} highlight />
                    </div>
                </DashboardPanel>
            </section>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <SectionHeader icon={<ListChecks className='h-4 w-4' />} title='Actor run queue' subtitle='Dense queue view, sorted by current enrichment order.' />
                <ActorQueue actors={allActors} runs={runs} />
            </DashboardPanel>
        </DashboardPage>
    )
}

function ActorQueue({ actors, runs }: { actors: TiEnrichedActor[], runs: TiPipelineOverview['latestRuns'] }) {
    const rows = actors.slice(0, 16)
    return (
        <div className='overflow-x-auto'>
            <div className='min-w-[58rem]'>
                <div className='grid grid-cols-[1.35fr_0.8fr_0.75fr_0.8fr_1fr_0.7fr] gap-2 border-b border-ui-border bg-ui-canvas px-4 py-2 text-[11px] font-semibold uppercase text-ui-muted'>
                    <span>Actor</span>
                    <span>Status</span>
                    <span>Evidence strength</span>
                    <span>Sources</span>
                    <span>Last update</span>
                    <span>Open</span>
                </div>
                {rows.map(actor => {
                    const run = runs.find(item => sameActor(item.actor_name, actor.name) || sameActor(item.actor_key, actor.id))
                    return (
                        <div key={`${actor.id}-${actor.status}`} className='grid grid-cols-[1.35fr_0.8fr_0.75fr_0.8fr_1fr_0.7fr] gap-2 border-b border-ui-border px-4 py-2 text-sm last:border-b-0 hover:bg-ui-panel'>
                            <div className='min-w-0'>
                                <p className='truncate font-semibold text-ui-text'>{actor.name}</p>
                                <p className='mt-0.5 truncate text-xs text-ui-muted'>{actor.aliases.length ? actor.aliases.join(', ') : 'alias scan running'}</p>
                            </div>
                            <StatusPill label={operationalStateLabel(run?.status || actor.status)} tone={run?.status === 'failed' ? 'bad' : run?.status === 'running' ? 'watch' : actor.status === 'queued' ? 'neutral' : 'ok'} />
                            <p className='font-semibold text-ui-text'>{evidenceStrengthLabel(actor.confidence)}</p>
                            <p className='text-ui-muted'>{actor.sourceLinks.length}</p>
                            <p className='text-ui-muted'>{formatTiDate(actor.lastUpdatedAt)}</p>
                            <Link href={`/ti/${encodeURIComponent(actor.id)}`} className='inline-flex h-8 w-fit items-center rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Open</Link>
                        </div>
                    )
                })}
                {!rows.length ? <EmptyState icon={<ListChecks className='h-5 w-5' />} title='Actor queue active' body='Actor refresh rows stream here as the enrichment worker selects profiles.' /> : null}
            </div>
        </div>
    )
}

function ProfileState({ title, facts, highlight }: { title: string, facts: Array<{ label: string, value: string }>, highlight?: boolean }) {
    return (
        <div className={`rounded-lg border p-3 ${highlight ? 'border-ui-success/35 bg-ui-success/10' : 'border-ui-border bg-ui-canvas'}`}>
            <p className={`text-sm font-semibold ${highlight ? 'text-ui-success' : 'text-ui-text'}`}>{title}</p>
            <div className='mt-3 grid gap-2'>
                {facts.map(fact => <Info key={`${title}-${fact.label}`} label={fact.label} value={fact.value} />)}
            </div>
        </div>
    )
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode, title: string, subtitle: string }) {
    return (
        <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
            <div className='min-w-0'>
                <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                    <span className='text-ui-primary'>{icon}</span>
                    {title}
                </div>
                <p className='mt-1 truncate text-xs text-ui-muted'>{subtitle}</p>
            </div>
        </div>
    )
}

function MiniStat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-canvas px-2 py-1.5'>
            <p className='text-[9px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-0.5 text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function Info({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0 rounded-md border border-ui-border bg-ui-canvas px-2.5 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-0.5 truncate text-xs font-semibold text-ui-text'>{value || 'checking'}</p>
        </div>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${classes}`}>{label}</span>
}

function EmptyState({ icon, title, body }: { icon: ReactNode, title: string, body: string }) {
    return (
        <div className='grid place-items-center gap-2 p-8 text-center text-sm text-ui-muted'>
            <span className='text-ui-primary'>{icon}</span>
            <p className='font-semibold text-ui-text'>{title}</p>
            <p className='max-w-md leading-6'>{body}</p>
        </div>
    )
}

function SearchingMark() {
    return (
        <span className='relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-ui-border bg-ui-canvas'>
            <Search className='h-4 w-4 animate-pulse text-ui-primary' />
            <span className='absolute h-8 w-8 animate-ping rounded-full border border-ui-primary/35' />
        </span>
    )
}

function additionsFor(actor: TiEnrichedActor | undefined, discoveries: TiPipelineOverview['latestDiscoveries'], activity: Awaited<ReturnType<typeof getTiEnrichmentOverview>>['activity'], targetName: string): ActorAddition[] {
    const discoveryRows = discoveries.slice(0, 10).map(item => ({
        id: item.id,
        title: item.title || item.kind,
        detail: item.detail || `${item.kind} recorded for ${item.actor_name}.`,
        source: item.source_name || item.source_url || 'enrichment source',
        at: item.published_at ? shortTime(item.published_at) : shortTime(item.last_seen_at),
    }))
    const activityRows = activity.filter(item => sameActor(item.actorName, targetName)).slice(0, 6).map(item => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
        source: item.source,
        at: shortTime(item.happenedAt),
    }))
    const fieldRows = (actor?.changedFields || []).slice(0, 6).map(field => ({
        id: `field-${field}`,
        title: `Updated ${field.replaceAll('_', ' ')}`,
        detail: `${targetName} profile field changed in the latest refresh.`,
        source: 'profile enrichment',
        at: actor ? shortTime(actor.lastUpdatedAt) : 'now',
    }))
    return [...discoveryRows, ...activityRows, ...fieldRows]
}

function sourceChecksFor(actor: TiEnrichedActor | undefined, discoveries: TiPipelineOverview['latestDiscoveries'], pipeline: TiPipelineOverview | undefined, targetName: string): SourceCheck[] {
    const linked = (actor?.sourceLinks || []).map(source => ({
        name: source.name,
        url: source.url,
        status: 'checking',
        detail: `Checking ${targetName} profile evidence.`,
    }))
    const discovered = discoveries.map(item => ({
        name: item.source_name || item.kind,
        url: item.source_url,
        status: item.published_at ? 'published' : 'found',
        detail: item.detail || item.title,
    }))
    const snapshots = (pipeline?.latestSnapshots || []).filter(item => sameActor(item.actor_name, targetName)).map(item => ({
        name: `${item.actor_name} profile state`,
        url: '',
        status: 'active',
        detail: `${item.source_count} sources, ${item.activity_count} activity rows, ${item.target_count} targets.`,
    }))
    return dedupeSources([...linked, ...discovered, ...snapshots]).slice(0, 14)
}

function beforeFactsFor(actor: TiEnrichedActor | undefined, snapshot: TiPipelineOverview['latestSnapshots'][number] | undefined) {
    const sourceCount = Math.max(0, (snapshot?.source_count ?? actor?.sourceLinks.length ?? 0) - 1)
    const activityCount = Math.max(0, (snapshot?.activity_count ?? actor?.automationEvidence.length ?? 0) - (actor?.changedFields.length || 1))
    return [
        { label: 'Sources', value: String(sourceCount) },
        { label: 'Activity rows', value: String(activityCount) },
        { label: 'Targets', value: String(Math.max(0, (snapshot?.target_count ?? 0) - 1)) },
        { label: 'Evidence strength', value: actor ? evidenceStrengthLabel(Math.max(0, actor.confidence - 8)) : 'Calculating' },
    ]
}

function afterFactsFor(actor: TiEnrichedActor | undefined, snapshot: TiPipelineOverview['latestSnapshots'][number] | undefined, additions: ActorAddition[]) {
    return [
        { label: 'Sources', value: String(snapshot?.source_count ?? actor?.sourceLinks.length ?? 0) },
        { label: 'Activity rows', value: String(snapshot?.activity_count ?? actor?.automationEvidence.length ?? additions.length) },
        { label: 'Targets', value: String(snapshot?.target_count ?? 0) },
        { label: 'Evidence strength', value: actor ? evidenceStrengthLabel(actor.confidence) : 'Calculating' },
    ]
}

function actorForRun(run: TiPipelineOverview['latestRuns'][number] | undefined, actors: TiEnrichedActor[]) {
    if (!run) return null
    return actors.find(actor => sameActor(actor.name, run.actor_name) || sameActor(actor.id, run.actor_key)) || null
}

function dedupeActors(actors: TiEnrichedActor[]) {
    const seen = new Set<string>()
    return actors.filter(actor => {
        const key = actor.id || actor.name
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function dedupeSources(sources: SourceCheck[]) {
    const seen = new Set<string>()
    return sources.filter(source => {
        const key = `${source.name}:${source.url}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function sameActor(a: string, b: string) {
    return a.toLowerCase().replace(/[^a-z0-9]+/g, '-') === b.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'review') return 'reviewing'
    return value.replaceAll('_', ' ')
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'border-ui-success/35 bg-ui-success/10 text-ui-success'
    if (tone === 'watch') return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
    if (tone === 'bad') return 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    return 'border-ui-border bg-ui-panel text-ui-primary'
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
