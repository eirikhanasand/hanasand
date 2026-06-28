import { countryFromValue, type VictimObservation } from './actorProfile'
import type { TiActorIntelligenceProfile } from './actorIntelligence'
import type { TiActionabilityContract, TiSearchResponse } from './search'

export type TiActionabilityModel = {
    alertDisposition: 'ready_for_alert_review' | 'watchlist_required' | 'case_ready' | 'not_alertable' | 'needs_enrichment'
    shouldAlert: boolean
    rationale: string
    watchlist: {
        state: 'backed_matches' | 'candidate_handoff' | 'missing_terms'
        candidates: WatchlistCandidate[]
        matches: NonNullable<TiActionabilityContract['watchlistMatches']>
        endpoint: string
        payloads: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
        blockers: string[]
    }
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    geographyHandoffs: GeographyHandoff[]
    sourceClusters: SourceCluster[]
    handoffs: {
        watchlistEndpoint: string
        alertRebuildEndpoint: string
        caseEndpoint: string
        casePayload?: { alertId: string; title?: string; priority?: string; note?: string }
        caseBlockers: string[]
    }
}

type WatchlistCandidate = {
    kind: 'company' | 'domain' | 'vendor'
    value: string
    reason: string
    confidence: number
}

export type GeographyHandoff = {
    code: string
    country: string
    role: 'operator' | 'target'
    observationCount: number
    watchlistTerm?: { kind: WatchlistCandidate['kind']; value: string; reason: string }
    enrichmentTask: string
    provenanceSummary: string
}

export type SourceCluster = {
    sourceName: string
    provenance: string
    captureId?: string
    confidence?: number
    watchlistTerm?: { kind: WatchlistCandidate['kind']; value: string; reason: string }
    enrichmentTask: string
}

export function buildTiActionability(result: TiSearchResponse, actor: TiActorIntelligenceProfile, victimObservations: VictimObservation[]): TiActionabilityModel {
    const contract = result.actionability
    const candidates = normalizeCandidates(contract?.watchlistCandidates, result, actor, victimObservations)
    const matches = contract?.watchlistMatches ?? []
    const relatedAlerts = contract?.relatedAlerts ?? []
    const relatedCases = contract?.relatedCases ?? []
    const sourceProvenance = normalizeSourceProvenance(contract?.sourceProvenance, result)
    const enrichmentGaps = normalizeEnrichmentGaps(contract?.enrichmentGaps, result, actor, sourceProvenance)
    const geographyHandoffs = buildGeographyHandoffs(result, victimObservations, candidates)
    const sourceClusters = buildSourceClusters(sourceProvenance)
    const firstAlert = relatedAlerts[0]
    const watchlistPayloads = contract?.handoffs?.watchlist?.payloads ?? candidates.slice(0, 8).map(candidate => ({
        kind: candidate.kind,
        value: candidate.value,
        notes: `${result.query}: ${candidate.reason}`,
    }))
    const watchlistEndpoint = contract?.handoffs?.watchlist?.endpoint ?? '/api/organizations/:id/watchlists'
    const alertRebuildEndpoint = contract?.handoffs?.alertRebuild?.endpoint ?? '/v1/dwm/alerts/rebuild'
    const caseEndpoint = contract?.handoffs?.caseCreate?.endpoint ?? '/v1/cases'
    const casePayload = contract?.handoffs?.caseCreate?.payload ?? (firstAlert ? {
        alertId: firstAlert.id,
        title: firstAlert.title,
        priority: firstAlert.severity,
        note: `Opened from public TI result ${result.query}.`,
    } : undefined)
    const caseBlockers = contract?.handoffs?.caseCreate?.missing ?? (casePayload ? [] : ['DWM alert ID from /v1/dwm/alerts or /v1/dwm/alerts/rebuild'])
    const alertDisposition = contract?.alertDisposition ?? dispositionFor({ candidates, matches, relatedAlerts, relatedCases, sourceProvenance, enrichmentGaps })
    const shouldAlert = contract?.shouldAlert ?? (alertDisposition === 'ready_for_alert_review' || alertDisposition === 'case_ready')

    return {
        alertDisposition,
        shouldAlert,
        rationale: contract?.rationale ?? rationaleFor(alertDisposition, candidates, matches, relatedAlerts, sourceProvenance),
        watchlist: {
            state: matches.length ? 'backed_matches' : candidates.length ? 'candidate_handoff' : 'missing_terms',
            candidates,
            matches,
            endpoint: watchlistEndpoint,
            payloads: watchlistPayloads,
            blockers: contract?.handoffs?.watchlist?.missing ?? (matches.length ? [] : ['Authenticated organization ID and member/admin watchlist permission']),
        },
        relatedAlerts,
        relatedCases,
        sourceProvenance,
        enrichmentGaps,
        geographyHandoffs,
        sourceClusters,
        handoffs: {
            watchlistEndpoint,
            alertRebuildEndpoint,
            caseEndpoint,
            casePayload,
            caseBlockers,
        },
    }
}

