'use client'

import { countryCodeForMapFeature } from '../pageClientShared'
import { actorGeoProfile } from '@/utils/ti/actorProfile'
import { clampViewBox, getCountryFocusView, INITIAL_VIEWBOX, MAP_HEIGHT, MAP_WIDTH, project, type ViewBox, zoomViewBox } from '@/utils/monitoring/liveTrafficMap'
import { countryCentroids } from '@/utils/monitoring/geo'
import { humanizeSlug } from '../../seo'
import { Move } from 'lucide-react'
import { TiSearchResponse } from '@/utils/ti/search'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapCoverageFallback from './map-coverage-fallback'
import mapData from '@parent/public/world.json'
import MapPointActionRow from './map-point-action-row'
import MapZoomButton from './map-zoom-button'

export default function ThreatActorMap({ actor, result, onSelectCountry, compact = false }: { actor: TiActorIntelligenceProfile; result: TiSearchResponse; onSelectCountry?: (country: string) => void; compact?: boolean }) {
    const geo = actorGeoProfile(result)
    const hasPoints = geo.points.length > 0
    const regionalAreas = actor.geographies.filter(Boolean).slice(0, 6)
    const hasRegionalAreas = !hasPoints && regionalAreas.length > 0
    const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX)
    const [selectedCode, setSelectedCode] = useState(geo.points[0]?.code ?? '')
    const dragRef = useRef<{ x: number, y: number, viewBox: ViewBox } | null>(null)
    const pointByCode = useMemo(() => new Map(geo.points.map(point => [point.code, point])), [geo.points])
    const selectedPoint = geo.points.find(point => point.code === selectedCode) ?? geo.points[0]
    const focusCountry = useCallback((code: string) => {
        const coords = countryCentroids[code]
        setSelectedCode(code)
        const point = geo.points.find(item => item.code === code)
        if (point) onSelectCountry?.(point.label)
        if (coords) setViewBox(getCountryFocusView(coords))
    }, [geo.points, onSelectCountry])
    const mapPaths = useMemo(() => mapData.features.map((feature, index) => {
        let d = ''
        const code = countryCodeForMapFeature(feature.properties?.name)
        const point = code ? pointByCode.get(code) : undefined
        const active = Boolean(point && selectedPoint?.code === point.code)
        const fillClass = point
            ? point.role === 'operator'
                ? 'fill-ui-primary'
                : 'fill-ui-danger'
            : 'fill-ui-raised'
        const strokeClass = point ? 'stroke-ui-panel stroke-[0.9]' : 'stroke-ui-border stroke-[0.55]'

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
                key={`${feature.properties?.name || 'country'}-${index}`}
                d={d}
                role={point ? 'button' : undefined}
                tabIndex={point ? 0 : undefined}
                aria-label={point ? `${point.label}: ${point.role === 'operator' ? 'reported operator origin' : 'reported victim or targeting observation'}` : undefined}
                onClick={point ? () => focusCountry(point.code) : undefined}
                onKeyDown={point ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    focusCountry(point.code)
                } : undefined}
                className={`${fillClass} ${strokeClass} transition-colors ${point ? 'cursor-pointer hover:brightness-105 focus:outline-none' : 'hover:fill-ui-panel'}`}
                opacity={point ? active ? '0.92' : '0.68' : '1'}
            />
        )
    }), [focusCountry, pointByCode, selectedPoint?.code])

    useEffect(() => {
        if (!geo.points.length) return
        if (!geo.points.some(point => point.code === selectedCode)) {
            setSelectedCode(geo.points[0]?.code ?? '')
        }
    }, [geo.points, selectedCode])

    return (
        <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-raised dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3 dark:border-ui-border'>
                <div>
                    <h2 className='text-sm font-semibold text-ui-text dark:text-ui-text'>Actor country map</h2>
                    <p className='mt-0.5 text-xs text-ui-muted dark:text-ui-muted'>
                        {hasPoints || hasRegionalAreas ? 'Known origin and target countries associated with this actor.' : 'No origin or target countries are available yet.'}
                    </p>
                </div>
                <span className='rounded-lg bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-primary dark:bg-ui-raised dark:text-ui-primary'>{hasPoints ? `${geo.points.length} countries` : hasRegionalAreas ? `${regionalAreas.length} region${regionalAreas.length === 1 ? '' : 's'}` : 'Source coverage'}</span>
            </div>
            <div className={`${hasPoints ? compact ? 'min-h-60' : 'min-h-80' : ''} relative overflow-hidden bg-ui-raised dark:bg-ui-canvas`}>
                {hasPoints ? (
                    <>
                        <div className='absolute left-3 top-3 z-20 rounded-lg border border-ui-border bg-ui-panel/90 px-3 py-1.5 text-xs text-ui-muted shadow-sm backdrop-blur dark:border-ui-border dark:bg-ui-panel/90 dark:text-ui-muted'>
                            <span className='inline-flex items-center gap-2'>
                                <Move className='h-3.5 w-3.5' />
                                Drag to pan · wheel to zoom
                            </span>
                        </div>
                        <div className='absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-lg border border-ui-border bg-ui-panel/90 p-1 shadow-sm backdrop-blur dark:border-ui-border dark:bg-ui-panel/90'>
                            <MapZoomButton label='−' onClick={() => setViewBox((current) => zoomViewBox(current, 1.18, MAP_WIDTH / 2, MAP_HEIGHT / 2))} />
                            <MapZoomButton label='Reset' wide onClick={() => setViewBox(INITIAL_VIEWBOX)} />
                            <MapZoomButton label='+' onClick={() => setViewBox((current) => zoomViewBox(current, 0.84, MAP_WIDTH / 2, MAP_HEIGHT / 2))} />
                        </div>
                        <svg
                            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                            role='img'
                            aria-label={`Country-level actor map for ${humanizeSlug(result.query)}`}
                            className={`${compact ? 'h-60' : 'h-80'} relative z-10 w-full cursor-grab bg-ui-panel active:cursor-grabbing dark:bg-ui-canvas`}
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
                                setViewBox((current) => zoomViewBox(current, event.deltaY > 0 ? 1.12 : 0.88, px, py))
                            }}
                        >
                            <rect x='0' y='0' width={MAP_WIDTH} height={MAP_HEIGHT} className='fill-ui-panel dark:fill-ui-canvas' />
                            <g className='opacity-95'>{mapPaths}</g>
                            {geo.flows.map(flow => {
                                const from = countryCentroids[flow.from.code]
                                const to = countryCentroids[flow.to.code]
                                if (!from || !to) return null
                                const [x1, y1] = project(from)
                                const [x2, y2] = project(to)
                                const dx = x2 - x1
                                const dy = y2 - y1
                                const distance = Math.sqrt((dx * dx) + (dy * dy))
                                const cx = (x1 + x2) / 2
                                const cy = (y1 + y2) / 2 - (distance * 0.22)
                                return (
                                    <path
                                        key={`${flow.from.code}-${flow.to.code}`}
                                        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                                        fill='none'
                                        className='stroke-ui-danger'
                                        strokeDasharray='5 5'
                                        strokeWidth='1.8'
                                        opacity='0.45'
                                    />
                                )
                            })}
                            {geo.points.map(point => {
                                const coords = countryCentroids[point.code]
                                if (!coords) return null
                                const [x, y] = project(coords)
                                const active = selectedPoint?.code === point.code
                                const color = point.role === 'operator' ? 'var(--ui-primary)' : 'var(--ui-danger)'
                                const radius = point.role === 'operator' ? 5 : 4 + Math.min(5, point.count * 1.5)
                                return (
                                    <g key={`${point.role}-${point.code}`} onClick={() => focusCountry(point.code)} className='cursor-pointer'>
                                        <circle cx={x} cy={y} r={radius + 9} fill={color} opacity={active ? '0.16' : '0.08'} />
                                        <circle cx={x} cy={y} r={radius} fill={color} opacity='0.92' stroke='var(--ui-panel)' strokeWidth='1.5' />
                                        <circle cx={x} cy={y} r='2' fill='var(--ui-panel)' />
                                        <text x={x} y={y - radius - 7} textAnchor='middle' className='fill-ui-text text-[10px] font-bold' stroke='var(--ui-panel)' strokeWidth='3' paintOrder='stroke'>{point.code}</text>
                                    </g>
                                )
                            })}
                        </svg>
                    </>
                ) : (
                    <MapCoverageFallback regions={regionalAreas} actor={actor} compact={compact} />
                )}
            </div>
            {hasPoints ? (
                <div className='grid gap-3 border-t border-ui-border bg-ui-panel px-4 py-3 dark:border-ui-border dark:bg-ui-panel'>
                    <div className='flex flex-wrap gap-3 text-xs'>
                        <span className='inline-flex items-center gap-1.5 text-ui-muted dark:text-ui-muted'><span className='h-2.5 w-2.5 rounded-full bg-ui-primary' />Origin</span>
                        <span className='inline-flex items-center gap-1.5 text-ui-muted dark:text-ui-muted'><span className='h-2.5 w-2.5 rounded-full bg-ui-danger' />Target</span>
                    </div>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        {geo.points.map(point => (
                            <MapPointActionRow
                                key={`${point.role}-row-${point.code}`}
                                point={point}
                                active={selectedPoint?.code === point.code}
                                onFocus={() => focusCountry(point.code)}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    )
}
