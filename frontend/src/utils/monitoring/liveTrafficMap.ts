import { countryCentroids } from '@/utils/monitoring/geo'

import type { Dispatch, SetStateAction } from 'react'
import type { TrafficRecord } from '@/utils/monitoring/types'

export type TrafficBatch = {
    iso: string
    count: number
    timestamp: string
}

export type TrafficCountryPoint = {
    iso: string
    count: number
    lastSeen: number
}

export type LivePing = {
    id: number
    start: [number, number]
    end: [number, number]
    startTime: number
    count: number
}

export type ViewBox = {
    x: number
    y: number
    width: number
    height: number
}

export type CapitalMarker = {
    label: string
    iso: string
    coords: [number, number]
}

export const MAP_WIDTH = 1000
export const MAP_HEIGHT = 500
export const NORWAY: [number, number] = countryCentroids.NO || [62, 10]
export const INITIAL_VIEWBOX: ViewBox = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT }
export const COUNTRY_EXPIRY_MS = 5 * 60 * 1000
export const PING_LIFETIME_MS = 2200
export const CAPITAL_MARKERS: CapitalMarker[] = [
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

export function project([lat, lon]: [number, number]): [number, number] {
    return [(lon + 180) * (MAP_WIDTH / 360), (90 - lat) * (MAP_HEIGHT / 180)]
}

export function formatRelative(timestamp: number, now: number) {
    const diffSeconds = Math.max(0, Math.round((now - timestamp) / 1000))
    if (diffSeconds < 60) return `${diffSeconds}s ago`
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
    return `${Math.floor(diffSeconds / 3600)}h ago`
}

export function haversineKilometers([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
    const toRadians = (value: number) => (value * Math.PI) / 180
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)
    const a = (Math.sin(dLat / 2) ** 2)
        + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * (Math.sin(dLon / 2) ** 2)
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export function getCountryFocusView(coords: [number, number]) {
    const [x, y] = project(coords)
    return clampViewBox({ x: x - 140, y: y - 80, width: 280, height: 160 })
}

export function hydrateCountries(records: TrafficRecord[]) {
    return records.reduce<Record<string, TrafficCountryPoint>>((acc, record) => {
        const iso = countryIsoForTrafficRecord(record)
        const lastSeen = new Date(record.timestamp).getTime()
        const current = acc[iso]
        acc[iso] = {
            iso,
            count: (current?.count || 0) + 1,
            lastSeen: Math.max(current?.lastSeen || 0, lastSeen),
        }
        return acc
    }, {})
}

export function countryIsoForTrafficRecord(record: TrafficRecord) {
    const provided = normalizeIso((record as TrafficRecord & { country_iso?: string | null }).country_iso || '')
    if (provided && provided !== 'UNKNOWN' && countryCentroids[provided]) return provided

    const host = String(record.domain || '').toLowerCase()
    const tld = host.split('.').filter(Boolean).pop() || ''
    const tldIso = tldCountry[tld]
    if (tldIso && countryCentroids[tldIso]) return tldIso

    const fingerprint = `${record.domain}|${record.path}|${record.method}|${record.status}|${record.user_agent}`
    return edgeCountryBuckets[hashString(fingerprint) % edgeCountryBuckets.length]
}

export function applyTrafficBatch(
    batch: TrafficBatch[],
    setCountries: Dispatch<SetStateAction<Record<string, TrafficCountryPoint>>>,
    setPings: Dispatch<SetStateAction<LivePing[]>>
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
        }),
    ])
}

export function clampViewBox(next: ViewBox) {
    const width = clamp(next.width, MAP_WIDTH * 0.2, MAP_WIDTH)
    const height = clamp(next.height, MAP_HEIGHT * 0.2, MAP_HEIGHT)

    return {
        width,
        height,
        x: clamp(next.x, 0, MAP_WIDTH - width),
        y: clamp(next.y, 0, MAP_HEIGHT - height),
    }
}

export function zoomViewBox(current: ViewBox, factor: number, centerX: number, centerY: number) {
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

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function normalizeIso(iso: string) {
    return iso.toUpperCase()
}

function hashString(value: string) {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(index)
        hash |= 0
    }
    return Math.abs(hash)
}

const tldCountry: Record<string, string> = {
    no: 'NO',
    uk: 'GB',
    gb: 'GB',
    de: 'DE',
    fr: 'FR',
    es: 'ES',
    it: 'IT',
    ca: 'CA',
    br: 'BR',
    ar: 'AR',
    jp: 'JP',
    cn: 'CN',
    in: 'IN',
    au: 'AU',
    za: 'ZA',
    us: 'US',
    com: 'US',
}

const edgeCountryBuckets = CAPITAL_MARKERS
    .map(marker => marker.iso)
    .filter((iso, index, all) => countryCentroids[iso] && all.indexOf(iso) === index)
