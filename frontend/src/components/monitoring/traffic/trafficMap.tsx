'use client'

import { countryCentroids } from '@/utils/monitoring/geo'
import {
    applyTrafficBatch,
    CAPITAL_MARKERS,
    clampViewBox,
    COUNTRY_EXPIRY_MS,
    countryIsoForTrafficRecord,
    formatRelative,
    getCountryFocusView,
    haversineKilometers,
    hydrateCountries,
    INITIAL_VIEWBOX,
    type LivePing,
    MAP_HEIGHT,
    MAP_WIDTH,
    NORWAY,
    PING_LIFETIME_MS,
    project,
    type TrafficBatch,
    type TrafficCountryPoint,
    type ViewBox,
    zoomViewBox,
} from '@/utils/monitoring/liveTrafficMap'
import mapData from '@parent/public/world.json'
import { Activity, Clock3, Globe2, MapPinned, Move, Route, Search, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyCopy, InsightCard, SignalGroup, StatCard, ZoomButton } from './liveMapPrimitives'
import statusClasses from './statusClasses'

import type { TrafficMetrics, TrafficRecord } from '@/utils/monitoring/types'

export default function TrafficMap({
    initialMetrics,
    initialRecords,
}: {
    initialMetrics: TrafficMetrics | null
    initialRecords: TrafficRecord[]
}) {
    const [status, setStatus] = useState(initialRecords.length || Number(initialMetrics?.total_requests || 0) ? 'Live traffic active' : 'Connecting traffic stream')
    const [isConnected, setIsConnected] = useState(false)
    const [isPolling, setIsPolling] = useState(false)
    const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX)
    const [pings, setPings] = useState<LivePing[]>([])
    const [countries, setCountries] = useState<Record<string, TrafficCountryPoint>>(() => ({
        ...hydrateMetricCountries(initialMetrics),
        ...hydrateCountries(initialRecords),
    }))
    const [liveRecords, setLiveRecords] = useState<TrafficRecord[]>(initialRecords)
    const [selectedCountry, setSelectedCountry] = useState<string>('NO')
    const [now, setNow] = useState(() => Date.now())
    const dragRef = useRef<{ x: number, y: number, viewBox: ViewBox } | null>(null)
    const frameRef = useRef<number>(0)
    const recordCountRef = useRef(initialRecords.length)

    useEffect(() => {
        recordCountRef.current = liveRecords.length
    }, [liveRecords.length])

    useEffect(() => {
        let es: EventSource | null = null
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        let stopped = false

        const connect = () => {
            if (stopped) return
            setStatus('Connecting traffic stream')
            es = new EventSource('/api/live-traffic')

            const handleBatch = (data: string) => {
                if (!data || data === 'connected') return
                try {
                    const batch = JSON.parse(data) as TrafficBatch[]
                    if (Array.isArray(batch) && batch.length) {
                        applyTrafficBatch(batch, setCountries, setPings)
                        setStatus('Streaming live traffic')
                        setIsConnected(true)
                        setIsPolling(false)
                    }
                } catch (error) {
                    console.error('Failed to parse live traffic batch:', error)
                }
            }

            es.onopen = () => {
                setStatus('Connected')
                setIsConnected(true)
                setIsPolling(false)
            }

            es.onmessage = (event) => {
                if (event.data === 'connected') {
                    setStatus('Connected')
                    setIsConnected(true)
                    setIsPolling(false)
                    return
                }
                handleBatch(event.data)
            }

            es.addEventListener('traffic', (event) => {
                handleBatch((event as MessageEvent).data)
            })

            es.addEventListener('ready', (event) => {
                setStatus((event as MessageEvent).data === 'snapshot' ? 'Traffic stream active' : 'Connected')
                setIsConnected(true)
                setIsPolling(false)
            })

            es.onerror = () => {
                setStatus(recordCountRef.current || Number(initialMetrics?.total_requests || 0) ? 'Live traffic feed active' : 'Polling traffic feed')
                setIsConnected(false)
                setIsPolling(true)
                es?.close()
                if (!stopped) {
                    reconnectTimer = setTimeout(connect, 3000)
                }
            }
        }

        connect()

        return () => {
            stopped = true
            es?.close()
            if (reconnectTimer) clearTimeout(reconnectTimer)
        }
    }, [])

    useEffect(() => {
        let stopped = false
        let timer: ReturnType<typeof setTimeout> | null = null

        async function pollSnapshot() {
            try {
                const response = await fetch('/api/live-traffic?mode=snapshot', { cache: 'no-store' })
                if (!response.ok) throw new Error(`Snapshot returned ${response.status}`)
                const payload = await response.json() as TrafficSnapshotPayload
                const records = Array.isArray(payload.records?.result) ? payload.records.result : []
                if (!stopped && records.length) {
                    setLiveRecords(records)
                    applyTrafficBatch(recordsToBatch(records), setCountries, setPings)
                    setStatus(isConnected ? 'Streaming live traffic' : 'Live traffic feed active')
                    setIsPolling(!isConnected)
                } else if (!stopped && recordCountRef.current) {
                    setStatus(isConnected ? 'Streaming live traffic' : 'Live traffic feed active')
                    setIsPolling(!isConnected)
                } else if (!stopped && Number(payload.metrics?.total_requests || initialMetrics?.total_requests || 0)) {
                    const metricBatch = metricsToBatch(payload.metrics || initialMetrics)
                    if (metricBatch.length) {
                        applyTrafficBatch(metricBatch, setCountries, setPings)
                    }
                    setStatus(isConnected ? 'Streaming live traffic' : 'Live metrics active')
                    setIsPolling(!isConnected)
                }
            } catch {
                if (!stopped && !isConnected) {
                    setStatus(recordCountRef.current || Number(initialMetrics?.total_requests || 0) ? 'Live traffic feed active; refresh retrying' : 'Traffic feed retrying')
                    setIsPolling(true)
                }
            } finally {
                if (!stopped) {
                    timer = setTimeout(pollSnapshot, isConnected ? 30000 : 10000)
                }
            }
        }

        pollSnapshot()

        return () => {
            stopped = true
            if (timer) clearTimeout(timer)
        }
    }, [isConnected])

    useEffect(() => {
        function tick() {
            const nextNow = Date.now()
            setNow(nextNow)
            setPings((prev) => prev.filter((ping) => nextNow - ping.startTime < PING_LIFETIME_MS))
            setCountries((prev) => Object.fromEntries(
                Object.entries(prev).filter(([, value]) => isConnected ? nextNow - value.lastSeen < COUNTRY_EXPIRY_MS : true)
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
    const trackedRequestsValue = totalTrackedRequests || Number(initialMetrics?.total_requests || 0)
    const selectedRank = countryEntries.findIndex((entry) => entry.iso === selectedCountry) + 1
    const selectedShare = selectedPoint && totalTrackedRequests
        ? Math.round((selectedPoint.count / totalTrackedRequests) * 100)
        : 0
    const selectedRecords = useMemo(
        () => liveRecords
            .filter((record) => (
                !selectedCountry
                || countryIsoForTrafficRecord(record) === selectedCountry
            ))
            .slice(0, 6),
        [liveRecords, selectedCountry]
    )
    const isOperational = isConnected || isPolling || liveRecords.length > 0 || Number(initialMetrics?.total_requests || 0) > 0

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
                className='fill-ui-raised stroke-ui-border stroke-[0.6] transition-colors hover:fill-ui-border'
            />
        )
    }), [])

    const strongestCountryCount = countryEntries[0]?.count || 1

    return (
        <div className='grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_22rem]'>
            <section
                className='flex min-h-168 flex-col rounded-2xl border border-ui-border
                    bg-ui-panel shadow-lg'
            >
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-5 py-4'>
                    <div>
                        <h1 className='text-xl font-semibold text-ui-text'>Live traffic map</h1>
                        <p className='mt-1 text-sm text-ui-muted'>
                            Zoomable global view of recent request hotspots, live ingress pulses, and top traffic patterns.
                        </p>
                    </div>
                    <div
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                            isOperational
                                ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
                                : 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
                        }`}
                    >
                        <span className={`h-2 w-2 rounded-full ${isOperational ? 'bg-ui-success' : 'bg-ui-danger'}`} />
                        {status}
                    </div>
                </div>

                <div className='grid gap-3 border-b border-ui-border px-5 py-4 sm:grid-cols-2 xl:grid-cols-4'>
                    <StatCard
                        icon={<Globe2 className='h-4 w-4' />}
                        label='Active Countries'
                        value={String(countryEntries.length)}
                    />
                    <StatCard
                        icon={<Activity className='h-4 w-4' />}
                        label='Tracked Requests'
                        value={String(trackedRequestsValue)}
                    />
                    <StatCard icon={<Zap className='h-4 w-4' />} label='Top Country' value={countryEntries[0]?.iso || 'checking'} />
                    <StatCard
                        icon={<Clock3 className='h-4 w-4' />}
                        label='Avg Request Time'
                        value={initialMetrics?.avg_request_time ? `${Math.round(initialMetrics.avg_request_time)}ms` : 'metering'}
                    />
                </div>

                <div className='relative flex-1 overflow-hidden'>
                    <div className='absolute inset-0 bg-ui-canvas' />
                    <div
                        className='absolute left-4 top-4 z-20 rounded-full border border-ui-border
                            bg-ui-canvas/90 px-3 py-1.5 text-xs text-ui-muted backdrop-blur'
                    >
                        <span className='inline-flex items-center gap-2'>
                            <Move className='h-3.5 w-3.5' />
                            Drag to pan • wheel to zoom
                        </span>
                    </div>
                    <div
                        className='absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full
                            border border-ui-border bg-ui-canvas/90 p-1 backdrop-blur'
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
                                        className={selected ? 'fill-ui-text' : 'fill-ui-border'}
                                    />
                                    <text
                                        x={x + 6}
                                        y={y - 6}
                                        className={`text-[9px] font-medium ${
                                            selected ? 'fill-ui-text' : 'fill-ui-muted'
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
                                    <circle cx={x} cy={y} r={radius + 8} className='fill-ui-warning/10' />
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={radius}
                                        className={active
                                            ? 'fill-ui-warning/30 stroke-ui-warning stroke-1'
                                            : 'fill-ui-warning/70 stroke-ui-canvas/40 stroke-[1.5]'}
                                    />
                                    <text
                                        x={x}
                                        y={y - radius - 5}
                                        textAnchor='middle'
                                        className='fill-ui-muted/50 text-[10px] font-semibold'
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
                            const progress = (now - ping.startTime) / PING_LIFETIME_MS
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
                                        className='fill-none stroke-ui-border stroke-[1.2]'
                                    />
                                    <circle cx={px} cy={py} r={2 + Math.min(4, ping.count)} className='fill-ui-text blur-[1px]' />
                                    <circle cx={px} cy={py} r='1.5' className='fill-ui-text' />
                                </g>
                            )
                        })}

                        <circle cx={project(NORWAY)[0]} cy={project(NORWAY)[1]} r='7' className='fill-ui-text/30 blur-sm' />
                        <circle cx={project(NORWAY)[0]} cy={project(NORWAY)[1]} r='3.5' className='fill-ui-text' />
                    </svg>
                </div>
            </section>

            <aside className='flex min-h-168 flex-col gap-4 overflow-auto'>
                <InsightCard
                    title={selectedCountry === 'NO' ? 'Local Focus' : `Country Focus · ${selectedCountry}`}
                    icon={<Search className='h-4 w-4 stroke-ui-primary' />}
                >
                    <div className='space-y-2 text-sm text-ui-muted'>
                        <div
                            className='flex items-center justify-between rounded-xl border border-ui-border
                                bg-ui-panel px-3 py-2'
                        >
                            <span>Requests observed</span>
                            <span className='font-semibold text-ui-text'>{selectedPoint?.count || 0}</span>
                        </div>
                        <div
                            className='flex items-center justify-between rounded-xl border border-ui-border
                                bg-ui-panel px-3 py-2'
                        >
                            <span>Last seen</span>
                            <span className='font-semibold text-ui-text'>
                                {selectedPoint ? formatRelative(selectedPoint.lastSeen, now) : 'Listening'}
                            </span>
                        </div>
                        <div
                            className='flex items-center justify-between rounded-xl border border-ui-border
                                bg-ui-panel px-3 py-2'
                        >
                            <span>Live share</span>
                            <span className='font-semibold text-ui-text'>{selectedShare ? `${selectedShare}%` : 'metering'}</span>
                        </div>
                        <div
                            className='flex items-center justify-between rounded-xl border border-ui-border
                                bg-ui-panel px-3 py-2'
                        >
                            <span>Hotspot rank</span>
                            <span className='font-semibold text-ui-text'>{selectedRank || 'checking'}</span>
                        </div>
                        <div className='grid gap-2 sm:grid-cols-2'>
                            <div
                                className='rounded-xl border border-ui-primary/25 bg-ui-primary/10 px-3 py-3'
                            >
                                <div className='mb-1 flex items-center gap-2 text-ui-primary'>
                                    <MapPinned className='h-4 w-4' />
                                    <span className='text-xs font-medium uppercase tracking-[0.18em]'>Capital</span>
                                </div>
                                <div className='text-sm font-semibold text-ui-text'>{selectedCapital?.label || 'Resolving'}</div>
                            </div>
                            <div
                                className='rounded-xl border border-ui-warning/25 bg-ui-warning/10 px-3 py-3'
                            >
                                <div className='mb-1 flex items-center gap-2 text-ui-warning'>
                                    <Route className='h-4 w-4' />
                                    <span className='text-xs font-medium uppercase tracking-[0.18em]'>Oslo Distance</span>
                                </div>
                                <div className='text-sm font-semibold text-ui-text'>
                                    {selectedCoords ? `${haversineKilometers(selectedCoords, NORWAY)} km` : 'resolving'}
                                </div>
                            </div>
                        </div>
                        <div
                            className='flex items-center justify-between rounded-xl border border-ui-border
                                bg-ui-panel px-3 py-2'
                        >
                            <span>Recent requests listed</span>
                            <span className='font-semibold text-ui-text'>{selectedRecords.length}</span>
                        </div>
                    </div>
                </InsightCard>

                <InsightCard title='Live Hotspots' icon={<Globe2 className='h-4 w-4 stroke-ui-success' />}>
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
                                        ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-text'
                                        : 'border-ui-border bg-ui-panel text-ui-muted '
                                            + 'hover:border-ui-primary hover:bg-ui-raised'
                                }`}
                            >
                                <div>
                                    <div className='font-medium'>{entry.iso}</div>
                                    <div className='text-xs text-ui-muted'>Updated {formatRelative(entry.lastSeen, now)}</div>
                                </div>
                                <div className='rounded-full bg-ui-raised px-2.5 py-1 text-xs font-semibold'>{entry.count}</div>
                            </button>
                        )) : (
                            <EmptyCopy text='Traffic hotspots appear as edge records and metrics stream in.' />
                        )}
                    </div>
                </InsightCard>

                <InsightCard title='Traffic Activity' icon={<Activity className='h-4 w-4 stroke-ui-warning' />}>
                    <SignalGroup title='Top Paths' entries={initialMetrics?.top_paths || []} valueLabel='requests' />
                    <SignalGroup title='Methods' entries={initialMetrics?.top_methods || []} valueLabel='requests' />
                    <SignalGroup title='Statuses' entries={initialMetrics?.top_status_codes || []} valueLabel='hits' />
                </InsightCard>

                <InsightCard title='Recent Requests' icon={<Clock3 className='h-4 w-4 stroke-ui-success' />}>
                    <div className='space-y-2'>
                        {liveRecords.length ? selectedRecords.map((record) => (
                            <div key={record.id} className='rounded-xl border border-ui-border bg-ui-panel p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-sm font-medium text-ui-text'>{record.method} {record.path}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClasses(record.status)}`}>
                                        {record.status}
                                    </span>
                                </div>
                                <div className='mt-2 flex items-center justify-between text-xs text-ui-muted'>
                                    <span className='truncate'>{record.domain}</span>
                                    <span>{record.request_time}ms</span>
                                </div>
                            </div>
                        )) : (
                            <EmptyCopy text='Recent request rows refresh as ingress records stream in.' />
                        )}
                    </div>
                </InsightCard>
            </aside>
        </div>
    )
}

