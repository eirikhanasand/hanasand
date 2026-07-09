'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Search, ShieldCheck, X } from 'lucide-react'

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
    route('DWM cases', 'Dark web monitoring case review', '/dashboard/dwm/cases'),
    route('DWM watchlists', 'Watched companies, vendors, domains, and brands', '/dashboard/dwm/watchlists'),
    route('DWM sources', 'Source health and capture state', '/dashboard/dwm/sources'),
    route('DWM delivery', 'Webhook attempts and customer delivery', '/dashboard/dwm/delivery'),
    route('DWM actors', 'Actor context and coverage', '/dashboard/dwm/actors'),
    route('DWM actions', 'Watchlist, source, case, and webhook controls', '/dashboard/dwm/actions'),
    route('Automations', 'Webhook and automation setup', '/dashboard/automations'),
    route('Subscription', 'Billing and plan controls', '/dashboard/subscription'),
]

export default function SiteSearch({ token }: { token: boolean }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [cases, setCases] = useState<SearchItem[]>([])
    const [actors, setActors] = useState<SearchItem[]>([])
    const [loading, setLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const cleanQuery = query.trim().toLowerCase()
    const routes = useMemo(() => [...(token ? dashboardRouteItems : []), ...publicRouteItems], [token])
    const routeResults = useMemo(() => filterItems(routes, cleanQuery).slice(0, 8), [routes, cleanQuery])

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
                            <ResultGroup title='ROUTES' items={routeResults} icon='route' onSelect={() => setOpen(false)} />
                            {token ? <ResultGroup title='CASES' items={cases.slice(0, 6)} icon='case' onSelect={() => setOpen(false)} /> : null}
                            <ResultGroup title='THREAT ACTORS' items={actors.slice(0, 6)} icon='actor' onSelect={() => setOpen(false)} />
                            {!routeResults.length && !cases.length && !actors.length ? (
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
                            {icon === 'case' ? <ShieldCheck className='h-4 w-4' /> : icon === 'actor' ? <Search className='h-4 w-4' /> : <FileText className='h-4 w-4' />}
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
    const params = new URLSearchParams({ q: query, limit: '8' })
    const response = await fetch(`/api/ti/search?${params.toString()}`, { cache: 'no-store', signal })
    if (!response.ok) return []
    const payload = await response.json()
    return actorItems(payload, query).slice(0, 8)
}

function caseItem(value: unknown): SearchItem | null {
    if (!value || typeof value !== 'object') return null
    const row = value as Record<string, unknown>
    const id = stringValue(row.id) || stringValue(row.caseId)
    if (!id) return null
    const title = stringValue(row.title) || stringValue(row.company) || stringValue(row.organizationName) || id
    const detail = [stringValue(row.status), stringValue(row.organizationId), stringValue(row.summary)].filter(Boolean).join(' · ')
    const href = stringValue(row.casePath) || `/dashboard/dwm/cases/${encodeURIComponent(id)}`
    return { id: `case:${id}`, title, detail, href }
}

function actorItems(payload: unknown, query: string): SearchItem[] {
    const rows = arrayFrom(payload, ['actors', 'actorOverviews', 'results', 'rows'])
    const fromRows = rows.map(actorItem).filter(isSearchItem)
    if (fromRows.length) return uniqueByHref(fromRows)
    const fallbackTitle = stringValue((payload as Record<string, unknown> | null)?.actor) || stringValue((payload as Record<string, unknown> | null)?.query) || query
    return [{ id: `actor:${fallbackTitle}`, title: fallbackTitle, detail: 'Open threat intelligence result', href: `/ti/${encodeURIComponent(fallbackTitle)}` }]
}

function actorItem(value: unknown): SearchItem | null {
    if (!value || typeof value !== 'object') return null
    const row = value as Record<string, unknown>
    const title = stringValue(row.actor) || stringValue(row.name) || stringValue(row.title) || stringValue(row.query)
    if (!title) return null
    const detail = [stringValue(row.confidence), stringValue(row.latestSeenAt), stringValue(row.summary)].filter(Boolean).join(' · ')
    return { id: `actor:${title}`, title, detail: detail || 'Open threat intelligence result', href: `/ti/${encodeURIComponent(title)}` }
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
