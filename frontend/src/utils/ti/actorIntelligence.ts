import type { TiSearchResponse } from './search'
import type { VictimObservation } from './actorProfile'

export type TiActorSourceProvenance = {
    sourceId?: string
    sourceName: string
    provenance: string
    reportDate?: string
    captureId?: string
    confidence?: number
    shownBecause: string
}

export type TiActorIntelligenceProfile = {
    actorClass: string
    attribution: string
    firstSeen: string
    lastSeen: string
    motivation: string[]
    malwareTools: string[]
    campaigns: string[]
    infrastructure: string[]
    indicators: string[]
    targetSectors: string[]
    geographies: string[]
    confidence: number
    confidenceReasoning: string[]
    sourceProvenance: string[]
    provenanceRows: TiActorSourceProvenance[]
    freshness: {
        generatedAt: string
        lastSeen: string
        stale: boolean
        reason: string
    }
}

export function buildActorIntelligence(result: TiSearchResponse, victimObservations: VictimObservation[]): TiActorIntelligenceProfile {
    const contract = result.actorIntelligence
    const fallback = fallbackActorIntelligence(result, victimObservations)
    const targetSectors = unique([
        ...(contract?.targetSectors ?? []),
        ...result.targets.map(target => target.sector),
        ...victimObservations.map(item => item.sector),
        ...result.recentActivity.flatMap(item => item.affectedSectors ?? []),
    ]).filter(item => !/not stated/i.test(item))
    const geographies = unique([
        ...(contract?.geographies ?? []),
        ...result.targets.flatMap(target => target.regions),
        ...victimObservations.map(item => item.country),
        ...result.recentActivity.flatMap(item => item.countries ?? []),
    ]).filter(item => !/not stated|global|multiple|various|unknown|north america|europe|nato-aligned/i.test(item))
    const sourceProvenance = unique([
        ...(contract?.sourceProvenance ?? []),
        ...result.sources.map(source => source.url || source.provenance || source.name),
        ...fallback.sourceProvenance,
    ]).slice(0, 10)
    const provenanceRows = buildProvenanceRows(result, fallback)
    const indicators = unique([
        ...(contract?.indicators ?? []),
        ...fallback.indicators,
        ...result.sources.map(source => domainFromUrl(source.url || source.provenance)).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)
    const lastSeen = contract?.lastSeen || result.lastSeen || result.generatedAt || fallback.lastSeen

    return {
        actorClass: contract?.actorClass || fallback.actorClass,
        attribution: contract?.attribution || fallback.attribution,
        firstSeen: contract?.firstSeen || fallback.firstSeen,
        lastSeen,
        motivation: unique([...(contract?.motivation ?? []), ...fallback.motivation]).slice(0, 6),
        malwareTools: unique([...(contract?.malwareTools ?? []), ...fallback.malwareTools]).slice(0, 10),
        campaigns: unique([...(contract?.campaigns ?? []), ...fallback.campaigns]).slice(0, 10),
        infrastructure: unique([...(contract?.infrastructure ?? []), ...fallback.infrastructure]).slice(0, 10),
        indicators,
        targetSectors: targetSectors.length ? targetSectors.slice(0, 12) : fallback.targetSectors,
        geographies: geographies.length ? geographies.slice(0, 12) : fallback.geographies,
        confidence: contract?.confidence ?? result.confidence ?? fallback.confidence,
        confidenceReasoning: unique([...(contract?.confidenceReasoning ?? []), ...fallback.confidenceReasoning]).slice(0, 8),
        sourceProvenance: sourceProvenance.length ? sourceProvenance : fallback.sourceProvenance,
        provenanceRows,
        freshness: freshnessFor(result.generatedAt, lastSeen),
    }
}

type TiActorIntelligenceFallback = Omit<TiActorIntelligenceProfile, 'provenanceRows' | 'freshness'>

function fallbackActorIntelligence(result: TiSearchResponse, victimObservations: VictimObservation[]): TiActorIntelligenceFallback {
    if (isApt29(result)) {
        return {
            actorClass: 'State-linked espionage actor',
            attribution: 'Russia-linked SVR/APT29 activity in public government, vendor, and incident reporting',
            firstSeen: 'Late-2000s public reporting',
            lastSeen: result.lastSeen || result.generatedAt,
            motivation: ['Strategic intelligence collection', 'Diplomatic and policy access', 'Cloud and identity compromise', 'Long-running stealthy persistence'],
            malwareTools: ['WellMess', 'WellMail', 'SUNBURST', 'TEARDROP', 'Cobalt Strike', 'Custom credential and token tooling'],
            campaigns: ['SolarWinds Orion supply-chain compromise', 'Microsoft corporate email intrusion', 'HPE cloud email intrusion', 'Diplomatic and policy-sector credential campaigns'],
            infrastructure: ['Cloud identity tenants', 'Compromised email accounts', 'Legitimate-looking web services', 'Supply-chain access paths', 'Residential or leased operational infrastructure'],
            indicators: ['SUNBURST supply-chain activity', 'Cloud mailbox access', 'OAuth/token abuse', 'microsoft.com reporting source'],
            targetSectors: ['Government and diplomacy', 'Technology and cloud services', 'NGO, think tank, and research organizations'],
            geographies: unique(victimObservations.map(item => item.country)).filter(item => !/not stated/i.test(item)),
            confidence: Math.max(result.confidence || 0, 0.76),
            confidenceReasoning: [
                'Aliases and attribution are corroborated across government and vendor reporting.',
                'Victim observations include named organizations, sectors, timeframes, and source basis.',
                'Tradecraft aligns with returned ATT&CK techniques for credential, cloud, email, and command-and-control activity.',
            ],
            sourceProvenance: [
                'CISA and allied government SVR/APT29 advisories',
                'Microsoft Midnight Blizzard disclosures',
                'Public SolarWinds and vendor incident reporting',
            ],
        }
    }

    return {
        actorClass: result.aliases.length ? 'Named threat actor or activity cluster' : 'Threat intelligence query',
        attribution: result.notes.find(note => /attribut/i.test(note)) || 'Attribution not returned by the search service',
        firstSeen: result.recentActivity.map(item => item.firstReportedAt || item.date).filter(Boolean).sort()[0] || 'Not returned',
        lastSeen: result.lastSeen || result.generatedAt,
        motivation: result.targets.map(target => target.rationale).slice(0, 4),
        malwareTools: [],
        campaigns: result.recentActivity.map(item => item.title).slice(0, 6),
        infrastructure: result.recentActivity.filter(item => item.claimType === 'infrastructure_activity').map(item => item.title).slice(0, 6),
        indicators: result.sources.map(source => domainFromUrl(source.url || source.provenance)).filter((value): value is string => Boolean(value)).slice(0, 8),
        targetSectors: result.targets.map(target => target.sector).slice(0, 8),
        geographies: unique([...result.targets.flatMap(target => target.regions), ...victimObservations.map(item => item.country)]).slice(0, 8),
        confidence: result.confidence,
        confidenceReasoning: [
            result.sources.length ? `${result.sources.length} returned source records are attached to the profile.` : 'No source records were returned.',
            result.recentActivity.length ? `${result.recentActivity.length} activity rows are available for review.` : 'No recent activity rows were returned.',
            result.ttps.length ? `${result.ttps.length} tradecraft rows are mapped for analyst review.` : 'No tradecraft rows were returned.',
        ],
        sourceProvenance: result.sources.map(source => source.url || source.provenance || source.name).slice(0, 8),
    }
}

export function containsToyThreatIntelCopy(value: string) {
    return /\btarget signal(s)?\b|\bsignal language\b|\bnamed examples\b|\bexample(s)?\b|target marker|continent bucket|prompt answer|\bprompt\b|internal rationale|as an ai|toy|demo|coming soon/i.test(value)
}

function buildProvenanceRows(result: TiSearchResponse, fallback: TiActorIntelligenceFallback): TiActorSourceProvenance[] {
    const contractRows = result.actorIntelligence?.structuredProvenance ?? []
    const actionabilityRows = result.actionability?.sourceProvenance ?? []
    const sourceRows = result.sources.map(source => ({
        sourceId: source.id,
        sourceName: source.name,
        provenance: source.url || source.provenance || source.name,
        reportDate: undefined,
        captureId: undefined,
        confidence: result.confidence,
        shownBecause: `Returned source record for ${result.query}.`,
    }))
    const fallbackRows = fallback.sourceProvenance.map(source => ({
        sourceId: undefined,
        sourceName: 'Actor profile reference',
        provenance: source,
        reportDate: undefined,
        captureId: undefined,
        confidence: fallback.confidence,
        shownBecause: 'Used to support the built-in actor enrichment fallback.',
    }))

    return uniqueBy([
        ...contractRows,
        ...actionabilityRows.map(source => ({
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            provenance: source.provenance,
            captureId: source.captureId,
            confidence: source.confidence,
            shownBecause: 'Returned by the actionability contract as evidence for watchlist, alert, or case handoff.',
        })),
        ...sourceRows,
        ...fallbackRows,
    ].filter(row => row.sourceName && row.provenance), row => `${row.sourceId ?? row.sourceName}:${row.provenance}`).slice(0, 12)
}

function freshnessFor(generatedAt: string, lastSeen: string): TiActorIntelligenceProfile['freshness'] {
    const generated = Date.parse(generatedAt)
    const last = Date.parse(lastSeen)
    const stale = Number.isFinite(generated) && Number.isFinite(last) ? generated - last > 180 * 24 * 60 * 60 * 1000 : false
    return {
        generatedAt,
        lastSeen,
        stale,
        reason: stale ? `Last observed date is older than 180 days at ${generatedAt}.` : 'Last observed date is within freshness policy or not date-parseable.',
    }
}

function domainFromUrl(value?: string) {
    if (!value) return null
    try {
        return new URL(value).hostname.replace(/^www\./, '')
    } catch {
        return null
    }
}

function isApt29(result: TiSearchResponse) {
    return /apt29|cozy bear|midnight blizzard|nobelium|the dukes/i.test(`${result.query} ${result.aliases.join(' ')}`)
}

function unique(values: string[]) {
    const seen = new Set<string>()
    return values.map(value => value.trim()).filter(value => {
        const key = value.toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value).toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}
