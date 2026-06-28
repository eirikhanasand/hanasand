import type { TiActionabilityModel, TiHandoffExportPayload } from './actionability'
import { countryFromValue, type VictimObservation } from './actorProfile'
import type { TiActorIntelligenceProfile } from './actorIntelligence'
import type { TiSearchResponse } from './search'

export type ActorArtifactKind = 'country' | 'tool' | 'campaign' | 'infrastructure' | 'technique'

export type ActorArtifactReadiness = {
    state: 'ready_for_org_handoff' | 'context_only' | 'needs_source' | 'stale' | 'needs_watchlist_term'
    label: string
    blockers: string[]
}

export type ActorArtifact = {
    id: string
    kind: ActorArtifactKind
    label: string
    subtitle: string
    confidence: number
    freshness: string
    evidence: string[]
    provenance: string[]
    watchlistTerms: Array<{ kind: 'company' | 'domain' | 'vendor'; value: string; notes: string }>
    enrichmentTasks: string[]
    readiness: ActorArtifactReadiness
}

export type AuthenticatedArtifactBridge = {
    schemaVersion: 'ti.public_actor.authenticated_bridge.v1'
    artifactId: string
    query: string
    orgRequired: boolean
    sourceRequired: boolean
    stale: boolean
    missing: string[]
    links: Record<'watchlist' | 'alertRebuild' | 'case' | 'enrichment', { label: string; href: string; intent: string }>
    payload: {
        artifact: Pick<ActorArtifact, 'id' | 'kind' | 'label' | 'confidence' | 'freshness' | 'evidence' | 'provenance' | 'watchlistTerms' | 'enrichmentTasks' | 'readiness'>
        watchlist: TiHandoffExportPayload
        alertRebuild: TiHandoffExportPayload
        case: TiHandoffExportPayload
        enrichment: TiHandoffExportPayload
    }
}

export type ActorArtifactHandoffs = {
    watchlist: TiHandoffExportPayload
    alertRebuild: TiHandoffExportPayload
    case: TiHandoffExportPayload
    enrichment: TiHandoffExportPayload
    authBridge: AuthenticatedArtifactBridge
}