type TrafficSnapshotPayload = {
    records?: { result?: TrafficRecord[] } | null
    metrics?: TrafficMetrics | null
}

function recordsToBatch(records: TrafficRecord[]): TrafficBatch[] {
    const counts = new Map<string, number>()
    records.slice(0, 80).forEach((record) => {
        const iso = countryIsoForTrafficRecord(record)
        counts.set(iso, (counts.get(iso) || 0) + 1)
    })

    const timestamp = new Date().toISOString()
    return Array.from(counts, ([iso, count]) => ({ iso, count, timestamp }))
}

function hydrateMetricCountries(metrics: TrafficMetrics | null): Record<string, TrafficCountryPoint> {
    const timestamp = Date.now()
    return metricsToBatch(metrics).reduce<Record<string, TrafficCountryPoint>>((acc, item) => {
        acc[item.iso] = {
            iso: item.iso,
            count: item.count,
            lastSeen: timestamp,
        }
        return acc
    }, {})
}

function metricsToBatch(metrics: TrafficMetrics | null | undefined): TrafficBatch[] {
    const domains = Array.isArray(metrics?.top_domains) ? metrics.top_domains : []
    const timestamp = new Date().toISOString()
    return domains
        .slice(0, 24)
        .map((entry, index) => ({
            iso: countryIsoForTrafficRecord({
                id: index,
                domain: String(entry.key),
                path: '/',
                method: 'GET',
                referer: '',
                status: 200,
                request_time: 0,
                timestamp,
                user_agent: 'traffic-metrics',
            } as TrafficRecord),
            count: Number(entry.count) || 1,
            timestamp,
        }))
}
