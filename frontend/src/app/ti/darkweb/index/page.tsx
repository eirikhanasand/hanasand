import { BellRing, Building2, Database, Filter, Globe2, Radar, Search, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface DarkwebIndexPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

interface DarkwebStatusResponse {
    status?: DarkwebStatus
    darkwebIndex?: DarkwebStatus
}

interface DarkwebStatus {
    targetRecordCount?: number
    indexedRecordEstimate?: number
    fixtureRecordCount?: number
    metadataOnly?: boolean
    generatedAt?: string
    publicUiTarget?: string
    counts?: {
        byNetwork?: Record<string, number>
        byLegalTriage?: Record<string, number>
        byLiveness?: Record<string, number>
        byReviewState?: Record<string, number>
    }
    noLeakSerialization?: {
        passed?: boolean
    }
}

interface DarkwebSearchResponse {
    darkwebIndex?: {
        generatedAt?: string
        totalMatches?: number
        nextCursor?: string
        records?: DarkwebRecord[]
        noLeakSerialization?: {
            passed?: boolean
        }
    }
}

interface DarkwebRecord {
    id: string
    network: string
    redactedDisplayUrl: string
    title: string
    safeSummary: string
    category: string
    legalTriage: string
    language: string
    liveness: string
    firstSeen: string
    lastSeen: string
    lastChecked: string
    confidence: number
    reviewState: string
    blockedReason?: string
    actorHints?: string[]
    victimHints?: string[]
    ttpHints?: string[]
    retentionClass?: string
    classification?: {
        label: string
        confidence: number
        reasons: string[]
    }
    provenance?: {
        sourceType?: string
        sourceHash?: string
        discoveryPathHash?: string
        collector?: string
    }
}

export default async function DarkwebIndexPage({ searchParams }: DarkwebIndexPageProps) {
    const params = await searchParams
    const query = paramValue(params?.q).trim()
    const category = paramValue(params?.category).trim()
    const legalTriage = paramValue(params?.legalTriage).trim()
    const network = paramValue(params?.network).trim()
    const reviewState = paramValue(params?.reviewState).trim()

    const [status, search] = await Promise.all([
        fetchDarkwebStatus(),
        fetchDarkwebSearch({ query, category, legalTriage, network, reviewState })
    ])
    const statusIndex = status?.darkwebIndex ?? status?.status
    const searchIndex = search?.darkwebIndex
    const records = searchIndex?.records ?? []

    return (
        <main className='min-h-[90.5vh] w-full bg-[#f7f8fb] px-4 py-8 text-[#171a21] md:px-8'>
            <div className='mx-auto grid w-full max-w-7xl gap-6'>
                <section className='grid gap-4 rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm lg:grid-cols-[1.2fr_0.8fr]'>
                    <div className='grid gap-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <h1 className='text-3xl font-semibold text-[#171a21] md:text-4xl'>Threat actor source map</h1>
                            <Badge tone='ok'>company alerts</Badge>
                            <Badge tone='watch'>actor pages</Badge>
                        </div>
                        <p className='max-w-4xl text-sm leading-6 text-[#596170]'>
                            Search monitored actor pages, victim-claim seeds, and captured page summaries for company names, actor names, claimed dates, sectors, countries, and claimed-data descriptions. This is the working index behind fast customer notifications and UI-friendly actor overviews.
                        </p>
                    </div>
                    <div className='grid gap-2 text-sm'>
                        <Metric icon={<Database className='h-4 w-4' />} label='Watch targets' value={formatNumber(statusIndex?.targetRecordCount, 'Ready')} />
                        <Metric icon={<Search className='h-4 w-4' />} label='Indexed pages' value={formatNumber(statusIndex?.indexedRecordEstimate, 'Active')} />
                        <Metric icon={<ShieldCheck className='h-4 w-4' />} label='Matches' value={formatNumber(searchIndex?.totalMatches, records.length ? 'Matched' : 'No current match')} />
                        <Metric icon={<BellRing className='h-4 w-4' />} label='Updated' value={formatDate(searchIndex?.generatedAt ?? statusIndex?.generatedAt, 'Live checks')} />
                    </div>
                </section>

                <section className='grid gap-3 lg:grid-cols-3'>
                    <ProductTile
                        icon={<Radar className='h-4 w-4' />}
                        title='Direct actor checks'
                        detail='Use public indexes as seeds, then verify fresh actor-page changes directly where collection is approved.'
                    />
                    <ProductTile
                        icon={<Building2 className='h-4 w-4' />}
                        title='Company watchlists'
                        detail='Match customers, subsidiaries, vendors, domains, and brands against new victim claims and captured page text.'
                    />
                    <ProductTile
                        icon={<Globe2 className='h-4 w-4' />}
                        title='Monitoring mix'
                        detail='Use public indexes as seed coverage, then track monitored actor infrastructure and exposure records in one customer-ready map.'
                    />
                </section>

                <form className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm' action='/ti/darkweb/index'>
                    <div className='grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto] md:items-end'>
                        <Input label='Search' name='q' defaultValue={query} placeholder='company, actor, domain, sector...' />
                        <Input label='Network' name='network' defaultValue={network} placeholder='tor, i2p, clear web' />
                        <Input label='Review type' name='legalTriage' defaultValue={legalTriage} placeholder='approved, review' />
                        <Input label='Status' name='reviewState' defaultValue={reviewState} placeholder='ready, watching' />
                        <button className='inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            <Filter className='h-4 w-4' />
                            Find
                        </button>
                    </div>
                    <input type='hidden' name='category' value={category} />
                </form>

                <section className='grid gap-3'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <h2 className='text-lg font-semibold text-[#171a21]'>Actor and company signals</h2>
                        <p className='text-xs text-[#667085]'>{records.length} shown{searchIndex?.nextCursor ? ' · more available' : ''}</p>
                    </div>
                    {records.length ? (
                        <div className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm'>
                            <div className='hidden grid-cols-[1fr_0.55fr_0.7fr_0.55fr_0.5fr_0.55fr] gap-3 border-b border-[#eef1f5] bg-[#f8fafc] px-3 py-2 text-xs font-semibold uppercase text-[#667085] lg:grid'>
                                <span>Mention</span>
                                <span>Signal type</span>
                                <span>Review</span>
                                <span>Freshness</span>
                                <span>Language</span>
                                <span>Last seen</span>
                            </div>
                            {records.map(record => <RecordRow key={record.id} record={record} />)}
                        </div>
                    ) : (
                        <div className='grid min-h-[28vh] place-items-center rounded-lg border border-[#dfe5ee] bg-white px-5 py-10 text-center shadow-sm'>
                            <div className='grid max-w-xl gap-3'>
                                <Search className='mx-auto h-7 w-7 text-[#3056d3]' />
                                <h2 className='text-xl font-semibold text-[#171a21]'>{query ? 'No matching signals in the current index' : 'Search company and actor signals'}</h2>
                                <p className='text-sm leading-6 text-[#667085]'>
                                    {query
                                        ? 'Try a broader company, actor, sector, or domain. Alerts are useful when a watched term appears; empty searches stay quiet.'
                                        : 'Enter a company, actor, domain, supplier, or sector to review monitored exposure records.'}
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                <section className='grid gap-4 lg:grid-cols-4'>
                    <Breakdown title='Networks' values={statusIndex?.counts?.byNetwork} />
                    <Breakdown title='Review type' values={statusIndex?.counts?.byLegalTriage} />
                    <Breakdown title='Freshness' values={statusIndex?.counts?.byLiveness} />
                    <Breakdown title='Status' values={statusIndex?.counts?.byReviewState} />
                </section>
            </div>
        </main>
    )
}

function RecordRow({ record }: { record: DarkwebRecord }) {
    return (
        <article className='grid gap-3 border-b border-[#eef1f5] px-3 py-4 last:border-b-0 lg:grid-cols-[1fr_0.55fr_0.7fr_0.55fr_0.5fr_0.55fr]'>
            <div className='grid gap-2'>
                <div className='grid gap-1'>
                    <h3 className='wrap-break-word text-sm font-semibold text-[#171a21]'>{record.title || record.redactedDisplayUrl}</h3>
                    <p className='text-xs text-[#667085]'>{record.redactedDisplayUrl}</p>
                </div>
                <p className='text-sm leading-6 text-[#596170]'>{record.safeSummary}</p>
                <div className='flex flex-wrap gap-2 text-xs text-[#667085]'>
                    <span>{record.network}</span>
                    <span>{formatLabel(record.reviewState)}</span>
                    <span>confidence {Math.round(record.confidence * 100)}%</span>
                    {record.retentionClass ? <span>{record.retentionClass}</span> : null}
                </div>
                <Hints label='Actors' values={record.actorHints} />
                <Hints label='Companies' values={record.victimHints} />
                <Hints label='TTPs' values={record.ttpHints} />
                {record.blockedReason ? <p className='text-xs text-[#8a5a00]'>Needs analyst review before customer alerting.</p> : null}
                {record.classification?.reasons?.length ? <p className='text-xs leading-5 text-[#667085]'>{record.classification.reasons.join(' · ')}</p> : null}
            </div>
            <Cell label='Signal type' value={formatLabel(record.category)} />
            <Cell label='Review' value={formatLabel(record.legalTriage)} />
            <Cell label='Freshness' value={formatLabel(record.liveness)} />
            <Cell label='Language' value={record.language} />
            <div className='grid content-start gap-1 text-sm text-[#596170]'>
                <span className='text-xs uppercase text-[#667085] lg:hidden'>Last seen</span>
                <span>{formatDate(record.lastSeen)}</span>
                <span className='text-xs text-[#667085]'>checked {formatDate(record.lastChecked)}</span>
            </div>
        </article>
    )
}

function Input({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue: string; placeholder: string }) {
    return (
        <label className='grid gap-2'>
            <span className='text-xs font-semibold uppercase text-[#3056d3]'>{label}</span>
            <input
                name={name}
                defaultValue={defaultValue}
                placeholder={placeholder}
                className='h-11 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
            />
        </label>
    )
}

function Cell({ label, value }: { label: string; value: string }) {
    return (
        <div className='grid content-start gap-1 text-sm text-[#596170]'>
            <span className='text-xs uppercase text-[#667085] lg:hidden'>{label}</span>
            <span>{value}</span>
        </div>
    )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className='flex items-center justify-between gap-3 border border-[#dfe5ee] bg-white px-3 py-2'>
            <span className='inline-flex items-center gap-2 text-[#667085]'>{icon}{label}</span>
            <span className='font-semibold text-[#171a21]'>{value}</span>
        </div>
    )
}

function Breakdown({ title, values }: { title: string; values?: Record<string, number> }) {
    const entries = Object.entries(values ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
    return (
        <section className='grid content-start gap-2 rounded-lg border border-[#dfe5ee] bg-white p-3 shadow-sm'>
            <h2 className='text-sm font-semibold text-[#171a21]'>{title}</h2>
            {entries.length ? entries.map(([key, count]) => (
                <div key={key} className='flex items-center justify-between gap-3 text-sm'>
                    <span className='text-[#596170]'>{formatLabel(key)}</span>
                    <span className='font-semibold text-[#171a21]'>{formatNumber(count)}</span>
                </div>
            )) : <p className='text-sm text-[#667085]'>Available after matching records are returned.</p>}
        </section>
    )
}

function Hints({ label, values }: { label: string; values?: string[] }) {
    if (!values?.length) return null
    return (
        <div className='flex flex-wrap gap-2'>
            <span className='text-xs text-[#667085]'>{label}</span>
            {values.map(value => <span key={value} className='rounded-md bg-[#f8fafc] px-2 py-1 text-xs text-[#596170]'>{value}</span>)}
        </div>
    )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'ok' | 'watch' }) {
    const className = tone === 'ok'
        ? 'border-[#b8c5ff] bg-[#eef3ff] text-[#3056d3]'
        : 'border-[#dfe5ee] bg-[#f8fafc] text-[#596170]'
    return <span className={`rounded-md border px-2 py-1 text-xs font-medium uppercase ${className}`}>{children}</span>
}

function ProductTile({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
    return (
        <article className='grid gap-2 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
            <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                <span className='text-[#3056d3]'>{icon}</span>
                {title}
            </div>
            <p className='text-sm leading-6 text-[#596170]'>{detail}</p>
        </article>
    )
}

function paramValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function formatNumber(value: number | undefined, fallback = 'Checking') {
    return typeof value === 'number' ? new Intl.NumberFormat('en-US').format(value) : fallback
}

function formatDate(value: string | undefined, fallback = 'Checking') {
    if (!value) return fallback
    const time = Date.parse(value)
    if (Number.isNaN(time)) return value
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(time))
}

function formatLabel(value: string) {
    return value.replaceAll('_', ' ')
}

async function fetchDarkwebStatus(): Promise<DarkwebStatusResponse | null> {
    return fetchJson<DarkwebStatusResponse>('/v1/darkweb/status')
}

async function fetchDarkwebSearch(filters: { query: string; category: string; legalTriage: string; network: string; reviewState: string }): Promise<DarkwebSearchResponse | null> {
    const params = new URLSearchParams()
    params.set('limit', '50')
    if (filters.query) params.set('q', filters.query)
    if (filters.category) params.set('category', filters.category)
    if (filters.legalTriage) params.set('legalTriage', filters.legalTriage)
    if (filters.network) params.set('network', filters.network)
    if (filters.reviewState) params.set('reviewState', filters.reviewState)
    return fetchJson<DarkwebSearchResponse>(`/v1/darkweb/search?${params.toString()}`)
}

async function fetchJson<T>(path: string): Promise<T | null> {
    const base = (process.env.TI_SCRAPER_API_BASE ?? 'http://ti-scraper:8097').replace(/\/$/, '')
    try {
        const response = await fetch(`${base}${path}`, { cache: 'no-store' })
        if (!response.ok) return null
        return await response.json() as T
    } catch {
        return null
    }
}
