import { buildActorIntelligence, containsToyThreatIntelCopy } from '../src/utils/ti/actorIntelligence'
import type { TiSearchResponse } from '../src/utils/ti/search'

const fixture: TiSearchResponse = {
    query: 'apt29',
    generatedAt: '2026-06-28T08:00:00.000Z',
    mode: 'live_search',
    status: 'ready',
    summary: 'APT29 is a Russia-linked espionage actor associated with intelligence collection, diplomatic and government targeting, cloud and identity abuse, credential access, and stealthy persistence.',
    confidence: 0.76,
    lastSeen: '2024-01-25T00:00:00.000Z',
    aliases: ['Cozy Bear', 'Midnight Blizzard', 'Nobelium', 'The Dukes'],
    recentActivity: [{
        date: '2024-01-25',
        title: 'Microsoft disclosed Midnight Blizzard email access',
        detail: 'Microsoft disclosed access to corporate email accounts connected to Midnight Blizzard activity.',
        confidence: 0.82,
        sourceIds: ['microsoft'],
        claimType: 'campaign',
        victimName: 'Microsoft corporate email accounts',
        affectedSectors: ['Technology'],
        countries: ['United States'],
        impact: 'Corporate email access reported by vendor disclosure.',
        firstReportedAt: '2024-01-25',
        publisherCount: 1,
    }],
    targets: [{
        sector: 'Government and diplomacy',
        regions: ['United States', 'United Kingdom'],
        rationale: 'Strategic intelligence collection against policy and diplomatic targets.',
        confidence: 0.78,
    }],
    ttps: [{
        name: 'Cloud Accounts',
        attackId: 'T1078.004',
        tactic: 'Defense Evasion / Persistence',
        detail: 'Valid cloud identities and tokens are valuable for mailbox, tenant, and application access.',
        confidence: 0.72,
    }],
    datasets: [],
    sources: [{
        id: 'microsoft',
        name: 'Microsoft',
        type: 'vendor_disclosure',
        provenance: 'https://www.microsoft.com/en-us/security/blog/',
        url: 'https://www.microsoft.com/en-us/security/blog/',
    }],
    notes: [],
}

const profile = buildActorIntelligence(fixture, [{
    victim: 'SolarWinds Orion customers and U.S. federal agencies',
    country: 'United States',
    sector: 'Government and software supply chain',
    incident: 'SolarWinds Orion compromise enabled downstream access into government and enterprise environments.',
    timeframe: '2020',
    source: 'public government and vendor reporting',
}])

assert(profile.actorClass === 'State-linked espionage actor', 'APT29 actor class should be explicit.')
assert(profile.malwareTools.includes('SUNBURST'), 'APT29 should include SUNBURST tooling context.')
assert(profile.campaigns.some(item => /SolarWinds/i.test(item)), 'APT29 should include SolarWinds campaign context.')
assert(profile.targetSectors.some(item => /Government/i.test(item)), 'APT29 should include government targeting context.')
assert(profile.sourceProvenance.length >= 2, 'APT29 should expose source provenance.')
assert(profile.confidenceReasoning.length >= 2, 'APT29 should expose confidence reasoning.')

assert(containsToyThreatIntelCopy('target signals'), 'Copy guard should catch target signal language.')
assert(containsToyThreatIntelCopy('Named examples'), 'Copy guard should catch named-example language.')
assert(!containsToyThreatIntelCopy(JSON.stringify(profile)), 'Shaped actor intelligence should not contain toy TI copy.')

console.log('[ti-actor-intelligence] actor intelligence shaping and copy guardrails passed')

function assert(condition: unknown, message: string) {
    if (!condition) throw new Error(message)
}
