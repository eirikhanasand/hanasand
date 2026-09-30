'use client'

import { MAP_HEIGHT, MAP_WIDTH, project } from '@/utils/monitoring/liveTrafficMap'
import mapData from '@parent/public/world.json'

export default function EmptyActorMap({ compact = false }: { compact?: boolean }) {
    return <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role='img' aria-label='World map with no country-specific actor activity established' className={`${compact ? 'h-44' : 'h-64'} w-full rounded-lg bg-ui-canvas dark:bg-ui-canvas`}>
        <rect x='0' y='0' width={MAP_WIDTH} height={MAP_HEIGHT} className='fill-ui-canvas dark:fill-ui-canvas' />
        {mapData.features.map((feature, index) => {
            let d = ''
            const drawRing = (ring: number[][]) => ring.reduce((path, point, pointIndex) => {
                const [x, y] = project([point[1], point[0]])
                return `${path}${pointIndex === 0 ? 'M' : 'L'} ${x} ${y} `
            }, '') + 'Z '
            if (feature.geometry.type === 'Polygon') (feature.geometry.coordinates as number[][][]).forEach(ring => { d += drawRing(ring) })
            if (feature.geometry.type === 'MultiPolygon') (feature.geometry.coordinates as number[][][][]).forEach(polygon => polygon.forEach(ring => { d += drawRing(ring) }))
            return <path key={`${feature.properties?.name || 'country'}-${index}`} d={d} className='fill-ui-raised stroke-ui-border stroke-[0.55]' />
        })}
    </svg>
}
