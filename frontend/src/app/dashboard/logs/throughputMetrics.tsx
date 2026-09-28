'use client'

import { useEffect, useMemo, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

type Point = { sampled_at: string, pps: number, eps: number, historical_eps: number, npps: number, remaining: number }
type Metrics = { generated_at: string, current: { pps: number, eps: number, historical_eps: number, npps: number, remaining: number, thresholds: { npps_below: boolean, eps_above: boolean, pps_below: boolean } }, history: Point[] }

const cards = [
    ['PPS', 'pps', 'Processed per second'],
    ['EPS', 'eps', 'Incoming events per second'],
    ['Historical EPS', 'historical_eps', 'Backlog processing rate'],
    ['NPPS', 'npps', 'Load ratio: incoming + historical / processing'],
] as const

function format(value: number) {
    return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(1)
}
function age(value: string, now: number) {
    const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000))
    if (seconds < 60) return `Last changed ${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Last changed ${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Last changed ${hours}h ago`
    return `Last changed ${new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })}`
}
function Chart({ title, points, field }: { title: string, points: Point[], field: 'eps' | 'pps' | 'npps' }) {
    const [expanded, setExpanded] = useState(false)
    const values = points.map(point => Number(point[field]) || 0)
    const max = Math.max(1, ...values)
    const width = Math.max(560, points.length * 8)
    const path = values.map((value, index) => `${index ? 'L' : 'M'} ${(index / Math.max(1, values.length - 1)) * (width - 24) + 12} ${112 - (value / max) * 96}`).join(' ')
    return <div className={expanded ? 'fixed inset-4 z-50 rounded-xl border border-ui-border bg-ui-panel p-4 shadow-2xl' : 'rounded-xl border border-ui-border bg-ui-panel p-3'}>
        <div className='flex items-center justify-between gap-2'><h3 className='text-sm font-semibold'>{title}</h3><button type='button' aria-label={expanded ? `Close expanded ${title} chart` : `Expand ${title} chart`} className='rounded-md p-1 text-ui-muted hover:text-ui-text' onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}</button></div>
        <div className='mt-2 overflow-x-auto' onWheel={event => { if (event.deltaY) event.currentTarget.scrollLeft += event.deltaY }}><svg role='img' aria-label={title} width={width} height='128' viewBox={`0 0 ${width} 128`} className='min-w-full'><path d={path || 'M 12 112'} fill='none' stroke='currentColor' strokeWidth='2' className='text-ui-primary' /><line x1='12' x2={width - 12} y1='112' y2='112' stroke='currentColor' className='text-ui-border' /></svg></div>
    </div>
}
export default function ThroughputMetrics() {
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [now, setNow] = useState(Date.now())
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try { const response = await fetch('/api/backend/logs/metrics', { cache: 'no-store' }); const body = await response.json(); if (response.ok && !cancelled) setMetrics(body) } catch { /* Keep the last successful sample visible. */ }
        }
        void load()
        const interval = setInterval(() => { void load(); setNow(Date.now()) }, 5000)
        return () => { cancelled = true; clearInterval(interval) }
    }, [])
    const points = useMemo(() => metrics?.history || [], [metrics])
    if (!metrics) return <section aria-label='Log throughput metrics' className='grid gap-3 sm:grid-cols-5'><div className='sm:col-span-5 rounded-xl border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>Loading throughput metrics &</div></section>
    return <section aria-label='Log throughput metrics' className='grid gap-3' data-log-throughput>
        <div className='grid gap-3 sm:grid-cols-5'>{cards.map(([label, key, description]) => <div key={key} className='rounded-xl border border-ui-border bg-ui-panel p-4'><p className='text-sm text-ui-muted'>{label}</p><p className='mt-2 text-2xl font-semibold tabular-nums'>{format(metrics.current[key])}</p><p className='mt-1 text-xs text-ui-muted'>{description}</p></div>)}<div className='rounded-xl border border-ui-border bg-ui-panel p-4'><p className='text-sm text-ui-muted'>Logs remaining</p><p className='mt-2 text-2xl font-semibold tabular-nums'>{metrics.current.remaining.toLocaleString('en-US')}</p><p className='mt-1 text-xs text-ui-muted'>{age(metrics.generated_at, now)}</p></div></div>
        <div className='grid gap-3 lg:grid-cols-3'>{(['eps', 'pps', 'npps'] as const).map(field => <Chart key={field} title={field.toUpperCase()} points={points} field={field} />)}</div>
    </section>
}
