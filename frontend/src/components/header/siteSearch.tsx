'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Search, ShieldCheck, X } from 'lucide-react'
import { ActorMark } from '@/components/ti/actorMark'
import { actorSummary, usefulActorSummary } from '@/utils/ti/actorSummary'
import { useRouter } from 'next/navigation'
import { generatedSearchRoutes } from '@/utils/routes/generatedSearchRoutes'

type SearchItem = {
    id: string
    title: string
    detail: string
    href: string
}

export default function SiteSearch({ token }: { token: boolean }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [cases, setCases] = useState<SearchItem[]>([])
    const [actors, setActors] = useState<SearchItem[]>([])
    const [savedSearches, setSavedSearches] = useState<SearchItem[]>([])
    const [watchTerms, setWatchTerms] = useState<SearchItem[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const cleanQuery = query.trim().toLowerCase()
    const routeResults = useMemo(() => filterItems([...generatedSearchRoutes], cleanQuery).sort((a, b) => routeRelevance(b, cleanQuery) - routeRelevance(a, cleanQuery)), [cleanQuery])
    const directThreatResult = useMemo(() => directThreatItem(cleanQuery, actors), [actors, cleanQuery])
    const savedResults = useMemo(() => filterItems(savedSearches, cleanQuery).slice(0, 4), [savedSearches, cleanQuery])
    const watchResults = useMemo(() => filterItems(watchTerms, cleanQuery).slice(0, 4), [watchTerms, cleanQuery])
    const fallbackSearch = useMemo(() => cleanQuery && !directThreatResult ? manualSearchItem(cleanQuery) : null, [cleanQuery, directThreatResult])
    const groups = useMemo(() => [
        { title: 'ROUTES', items: routeResults, icon: 'route' as const },
        { title: 'THREAT INTELLIGENCE', items: directThreatResult ? [directThreatResult] : [], icon: 'actor' as const },
        { title: 'CASES', items: token ? cases.slice(0, 6) : [], icon: 'case' as const },
        { title: 'SAVED SEARCHES', items: savedResults, icon: 'route' as const },
        { title: 'WATCHLISTS', items: watchResults, icon: 'actor' as const },
        { title: 'RECENT EVIDENCE', items: actors.filter(item => item.href !== directThreatResult?.href).slice(0, 6), icon: 'route' as const },
        { title: 'SEARCH', items: fallbackSearch ? [fallbackSearch] : [], icon: 'route' as const },
    ], [actors, cases, directThreatResult, fallbackSearch, routeResults, savedResults, token, watchResults])
    const flatResults = useMemo(() => groups.flatMap(group => group.items), [groups])

    useEffect(() => setSelectedIndex(0), [cleanQuery])

    useEffect(() => {
        if (!open || !flatResults.length) return
        document.getElementById(`site-search-result-${flatResults[selectedIndex]?.id}`)?.scrollIntoView({ block: 'nearest' })
    }, [flatResults, open, selectedIndex])

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setOpen(true)
            }
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
        fetch('/api/findings/watchlists', { cache: 'no-store' })
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
                <div role='dialog' aria-modal='true' aria-label='Site search' onKeyDownCapture={event => {
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); setOpen(false) }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault()
                        if (flatResults.length) setSelectedIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + flatResults.length) % flatResults.length)
                    }
                    if (event.key === 'Enter' && flatResults.length) {
                        event.preventDefault()
                        const selected = flatResults[selectedIndex]
                        if (selected) {
                            router.push(selected.href)
                            setOpen(false)
                        }
                    }
                }} className='fixed inset-0 z-[1200] bg-ui-canvas/70 px-3 py-20 backdrop-blur' onMouseDown={() => setOpen(false)}>
                    <div className='mx-auto max-w-3xl overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-[0_28px_90px_var(--ui-shadow)]' onMouseDown={event => event.stopPropagation()}>
                        <div className='flex h-16 items-center gap-3 border-b border-ui-border px-4'>
                            <Search className='h-5 w-5 text-ui-muted' />
                            <input
                                ref={inputRef}
                                aria-label='Search routes and workspace'
                                aria-activedescendant={flatResults[selectedIndex] ? `site-search-result-${flatResults[selectedIndex].id}` : undefined}
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
                            <div role='listbox' aria-label='Search results'>
                                {groups.map(group => <ResultGroup key={group.title} {...group} selectedIndex={selectedIndex} startIndex={flatResults.findIndex(item => item.id === group.items[0]?.id)} onSelect={() => setOpen(false)} onSelectIndex={setSelectedIndex} />)}
                            </div>
                            {!flatResults.length ? (
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

function ResultGroup({ title, items, icon, onSelect, onSelectIndex, selectedIndex, startIndex }: { title: string, items: SearchItem[], icon: 'route' | 'case' | 'actor', onSelect: () => void, onSelectIndex: (index: number) => void, selectedIndex: number, startIndex: number }) {
    if (!items.length) return null
    return (
        <section role='group' aria-label={title} className='mb-3 last:mb-0'>
            <p className='px-2 pb-1 text-[10px] font-semibold uppercase text-ui-muted'>{title}</p>
            <div className='grid gap-1'>
                {items.map((item, index) => {
                    const selected = startIndex + index === selectedIndex
                    return <Link key={item.id} id={`site-search-result-${item.id}`} role='option' aria-selected={selected} href={item.href} onClick={onSelect} onMouseEnter={() => onSelectIndex(startIndex + index)} className={`grid grid-cols-[2.25rem_1fr] gap-3 rounded-lg border px-2 py-2 transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10' : 'border-transparent hover:bg-ui-raised'}`}>
                        <span className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                            {icon === 'case' ? <ShieldCheck className='h-4 w-4' /> : icon === 'actor' ? <ActorMark name={item.title} /> : <FileText className='h-4 w-4' />}
                        </span>
                        <span className='min-w-0'>
                            <span className='block truncate text-sm font-semibold text-ui-text'>{item.title}</span>
                            <span className='block truncate text-xs leading-5 text-ui-muted'>{item.detail || item.href}</span>
                        </span>
                    </Link>
                })}
            </div>
        </section>
    )
}

function filterItems(items: SearchItem[], query: string) {
    if (!query) return items
    return items.filter(item => `${item.title} ${item.detail} ${item.href}`.toLowerCase().includes(query))
}

function routeRelevance(item: SearchItem, query: string) {
    if (!query) return 0
    const title = item.title.toLowerCase()
    if (title === query) return 3
    if (title.startsWith(query)) return 2
    return 1
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
    const href = stringValue(row.casePath) || `/cases/${encodeURIComponent(id)}`
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
        return value ? [{ id: `watch:${value}`, title: value, detail: 'Monitored entity', href: '/findings/watchlists' }] : []
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
