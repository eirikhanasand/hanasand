'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, Clock, Code2, Database, FileCode2, Globe, Minus, Plus, RotateCcw, Search, ZoomIn } from 'lucide-react'
import { reviewPriority, reviewStatus, type CodeInventory, type CodeItem, type ReviewEvent } from '@/utils/codeReviewTypes'
import './codeReview.css'

const kinds = ['frontend', 'api', 'database', 'source'] as const
const names = { frontend: 'Frontend', api: 'API', database: 'Database', source: 'Source files' }
const icons = { frontend: Globe, api: Code2, database: Database, source: FileCode2 }
const website = (item: CodeItem) => /^(frontend|api|db)\//.test(item.file)
const statusNames = { approved: 'Approved', changed: 'Needs new review', unreviewed: 'Not reviewed' }
function ItemIcon({ item }: { item: CodeItem }) { const Icon = icons[item.kind]; return <Icon size={15} aria-hidden='true' /> }
function StatusIcon({ item }: { item: CodeItem }) {
    const status = reviewStatus(item)
    return <span className='code-status' data-status={status} data-priority={reviewPriority(item)} title={statusNames[status]}>{status === 'approved' ? <Check size={12} /> : status === 'changed' ? <RotateCcw size={12} /> : <Circle size={10} />}</span>
}
function related(item: CodeItem, byId: Map<string, CodeItem>) {
    const visited = new Set<string>(), stack = [...item.dependencies]
    while (stack.length) {
        const id = stack.pop()!
        if (visited.has(id) || id === item.id) continue
        visited.add(id); stack.push(...(byId.get(id)?.dependencies || []))
    }
    return [...visited].map(id => byId.get(id)).filter((node): node is CodeItem => Boolean(node)).sort((a, b) => a.title.localeCompare(b.title, 'en'))
}
function DependencyMap({ items, selected, onSelect }: { items: CodeItem[], selected?: CodeItem, onSelect: (id: string) => void }) {
    const [zoom, setZoom] = useState(1), [limit, setLimit] = useState(12), [overview, setOverview] = useState(true)
    const viewport = useRef<HTMLDivElement>(null)
    const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
    const dependencies = (selected?.dependencies || []).map(id => byId.get(id)).filter((item): item is CodeItem => Boolean(item))
    const dependents = selected ? items.filter(item => item.dependencies.includes(selected.id)) : []
    const summary = overview || zoom < 0.55 || !selected
    const height = summary ? 300 : Math.max(220, Math.max(Math.min(dependencies.length, limit), Math.min(dependents.length, limit)) * 64 + 100)
    const nodes = summary ? [] : [
        { item: selected, x: 350, y: 70 },
        ...dependents.slice(0, limit).map((item, index) => ({ item, x: 10, y: 70 + index * 64 })),
        ...dependencies.slice(0, limit).map((item, index) => ({ item, x: 690, y: 70 + index * 64 })),
    ]
    return <section aria-label='Dependency map' className='code-map'>
        <div className='code-map-tools'>
            <strong>Dependency map</strong>
            <button aria-label='Zoom out' disabled={zoom <= 0.3} onClick={() => setZoom(value => Math.max(0.3, value - 0.15))}><Minus size={15} /></button>
            <output aria-label='Map zoom'>{Math.round(zoom * 100)}%</output>
            <button aria-label='Zoom in' disabled={zoom >= 1.8} onClick={() => { setOverview(false); setZoom(value => Math.min(1.8, value + 0.15)) }}><Plus size={15} /></button>
            <button onClick={() => { setOverview(true); setZoom(1); viewport.current?.scrollTo(0, 0) }}>Overview</button>
            {selected && <button onClick={() => { setOverview(false); setZoom(1); setLimit(12); viewport.current?.scrollTo(0, 0) }}><ZoomIn size={15} /> Focus selected</button>}
        </div>
        <div className='code-map-scroll' ref={viewport} tabIndex={0} aria-label='Scrollable dependency map'>
            {summary ? <div className='code-map-summary'>
                {kinds.map(kind => <button key={kind} onClick={() => { const first = items.find(item => item.kind === kind); if (first) onSelect(first.id); setOverview(false); setZoom(1) }}>
                    {(() => { const Icon = icons[kind]; return <Icon size={22} /> })()}<span>{names[kind]}</span><b>{items.filter(item => item.kind === kind).length}</b>
                </button>)}
                {selected && <p>{selected.title}: <b>{selected.dependencyCount}</b> dependencies. Zoom in or focus to explore.</p>}
            </div> : <svg role='group' aria-label={`Dependencies of ${selected.title}`} width={1010 * zoom} height={height * zoom} viewBox={`0 0 1010 ${height}`}>
                <text x='10' y='28'>Used by</text><text x='350' y='28'>Selected</text><text x='690' y='28'>Depends on</text>
                {nodes.slice(1).map(({ item, x, y }) => <path key={'edge:' + item.id + x} d={x < 350 ? `M310 ${y + 22} C330 ${y + 22} 330 92 350 92` : `M650 92 C670 92 670 ${y + 22} 690 ${y + 22}`} />)}
                {nodes.map(({ item, x, y }) => <g key={item.id + x} role='button' tabIndex={0} aria-label={`${item.title}, ${item.dependencyCount} dependencies`} onClick={() => onSelect(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item.id) } }}>
                    <title>{item.title} · {names[item.kind]} · {statusNames[reviewStatus(item)]}</title>
                    <rect x={x} y={y} width='300' height='44' rx='8' data-selected={item.id === selected.id} />
                    <g transform={`translate(${x + 12},${y + 4})`}><ItemIcon item={item} /></g>
                    <text x={x + 32} y={y + 17} className='code-map-kind'>{names[item.kind]}</text>
                    <text x={x + 12} y={y + 34}>{item.title.length > 36 ? '…' + item.title.slice(-35) : item.title}</text>
                    {item.dependencyCount > 0 && <><circle cx={x + 279} cy={y + 9} r='13' /><text x={x + 279} y={y + 13} textAnchor='middle' className='code-map-count'>{item.dependencyCount}</text></>}
                </g>)}
            </svg>}
        </div>
        {!summary && Math.max(dependencies.length, dependents.length) > limit && <button className='code-more' onClick={() => setLimit(value => value + 24)}>Show more connections ({Math.max(0, dependencies.length - limit) + Math.max(0, dependents.length - limit)} hidden)</button>}
        <p className='code-caption'>Connections read from source. Counts include transitive dependencies. Scroll to move around; use + and − to zoom. Unresolved references are listed with each item.</p>
    </section>
}
function SourceDetail({ item, onReview, onSelect, byId }: { item: CodeItem, onReview: (event: ReviewEvent) => void, onSelect: (id: string) => void, byId: Map<string, CodeItem> }) {
    const [detail, setDetail] = useState<{ item: CodeItem, history: ReviewEvent[] } | null>(null)
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [reviewOpen, setReviewOpen] = useState(false), [more, setMore] = useState(false)
    const allDependencies = useMemo(() => related(item, byId), [item, byId])
    const sourceDependencies = allDependencies.filter(node => node.kind === 'source')
    const load = useCallback(async(signal?: AbortSignal) => {
        setError('')
        try {
            const response = await fetch('/api/thesis/code?' + new URLSearchParams({ id: item.id }), { cache: 'no-store', signal })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error)
            setDetail(result); setMore(result.history.length === 50)
        } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Source could not be loaded.') }
    }, [item.id])
    useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])
    async function approve(approved: boolean) {
        if (!detail || busy) return
        setBusy(true); setError('')
        try {
            const response = await fetch('/api/thesis/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, sha256: detail.item.sha256, reviewHash: detail.item.reviewHash, approved, eventId: crypto.randomUUID() }) })
            const event = await response.json()
            if (!response.ok) throw new Error(event.error)
            onReview(event); await load()
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review could not be saved.') }
        finally { setBusy(false) }
    }
    return <article className='code-detail' aria-label='Selected code item'>
        <div className='code-detail-heading'><ItemIcon item={item} /><h3>{item.title}</h3><button aria-label={`Review status: ${statusNames[reviewStatus(item)]}`} aria-expanded={reviewOpen} onClick={() => setReviewOpen(!reviewOpen)}><StatusIcon item={item} /></button></div>
        <p className='code-caption'>{item.file}{item.line ? `:${item.line}` : ''} · {statusNames[reviewStatus(item)]}</p>
        {error && <div role='alert'>{error} <button onClick={() => load()}>Retry</button></div>}
        {!detail && !error && <p role='status'>Loading source…</p>}
        {reviewOpen && <section aria-label='Review history' className='code-review-history'>
            <h4><Clock size={15} /> Review history</h4>
            <p>{item.review ? `Last review: ${new Date(item.review.reviewed_at).toLocaleString()} by ${item.review.reviewer}.` : 'This item has not been reviewed.'}</p>
            {reviewStatus(item) === 'changed' && <p>The source or one of its dependencies changed since the last review.</p>}
            <button disabled={busy || !detail || reviewStatus(item) === 'approved'} onClick={() => approve(true)}>Approve this version</button>
            {reviewStatus(item) === 'approved' && <button disabled={busy} onClick={() => approve(false)}>Mark as needing review</button>}
            <ul>{detail?.history.map(event => <li key={event.event_id}>{event.approved ? 'Approved' : 'Marked for review'} · {new Date(event.reviewed_at).toLocaleString()} · {event.reviewer}<details><summary>Version hashes</summary><code>Source: {event.content_hash}<br />With dependencies: {event.review_hash}</code></details></li>)}</ul>
            {detail?.history.length === 0 && <p>No earlier reviews.</p>}
            {more && <button disabled={busy} onClick={async() => {
                setBusy(true)
                try {
                    const response = await fetch('/api/thesis/code?' + new URLSearchParams({ id: item.id, before: detail!.history.at(-1)!.event_id }))
                    const result = await response.json()
                    if (!response.ok) throw new Error(result.error)
                    setDetail(current => current && ({ ...current, history: [...current.history, ...result.history] })); setMore(result.history.length === 50)
                } catch { setError('Older reviews could not be loaded.') }
                finally { setBusy(false) }
            }}>Older reviews</button>}
        </section>}
        <details><summary>SHA-256 and version details</summary><code>Source: {item.sha256}<br />With dependencies: {item.reviewHash}</code></details>
        <details open><summary>Full content</summary>{detail && <pre tabIndex={0}><code>{detail.item.content}</code></pre>}</details>
        {item.unresolved.length > 0 && <details><summary>References to inspect ({item.unresolved.length})</summary><ul>{item.unresolved.map(reference => <li key={reference}>{reference}</li>)}</ul></details>}
        <details open><summary>Direct dependencies ({item.dependencies.length})</summary><ul className='code-links'>{item.dependencies.map(id => { const node = byId.get(id); return node && <li key={id}><button onClick={() => onSelect(id)}><ItemIcon item={node} /><span>{node.title}</span><StatusIcon item={node} /></button></li> })}</ul></details>
        <details><summary>All source files used by this item ({sourceDependencies.length})</summary><ul className='code-links'>{sourceDependencies.map(node => <li key={node.id}><button onClick={() => onSelect(node.id)}><ItemIcon item={node} /><span>{node.title}</span><StatusIcon item={node} /></button></li>)}</ul></details>
    </article>
}
export default function CodeReview() {
    const [data, setData] = useState<CodeInventory | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
    const [clock, setClock] = useState(0)
    const [order, setOrder] = useState('priority')
    const version = useRef('')
    const [selected, setSelected] = useState(''), [query, setQuery] = useState(''), [scope, setScope] = useState('website'), [status, setStatus] = useState('all'), [limit, setLimit] = useState(100)
    const load = useCallback(async(automatic = false) => {
        if (!automatic) setLoading(true)
        setError('')
        try {
            const response = await fetch('/api/thesis/code' + (automatic && version.current ? '?since=' + encodeURIComponent(version.current) : ''), { cache: 'no-store' })
            if (response.status === 204) {
                setData(current => current?.sync && (current.sync.phase !== 'ready' || current.sync.error || current.sync.warning) ? { ...current, sync: { phase: 'ready' } } : current)
                return
            }
            if (response.status === 403) { setData(null); version.current = '' }
            const result = await response.json()
            if (!response.ok) throw new Error(result.error)
            version.current = result.hash + ':' + (result.revision || '')
            setData(result)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'The inventory could not be loaded.') }
        finally { setLoading(false) }
    }, [])
    useEffect(() => {
        let stopped = false
        async function poll() { await load(true); if (!stopped) timer = setTimeout(poll, 3000) }
        let timer: ReturnType<typeof setTimeout>
        load().then(() => { if (!stopped) timer = setTimeout(poll, 3000) })
        const clock = setInterval(() => setClock(value => value + 1), 60000)
        return () => { stopped = true; clearTimeout(timer); clearInterval(clock) }
    }, [load])
    const byId = useMemo(() => new Map(data?.nodes.map(item => [item.id, item]) || []), [data])
    const scoped = useMemo(() => data?.nodes.filter(item => scope === 'repository' || website(item)) || [], [data, scope])
    const filtered = useMemo(() => scoped.filter(item => (item.title + ' ' + item.file).toLowerCase().includes(query.toLowerCase()) && (status === 'all' || reviewStatus(item) === status)).sort((a, b) => (order === 'priority' ? reviewPriority(a) - reviewPriority(b) : 0) || a.title.localeCompare(b.title, 'en')), [scoped, query, status, order, clock])
    const item = byId.get(selected) || scoped.find(node => node.kind === 'frontend') || scoped[0]
    const select = (id: string) => { setSelected(id); if (byId.get(id) && !website(byId.get(id)!)) setScope('repository') }
    return <section className='code-workspace' aria-label='Code review workspace'>
        <header><h2>Code review</h2><button disabled={loading} onClick={() => load()}><RotateCcw size={15} /> Refresh</button><span className='code-caption'>Owner only</span></header>
        {error && <p role='alert'>{error}</p>}
        {data?.sync?.phase === 'indexing' && <p role='status'>Updating from the latest Git commit…</p>}
        {(data?.sync?.error || data?.sync?.warning) && <p role='alert'>{data.sync.error || data.sync.warning}</p>}{loading && <p role='status'>Loading inventory…</p>}
        {data && <>
            <div className='code-filters'>
                <label><Search size={15} /><input aria-label='Search code inventory' placeholder='Search routes, queries or files' value={query} onChange={event => { setQuery(event.target.value); setLimit(100) }} /></label>
                <select aria-label='Repository scope' value={scope} onChange={event => { setScope(event.target.value); setLimit(100) }}><option value='website'>Website, API and database</option><option value='repository'>Entire repository</option></select>
                <select aria-label='Sort code inventory' value={order} onChange={event => setOrder(event.target.value)}><option value='priority'>Priority, then alphabetical</option><option value='alphabetical'>Alphabetical</option></select>
                <select aria-label='Review filter' value={status} onChange={event => { setStatus(event.target.value); setLimit(100) }}><option value='all'>All review states</option><option value='unreviewed'>Not reviewed</option><option value='changed'>Needs new review</option><option value='approved'>Approved</option></select>
            </div>
            <p className='code-caption'>{scoped.filter(node => reviewStatus(node) === 'approved').length} of {scoped.length} items approved. Red: unreviewed or overdue. Yellow: changed, reviewed within 14 days. Green: approved and unchanged.</p>
            <div className='code-columns'>
                <aside aria-label='Alphabetical code inventory'>{kinds.map(kind => {
                    const entries = filtered.filter(node => node.kind === kind)
                    return <details key={kind} open><summary>{names[kind]} <span>{entries.length}</span></summary><ul className='code-links'>{entries.slice(0, limit).map(node => <li key={node.id}><button aria-current={node.id === item?.id ? 'true' : undefined} onClick={() => select(node.id)}><ItemIcon item={node} /><span>{node.title}</span><StatusIcon item={node} /></button></li>)}</ul>{entries.length > limit && <button className='code-more' onClick={() => setLimit(value => value + 100)}>Show more ({entries.length - limit})</button>}</details>
                })}{!filtered.length && <p>No matching items.</p>}</aside>
                <div className='code-main'><DependencyMap items={data.nodes} selected={item} onSelect={select} />{item && <SourceDetail key={item.id + ':' + item.reviewHash} item={item} byId={byId} onSelect={select} onReview={event => setData(current => current && ({ ...current, nodes: current.nodes.map(node => node.id === event.item_id ? { ...node, review: event } : node) }))} />}</div>
            </div>
            <details className='code-caption'><summary>Inventory details and coverage</summary><p>Repository commit: {data.release}. Updates from Git appear automatically; a site redeployment is not needed. Runtime data, credentials, binary files and build output are excluded. Route and query entries describe source declarations, not recorded production requests. Computed requests and non-JavaScript dependencies require manual inspection; see “References to inspect” on each source file.</p><code>Inventory SHA-256: {data.hash}</code></details>
        </>}
    </section>
}
