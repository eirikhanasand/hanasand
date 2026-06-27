'use client'

import searchThreatIntel, { TiSearchResponse } from '@/utils/ti/search'
import { Activity, BellRing, Building2, Database, ExternalLink, Globe2, HelpCircle, Radar, Search, ShieldCheck, Target, Waypoints } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { humanizeSlug } from '../seo'

export default function TiPageClient({ initialQuery, initialResult }: { initialQuery: string; initialResult: TiSearchResponse | null }) {
    const router = useRouter()
    const [query, setQuery] = useState(initialResult?.query ?? initialQuery)
    const [result, setResult] = useState<TiSearchResponse | null>(initialResult)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const activeQueryRef = useRef((initialResult?.query ?? initialQuery).trim().toLowerCase())
    const requestSeqRef = useRef(0)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        activeQueryRef.current = query.trim().toLowerCase()
    }, [query])

    useEffect(() => {
        const titleQuery = (result?.query || query).trim()
        if (!titleQuery) {
            document.title = 'Threat Intelligence Search | Hanasand'
            return
        }

        const label = humanizeSlug(titleQuery)
        document.title = `${label} Threat Intelligence | Hanasand`
        updateMetaDescription(`Search Hanasand monitoring context for ${label}: actor names, company mentions, domains, and recent claims.`)
        updateCanonical(`/ti/${encodeURIComponent(titleQuery)}`)
    }, [query, result?.query])

    useEffect(() => {
        const clean = initialQuery.trim()
        if (!clean || initialResult) return

        const cleanKey = clean.toLowerCase()
        const requestSeq = requestSeqRef.current + 1
        requestSeqRef.current = requestSeq
        activeQueryRef.current = cleanKey
        setBusy(true)
        setQuery(clean)
        setResult(searchingResult(clean))
        searchThreatIntel(clean)
            .then((next) => {
                if (requestSeqRef.current !== requestSeq || activeQueryRef.current !== cleanKey) return
                if (next) setResult(next)
            })
            .finally(() => {
                if (requestSeqRef.current === requestSeq) setBusy(false)
            })
    }, [initialQuery, initialResult])

    useEffect(() => {
        if (!result?.refreshAfterSeconds || result.status === 'ready') return
        const expectedQuery = result.query
        const expectedKey = expectedQuery.trim().toLowerCase()
        const timer = window.setTimeout(async () => {
            const next = await searchThreatIntel(expectedQuery)
            if (next && activeQueryRef.current === expectedKey) {
                setResult(next)
            }
        }, Math.max(3, result.refreshAfterSeconds) * 1000)

        return () => window.clearTimeout(timer)
    }, [result])

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const clean = String(form.get('q') ?? inputRef.current?.value ?? query).trim()
        if (!clean) return

        const requestSeq = requestSeqRef.current + 1
        requestSeqRef.current = requestSeq
        setBusy(true)
        setError('')
        setQuery(clean)
        const cleanKey = clean.toLowerCase()
        activeQueryRef.current = cleanKey
        router.push(`/ti/${encodeURIComponent(clean)}`)
        setResult(searchingResult(clean))
        try {
            const next = await searchThreatIntel(clean)
            if (requestSeqRef.current !== requestSeq || activeQueryRef.current !== cleanKey) return
            if (!next) {
                setError('The TI service did not return results.')
                return
            }
            setResult(next)
        } finally {
            if (requestSeqRef.current === requestSeq) setBusy(false)
        }
    }

    function handleQueryChange(value: string) {
        setQuery(value)
        const cleanKey = value.trim().toLowerCase()
        activeQueryRef.current = cleanKey
        if (!cleanKey) {
            setResult(null)
            return
        }
        if (result && result.query.trim().toLowerCase() !== cleanKey) {
            setResult(null)
        }
    }

    const visible = result

    return (
        <div className='mx-auto grid w-full max-w-7xl gap-6'>
            <form onSubmit={submit} className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm md:p-5'>
                <div className='flex flex-col gap-3 md:flex-row md:items-end'>
                    <label className='grid flex-1 gap-2'>
                        <span className='text-xs font-semibold uppercase text-[#3056d3]'>Threat intelligence search</span>
                        <input
                            ref={inputRef}
                            name='q'
                            value={query}
                            onChange={(event) => handleQueryChange(event.target.value)}
                            placeholder='Company, actor, domain, CVE, supplier...'
                            className='h-12 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                        />
                    </label>
                    <button
                        type='submit'
                        aria-busy={busy}
                        className='inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-5 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:bg-[#eef1f5] disabled:text-[#98a2b3]'
                    >
                        <Search className='h-4 w-4' />
                        {busy ? 'Searching' : 'Search'}
                    </button>
                </div>
                {error ? <p className='text-sm text-red-600'>{error}</p> : null}
            </form>

            {visible ? <Results result={visible} /> : <EmptyState />}
        </div>
    )
}

