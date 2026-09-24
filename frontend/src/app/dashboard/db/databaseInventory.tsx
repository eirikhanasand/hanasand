'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { DatabaseOverview } from '@/utils/db/internal'

type Instance = NonNullable<DatabaseOverview['storage']>['instances'][number]
type Database = Instance['databases'][number]
type Item = { schema: string, name: string, sizeBytes: number | null, columns?: string[], lastWriteObservedAt?: string | null, type?: string }
type Page = { rows?: Record<string, unknown>[], fields?: string[], items?: Item[], nextCursor: string | null, elapsedMs?: number, totalRows?: number | null }
type Sort<K extends string> = { key: K, descending: boolean }
type DatabaseSort = 'name' | 'instance' | 'health' | 'count' | 'connections' | 'size'
type ItemSort = 'name' | 'write' | 'size'

function compare(a: string | number | null | undefined, b: string | number | null | undefined, descending: boolean) {
    if (a == null) return b == null ? 0 : 1
    if (b == null) return -1
    return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true })) * (descending ? -1 : 1)
}

function SortButton({ label, active, descending, onClick }: { label: string, active: boolean, descending: boolean, onClick: () => void }) {
    const Icon = active ? descending ? ArrowDown : ArrowUp : ArrowUpDown
    return <button type='button' onClick={onClick} aria-label={`Sort by ${label.toLowerCase()} ${active && !descending ? 'descending' : 'ascending'}`} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded py-1 text-xs focus-visible:outline-ui-primary ${active ? 'text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}>{label}<Icon aria-hidden className='h-3 w-3' /></button>
}

async function fetchPage(params: URLSearchParams, signal?: AbortSignal): Promise<Page> {
    const response = await fetch(`/api/db/browse?${params}`, { cache: 'no-store', signal })
    const body = await response.json()
    if (!response.ok) throw new Error(body.message || 'Preview unavailable.')
    return body
}

export default function DatabaseInventory({ instances, stale }: { instances: Instance[], stale: boolean }) {
    const [expanded, setExpanded] = useState<string | null>(null)
    const [sort, setSort] = useState<Sort<DatabaseSort>>({ key: 'health', descending: false })
    const viewport = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState<number>()
    const rows = instances.flatMap(instance => instance.databases.map(database => ({ instance, database })))
    const health = (instance: Instance) => stale ? 0 : instance.status === 'healthy' ? 2 : instance.status === 'unhealthy' ? 1 : 0
    const value = ({ instance, database }: typeof rows[number]) => ({ name: database.name, instance: instance.id, health: health(instance), count: database.tableCount, connections: database.connections, size: database.sizeBytes })[sort.key]
    rows.sort((a, b) => compare(value(a), value(b), sort.descending) || compare(a.database.sizeBytes, b.database.sizeBytes, true) || a.database.name.localeCompare(b.database.name) || a.instance.id.localeCompare(b.instance.id))
    useEffect(() => {
        if (rows.length <= 5 || !viewport.current) return
        const headers = viewport.current.querySelector('thead')
        const entries = Array.from(viewport.current.querySelectorAll<HTMLElement>('[data-database-row]')).slice(0, 5)
        const measure = () => setHeight(entries.reduce((total, row) => total + row.getBoundingClientRect().height, headers?.getBoundingClientRect().height || 0) + 1)
        const observer = new ResizeObserver(measure)
        if (headers) observer.observe(headers)
        entries.forEach(row => observer.observe(row))
        measure()
        return () => observer.disconnect()
    }, [instances, rows.length, sort])
    const columns: [DatabaseSort, string][] = [['name', 'Database'], ['instance', 'Instance'], ['health', 'Health'], ['count', 'Tables / keys'], ['connections', 'Connections'], ['size', 'Size']]
    return <div ref={viewport} className='overflow-auto' style={{ maxHeight: rows.length > 5 ? height : undefined }} tabIndex={0} aria-label='Databases'><table className='w-full text-left text-sm'>
        <thead className='sticky top-0 z-10 bg-ui-raised text-xs text-ui-muted'><tr>{columns.map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.descending ? 'descending' : 'ascending' : 'none'} className='px-5 py-2 font-medium'><SortButton label={label} active={sort.key === key} descending={sort.descending} onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : false })} /></th>)}</tr></thead>
        <tbody>
            {rows.map(({ instance, database }) => {
                const key = `${instance.id}/${database.name}`, open = expanded === key
                const toggle = () => setExpanded(open ? null : key)
                return <Fragment key={key}>
                    <tr data-database-row onClick={toggle} className={`cursor-pointer border-t transition hover:bg-ui-primary/10 ${open ? 'border-ui-primary bg-ui-primary/10' : 'border-ui-border'}`}>
                        <td className='px-5 py-3 font-medium'><button type='button' aria-expanded={open} onClick={event => { event.stopPropagation(); toggle() }} className='cursor-pointer text-left focus-visible:outline-ui-primary'>{database.name}</button>{database.replica && <span className='ml-2 text-xs text-ui-muted'>Replica</span>}</td>
                        <td className='px-5 py-3 text-xs text-ui-muted'>{instance.id}<span className='block'>{instance.engine}</span></td>
                        <td className={`px-5 py-3 ${!stale && instance.status === 'healthy' ? 'text-ui-success' : 'text-ui-warning'}`}>{stale ? 'Unknown' : instance.status === 'healthy' ? 'Healthy' : instance.status === 'unhealthy' ? 'Unhealthy' : 'Unavailable'}</td>
                        <td className='px-5 py-3 tabular-nums'>{database.tableCount ?? '—'}</td>
                        <td className='px-5 py-3 tabular-nums'>{database.connections ?? '—'}</td>
                        <td className='whitespace-nowrap px-5 py-3 tabular-nums'>{bytes(database.sizeBytes)}{database.memory && <span className='ml-1 text-xs text-ui-muted'>RAM</span>}</td>
                    </tr>
                    {open && <tr className='border-b-2 border-ui-primary bg-ui-primary/5'><td colSpan={6} className='p-4'><DatabaseContents instance={instance} database={database} /></td></tr>}
                </Fragment>
            })}
        </tbody>
    </table></div>
}

