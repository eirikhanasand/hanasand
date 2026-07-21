import { actorGeoProfile, countryFromValue, victimObservationsFor } from '../src/utils/ti/actorProfile'
import type { TiSearchResponse } from '../src/utils/ti/search'

const result = apt29Fixture()
const geo = actorGeoProfile(result)
const countries = new Map(geo.points.map(point => [point.code, point]))
const victims = victimObservationsFor(result)

assert(countryFromValue('North America') === null, 'Continents must not be accepted as map countries.')
assert(countryFromValue('NATO-aligned states') === null, 'Alliance labels must not be accepted as map countries.')
assert(countryFromValue('From live source context') === null, 'Source-context copy must not be accepted as a map country.')
assert(countries.get('RU')?.role === 'operator', 'APT29 should mark Russia as the reported operator origin.')
assert(countries.get('US')?.role === 'target', 'APT29 should mark United States as a target country.')
assert(!countries.has('GB'), 'Actor geography must not add a country absent from the response.')
assert(!countries.has('DE'), 'Actor geography must not add a country absent from the response.')
assert(![...countries.values()].some(country => /north america|europe|nato|source/i.test(country.label)), 'Actor map should not contain pseudo-location labels.')
assert(countries.get('US')?.count === 1, 'United States count should reflect the one concrete victim observation.')
assert(victims.some(item => item.victim === 'Microsoft corporate email accounts' && item.country === 'United States'), 'Victim table should include Microsoft corporate email accounts.')
assert(!victims.some(item => /Hewlett Packard|SolarWinds/i.test(item.victim)), 'Victim table must not add actor-name fixtures absent from the response.')

const genericMentionGeo = actorGeoProfile({
    ...result,
    actorIntelligence: undefined,
    recentActivity: [{ ...result.recentActivity[0], claimType: 'general_activity', victimName: undefined, countries: ['Russia'], affectedSectors: ['Defense'] }],
    targets: [],
})
assert(genericMentionGeo.points.length === 0, 'Generic country and sector mentions must not become victim or target geography.')

const targetOnly = {
    ...result,
    actorIntelligence: undefined,
    recentActivity: [],
}
assert(victimObservationsFor(targetOnly).length === 0, 'A target summary without a victim observation must not fabricate a victim row.')
assert(actorGeoProfile(targetOnly).points.length === 0, 'A target summary without victim evidence must not create map points.')

function apt29Fixture(): TiSearchResponse {
    return {
        query: 'APT29',
        generatedAt: '2026-07-03T00:00:00.000Z',
        mode: 'seeded',
        status: 'ready',
        summary: 'APT29 public reporting ties Midnight Blizzard and Nobelium activity to Russian SVR collection.',
        confidence: 0.86,
        lastSeen: '2026-06-01T00:00:00.000Z',
        aliases: ['Midnight Blizzard', 'Nobelium'],
        recentActivity: [{
            date: '2024-01-25',
            title: 'Microsoft disclosed Midnight Blizzard access to corporate email',
            detail: 'Microsoft reported access to corporate email accounts by Midnight Blizzard.',
            confidence: 0.84,
            sourceIds: ['src_microsoft_midnight_blizzard'],
            claimType: 'victim_claim',
            victimName: 'Microsoft corporate email accounts',
            affectedSectors: ['Technology and cloud services'],
            countries: ['North America', 'NATO-aligned states', 'From live source context', 'United States'],
            impact: 'Cloud identity and email exposure.',
            firstReportedAt: '2024-01-25',
        }],
        targets: [{
            sector: 'Technology and cloud services',
            regions: ['Europe', 'United States'],
            rationale: 'Vendor reporting describes APT29 activity against corporate cloud and email systems.',
            confidence: 0.84,
        }],
        ttps: [],
        datasets: [],
        sources: [{
            id: 'src_microsoft_midnight_blizzard',
            name: 'Microsoft Threat Intelligence',
            type: 'vendor_disclosure',
            provenance: 'https://www.microsoft.com/en-us/security/blog/',
            url: 'https://www.microsoft.com/en-us/security/blog/',
        }],
        notes: [],
        actorIntelligence: {
            attribution: 'Russian SVR activity attributed in the attached Microsoft disclosure.',
            structuredProvenance: [{
                sourceId: 'src_microsoft_midnight_blizzard',
                sourceName: 'Microsoft Threat Intelligence',
                provenance: 'https://www.microsoft.com/en-us/security/blog/',
                reportDate: '2024-01-25',
                confidence: 0.84,
                shownBecause: 'Source-backed actor attribution.',
            }],
        },
    }
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}
