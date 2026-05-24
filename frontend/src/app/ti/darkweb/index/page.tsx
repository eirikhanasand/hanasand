import { AlertTriangle, Database, Filter, LockKeyhole, Search, ShieldCheck } from 'lucide-react'

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
        <main className='min-h-[90.5vh] w-full px-4 py-8 md:px-8'>
            <div className='mx-auto grid w-full max-w-7xl gap-6'>
                <section className='grid gap-4 border-b border-white/10 pb-6 lg:grid-cols-[1.2fr_0.8fr]'>
                    <div className='grid gap-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <h1 className='text-3xl font-semibold text-bright md:text-4xl'>Darkweb metadata index</h1>
                            <Badge tone='ok'>metadata only</Badge>
                            {statusIndex?.noLeakSerialization?.passed || searchIndex?.noLeakSerialization?.passed ? <Badge tone='ok'>no-leak checked</Badge> : <Badge tone='watch'>contract pending</Badge>}
                        </div>
                        <p className='max-w-4xl text-sm leading-6 text-bright/62'>
                            Searchable Tor, I2P, and Freenet landing-page metadata with redacted URLs, legal triage, liveness, provenance hashes, and review state. Raw unsafe URLs, payloads, credentials, private material, and actor interaction are not exposed here.
                        </p>
                    </div>
                    <div className='grid gap-2 text-sm'>
                        <Metric icon={<Database className='h-4 w-4' />} label='Target records' value={formatNumber(statusIndex?.targetRecordCount)} />
                        <Metric icon={<Search className='h-4 w-4' />} label='Indexed estimate' value={formatNumber(statusIndex?.indexedRecordEstimate)} />
                        <Metric icon={<ShieldCheck className='h-4 w-4' />} label='Matches' value={formatNumber(searchIndex?.totalMatches)} />
                        <Metric icon={<LockKeyhole className='h-4 w-4' />} label='Generated' value={formatDate(searchIndex?.generatedAt ?? statusIndex?.generatedAt)} />
                    </div>
                </section>

                <form className='grid gap-3 border-b border-white/10 pb-5' action='/ti/darkweb/index'>
                    <div className='grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto] md:items-end'>
                        <Input label='Search' name='q' defaultValue={query} placeholder='actor, category, TTP, language...' />
                        <Input label='Network' name='network' defaultValue={network} placeholder='tor, i2p, freenet' />
                        <Input label='Legal triage' name='legalTriage' defaultValue={legalTriage} placeholder='blocked_unsafe' />
                        <Input label='Review state' name='reviewState' defaultValue={reviewState} placeholder='needs_review' />
                        <button className='inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-semibold text-background transition hover:bg-white'>
                            <Filter className='h-4 w-4' />
                            Apply
                        </button>
                    </div>
                    <input type='hidden' name='category' value={category} />
                </form>

                <section className='grid gap-3'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <h2 className='text-lg font-semibold text-bright'>Index records</h2>
                        <p className='text-xs text-bright/38'>{records.length} shown{searchIndex?.nextCursor ? ` · more available after cursor ${searchIndex.nextCursor}` : ''}</p>
                    </div>
                    {records.length ? (
                        <div className='overflow-hidden border border-white/10'>
                            <div className='hidden grid-cols-[1fr_0.55fr_0.7fr_0.55fr_0.5fr_0.55fr] gap-3 border-b border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold uppercase text-bright/38 lg:grid'>
                                <span>Redacted URL</span>
                                <span>Category</span>
                                <span>Legal triage</span>
                                <span>Liveness</span>
                                <span>Language</span>
                                <span>Last seen</span>
                            </div>
                            {records.map(record => <RecordRow key={record.id} record={record} />)}
                        </div>
                    ) : (
                        <div className='grid min-h-[28vh] place-items-center border border-white/10 bg-white/[0.025] px-5 py-10 text-center'>
                            <div className='grid max-w-xl gap-3'>
                                <Search className='mx-auto h-7 w-7 text-[#6bc9d8]' />
                                <h2 className='text-xl font-semibold text-bright'>No index rows returned</h2>
                                <p className='text-sm leading-6 text-bright/52'>Try a broader query or clear the filters while the index refresh continues.</p>
                            </div>
                        </div>
                    )}
                </section>

                <section className='grid gap-4 lg:grid-cols-4'>
                    <Breakdown title='Networks' values={statusIndex?.counts?.byNetwork} />
                    <Breakdown title='Legal triage' values={statusIndex?.counts?.byLegalTriage} />
                    <Breakdown title='Liveness' values={statusIndex?.counts?.byLiveness} />
                    <Breakdown title='Review state' values={statusIndex?.counts?.byReviewState} />
                </section>
            </div>
        </main>
    )
}