function DatabaseContents({ instance, database }: { instance: Instance, database: Database }) {
    const [items, setItems] = useState<Item[]>(database.tables || [])
    const [cursor, setCursor] = useState<string | null>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<Sort<ItemSort>>({ key: 'size', descending: true })
    const searchInput = useRef<HTMLInputElement>(null)
    const list = useRef<HTMLDivElement>(null)
    const [listHeight, setListHeight] = useState<number>()
    const manyTables = items.length > 5
    useEffect(() => {
        if (!manyTables) return
        const focusSearch = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            if (event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'x'
                && !target?.closest('input, textarea, select, [contenteditable="true"]')) {
                event.preventDefault(); searchInput.current?.focus()
            }
        }
        window.addEventListener('keydown', focusSearch)
        return () => window.removeEventListener('keydown', focusSearch)
    }, [manyTables])
    useEffect(() => {
        if (!manyTables || !list.current) return
        const buttons = Array.from(list.current.querySelectorAll<HTMLElement>('[data-table-selector]')).slice(0, 5)
        if (buttons.length < 5) return
        const measure = () => setListHeight(buttons.reduce((height, button) => height + button.getBoundingClientRect().height + 2, 48))
        const observer = new ResizeObserver(measure)
        buttons.forEach(button => observer.observe(button))
        measure()
        return () => observer.disconnect()
    }, [manyTables, items, search, sort])
    const itemValue = (item: Item) => ({ name: `${item.schema}.${item.name}`, write: item.lastWriteObservedAt ? Date.parse(item.lastWriteObservedAt) : null, size: item.sizeBytes })[sort.key]
    const visibleItems = items.filter(item => `${item.schema}.${item.name}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => compare(itemValue(a), itemValue(b), sort.descending) || `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`))
    const [error, setError] = useState('')
    const [pending, setPending] = useState(!database.tables)
    const params = () => new URLSearchParams({ instance: instance.id, database: database.name, mode: 'contents' })
    useEffect(() => {
        if (database.tables) return
        const controller = new AbortController()
        fetchPage(params(), controller.signal).then(page => { setItems(page.items || []); setCursor(page.nextCursor) }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) }).finally(() => setPending(false))
        return () => controller.abort()
    // The component is remounted when the database selection changes.
    }, [])
    async function more() {
        setPending(true); setError('')
        try {
            const next = params(); if (cursor) next.set('cursor', cursor)
            const page = await fetchPage(next)
            setItems(previous => [...previous, ...(page.items || []).filter(item => !previous.some(old => old.name === item.name && old.schema === item.schema))]); setCursor(page.nextCursor)
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Preview unavailable.') } finally { setPending(false) }
    }
    return <div className='min-w-0 space-y-3 [contain:inline-size]'>
        {manyTables && <input ref={searchInput} type='search' value={search} onChange={event => setSearch(event.target.value)} placeholder='Search tables…' aria-label='Search tables' aria-keyshortcuts='Meta+X' className='w-full max-w-xs rounded border border-ui-border bg-ui-canvas px-3 py-1.5 text-sm' />}
        <div className='flex flex-wrap gap-4 px-3 sm:grid sm:grid-cols-[minmax(0,1fr)_12rem_7rem] sm:gap-2' aria-label='Sort database contents'>
            {([['name', 'Name'], ['write', 'Last write'], ['size', 'Size']] as const).map(([key, label]) => <SortButton key={key} label={label} active={sort.key === key} descending={sort.descending} onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : false })} />)}
        </div>
        {cursor && <p className='text-xs text-ui-muted'>Sorting loaded keys</p>}
        <div ref={list} className='min-w-0 space-y-3 overflow-y-auto' style={{ maxHeight: manyTables ? listHeight : undefined }}>
            {visibleItems.map(item => {
                const key = `${item.schema}.${item.name}`, open = selected === key
                return <div key={key} className={`overflow-hidden rounded-md border ${open ? 'border-ui-primary bg-ui-canvas' : 'border-ui-border bg-ui-panel'}`}>
                    <button data-table-selector type='button' aria-expanded={open} onClick={() => setSelected(open ? null : key)} className={`grid w-full cursor-pointer grid-cols-1 gap-2 p-3 text-left transition hover:bg-ui-primary/10 sm:grid-cols-[minmax(0,1fr)_12rem_7rem] ${open ? 'bg-ui-primary/10' : ''}`}>
                        <span className='min-w-0 wrap-break-word font-medium'>{item.schema ? `${item.schema}.` : ''}{item.name}{item.type && <span className='ml-2 text-xs text-ui-muted'>{item.type}</span>}</span>
                        <span className='text-xs text-ui-muted' title={item.lastWriteObservedAt ? 'Last observed write' : 'No writes observed'}>{item.lastWriteObservedAt ? `Last write: ${new Date(item.lastWriteObservedAt).toLocaleString()}` : '—'}</span>
                        <span className='text-xs tabular-nums text-ui-muted'>{bytes(item.sizeBytes)}</span>
                    </button>
                    {open && <div className='border-t border-ui-primary/30 p-3'><RowPreview instance={instance.id} database={database.name} item={item} /></div>}
                </div>
            })}
        </div>
        {search && !visibleItems.length && <p className='text-sm text-ui-muted'>No matching tables.</p>}
        {!pending && !error && !items.length && <p className='text-sm text-ui-muted'>Empty database.</p>}
        {pending && <p role='status' className='text-sm text-ui-muted'>Loading…</p>}
        {error && <p role='alert' className='text-sm text-ui-warning'>{error} <button type='button' onClick={more} className='underline'>Retry</button></p>}
        {cursor && !pending && !error && <button type='button' onClick={more} className='rounded border border-ui-border px-3 py-2 text-sm'>More keys</button>}
    </div>
}

function RowPreview({ instance, database, item }: { instance: string, database: string, item: Item }) {
    const [rows, setRows] = useState<Record<string, unknown>[]>([])
    const [fields, setFields] = useState(item.columns || [])
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)
    const [totalRows, setTotalRows] = useState<number | null>(null)
    const [busy, setBusy] = useState(true)
    const sentinel = useRef<HTMLDivElement>(null)
    const viewport = useRef<HTMLDivElement>(null)
    const consume = useRef<() => void>(() => {})
    useEffect(() => {
        const controller = new AbortController()
        let loading = false, finished = false, nextCursor: string | null = null
        // Count independently so large tables cannot delay or break row loading.
        void fetchPage(new URLSearchParams({ instance, database, mode: 'count', schema: item.schema, table: item.name }), controller.signal)
            .then(page => { if (!controller.signal.aborted) setTotalRows(page.totalRows ?? null) })
            .catch(() => {})
        const request = (cursor: string | null) => {
            const params = new URLSearchParams({ instance, database, mode: 'rows', schema: item.schema, table: item.name })
            if (cursor) params.set('cursor', cursor)
            return fetchPage(params, controller.signal)
        }
        // One five-row page ahead keeps scrolling independent of network latency.
        let next: Promise<Page> | null = request(null)
        void next.catch(() => {})
        consume.current = () => {
            if (loading || finished || controller.signal.aborted) return
            loading = true; setBusy(true); setError('')
            const page = next || request(nextCursor)
            next = null
            void page.then(result => {
                if (controller.signal.aborted) return
                setRows(previous => [...previous, ...(result.rows || [])])
                setFields(previous => [...new Set([...previous, ...(result.fields || [])])])
                nextCursor = result.nextCursor
                finished = !nextCursor; setDone(finished)
                if (!finished) { next = request(nextCursor); void next.catch(() => {}) }
            }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) }).finally(() => { loading = false; if (!controller.signal.aborted) setBusy(false) })
        }
        consume.current()
        return () => controller.abort()
    }, [instance, database, item.schema, item.name])
    useEffect(() => {
        if (busy || done || error || !sentinel.current) return
        const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) consume.current() }, { root: viewport.current, rootMargin: '80px' })
        observer.observe(sentinel.current)
        return () => observer.disconnect()
    }, [busy, done, error, rows])
    const total = done ? rows.length : totalRows === null ? null : Math.max(rows.length, totalRows)
    return <div className='min-w-0'>
        <div ref={viewport} className='min-w-0 max-w-full max-h-80 overflow-auto rounded border border-ui-border' tabIndex={0} aria-label={`${item.name} rows`}>
            <table className='min-w-full text-left text-xs'><thead className='sticky top-0 bg-ui-raised text-ui-muted'><tr>{fields.map(field => <th key={field} className='whitespace-nowrap px-3 py-2 font-medium'>{field}</th>)}</tr></thead><tbody className='divide-y divide-ui-border'>
                {rows.map((row, index) => <tr key={index}>{fields.map(field => <td key={field} className='max-w-80 px-3 py-2 align-top'><pre className='max-w-80 whitespace-pre-wrap [overflow-wrap:anywhere] font-mono'>{cell(row[field])}</pre></td>)}</tr>)}
            </tbody></table>
            <div ref={sentinel} className='h-px' />
        </div>
        {busy && <p role='status' className='mt-2 text-xs text-ui-muted'>Loading rows…</p>}
        {error && <p role='alert' className='mt-2 text-xs text-ui-warning'>{error} <button type='button' onClick={() => consume.current()} className='underline'>Retry</button></p>}
        {(rows.length > 0 || done) && <p className='mt-2 text-xs text-ui-muted'>{rows.length}/{total ?? '…'} {total === 1 ? 'row' : 'rows'}</p>}
    </div>
}

function cell(value: unknown) { return value == null ? 'null' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value) }
function bytes(value: number | null) {
    if (value === null) return '—'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']; let index = 0
    while (value >= 1000 && index < units.length - 1) { value /= 1000; index++ }
    return `${value.toFixed(index ? 2 : 0)} ${units[index]}`
}
