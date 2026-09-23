'use client'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Check, CircleAlert } from 'lucide-react'
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
    const browsing = useRef(false)
    const rows = useRef<Event[]>([]), cursor = useRef<Cursor>(null), seen = useRef(new Set<string>()), busy = useRef(false)
    const window = useRef({ until: new Date().toISOString(), from: range === 'all' ? null : new Date(Date.now() - Number(range) * 3600_000).toISOString() })
    const controller = useRef(new AbortController())
    const endpoint = `/api/backend/mill/rules/preview?organizationId=${encodeURIComponent(organizationId)}`
    const read = (next: Cursor, sample: boolean) => requestJson<Page>(endpoint, { method: 'POST', signal: controller.current.signal, body: JSON.stringify({ ...window.current, conditions, action, cursor: next, sample }) })
    useEffect(() => {
        setError(''); setCount(0); setScanned(0); setComplete(false); setAcknowledged(false); setMore(true); setOffset(0); setEvents([])
        browsing.current = false; rows.current = []; cursor.current = null; seen.current = new Set(); busy.current = false
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
                    if (!browsing.current) {
                        rows.current = [...sample, ...pool.filter(event => !sample.some(selected => selected.id === event.id))]
                        seen.current = new Set(rows.current.map(event => event.id))
                        setEvents(rows.current)
                    }
                    setCount(total); setScanned(inspected)
                } while (next)
                seen.current = new Set(rows.current.map(event => event.id))
                setComplete(true)
            } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Preview could not be loaded.') }
        }, 350)
        return () => { clearTimeout(timer); abort.abort() }
        // The parent remounts this snapshot when the organization, rule or range changes.
    }, [attempt])
    useEffect(() => { onReady(!error && (complete && count <= 10_000 || count > 10_000 && acknowledged)) }, [complete, count, acknowledged, error, onReady])
    async function prefetch() {
        if (busy.current || !more || !rows.current.length || controller.current.signal.aborted) return
        const abort = controller.current
        browsing.current = true
        busy.current = true; setLoading(true); if (complete) setError('')
        try {
            do {
                const page = await read(cursor.current, false)
                if (abort.signal.aborted) return
                cursor.current = page.cursor
                const fresh = page.events.filter(event => !seen.current.has(event.id)).sort((a, b) => a.rank - b.rank)
                fresh.forEach(event => seen.current.add(event.id))
                rows.current = [...rows.current, ...fresh]
                setEvents(rows.current)
                if (!page.cursor) { setMore(false); break }
            } while (rows.current.length - offset < 100)
        } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'More events could not be loaded.') }
        finally { if (controller.current === abort) { busy.current = false; if (!abort.signal.aborted) setLoading(false) } }
    }
    useEffect(() => { if (complete) void prefetch() }, [complete])
    const start = Math.max(0, offset - 1), visible = events.slice(start, start + 8)
    const paths = [...new Set(conditions.map(condition => condition.path))]
    return <section className='grid min-w-0 gap-3' aria-label='Matching events preview'>
        <div className='flex flex-wrap items-center justify-between gap-2'><h3 className='font-semibold' aria-live='polite'>{complete ? '' : 'At least '}{new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count)} matching events</h3><span className='text-xs text-ui-muted'>{complete ? `${count.toLocaleString()} matches · ${scanned.toLocaleString()} events checked` : `Checking events… ${scanned.toLocaleString()} checked`}</span></div>
        {!!events.length && <div role='region' aria-label='Matching event rows' tabIndex={0} style={{ overflowAnchor: 'none' }} className='h-[360px] overflow-auto rounded-lg border border-ui-border' onScroll={event => {
            browsing.current = true
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
        {count > 10_000 && <div className='mt-2 overflow-hidden rounded-xl border border-ui-border bg-ui-raised'>
            <div className='flex items-start gap-3 p-4 sm:p-5'>
                <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500'><CircleAlert size={20} aria-hidden='true' /></span>
                <div className='grid gap-1'><p className='text-sm font-semibold'>This rule matches {complete ? '' : 'at least '}{count.toLocaleString()} events</p><p className='text-sm text-ui-muted'>Very many events match this rule. Is this intended?</p></div>
            </div>
            <label className={`relative flex cursor-pointer items-center gap-3 border-t border-ui-border px-4 py-4 transition-colors sm:px-5 ${acknowledged ? 'bg-ui-primary/10' : 'hover:bg-ui-primary/5'}`}>
                <input type='checkbox' className='peer absolute z-10 size-5 cursor-pointer opacity-0' checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
                <span aria-hidden='true' className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ui-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ui-raised ${acknowledged ? 'border-ui-primary bg-ui-primary text-ui-canvas' : 'border-ui-muted bg-ui-canvas'}`}><Check size={14} strokeWidth={3} className={acknowledged ? 'opacity-100' : 'opacity-0'} /></span>
                <span className='text-sm font-medium'>Yes, I intend to match this many events.</span>
            </label>
        </div>}
    </section>
}
