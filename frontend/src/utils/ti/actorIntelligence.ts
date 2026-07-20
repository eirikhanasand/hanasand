import type { TiSearchResponse } from './search'
import type { VictimObservation } from './actorProfile'

export type TiActorSourceProvenance = {
    sourceId?: string
    sourceName: string
    provenance: string
    reportDate?: string
    captureId?: string
    sourceRequestId?: string
    sourceFamily?: string
    parserStatus?: string
    lastCollectedAt?: string
    confidence?: number
    shownBecause: string
}

export type TiActorSourceCoverage = {
    totalRows: number
    datedRows: number
    captureRows: number
    sourceIds: string[]
    sourceFamilies: Array<{
        family: string
        count: number
    }>
    latestReportDate?: string
    stale: boolean
    missing: string[]
}

export type TiActorTechniqueCoverage = {
    attackId?: string
    name: string
    tactic: string
    detail: string
    confidence: number
    sourceIds: string[]
    captureIds: string[]
    provenanceRefs: string[]
    freshness: 'ready' | 'review'
    missing: string[]
}

export type TiActorCampaignTimelineItem = {
    title: string
    firstReportedAt: string
    sourceIds: string[]
    provenanceRefs: string[]
    affectedSectors: string[]
    countries: string[]
    confidence: number
    freshness: 'ready' | 'review'
    missing: string[]
}

