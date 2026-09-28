'use client'

import { useEffect, useMemo, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

type Point = { sampled_at: string, pps: number, eps: number, historical_eps: number, npps: number, remaining: number }
type Metrics = { generated_at: string, current: { pps: number, eps: number, historical_eps: number, npps: number, remaining: number, thresholds: { npps_below: boolean, eps_above: boolean, pps_below: boolean } }, history: Point[] }

const cards = [
    ['PPS', 'pps', 'Events checked per second'],
    ['EPS', 'eps', 'New service logs per second'],
    ['Historical EPS', 'historical_eps', 'Backlog processed per second'],
    ['NPPS', 'npps', 'Incoming load ÷ checked throughput'],
] as const
const chartDescriptions = {
    eps: 'New service logs per second',
    pps: 'Events checked per second',
    npps: 'Incoming load ÷ checked throughput; above 1 means the backlog can grow',
} as const

function format(value: number) {
    return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(1)
}
function sampleTime(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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
    const width = 360
    const height = 164
    const plot = { left: 44, right: 8, top: 12, bottom: 36 }
    const plotWidth = width - plot.left - plot.right
    const plotHeight = height - plot.top - plot.bottom
    const stride = Math.max(1, Math.ceil(points.length / 240))
    const visible = points.filter((_, index) => index % stride === 0 || index === points.length - 1)
    const path = visible.map((point, index) => {
        const x = plot.left + (index / Math.max(1, visible.length - 1)) * plotWidth
        const y = plot.top + plotHeight - ((Number(point[field]) || 0) / max) * plotHeight
        return `${index ? 'L' : 'M'} ${x} ${y}`
    }).join(' ')
    const latest = visible.at(-1)
    const ticks = [1, 0.75, 0.5, 0.25, 0]
    const unit = field === 'npps' ? '× load ratio' : 'events / second'
    return <div className={expanded ? 'fixed inset-4 z-50 rounded-xl border border-ui-border bg-ui-panel p-4 shadow-2xl' : 'rounded-xl border border-ui-border bg-ui-panel p-3'}>
        <div className='flex items-center justify-between gap-2'><div><h3 className='text-sm font-semibold'>{title}</h3><p className='text-xs text-ui-muted'>{chartDescriptions[field]}</p></div><button type='button' aria-label={expanded ? `Close expanded ${title} chart` : `Expand ${title} chart`} className='rounded-md p-1 text-ui-muted hover:text-ui-text' onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}</button></div>
        <div className='mt-2 min-w-0'><svg role='img' aria-label={`${title}: ${format(Number(latest?.[field]) || 0)} ${unit}, sampled from ${sampleTime(visible[0]?.sampled_at)} to ${sampleTime(latest?.sampled_at)}. Y axis shows ${unit}.`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className='block h-auto w-full'>
            {ticks.map(fraction => {
                const y = plot.top + plotHeight * (1 - fraction)
                const value = max * fraction
                return <g key={fraction}><line x1={plot.left} x2={width - plot.right} y1={y} y2={y} stroke='currentColor' opacity={fraction === 0 ? 0.35 : 0.12} /><text x={plot.left - 6} y={y + 3.5} textAnchor='end' fontSize='10' fill='currentColor' opacity='0.7'>{field === 'npps' ? `${value.toFixed(1)}×` : format(value)}</text></g>
            })}
            <path d={path || `M ${plot.left} ${plot.top + plotHeight}`} fill='none' stroke='currentColor' strokeWidth='2' className='text-ui-primary' />
            {latest && <circle cx={plot.left + plotWidth} cy={plot.top + plotHeight - ((Number(latest[field]) || 0) / max) * plotHeight} r='3.5' fill='currentColor' className='text-ui-primary'><title>{`${sampleTime(latest.sampled_at)}: ${format(Number(latest[field]) || 0)} ${unit}`}</title></circle>}
            <text x={plot.left} y={height - 10} fontSize='10' fill='currentColor' opacity='0.7'>{sampleTime(visible[0]?.sampled_at)}</text>
            <text x={width - plot.right} y={height - 10} textAnchor='end' fontSize='10' fill='currentColor' opacity='0.7'>{sampleTime(latest?.sampled_at)}</text>
            <text x={width / 2} y={height - 10} textAnchor='middle' fontSize='9' fill='currentColor' opacity='0.7'>6 hours · {points.length.toLocaleString('en-US')} samples</text>
        </svg></div>
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
    if (!metrics) return <section aria-label='Log throughput metrics' className='grid gap-3'><div className='rounded-xl border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>Loading throughput metrics…</div></section>
    return <section id='log-analytics' aria-label='Log throughput metrics' className='grid gap-3' data-log-throughput>
        <div className='grid grid-cols-2 gap-2.5 min-[380px]:gap-3 md:grid-cols-3 xl:grid-cols-5'>{cards.map(([label, key, description]) => <div key={key} className='min-w-0 rounded-xl border border-ui-border bg-ui-panel p-3 sm:p-4'><p className='text-xs text-ui-muted sm:text-sm'>{label}</p><p className='mt-1.5 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl'>{format(metrics.current[key])}</p><p className='mt-1 text-[11px] leading-4 text-ui-muted sm:text-xs'>{description}</p></div>)}<div className='min-w-0 rounded-xl border border-ui-border bg-ui-panel p-3 sm:p-4'><p className='text-xs text-ui-muted sm:text-sm'>Logs remaining</p><p className='mt-1.5 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl'>{metrics.current.remaining.toLocaleString('en-US')}</p><p className='mt-1 text-[11px] leading-4 text-ui-muted sm:text-xs'>{age(metrics.generated_at, now)}</p></div></div>
        <div className='grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3'>{(['eps', 'pps', 'npps'] as const).map(field => <Chart key={field} title={field.toUpperCase()} points={points} field={field} />)}</div>
    </section>
}
