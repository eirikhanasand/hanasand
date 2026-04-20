'use client'

import { countryCentroids } from '@/utils/monitoring/geo'
import mapData from '@parent/public/world.json'
import { Activity, Clock3, Globe2, MapPinned, Move, Route, Search, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import statusClasses from './statusClasses'

import type { TrafficMetric, TrafficMetrics, TrafficRecord } from '@/utils/monitoring/types'

type TrafficBatch = {
    iso: string
    count: number
    timestamp: string
}

type TrafficCountryPoint = {
    iso: string
    count: number
    lastSeen: number
}

type LivePing = {
    id: number
    start: [number, number]
    end: [number, number]
    startTime: number
    count: number
}

type ViewBox = {
    x: number
    y: number
    width: number
    height: number
}

type CapitalMarker = {
    label: string
    iso: string
    coords: [number, number]
}

const MAP_WIDTH = 1000
const MAP_HEIGHT = 500
const NORWAY: [number, number] = countryCentroids.NO || [62, 10]
const INITIAL_VIEWBOX: ViewBox = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT }
const COUNTRY_EXPIRY_MS = 5 * 60 * 1000
const PING_LIFETIME_MS = 2200
const CAPITAL_MARKERS: CapitalMarker[] = [
    { iso: 'NO', label: 'Oslo', coords: [59.9139, 10.7522] },
    { iso: 'GB', label: 'London', coords: [51.5072, -0.1276] },
    { iso: 'FR', label: 'Paris', coords: [48.8566, 2.3522] },
    { iso: 'DE', label: 'Berlin', coords: [52.52, 13.405] },
    { iso: 'ES', label: 'Madrid', coords: [40.4168, -3.7038] },
    { iso: 'IT', label: 'Rome', coords: [41.9028, 12.4964] },
    { iso: 'US', label: 'Washington', coords: [38.9072, -77.0369] },
    { iso: 'CA', label: 'Ottawa', coords: [45.4215, -75.6972] },
    { iso: 'BR', label: 'Brasilia', coords: [-15.7939, -47.8828] },
    { iso: 'AR', label: 'Buenos Aires', coords: [-34.6037, -58.3816] },
    { iso: 'JP', label: 'Tokyo', coords: [35.6762, 139.6503] },
    { iso: 'CN', label: 'Beijing', coords: [39.9042, 116.4074] },
    { iso: 'IN', label: 'New Delhi', coords: [28.6139, 77.209] },
    { iso: 'AU', label: 'Canberra', coords: [-35.2809, 149.13] },
    { iso: 'ZA', label: 'Cape Town', coords: [-33.9249, 18.4241] },
]