export type TiActorIntelligenceProfile = {
    actorClass: string
    attribution: string
    firstSeen: string
    lastSeen: string
    motivation: string[]
    malwareTools: string[]
    campaigns: string[]
    campaignTimeline: TiActorCampaignTimelineItem[]
    infrastructure: string[]
    indicators: string[]
    techniqueCoverage: TiActorTechniqueCoverage[]
    targetSectors: string[]
    geographies: string[]
    confidence: number
    confidenceReasoning: string[]
    sourceProvenance: string[]
    provenanceRows: TiActorSourceProvenance[]
    sourceCoverage: TiActorSourceCoverage
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
    const provenanceRows = buildProvenanceRows(result)
    const sourceCoverage = buildSourceCoverage(provenanceRows, result.generatedAt)
    const techniqueCoverage = buildTechniqueCoverage(result, provenanceRows)
    const campaignTimeline = buildCampaignTimeline(result, provenanceRows)
    const indicators = unique([
        ...(contract?.indicators ?? []),
        ...fallback.indicators,
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
        campaignTimeline,
        infrastructure: unique([...(contract?.infrastructure ?? []), ...fallback.infrastructure]).slice(0, 10),
        indicators,
        techniqueCoverage,
        targetSectors: targetSectors.length ? targetSectors.slice(0, 12) : fallback.targetSectors,
        geographies: geographies.length ? geographies.slice(0, 12) : fallback.geographies,
        confidence: contract?.confidence ?? result.confidence ?? fallback.confidence,
        confidenceReasoning: unique([...(contract?.confidenceReasoning ?? []), ...fallback.confidenceReasoning]).slice(0, 8),
        sourceProvenance: sourceProvenance.length ? sourceProvenance : fallback.sourceProvenance,
        provenanceRows,
        sourceCoverage,
        freshness: freshnessFor(result.generatedAt, lastSeen),
    }
}

type TiActorIntelligenceFallback = Omit<TiActorIntelligenceProfile, 'provenanceRows' | 'sourceCoverage' | 'techniqueCoverage' | 'campaignTimeline' | 'freshness'>

function fallbackActorIntelligence(result: TiSearchResponse, victimObservations: VictimObservation[]): TiActorIntelligenceFallback {
    return {
        actorClass: result.aliases.length ? 'Named threat actor or activity cluster' : 'Threat intelligence query',
        attribution: result.notes.find(note => /attribut/i.test(note)) || 'Attribution needs a cited source statement',
        firstSeen: result.recentActivity.map(item => item.firstReportedAt || item.date).filter(Boolean).sort()[0] || 'No dated activity yet',
        lastSeen: result.lastSeen || result.generatedAt,
        motivation: [],
        malwareTools: [],
        campaigns: result.recentActivity.map(item => item.title).slice(0, 6),
        infrastructure: result.recentActivity.filter(item => item.claimType === 'infrastructure_activity').map(item => item.title).slice(0, 6),
        indicators: [],
        targetSectors: result.targets.map(target => target.sector).slice(0, 8),
        geographies: unique([...result.targets.flatMap(target => target.regions), ...victimObservations.map(item => item.country)]).slice(0, 8),
        confidence: result.confidence,
        confidenceReasoning: [
            result.sources.length ? `${result.sources.length} source records are attached to the profile.` : 'No source records yet.',
            result.recentActivity.length ? `${result.recentActivity.length} activity rows are available for review.` : 'No recent activity rows yet.',
            result.ttps.length ? `${result.ttps.length} tradecraft rows are mapped for analyst review.` : 'No tradecraft rows yet.',
        ],
        sourceProvenance: result.sources.map(source => source.url || source.provenance || source.name).slice(0, 8),
    }
}

function buildProvenanceRows(result: TiSearchResponse): TiActorSourceProvenance[] {
    const contractRows = result.actorIntelligence?.structuredProvenance ?? []
    const actionabilityRows = result.actionability?.sourceProvenance ?? []
    const sourceRows = result.sources.map(source => ({
        sourceId: source.id,
        sourceName: source.name,
        provenance: source.url || source.provenance || source.name,
        reportDate: source.reportDate || source.lastCollectedAt,
        captureId: source.captureId,
        sourceFamily: source.sourceFamily,
        parserStatus: source.parserStatus,
        lastCollectedAt: source.lastCollectedAt,
        confidence: result.confidence,
        shownBecause: `Source record supporting ${result.query}.`,
    }))

    return uniqueBy([
        ...contractRows,
        ...actionabilityRows.map(source => ({
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            provenance: source.provenance,
            reportDate: source.reportDate,
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceFamily: source.sourceFamily,
            parserStatus: source.parserStatus,
            lastCollectedAt: source.lastCollectedAt,
            confidence: source.confidence,
            shownBecause: 'Evidence used for watchlist, alert, or case handoff.',
        })),
        ...sourceRows,
    ].filter(row => row.sourceName && row.provenance), row => `${row.sourceId ?? row.sourceName}:${row.provenance}`).slice(0, 12)
}

function buildSourceCoverage(rows: TiActorSourceProvenance[], generatedAt: string): TiActorSourceCoverage {
    const sourceIds = unique(rows.map(row => row.sourceId).filter((value): value is string => Boolean(value)))
    const datedRows = rows.filter(row => parseSourceDate(row.reportDate) !== null)
    const captureRows = rows.filter(row => row.captureId).length
    const latestReportDate = datedRows.map(row => row.reportDate).filter((value): value is string => Boolean(value)).sort((a, b) => {
        const parsedA = parseSourceDate(a) ?? 0
        const parsedB = parseSourceDate(b) ?? 0
        return parsedB - parsedA
    })[0]
    const generated = Date.parse(generatedAt)
    const latest = latestReportDate ? parseSourceDate(latestReportDate) : null
    const families = rows.reduce((counts, row) => {
        const family = sourceFamilyFor(row)
        counts.set(family, (counts.get(family) ?? 0) + 1)
        return counts
    }, new Map<string, number>())
    const missing = [
        rows.length ? '' : 'actorIntelligence.structuredProvenance[]',
        sourceIds.length ? '' : 'actorIntelligence.structuredProvenance[].sourceId',
        datedRows.length ? '' : 'actorIntelligence.structuredProvenance[].reportDate',
        captureRows ? '' : 'sourceProvenance[].captureId',
    ].filter(Boolean)

    return {
        totalRows: rows.length,
        datedRows: datedRows.length,
        captureRows,
        sourceIds,
        sourceFamilies: Array.from(families.entries()).map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count || a.family.localeCompare(b.family)),
        latestReportDate,
        stale: !latest || (Number.isFinite(generated) && generated - latest > 180 * 24 * 60 * 60 * 1000),
        missing,
    }
}

