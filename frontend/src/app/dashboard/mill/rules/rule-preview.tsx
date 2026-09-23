'use client'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { requestJson } from './detection-rules'
import type { Condition } from './condition-builder'

type Event = { id: string, timestamp: string, normalized: Record<string, unknown>, rank: number }
type Cursor = { time: string, id: string } | null
type Page = { count: number, scanned: number, events: Event[], cursor: Cursor }
const value = (event: Event, path: string) => path.split('.').reduce<unknown>((item, key) => item && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined, event.normalized)
const display = (item: unknown) => item == null ? '—' : typeof item === 'object' ? JSON.stringify(item) : String(item)

// Random candidates give every matching event a chance; greedy selection then
// favors different parameter combinations rather than five adjacent records.
export function diverseEvents(pool: Event[], count = 5) {
    const remaining = [...pool], chosen: Event[] = [], seen = new Set<string>()
    const paths = ['event_type', 'service', 'host', 'http.path', 'http.method', 'http.status_code', 'source.ip', 'source.country', 'user.id', 'device.id', 'outcome']
    while (remaining.length && chosen.length < count) {
        const score = (event: Event) => paths.reduce((total, path) => total + (value(event, path) != null && !seen.has(`${path}:${display(value(event, path))}`) ? 1 : 0), 0)
        let best = 0
        for (let index = 1; index < remaining.length; index++) if (score(remaining[index]) > score(remaining[best])) best = index
        const [event] = remaining.splice(best, 1)
        chosen.push(event)
        paths.forEach(path => seen.add(`${path}:${display(value(event, path))}`))
    }
    return chosen
}

