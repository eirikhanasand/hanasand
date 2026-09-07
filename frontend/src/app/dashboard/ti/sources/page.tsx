import { pageNumber } from '@/utils/pagination'
import PageNavigation from '@/components/dashboard/page-navigation'
import Link from 'next/link'
import { Plus, RefreshCcw } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiAdminOverview } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../manualRunButton'
import SourceRow from './sourceRow'

export const dynamic = 'force-dynamic'

export default async function TiSourcesPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await props.searchParams
    const page = pageNumber(params?.page)
    const scope = 'global'
    const sort = value(params?.sort) || 'source'
    const direction = value(params?.dir) === 'desc' ? 'desc' : 'asc'
    const query = value(params?.q) || ''
    const family = value(params?.family) || ''
    const lifecycle = value(params?.lifecycle) || ''
    const access = value(params?.access) || ''
    const health = value(params?.health) || ''
    const output = value(params?.output) || ''
    const matches = value(params?.matches) || ''
    const overview = await getTiAdminOverview(null, { page, limit: 50, includeSamples: false, includeCandidates: true, query, family, lifecycle, access, health, output, matches, sort, direction })
    const unavailable = overview.availability.failedResources.includes('source-operations')
    const rows = overview.sources
    const filters = { q: query, family, lifecycle, access, health, output, matches }
    const executable = rows.filter(source => source.status === 'active')

    return <DashboardPage>
        <DashboardHeader eyebrow='Threat intelligence' title='Source inventory' description='The feeds Hanasand can collect, their current health, and the customer value they produce.' actions={executable.length ? <ManualRunButton label='Run active sources' /> : undefined} />
        <DashboardPanel className='flex flex-wrap items-center justify-between gap-3 border-ui-border bg-ui-panel p-4'>
            <div className='text-sm text-ui-muted'>{overview.sourcePage.total} sources · {overview.sourceTotals.executable} executable</div>
        </DashboardPanel>

        {unavailable ? <Unavailable /> : <>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
                    <div><h2 className='text-base font-semibold text-ui-text'>Active and inactive sources</h2><p className='mt-1 text-sm text-ui-muted'>Activate a source to include it in collection, or deactivate it to stop collection.</p></div>
                    <Link href='/ti/sources?scope=global&available=true' className='inline-flex items-center gap-2 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold text-ui-text hover:bg-ui-raised'><Plus className='h-4 w-4' /> Add source</Link>
                </div>
                <form className='flex flex-wrap items-center gap-2 border-b border-ui-border p-3' action='/ti/sources'>
                    <input type='hidden' name='scope' value={scope} /><input type='hidden' name='sort' value={sort} /><input type='hidden' name='dir' value={direction} />
                    <input name='q' defaultValue={query} placeholder='Search sources' className='h-8 min-w-48 rounded-md border border-ui-border bg-ui-canvas px-2.5 text-xs text-ui-text outline-none' />
                    <FilterSelect name='family' value={family} label='Family' options={['rss', 'web', 'telegram_public', 'darkweb_metadata']} />
                    <FilterSelect name='lifecycle' value={lifecycle} label='Status' options={['active', 'candidate', 'review', 'paused']} />
                    <FilterSelect name='access' value={access} label='Access' options={['public_http', 'public_rss', 'public_telegram', 'tor_metadata']} />
                    <FilterSelect name='health' value={health} label='Health' options={['healthy', 'stale', 'failed', 'not observed']} />
                    <FilterSelect name='output' value={output} label='Useful output' options={['yes', 'no']} />
                    <FilterSelect name='matches' value={matches} label='Matches' options={['yes', 'no']} />
                    <button type='submit' className='h-8 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas'>Apply</button>
                    {query || family || lifecycle || access || health || output || matches ? <Link href={`/ti/sources?scope=${scope}`} className='text-xs font-semibold text-ui-primary underline'>Clear</Link> : null}
                </form>
                <div className='overflow-x-auto'>
                    <div className='min-w-[78rem]'>
                        <div className='grid grid-cols-[1.55fr_0.8fr_0.85fr_0.85fr_0.8fr_0.8fr_1.35fr] gap-3 border-b border-ui-border bg-ui-canvas px-4 py-2 text-[11px] font-semibold uppercase text-ui-muted'><SortHeader label='Source' field='source' scope={scope} sort={sort} direction={direction} filters={filters} /><SortHeader label='Access' field='access' scope={scope} sort={sort} direction={direction} filters={filters} /><SortHeader label='Status' field='status' scope={scope} sort={sort} direction={direction} filters={filters} /><SortHeader label='Last useful output' field='useful' scope={scope} sort={sort} direction={direction} filters={filters} /><span title='Collection runs that produced useful output'>Useful output count</span><SortHeader label='Matches' field='matches' scope={scope} sort={sort} direction={direction} filters={filters} /><span>Actions</span></div>
                        {!rows.length ? <p className='p-4 text-sm text-ui-muted'>No sources on this page. Change the filters or return to the previous page.</p> : null}
                        {rows.map(source => <SourceRow key={source.id} source={source} scope={scope} />)}
                    </div>
                </div>
            </DashboardPanel>
            <PageNavigation page={page} total={overview.sourcePage.total} hasNext={page * 50 < overview.sourcePage.total} href={next => pageHref(scope, sort, direction, next, filters)} label='Source inventory pages' />
        </>}
    </DashboardPage>
}

function SortHeader({ label, field, scope, sort, direction, filters }: { label: string, field: string, scope: string, sort: string, direction: string, filters: Record<string, string> }) {
    const nextDirection = sort === field && direction === 'asc' ? 'desc' : 'asc'
    return <Link href={pageHref(scope, field, nextDirection, 1, filters)} className='inline-flex items-center gap-1 whitespace-nowrap hover:text-ui-text' title={`Sort by ${label}`}><span>{label}</span><span className='inline-flex flex-col text-[8px] leading-[7px]'><span className={sort === field && direction === 'asc' ? 'text-ui-primary' : 'text-ui-muted/45'}>▲</span><span className={sort === field && direction === 'desc' ? 'text-ui-primary' : 'text-ui-muted/45'}>▼</span></span></Link>
}

function pageHref(scope: string, sort: string, direction: string, page: number, filters: Record<string, string> = {}) {
    const params = new URLSearchParams({ scope, sort, dir: direction, page: String(page) })
    for (const [key, item] of Object.entries(filters)) if (item) params.set(key, item)
    return `/ti/sources?${params.toString()}`
}

function FilterSelect({ name, value, label, options }: { name: string, value: string, label: string, options: string[] }) {
    return <select name={name} defaultValue={value} aria-label={label} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text outline-none'><option value=''>{label}</option>{options.map(option => <option key={option} value={option}>{option === 'candidate' ? 'Inactive' : option.replaceAll('_', ' ')}</option>)}</select>
}

function Unavailable() { return <DashboardPanel className='grid min-h-80 place-items-center border-ui-warning/40 bg-ui-panel p-8 text-center'><div><RefreshCcw className='mx-auto h-8 w-8 text-ui-warning' /><h2 className='mt-4 text-xl font-semibold text-ui-text'>Source inventory is temporarily unavailable</h2><p className='mt-2 text-sm text-ui-muted'>The source service did not return an inventory. No zero-source result was inferred.</p><Link href='/ti/sources' className='mt-5 inline-flex rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas'>Retry</Link></div></DashboardPanel> }
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input }