export function buildActorArtifacts(
    result: TiSearchResponse,
    actor: TiActorIntelligenceProfile,
    victimObservations: VictimObservation[],
    actionability: TiActionabilityModel
): ActorArtifact[] {
    const provenance = artifactProvenance(actor, actionability)
    const countryArtifacts = actionability.geographyHandoffs.map(item => {
        const victims = victimObservations.filter(observation => countryFromValue(observation.country)?.code === item.code)
        return withReadiness({
            result,
            artifact: {
                id: artifactId('country', item.code),
                kind: 'country' as const,
                label: item.country,
                subtitle: item.role === 'operator' ? 'Attribution context' : `${item.observationCount} victim or targeting observation${item.observationCount === 1 ? '' : 's'}`,
                confidence: actor.confidence,
                freshness: result.lastSeen || result.generatedAt,
                evidence: unique([
                    item.provenanceSummary,
                    ...victims.map(victim => `${victim.victim}: ${victim.sector}; ${victim.timeframe}; ${victim.incident}`),
                ]),
                provenance: unique([item.provenanceSummary, ...victims.map(victim => victim.source), ...provenance]).slice(0, 6),
                watchlistTerms: item.watchlistTerm ? [{
                    kind: item.watchlistTerm.kind,
                    value: item.watchlistTerm.value,
                    notes: `${result.query}: ${item.watchlistTerm.reason}`,
                }] : [],
                enrichmentTasks: [item.enrichmentTask],
            },
        })
    })

    const toolArtifacts = actor.malwareTools.map(tool => artifactFromActorList({
        result,
        actor,
        actionability,
        kind: 'tool',
        label: tool,
        subtitle: 'Malware, tooling, or capability tied to this actor profile',
        evidence: [
            `${tool} is carried in the actor intelligence profile.`,
            ...matchingActivity(result, tool),
            ...matchingTechnique(result, tool),
        ],
        watchlistKind: 'vendor',
        enrichmentTask: `Attach source-level evidence for ${tool}, including first/last seen, tool family, and related campaign before using it in alert enrichment.`,
    }))

    const campaignArtifacts = actor.campaigns.map(campaign => artifactFromActorList({
        result,
        actor,
        actionability,
        kind: 'campaign',
        label: campaign,
        subtitle: 'Campaign or operation context tied to returned actor intelligence',
        evidence: [
            `${campaign} is carried in the actor intelligence profile.`,
            ...matchingActivity(result, campaign),
        ],
        watchlistKind: 'vendor',
        enrichmentTask: `Attach campaign source provenance for ${campaign}, including named victims, timeframe, and capture or advisory reference.`,
    }))

    const infrastructureArtifacts = actor.infrastructure.map(item => artifactFromActorList({
        result,
        actor,
        actionability,
        kind: 'infrastructure',
        label: item,
        subtitle: 'Infrastructure pattern for source collection and alert enrichment',
        evidence: [
            `${item} is carried in the actor intelligence profile.`,
            ...matchingActivity(result, item),
        ],
        watchlistKind: 'domain',
        enrichmentTask: `Collect concrete observable or source provenance for ${item} before promoting it into customer alert matching.`,
    }))

    const techniqueArtifacts = result.ttps.map(ttp => withReadiness({
        result,
        artifact: {
            id: artifactId('technique', ttp.attackId || ttp.name),
            kind: 'technique' as const,
            label: ttp.attackId ? `${ttp.attackId} ${ttp.name}` : ttp.name,
            subtitle: ttp.tactic,
            confidence: ttp.confidence,
            freshness: result.lastSeen || result.generatedAt,
            evidence: unique([ttp.tactic, ttp.detail, ...matchingActivity(result, ttp.name)]),
            provenance: unique([ttp.attackId ? 'MITRE ATT&CK mapped profile field' : 'Profile tradecraft field', ...provenance]).slice(0, 6),
            watchlistTerms: [],
            enrichmentTasks: [`Map ${ttp.attackId || ttp.name} to detection or hunting logic before routing it as customer-facing alert context.`],
        },
    }))

    return uniqueBy([
        ...countryArtifacts,
        ...toolArtifacts,
        ...campaignArtifacts,
        ...infrastructureArtifacts,
        ...techniqueArtifacts,
    ], item => item.id).slice(0, 40)
}

export function buildActorArtifactHandoffs(result: TiSearchResponse, artifact: ActorArtifact, actionability: TiActionabilityModel): ActorArtifactHandoffs {
    const artifactContext = {
        artifactId: artifact.id,
        kind: artifact.kind,
        label: artifact.label,
        confidence: artifact.confidence,
        freshness: artifact.freshness,
        evidence: artifact.evidence,
        provenance: artifact.provenance,
        readiness: artifact.readiness,
    }
    const watchTerms = artifact.watchlistTerms.length ? artifact.watchlistTerms : actionability.watchlist.payloads.filter(payload => payload.value.toLowerCase() === artifact.label.toLowerCase())
    const readinessMissing = artifact.readiness.blockers
    const enrichmentTasks = unique([...artifact.enrichmentTasks, ...actionability.enrichmentGaps.map(gap => `${gap.title}: ${gap.detail} Dependency: ${gap.dependency}.`)])
    const watchlistMissing = unique([
        ...actionability.exportPayloads.watchlist.missing,
        ...readinessMissing,
        ...(watchTerms.length ? [] : ['Artifact has no customer watchlist term']),
    ])
    const alertMissing = unique([
        ...actionability.exportPayloads.alertRebuild.missing,
        ...readinessMissing,
        ...(watchTerms.length ? [] : ['Artifact has no watchlist term for alert rebuild']),
    ])
    const caseMissing = unique([
        ...actionability.exportPayloads.case.missing,
        ...readinessMissing,
    ])
    const watchlist = {
        ...actionability.exportPayloads.watchlist,
        body: {
            ...actionability.exportPayloads.watchlist.body,
            terms: watchTerms,
            selectedArtifact: artifactContext,
        },
        missing: watchlistMissing,
        blocked: actionability.exportPayloads.watchlist.blocked || watchlistMissing.length > 0,
    }
    const alertRebuild = {
        ...actionability.exportPayloads.alertRebuild,
        body: {
            ...actionability.exportPayloads.alertRebuild.body,
            selectedArtifact: artifactContext,
            watchTerms,
        },
        missing: alertMissing,
        blocked: actionability.exportPayloads.alertRebuild.blocked || alertMissing.length > 0,
    }
    const casePayload = {
        ...actionability.exportPayloads.case,
        body: {
            ...actionability.exportPayloads.case.body,
            selectedArtifact: artifactContext,
        },
        missing: caseMissing,
        blocked: actionability.exportPayloads.case.blocked || caseMissing.length > 0,
    }
    const enrichment = {
        ...actionability.exportPayloads.enrichment,
        body: {
            ...actionability.exportPayloads.enrichment.body,
            selectedArtifact: artifactContext,
            tasks: enrichmentTasks.map((task, index) => ({
                id: `${artifact.id}:task:${index}`,
                title: task.split(':')[0],
                severity: artifact.kind === 'country' && !watchTerms.length ? 'medium' : 'high',
                detail: task,
                dependency: artifact.provenance.length ? 'sourceProvenance capture id or source URL' : 'sourceProvenance[]',
            })),
        },
        missing: enrichmentTasks.length ? [] : ['No enrichment task is attached to the selected artifact'],
        blocked: enrichmentTasks.length === 0,
    }
    const authBridge = buildAuthenticatedBridge(result, artifact, {
        watchlist,
        alertRebuild,
        case: casePayload,
        enrichment,
    })

    return {
        watchlist,
        alertRebuild,
        case: casePayload,
        enrichment,
        authBridge,
    }
}