function normalizeCandidates(contractCandidates: TiActionabilityContract['watchlistCandidates'], result: TiSearchResponse, actor: TiActorIntelligenceProfile, victimObservations: VictimObservation[]): WatchlistCandidate[] {
    const candidates = [
        ...(contractCandidates ?? []).map(candidate => ({
            kind: normalizeKind(candidate.kind),
            value: candidate.value,
            reason: candidate.reason,
            confidence: candidate.confidence ?? 0.7,
        })),
        ...victimObservations.map(item => ({
            kind: 'company' as const,
            value: item.victim,
            reason: `Country observation for ${item.country}: ${item.sector}.`,
            confidence: 0.72,
        })),
        ...result.recentActivity.flatMap(item => item.victimName ? [{
            kind: 'company' as const,
            value: item.victimName,
            reason: `Recent activity victim field from ${item.firstReportedAt || item.date}.`,
            confidence: item.confidence,
        }] : []),
        ...result.sources.flatMap(source => {
            const domain = domainFromUrl(source.url || source.provenance)
            return domain ? [{
                kind: 'domain' as const,
                value: domain,
                reason: `Source domain attached to returned evidence: ${source.name}.`,
                confidence: 0.64,
            }] : []
        }),
        ...actor.targetSectors.slice(0, 3).map(sector => ({
            kind: 'vendor' as const,
            value: sector,
            reason: 'Sector category for buyer, supplier, and vendor exposure review.',
            confidence: 0.55,
        })),
    ]

    return uniqueBy(candidates
        .map(candidate => ({
            ...candidate,
            value: candidate.value.trim(),
            reason: candidate.reason.trim() || 'Candidate watchlist term from returned actor context.',
        }))
        .filter(candidate => Boolean(candidate.value) && !/not stated|global|multiple|various|unknown/i.test(candidate.value)), candidate => `${candidate.kind}:${candidate.value.toLowerCase()}`)
        .slice(0, 12)
}

function normalizeSourceProvenance(contractSources: TiActionabilityContract['sourceProvenance'], result: TiSearchResponse): NonNullable<TiActionabilityContract['sourceProvenance']> {
    const values = contractSources?.length ? contractSources : result.sources.map(source => ({
        sourceId: source.id,
        sourceName: source.name,
        provenance: source.url || source.provenance || source.name,
        confidence: result.confidence,
    }))
    return values.filter(item => item.sourceName && item.provenance).slice(0, 12)
}

function normalizeEnrichmentGaps(contractGaps: TiActionabilityContract['enrichmentGaps'], result: TiSearchResponse, actor: TiActorIntelligenceProfile, sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>): NonNullable<TiActionabilityContract['enrichmentGaps']> {
    const gaps = [...(contractGaps ?? [])]
    if (!sourceProvenance.some(source => source.captureId)) {
        gaps.push({
            id: 'capture-provenance',
            title: 'Attach capture IDs to source evidence',
            severity: 'high',
            detail: 'Returned sources identify provenance, but no capture IDs are attached for alert replay or case evidence.',
            dependency: 'TI search response sourceProvenance[].captureId or DWM alert evidence provenance',
        })
    }
    if (!result.actionability?.relatedAlerts?.length) {
        gaps.push({
            id: 'alert-linkage',
            title: 'Link actor result to generated alerts',
            severity: result.recentActivity.length ? 'medium' : 'high',
            detail: 'No related DWM alert IDs were returned, so the public result cannot open or create a backed case yet.',
            dependency: '/v1/dwm/alerts or /v1/dwm/alerts/rebuild alert ID',
        })
    }
    if (!actor.malwareTools.length || !actor.campaigns.length) {
        gaps.push({
            id: 'actor-enrichment',
            title: 'Complete actor enrichment fields',
            severity: 'medium',
            detail: 'Actor tools and campaigns are needed to enrich watchlists and explain defensive relevance.',
            dependency: 'TiSearchResponse.actorIntelligence.malwareTools/campaigns',
        })
    }
    return uniqueBy(gaps, gap => gap.id).slice(0, 8)
}

