'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Search, ShieldCheck, X } from 'lucide-react'
import { ActorMark } from '@/components/ti/actorMark'
import { actorSummary, usefulActorSummary } from '@/utils/ti/actorSummary'

type SearchItem = {
    id: string
    title: string
    detail: string
    href: string
}

const publicRouteItems: SearchItem[] = [
    route('Home', 'Overview and product entry point', '/'),
    route('Dark Web Monitoring', 'Product page', '/dwm'),
    route('Threat search', 'Search companies, actors, domains, and activity', '/ti'),
    route('Browser', 'Regular and Tor browser runs', '/browser'),
    route('Security Monitoring', 'Managed detection from customer security logs', '/solutions/mill'),
    route('Security Scanner', 'Safe validation scans and historical results', '/solutions/scanner'),
    route('Organizations', 'Members, watchlists, and destinations', '/organizations'),
    route('Developers', 'API and webhook documentation', '/developers'),
    route('Pricing', 'Plans and subscription details', '/pricing'),
    route('Trust Center', 'Security, DPA, SLA, and subprocessors', '/trust'),
    route('Status', 'Service health and incidents', '/status'),
    route('Hash exposure lookup', 'Prefix-only SHA-1 lookup', '/pwned'),
    route('Support', 'Contact support', '/support'),
]

const dashboardRouteItems: SearchItem[] = [
    route('Dashboard overview', 'Customer console overview', '/dashboard/overview'),
    route('Security Monitoring', 'Suspicious login and security event review', '/dashboard/mill'),
    route('Security Scanner', 'Run and schedule approved Hanasand scans', '/dashboard/scanner'),
    route('DWM cases', 'Dark web monitoring case review', '/dashboard/dwm/cases'),
    route('DWM watchlists', 'Watched companies, vendors, domains, and brands', '/dashboard/dwm/watchlists'),
    route('DWM delivery', 'Webhook attempts and customer delivery', '/dashboard/dwm/delivery'),
    route('DWM actors', 'Actor context and coverage', '/dashboard/dwm/actors'),
    route('DWM actions', 'Watchlist, source, case, and webhook controls', '/dashboard/dwm/actions'),
    route('Automation', 'Webhook and automation setup', '/dashboard/automation'),
    route('Subscription', 'Billing and plan controls', '/dashboard/subscription'),
]