export function nextActorArtifactId(artifacts: ActorArtifact[], currentId: string | undefined, direction: 'next' | 'previous' | 'first' | 'last') {
    if (!artifacts.length) return ''
    if (direction === 'first') return artifacts[0]?.id ?? ''
    if (direction === 'last') return artifacts[artifacts.length - 1]?.id ?? ''
    const currentIndex = Math.max(0, artifacts.findIndex(item => item.id === currentId))
    const delta = direction === 'next' ? 1 : -1
    const nextIndex = (currentIndex + delta + artifacts.length) % artifacts.length
    return artifacts[nextIndex]?.id ?? ''
}

export function encodeHandoffPayload(payload: unknown) {
    return encodeURIComponent(JSON.stringify(payload))
}

function buildAuthenticatedBridge(
    result: TiSearchResponse,
    artifact: ActorArtifact,
    payloads: Pick<ActorArtifactHandoffs, 'watchlist' | 'alertRebuild' | 'case' | 'enrichment'>
): AuthenticatedArtifactBridge {
    const compactArtifact = {
        id: artifact.id,
        kind: artifact.kind,
        label: artifact.label,
        confidence: artifact.confidence,
        freshness: artifact.freshness,
        evidence: artifact.evidence,
        provenance: artifact.provenance,
        watchlistTerms: artifact.watchlistTerms,
        enrichmentTasks: artifact.enrichmentTasks,
        readiness: artifact.readiness,
    }
    const missing = unique([
        ...artifact.readiness.blockers,
        ...payloads.watchlist.missing,
        ...payloads.case.missing,
    ])
    const bridgePayload = {
        artifact: compactArtifact,
        watchlist: payloads.watchlist,
        alertRebuild: payloads.alertRebuild,
        case: payloads.case,
        enrichment: payloads.enrichment,
    }
    return {
        schemaVersion: 'ti.public_actor.authenticated_bridge.v1',
        artifactId: artifact.id,
        query: result.query,
        orgRequired: missing.some(item => /organization|org|member|admin/i.test(item)),
        sourceRequired: missing.some(item => /source|provenance|capture|url/i.test(item)),
        stale: artifact.readiness.state === 'stale',
        missing,
        links: {
            watchlist: dashboardLink('/dashboard/dwm', 'watchlist', bridgePayload),
            alertRebuild: dashboardLink('/dashboard/dwm', 'alert_rebuild', bridgePayload),
            case: dashboardLink('/dashboard/ti/workbench', 'case', bridgePayload),
            enrichment: dashboardLink('/dashboard/ti/enrichment', 'enrichment', bridgePayload),
        },
        payload: bridgePayload,
    }
}

function dashboardLink(path: string, intent: string, payload: unknown) {
    return {
        label: intent.split('_').map(part => part[0]?.toUpperCase() + part.slice(1)).join(' '),
        href: `${path}?handoff=public-ti&intent=${encodeURIComponent(intent)}&payload=${encodeHandoffPayload(payload)}`,
        intent,
    }
}