function buildTechniqueCoverage(result: TiSearchResponse, provenanceRows: TiActorSourceProvenance[]): TiActorTechniqueCoverage[] {
    return result.ttps.map(item => {
        const sourceIds = unique(item.sourceIds ?? [])
        const supportingRows = provenanceRows.filter(row => row.sourceId && sourceIds.includes(row.sourceId))
        const captureIds = unique([...(item.captureIds ?? []), ...supportingRows.map(row => row.captureId).filter((value): value is string => Boolean(value))])
        const provenanceRefs = unique(supportingRows.map(row => row.provenance)).slice(0, 6)
        const missing = [
            sourceIds.length ? '' : 'sourceId',
            captureIds.length ? '' : 'captureId',
            item.attackId ? '' : 'attackId',
        ].filter(Boolean)
        const freshness: TiActorTechniqueCoverage['freshness'] = missing.length || item.confidence < 0.75 ? 'review' : 'ready'
        return {
            attackId: item.attackId,
            name: item.name,
            tactic: item.tactic,
            detail: item.detail,
            confidence: item.confidence,
            sourceIds,
            captureIds,
            provenanceRefs,
            freshness,
            missing,
        }
    }).slice(0, 10)
}

function buildCampaignTimeline(result: TiSearchResponse, provenanceRows: TiActorSourceProvenance[]): TiActorCampaignTimelineItem[] {
    const rows = result.recentActivity.map(item => {
        const firstReportedAt = item.firstReportedAt || item.date || result.generatedAt
        const rowSourceIds = unique(item.sourceIds)
        const provenanceRefs = unique(provenanceRows.filter(row => row.sourceId && rowSourceIds.includes(row.sourceId)).map(row => row.provenance)).slice(0, 6)
        const affectedSectors = unique(item.affectedSectors ?? [])
        const countries = unique(item.countries ?? [])
        const missing = [
            rowSourceIds.length ? '' : 'sourceIds',
            provenanceRefs.length ? '' : 'provenanceRefs',
            Date.parse(firstReportedAt) || /\b(19|20)\d{2}\b/.test(firstReportedAt) ? '' : 'firstReportedAt',
        ].filter(Boolean)
        const freshness: TiActorCampaignTimelineItem['freshness'] = missing.length || item.confidence < 0.7 ? 'review' : 'ready'
        return {
            title: item.title,
            firstReportedAt,
            sourceIds: rowSourceIds,
            provenanceRefs,
            affectedSectors,
            countries,
            confidence: item.confidence,
            freshness,
            missing,
        }
    })

    return rows.sort((a, b) => {
        const parsedA = parseSourceDate(a.firstReportedAt) ?? 0
        const parsedB = parseSourceDate(b.firstReportedAt) ?? 0
        return parsedB - parsedA || b.confidence - a.confidence
    }).slice(0, 10)
}

function sourceFamilyFor(row: TiActorSourceProvenance) {
    const value = `${row.sourceId ?? ''} ${row.sourceName} ${row.provenance}`.toLowerCase()
    if (row.sourceFamily) return row.sourceFamily
    if (row.captureId || row.sourceRequestId) return 'source_capture'
    if (/cisa|government|advisory|allied|cert|ncsc|fbi|nsa|svr/.test(value)) return 'government_advisory'
    if (/microsoft|google|mandiant|crowdstrike|proofpoint|sentinelone|palo alto|unit 42|recorded future|secureworks|hpe|solarwinds/.test(value)) return 'vendor_disclosure'
    if (/actor profile reference/.test(value)) return 'actor_profile'
    return 'public_ti'
}

function parseSourceDate(value?: string) {
    if (!value) return null
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
    const year = value.match(/\b(19|20)\d{2}\b/)?.[0]
    return year ? Date.parse(`${year}-01-01`) : null
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