function Results({ result }: { result: TiSearchResponse }) {
    const sourceUrlById = new Map(result.sources.map(source => [source.id, source.url || linkFromText(source.provenance)]))
    const collectionSources = result.collectionStrategy?.sourcePosture ?? defaultCollectionSources()
    const datasets = (result.datasets.length ? result.datasets : defaultDatasets()).filter(item => !/planned|rejected|blocked/i.test(item.status))
    const sources = result.sources.length ? result.sources : defaultSourceLinks()
    const alertItems = alertItemsFor(result)
    return (
        <div className='grid gap-6'>
            <section className='grid gap-4 rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm lg:grid-cols-[1.25fr_0.75fr]'>
                <div className='grid gap-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <h1 className='text-3xl font-semibold text-[#171a21] md:text-4xl'>{humanizeSlug(result.query)}</h1>
                        {result.status ? (
                            <span className='rounded-lg border border-[#b8c5ff] bg-[#eef3ff] px-2 py-1 text-xs font-medium uppercase text-[#3056d3]'>
                                {humanResultStatus(result.status)}
                            </span>
                        ) : null}
                    </div>
                    <p className='max-w-4xl text-sm leading-6 text-[#596170]'>{result.summary}</p>
                    <div className='flex flex-wrap gap-2'>
                        {result.aliases.map(alias => (
                            <span key={alias} className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-2 py-1 text-xs text-[#667085]'>{alias}</span>
                        ))}
                    </div>
                </div>
                <div className='grid gap-2 text-sm'>
                    <Metric icon={<ShieldCheck className='h-4 w-4' />} label='Sources' value={sourceCountLabel(result.sources.length)} />
                    <Metric icon={<Activity className='h-4 w-4' />} label='Updated' value={formatDate(result.generatedAt || result.lastSeen)} />
                    <Metric icon={<Database className='h-4 w-4' />} label='Activity' value={activityCountLabel(result.recentActivity.length)} />
                    <Metric icon={<BellRing className='h-4 w-4' />} label='Monitoring' value={result.status === 'ready' || result.status === 'partial' ? 'Active' : 'Watching'} />
                </div>
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <Panel title='Recent Activity' description='New or updated reporting connected to this actor, company, domain, CVE, or search term. Stable profile facts stay cached; this section is the part that changes most often.' icon={<Radar className='h-4 w-4' />}>
                    {result.recentActivity.length ? result.recentActivity.map(item => {
                        const href = item.url || item.sourceIds.map(id => sourceUrlById.get(id)).find(Boolean)
                        return (
                            <EvidenceBox key={`${item.date}-${item.title}`} href={href}>
                                <div className='flex items-center justify-between gap-3'>
                                    <h2 className='text-sm font-semibold text-[#171a21]'>{item.title}</h2>
                                    <span className='text-xs text-[#667085]'>{item.date}</span>
                                </div>
                                <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                <p className='inline-flex items-center gap-1 text-xs text-[#667085]'>
                                    {activitySourceLabel(item.sourceIds.length)}
                                    {href ? <ExternalLink className='h-3 w-3 text-[#3056d3]' /> : null}
                                </p>
                            </EvidenceBox>
                        )}) : <EmptyLine text={result.status === 'searching' ? 'Searching' : 'No activity returned yet.'} />}
                </Panel>

                <Panel title='Company Exposure' description='Company exposure means a company, domain, vendor, brand, product, or portfolio name appears in actor claims, leak posts, advisories, or monitored pages. This is the section buyers use to decide whether someone needs to review or respond.' icon={<Building2 className='h-4 w-4' />}>
                    {alertItems.length ? alertItems.map(item => (
                        <div key={item.title} className='grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0'>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='text-sm font-semibold text-[#171a21]'>{item.title}</h2>
                                <span className={`rounded-lg px-2 py-1 text-xs ${rowToneClass(item.tone)}`}>{item.state}</span>
                            </div>
                            <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                        </div>
                    )) : <EmptyLine text='No company, domain, vendor, or product matches returned yet.' />}
                </Panel>
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <Panel title='Typical Victims' description='Industries and regions the actor is reported to target, plus why that mapping was included. Use this to judge whether the actor is relevant to your organization or customers.' icon={<Target className='h-4 w-4' />}>
                    {result.targets.length ? result.targets.map(item => (
                        <div key={item.sector} className='grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0'>
                            <h2 className='text-sm font-semibold text-[#171a21]'>{item.sector}</h2>
                            <p className='text-xs text-[#667085]'>{item.regions.join(', ')}</p>
                            <p className='text-sm leading-6 text-[#596170]'>{item.rationale}</p>
                        </div>
                    )) : <EmptyLine text='No typical victim pattern returned yet.' />}
                </Panel>
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <Panel title='Observed Tradecraft' description='Reported tactics, techniques, and procedures, usually mapped to ATT&CK where available. This helps defenders understand how the actor tends to operate.' icon={<Waypoints className='h-4 w-4' />}>
                    {result.ttps.map(item => (
                        <div key={`${item.attackId}-${item.name}`} className='grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <h2 className='text-sm font-semibold text-[#171a21]'>{item.name}</h2>
                                {item.attackId ? <TechniqueBadge attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} /> : null}
                            </div>
                            <p className='text-xs text-[#667085]'>{item.tactic}</p>
                            <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                        </div>
                    ))}
                </Panel>

                <Panel title='Monitoring Coverage' description='The data families checked for this result, such as actor profiles, victim claims, public advisories, and watched company or supplier terms.' icon={<Globe2 className='h-4 w-4' />}>
                    {datasets.map(item => (
                        <EvidenceBox key={`${item.type}-${item.name}`} href={item.url}>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='text-sm font-semibold text-[#171a21]'>{item.name}</h2>
                                <span className='text-xs text-[#667085]'>{sourceStatusLabel(item.status)}</span>
                            </div>
                            <p className='text-sm leading-6 text-[#596170]'>{item.coverage}</p>
                        </EvidenceBox>
                    ))}
                </Panel>
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <CoverageStrategyPanel sources={collectionSources} />
                <SourceLinksPanel sources={sources} />
            </section>
        </div>
    )
}

function EvidenceBox({ href, children }: { href?: string; children: React.ReactNode }) {
    const className = `grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0 ${href ? 'rounded-lg px-2 transition hover:border-[#3056d3]/20 hover:bg-[#3056d3]/5 focus:outline-none focus:ring-1 focus:ring-[#3056d3]/35' : ''}`
    if (!href) return <div className={className}>{children}</div>
    return (
        <a href={href} target='_blank' rel='noopener noreferrer' className={className} title={href}>
            {children}
        </a>
    )
}

function EmptyState() {
    return (
        <section className='grid min-h-[48vh] place-items-center border border-[#dfe5ee] bg-white px-5 py-10 text-center'>
            <div className='grid max-w-xl gap-3'>
                <Radar className='mx-auto h-8 w-8 text-[#3056d3]' />
                <h1 className='text-2xl font-semibold text-[#171a21]'>Search company exposure and actor context</h1>
                <p className='text-sm leading-6 text-[#667085]'>Enter a company, vendor, domain, ransomware group, CVE, or actor name.</p>
            </div>
        </section>
    )
}

function searchingResult(query: string): TiSearchResponse {
    const now = new Date().toISOString()
    return {
        query,
        generatedAt: now,
        mode: 'live_search',
        status: 'searching',
        refreshAfterSeconds: 3,
        summary: 'Searching',
        confidence: 0.2,
        lastSeen: now,
        aliases: [],
        recentActivity: [],
        targets: [],
        ttps: [],
        datasets: defaultDatasets(),
        sources: defaultSourceLinks(),
        notes: []
    }
}

function defaultDatasets(): TiSearchResponse['datasets'] {
    return [
        {
            name: 'Ransomware victim claims',
            type: 'darknet_metadata',
            coverage: 'Recent company names, actor names, claimed dates, sector/country context, and claimed-data descriptions from monitored extortion sources and public indexes.',
            status: 'available',
            url: 'https://ransomware.live/'
        },
        {
            name: 'Actor infrastructure monitoring',
            type: 'darknet_metadata',
            coverage: 'Company-first checks against actor-controlled public leak infrastructure so watched companies can be alerted when a new mention appears.',
            status: 'metadata_only'
        },
        {
            name: 'Vulnerability and exploitation context',
            type: 'clear_web',
            coverage: 'Recent NVD/CISA and public advisory context for CVEs, affected products, exploitation status, and actor-linked vulnerability activity.',
            status: 'available',
            url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'
        },
        {
            name: 'Company and supplier watchlists',
            type: 'vendor_report',
            coverage: 'Customer-specific names, domains, brands, subsidiaries, and vendors matched against new actor claims and captured page text.',
            status: 'planned'
        }
    ]
}

function defaultCollectionSources(): NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture'] {
    return [
        {
            source: 'RansomLook and ransomware.live',
            role: 'primary_seed',
            summary: 'Used as starting coverage for recent victim claims, actor names, company names, claimed dates, sector/country context, and claimed-data descriptions.',
            buyerValue: 'Good seed data lets a small team detect obvious company mentions immediately, then spend engineering effort on direct verification and alert speed.'
        },
        {
            source: 'Direct actor infrastructure collection',
            role: 'owned_collection_target',
            summary: 'Company-first collection from actor-controlled public leak/extortion infrastructure where policy allows.',
            buyerValue: 'This is the valuable part: faster discovery, verified claim changes, freshness deltas, and watchlist alerts that are not just copied from another public index.'
        },
        {
            source: 'Infostealer and credential-exposure records',
            role: 'owned_collection_target',
            summary: 'Company/domain exposure records routed through review without credential values, raw dumps, or unsafe redistribution.',
            buyerValue: 'Buyers care when their domain, vendor, executive, or portfolio company appears in fresh exposure records; the value is the alert and triage context, not dump access.'
        },
        {
            source: 'NVD, CISA KEV, and public advisories',
            role: 'corroboration',
            summary: 'Used for enrichment, prioritization, and vulnerability context around actor activity.',
            buyerValue: 'Public vulnerability data is not the product by itself, but it makes exposure alerts more actionable for security teams deciding what to patch or investigate first.'
        }
    ]
}

function defaultSourceLinks(): TiSearchResponse['sources'] {
    return [
        {
            id: 'ransomware-live',
            name: 'ransomware.live',
            type: 'victim_claim_seed',
            provenance: 'https://ransomware.live/',
            url: 'https://ransomware.live/'
        },
        {
            id: 'ransomlook',
            name: 'RansomLook',
            type: 'victim_claim_seed',
            provenance: 'https://www.ransomlook.io/',
            url: 'https://www.ransomlook.io/'
        },
        {
            id: 'cisa-kev',
            name: 'CISA Known Exploited Vulnerabilities',
            type: 'vulnerability_context',
            provenance: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
            url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'
        }
    ]
}

function formatDate(value: string) {
    if (!value) return 'Now'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
    return parsed.toISOString().slice(0, 10)
}

function Panel({ title, description, icon, children }: { title: string; description?: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className='border border-[#dfe5ee] bg-white p-4'>
            <div className='mb-2 flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                <span className='text-[#3056d3]'>{icon}</span>
                <span>{title}</span>
                {description ? <InfoTip label={description} /> : null}
            </div>
            {children}
        </section>
    )
}

function CoverageStrategyPanel({ sources }: { sources: NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture'] }) {
    return (
        <Panel title='Monitoring Mix' description='How the result is assembled: public indexes can seed coverage, direct monitored pages provide freshness, and advisories add vulnerability context.' icon={<Database className='h-4 w-4' />}>
            <div className='grid gap-3'>
                {sources.filter(source => source.role !== 'rejected_paid_rows').slice(0, 4).map(source => (
                    <div key={`${source.source}-${source.role}`} className='rounded-lg border border-[#eef1f5] bg-[#f8fafc] p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <h3 className='text-sm font-semibold text-[#171a21]'>{source.source}</h3>
                            <span className='rounded-lg bg-[#f8fafc] px-2 py-1 text-xs text-[#667085]'>{sourceRoleLabel(source.role)}</span>
                        </div>
                        <p className='mt-2 text-sm leading-6 text-[#596170]'>{source.summary}</p>
                        <p className='mt-2 text-xs leading-5 text-[#667085]'>{source.buyerValue}</p>
                    </div>
                ))}
            </div>
        </Panel>
    )
}

function SourceLinksPanel({ sources }: { sources: TiSearchResponse['sources'] }) {
    const visibleSources = sources.slice(0, 5)
    const hiddenCount = Math.max(0, sources.length - visibleSources.length)
    return (
        <Panel title='Sources Used' description='Named sources used for this result. Public visitors see a limited set; customer console access can show additional source links and internal capture details.' icon={<ExternalLink className='h-4 w-4' />}>
            <div className='grid gap-1'>
                {visibleSources.map(source => {
                    const href = source.url || linkFromText(source.provenance)
                    return (
                        <EvidenceBox key={source.id} href={href}>
                            <h2 className='inline-flex items-center gap-1 text-sm font-semibold text-[#171a21]'>{source.name}{href ? <ExternalLink className='h-3 w-3 text-[#3056d3]' /> : null}</h2>
                            <p className='text-xs text-[#667085]'>{sourceTypeLabel(source.type)}</p>
                            <p className='text-sm leading-6 text-[#596170]'>{sourceDisplayText(source)}</p>
                        </EvidenceBox>
                    )
                })}
                {hiddenCount > 0 ? (
                    <div className='mt-2 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-3 text-sm leading-6 text-[#596170]'>
                        {hiddenCount} additional source{hiddenCount === 1 ? '' : 's'} available in the customer console.
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}

function InfoTip({ label }: { label: string }) {
    return (
        <span className='group relative inline-flex'>
            <button
                type='button'
                aria-label={label}
                className='inline-flex h-6 w-6 items-center justify-center rounded-full text-[#667085] transition hover:bg-[#eef3ff] hover:text-[#3056d3] focus:outline-none focus:ring-2 focus:ring-[#b8c5ff]'
            >
                <HelpCircle className='h-3.5 w-3.5' />
            </button>
            <span className='pointer-events-none absolute left-1/2 top-7 z-20 hidden w-72 -translate-x-1/2 rounded-lg border border-[#dfe5ee] bg-white p-3 text-left text-xs font-medium leading-5 text-[#404957] shadow-xl group-hover:block group-focus-within:block'>
                {label}
            </span>
        </span>
    )
}

function TechniqueBadge({ attackId, name, tactic, detail }: { attackId: string; name: string; tactic: string; detail: string }) {
    const description = techniqueDescription(attackId, name, tactic, detail)
    return (
        <span className='group relative inline-flex'>
            <a
                href={`https://attack.mitre.org/techniques/${attackId.replace('.', '/')}/`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={`${attackId}: ${description}`}
                className='rounded-md border border-[#b8c5ff] bg-[#eef3ff] px-1.5 py-0.5 text-xs font-semibold text-[#3056d3] transition hover:border-[#3056d3] hover:bg-[#e1e9ff] focus:outline-none focus:ring-2 focus:ring-[#b8c5ff]'
            >
                {attackId}
            </a>
            <span className='pointer-events-none absolute left-1/2 top-7 z-20 hidden w-80 -translate-x-1/2 rounded-lg border border-[#dfe5ee] bg-white p-3 text-left text-xs font-medium leading-5 text-[#404957] shadow-xl group-hover:block group-focus-within:block'>
                <span className='block font-semibold text-[#171a21]'>{attackId}: {name}</span>
                <span className='mt-1 block text-[#667085]'>{tactic}</span>
                <span className='mt-2 block'>{description}</span>
            </span>
        </span>
    )
}

function techniqueDescription(attackId: string, name: string, tactic: string, detail: string) {
    const descriptions: Record<string, string> = {
        'T1005': 'Data from Local System: collecting files or data from a compromised computer before staging, exfiltration, or further use.',
        'T1078': 'Valid Accounts: using legitimate user, service, or cloud accounts to access systems and avoid obvious intrusion paths.',
        'T1078.004': 'Valid Accounts: Cloud Accounts: using legitimate cloud account credentials to access cloud-hosted services and resources.',
        'T1102': 'Web Service: using an external web service as part of command-and-control or operational infrastructure.',
        'T1105': 'Ingress Tool Transfer: moving tools, malware, scripts, or payloads into a compromised environment.',
        'T1110': 'Brute Force: trying passwords, password hashes, or credential material to gain access to accounts.',
        'T1110.003': 'Password Spraying: trying a small number of common passwords across many accounts to avoid lockouts.',
        'T1114': 'Email Collection: collecting email messages or mail data from local systems, remote services, or cloud mailboxes.',
        'T1486': 'Data Encrypted for Impact: encrypting data on target systems to disrupt operations or support extortion.',
        'T1566': 'Phishing: sending deceptive messages to trick users into opening links, attachments, or giving up access.',
        'T1566.001': 'Spearphishing Attachment: sending targeted emails with malicious attachments to gain execution or access.',
        'T1567': 'Exfiltration Over Web Service: sending stolen data to a web service controlled by, or usable by, the actor.',
    }
    return descriptions[attackId] ?? `${name}: ${detail || `Reported under the ${tactic} tactic.`}`
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className='flex items-center justify-between gap-4 border border-[#dfe5ee] bg-white px-3 py-2'>
            <span className='inline-flex items-center gap-2 text-[#667085]'>{icon}{label}</span>
            <span className='font-semibold text-[#171a21]'>{value}</span>
        </div>
    )
}

function EmptyLine({ text }: { text: string }) {
    return <p className='py-3 text-sm text-[#667085]'>{text}</p>
}

function rowToneClass(tone: 'ok' | 'watch' | 'bad') {
    if (tone === 'bad') return 'bg-[#fee4e2] text-[#b42318]'
    if (tone === 'watch') return 'bg-[#fff4d6] text-[#8a5a00]'
    return 'bg-[#e9f8ef] text-[#147a3b]'
}

function formatLabel(value: string) {
    return value.replaceAll('_', ' ')
}

function humanResultStatus(value?: string) {
    if (!value) return 'Monitoring'
    if (value === 'metadata_review') return 'Review queue'
    if (value === 'needs_source_activation') return 'Connecting sources'
    if (value === 'blocked_unsafe_target') return 'Review required'
    if (value === 'ready') return 'Ready'
    if (value === 'partial') return 'Updating'
    if (value === 'searching' || value === 'queued') return 'Searching'
    return formatLabel(value)
}

function sourceStatusLabel(value: string) {
    if (/metadata/i.test(value)) return 'Monitoring data'
    if (/available|ready|active/i.test(value)) return 'Active'
    if (/context/i.test(value)) return 'Context'
    return 'Included'
}

function sourceCountLabel(count: number) {
    if (count <= 0) return 'No sources'
    return `${Math.min(count, 5)} shown${count > 5 ? ` of ${count}` : ''}`
}

function activityCountLabel(count: number) {
    if (count <= 0) return 'None yet'
    return `${count} item${count === 1 ? '' : 's'}`
}

function activitySourceLabel(count: number) {
    if (count <= 0) return 'Source pending'
    return count === 1 ? '1 source' : `${count} sources`
}

function updateMetaDescription(content: string) {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
    }
    meta.content = content
}

function updateCanonical(path: string) {
    const href = `${window.location.origin}${path}`
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.appendChild(canonical)
    }
    canonical.href = href
}

function sourceRoleLabel(value: string) {
    if (value === 'primary_seed') return 'Seed coverage'
    if (value === 'owned_collection_target') return 'Owned monitoring'
    if (value === 'corroboration') return 'Corroboration'
    if (value === 'context_only') return 'Context'
    return formatLabel(value)
}

function sourceTypeLabel(value: string) {
    if (/news/i.test(value)) return 'Recent reporting'
    if (/victim|claim|ransom/i.test(value)) return 'Victim claims'
    if (/vulnerab|cve|kev/i.test(value)) return 'Vulnerability context'
    if (/darknet|darkweb|actor/i.test(value)) return 'Actor-page records'
    return 'Source'
}

function sourceDisplayText(source: TiSearchResponse['sources'][number]) {
    const href = source.url || linkFromText(source.provenance)
    if (href) {
        try {
            const url = new URL(href)
            if (/news\.google\.com$/i.test(url.hostname)) return 'Linked report via Google News'
            return url.hostname.replace(/^www\./, '')
        } catch {
            return 'Open source'
        }
    }
    return readableSourceText(source.provenance)
}

function linkFromText(value?: string) {
    if (!value) return undefined
    const match = value.match(/\bhttps?:\/\/[^\s<>"']+/i)
    if (!match) return undefined
    try {
        const url = new URL(match[0])
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
    } catch {
        return undefined
    }
    return undefined
}

function readableSourceText(value?: string) {
    if (!value) return 'Source details available in the console'
    if (/^https?:\/\//i.test(value)) {
        try {
            return new URL(value).hostname.replace(/^www\./, '')
        } catch {
            return 'Open source'
        }
    }
    return value.replace(/^Scraper run [^;]+;\s*/i, '').replace(/^Live query text;\s*/i, '')
}

function alertItemsFor(result: TiSearchResponse) {
    const fromReview = result.analystLoop?.metadataReviewInbox.map(item => ({
        title: item.company || item.victim || 'Exposure mention',
        detail: [item.affectedAccounts, item.datasetSize, item.actorStatement].filter(Boolean).join(' · ') || 'Review the captured mention before customer alerting.',
        state: 'review',
        tone: 'watch' as const
    })) ?? []
    const fromActivity = result.recentActivity
        .filter(item => item.victimName || item.claimType === 'victim_claim' || /victim|leak|claim|stolen|exfiltrat/i.test(`${item.title} ${item.detail}`))
        .map(item => ({
            title: item.victimName || item.title,
            detail: item.impact || item.detail,
            state: 'matched',
            tone: 'ok' as const
        }))
    if (fromReview.length || fromActivity.length) return [...fromReview, ...fromActivity].slice(0, 5)
    if (result.status === 'searching' || result.status === 'queued') {
        return [{
            title: 'Watching for company matches',
            detail: 'The search is checking actor claims, public indexes, and captured page text for company, vendor, domain, and brand mentions.',
            state: 'watching',
            tone: 'watch' as const
        }]
    }
    return []
}