function project([lat, lon]: [number, number]): [number, number] {
    return [(lon + 180) * (MAP_WIDTH / 360), (90 - lat) * (MAP_HEIGHT / 180)]
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function normalizeIso(iso: string) {
    return iso.toUpperCase()
}

function formatRelative(timestamp: number) {
    const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
    if (diffSeconds < 60) return `${diffSeconds}s ago`
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
    return `${Math.floor(diffSeconds / 3600)}h ago`
}

function haversineKilometers([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
    const toRadians = (value: number) => (value * Math.PI) / 180
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)
    const a = (Math.sin(dLat / 2) ** 2)
        + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * (Math.sin(dLon / 2) ** 2)
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function getCountryFocusView(coords: [number, number]) {
    const [x, y] = project(coords)
    return clampViewBox({ x: x - 140, y: y - 80, width: 280, height: 160 })
}

export default function LiveTrafficMapDashboard({
    initialMetrics,
    initialRecords,
}: {
    initialMetrics: TrafficMetrics | null
    initialRecords: TrafficRecord[]
}) {
    const [status, setStatus] = useState('Connecting…')
    const [isConnected, setIsConnected] = useState(false)
    const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX)
    const [pings, setPings] = useState<LivePing[]>([])
    const [countries, setCountries] = useState<Record<string, TrafficCountryPoint>>({})
    const [selectedCountry, setSelectedCountry] = useState<string>('NO')
    const dragRef = useRef<{ x: number, y: number, viewBox: ViewBox } | null>(null)
    const frameRef = useRef<number>(0)

    useEffect(() => {
        if (!initialRecords.length) return

        const hydratedCountries = initialRecords.reduce<Record<string, TrafficCountryPoint>>((acc, record) => {
            const iso = normalizeIso((record as TrafficRecord & { country_iso?: string }).country_iso || '')
            if (!iso || iso === 'UNKNOWN' || !countryCentroids[iso]) return acc
            const lastSeen = new Date(record.timestamp).getTime()
            const current = acc[iso]
            acc[iso] = {
                iso,
                count: (current?.count || 0) + 1,
                lastSeen: Math.max(current?.lastSeen || 0, lastSeen),
            }
            return acc
        }, {})

        setCountries((prev) => Object.keys(prev).length ? prev : hydratedCountries)
    }, [initialRecords])

    useEffect(() => {
        const es = new EventSource('/api/live-traffic')

        const handleBatch = (data: string) => {
            if (!data || data === 'connected') return
            try {
                const batch = JSON.parse(data) as TrafficBatch[]
                if (Array.isArray(batch)) {
                    applyTrafficBatch(batch, setCountries, setPings)
                }
            } catch (error) {
                console.error('Failed to parse live traffic batch:', error)
            }
        }

        es.onopen = () => {
            setStatus('Connected')
            setIsConnected(true)
        }

        es.onmessage = (event) => {
            if (event.data === 'connected') {
                setStatus('Streaming live traffic')
                return
            }
            handleBatch(event.data)
        }

        es.addEventListener('traffic', (event) => {
            handleBatch((event as MessageEvent).data)
        })

        es.onerror = () => {
            setStatus('Disconnected')
            setIsConnected(false)
            es.close()
        }

        return () => es.close()
    }, [])

    useEffect(() => {
        function tick() {
            const now = Date.now()
            setPings((prev) => prev.filter((ping) => now - ping.startTime < PING_LIFETIME_MS))
            setCountries((prev) => Object.fromEntries(
                Object.entries(prev).filter(([, value]) => now - value.lastSeen < COUNTRY_EXPIRY_MS)
            ))
            frameRef.current = requestAnimationFrame(tick)
        }

        frameRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frameRef.current)
    }, [])

    const countryEntries = useMemo(
        () => Object.values(countries).sort((a, b) => b.count - a.count),
        [countries]
    )
    const selectedPoint = selectedCountry ? countries[selectedCountry] : null
    const selectedCoords = selectedCountry ? countryCentroids[selectedCountry] : null
    const selectedCapital = CAPITAL_MARKERS.find((marker) => marker.iso === selectedCountry)
    const totalTrackedRequests = countryEntries.reduce((sum, item) => sum + item.count, 0)
    const selectedRank = countryEntries.findIndex((entry) => entry.iso === selectedCountry) + 1
    const selectedShare = selectedPoint && totalTrackedRequests
        ? Math.round((selectedPoint.count / totalTrackedRequests) * 100)
        : 0
    const selectedRecords = useMemo(
        () => initialRecords
            .filter((record) => (
                !selectedCountry
                || (record as TrafficRecord & { country_iso?: string }).country_iso === selectedCountry
            ))
            .slice(0, 6),
        [initialRecords, selectedCountry]
    )

    const mapPaths = useMemo(() => mapData.features.map((feature, index) => {
        let d = ''

        function drawRing(ring: number[][]) {
            return ring.reduce((path, point, pointIndex) => {
                const [x, y] = project([point[1], point[0]])
                return `${path}${pointIndex === 0 ? 'M' : 'L'} ${x} ${y} `
            }, '') + 'Z '
        }

        if (feature.geometry.type === 'Polygon') {
            ;(feature.geometry.coordinates as number[][][]).forEach((ring) => {
                d += drawRing(ring)
            })
        } else if (feature.geometry.type === 'MultiPolygon') {
            ;(feature.geometry.coordinates as number[][][][]).forEach((polygon) => {
                polygon.forEach((ring) => {
                    d += drawRing(ring)
                })
            })
        }

        return (
            <path
                key={index}
                d={d}
                className='fill-white/5 stroke-white/10 stroke-[0.6] transition-colors hover:fill-white/8'
            />
        )
    }), [])

    const strongestCountryCount = countryEntries[0]?.count || 1

    return (
        <div className='grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_22rem]'>
            <section
                className='flex min-h-168 flex-col rounded-2xl border border-login-100/10
                    bg-login-900/60 shadow-[0_20px_60px_rgba(0,0,0,0.2)]'
            >
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-login-100/10 px-5 py-4'>
                    <div>
                        <h1 className='text-xl font-semibold text-login-50'>Live Traffic Map</h1>
                        <p className='mt-1 text-sm text-login-100'>
                            Zoomable global view of recent request hotspots, live ingress pulses, and top traffic signals.
                        </p>
                    </div>
                    <div
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                            isConnected
                                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                : 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                        }`}
                    >
                        <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                        {status}
                    </div>
                </div>

                <div className='grid gap-3 border-b border-login-100/10 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4'>
                    <StatCard
                        icon={<Globe2 className='h-4 w-4' />}
                        label='Active Countries'
                        value={String(countryEntries.length)}
                    />
                    <StatCard
                        icon={<Activity className='h-4 w-4' />}
                        label='Tracked Requests'
                        value={String(countryEntries.reduce((sum, item) => sum + item.count, 0))}
                    />
                    <StatCard icon={<Zap className='h-4 w-4' />} label='Top Country' value={countryEntries[0]?.iso || '—'} />
                    <StatCard
                        icon={<Clock3 className='h-4 w-4' />}
                        label='Avg Request Time'
                        value={initialMetrics ? `${Math.round(initialMetrics.avg_request_time || 0)}ms` : '—'}
                    />
                </div>

                <div className='relative flex-1 overflow-hidden'>
                    <div
                        className='absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,190,92,0.12),_transparent_35%),
                            linear-gradient(180deg,rgba(11,15,23,0.95),rgba(6,8,14,1))]'
                    />
                    <div
                        className='absolute left-4 top-4 z-20 rounded-full border border-login-100/10
                            bg-login-950/80 px-3 py-1.5 text-xs text-login-200 backdrop-blur'
                    >
                        <span className='inline-flex items-center gap-2'>
                            <Move className='h-3.5 w-3.5' />
                            Drag to pan • wheel to zoom
                        </span>
                    </div>
                    <div
                        className='absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full
                            border border-login-100/10 bg-login-950/80 p-1 backdrop-blur'
                    >
                        <ZoomButton
                            label='−'
                            onClick={() => setViewBox((current) => zoomViewBox(current, 1.18, MAP_WIDTH / 2, MAP_HEIGHT / 2))}
                        />
                        <ZoomButton label='Reset' wide onClick={() => setViewBox(INITIAL_VIEWBOX)} />
                        <ZoomButton
                            label='+'
                            onClick={() => setViewBox((current) => zoomViewBox(current, 0.84, MAP_WIDTH / 2, MAP_HEIGHT / 2))}
                        />
                    </div>

                    <svg
                        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                        className='relative z-10 h-full w-full cursor-grab active:cursor-grabbing'
                        onMouseDown={(event) => {
                            dragRef.current = { x: event.clientX, y: event.clientY, viewBox }
                        }}
                        onMouseMove={(event) => {
                            if (!dragRef.current) return
                            const scaleX = dragRef.current.viewBox.width / MAP_WIDTH
                            const scaleY = dragRef.current.viewBox.height / MAP_HEIGHT
                            setViewBox(clampViewBox({
                                ...dragRef.current.viewBox,
                                x: dragRef.current.viewBox.x - ((event.clientX - dragRef.current.x) * scaleX),
                                y: dragRef.current.viewBox.y - ((event.clientY - dragRef.current.y) * scaleY),
                            }))
                        }}
                        onMouseUp={() => { dragRef.current = null }}
                        onMouseLeave={() => { dragRef.current = null }}
                        onWheel={(event) => {
                            event.preventDefault()
                            const rect = event.currentTarget.getBoundingClientRect()
                            const px = ((event.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x
                            const py = ((event.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y
                            const factor = event.deltaY > 0 ? 1.12 : 0.88
                            setViewBox((current) => zoomViewBox(current, factor, px, py))
                        }}
                    >
                        <g className='opacity-90'>{mapPaths}</g>

                        {CAPITAL_MARKERS.map((marker) => {
                            const [x, y] = project(marker.coords)
                            const selected = marker.iso === selectedCountry
                            return (
                                <g
                                    key={marker.label}
                                    onClick={() => {
                                        setSelectedCountry(marker.iso)
                                        setViewBox(getCountryFocusView(marker.coords))
                                    }}
                                    className='cursor-pointer'
                                >
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={selected ? 3.2 : 2.2}
                                        className={selected ? 'fill-login-50' : 'fill-login-100/80'}
                                    />
                                    <text
                                        x={x + 6}
                                        y={y - 6}
                                        className={`text-[9px] font-medium ${
                                            selected ? 'fill-login-50' : 'fill-login-200/80'
                                        }`}
                                    >
                                        {marker.label}
                                    </text>
                                </g>
                            )
                        })}

                        {countryEntries.map((entry) => {
                            const coords = countryCentroids[entry.iso]
                            if (!coords) return null
                            const [x, y] = project(coords)
                            const radius = 4 + ((entry.count / strongestCountryCount) * 12)
                            const active = selectedCountry === entry.iso

                            return (
                                <g
                                    key={entry.iso}
                                    onClick={() => {
                                        setSelectedCountry(entry.iso)
                                        setViewBox(getCountryFocusView(coords))
                                    }}
                                    className='cursor-pointer'
                                >
                                    <circle cx={x} cy={y} r={radius + 8} className='fill-login/8' />
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={radius}
                                        className={active
                                            ? 'fill-login/30 stroke-login stroke-1'
                                            : 'fill-amber-300/70 stroke-login-950/40 stroke-[1.5]'}
                                    />
                                    <text
                                        x={x}
                                        y={y - radius - 5}
                                        textAnchor='middle'
                                        className='fill-login-50/30 text-[10px] font-semibold'
                                    >
                                        {entry.iso}
                                    </text>
                                </g>
                            )
                        })}

                        {pings.map((ping) => {
                            const [x1, y1] = project(ping.start)
                            const [x2, y2] = project(ping.end)
                            const dx = x2 - x1
                            const dy = y2 - y1
                            const dist = Math.sqrt((dx * dx) + (dy * dy))
                            const cx = (x1 + x2) / 2
                            const cy = (y1 + y2) / 2 - (dist * 0.35)
                            const progress = (Date.now() - ping.startTime) / PING_LIFETIME_MS
                            const inverse = 1 - progress
                            const px = (inverse * inverse * x1)
                                + (2 * inverse * progress * cx)
                                + (progress * progress * x2)
                            const py = (inverse * inverse * y1)
                                + (2 * inverse * progress * cy)
                                + (progress * progress * y2)

                            return (
                                <g key={ping.id}>
                                    <path
                                        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                                        className='fill-none stroke-login/15 stroke-[1.2]'
                                    />
                                    <circle cx={px} cy={py} r={2 + Math.min(4, ping.count)} className='fill-login blur-[1px]' />
                                    <circle cx={px} cy={py} r='1.5' className='fill-white' />
                                </g>
                            )
                        })}

                        <circle cx={project(NORWAY)[0]} cy={project(NORWAY)[1]} r='7' className='fill-login/30 blur-sm' />
                        <circle cx={project(NORWAY)[0]} cy={project(NORWAY)[1]} r='3.5' className='fill-white' />
                    </svg>
                </div>
            </section>

            <aside className='flex min-h-168 flex-col gap-4 overflow-auto'>
                <InsightCard
                    title={selectedCountry === 'NO' ? 'Local Focus' : `Country Focus · ${selectedCountry}`}
                    icon={<Search className='h-4 w-4 stroke-blue-400' />}
                >
                    <div className='space-y-2 text-sm text-login-100'>
                        <div
                            className='flex items-center justify-between rounded-xl border border-login-100/10
                                bg-login-900/60 px-3 py-2'
                        >
                            <span>Requests observed</span>
                            <span className='font-semibold text-login-50'>{selectedPoint?.count || 0}</span>
                        </div>
                        <div
                            className='flex items-center justify-between rounded-xl border border-login-100/10
                                bg-login-900/60 px-3 py-2'
                        >
                            <span>Last seen</span>
                            <span className='font-semibold text-login-50'>
                                {selectedPoint ? formatRelative(selectedPoint.lastSeen) : 'No recent activity'}
                            </span>
                        </div>
                        <div
                            className='flex items-center justify-between rounded-xl border border-login-100/10
                                bg-login-900/60 px-3 py-2'
                        >
                            <span>Live share</span>
                            <span className='font-semibold text-login-50'>{selectedShare ? `${selectedShare}%` : '—'}</span>
                        </div>
                        <div
                            className='flex items-center justify-between rounded-xl border border-login-100/10
                                bg-login-900/60 px-3 py-2'
                        >
                            <span>Hotspot rank</span>
                            <span className='font-semibold text-login-50'>{selectedRank || '—'}</span>
                        </div>
                        <div className='grid gap-2 sm:grid-cols-2'>
                            <div
                                className='rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-3'
                            >
                                <div className='mb-1 flex items-center gap-2 text-sky-200'>
                                    <MapPinned className='h-4 w-4' />
                                    <span className='text-xs font-medium uppercase tracking-[0.18em]'>Capital</span>
                                </div>
                                <div className='text-sm font-semibold text-login-50'>{selectedCapital?.label || 'Unknown'}</div>
                            </div>
                            <div
                                className='rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-3'
                            >
                                <div className='mb-1 flex items-center gap-2 text-amber-200'>
                                    <Route className='h-4 w-4' />
                                    <span className='text-xs font-medium uppercase tracking-[0.18em]'>Oslo Distance</span>
                                </div>
                                <div className='text-sm font-semibold text-login-50'>
                                    {selectedCoords ? `${haversineKilometers(selectedCoords, NORWAY)} km` : '—'}
                                </div>
                            </div>
                        </div>
                        <div
                            className='flex items-center justify-between rounded-xl border border-login-100/10
                                bg-login-900/60 px-3 py-2'
                        >
                            <span>Recent requests listed</span>
                            <span className='font-semibold text-login-50'>{selectedRecords.length}</span>
                        </div>
                    </div>
                </InsightCard>

                <InsightCard title='Live Hotspots' icon={<Globe2 className='h-4 w-4 stroke-green-500' />}>
                    <div className='space-y-2'>
                        {countryEntries.length ? countryEntries.slice(0, 8).map((entry) => (
                            <button
                                key={entry.iso}
                                type='button'
                                onClick={() => {
                                    setSelectedCountry(entry.iso)
                                    const coords = countryCentroids[entry.iso]
                                    if (coords) setViewBox(getCountryFocusView(coords))
                                }}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                                    selectedCountry === entry.iso
                                        ? 'border-login/30 bg-login/10 text-login-50'
                                        : 'border-login-100/10 bg-login-900/60 text-login-100 '
                                            + 'hover:border-login-100/20 hover:bg-login-50/5'
                                }`}
                            >
                                <div>
                                    <div className='font-medium'>{entry.iso}</div>
                                    <div className='text-xs text-login-200'>Updated {formatRelative(entry.lastSeen)}</div>
                                </div>
                                <div className='rounded-full bg-login-50/8 px-2.5 py-1 text-xs font-semibold'>{entry.count}</div>
                            </button>
                        )) : (
                            <EmptyCopy text='Country activity will populate as soon as live traffic arrives.' />
                        )}
                    </div>
                </InsightCard>

                <InsightCard title='Traffic Signals' icon={<Activity className='h-4 w-4 stroke-login' />}>
                    <SignalGroup title='Top Paths' entries={initialMetrics?.top_paths || []} valueLabel='requests' />
                    <SignalGroup title='Methods' entries={initialMetrics?.top_methods || []} valueLabel='requests' />
                    <SignalGroup title='Statuses' entries={initialMetrics?.top_status_codes || []} valueLabel='hits' />
                </InsightCard>

                <InsightCard title='Recent Requests' icon={<Clock3 className='h-4 w-4 stroke-green-500' />}>
                    <div className='space-y-2'>
                        {initialRecords.length ? selectedRecords.map((record) => (
                            <div key={record.id} className='rounded-xl border border-login-100/10 bg-login-900/60 p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-sm font-medium text-login-50'>{record.method} {record.path}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClasses(record.status)}`}>
                                        {record.status}
                                    </span>
                                </div>
                                <div className='mt-2 flex items-center justify-between text-xs text-login-200'>
                                    <span className='truncate'>{record.domain}</span>
                                    <span>{record.request_time}ms</span>
                                </div>
                            </div>
                        )) : (
                            <EmptyCopy text='Recent requests will appear here once records are available.' />
                        )}
                    </div>
                </InsightCard>
            </aside>
        </div>
    )
}

function applyTrafficBatch(
    batch: TrafficBatch[],
    setCountries: React.Dispatch<React.SetStateAction<Record<string, TrafficCountryPoint>>>,
    setPings: React.Dispatch<React.SetStateAction<LivePing[]>>
) {
    const now = Date.now()

    setCountries((prev) => {
        const next = { ...prev }
        batch.forEach((item) => {
            const iso = normalizeIso(item.iso)
            const current = next[iso]
            next[iso] = {
                iso,
                count: (current?.count || 0) + item.count,
                lastSeen: now,
            }
        })
        return next
    })

    setPings((prev) => [
        ...prev,
        ...batch.flatMap((item) => {
            const iso = normalizeIso(item.iso)
            const start = countryCentroids[iso]
            if (!start || iso === 'NO') return []
            return [{ id: Math.random(), start, end: NORWAY, startTime: now, count: item.count }]
        })
    ])
}

function clampViewBox(next: ViewBox) {
    const width = clamp(next.width, MAP_WIDTH * 0.2, MAP_WIDTH)
    const height = clamp(next.height, MAP_HEIGHT * 0.2, MAP_HEIGHT)

    return {
        width,
        height,
        x: clamp(next.x, 0, MAP_WIDTH - width),
        y: clamp(next.y, 0, MAP_HEIGHT - height),
    }
}

function zoomViewBox(current: ViewBox, factor: number, centerX: number, centerY: number) {
    const width = clamp(current.width * factor, MAP_WIDTH * 0.2, MAP_WIDTH)
    const height = clamp(current.height * factor, MAP_HEIGHT * 0.2, MAP_HEIGHT)
    const offsetX = (centerX - current.x) / current.width
    const offsetY = (centerY - current.y) / current.height

    return clampViewBox({
        width,
        height,
        x: centerX - (width * offsetX),
        y: centerY - (height * offsetY),
    })
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-xl border border-login-100/10 bg-login-900/60 p-4'>
            <div className='flex items-center justify-between text-login-200'>
                <span className='text-[11px] font-medium uppercase tracking-[0.18em]'>{label}</span>
                <div className='rounded-full border border-login-100/10 bg-login-50/5 p-2'>{icon}</div>
            </div>
            <div className='mt-3 text-2xl font-semibold text-login-50'>{value}</div>
        </div>
    )
}

function InsightCard({ children, icon, title }: { children: React.ReactNode, icon: React.ReactNode, title: string }) {
    return (
        <section className='rounded-2xl border border-login-100/10 bg-login-900/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]'>
            <div className='mb-3 flex items-center gap-3'>
                <div className='rounded-full border border-login-100/10 bg-login-50/5 p-2 text-login-100'>{icon}</div>
                <h2 className='font-semibold text-login-50'>{title}</h2>
            </div>
            {children}
        </section>
    )
}

function SignalGroup({
    entries,
    title,
    valueLabel,
}: {
    entries: TrafficMetric[]
    title: string
    valueLabel: string
}) {
    return (
        <div className='mb-4 last:mb-0'>
            <div className='mb-2 text-xs font-medium uppercase tracking-[0.18em] text-login-200'>{title}</div>
            <div className='space-y-2'>
                {entries.length ? entries.slice(0, 4).map((entry) => (
                    <div key={entry.key} className='rounded-xl border border-login-100/10 bg-login-900/60 px-3 py-2'>
                        <div className='truncate text-sm font-medium text-login-50'>{entry.key}</div>
                        <div className='mt-1 text-xs text-login-200'>{entry.count} {valueLabel}</div>
                    </div>
                )) : <EmptyCopy text={`No ${title.toLowerCase()} available yet.`} />}
            </div>
        </div>
    )
}

function EmptyCopy({ text }: { text: string }) {
    return (
        <div className='rounded-xl border border-dashed border-login-100/10 bg-login-900/40 px-3 py-4 text-sm text-login-200'>
            {text}
        </div>
    )
}

function ZoomButton({ label, onClick, wide = false }: { label: string, onClick: () => void, wide?: boolean }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`rounded-full border border-login-100/10 bg-login-50/5 px-3 py-1.5
                text-sm text-login-50 transition hover:border-login-100/20 hover:bg-login-50/10
                ${wide ? 'min-w-18' : 'min-w-10'}`}
        >
            {label}
        </button>
    )
}