function artifactFromActorList(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    kind: Exclude<ActorArtifactKind, 'country' | 'technique'>
    label: string
    subtitle: string
    evidence: string[]
    watchlistKind: 'company' | 'domain' | 'vendor'
    enrichmentTask: string
}): ActorArtifact {
    const provenance = artifactProvenance(input.actor, input.actionability)
    const matchedWatchTerms = input.actionability.watchlist.payloads.filter(payload => payload.value.toLowerCase() === input.label.toLowerCase())
    return withReadiness({
        result: input.result,
        artifact: {
            id: artifactId(input.kind, input.label),
            kind: input.kind,
            label: input.label,
            subtitle: input.subtitle,
            confidence: input.actor.confidence,
            freshness: input.result.lastSeen || input.result.generatedAt,
            evidence: unique(input.evidence.length ? input.evidence : [`${input.label} is present in the returned actor intelligence profile.`]),
            provenance,
            watchlistTerms: matchedWatchTerms.length ? matchedWatchTerms : [{
                kind: input.watchlistKind,
                value: input.label,
                notes: `${input.result.query}: ${input.subtitle}`,
            }],
            enrichmentTasks: [input.enrichmentTask],
        },
    })
}

function withReadiness(input: { result: TiSearchResponse; artifact: Omit<ActorArtifact, 'readiness'> }): ActorArtifact {
    const blockers = [
        ...(!input.artifact.provenance.length ? ['sourceProvenance[] for the selected artifact'] : []),
        ...(!input.artifact.evidence.length ? ['artifact evidence text'] : []),
        ...(isStale(input.artifact.freshness, input.result.generatedAt) ? [`fresh source after ${formatDate(input.artifact.freshness)}`] : []),
        ...(!input.artifact.watchlistTerms.length && input.artifact.kind !== 'technique' ? ['customer watchlist term'] : []),
    ]
    const state = !input.artifact.provenance.length || !input.artifact.evidence.length
        ? 'needs_source'
        : isStale(input.artifact.freshness, input.result.generatedAt)
            ? 'stale'
            : !input.artifact.watchlistTerms.length
                ? input.artifact.kind === 'technique' ? 'context_only' : 'needs_watchlist_term'
                : 'ready_for_org_handoff'
    return {
        ...input.artifact,
        readiness: {
            state,
            label: readinessLabel(state),
            blockers,
        },
    }
}

function readinessLabel(state: ActorArtifactReadiness['state']) {
    if (state === 'ready_for_org_handoff') return 'Ready for org handoff'
    if (state === 'needs_source') return 'Needs source'
    if (state === 'stale') return 'Stale evidence'
    if (state === 'needs_watchlist_term') return 'Needs watchlist term'
    return 'Context only'
}

function isStale(value: string, generatedAt: string) {
    const freshness = Date.parse(value)
    const generated = Date.parse(generatedAt)
    if (!Number.isFinite(freshness) || !Number.isFinite(generated)) return false
    return generated - freshness > 180 * 24 * 60 * 60 * 1000
}

function formatDate(value: string) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toISOString().slice(0, 10)
}

function artifactProvenance(actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel) {
    return unique([
        ...actionability.sourceProvenance.map(source => source.provenance),
        ...actor.sourceProvenance,
    ]).slice(0, 8)
}

function matchingActivity(result: TiSearchResponse, value: string) {
    const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 3)
    if (!tokens.length) return []
    return result.recentActivity
        .filter(item => tokens.some(token => `${item.title} ${item.detail} ${item.impact ?? ''}`.toLowerCase().includes(token)))
        .map(item => `${item.firstReportedAt || item.date}: ${item.title}; ${item.detail}`)
        .slice(0, 4)
}

function matchingTechnique(result: TiSearchResponse, value: string) {
    const lower = value.toLowerCase()
    return result.ttps
        .filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(lower))
        .map(item => `${item.attackId || item.name}: ${item.tactic}; ${item.detail}`)
        .slice(0, 3)
}

function artifactId(kind: ActorArtifactKind, value: string) {
    return `${kind}:${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown'}`
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
        const key = keyFor(value)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}
