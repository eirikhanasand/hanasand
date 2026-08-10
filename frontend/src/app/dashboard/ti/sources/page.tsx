import Link from 'next/link'
import { ExternalLink, Plus, RefreshCcw } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { formatTiDate, getTiAdminOverview, type TiAdminSource } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../manualRunButton'

export const dynamic = 'force-dynamic'

export default async function TiSourcesPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await props.searchParams
    const cursor = Math.max(0, Number(value(params?.cursor)) || 0)
    const scope = value(params?.scope) === 'default' ? 'default' : 'global'
    const sort = value(params?.sort) || 'source'
    const direction = value(params?.dir) === 'desc' ? 'desc' : 'asc'
    const query = value(params?.q) || ''
    const family = value(params?.family) || ''
    const lifecycle = value(params?.lifecycle) || ''
    const access = value(params?.access) || ''
    const health = value(params?.health) || ''
    const output = value(params?.output) || ''
    const matches = value(params?.matches) || ''
    const tenantId = scope === 'default' ? 'default' : null
    const overview = await getTiAdminOverview(tenantId, { limit: 500, includeSamples: false, includeCandidates: true })
    const unavailable = overview.availability.failedResources.includes('source-operations')
    const filteredRows = overview.sources.filter(source => sourceMatchesFilter(source, { query, family, lifecycle, access, health, output, matches }))
    const sortedRows = [...filteredRows].sort((left, right) => compareSources(left, right, sort, direction))
    const rows = sortedRows.slice(cursor, cursor + 50)
    const filters = { query, family, lifecycle, access, health, output, matches }
    const executable = rows.filter(source => source.status === 'active')

    return <DashboardPage>
        <DashboardHeader eyebrow='Threat intelligence' title='Source inventory' description='The feeds Hanasand can collect, their current health, and the customer value they produce.' actions={executable.length ? <ManualRunButton label='Run active sources' /> : undefined} />
        <DashboardPanel className='flex flex-wrap items-center justify-between gap-3 border-ui-border bg-ui-panel p-4'>
            <div className='flex gap-2' aria-label='Source inventory scope'>
                <Link href='/dashboard/ti/sources?scope=global' className={scope === 'global' ? activeTab : tab}>Global sources</Link>
                <Link href='/dashboard/ti/sources?scope=default' className={scope === 'default' ? activeTab : tab}>Default tenant</Link>
            </div>
            <div className='text-sm text-ui-muted'>{overview.sourcePage.total} sources · {overview.sourceTotals.executable} executable</div>
        </DashboardPanel>

        {unavailable ? <Unavailable /> : !overview.sources.length ? <Empty /> : !rows.length ? <NoMatches /> : <>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
                    <div><h2 className='text-base font-semibold text-ui-text'>Production and available sources</h2><p className='mt-1 text-sm text-ui-muted'>Candidates are shown separately and are not counted as active collection feeds.</p></div>
                    <Link href='/dashboard/ti/sources?scope=global&available=true' className='inline-flex items-center gap-2 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold text-ui-text hover:bg-ui-raised'><Plus className='h-4 w-4' /> Add source</Link>
                </div>
                <form className='flex flex-wrap items-center gap-2 border-b border-ui-border p-3' action='/dashboard/ti/sources'>
                    <input type='hidden' name='scope' value={scope} /><input type='hidden' name='sort' value={sort} /><input type='hidden' name='dir' value={direction} />
                    <input name='q' defaultValue={query} placeholder='Search sources' className='h-8 min-w-48 rounded-md border border-ui-border bg-ui-canvas px-2.5 text-xs text-ui-text outline-none' />
                    <FilterSelect name='family' value={family} label='Family' options={uniqueValues(overview.sources.map(source => source.family))} />
                    <FilterSelect name='lifecycle' value={lifecycle} label='Lifecycle' options={['active', 'candidate', 'review', 'paused']} />
                    <FilterSelect name='access' value={access} label='Access' options={uniqueValues(overview.sources.map(source => source.accessMethod))} />
                    <FilterSelect name='health' value={health} label='Health' options={['healthy', 'stale', 'failed', 'not observed']} />
                    <FilterSelect name='output' value={output} label='Useful output' options={['yes', 'no']} />
                    <FilterSelect name='matches' value={matches} label='Customer matches' options={['yes', 'no']} />
                    <button type='submit' className='h-8 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas'>Apply</button>
                    {query || family || lifecycle || access || health || output || matches ? <Link href={`/dashboard/ti/sources?scope=${scope}`} className='text-xs font-semibold text-ui-primary underline'>Clear</Link> : null}
                </form>
                <div className='overflow-x-auto'>
                    <div className='min-w-[78rem]'>
                        <div className='grid grid-cols-[1.55fr_0.8fr_0.85fr_0.85fr_0.8fr_0.8fr_1.35fr] gap-3 border-b border-ui-border bg-ui-canvas px-4 py-2 text-[11px] font-semibold uppercase text-ui-muted'><SortHeader label='Source' field='source' scope={scope} sort={sort} direction={direction} filters={filters} /><SortHeader label='Access' field='access' scope={scope} sort={sort} direction={direction} filters={filters} /><SortHeader label='Status' field='status' scope={scope} sort={sort} direction={direction} filters={filters} /><SortHeader label='Last content' field='content' scope={scope} sort={sort} direction={direction} filters={filters} /><SortHeader label='Useful output' field='useful' scope={scope} sort={sort} direction={direction} filters={filters} /><SortHeader label='Matches' field='matches' scope={scope} sort={sort} direction={direction} filters={filters} /><span>Actions</span></div>
                        {rows.map(source => <SourceRow key={source.id} source={source} scope={scope} />)}
                    </div>
                </div>
            </DashboardPanel>
            <nav className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm' aria-label='Source inventory pages'>
                <span className='text-ui-muted'>{cursor + 1}–{Math.min(cursor + rows.length, filteredRows.length)} of {filteredRows.length}</span>
                <div className='flex gap-2'>{cursor > 0 ? <Link href={pageHref(scope, sort, direction, Math.max(0, cursor - 50), { query, family, lifecycle, access, health, output, matches })} className={tab}>Previous</Link> : null}{cursor + rows.length < filteredRows.length ? <Link href={pageHref(scope, sort, direction, cursor + 50, { query, family, lifecycle, access, health, output, matches })} className={tab}>Next</Link> : null}</div>
            </nav>
        </>}
    </DashboardPage>
}

