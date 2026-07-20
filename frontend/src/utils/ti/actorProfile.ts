import type { TiSearchResponse } from './search'

export type MapCountry = {
    code: string
    label: string
    x: number
    y: number
}

export type ActorMapPoint = MapCountry & {
    role: 'operator' | 'target'
    count: number
    detail: string
}

export type VictimObservation = {
    victim: string
    country: string
    sector: string
    incident: string
    timeframe: string
    source: string
    sourceIds: string[]
    provenanceRefs: string[]
    reportDate: string
    confidence: number
}

export const countries: Record<string, MapCountry> = {
    russia: { code: 'RU', label: 'Russia', x: 433, y: 91 },
    'russian federation': { code: 'RU', label: 'Russia', x: 433, y: 91 },
    'united states': { code: 'US', label: 'United States', x: 142, y: 119 },
    usa: { code: 'US', label: 'United States', x: 142, y: 119 },
    'u.s.': { code: 'US', label: 'United States', x: 142, y: 119 },
    us: { code: 'US', label: 'United States', x: 142, y: 119 },
    'united kingdom': { code: 'GB', label: 'United Kingdom', x: 305, y: 94 },
    uk: { code: 'GB', label: 'United Kingdom', x: 305, y: 94 },
    britain: { code: 'GB', label: 'United Kingdom', x: 305, y: 94 },
    germany: { code: 'DE', label: 'Germany', x: 326, y: 107 },
    france: { code: 'FR', label: 'France', x: 315, y: 119 },
    netherlands: { code: 'NL', label: 'Netherlands', x: 322, y: 101 },
    norway: { code: 'NO', label: 'Norway', x: 329, y: 75 },
    ukraine: { code: 'UA', label: 'Ukraine', x: 355, y: 118 },
    canada: { code: 'CA', label: 'Canada', x: 133, y: 86 },
    japan: { code: 'JP', label: 'Japan', x: 547, y: 137 },
    australia: { code: 'AU', label: 'Australia', x: 527, y: 247 },
    china: { code: 'CN', label: 'China', x: 497, y: 142 },
    india: { code: 'IN', label: 'India', x: 461, y: 168 },
    israel: { code: 'IL', label: 'Israel', x: 375, y: 145 },
    turkey: { code: 'TR', label: 'Turkey', x: 364, y: 134 },
    poland: { code: 'PL', label: 'Poland', x: 341, y: 107 },
    sweden: { code: 'SE', label: 'Sweden', x: 337, y: 82 },
    denmark: { code: 'DK', label: 'Denmark', x: 325, y: 94 },
    italy: { code: 'IT', label: 'Italy', x: 330, y: 134 },
    spain: { code: 'ES', label: 'Spain', x: 303, y: 134 },
    belgium: { code: 'BE', label: 'Belgium', x: 318, y: 109 },
}

const rejectedLocationPattern = /continent|europe|north america|latin america|asia|middle east|africa|oceania|global|multiple|various|unknown|nato|allied|live source|source context/

export function actorGeoProfile(result: TiSearchResponse) {
    const points = new Map<string, ActorMapPoint>()
    const origin = operatorOriginFor(result)
    if (origin) points.set(`operator:${origin.code}`, { ...origin, role: 'operator', count: 1, detail: operatorOriginDetail() })

    const targetCounts = new Map<string, { country: MapCountry; victims: Set<string>; fallbackCount: number }>()
    const addTarget = (value: string, victim?: string) => {
        const country = countryFromValue(value)
        if (!country || country.code === origin?.code) return
        const key = `target:${country.code}`
        const existing = targetCounts.get(key) ?? { country, victims: new Set<string>(), fallbackCount: 0 }
        if (victim?.trim()) existing.victims.add(victim.trim())
        else existing.fallbackCount += 1
        targetCounts.set(key, existing)
    }

    for (const observation of victimObservationsFor(result)) {
        addTarget(observation.country, observation.victim)
    }
    for (const item of result.recentActivity) {
        for (const country of item.countries ?? []) addTarget(country, item.victimName || item.title)
    }
    for (const target of result.targets) {
        for (const region of target.regions) addTarget(region, target.sector)
    }

    for (const { country, victims, fallbackCount } of targetCounts.values()) {
        points.set(`target:${country.code}`, {
            ...country,
            role: 'target',
            count: victims.size || fallbackCount || 1,
            detail: targetCountryDetail(result, country.label),
        })
    }

    const ordered = [...points.values()].sort((a, b) => {
        if (a.role !== b.role) return a.role === 'operator' ? -1 : 1
        return b.count - a.count || a.label.localeCompare(b.label)
    })
    const operator = ordered.find(point => point.role === 'operator')
    return {
        points: ordered,
        flows: operator ? ordered.filter(point => point.role === 'target').map(point => ({ from: operator, to: point })) : [],
    }
}