function buildGeographyHandoffs(result: TiSearchResponse, victimObservations: VictimObservation[], candidates: WatchlistCandidate[]): GeographyHandoff[] {
    const byCountry = new Map<string, VictimObservation[]>()
    for (const observation of victimObservations) {
        const country = countryFromValue(observation.country)
        if (!country) continue
        byCountry.set(country.code, [...(byCountry.get(country.code) ?? []), observation])
    }

    const countries = uniqueBy([
        ...victimObservations.map(observation => observation.country),
        ...result.targets.flatMap(target => target.regions),
        ...result.recentActivity.flatMap(item => item.countries ?? []),
    ].map(countryFromValue).filter((country): country is NonNullable<ReturnType<typeof countryFromValue>> => Boolean(country)), country => country.code)

    const targetRows = countries.map(country => {
        const observations = byCountry.get(country.code) ?? []
        const firstObservation = observations[0]
        const candidate = firstObservation
            ? candidates.find(item => item.value.toLowerCase() === firstObservation.victim.toLowerCase())
            : candidates.find(item => item.kind === 'vendor' && result.targets.some(target => target.sector.toLowerCase() === item.value.toLowerCase()))
        return {
            code: country.code,
            country: country.label,
            role: 'target' as const,
            observationCount: Math.max(1, observations.length),
            watchlistTerm: candidate ? { kind: candidate.kind, value: candidate.value, reason: candidate.reason } : undefined,
            enrichmentTask: firstObservation
                ? `Corroborate ${firstObservation.victim} with source capture, sector, and timestamp before customer alerting.`
                : `Collect country-specific source evidence for ${country.label} before using this geography in alert routing.`,
            provenanceSummary: observations.length
                ? observations.slice(0, 2).map(item => `${item.victim} · ${item.source}`).join(' | ')
                : 'Country is present in profile target geography without a named victim row.',
        }
    })

    const origin = /apt29|cozy bear|midnight blizzard|nobelium|the dukes/i.test(`${result.query} ${result.aliases.join(' ')}`)
        ? countryFromValue('Russia')
        : undefined
    const originRows: GeographyHandoff[] = origin ? [{
        code: origin.code,
        country: origin.label,
        role: 'operator',
        observationCount: 1,
        enrichmentTask: `Keep ${origin.label} as attribution context; do not use operator origin by itself as a customer alert condition.`,
        provenanceSummary: 'Actor attribution context from public APT29/SVR reporting.',
    }] : []

    return [...originRows, ...targetRows].slice(0, 12)
}

function buildSourceClusters(sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>): SourceCluster[] {
    return sourceProvenance.map(source => {
        const domain = domainFromUrl(source.provenance)
        return {
            sourceName: source.sourceName,
            provenance: source.provenance,
            captureId: source.captureId,
            confidence: source.confidence,
            watchlistTerm: domain ? {
                kind: 'domain' as const,
                value: domain,
                reason: `Use ${domain} to track source-specific coverage and provenance changes.`,
            } : undefined,
            enrichmentTask: source.captureId
                ? `Use capture ${source.captureId} as replayable case evidence.`
                : `Attach capture ID or source hash for ${source.sourceName} before case replay.`,
        }
    }).slice(0, 8)
}

function dispositionFor(input: {
    candidates: WatchlistCandidate[]
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
}): TiActionabilityModel['alertDisposition'] {
    if (input.relatedCases.length) return 'case_ready'
    if (input.relatedAlerts.length || input.matches.length) return 'ready_for_alert_review'
    if (input.candidates.length) return 'watchlist_required'
    if (input.sourceProvenance.length && !input.enrichmentGaps.some(gap => gap.severity === 'high')) return 'needs_enrichment'
    return 'not_alertable'
}

function rationaleFor(disposition: TiActionabilityModel['alertDisposition'], candidates: WatchlistCandidate[], matches: NonNullable<TiActionabilityContract['watchlistMatches']>, alerts: NonNullable<TiActionabilityContract['relatedAlerts']>, sources: NonNullable<TiActionabilityContract['sourceProvenance']>) {
    if (disposition === 'case_ready') return 'A related case is already attached to this actor/query result.'
    if (alerts.length) return 'A backed alert ID is attached, so this result can move into case review.'
    if (matches.length) return 'A backed organization watchlist match is attached; rebuild or open alert review before customer delivery.'
    if (candidates.length) return 'The result has watchlist candidates, but no backed organization watchlist match or alert ID was returned.'
    if (sources.length) return 'Source provenance exists, but the result has no customer-relevant watchlist terms or backed alert linkage.'
    return 'The result does not have enough source, watchlist, alert, or case data to act on yet.'
}

function normalizeKind(value: string | undefined): WatchlistCandidate['kind'] {
    if (value === 'domain' || value === 'vendor') return value
    return 'company'
}

function domainFromUrl(value?: string) {
    if (!value) return null
    try {
        return new URL(value).hostname.replace(/^www\./, '')
    } catch {
        return null
    }
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}