function SourceRow({ source, scope }: { source: TiAdminSource, scope: string }) {
    const candidate = source.status !== 'active'
    const darkweb = /dark|tor|onion/i.test(`${source.family} ${source.accessMethod} ${source.url}`)
    return <div className='grid grid-cols-[1.55fr_0.8fr_0.85fr_0.85fr_0.8fr_0.8fr_1.35fr] gap-3 border-b border-ui-border px-4 py-3 text-sm last:border-b-0 hover:bg-ui-panel'>
        <div className='min-w-0'><Link href={`/dashboard/ti/sources/${source.id}?scope=${scope}`} className='font-semibold text-ui-text hover:text-ui-primary'>{source.name}</Link><p className='mt-1 truncate text-xs text-ui-muted'>{source.family.replaceAll('_', ' ')} · {source.owner}</p>{candidate ? <span className='mt-2 inline-flex rounded-full border border-ui-warning/35 bg-ui-warning/10 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'>Available to activate</span> : null}</div>
        <div><p className='font-semibold text-ui-text'>{darkweb ? 'Dark web' : source.accessMethod || 'Clearweb'}</p><p className='mt-1 text-xs text-ui-muted'>{source.risk} access</p></div>
        <Status source={source} />
        <div><p className='font-semibold text-ui-text'>{relative(source.lastContentAt)}</p><p className='mt-1 text-xs text-ui-muted'>{formatTiDate(source.lastContentAt)}</p></div>
        <div><p className='font-semibold text-ui-text'>{source.productiveCycleCount} cycles</p><p className='mt-1 text-xs text-ui-muted'>{source.retainedEvidenceCount} captures</p></div>
        <div><p className='font-semibold text-ui-text'>{source.customerMatchCount}</p><p className='mt-1 text-xs text-ui-muted'>customer matches</p></div>
        <div className='flex flex-nowrap items-center gap-1.5 whitespace-nowrap'>{!candidate ? <ManualRunButton compact sourceId={source.id} label='Run' queries={source.domains} /> : null}{source.url && !darkweb ? <a href={source.url} target='_blank' rel='noopener noreferrer' className='inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Open <ExternalLink className='h-3 w-3' /></a> : <Link href='/browser' className='inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Preview</Link>}<Link href={`/dashboard/ti/sources/${source.id}?scope=${scope}`} className='inline-flex h-8 shrink-0 items-center rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Details</Link></div>
    </div>
}