export function countryFromValue(value: string) {
    const cleaned = value.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!cleaned) return null
    if (rejectedLocationPattern.test(cleaned)) return null
    return countries[cleaned] ?? null
}

export function victimObservationsFor(result: TiSearchResponse): VictimObservation[] {
    const sourceById = new Map(result.sources.map(source => [source.id, source]))
    const fromActivity = result.recentActivity
        .filter(item => item.victimName || item.claimType === 'victim_claim')
        .map(item => {
            const country = item.countries?.map(countryFromValue).find((entry): entry is MapCountry => Boolean(entry))
            const provenanceRefs = item.sourceIds
                .map(sourceId => sourceById.get(sourceId))
                .map(source => source?.url || source?.provenance || source?.name)
                .filter((value): value is string => Boolean(value))
            return {
                victim: item.victimName || item.title,
                country: country?.label ?? 'Country not stated',
                sector: item.affectedSectors?.join(', ') || 'Sector not stated',
                incident: item.impact || item.detail,
                timeframe: item.firstReportedAt || item.date || 'Date not stated',
                source: activitySourceLabel(item.sourceIds.length),
                sourceIds: item.sourceIds,
                provenanceRefs,
                reportDate: item.firstReportedAt || item.date || result.generatedAt,
                confidence: item.confidence,
            }
        })

    if (fromActivity.length) return fromActivity.slice(0, 8)

    return result.targets.flatMap(target => target.regions.map(region => {
        const country = countryFromValue(region)
        return {
            victim: target.sector,
            country: country?.label ?? region,
            sector: target.sector,
            incident: target.rationale,
            timeframe: 'Profile observation',
            source: 'profile target evidence',
            sourceIds: [],
            provenanceRefs: [],
            reportDate: result.generatedAt,
            confidence: target.confidence,
        }
    })).filter(item => countryFromValue(item.country)).slice(0, 8)
}

function operatorOriginFor(result: TiSearchResponse) {
    const sourceText = result.actorIntelligence?.attribution?.toLowerCase() ?? ''
    if (/\brussian\b|\brussia\b|\bsvr\b/.test(sourceText)) return countries.russia
    return null
}

function operatorOriginDetail() {
    return 'Reported operator origin from attributed profile evidence.'
}

function targetCountryDetail(result: TiSearchResponse, country: string) {
    const victims = victimObservationsFor(result).filter(item => item.country === country).map(item => item.victim)
    if (victims.length) return `Observed activity: ${victims.slice(0, 3).join(', ')}. Open the victim table for sector, timeframe, incident, and evidence strength.`
    const activities = result.recentActivity.filter(item => item.countries?.some(countryValue => countryFromValue(countryValue)?.label === country))
    if (activities.length) return activities[0]?.title ?? 'Country-level targeting mentioned in recent activity.'
    return 'Country-level observation from reported activity.'
}

function activitySourceLabel(count: number) {
    if (count <= 0) return 'Source pending'
    return count === 1 ? '1 source' : `${count} sources`
}