export default function RulePreview({ organizationId, conditions, action, range, onReady }: { organizationId: string, conditions: Condition[], action: string, range: string, onReady: (ready: boolean) => void }) {
    const [count, setCount] = useState(0), [scanned, setScanned] = useState(0), [complete, setComplete] = useState(false)
    const [events, setEvents] = useState<Event[]>([]), [error, setError] = useState(''), [acknowledged, setAcknowledged] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const [offset, setOffset] = useState(0), [more, setMore] = useState(true), [loading, setLoading] = useState(false)
    const rows = useRef<Event[]>([]), cursor = useRef<Cursor>(null), seen = useRef(new Set<string>()), busy = useRef(false)
    const window = useRef({ until: new Date().toISOString(), from: range === 'all' ? null : new Date(Date.now() - Number(range) * 3600_000).toISOString() })
    const controller = useRef(new AbortController())
    const endpoint = `/api/backend/mill/rules/preview?organizationId=${encodeURIComponent(organizationId)}`
    const read = (next: Cursor, sample: boolean) => requestJson<Page>(endpoint, { method: 'POST', signal: controller.current.signal, body: JSON.stringify({ ...window.current, conditions, action, cursor: next, sample }) })
    useEffect(() => {
        setError(''); setCount(0); setScanned(0); setComplete(false); setAcknowledged(false)
        const abort = new AbortController()
        controller.current = abort
        const timer = setTimeout(async () => {
            let next: Cursor = null, total = 0, inspected = 0, pool: Event[] = []
            try {
                do {
                    const page = await read(next, true)
                    if (abort.signal.aborted) return
                    total += page.count; inspected += page.scanned; next = page.cursor
                    pool = [...pool, ...page.events].sort((a, b) => a.rank - b.rank).slice(0, 100)
                    const sample = diverseEvents(pool)
                    rows.current = next ? sample : [...sample, ...pool.filter(event => !sample.some(selected => selected.id === event.id))]
                    setEvents(rows.current); setCount(total); setScanned(inspected)
                } while (next)
                seen.current = new Set(rows.current.map(event => event.id))
                setComplete(true)
            } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Preview could not be loaded.') }
        }, 350)
        return () => { clearTimeout(timer); abort.abort() }
        // The parent remounts this snapshot when the organization, rule or range changes.
    }, [attempt])
    useEffect(() => { onReady(complete && (count <= 10_000 || acknowledged)) }, [complete, count, acknowledged, onReady])
    async function prefetch() {
        if (busy.current || !more || !complete || controller.current.signal.aborted) return
        busy.current = true; setLoading(true); setError('')
        try {
            do {
                const page = await read(cursor.current, false)
                if (controller.current.signal.aborted) return
                cursor.current = page.cursor
                const fresh = page.events.filter(event => !seen.current.has(event.id)).sort((a, b) => a.rank - b.rank)
                fresh.forEach(event => seen.current.add(event.id))
                rows.current = [...rows.current, ...fresh]
                setEvents(rows.current)
                if (!page.cursor) { setMore(false); break }
            } while (rows.current.length - offset < 100)
        } catch (cause) { if (!controller.current.signal.aborted) setError(cause instanceof Error ? cause.message : 'More events could not be loaded.') }
        finally { busy.current = false; if (!controller.current.signal.aborted) setLoading(false) }
    }
    useEffect(() => { if (complete) void prefetch() }, [complete])
    const start = Math.max(0, offset - 1), visible = events.slice(start, start + 8)
    const paths = [...new Set(conditions.map(condition => condition.path))]
    return <section className='grid min-w-0 gap-3' aria-label='Matching events preview'>
        <div className='flex flex-wrap items-center justify-between gap-2'><h3 className='font-semibold' aria-live='polite'>{complete ? '' : 'At least '}{new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count)} matching events</h3><span className='text-xs text-ui-muted'>{complete ? `${count.toLocaleString()} matches · ${scanned.toLocaleString()} events checked` : `Checking events… ${scanned.toLocaleString()} checked`}</span></div>
        {count > 10_000 && <div role='alert' className='grid gap-2 rounded-lg border border-amber-500/50 p-3 text-sm'><p>Very many events match this rule. Is this intended?</p><label className='flex items-center gap-2'><input type='checkbox' checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />Yes, I intend to match this many events.</label></div>}
        {!!events.length && <div role='region' aria-label='Matching event rows' tabIndex={0} className='h-[360px] overflow-auto rounded-lg border border-ui-border' onScroll={event => {
            const began = performance.now(), element = event.currentTarget
            const next = Math.floor(element.scrollTop / 64)
            flushSync(() => setOffset(next))
            element.dataset.renderMs = String(performance.now() - began)
            if (rows.current.length - next < 100) void prefetch()
        }}>
            <table className='w-full min-w-[44rem] table-fixed text-left text-xs'><thead className='sticky top-0 z-10 bg-ui-raised'><tr><th className='w-36 p-2'>Time</th><th className='w-32 p-2'>Service / type</th><th className='p-2'>Matching values</th><th className='p-2'>Parameters</th></tr></thead><tbody>
                {start > 0 && <tr aria-hidden='true' style={{ height: start * 64 }}><td colSpan={4} /></tr>}
                {visible.map(event => <tr key={event.id} data-event-id={event.id} style={{ height: 64 }} className='border-t border-ui-border'><td className='p-2'>{new Date(event.timestamp).toLocaleString()}</td><td className='truncate p-2' title={display(event.normalized.service)}>{display(event.normalized.service)}<br />{display(event.normalized.event_type)}</td><td className='p-2'><pre className='max-h-12 overflow-auto whitespace-pre-wrap wrap-break-word'>{paths.map(path => `${path}: ${display(value(event, path))}`).join('\n')}</pre></td><td className='p-2'><pre className='max-h-12 overflow-auto whitespace-pre-wrap wrap-break-word'>{JSON.stringify(Object.fromEntries(['source.ip', 'source.country', 'http.path', 'http.method', 'host', 'user.id', 'device.id', 'outcome'].filter(path => value(event, path) != null && !paths.includes(path)).map(path => [path, value(event, path)])))}</pre></td></tr>)}
                {events.length > start + visible.length && <tr aria-hidden='true' style={{ height: (events.length - start - visible.length) * 64 }}><td colSpan={4} /></tr>}
            </tbody></table>
        </div>}
        {loading && <p role='status' className='text-xs text-ui-muted'>Loading more matches…</p>}
        {complete && !events.length && <p className='text-sm text-ui-muted'>No matching events in this range.</p>}
        {error && <p role='alert' className='text-sm text-red-400'>{error}<button type='button' onClick={() => complete ? void prefetch() : setAttempt(attempt + 1)} className='ml-2 underline'>Retry</button></p>}
    </section>
}