function Status({ source }: { source: TiAdminSource }) {
    const stale = source.status === 'active' && source.lastRunAt && Date.now() - Date.parse(source.lastRunAt) > source.cadenceMinutes * 120_000
    const label = source.status === 'active' ? stale ? 'Stale' : 'Active' : source.status
    return <div><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${stale ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning' : source.status === 'active' ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-border text-ui-muted'}`}>{label}</span><p className='mt-1 text-xs text-ui-muted'>{source.healthState}</p></div>
}

function SortHeader({ label, field, scope, sort, direction, filters }: { label: string, field: string, scope: string, sort: string, direction: string, filters: Record<string, string> }) {
    const nextDirection = sort === field && direction === 'asc' ? 'desc' : 'asc'
    return <Link href={pageHref(scope, field, nextDirection, 0, filters)} className='inline-flex items-center gap-1 whitespace-nowrap hover:text-ui-text' title={`Sort by ${label}`}><span>{label}</span><span className='inline-flex flex-col text-[8px] leading-[7px]'><span className={sort === field && direction === 'asc' ? 'text-ui-primary' : 'text-ui-muted/45'}>▲</span><span className={sort === field && direction === 'desc' ? 'text-ui-primary' : 'text-ui-muted/45'}>▼</span></span></Link>
}

function pageHref(scope: string, sort: string, direction: string, cursor: number, filters: Record<string, string> = {}) {
    const params = new URLSearchParams({ scope, sort, dir: direction, cursor: String(cursor) })
    for (const [key, item] of Object.entries(filters)) if (item) params.set(key, item)
    return `/dashboard/ti/sources?${params.toString()}`
}

function FilterSelect({ name, value, label, options }: { name: string, value: string, label: string, options: string[] }) {
    return <select name={name} defaultValue={value} aria-label={label} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text outline-none'><option value=''>{label}</option>{options.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select>
}

function uniqueValues(values: string[]) { return [...new Set(values.filter(Boolean))].sort() }

function sourceMatchesFilter(source: TiAdminSource, filters: { query: string, family: string, lifecycle: string, access: string, health: string, output: string, matches: string }) {
    const haystack = `${source.name} ${source.family} ${source.owner}`.toLowerCase()
    const sourceHealth = source.healthState.toLowerCase()
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
        && (!filters.family || source.family === filters.family)
        && (!filters.lifecycle || source.status === filters.lifecycle)
        && (!filters.access || source.accessMethod === filters.access)
        && (!filters.health || sourceHealth.includes(filters.health))
        && (!filters.output || (filters.output === 'yes' ? source.productiveCycleCount > 0 : source.productiveCycleCount === 0))
        && (!filters.matches || (filters.matches === 'yes' ? source.customerMatchCount > 0 : source.customerMatchCount === 0))
}

function compareSources(left: TiAdminSource, right: TiAdminSource, field: string, direction: string) {
    const rank = (source: TiAdminSource) => field === 'status' ? ({ active: 0, candidate: 1, review: 2, paused: 3 }[source.status] ?? 4) : field === 'useful' ? source.lastUsefulAt : field === 'content' ? source.lastContentAt : field === 'matches' ? source.customerMatchCount : field === 'access' ? source.accessMethod : source.name
    const a = rank(left)
    const b = rank(right)
    const dateFields = field === 'useful' || field === 'content'
    const result = dateFields ? (Date.parse(String(a || '')) || 0) - (Date.parse(String(b || '')) || 0) : typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
    return (direction === 'desc' ? -1 : 1) * (result || left.name.localeCompare(right.name))
}

function Empty() { return <DashboardPanel className='grid min-h-112 place-items-center border-ui-border bg-ui-panel p-8 text-center'><div className='max-w-md'><div className='mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-ui-border bg-ui-canvas text-ui-primary'><Plus /></div><h2 className='mt-5 text-2xl font-semibold text-ui-text'>Add your first intelligence source</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>Connect a public feed, clearweb source, darkweb metadata source, or Telegram feed to begin collection.</p><div className='mt-5 flex justify-center gap-2'><Link href='/dashboard/ti/sources?available=true' className='rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas'>Add source</Link><Link href='/dashboard/ti/control' className={tab}>Browse available sources</Link></div></div></DashboardPanel> }
function NoMatches() { return <DashboardPanel className='grid min-h-80 place-items-center border-ui-border bg-ui-panel p-8 text-center'><div><h2 className='text-xl font-semibold text-ui-text'>No sources match these filters</h2><p className='mt-2 text-sm text-ui-muted'>Clear a filter to return to the full source inventory.</p><Link href='/dashboard/ti/sources' className='mt-4 inline-flex text-sm font-semibold text-ui-primary underline'>Clear filters</Link></div></DashboardPanel> }
function Unavailable() { return <DashboardPanel className='grid min-h-80 place-items-center border-ui-warning/40 bg-ui-panel p-8 text-center'><div><RefreshCcw className='mx-auto h-8 w-8 text-ui-warning' /><h2 className='mt-4 text-xl font-semibold text-ui-text'>Source inventory is temporarily unavailable</h2><p className='mt-2 text-sm text-ui-muted'>The source service did not return an inventory. No zero-source result was inferred.</p><Link href='/dashboard/ti/sources' className='mt-5 inline-flex rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas'>Retry</Link></div></DashboardPanel> }
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input }
function relative(value: string) { const age = Date.now() - Date.parse(value); if (!Number.isFinite(age)) return 'not recorded'; const minutes = Math.max(0, Math.round(age / 60_000)); return minutes < 60 ? `${minutes}m ago` : minutes < 2_880 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1_440)}d ago` }
const tab = 'rounded-md border border-ui-border px-3 py-2 text-sm font-semibold text-ui-text hover:bg-ui-raised'
const activeTab = 'rounded-md bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas'
