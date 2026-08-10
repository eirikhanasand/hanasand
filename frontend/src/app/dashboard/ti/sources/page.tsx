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
    const tenantId = scope === 'default' ? 'default' : null
    const overview = await getTiAdminOverview(tenantId, { cursor, limit: 50, includeSamples: false, includeCandidates: true })
    const unavailable = overview.availability.failedResources.includes('source-operations')
    const rows = overview.sources
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

        {unavailable ? <Unavailable /> : rows.length === 0 ? <Empty /> : <>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
                    <div><h2 className='text-base font-semibold text-ui-text'>Production and available sources</h2><p className='mt-1 text-sm text-ui-muted'>Candidates are shown separately and are not counted as active collection feeds.</p></div>
                    <Link href='/dashboard/ti/sources?scope=global&available=true' className='inline-flex items-center gap-2 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold text-ui-text hover:bg-ui-raised'><Plus className='h-4 w-4' /> Add source</Link>
                </div>
                <div className='overflow-x-auto'>
                    <div className='min-w-[78rem]'>
                        <div className='grid grid-cols-[1.55fr_0.8fr_0.85fr_0.85fr_0.8fr_0.8fr_1.15fr] gap-3 border-b border-ui-border bg-ui-canvas px-4 py-2 text-[11px] font-semibold uppercase text-ui-muted'><span>Source</span><span>Access</span><span>Status</span><span>Last content</span><span>Useful output</span><span>Matches</span><span>Actions</span></div>
                        {rows.map(source => <SourceRow key={source.id} source={source} scope={scope} />)}
                    </div>
                </div>
            </DashboardPanel>
            <nav className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm' aria-label='Source inventory pages'>
                <span className='text-ui-muted'>{cursor + 1}–{Math.min(cursor + rows.length, overview.sourcePage.total)} of {overview.sourcePage.total}</span>
                <div className='flex gap-2'>{cursor > 0 ? <Link href={`/dashboard/ti/sources?scope=${scope}&cursor=${Math.max(0, cursor - overview.sourcePage.limit)}`} className={tab}>Previous</Link> : null}{overview.sourcePage.nextCursor ? <Link href={`/dashboard/ti/sources?scope=${scope}&cursor=${overview.sourcePage.nextCursor}`} className={tab}>Next</Link> : null}</div>
            </nav>
        </>}
    </DashboardPage>
}

function SourceRow({ source, scope }: { source: TiAdminSource, scope: string }) {
    const candidate = source.status !== 'active'
    const darkweb = /dark|tor|onion/i.test(`${source.family} ${source.accessMethod} ${source.url}`)
    return <div className='grid grid-cols-[1.55fr_0.8fr_0.85fr_0.85fr_0.8fr_0.8fr_1.15fr] gap-3 border-b border-ui-border px-4 py-3 text-sm last:border-b-0 hover:bg-ui-panel'>
        <div className='min-w-0'><Link href={`/dashboard/ti/sources/${source.id}?scope=${scope}`} className='font-semibold text-ui-text hover:text-ui-primary'>{source.name}</Link><p className='mt-1 truncate text-xs text-ui-muted'>{source.family.replaceAll('_', ' ')} · {source.owner}</p>{candidate ? <span className='mt-2 inline-flex rounded-full border border-ui-warning/35 bg-ui-warning/10 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'>Available to activate</span> : null}</div>
        <div><p className='font-semibold text-ui-text'>{darkweb ? 'Dark web' : source.accessMethod || 'Clearweb'}</p><p className='mt-1 text-xs text-ui-muted'>{source.risk} access</p></div>
        <Status source={source} />
        <div><p className='font-semibold text-ui-text'>{relative(source.lastContentAt)}</p><p className='mt-1 text-xs text-ui-muted'>{formatTiDate(source.lastContentAt)}</p></div>
        <div><p className='font-semibold text-ui-text'>{source.productiveCycleCount} cycles</p><p className='mt-1 text-xs text-ui-muted'>{source.retainedEvidenceCount} captures</p></div>
        <div><p className='font-semibold text-ui-text'>—</p><p className='mt-1 text-xs text-ui-muted'>tenant matches</p></div>
        <div className='flex flex-wrap gap-1.5'>{!candidate ? <ManualRunButton sourceId={source.id} label='Run now' queries={source.domains} /> : null}{source.url && !darkweb ? <a href={source.url} target='_blank' rel='noopener noreferrer' className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Open <ExternalLink className='h-3 w-3' /></a> : <Link href='/browser' className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Preview</Link>}<Link href={`/dashboard/ti/sources/${source.id}?scope=${scope}`} className='inline-flex h-8 items-center rounded-md border border-ui-border px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Details</Link></div>
    </div>
}

function Status({ source }: { source: TiAdminSource }) {
    const stale = source.status === 'active' && source.lastRunAt && Date.now() - Date.parse(source.lastRunAt) > source.cadenceMinutes * 120_000
    const label = source.status === 'active' ? stale ? 'Stale' : 'Active' : source.status
    return <div><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${stale ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning' : source.status === 'active' ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-border text-ui-muted'}`}>{label}</span><p className='mt-1 text-xs text-ui-muted'>{source.healthState}</p></div>
}

function Empty() { return <DashboardPanel className='grid min-h-112 place-items-center border-ui-border bg-ui-panel p-8 text-center'><div className='max-w-md'><div className='mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-ui-border bg-ui-canvas text-ui-primary'><Plus /></div><h2 className='mt-5 text-2xl font-semibold text-ui-text'>Add your first intelligence source</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>Connect a public feed, clearweb source, darkweb metadata source, or Telegram feed to begin collection.</p><div className='mt-5 flex justify-center gap-2'><Link href='/dashboard/ti/sources?available=true' className='rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas'>Add source</Link><Link href='/dashboard/ti/control' className={tab}>Browse available sources</Link></div></div></DashboardPanel> }
function Unavailable() { return <DashboardPanel className='grid min-h-80 place-items-center border-ui-warning/40 bg-ui-panel p-8 text-center'><div><RefreshCcw className='mx-auto h-8 w-8 text-ui-warning' /><h2 className='mt-4 text-xl font-semibold text-ui-text'>Source inventory is temporarily unavailable</h2><p className='mt-2 text-sm text-ui-muted'>The source service did not return an inventory. No zero-source result was inferred.</p><Link href='/dashboard/ti/sources' className='mt-5 inline-flex rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas'>Retry</Link></div></DashboardPanel> }
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input }
function relative(value: string) { const age = Date.now() - Date.parse(value); if (!Number.isFinite(age)) return 'not recorded'; const minutes = Math.max(0, Math.round(age / 60_000)); return minutes < 60 ? `${minutes}m ago` : minutes < 2_880 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1_440)}d ago` }
const tab = 'rounded-md border border-ui-border px-3 py-2 text-sm font-semibold text-ui-text hover:bg-ui-raised'
const activeTab = 'rounded-md bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas'