function RecordRow({ record }: { record: DarkwebRecord }) {
    return (
        <article className='grid gap-3 border-b border-white/8 px-3 py-4 last:border-b-0 lg:grid-cols-[1fr_0.55fr_0.7fr_0.55fr_0.5fr_0.55fr]'>
            <div className='grid gap-2'>
                <div className='grid gap-1'>
                    <h3 className='wrap-break-word text-sm font-semibold text-bright/84'>{record.redactedDisplayUrl}</h3>
                    <p className='text-xs text-bright/42'>{record.title}</p>
                </div>
                <p className='text-sm leading-6 text-bright/55'>{record.safeSummary}</p>
                <div className='flex flex-wrap gap-2 text-xs text-bright/42'>
                    <span>{record.network}</span>
                    <span>{record.reviewState}</span>
                    <span>confidence {Math.round(record.confidence * 100)}%</span>
                    {record.retentionClass ? <span>{record.retentionClass}</span> : null}
                </div>
                <Hints label='Actors' values={record.actorHints} />
                <Hints label='TTPs' values={record.ttpHints} />
                {record.blockedReason ? <p className='inline-flex items-center gap-2 text-xs text-amber-200/75'><AlertTriangle className='h-3 w-3' />{record.blockedReason}</p> : null}
                {record.classification?.reasons?.length ? <p className='text-xs leading-5 text-bright/35'>{record.classification.reasons.join(' · ')}</p> : null}
            </div>
            <Cell label='Category' value={record.category} />
            <Cell label='Legal triage' value={record.legalTriage} />
            <Cell label='Liveness' value={record.liveness} />
            <Cell label='Language' value={record.language} />
            <div className='grid content-start gap-1 text-sm text-bright/58'>
                <span className='text-xs uppercase text-bright/30 lg:hidden'>Last seen</span>
                <span>{formatDate(record.lastSeen)}</span>
                <span className='text-xs text-bright/35'>checked {formatDate(record.lastChecked)}</span>
                {record.provenance?.sourceHash ? <span className='break-all text-xs text-bright/35'>source {record.provenance.sourceHash}</span> : null}
            </div>
        </article>
    )
}

function Input({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue: string; placeholder: string }) {
    return (
        <label className='grid gap-2'>
            <span className='text-xs font-semibold uppercase text-bright/40'>{label}</span>
            <input
                name={name}
                defaultValue={defaultValue}
                placeholder={placeholder}
                className='h-11 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-bright outline-none transition placeholder:text-bright/25 focus:border-[#6bc9d8]/60 focus:bg-white/[0.065]'
            />
        </label>
    )
}

function Cell({ label, value }: { label: string; value: string }) {
    return (
        <div className='grid content-start gap-1 text-sm text-bright/58'>
            <span className='text-xs uppercase text-bright/30 lg:hidden'>{label}</span>
            <span>{value}</span>
        </div>
    )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className='flex items-center justify-between gap-3 border border-white/10 bg-white/[0.025] px-3 py-2'>
            <span className='inline-flex items-center gap-2 text-bright/45'>{icon}{label}</span>
            <span className='font-semibold text-bright/78'>{value}</span>
        </div>
    )
}

function Breakdown({ title, values }: { title: string; values?: Record<string, number> }) {
    const entries = Object.entries(values ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
    return (
        <section className='grid content-start gap-2 border border-white/10 bg-white/[0.025] p-3'>
            <h2 className='text-sm font-semibold text-bright/78'>{title}</h2>
            {entries.length ? entries.map(([key, count]) => (
                <div key={key} className='flex items-center justify-between gap-3 text-sm'>
                    <span className='text-bright/50'>{key}</span>
                    <span className='font-semibold text-bright/75'>{formatNumber(count)}</span>
                </div>
            )) : <p className='text-sm text-bright/40'>No data</p>}
        </section>
    )
}

function Hints({ label, values }: { label: string; values?: string[] }) {
    if (!values?.length) return null
    return (
        <div className='flex flex-wrap gap-2'>
            <span className='text-xs text-bright/30'>{label}</span>
            {values.map(value => <span key={value} className='rounded-md bg-white/[0.055] px-2 py-1 text-xs text-bright/58'>{value}</span>)}
        </div>
    )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'ok' | 'watch' }) {
    const className = tone === 'ok'
        ? 'border-[#6bc9d8]/25 bg-[#6bc9d8]/10 text-[#9fe8f1]'
        : 'border-amber-200/25 bg-amber-200/10 text-amber-100'
    return <span className={`rounded-md border px-2 py-1 text-xs font-medium uppercase ${className}`}>{children}</span>
}

function paramValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function formatNumber(value: number | undefined) {
    return typeof value === 'number' ? new Intl.NumberFormat('en-US').format(value) : 'unknown'
}

function formatDate(value: string | undefined) {
    if (!value) return 'unknown'
    const time = Date.parse(value)
    if (Number.isNaN(time)) return value
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(time))
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