export default function SiteSearch({ token }: { token: boolean }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [cases, setCases] = useState<SearchItem[]>([])
    const [actors, setActors] = useState<SearchItem[]>([])
    const [savedSearches, setSavedSearches] = useState<SearchItem[]>([])
    const [watchTerms, setWatchTerms] = useState<SearchItem[]>([])
    const [loading, setLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const cleanQuery = query.trim().toLowerCase()
    const routes = useMemo(() => [...(token ? dashboardRouteItems : []), ...publicRouteItems], [token])
    const routeResults = useMemo(() => filterItems(routes, cleanQuery).slice(0, 8), [routes, cleanQuery])
    const directThreatResult = useMemo(() => directThreatItem(cleanQuery, actors), [actors, cleanQuery])
    const savedResults = useMemo(() => filterItems(savedSearches, cleanQuery).slice(0, 4), [savedSearches, cleanQuery])
    const watchResults = useMemo(() => filterItems(watchTerms, cleanQuery).slice(0, 4), [watchTerms, cleanQuery])
    const fallbackSearch = useMemo(() => cleanQuery && !directThreatResult ? manualSearchItem(cleanQuery) : null, [cleanQuery, directThreatResult])

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setOpen(true)
            }
            if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    useEffect(() => {
        if (!open) return
        try {
            const stored = JSON.parse(window.localStorage.getItem('hanasand:ti:saved-searches') || '[]')
            setSavedSearches(Array.isArray(stored) ? stored.filter((item): item is { query: string } => Boolean(item && typeof item.query === 'string')).map(item => ({ id: `saved:${item.query}`, title: item.query, detail: 'Saved search', href: `/ti/${encodeURIComponent(item.query)}` })) : [])
        } catch {
            setSavedSearches([])
        }
        if (!token) return
        fetch('/api/dwm/watchlists', { cache: 'no-store' })
            .then(response => response.ok ? response.json() : null)
            .then(payload => setWatchTerms(arrayFrom(payload, ['watchlists', 'items', 'rows']).flatMap(watchlistTerms).slice(0, 20)))
            .catch(() => setWatchTerms([]))
    }, [open, token])

    useEffect(() => {
        if (!open) return
        requestAnimationFrame(() => inputRef.current?.focus())
    }, [open])

    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        const timer = window.setTimeout(async () => {
            setLoading(true)
            try {
                const [caseItems, actorItems] = await Promise.all([
                    token ? loadCases(cleanQuery, controller.signal) : Promise.resolve([]),
                    cleanQuery ? loadActors(cleanQuery, controller.signal) : Promise.resolve([]),
                ])
                setCases(caseItems)
                setActors(actorItems)
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }, 180)
        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [cleanQuery, open, token])

    return (
        <>
            <button
                type='button'
                onClick={() => setOpen(true)}
                className='hidden h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-canvas hover:text-ui-text md:inline-flex'
                aria-label='Open search'
                title='Search'
            >
                <Search className='h-4 w-4' />
                <span className='hidden lg:inline'>Search</span>
                <kbd className='rounded-md border border-ui-border bg-ui-panel px-1.5 py-0.5 text-[10px] font-semibold text-ui-muted'>Cmd K</kbd>
            </button>

            {open ? (
                <div className='fixed inset-0 z-[1200] bg-ui-canvas/70 px-3 py-20 backdrop-blur' onMouseDown={() => setOpen(false)}>
                    <div className='mx-auto max-w-3xl overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-[0_28px_90px_rgba(0,0,0,0.28)]' onMouseDown={event => event.stopPropagation()}>
                        <div className='flex h-16 items-center gap-3 border-b border-ui-border px-4'>
                            <Search className='h-5 w-5 text-ui-muted' />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder='Search routes, cases, and threat actors'
                                className='h-full min-w-0 flex-1 bg-transparent text-lg text-ui-text outline-none placeholder:text-ui-muted'
                            />
                            {loading ? <Loader2 className='h-4 w-4 animate-spin text-ui-muted' /> : null}
                            <button type='button' onClick={() => setOpen(false)} className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text' aria-label='Close search'>
                                <X className='h-4 w-4' />
                            </button>
                        </div>
                        <div className='max-h-[60vh] overflow-auto p-3'>
                            <ResultGroup title='THREAT INTELLIGENCE' items={directThreatResult ? [directThreatResult] : []} icon='actor' onSelect={() => setOpen(false)} />
                            <ResultGroup title='SAVED SEARCHES' items={savedResults} icon='route' onSelect={() => setOpen(false)} />
                            <ResultGroup title='WATCHLISTS' items={watchResults} icon='actor' onSelect={() => setOpen(false)} />
                            <ResultGroup title='RECENT EVIDENCE' items={actors.filter(item => item.href !== directThreatResult?.href).slice(0, 6)} icon='route' onSelect={() => setOpen(false)} />
                            {token ? <ResultGroup title='CASES' items={cases.slice(0, 6)} icon='case' onSelect={() => setOpen(false)} /> : null}
                            <ResultGroup title='ROUTES' items={routeResults} icon='route' onSelect={() => setOpen(false)} />
                            <ResultGroup title='SEARCH' items={fallbackSearch ? [fallbackSearch] : []} icon='route' onSelect={() => setOpen(false)} />
                            {!routeResults.length && !directThreatResult && !cases.length && !actors.length && !savedResults.length && !watchResults.length ? (
                                <div className='grid min-h-40 place-items-center text-sm font-medium text-ui-muted'>
                                    {cleanQuery ? 'No results' : 'Start typing to search everything'}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    )
}

function ResultGroup({ title, items, icon, onSelect }: { title: string, items: SearchItem[], icon: 'route' | 'case' | 'actor', onSelect: () => void }) {
    if (!items.length) return null
    return (
        <section className='mb-3 last:mb-0'>
            <p className='px-2 pb-1 text-[10px] font-semibold uppercase text-ui-muted'>{title}</p>
            <div className='grid gap-1'>
                {items.map(item => (
                    <Link key={item.id} href={item.href} onClick={onSelect} className='grid grid-cols-[2.25rem_1fr] gap-3 rounded-lg px-2 py-2 transition hover:bg-ui-raised'>
                        <span className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                            {icon === 'case' ? <ShieldCheck className='h-4 w-4' /> : icon === 'actor' ? <ActorMark name={item.title} /> : <FileText className='h-4 w-4' />}
                        </span>
                        <span className='min-w-0'>
                            <span className='block truncate text-sm font-semibold text-ui-text'>{item.title}</span>
                            <span className='block truncate text-xs leading-5 text-ui-muted'>{item.detail || item.href}</span>
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    )
}

function route(title: string, detail: string, href: string): SearchItem {
    return { id: `route:${href}`, title, detail, href }
}

function filterItems(items: SearchItem[], query: string) {
    if (!query) return items
    return items.filter(item => `${item.title} ${item.detail} ${item.href}`.toLowerCase().includes(query))
}

export function directThreatItem(query: string, actorResults: SearchItem[] = []): SearchItem | null {
    const value = query.trim()
    if (value.length < 2) return null
    const href = `/ti/${encodeURIComponent(value)}`
    const matchedActor = actorResults.find(item => item.href.toLowerCase() === href.toLowerCase())
    return matchedActor ? { ...matchedActor, detail: matchedActor.detail.startsWith('Threat actor profile') ? matchedActor.detail : `Threat actor profile · ${matchedActor.detail}` } : null
}

function manualSearchItem(query: string): SearchItem {
    return { id: `search:${query}`, title: `Search “${query}”`, detail: 'Full-text retained evidence search', href: `/ti/${encodeURIComponent(query)}` }
}

function actorDisplayName(value: string) {
    return /^apt\d+$/i.test(value) ? value.toUpperCase() : value
}

async function loadCases(query: string, signal: AbortSignal): Promise<SearchItem[]> {
    const response = await fetch('/api/cases', { cache: 'no-store', signal })
    if (!response.ok) return []
    const payload = await response.json()
    return arrayFrom(payload, ['cases', 'items', 'rows'])
        .map(caseItem)
        .filter(isSearchItem)
        .filter(item => !query || `${item.title} ${item.detail} ${item.href}`.toLowerCase().includes(query))
        .slice(0, 8)
}

async function loadActors(query: string, signal: AbortSignal): Promise<SearchItem[]> {
    if (!query) return []
    const params = new URLSearchParams({ q: query, limit: '8', entityType: exactEntityType(query), cached: 'true' })
    const response = await fetch(`/api/ti/search?${params.toString()}`, { cache: 'no-store', signal })
    if (!response.ok) return []
    const payload = await response.json()
    const preview = actorPreviewItem(payload, query)
    return uniqueByHref([...(preview ? [preview] : []), ...actorItems(payload), ...evidenceItems(payload)]).slice(0, 8)
}

function exactEntityType(query: string) {
    return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(query) ? 'domain' : 'actor'
}

function actorPreviewItem(payload: unknown, query: string): SearchItem | null {
    if (!payload || typeof payload !== 'object') return null
    const row = payload as Record<string, unknown>
    const intelligence = row.actorIntelligence && typeof row.actorIntelligence === 'object' ? row.actorIntelligence as Record<string, unknown> : null
    const identity = row.actorIdentity && typeof row.actorIdentity === 'object' ? row.actorIdentity as Record<string, unknown> : null
    const candidates = arrayFrom(identity, ['candidates'])
    const candidate = candidates.length === 1 && candidates[0] && typeof candidates[0] === 'object' ? candidates[0] as Record<string, unknown> : null
    if (row.queryKind !== 'actor' && !intelligence) return null
    const title = actorDisplayName(stringValue(row.query) || query)
    const detail = usefulActorSummary(stringValue(candidate?.description)) || usefulActorSummary(stringValue(row.summary)) || actorSummary({
        name: title,
        aliases: stringArray(candidate?.associatedNames),
        actorClass: stringValue(intelligence?.actorClass),
        attribution: stringValue(intelligence?.attribution),
        targetSectors: stringArray(intelligence?.targetSectors),
        geographies: stringArray(intelligence?.geographies),
        malwareTools: stringArray(intelligence?.malwareTools),
    }) || `${title} threat actor profile`
    return { id: `actor-preview:${title}`, title, detail: `Threat actor profile · ${detail}`, href: `/ti/${encodeURIComponent(stringValue(row.query) || query)}` }
}

export function caseItem(value: unknown): SearchItem | null {
    if (!value || typeof value !== 'object') return null
    const row = value as Record<string, unknown>
    const id = stringValue(row.id) || stringValue(row.caseId)
    if (!id) return null
    const title = stringValue(row.title) || stringValue(row.company) || stringValue(row.organizationName) || id
    const detail = [stringValue(row.status), stringValue(row.organizationName), stringValue(row.summary)].filter(Boolean).join(' · ')
    const href = stringValue(row.casePath) || `/dashboard/dwm/cases/${encodeURIComponent(id)}`
    return { id: `case:${id}`, title, detail, href }
}

export function actorItems(payload: unknown): SearchItem[] {
    const rows = arrayFrom(payload, ['actors', 'actorOverviews'])
    const fromRows = rows.map(actorItem).filter(isSearchItem)
    if (fromRows.length) return uniqueByHref(fromRows)
    if (!payload || typeof payload !== 'object' || stringValue((payload as Record<string, unknown>).status).toLowerCase() !== 'ready') return []
    const fallbackTitle = stringValue((payload as Record<string, unknown> | null)?.actor)
    if (!fallbackTitle) return []
    return [{ id: `actor:${fallbackTitle}`, title: fallbackTitle, detail: 'Threat actor profile', href: `/ti/${encodeURIComponent(fallbackTitle)}` }]
}

function evidenceItems(payload: unknown): SearchItem[] {
    return arrayFrom(payload, ['results', 'rows']).map(value => {
        if (!value || typeof value !== 'object') return null
        const row = value as Record<string, unknown>
        const id = stringValue(row.id) || stringValue(row.captureId)
        const title = stringValue(row.title) || stringValue(row.sourceName) || stringValue(row.url)
        if (!id || !title) return null
        const detail = stringValue(row.summary) || stringValue(row.excerpt) || stringValue(row.body)
        return { id: `evidence:${id}`, title, detail: `Recent evidence${detail ? ` · ${detail}` : ''}`, href: `/ti/${encodeURIComponent(stringValue(row.query) || title)}` }
    }).filter(isSearchItem)
}

function actorItem(value: unknown): SearchItem | null {
    if (!value || typeof value !== 'object') return null
    const row = value as Record<string, unknown>
    const title = stringValue(row.actor) || stringValue(row.name) || stringValue(row.title) || stringValue(row.query)
    if (!title) return null
    const detail = [stringValue(row.confidence), stringValue(row.latestSeenAt), stringValue(row.summary)].filter(Boolean).join(' · ')
    return { id: `actor:${title}`, title, detail: `Threat actor profile${detail ? ` · ${detail}` : ''}`, href: `/ti/${encodeURIComponent(title)}` }
}

function watchlistTerms(value: unknown): SearchItem[] {
    if (!value || typeof value !== 'object') return []
    const row = value as Record<string, unknown>
    const terms = Array.isArray(row.terms) ? row.terms : Array.isArray(row.items) ? row.items : []
    return terms.flatMap(term => {
        const item = term && typeof term === 'object' ? term as Record<string, unknown> : null
        const value = typeof term === 'string' ? term : stringValue(item?.value || item?.term)
        return value ? [{ id: `watch:${value}`, title: value, detail: 'Monitored entity', href: '/dashboard/dwm/watchlists' }] : []
    })
}

function arrayFrom(payload: unknown, keys: string[]) {
    if (Array.isArray(payload)) return payload
    if (!payload || typeof payload !== 'object') return []
    const record = payload as Record<string, unknown>
    for (const key of keys) {
        if (Array.isArray(record[key])) return record[key] as unknown[]
    }
    return []
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function stringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function uniqueByHref(items: SearchItem[]) {
    const seen = new Set<string>()
    return items.filter(item => {
        if (seen.has(item.href)) return false
        seen.add(item.href)
        return true
    })
}

function isSearchItem(value: SearchItem | null): value is SearchItem {
    return Boolean(value)
}
