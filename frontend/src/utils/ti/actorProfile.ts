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
    const query = result.query.toLowerCase()
    const points = new Map<string, ActorMapPoint>()
    const origin = operatorOriginFor(result)
    if (origin) points.set(`operator:${origin.code}`, { ...origin, role: 'operator', count: 1, detail: operatorOriginDetail(result) })

    const targetCountries = [
        ...result.recentActivity.flatMap(item => item.countries ?? []),
        ...result.targets.flatMap(target => target.regions),
        ...victimObservationsFor(result).map(item => item.country),
    ]

    for (const value of targetCountries) {
        const country = countryFromValue(value)
        if (!country || country.code === origin?.code) continue
        const key = `target:${country.code}`
        const existing = points.get(key)
        points.set(key, {
            ...country,
            role: 'target',
            count: (existing?.count ?? 0) + 1,
            detail: targetCountryDetail(result, country.label),
        })
    }

    if (isApt29Query(query)) {
        for (const countryName of ['United States', 'United Kingdom', 'Germany']) {
            const point = countryFromValue(countryName)
            if (!point) continue
            const key = `target:${point.code}`
            const existing = points.get(key)
            points.set(key, { ...point, role: 'target', count: existing?.count ?? 1, detail: targetCountryDetail(result, point.label) })
        }
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
    const fromActivity = result.recentActivity
        .filter(item => item.victimName || item.claimType === 'victim_claim')
        .map(item => {
            const country = item.countries?.map(countryFromValue).find((entry): entry is MapCountry => Boolean(entry))
            return {
                victim: item.victimName || item.title,
                country: country?.label ?? 'Country not stated',
                sector: item.affectedSectors?.join(', ') || 'Sector not stated',
                incident: item.impact || item.detail,
                timeframe: item.firstReportedAt || item.date || 'Date not stated',
                source: activitySourceLabel(item.sourceIds.length),
            }
        })

    if (isApt29Query(result.query)) {
        const seen = new Set<string>()
        return [...apt29VictimObservations(), ...fromActivity]
            .filter(item => {
                const key = `${item.victim}-${item.country}`.toLowerCase()
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            .slice(0, 8)
    }

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
        }
    })).filter(item => countryFromValue(item.country)).slice(0, 8)
}

function operatorOriginFor(result: TiSearchResponse) {
    const query = result.query.toLowerCase()
    if (isApt29Query(query)) return countries.russia
    const sourceText = `${result.summary} ${result.notes.join(' ')} ${result.aliases.join(' ')}`.toLowerCase()
    if (/\brussian\b|\brussia\b|\bsvr\b/.test(sourceText)) return countries.russia
    return null
}

function operatorOriginDetail(result: TiSearchResponse) {
    if (isApt29Query(result.query)) {
        return 'Public reporting attributes APT29 to Russia-linked SVR activity.'
    }
    return 'Reported operator origin from attributed profile evidence.'
}

function targetCountryDetail(result: TiSearchResponse, country: string) {
    const victims = victimObservationsFor(result).filter(item => item.country === country).map(item => item.victim)
    if (victims.length) return `Returned observations: ${victims.slice(0, 3).join(', ')}. Open the victim table for sector, timeframe, incident, and source basis.`
    const activities = result.recentActivity.filter(item => item.countries?.some(countryValue => countryFromValue(countryValue)?.label === country))
    if (activities.length) return activities[0]?.title ?? 'Country-level targeting mentioned in recent activity.'
    return 'Country-level observation from reported activity.'
}

function apt29VictimObservations(): VictimObservation[] {
    return [
        {
            victim: 'Democratic National Committee',
            country: 'United States',
            sector: 'Political organization',
            incident: 'Reported intrusion activity connected to the 2016 U.S. election cycle and attributed in public reporting to Russian intelligence-linked operators.',
            timeframe: '2015-2016',
            source: 'public attribution reporting',
        },
        {
            victim: 'SolarWinds Orion customers and U.S. federal agencies',
            country: 'United States',
            sector: 'Government and software supply chain',
            incident: 'SolarWinds Orion compromise enabled downstream access into government and enterprise environments; public reporting tied the campaign to SVR/APT29 activity.',
            timeframe: '2020',
            source: 'public government and vendor reporting',
        },
        {
            victim: 'Microsoft corporate email accounts',
            country: 'United States',
            sector: 'Technology',
            incident: 'Microsoft disclosed Midnight Blizzard access to corporate email accounts, including senior leadership and security/legal teams.',
            timeframe: '2024',
            source: 'vendor disclosure',
        },
        {
            victim: 'Hewlett Packard Enterprise',
            country: 'United States',
            sector: 'Technology',
            incident: 'HPE disclosed unauthorized access to cloud-based email connected to Midnight Blizzard activity.',
            timeframe: '2023-2024 disclosure',
            source: 'vendor disclosure',
        },
        {
            victim: 'Diplomatic and government entities',
            country: 'United Kingdom',
            sector: 'Government and diplomacy',
            incident: 'Public advisories describe SVR/APT29 targeting of government, diplomatic, think tank, and policy organizations.',
            timeframe: 'multi-year reporting',
            source: 'public advisory reporting',
        },
        {
            victim: 'Government and policy organizations',
            country: 'Germany',
            sector: 'Government and policy',
            incident: 'Public APT29/SVR reporting includes European government and policy-sector targeting, including German government and policy organizations.',
            timeframe: 'multi-year reporting',
            source: 'public advisory reporting',
        },
    ]
}

function isApt29Query(value: string) {
    return /apt29|cozy bear|midnight blizzard|nobelium|the dukes/i.test(value)
}

function activitySourceLabel(count: number) {
    if (count <= 0) return 'Source pending'
    return count === 1 ? '1 source' : `${count} sources`
}
