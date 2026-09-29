'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minimize2 } from 'lucide-react'

type Point = { sampled_at: string, pps: number, eps: number, historical_eps: number, npps: number, remaining: number }
export type Metrics = { generated_at: string, current: { pps: number, eps: number, historical_eps: number, npps: number, remaining: number, thresholds: { npps_below: boolean, eps_above: boolean, pps_below: boolean } }, history: Point[] }

const cards = [
    ['PPS', 'pps', 'Events checked per second'],
    ['EPS', 'eps', 'New service logs per second'],
    ['Historical EPS', 'historical_eps', 'Backlog processed per second'],
    ['NPPS', 'npps', 'Incoming load ÷ checked throughput'],
] as const
const chartDescriptions = {
    eps: 'Five-minute average of new service logs per second',
    pps: '',
    npps: 'Five-minute average of incoming load ÷ checked throughput',
} as const
const FIVE_MINUTES = 5 * 60_000

function format(value: number) {
    return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(1)
}
function sampleTime(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function timeWindow(value: string) {
    const end = new Date(value)
    const start = new Date(end.getTime() - FIVE_MINUTES)
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    return `${start.toLocaleString('en-US', options)} – ${end.toLocaleString('en-US', options)}`
}
type Coordinate = { x: number, y: number, sampled_at: string }
function smoothPath(points: Coordinate[]) {
    if (points.length < 2) return points.length ? `M ${points[0].x} ${points[0].y}` : ''
    let path = `M ${points[0].x} ${points[0].y}`
    for (let index = 0; index < points.length - 1; index++) {
        const previous = points[Math.max(0, index - 1)]
        const first = points[index]
        const second = points[index + 1]
        const next = points[Math.min(points.length - 1, index + 2)]
        const control1 = { x: first.x + (second.x - previous.x) / 6, y: first.y + (second.y - previous.y) / 6 }
        const control2 = { x: second.x - (next.x - first.x) / 6, y: second.y - (next.y - first.y) / 6 }
        path += ` C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${second.x} ${second.y}`
    }
    return path
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
    const [hoveredTime, setHoveredTime] = useState<string | null>(null)
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number, y: number } | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const followingLatest = useRef(true)
    const values = points.map(point => Number(point[field]) || 0)
    const max = Math.max(1, ...values)
    const pointSpacing = 52
    const firstTime = Date.parse(points[0]?.sampled_at || '')
    const latestTime = Date.parse(points.at(-1)?.sampled_at || '')
    const bucketSpan = Number.isFinite(firstTime) && Number.isFinite(latestTime) ? Math.max(0, (latestTime - firstTime) / FIVE_MINUTES) : 0
    const width = Math.max(360, 44 + bucketSpan * pointSpacing + 16)
    const height = 220
    const plot = { left: 44, right: 16, top: 12, bottom: 40 }
    const plotHeight = height - plot.top - plot.bottom
    const coordinates = points.map(point => ({
        x: plot.left + Math.max(0, (Date.parse(point.sampled_at) - firstTime) / FIVE_MINUTES) * pointSpacing,
        y: plot.top + plotHeight - ((Number(point[field]) || 0) / max) * plotHeight,
        sampled_at: point.sampled_at,
    }))
    const segments: Coordinate[][] = []
    for (const coordinate of coordinates) {
        const segment = segments.at(-1)
        if (!segment || Date.parse(coordinate.sampled_at) - Date.parse(segment.at(-1)!.sampled_at) > FIVE_MINUTES * 1.5) segments.push([coordinate])
        else segment.push(coordinate)
    }
    const path = segments.map(smoothPath).join(' ')
    const latest = points.at(-1)
    const ticks = [1, 0.75, 0.5, 0.25, 0]
    const unit = field === 'npps' ? '× load ratio' : 'logs per second'
    const hovered = points.find(point => point.sampled_at === hoveredTime)
    const hoveredIndex = hovered ? points.indexOf(hovered) : -1
    const tooltipWidth = scrollRef.current?.clientWidth || 360
    const tooltipLeft = tooltipPosition ? Math.min(Math.max(tooltipPosition.x, 160), Math.max(160, tooltipWidth - 160)) : 0
    const scrollClass = expanded ? 'h-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ui-primary' : 'overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ui-primary'
    const plotAreaClass = expanded ? 'relative mt-3 min-h-0 flex-1' : 'relative mt-3'
    const content = <>
        <div className='flex shrink-0 items-center justify-between gap-2'><div><h3 id={`chart-title-${field}`} className='text-sm font-semibold'>{title}</h3>{chartDescriptions[field] && <p className='text-xs text-ui-muted'>{chartDescriptions[field]}</p>}</div><button type='button' aria-label={expanded ? `Close expanded ${title} chart` : `Expand ${title} chart`} className='rounded-md p-2 text-ui-muted hover:text-ui-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-ui-primary' onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}</button></div>
        <div className={plotAreaClass}>
            {hovered && tooltipPosition && <div id={`chart-tooltip-${field}`} role='tooltip' style={{ left: `${tooltipLeft}px`, top: `${tooltipPosition.y}px`, transform: tooltipPosition.y < 104 ? 'translate(-50%, 12px)' : 'translate(-50%, calc(-100% - 12px))' }} className='pointer-events-none absolute z-20 max-w-[min(22rem,90%)] rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs shadow-lg'>
                <p className='font-semibold'>{field === 'npps' ? 'Five-minute average load ratio' : 'Five-minute average'}</p>
                <p className='mt-0.5 tabular-nums'>{format(Number(hovered[field]) || 0)} {unit}</p>
                <p className='mt-0.5 text-ui-muted'>{timeWindow(hovered.sampled_at)}</p>
            </div>}
            <div ref={scrollRef} role='region' aria-label={`${title} chart history; scroll horizontally for older five-minute averages`} tabIndex={0} onPointerMove={event => {
                const element = event.currentTarget
                const svg = element.querySelector('svg')
                const rect = svg?.getBoundingClientRect()
                if (!svg || !rect || rect.width === 0 || rect.height === 0) return
                const pointerX = (event.clientX - rect.left) * width / rect.width
                const pointerY = (event.clientY - rect.top) * height / rect.height
                if (pointerY < plot.top || pointerY > height - plot.bottom) {
                    setHoveredTime(null)
                    setTooltipPosition(null)
                    return
                }
                let nearestIndex = -1
                let nearestDistance = Number.POSITIVE_INFINITY
                for (let index = 0; index < coordinates.length; index++) {
                    const distance = Math.abs(coordinates[index].x - pointerX)
                    if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index }
                }
                if (nearestIndex < 0 || nearestDistance > pointSpacing / 2) {
                    setHoveredTime(null)
                    setTooltipPosition(null)
                    return
                }
                const coordinate = coordinates[nearestIndex]
                setHoveredTime(points[nearestIndex].sampled_at)
                setTooltipPosition({ x: coordinate.x - element.scrollLeft, y: coordinate.y * rect.height / height })
            }} onPointerLeave={() => { setHoveredTime(null); setTooltipPosition(null) }} onScroll={event => {
                const element = event.currentTarget
                followingLatest.current = element.scrollWidth - element.clientWidth - element.scrollLeft < 32
                if (hoveredIndex >= 0) {
                    const svgHeight = element.querySelector('svg')?.getBoundingClientRect().height || height
                    setTooltipPosition({ x: coordinates[hoveredIndex].x - element.scrollLeft, y: coordinates[hoveredIndex].y * svgHeight / height })
                }
            }} className={scrollClass}>
                <svg role='img' aria-labelledby={`chart-title-${field}`} aria-label={`${title}: ${points.length} five-minute averages from ${sampleTime(points[0]?.sampled_at)} to ${sampleTime(latest?.sampled_at)}. Y axis shows ${unit}.`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none' style={{ width: `${width}px`, height: expanded ? 'min(70dvh, 520px)' : `${height}px` }} className='block max-w-none text-ui-primary'>
                    {ticks.map(fraction => {
                        const y = plot.top + plotHeight * (1 - fraction)
                        return <line key={fraction} x1={plot.left} x2={width - plot.right} y1={y} y2={y} stroke='currentColor' opacity={fraction === 0 ? 0.35 : 0.12} />
                    })}
                    <path d={path || `M ${plot.left} ${plot.top + plotHeight}`} fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
                    {points.map((point, index) => {
                        const coordinate = coordinates[index]
                        const selected = point.sampled_at === hoveredTime
                        const value = Number(point[field]) || 0
                        const label = `${timeWindow(point.sampled_at)}: ${format(value)} ${unit}`
                        return <g key={point.sampled_at} role='button' tabIndex={0} aria-label={label} aria-describedby={selected ? `chart-tooltip-${field}` : undefined} onFocus={() => { setHoveredTime(point.sampled_at); setTooltipPosition({ x: coordinate.x - (scrollRef.current?.scrollLeft || 0), y: coordinate.y * ((scrollRef.current?.querySelector('svg')?.getBoundingClientRect().height || height) / height) }) }} onBlur={() => { setHoveredTime(current => current === point.sampled_at ? null : current); setTooltipPosition(current => current && selected ? null : current) }} className='cursor-crosshair outline-none'>
                            <circle cx={coordinate.x} cy={coordinate.y} r='12' fill='transparent' />
                            <circle cx={coordinate.x} cy={coordinate.y} r={selected ? '4.5' : '2.5'} fill='currentColor' pointerEvents='none' />
                        </g>
                    })}
                    {points.map((point, index) => index % 5 === 0 || index === points.length - 1 ? <text key={point.sampled_at} x={coordinates[index].x} y={height - 12} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} fontSize='10' fill='currentColor' opacity='0.7'>{sampleTime(point.sampled_at)}</text> : null)}
                </svg></div>
            <div aria-hidden='true' className='pointer-events-none absolute left-0 top-0 z-10 h-[220px] w-11 bg-ui-panel' style={{ height: expanded ? 'min(70dvh, 520px)' : `${height}px` }}>
                <svg width='44' height={height} viewBox={`0 0 44 ${height}`} preserveAspectRatio='none' style={{ width: '44px', height: expanded ? 'min(70dvh, 520px)' : `${height}px` }} className='block text-ui-primary'>
                    {ticks.map(fraction => {
                        const y = plot.top + plotHeight * (1 - fraction)
                        const value = max * fraction
                        return <text key={fraction} x={plot.left - 6} y={y + 3.5} textAnchor='end' fontSize='10' fill='currentColor' opacity='0.7'>{field === 'npps' ? `${value.toFixed(1)}×` : format(value)}</text>
                    })}
                </svg>
            </div>
        </div>
    </>
    useEffect(() => {
        const element = scrollRef.current
        if (element && followingLatest.current) element.scrollLeft = element.scrollWidth
    }, [points, expanded])
    useEffect(() => {
        if (!expanded) return
        const previousOverflow = document.body.style.overflow
        const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', closeOnEscape)
        return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
    }, [expanded])
    if (expanded) return createPortal(<div role='dialog' aria-modal='true' aria-labelledby={`chart-title-${field}`} className='fixed inset-0 z-[1100] flex h-dvh w-screen flex-col overflow-hidden bg-ui-panel p-3 sm:p-5'>
        {content}
    </div>, document.body)
    return <div className='flex min-w-0 flex-col rounded-xl border border-ui-border bg-ui-panel p-3'>{content}</div>
}
export default function ThroughputMetrics({ initialMetrics }: { initialMetrics: Metrics | null }) {
    const [metrics, setMetrics] = useState<Metrics | null>(initialMetrics)
    const [now, setNow] = useState(0)
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try { const response = await fetch('/api/backend/logs/metrics', { cache: 'no-store' }); const body = await response.json(); if (response.ok && !cancelled) setMetrics(body) } catch { /* Keep the last successful sample visible. */ }
        }
        setNow(Date.now())
        if (!initialMetrics) void load()
        const interval = setInterval(() => { void load(); setNow(Date.now()) }, 5000)
        return () => { cancelled = true; clearInterval(interval) }
    }, [initialMetrics])
    const points = useMemo(() => metrics?.history || [], [metrics])
    if (!metrics) return null
    return <section id='log-analytics' aria-label='Log throughput metrics' className='grid gap-3' data-log-throughput>
        <div className='grid grid-cols-2 gap-2.5 min-[380px]:gap-3 md:grid-cols-3 xl:grid-cols-5'>{cards.map(([label, key, description]) => <div key={key} className='min-w-0 rounded-xl border border-ui-border bg-ui-panel p-3 sm:p-4'><p className='text-xs text-ui-muted sm:text-sm'>{label}</p><p className='mt-1.5 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl'>{format(metrics.current[key])}</p><p className='mt-1 text-[11px] leading-4 text-ui-muted sm:text-xs'>{description}</p></div>)}<div className='min-w-0 rounded-xl border border-ui-border bg-ui-panel p-3 sm:p-4'><p className='text-xs text-ui-muted sm:text-sm'>Logs remaining</p><p className='mt-1.5 text-xl font-semibold tabular-nums sm:mt-2 sm:text-2xl'>{metrics.current.remaining.toLocaleString('en-US')}</p><p className='mt-1 text-[11px] leading-4 text-ui-muted sm:text-xs'>{age(metrics.generated_at, now)}</p></div></div>
        <div className='grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3'>{(['eps', 'pps', 'npps'] as const).map(field => <Chart key={field} title={field.toUpperCase()} points={points} field={field} />)}</div>
    </section>
}
