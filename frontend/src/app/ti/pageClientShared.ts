'use client'

import searchThreatIntel, { evidenceTimestamp, TiSearchResponse } from '@/utils/ti/search'
import { activitySourceLabel, coverageMissingLabel, displayRequirementText, formatLabel, severityWeight, sourceHealthFieldLabel, unique, type AnalystWorkItem, type CaseActionTrailEvent, type CaseReviewIntakeItem, type DecisionStep, type EnrichmentTask, type SelectedCaseOwnershipPlan, type SelectedSourceDrilldown, type SelectedSourceDrilldownRow, type SourceHealthRow, type StagedHandoff, type WatchlistIntersectionRow } from './pageModel'
import { actorGeoProfile, countryFromValue, victimObservationsFor } from '@/utils/ti/actorProfile'
import { humanizeSlug } from '../seo'
import { rememberSearch } from '@/components/ti/searchSuggestions'
import { type ActorArtifactHandoffs } from '@/utils/ti/actorWorkbench'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { useEffect, useState } from 'react'

export const TI_WORKBENCH_PREVIEW_ROWS = 1
export const TI_EVIDENCE_QUEUE_PREVIEW_ROWS = 2
export const TI_SELECTED_CONTEXT_ROWS = 2
export const TI_SELECTED_CONTINUITY_REF_ROWS = 2
export const TI_SELECTED_DETAIL_LIST_ROWS = 3
export const TI_SELECTED_SOURCE_REQUEST_ROWS = 2
export const TI_MOBILE_SOURCE_FILTER_OPTIONS = 5
export const TI_ACTIVITY_TIMELINE_ROWS = 3
export const TI_SOURCE_REFERENCE_ROWS = 2
export const TI_DOSSIER_REASON_ROWS = 3
export const TI_DOSSIER_SOURCE_FAMILY_ROWS = 3
export const TI_SAVED_SEARCHES_KEY = 'hanasand:ti:saved-searches'
export const TI_SAVED_SEARCH_LIMIT = 8
export type SavedSearch = { query: string, savedAt: string }
export type PublicTiPageEffectsProps = {
    initialQuery: string
    initialResult: TiSearchResponse | null
    query: string
    result: TiSearchResponse | null
    setQuery: (value: string) => void
    setResult: (value: TiSearchResponse | null) => void
    setBusy: (value: boolean) => void
    setError: (value: string) => void
    activeQueryRef: { current: string }
    requestSeqRef: { current: number }
}
export function usePublicTiPageEffects({ initialQuery, initialResult, query, result, setQuery, setResult, setBusy, setError, activeQueryRef, requestSeqRef }: PublicTiPageEffectsProps) {
    useEffect(() => { if (initialQuery.trim()) rememberSearch(initialQuery) }, [initialQuery])

    useEffect(() => {
        document.body.dataset.publicTiRoute = 'true'
        return () => {
            delete document.body.dataset.publicTiRoute
        }
    }, [])

    useEffect(() => {
        activeQueryRef.current = query.trim().toLowerCase()
    }, [query])

    useEffect(() => {
        const titleQuery = (result?.query || query).trim()
        if (!titleQuery) {
            document.title = 'Threat Intelligence Search | Hanasand'
            return
        }

        const label = humanizeSlug(titleQuery)
        document.title = `${label} Threat Intelligence | Hanasand`
        updateMetaDescription(`Search Hanasand monitoring context for ${label}: actor names, company mentions, domains, and recent claims.`)
        updateCanonical(`/ti/${encodeURIComponent(titleQuery)}`)
    }, [query, result?.query])

    useEffect(() => {
        const clean = initialQuery.trim()
        if (!clean || initialResult) return

        const cleanKey = clean.toLowerCase()
        const requestSeq = requestSeqRef.current + 1
        requestSeqRef.current = requestSeq
        activeQueryRef.current = cleanKey
        setBusy(true)
        setQuery(clean)
        searchThreatIntel(clean, { preferCached: true })
            .then((next) => {
                if (requestSeqRef.current !== requestSeq || activeQueryRef.current !== cleanKey) return
                if (next) {
                    setError('')
                    setResult(next)
                }
                else setError('Threat intelligence search is temporarily unavailable.')
            })
            .finally(() => {
                if (requestSeqRef.current === requestSeq) setBusy(false)
            })
    }, [initialQuery, initialResult])

    useEffect(() => {
        if (!result?.refreshAfterSeconds || result.status === 'ready' || result.status === 'unavailable') return
        const expectedQuery = result.query
        const expectedKey = expectedQuery.trim().toLowerCase()
        const timer = window.setTimeout(async () => {
            const next = await searchThreatIntel(expectedQuery, { bypassCache: true })
            if (next && activeQueryRef.current === expectedKey) {
                setError('')
                setResult(next)
            } else if (activeQueryRef.current === expectedKey) {
                setError('Threat intelligence search is temporarily unavailable.')
            }
        }, Math.max(3, result.refreshAfterSeconds) * 1000)

        return () => window.clearTimeout(timer)
    }, [result])
}
export type ActorReference = { name: string; author: string; year: string; url?: string }
export const actorReferenceMetadata: Record<string, Omit<ActorReference, 'name'>> = {
    'white house imposing costs ru gov april 2021': { author: 'The White House', year: '2021', url: 'https://www.whitehouse.gov/briefing-room/statements-releases/2021/04/15/fact-sheet-imposing-costs-for-harmful-foreign-activities-by-the-russian-government/' },
    'uk gov malign ris activity april 2021': { author: 'UK Government', year: '2021', url: 'https://www.gov.uk/government/news/uk-and-us-expose-global-campaign-of-malicious-cyber-activity-by-russian-intelligence-services' },
    'f-secure the dukes': { author: 'F-Secure', year: '2015', url: 'https://www.f-secure.com/documents/996508/1030745/dukes_whitepaper.pdf' },
    'grizzly steppe jar': { author: 'U.S. Department of Homeland Security & FBI', year: '2017', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa17-110a' },
    'crowdstrike dnc june 2016': { author: 'CrowdStrike', year: '2016', url: 'https://www.crowdstrike.com/blog/bears-midst-intrusion-democratic-national-committee/' },
    'uk gov uk exposes russia solarwinds april 2021': { author: 'UK Government', year: '2021', url: 'https://www.gov.uk/government/news/uk-and-us-expose-global-campaign-of-malicious-cyber-activity-by-russian-intelligence-services' },
    'nsa joint advisory svr solarwinds april 2021': { author: 'NSA & CISA', year: '2021', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-008a' },
    'uk nscs russia solarwinds april 2021': { author: 'UK National Cyber Security Centre', year: '2021', url: 'https://www.gov.uk/government/news/uk-and-us-expose-global-campaign-of-malicious-cyber-activity-by-russian-intelligence-services' },
    'fireeye sunburst backdoor december 2020': { author: 'FireEye', year: '2020', url: 'https://www.mandiant.com/resources/blog/evasive-attacker-leverages-solarwinds-sunburst-backdoor' },
    'mstic nobelium mar 2021': { author: 'Microsoft Threat Intelligence Center', year: '2021', url: 'https://www.microsoft.com/en-us/security/blog/2021/03/04/new-solarwinds-related-threat-activity/' },
    'crowdstrike sunspot implant january 2021': { author: 'CrowdStrike', year: '2021', url: 'https://www.crowdstrike.com/blog/sunspot-malware-technical-analysis/' },
    'volexity solarwinds': { author: 'Volexity', year: '2020', url: 'https://www.volexity.com/blog/2020/12/13/novel-attack-chain-targets-us-government-agencies/' },
    'cybersecurity advisory svr ttp may 2021': { author: 'CISA', year: '2021', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-116a' },
    'unit 42 solarstorm december 2020': { author: 'Unit 42, Palo Alto Networks', year: '2020', url: 'https://unit42.paloaltonetworks.com/solarstorm-supernova/' }
}
export function citationNames(description: string) {
    const citationPattern = new RegExp('\\(Citation:\\s*([^)]+)\\)', 'g')
    const citations: string[] = []
    description.replace(citationPattern, (_match, rawName: string) => {
        const name = rawName.trim()
        if (!name) return _match
        const existing = citations.indexOf(name)
        if (existing < 0) citations.push(name)
        return _match
    })
    return citations
}
export function useMediaQuery(query: string) {
    const [matches, setMatches] = useState<boolean | null>(null)

    useEffect(() => {
        const media = window.matchMedia(query)
        const update = () => setMatches(media.matches)
        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [query])

    return matches
}
export type SecondaryAnalysisView = 'profile' | 'artifacts' | 'sources' | 'watchlist' | 'actions'
export const secondaryAnalysisViews: { id: SecondaryAnalysisView; label: string; detail: string }[] = [
    { id: 'profile', label: 'Profile', detail: 'Actor timeline and dossier' },
    { id: 'artifacts', label: 'Artifacts', detail: 'IOCs and operations' },
    { id: 'sources', label: 'Sources', detail: 'Coverage and gaps' },
    { id: 'watchlist', label: 'Watchlist', detail: 'Customer term fit' },
    { id: 'actions', label: 'Actions', detail: 'Case and delivery staging' },
]
export function freshnessReviewPayloadFor(
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    query: string,
    state: { sourceState: DecisionStep['status']; handoffState: DecisionStep['status'] },
) {
    const sourceBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
    const workflowBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'org' || blocker.ownerLane === 'alert' || blocker.ownerLane === 'case' || blocker.ownerLane === 'webhook' || blocker.ownerLane === 'entitlement')
    const requestedFields = unique([
        ...actor.sourceCoverage.missing,
        ...actionability.sourceHealthQueue.rows.flatMap(row => row.requestedFields),
        ...actionability.sourceEnrichmentIntake.items.flatMap(item => item.requestedFields),
    ])
    return {
        schemaVersion: 'ti.public_actor.freshness_review.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        queryKind: classifyPublicTiQuery(query),
        generatedAt: actor.freshness.generatedAt,
        actor: {
            actorClass: actor.actorClass,
            confidence: actor.confidence,
            firstSeen: actor.firstSeen,
            lastSeen: actor.lastSeen,
        },
        freshness: actor.freshness,
        state,
        sourceCoverage: actor.sourceCoverage,
        provenanceRows: actor.provenanceRows,
        sourceHealthQueue: {
            schemaVersion: actionability.sourceHealthQueue.schemaVersion,
            rows: actionability.sourceHealthQueue.rows,
        },
        sourceEnrichmentIntake: {
            schemaVersion: actionability.sourceEnrichmentIntake.schemaVersion,
            route: actionability.sourceEnrichmentIntake.route,
            summary: actionability.sourceEnrichmentIntake.summary,
            items: actionability.sourceEnrichmentIntake.items,
        },
        requestedFields,
        relatedWorkflow: {
            watchlist: {
                state: actionability.watchlistRelevance.state,
                terms: actionability.watchlistRelevance.terms,
                matches: actionability.watchlistRelevance.matches,
                blockers: actionability.watchlistRelevance.blockers,
            },
            alerts: actionability.relatedAlerts,
            cases: actionability.relatedCases,
            caseReviewIntake: actionability.caseReviewIntake,
        },
        blockers: {
            source: sourceBlockers,
            workflow: workflowBlockers,
        },
        handoffRoutes: {
            sourceEnrichment: actionability.sourceEnrichmentIntake.route,
            watchlist: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            alertRebuild: actionability.createAlertHandoff.backedRoute || actionability.createAlertHandoff.endpoint,
            caseReview: actionability.caseHandoff.backedRoute || actionability.caseHandoff.endpoint,
        },
    }
}
export function provenanceArtifactPayloadFor(row: TiActorIntelligenceProfile['provenanceRows'][number], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel, query: string) {
    const sourceHealthRows = actionability.sourceHealthQueue.rows.filter(item =>
        (row.sourceId ? item.sourceId === row.sourceId : false)
        || (row.captureId ? item.captureId === row.captureId : false)
        || (row.sourceRequestId ? item.sourceRequestId === row.sourceRequestId : false)
        || item.provenance === row.provenance
        || item.sourceName === row.sourceName
    )
    const sourceHealthRowIds = new Set(sourceHealthRows.map(item => item.id))
    const sourceEnrichmentItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        sourceHealthRowIds.has(item.sourceHealthRowId)
        || (row.sourceId ? item.sourceId === row.sourceId : false)
        || (row.captureId ? item.captureId === row.captureId : false)
        || (row.sourceRequestId ? item.sourceRequestId === row.sourceRequestId : false)
        || item.evidence.provenance === row.provenance
    )
    const evidencePriority = actionability.evidencePriority.filter(item =>
        (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
        || (row.captureId ? item.captureIds.includes(row.captureId) : false)
        || item.reasons.some(reason => reason.includes(row.sourceName) || reason.includes(row.provenance))
    )
    const watchlistIntersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        item.sourceEvidenceRefs.some(ref => ref === row.sourceId || ref === row.captureId || row.provenance.includes(ref) || row.sourceName.includes(ref))
    )
    return {
        schemaVersion: 'ti.public_actor.provenance_artifact.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        generatedAt: actionability.sourceHealthQueue.generatedAt,
        actor: {
            actorClass: actor.actorClass,
            confidence: actor.confidence,
            freshness: actor.freshness,
        },
        provenance: row,
        sourceHealthRows,
        sourceEnrichmentIntake: {
            schemaVersion: actionability.sourceEnrichmentIntake.schemaVersion,
            route: actionability.sourceEnrichmentIntake.route,
            matchingItems: sourceEnrichmentItems,
        },
        evidencePriority,
        watchlistIntersections,
        relatedWorkflow: {
            alerts: actionability.relatedAlerts.filter(item => evidencePriority.some(priority => priority.alertIds.includes(item.id))),
            cases: actionability.relatedCases.filter(item => {
                const path = item.path
                return Boolean(path && evidencePriority.some(priority => priority.casePaths.includes(path)))
            }),
            caseReviewIntake: actionability.caseReviewIntake.items.filter(item =>
                evidencePriority.some(priority => item.evidenceRowId === priority.rowId)
                || (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
                || (row.captureId ? item.captureIds.includes(row.captureId) : false)
            ),
        },
        handoffRoutes: {
            sourceEnrichment: actionability.sourceEnrichmentIntake.route,
            watchlist: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            alertRebuild: actionability.createAlertHandoff.backedRoute || actionability.createAlertHandoff.endpoint,
            caseReview: actionability.caseHandoff.backedRoute || actionability.caseHandoff.endpoint,
        },
    }
}
export function captureCoverageLabel(coverage: TiActorIntelligenceProfile['sourceCoverage']) {
    if (coverage.captureRows) return `${coverage.captureRows} source row${coverage.captureRows === 1 ? '' : 's'} linked`
    if (coverage.missing.includes('sourceProvenance[].captureId')) return 'sources syncing'
    return 'source optional'
}
export function techniqueCoveragePayloadFor(item: TiActorIntelligenceProfile['techniqueCoverage'][number]) {
    const missing = item.missing.length ? item.missing : [
        item.sourceIds.length ? '' : 'sourceIds',
        item.captureIds.length ? '' : 'captureId',
        item.attackId ? '' : 'attackId',
        item.provenanceRefs.length ? '' : 'provenanceRefs',
    ].filter(Boolean)
    return {
        schemaVersion: 'ti.public_actor.technique_coverage.v1',
        attackId: item.attackId,
        name: item.name,
        tactic: item.tactic,
        detail: item.detail,
        confidence: item.confidence,
        freshness: item.freshness,
        sourceIds: item.sourceIds,
        captureIds: item.captureIds,
        provenanceRefs: item.provenanceRefs,
        route: missing.length ? '/ti/profiles' : '/ti/workbench',
        recommendedAction: missing.length ? 'queue_enrichment' : 'attach_to_case_review',
        blockedBy: missing.map(field => ({
            ownerLane: /capture|source|provenance/i.test(field) ? 'source' : 'public-ti',
            field,
            reason: `Attach ${coverageMissingLabel(field)} before using this technique row for case or detection review.`,
        })),
    }
}
export function campaignActivityPayloadFor(item: TiActorIntelligenceProfile['campaignTimeline'][number]) {
    const missing = item.missing.length ? item.missing : [
        item.sourceIds.length ? '' : 'sourceIds',
        item.provenanceRefs.length ? '' : 'provenanceRefs',
        Date.parse(item.firstReportedAt) || /\b(19|20)\d{2}\b/.test(item.firstReportedAt) ? '' : 'firstReportedAt',
    ].filter(Boolean)
    return {
        schemaVersion: 'ti.public_actor.campaign_activity.v1',
        title: item.title,
        firstReportedAt: item.firstReportedAt,
        confidence: item.confidence,
        freshness: item.freshness,
        affectedSectors: item.affectedSectors,
        countries: item.countries,
        sourceIds: item.sourceIds,
        provenanceRefs: item.provenanceRefs,
        route: missing.length ? '/ti/profiles' : '/ti/workbench',
        recommendedAction: missing.length ? 'queue_enrichment' : 'attach_to_case_review',
        blockedBy: missing.map(field => ({
            ownerLane: /source|provenance/i.test(field) ? 'source' : 'public-ti',
            field,
            reason: `Attach ${coverageMissingLabel(field)} before using this activity row for case review.`,
        })),
    }
}
export function sourceEvidenceRequestPayloadFor(row: SelectedSourceDrilldownRow, drilldown: SelectedSourceDrilldown) {
    return {
        schemaVersion: 'ti.public_actor.source_evidence_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: drilldown.query,
        generatedAt: drilldown.generatedAt,
        selectedItemId: drilldown.selectedItem.id,
        selectedItemTitle: drilldown.selectedItem.title,
        rowId: row.rowId,
        sourceName: row.sourceName,
        sourceId: row.sourceId,
        provenance: row.provenance,
        href: row.href,
        captureId: row.captureId,
        reportDate: row.reportDate,
        confidence: row.confidence,
        state: row.state,
        ownerLane: row.ownerLane,
        route: row.route,
        missing: row.missing,
        handoff: row.handoff,
    }
}
export function analystWorkItemsFor(result: TiSearchResponse, victimObservations: ReturnType<typeof victimObservationsFor>, sourceUrlById: Map<string, string | undefined>, actionability: TiActionabilityModel): AnalystWorkItem[] {
    const priorityByRow = new Map(actionability.evidencePriority.map(priority => [priority.rowId, priority]))
    const activityItems: AnalystWorkItem[] = result.recentActivity.map((item, index) => {
        const href = item.url || item.sourceIds.map(id => sourceUrlById.get(id)).find(Boolean)
        const exposure = item.victimName || item.claimType === 'victim_claim' || /victim|leak|claim|stolen|exfiltrat|credential/i.test(`${item.title} ${item.detail}`)
        const id = `activity-${index}-${item.date}-${item.title}`.toLowerCase()
        const priority = priorityByRow.get(id)
        return {
            id,
            kind: exposure ? 'exposure' : 'activity',
            severity: exposure ? 'high' : item.confidence >= 0.75 ? 'medium' : 'low',
            status: exposure ? 'needs review' : 'monitor',
            title: item.victimName || item.title,
            subtitle: item.impact || item.detail,
            detail: item.detail,
            timestamp: evidenceTimestamp(item.firstReportedAt, item.date),
            source: activitySourceLabel(item.sourceIds.length),
            provenance: item.publisherCount ? `${item.publisherCount} publisher${item.publisherCount === 1 ? '' : 's'}` : 'Activity result',
            confidence: item.confidence,
            assertionKind: item.assertionKind || 'source_claim',
            reviewState: item.reviewState,
            corroborationState: item.corroborationState,
            observationSummary: item.observationSummary,
            href,
            evidence: [
                item.title,
                item.impact || item.detail,
                item.affectedSectors?.length ? `Affected sectors: ${item.affectedSectors.join(', ')}` : 'Affected sector not stated.',
                item.countries?.length ? `Countries: ${item.countries.join(', ')}` : 'Country not stated.',
            ],
            nextActions: exposure
                ? ['Review sources before customer alerting.', 'Check whether the victim/domain is in a watched portfolio.', 'Escalate if the claim is fresh, corroborated, or customer-relevant.']
                : ['Review for relevance to the selected actor or company.', 'Open the source when available.', 'Close if it is duplicate background reporting.'],
            priority,
        }
    })

    const victimItems: AnalystWorkItem[] = victimObservations.map((item, index) => {
        const id = `victim-${index}-${item.victim}`.toLowerCase()
        return {
            id,
            kind: 'victim',
            severity: item.confidence >= 0.85 ? 'high' : item.confidence >= 0.65 ? 'medium' : 'low',
            status: 'profile evidence',
            title: item.victim,
            subtitle: `${item.country} · ${item.sector}`,
            detail: item.incident,
            timestamp: item.timeframe,
            source: item.source,
            provenance: 'Country-level actor profile evidence',
            confidence: item.confidence,
            assertionKind: 'source_claim',
            evidence: [
                `Country: ${item.country}`,
                `Sector: ${item.sector}`,
                `Timeframe: ${item.timeframe}`,
                item.incident,
            ],
            nextActions: ['Use as actor profile context, not as a current alert by itself.', 'Corroborate with source links before notifying a customer.', 'Keep broad regions and alliance buckets out of the country map.'],
            priority: priorityByRow.get(id),
        }
    })

    const tradecraftItems: AnalystWorkItem[] = result.ttps.slice(0, 4).map((item, index) => ({
        id: `ttp-${index}-${item.attackId || item.name}`.toLowerCase(),
        kind: 'tradecraft',
        severity: item.confidence >= 0.8 ? 'medium' : 'low',
        status: 'detection context',
        title: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        subtitle: item.tactic,
        detail: item.detail,
        timestamp: 'Observation date unavailable',
        source: 'Actor profile',
        provenance: item.attackId ? 'MITRE ATT&CK mapped profile field' : 'Profile tradecraft field',
        confidence: item.confidence,
        assertionKind: 'extracted',
        evidence: [item.tactic, item.detail],
        nextActions: ['Map to defensive detections or hunting queries.', 'Prioritize techniques that match current exposure or recent activity.', 'Close if this is generic background for the current shift.'],
    }))

    const reviewItems: AnalystWorkItem[] = result.analystLoop?.metadataReviewInbox.map((item, index) => ({
        id: `review-${item.id || index}`.toLowerCase(),
        kind: 'exposure',
        severity: item.allowedActions.includes('notify_company') ? 'critical' : 'high',
        status: item.status.replaceAll('_', ' '),
        title: item.company || item.victim || 'Recent attack mention',
        subtitle: [item.affectedAccounts, item.datasetSize, item.claimedDate].filter(Boolean).join(' · ') || 'Sensitive-source review item',
        detail: item.actorStatement || 'Review the captured safe fields before taking action.',
        timestamp: evidenceTimestamp(item.claimedDate),
        source: item.sourceHash ? `source hash ${item.sourceHash}` : 'Sensitive-source review inbox',
        provenance: item.provenance || 'Sensitive-source review',
        confidence: item.confidence,
        assertionKind: 'source_claim',
        evidence: [
            item.affectedAccounts ? `Affected accounts: ${item.affectedAccounts}` : 'Affected accounts not stated.',
            item.accountSubjects ? `Account subjects: ${item.accountSubjects}` : 'Account subjects not stated.',
            item.datasetSize ? `Dataset size: ${item.datasetSize}` : 'Dataset size not stated.',
            item.actorStatement ? `Actor statement: ${item.actorStatement}` : 'Actor statement is not in the safe fields.',
        ],
        nextActions: item.allowedActions.map(action => formatLabel(action)),
    })) ?? []

    return [...reviewItems, ...activityItems, ...victimItems, ...tradecraftItems]
        .sort((a, b) => (b.priority?.score ?? 0) - (a.priority?.score ?? 0) || severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)
}
export function countLinkedLabel(count: number, label: string) {
    if (!count) return ''
    return `${count} ${label}${count === 1 ? '' : 's'} linked`
}
export type RelatedRecordRow = {
    id: string
    label: string
    meta: string
    route?: string
    kind: 'Alert' | 'Case'
    recordId: string
}
export function relatedRecordHandoffPayloadFor(record: RelatedRecordRow, actionability: TiActionabilityModel, query: string) {
    const alert = record.kind === 'Alert' ? actionability.relatedAlerts.find(item => item.id === record.recordId) : undefined
    const relatedCase = record.kind === 'Case' ? actionability.relatedCases.find(item => item.id === record.recordId) : undefined
    const matchingCaseItems = actionability.caseReviewIntake.items.filter(item =>
        item.alertIds.includes(record.recordId)
        || item.casePaths.includes(record.route ?? '')
        || (alert?.casePath ? item.casePaths.includes(alert.casePath) : false)
        || (relatedCase?.path ? item.casePaths.includes(relatedCase.path) : false)
    )
    const deliveryBlockers = alert?.deliveryReadinessContext?.blockerCodes ?? []
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.alertIds.includes(record.recordId)
        || row.caseId === record.recordId
        || row.provenance.casePaths.includes(record.route ?? '')
    )
    return {
        schemaVersion: 'ti.public_actor.related_record_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        record: {
            id: record.recordId,
            kind: record.kind.toLowerCase(),
            label: record.label,
            meta: record.meta,
            route: record.route,
        },
        alert,
        case: relatedCase,
        caseReviewIntake: matchingCaseItems,
        caseReplayReadiness: {
            schemaVersion: actionability.caseReplayReadiness.schemaVersion,
            routeTemplate: actionability.caseReplayReadiness.routeTemplate,
            rows: replayRows,
            safeOutput: actionability.caseReplayReadiness.safeOutput,
        },
        sourceProvenance: actionability.sourceProvenance,
        readiness: {
            publicTi: actionability.readiness,
            consumer: actionability.consumerReadiness,
            delivery: alert?.deliveryReadinessContext,
            blockers: [
                ...actionability.readiness.blockers,
                ...deliveryBlockers.map(code => ({
                    schemaVersion: 'ti.public_actor.readiness_blocker.v1' as const,
                    code,
                    category: 'webhook' as const,
                    ownerLane: 'webhook' as const,
                    field: `relatedAlerts.${record.recordId}.deliveryReadinessContext`,
                    detail: `Delivery status blocker: ${code}.`,
                    route: '/findings',
                    handoff: 'Resolve delivery status before sending or replaying this alert.',
                    source: 'delivery_readiness' as const,
                })),
            ],
        },
        handoffRoutes: {
            alertRebuild: actionability.createAlertHandoff.backedRoute,
            case: record.route || actionability.caseHandoff.backedRoute,
            sourceEnrichment: actionability.exportPayloads.enrichment.backedRoute,
            webhookDelivery: actionability.webhookDeliveryHandoff.backedRoute,
        },
    }
}
export function caseReplayCandidatePayloadFor(item: CaseReviewIntakeItem, actionability: TiActionabilityModel) {
    const replayRow = actionability.caseReplayReadiness.rows.find(row => row.caseReviewIntakeItemId === item.id)
    return {
        schemaVersion: 'ti.public_actor.case_replay_candidate_export.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: actionability.caseReplayReadiness.query,
        generatedAt: actionability.caseReplayReadiness.generatedAt,
        routeTemplate: actionability.caseReplayReadiness.routeTemplate,
        candidate: item,
        replayReadiness: replayRow,
        safeOutput: actionability.caseReplayReadiness.safeOutput,
    }
}
export function actionPayloadSummaryLines(
    payload: TiActionabilityModel['actionPayloads']['payloads'][keyof TiActionabilityModel['actionPayloads']['payloads']],
    actionability: TiActionabilityModel,
) {
    if (payload.kind === 'watchlist_add') {
        return [
            `${actionability.watchlistRelevance.terms.length} watchlist term${actionability.watchlistRelevance.terms.length === 1 ? '' : 's'}`,
            `${actionability.watchlistRelevance.matches.length} org match${actionability.watchlistRelevance.matches.length === 1 ? '' : 'es'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'case_handoff') {
        return [
            `${actionability.caseReviewIntake.summary.total} case candidate${actionability.caseReviewIntake.summary.total === 1 ? '' : 's'}`,
            `${actionability.caseReviewIntake.summary.alerts} alert${actionability.caseReviewIntake.summary.alerts === 1 ? '' : 's'}`,
            `${actionability.caseReviewIntake.summary.captures} capture${actionability.caseReviewIntake.summary.captures === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'webhook_delivery') {
        return [
            `${actionability.readiness.backedIds.webhookDestinationIds.length} destination${actionability.readiness.backedIds.webhookDestinationIds.length === 1 ? '' : 's'}`,
            `${actionability.readiness.backedIds.captureIds.length} capture${actionability.readiness.backedIds.captureIds.length === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'analyst_handoff_bundle') {
        return [
            `${actionability.consumerReadiness.stages.length} console stage${actionability.consumerReadiness.stages.length === 1 ? '' : 's'}`,
            `${actionability.alertGenerationReadiness.candidateCount} alert candidate${actionability.alertGenerationReadiness.candidateCount === 1 ? '' : 's'}`,
            actionability.alertGenerationReadiness.generationEvidenceWindowReady ? 'evidence window ready' : 'evidence window pending',
            `${actionability.readiness.backedIds.alertIds.length} alert${actionability.readiness.backedIds.alertIds.length === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    return [
        `${actionability.sourceEnrichmentIntake.summary.total} source item${actionability.sourceEnrichmentIntake.summary.total === 1 ? '' : 's'}`,
        `${actionability.sourceEnrichmentIntake.summary.sourceRequests} source request${actionability.sourceEnrichmentIntake.summary.sourceRequests === 1 ? '' : 's'}`,
        `${actionability.sourceEnrichmentIntake.summary.captures} capture${actionability.sourceEnrichmentIntake.summary.captures === 1 ? '' : 's'}`,
        `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
    ]
}
export type ConsumerRequestField = {
    label: string
    value: string
    state: DecisionStep['status']
}
export function consumerRequestFields(stage: TiActionabilityModel['consumerReadiness']['stages'][number]): ConsumerRequestField[] {
    const body = stage.request?.body ?? {}
    const specs: Record<TiActionabilityModel['consumerReadiness']['stages'][number]['id'], Array<{ key: string; label: string; required: boolean }>> = {
        publicTi: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'terms', label: 'Terms', required: true },
        ],
        orgWatchlist: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'watchlistId', label: 'Watchlist', required: true },
            { key: 'watchlistItemIds', label: 'Items', required: true },
        ],
        caseHandoff: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'alertId', label: 'Alert', required: true },
            { key: 'captureIds', label: 'Captures', required: true },
            { key: 'casePath', label: 'Case link', required: false },
        ],
        webhookTrigger: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'alertId', label: 'Alert', required: true },
            { key: 'webhookDestinationIds', label: 'Destination', required: true },
            { key: 'captureIds', label: 'Captures', required: true },
            { key: 'idempotencyKey', label: 'Idempotency', required: true },
        ],
        enrichment: [
            { key: 'tasks', label: 'Tasks', required: true },
            { key: 'sources', label: 'Sources', required: false },
        ],
    }

    return specs[stage.id]
        .map(spec => {
            const value = readRequestField(body[spec.key])
            return {
                label: spec.label,
                value: value ?? 'needed',
                state: value ? 'ready' as const : spec.required ? 'blocked' as const : 'review' as const,
            }
        })
        .filter(field => field.state !== 'review' || field.value !== 'needed')
}
export function readRequestField(value: unknown) {
    if (Array.isArray(value)) return value.length ? `${value.length}` : ''
    if (typeof value === 'string') return value.trim() ? value : ''
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
    if (typeof value === 'boolean') return value ? 'yes' : 'no'
    if (value && typeof value === 'object') return Object.keys(value).length ? 'set' : ''
    return ''
}
export function consumerFieldClass(state: DecisionStep['status']) {
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'
    return 'max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}
export function sourceHealthChipClass(state: SourceHealthRow['state']) {
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'
    return 'max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}
export function compactSourceReferenceLabel(value: string, sourceName?: string, query?: string) {
    const cleaned = displayRequirementText(value).trim()
    const fallback = sourceReferenceSummary(sourceName, query)
    if (!cleaned) return fallback
    if (/^https?:\/\//i.test(value) || /[/?=&]{2,}/.test(value)) return fallback
    if (/[{}[\]]/.test(value) || /\b[a-f0-9]{24,}\b/i.test(value)) return fallback
    if (cleaned.length > 96) return fallback
    return cleaned
}
export function sourceReferenceSummary(sourceName?: string, query?: string) {
    const source = (sourceName || 'This source').trim()
    const actor = humanizeSlug(query || 'this actor')
    if (/malpedia/i.test(source)) return `Malpedia's actor summary for ${actor}.`
    if (/mitre/i.test(source)) return `MITRE ATT&CK's group profile for ${actor}.`
    if (/google cloud security/i.test(source)) return `Google Cloud Security's APT group directory entry for ${actor}.`
    if (/cisa/i.test(source)) return `CISA advisories used to cross-check public government reporting on ${actor}.`
    if (/live reporting query/i.test(source)) return `Live news search used to refresh recent reporting on ${actor}.`
    return `Related reading from ${source} for ${actor} context.`
}
export function sourceHealthEvidenceLabel(row: SourceHealthRow) {
    if (row.captureId) return 'capture reference linked'
    const hasFieldPath = row.provenance.includes('[') || row.provenance.includes(']') || /sourceProvenance|relatedAlerts|handoffs|actorIntelligence/i.test(row.provenance)
    if (hasFieldPath) {
        return `${formatLabel(row.sourceFamily)} evidence request`
    }
    return compactSourceReferenceLabel(row.provenance)
}
export function handoffMissingLabel(values: string[]) {
    return unique(values.map(value => {
        if (/sourceProvenance|capture|source request|source URL|source hash|url/i.test(value)) return sourceHealthFieldLabel(value)
        if (/organization|org|tenant/i.test(value)) return 'organization scope'
        if (/watchlist/i.test(value)) return 'watchlist item'
        if (/alert/i.test(value)) return 'alert review'
        if (/case/i.test(value)) return 'case link'
        if (/webhook|destination/i.test(value)) return 'webhook destination'
        if (/fresh|stale|after/i.test(value)) return 'fresh source evidence'
        return value
    })).join('; ')
}
export function sourceRequestCaptureClass(ready: boolean) {
    return ready
        ? 'max-w-full wrap-break-word rounded-md bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'
        : 'max-w-full wrap-break-word rounded-md bg-ui-raised/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-text dark:bg-ui-raised/10 dark:text-ui-text'
}
export function sourceRequestFamilyLabel(value: string) {
    if (value === 'source_capture') return 'source capture'
    return formatLabel(value)
}
export function recommendedActionLabel(value: string) {
    return displayRequirementText(formatLabel(value))
}
export function artifactReferenceChips(refs: NonNullable<ActorArtifactHandoffs['authBridge']['payload']['evidenceRefs']>) {
    return [
        { label: 'captures', value: refs.captureIds.length },
        { label: 'alerts', value: refs.alertIds.length },
        { label: 'cases', value: refs.casePaths.length },
        { label: 'watch terms', value: refs.watchlistTerms.length },
        { label: 'sources', value: refs.sourceNames.length },
    ].filter(item => item.value > 0)
}
export function decisionStepsFor(actionability: TiActionabilityModel): DecisionStep[] {
    const sourceGap = actionability.enrichmentGapQueue.find(gap => gap.sourceFamily === 'source_capture')
    const sourceMissing = sourceGap ? sourceGap.requestedFields : []
    const hasSourceProvenance = actionability.sourceProvenance.length > 0
    const sourceStatus: DecisionStep['status'] = !hasSourceProvenance ? 'blocked' : sourceMissing.length ? 'review' : 'ready'
    const enrichmentWorkCount = actionability.enrichmentGapQueue.length + actionability.sourceClusters.length
    return [
        {
            id: 'source-review',
            label: 'Review sources',
            status: sourceStatus,
            detail: hasSourceProvenance
                ? `${actionability.sourceProvenance.length} source reference${actionability.sourceProvenance.length === 1 ? '' : 's'} found; ${sourceMissing.length ? 'capture details still needed' : 'evidence is attached'}.`
                : 'No source result is attached to this actor result.',
            payload: actionability.exportPayloads.enrichment,
            route: sourceGap?.route ?? actionability.exportPayloads.enrichment.backedRoute,
            missing: sourceMissing,
        },
        {
            id: 'watchlist',
            label: 'Prepare watchlist',
            status: actionability.watchlistRelevance.blockers.length ? 'blocked' : actionability.watchlistRelevance.matches.length ? 'ready' : 'review',
            detail: actionability.watchlistRelevance.terms.length
                ? `${actionability.watchlistRelevance.terms.length} candidate term${actionability.watchlistRelevance.terms.length === 1 ? '' : 's'}; ${actionability.watchlistRelevance.matches.length} org match${actionability.watchlistRelevance.matches.length === 1 ? '' : 'es'} linked.`
                : 'No watchlist term is attached to this result.',
            payload: actionability.exportPayloads.watchlist,
            route: actionability.exportPayloads.watchlist.backedRoute,
            missing: actionability.watchlistRelevance.blockers,
        },
        {
            id: 'alert-rebuild',
            label: 'Rebuild alerts',
            status: actionability.createAlertHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.createAlertHandoff.blocked ? 'Alert rebuild needs watchlist or org context.' : 'Ready to rebuild from matched watchlist terms.',
            payload: actionability.createAlertHandoff,
            route: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        {
            id: 'case',
            label: 'Open case',
            status: actionability.caseHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.caseHandoff.blocked ? 'Case creation needs alert review and org-scoped context.' : 'Ready to open from related alert context.',
            payload: actionability.caseHandoff,
            route: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        {
            id: 'webhook-delivery',
            label: 'Deliver webhook',
            status: actionability.webhookDeliveryHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.webhookDeliveryHandoff.blocked ? 'Delivery needs alert, capture, and destination context.' : 'Dry-run delivery can be prepared from alert and destination context.',
            payload: actionability.webhookDeliveryHandoff,
            route: actionability.webhookDeliveryHandoff.backedRoute,
            missing: actionability.webhookDeliveryHandoff.missing,
        },
        {
            id: 'enrichment',
            label: 'Review profile updates',
            status: actionability.exportPayloads.enrichment.blocked ? 'blocked' : enrichmentWorkCount ? 'review' : 'ready',
            detail: `${enrichmentWorkCount} source or profile update${enrichmentWorkCount === 1 ? '' : 's'} available.`,
            payload: actionability.exportPayloads.enrichment,
            route: actionability.exportPayloads.enrichment.backedRoute,
            missing: actionability.exportPayloads.enrichment.missing,
        },
    ]
}
export function collectionGapTaskPayloadFor(task: EnrichmentTask, intake: TiActionabilityModel['sourceEnrichmentIntake']) {
    const requestedFields = task.requestedFields ?? []
    const matchingItems = intake.items.filter(item =>
        item.route === task.route
        || item.ownerLane === task.ownerLane
        || item.sourceFamily === task.sourceFamily
        || item.requestedFields.some(field => requestedFields.includes(field))
    )
    return {
        schemaVersion: 'ti.public_actor.collection_gap_task.v1',
        source: 'public-ti',
        sessionLocal: true,
        title: task.title,
        status: task.status,
        detail: task.detail,
        sourceFamily: task.sourceFamily,
        route: task.route,
        ownerLane: task.ownerLane,
        requestedFields,
        intakeRoute: intake.route,
        intakeItems: matchingItems,
        summary: {
            matchingItems: matchingItems.length,
            sourceRequests: matchingItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: matchingItems.filter(item => Boolean(item.captureId)).length,
            blockers: matchingItems.reduce((count, item) => count + item.blockedBy.length, 0),
        },
    }
}
export function actorEnrichmentConsumerLabel(consumer: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['consumer']) {
    if (consumer === 'publicTI') return 'Threat profile'
    if (consumer === 'alertGeneration') return 'Alert generation'
    return 'Collection'
}
export function actorEnrichmentConsumerState(state: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['state']) {
    if (state === 'ready') return 'ready'
    if (state === 'action_required') return 'review'
    return 'review'
}
export function sourceRefreshPayloadFor(
    row: SourceHealthRow,
    queue: TiActionabilityModel['sourceHealthQueue'],
    intake: TiActionabilityModel['sourceEnrichmentIntake'],
    payload: TiActionabilityModel['exportPayloads']['enrichment'],
) {
    const matchingIntakeItems = intake.items.filter(item =>
        item.sourceHealthRowId === row.id
        || item.sourceRequestId === row.sourceRequestId
        || item.sourceId === row.sourceId
        || item.captureId === row.captureId
        || item.requestedFields.some(field => row.requestedFields.includes(field))
    )
    return {
        schemaVersion: 'ti.public_actor.source_refresh_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: queue.query,
        generatedAt: queue.generatedAt,
        rowId: row.id,
        sourceName: row.sourceName,
        sourceFamily: row.sourceFamily,
        state: row.state,
        route: row.route,
        ownerLane: row.ownerLane,
        sourceId: row.sourceId,
        sourceRequestId: row.sourceRequestId,
        captureId: row.captureId,
        requestedFields: row.requestedFields,
        evidence: {
            provenance: row.provenance,
            timestamp: row.timestamp,
            confidence: row.confidence,
            parserStatus: row.parserStatus,
        },
        blockers: row.requestedFields.map(field => ({
            code: 'missing_field',
            field,
            label: sourceHealthFieldLabel(field),
        })),
        queueSummary: queue.summary,
        sourceEnrichmentIntake: {
            schemaVersion: intake.schemaVersion,
            route: intake.route,
            summary: intake.summary,
            matchingItems: matchingIntakeItems,
        },
        enrichmentPayload: payload,
        handoff: {
            route: row.route || intake.route,
            ready: row.state === 'ready',
            blocked: row.state === 'blocked' || row.requestedFields.length > 0,
            matchingIntakeItems: matchingIntakeItems.length,
            sourceRequests: matchingIntakeItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: matchingIntakeItems.filter(item => Boolean(item.captureId)).length,
        },
        recommendedAction: row.captureId ? 'inspect_capture' : row.sourceRequestId ? 'track_source_request' : 'queue_enrichment',
        nextAction: row.nextAction,
    }
}
export function watchlistIntersectionPayloadFor(row: WatchlistIntersectionRow) {
    return {
        schemaVersion: 'ti.public_actor.watchlist_intersection_request.v1',
        intersectionId: row.intersectionId,
        kind: row.kind,
        value: row.value,
        state: row.state,
        route: row.route,
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        watchlistId: row.watchlistId,
        watchlistItemId: row.watchlistItemId,
        alertIds: row.alertIds,
        caseIds: row.caseIds,
        casePaths: row.casePaths,
        captureIds: row.captureIds,
        webhookDestinationIds: row.webhookDestinationIds,
        sourceEvidenceRefs: row.sourceEvidenceRefs,
        sourceFamilies: row.sourceFamilies,
        recommendedAction: row.recommendedAction,
        blockers: row.blockers,
    }
}
export function caseReviewCandidatePayloadFor(row: CaseReviewIntakeItem, query: string) {
    return {
        schemaVersion: 'ti.public_actor.case_review_candidate.v1',
        query,
        candidateId: row.id,
        evidenceRowId: row.evidenceRowId,
        title: row.title,
        score: row.score,
        priority: row.priority,
        state: row.state,
        route: row.route,
        alertIds: row.alertIds,
        casePaths: row.casePaths,
        captureIds: row.captureIds,
        sourceIds: row.sourceIds,
        watchlistTerms: row.watchlistTerms,
        reasons: row.reasons,
        blockers: row.blockedBy,
        recommendedAction: row.recommendedAction,
        nextAction: row.nextAction,
    }
}
export function caseReviewReferenceSummary(item: SelectedCaseOwnershipPlan['caseReviewItems'][number]) {
    const parts = [
        item.alertIds.length ? `${item.alertIds.length} alert${item.alertIds.length === 1 ? '' : 's'} linked` : 'alert link pending',
        item.casePaths.length ? `${item.casePaths.length} case route${item.casePaths.length === 1 ? '' : 's'} linked` : '',
        item.captureIds.length ? `${item.captureIds.length} capture${item.captureIds.length === 1 ? '' : 's'} linked` : '',
    ].filter(Boolean)
    return parts.join(' · ')
}
export function eventProvenanceSummary(provenance: CaseActionTrailEvent['provenance']) {
    const parts = [
        provenance.sourceIds.length ? `${provenance.sourceIds.length} source${provenance.sourceIds.length === 1 ? '' : 's'} linked` : 'source link pending',
        provenance.captureIds.length ? `${provenance.captureIds.length} capture${provenance.captureIds.length === 1 ? '' : 's'} linked` : '',
        provenance.alertIds.length ? `${provenance.alertIds.length} alert${provenance.alertIds.length === 1 ? '' : 's'} linked` : '',
    ].filter(Boolean)
    return parts.join(' · ')
}
export function stagedReadinessChips(item: StagedHandoff) {
    const sourceMissing = unique(item.sourceDrilldown.rows.flatMap(row => row.missing))
    const actorReady = item.caseCreateRequest.actorContext.sourceCoverage.totalRows > 0 && item.caseCreateRequest.actorContext.techniques.length > 0
    const artifactReady = !item.selectedArtifact.readiness.blockers.length && !item.selectedArtifact.readiness.missing.length
    const replayReady = item.caseCreateRequest.actionReplay.rows.some(row => row.ready)
    const ownershipReady = item.caseOwnership.state === 'ready' && item.caseOwnership.blockers.length === 0
    const alertReady = item.alertPlan.ready && item.alertPlan.blockers.length === 0
    const deliveryReady = item.deliveryPlan.state === 'ready' && item.deliveryPlan.blockers.length === 0
    const enrichmentReady = item.enrichmentTriage.state !== 'blocked' && item.enrichmentTriage.summary.blockers === 0
    const trailReady = item.caseActionTrail.summary.replayable && item.caseActionTrail.summary.blocked === 0
    const lowerLevelFollowUps = [
        actorReady ? 0 : 1,
        artifactReady ? 0 : item.selectedArtifact.readiness.blockers.length || item.selectedArtifact.readiness.missing.length || 1,
        item.caseCreateRequest.watchlistBasis.ready ? 0 : item.caseCreateRequest.watchlistBasis.blockers.length || 1,
        enrichmentReady ? 0 : item.enrichmentTriage.summary.blockers || 1,
        replayReady ? 0 : 1,
    ].reduce((total, count) => total + count, 0)
    return [
        { label: 'review', value: item.reviewHandoff.blockers.length ? `${item.reviewHandoff.blockers.length} follow-up${item.reviewHandoff.blockers.length === 1 ? '' : 's'}` : 'ready', ready: item.reviewHandoff.blockers.length === 0 },
        { label: 'source', value: sourceMissing.length ? `${sourceMissing.length} missing` : `${item.sourceDrilldown.rows.length} result${item.sourceDrilldown.rows.length === 1 ? '' : 's'}`, ready: sourceMissing.length === 0 },
        { label: 'case', value: item.caseDraft.missing.length ? `${item.caseDraft.missing.length} missing` : item.caseDraft.route ? 'case link ready' : 'draft ready', ready: item.caseDraft.missing.length === 0 },
        { label: 'owner', value: ownershipReady ? item.caseOwnership.owner.label : item.caseOwnership.blockers.length ? `${item.caseOwnership.blockers.length} follow-up${item.caseOwnership.blockers.length === 1 ? '' : 's'}` : 'review', ready: ownershipReady },
        { label: 'alert', value: alertReady ? `${item.alertPlan.readiness.matchedCandidateCount} matched` : item.alertPlan.blockers.length ? `${item.alertPlan.blockers.length} follow-up${item.alertPlan.blockers.length === 1 ? '' : 's'}` : 'review', ready: alertReady },
        { label: 'delivery', value: deliveryReady ? `${item.deliveryPlan.summary.destinations} destination${item.deliveryPlan.summary.destinations === 1 ? '' : 's'}` : item.deliveryPlan.blockers.length ? `${item.deliveryPlan.blockers.length} follow-up${item.deliveryPlan.blockers.length === 1 ? '' : 's'}` : 'review', ready: deliveryReady },
        { label: 'source review', value: enrichmentReady ? `${item.enrichmentTriage.summary.intakeItems} intake` : item.enrichmentTriage.summary.blockers ? `${item.enrichmentTriage.summary.blockers} follow-up${item.enrichmentTriage.summary.blockers === 1 ? '' : 's'}` : 'review', ready: enrichmentReady },
        { label: 'activity', value: trailReady ? `${item.caseActionTrail.summary.total} events` : item.caseActionTrail.summary.blocked ? `${item.caseActionTrail.summary.blocked} syncing` : 'review', ready: trailReady },
        ...(lowerLevelFollowUps ? [{ label: 'more', value: `${lowerLevelFollowUps} follow-up${lowerLevelFollowUps === 1 ? '' : 's'}`, ready: false }] : []),
    ]
}
export function classifyPublicTiQuery(query: string): NonNullable<TiSearchResponse['queryKind']> {
    const clean = query.trim()
    if (/^cve-\d{4}-\d{4,}$/i.test(clean)) return 'cve'
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(clean)) return 'domain'
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(clean) || /^(?:https?:\/\/|[a-f0-9]{32,128}$)/i.test(clean)) return 'indicator'
    if (/^(?:apt\d+|lockbit|akira|cozy bear|midnight blizzard)$/i.test(clean)) return 'actor'
    return clean.includes(' ') ? 'organization' : 'free_text'
}
export function formatDate(value: string) {
    if (!value) return 'Date unavailable'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toISOString().slice(0, 10)
}
export function techniqueDescription(attackId: string, name: string, tactic: string, detail: string) {
    const descriptions: Record<string, string> = {
        'T1005': 'Data from Local System: collecting files or data from a compromised computer before staging, exfiltration, or further use.',
        'T1078': 'Valid Accounts: using legitimate user, service, or cloud accounts to access systems and avoid obvious intrusion paths.',
        'T1078.004': 'Valid Accounts: Cloud Accounts: using legitimate cloud account credentials to access cloud-hosted services and resources.',
        'T1102': 'Web Service: using an external web service as part of command-and-control or operational infrastructure.',
        'T1105': 'Ingress Tool Transfer: moving tools, malware, scripts, or payloads into a compromised environment.',
        'T1110': 'Brute Force: trying passwords, password hashes, or credential material to gain access to accounts.',
        'T1110.003': 'Password Spraying: trying a small number of common passwords across many accounts to avoid lockouts.',
        'T1114': 'Email Collection: collecting email messages or mail data from local systems, remote services, or cloud mailboxes.',
        'T1486': 'Data Encrypted for Impact: encrypting data on target systems to disrupt operations or support extortion.',
        'T1566': 'Phishing: sending deceptive messages to trick users into opening links, attachments, or giving up access.',
        'T1566.001': 'Spearphishing Attachment: sending targeted emails with malicious attachments to gain execution or access.',
        'T1567': 'Exfiltration Over Web Service: sending stolen data to a web service controlled by, or usable by, the actor.',
    }
    return displayRequirementText(descriptions[attackId] ?? `${name}: ${detail || `Reported under the ${tactic} tactic.`}`)
}
export function countryCodeForMapFeature(name: string | undefined) {
    if (!name) return null
    const normalized = name.trim().toLowerCase()
    const mapped = mapFeatureNameToCode[normalized]
    if (mapped) return mapped
    const country = countryFromValue(normalized)
    return country?.code ?? null
}
export const mapFeatureNameToCode: Record<string, string> = {
    england: 'GB',
    russia: 'RU',
    usa: 'US',
}
export function geographyContextPayloadFor(point: ReturnType<typeof actorGeoProfile>['points'][number], handoff?: TiActionabilityModel['geographyHandoffs'][number]) {
    return {
        schemaVersion: 'ti.public_actor.geography_context.v1',
        country: {
            code: point.code,
            name: point.label,
            role: point.role,
            observationCount: point.count,
            basis: 'country_source_coverage',
        },
        action: handoff?.watchlistTerm ? 'review_watchlist_term' : 'queue_source_enrichment',
        watchlistTerm: handoff?.watchlistTerm ?? null,
        enrichmentTask: handoff?.enrichmentTask ?? `Attach source evidence before reviewing ${point.label} in monitoring.`,
        provenanceSummary: handoff?.provenanceSummary ?? point.detail,
        evidence: handoff?.evidenceRows.map(row => ({
            victim: row.victim,
            source: row.source,
            sourceIds: row.sourceIds,
            provenanceRefs: row.provenanceRefs,
            reportDate: row.reportDate,
            confidence: row.confidence,
        })) ?? [],
        route: handoff?.watchlistTerm ? '/watchlists' : '/ti/profiles',
        blockedBy: handoff ? [] : [{
            ownerLane: 'source',
            reason: 'Country row needs source evidence before it can be routed.',
        }],
    }
}
export function updateMetaDescription(content: string) {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
    }
    meta.content = content
}
export function updateCanonical(path: string) {
    const href = `${window.location.origin}${path}`
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.appendChild(canonical)
    }
    canonical.href = href
}
