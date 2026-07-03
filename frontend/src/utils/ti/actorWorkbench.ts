import type { TiActionabilityModel, TiHandoffExportPayload } from './actionability'
import { countryFromValue, type VictimObservation } from './actorProfile'
import type { TiActorIntelligenceProfile } from './actorIntelligence'
import type { TiSearchResponse } from './search'

export const PUBLIC_TI_HANDOFF_SCHEMA_VERSION = 'ti.public_actor.authenticated_bridge.v1' as const
export const PUBLIC_TI_HANDOFF_SOURCE = 'public-ti' as const
export const PUBLIC_TI_HANDOFF_QUERY_PARAM = 'payload' as const
export const PUBLIC_TI_HANDOFF_INTENT_PARAM = 'intent' as const

export const PUBLIC_TI_HANDOFF_ACTIONS = {
    watchlist: 'create_watchlist',
    alertRebuild: 'rebuild_alerts',
    case: 'open_case',
    enrichment: 'queue_enrichment',
} as const

export const PUBLIC_TI_HANDOFF_ROUTES = {
    watchlist: '/dashboard/dwm',
    alertRebuild: '/dashboard/dwm',
    case: '/dashboard/ti/workbench',
    enrichment: '/dashboard/ti/enrichment',
} as const

export const PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS = [
    'schemaVersion',
    'source',
    'action',
    'query',
    'artifactId',
    'artifact',
    'selectedPayload',
    'actionPayloads',
    'orgRequired',
    'sourceRequired',
    'stale',
    'missing',
    'blockers',
    'sourceRequests',
    'actionReadiness',
    'actionReadiness[].action',
    'actionReadiness[].route',
    'actionReadiness[].endpoint',
    'actionReadiness[].backedRoute',
    'actionReadiness[].ready',
    'actionReadiness[].blockerCodes',
    'actionReadiness[].ownerLane',
    'actionReadiness[].sourceRequestCount',
    'evidenceRefs',
    'evidenceRefs.captureIds',
    'evidenceRefs.alertIds',
    'evidenceRefs.casePaths',
    'evidenceRefs.watchlistTerms',
    'sourceRequests[].ownerLane',
    'sourceRequests[].route',
    'sourceRequests[].sourceFamily',
    'sourceRequests[].requestedFields',
] as const

export type ActorArtifactKind = 'country' | 'tool' | 'campaign' | 'infrastructure' | 'technique'
export type PublicTiHandoffAction = typeof PUBLIC_TI_HANDOFF_ACTIONS[keyof typeof PUBLIC_TI_HANDOFF_ACTIONS]
type PublicTiHandoffActionBlockerCode = 'org_required' | 'source_required' | 'stale_evidence' | 'missing_watchlist_term' | 'action_blocked'
export type PublicTiHandoffDecodeFailureCode =
    | 'missing_payload'
    | 'malformed_json'
    | 'unsupported_schema'
    | 'missing_action'
    | 'invalid_action'
    | 'missing_query'
    | 'missing_artifact'
    | 'invalid_payload'

export type PublicTiHandoffDecodeResult =
    | { ok: true; payload: PublicTiHandoffPayload; action: PublicTiHandoffAction; reasonCodes: [] }
    | { ok: false; code: PublicTiHandoffDecodeFailureCode; message: string; reasonCodes: PublicTiHandoffDecodeFailureCode[] }

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

export type PublicTiHandoffArtifact = Pick<ActorArtifact, 'id' | 'kind' | 'label' | 'confidence' | 'freshness' | 'evidence' | 'provenance' | 'watchlistTerms' | 'enrichmentTasks' | 'readiness'>

export type PublicTiHandoffPayload = {
    schemaVersion: typeof PUBLIC_TI_HANDOFF_SCHEMA_VERSION
    source: typeof PUBLIC_TI_HANDOFF_SOURCE
    action: PublicTiHandoffAction
    artifactId: string
    query: string
    generatedAt: string
    artifact: PublicTiHandoffArtifact
    selectedPayload: TiHandoffExportPayload
    actionPayloads: {
        watchlist: TiHandoffExportPayload
        alertRebuild: TiHandoffExportPayload
        case: TiHandoffExportPayload
        enrichment: TiHandoffExportPayload
    }
    orgRequired: boolean
    sourceRequired: boolean
    stale: boolean
    missing: string[]
    blockers: Array<{ code: 'org_required' | 'source_required' | 'stale_evidence' | 'missing_watchlist_term'; detail: string }>
    actionReadiness: Array<{
        action: PublicTiHandoffAction
        route: TiHandoffExportPayload['route']
        endpoint?: string
        backedRoute?: string
        ready: boolean
        missing: string[]
        blockerCodes: PublicTiHandoffActionBlockerCode[]
        ownerLane: 'org' | 'alert' | 'case' | 'source'
        selected: boolean
        sourceRequestCount: number
    }>
    evidenceRefs?: {
        sourceNames: string[]
        provenanceRefs: string[]
        captureIds: string[]
        alertIds: string[]
        casePaths: string[]
        watchlistTerms: string[]
        endpoints: string[]
    }
    sourceRequests: Array<{
        sourceName: string
        provenance: string
        captureId?: string
        confidence?: number
        missing: string[]
        ownerLane?: 'source'
        route?: '/dashboard/ti/enrichment'
        sourceFamily?: 'source_capture'
        requestedFields?: string[]
    }>
}

export type AuthenticatedArtifactBridge = {
    schemaVersion: typeof PUBLIC_TI_HANDOFF_SCHEMA_VERSION
    artifactId: string
    query: string
    orgRequired: boolean
    sourceRequired: boolean
    stale: boolean
    missing: string[]
    links: Record<'watchlist' | 'alertRebuild' | 'case' | 'enrichment', { label: string; href: string; intent: PublicTiHandoffAction }>
    payload: PublicTiHandoffPayload
    payloads: Record<PublicTiHandoffAction, PublicTiHandoffPayload>
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
                    ...item.evidenceRows.map(row => `${row.victim}: ${row.reportDate}; ${Math.round(row.confidence * 100)}% confidence; ${row.source}`),
                ]),
                provenance: unique([
                    item.provenanceSummary,
                    ...item.evidenceRows.flatMap(row => [
                        row.source,
                        ...row.sourceIds.map(sourceId => `source ${sourceId}`),
                        ...row.provenanceRefs,
                    ]),
                    ...victims.map(victim => victim.source),
                    ...provenance,
                ]).slice(0, 8),
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
        enrichmentTask: `Attach campaign source details for ${campaign}, including named victims, timeframe, and capture or advisory reference.`,
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
        enrichmentTask: `Collect concrete observable or source details for ${item} before promoting it into customer alert matching.`,
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

export function decodePublicTiHandoffFromUrl(value: string | URL | URLSearchParams): PublicTiHandoffDecodeResult {
    if (value instanceof URL) {
        return decodePublicTiHandoffPayload(value.searchParams.get(PUBLIC_TI_HANDOFF_QUERY_PARAM), value.searchParams.get(PUBLIC_TI_HANDOFF_INTENT_PARAM))
    }
    if (value instanceof URLSearchParams) {
        return decodePublicTiHandoffPayload(value.get(PUBLIC_TI_HANDOFF_QUERY_PARAM), value.get(PUBLIC_TI_HANDOFF_INTENT_PARAM))
    }
    try {
        const url = new URL(value, 'https://hanasand.com')
        return decodePublicTiHandoffFromUrl(url)
    } catch {
        return decodePublicTiHandoffPayload(value, undefined)
    }
}

export function decodePublicTiHandoffPayload(encoded: string | null | undefined, intent?: string | null): PublicTiHandoffDecodeResult {
    if (!encoded) return failure('missing_payload', 'No public TI handoff payload was provided.')
    const decoded = decodeMaybeURIComponent(encoded)
    if (decoded === null) return failure('malformed_json', 'The public TI handoff payload is not valid URL-encoded JSON.')
    try {
        return validatePublicTiHandoffPayload(JSON.parse(decoded), intent)
    } catch {
        return failure('malformed_json', 'The public TI handoff payload is not valid JSON.')
    }
}

export function validatePublicTiHandoffPayload(value: unknown, intent?: string | null): PublicTiHandoffDecodeResult {
    const normalized = normalizePublicTiHandoffPayload(value, intent)
    if (!normalized.ok) return normalized
    return { ok: true, payload: normalized.payload, action: normalized.payload.action, reasonCodes: [] }
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
    const orgRequired = missing.some(item => /organization|org|member|admin/i.test(item))
    const sourceRequired = missing.some(item => /source|provenance|capture|url/i.test(item))
    const stale = artifact.readiness.state === 'stale'
    const actionPayloads: Record<PublicTiHandoffAction, PublicTiHandoffPayload> = {
        [PUBLIC_TI_HANDOFF_ACTIONS.watchlist]: buildPublicTiHandoffPayload(result, compactArtifact, payloads, PUBLIC_TI_HANDOFF_ACTIONS.watchlist, { orgRequired, sourceRequired, stale, missing }),
        [PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild]: buildPublicTiHandoffPayload(result, compactArtifact, payloads, PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild, { orgRequired, sourceRequired, stale, missing }),
        [PUBLIC_TI_HANDOFF_ACTIONS.case]: buildPublicTiHandoffPayload(result, compactArtifact, payloads, PUBLIC_TI_HANDOFF_ACTIONS.case, { orgRequired, sourceRequired, stale, missing }),
        [PUBLIC_TI_HANDOFF_ACTIONS.enrichment]: buildPublicTiHandoffPayload(result, compactArtifact, payloads, PUBLIC_TI_HANDOFF_ACTIONS.enrichment, { orgRequired, sourceRequired, stale, missing }),
    }
    return {
        schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
        artifactId: artifact.id,
        query: result.query,
        orgRequired,
        sourceRequired,
        stale,
        missing,
        links: {
            watchlist: dashboardLink(PUBLIC_TI_HANDOFF_ROUTES.watchlist, PUBLIC_TI_HANDOFF_ACTIONS.watchlist, actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist]),
            alertRebuild: dashboardLink(PUBLIC_TI_HANDOFF_ROUTES.alertRebuild, PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild, actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild]),
            case: dashboardLink(PUBLIC_TI_HANDOFF_ROUTES.case, PUBLIC_TI_HANDOFF_ACTIONS.case, actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.case]),
            enrichment: dashboardLink(PUBLIC_TI_HANDOFF_ROUTES.enrichment, PUBLIC_TI_HANDOFF_ACTIONS.enrichment, actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment]),
        },
        payload: actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist],
        payloads: actionPayloads,
    }
}

function dashboardLink(path: string, intent: PublicTiHandoffAction, payload: PublicTiHandoffPayload) {
    return {
        label: labelForHandoffAction(intent),
        href: `${path}?handoff=public-ti&intent=${encodeURIComponent(intent)}&payload=${encodeHandoffPayload(payload)}`,
        intent,
    }
}

function buildPublicTiHandoffPayload(
    result: TiSearchResponse,
    artifact: PublicTiHandoffArtifact,
    payloads: Pick<ActorArtifactHandoffs, 'watchlist' | 'alertRebuild' | 'case' | 'enrichment'>,
    action: PublicTiHandoffAction,
    bridgeState: Pick<AuthenticatedArtifactBridge, 'orgRequired' | 'sourceRequired' | 'stale' | 'missing'>
): PublicTiHandoffPayload {
    const actionPayloads = {
        watchlist: payloads.watchlist,
        alertRebuild: payloads.alertRebuild,
        case: payloads.case,
        enrichment: payloads.enrichment,
    }
    const sourceRequests = sourceRequestsFor(actionPayloads)
    return {
        schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
        source: PUBLIC_TI_HANDOFF_SOURCE,
        action,
        artifactId: artifact.id,
        query: result.query,
        generatedAt: result.generatedAt,
        artifact,
        selectedPayload: selectedPayloadForAction(action, actionPayloads),
        actionPayloads,
        orgRequired: bridgeState.orgRequired,
        sourceRequired: bridgeState.sourceRequired,
        stale: bridgeState.stale,
        missing: bridgeState.missing,
        blockers: blockersForBridge(artifact, bridgeState),
        actionReadiness: actionReadinessFor(action, actionPayloads, artifact, bridgeState, sourceRequests),
        evidenceRefs: evidenceRefsFor(artifact, actionPayloads, sourceRequests),
        sourceRequests,
    }
}

function normalizePublicTiHandoffPayload(value: unknown, intent?: string | null): PublicTiHandoffDecodeResult {
    if (!isRecord(value)) return failure('invalid_payload', 'The public TI handoff payload must be a JSON object.')
    if (!value.schemaVersion) return normalizeLegacyPublicTiHandoffPayload(value, intent)
    if (value.schemaVersion !== PUBLIC_TI_HANDOFF_SCHEMA_VERSION) return failure('unsupported_schema', `Unsupported public TI handoff schema: ${String(value.schemaVersion)}.`)
    const action = normalizeHandoffAction(typeof value.action === 'string' ? value.action : intent)
    if (!action) return failure(value.action || intent ? 'invalid_action' : 'missing_action', 'The public TI handoff action is missing or unsupported.')
    const query = typeof value.query === 'string' ? value.query.trim() : ''
    if (!query) return failure('missing_query', 'The public TI handoff payload is missing query.')
    if (!isRecord(value.artifact)) return failure('missing_artifact', 'The public TI handoff payload is missing selected artifact context.')
    if (!isRecord(value.selectedPayload) || !isRecord(value.actionPayloads)) return failure('invalid_payload', 'The public TI handoff payload is missing selectedPayload or actionPayloads.')
    const artifactId = typeof value.artifactId === 'string' && value.artifactId.trim()
        ? value.artifactId
        : typeof value.artifact.id === 'string' ? value.artifact.id : ''
    if (!artifactId) return failure('missing_artifact', 'The public TI handoff payload is missing artifactId.')
    const normalized: PublicTiHandoffPayload = {
        schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
        source: PUBLIC_TI_HANDOFF_SOURCE,
        action,
        artifactId,
        query,
        generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : '',
        artifact: value.artifact as PublicTiHandoffArtifact,
        selectedPayload: value.selectedPayload as TiHandoffExportPayload,
        actionPayloads: value.actionPayloads as PublicTiHandoffPayload['actionPayloads'],
        orgRequired: Boolean(value.orgRequired),
        sourceRequired: Boolean(value.sourceRequired),
        stale: Boolean(value.stale),
        missing: Array.isArray(value.missing) ? value.missing.filter((item): item is string => typeof item === 'string') : [],
        blockers: Array.isArray(value.blockers) ? value.blockers as PublicTiHandoffPayload['blockers'] : [],
        actionReadiness: Array.isArray(value.actionReadiness) ? value.actionReadiness as PublicTiHandoffPayload['actionReadiness'] : [],
        evidenceRefs: isRecord(value.evidenceRefs) ? value.evidenceRefs as PublicTiHandoffPayload['evidenceRefs'] : undefined,
        sourceRequests: Array.isArray(value.sourceRequests) ? value.sourceRequests as PublicTiHandoffPayload['sourceRequests'] : [],
    }
    if (!normalized.actionReadiness.length) {
        normalized.actionReadiness = actionReadinessFor(action, normalized.actionPayloads, normalized.artifact, normalized, normalized.sourceRequests)
    }
    if (!normalized.evidenceRefs) {
        normalized.evidenceRefs = evidenceRefsFor(normalized.artifact, normalized.actionPayloads, normalized.sourceRequests)
    }
    return { ok: true, payload: normalized, action, reasonCodes: [] }
}

function normalizeLegacyPublicTiHandoffPayload(value: Record<string, unknown>, intent?: string | null): PublicTiHandoffDecodeResult {
    const action = normalizeHandoffAction(intent)
    if (!action) return failure(intent ? 'invalid_action' : 'missing_action', 'Legacy public TI handoff payloads require a supported intent.')
    if (!isRecord(value.artifact)) return failure('missing_artifact', 'Legacy public TI handoff payload is missing artifact.')
    const actionPayloads = {
        watchlist: value.watchlist,
        alertRebuild: value.alertRebuild,
        case: value.case,
        enrichment: value.enrichment,
    }
    if (!isRecord(actionPayloads.watchlist) || !isRecord(actionPayloads.alertRebuild) || !isRecord(actionPayloads.case) || !isRecord(actionPayloads.enrichment)) {
        return failure('invalid_payload', 'Legacy public TI handoff payload is missing one or more action payloads.')
    }
    const selectedPayload = selectedPayloadForAction(action, actionPayloads as PublicTiHandoffPayload['actionPayloads'])
    const artifact = value.artifact as PublicTiHandoffArtifact
    const missing = unique([
        ...readStringArray(actionPayloads.watchlist.missing),
        ...readStringArray(actionPayloads.alertRebuild.missing),
        ...readStringArray(actionPayloads.case.missing),
        ...readStringArray(actionPayloads.enrichment.missing),
        ...readStringArray(isRecord(artifact.readiness) ? artifact.readiness.blockers : undefined),
    ])
    const query = readPayloadQuery(actionPayloads as PublicTiHandoffPayload['actionPayloads'])
    if (!query) return failure('missing_query', 'Legacy public TI handoff payload is missing query.')
    const bridgeState = {
        orgRequired: missing.some(item => /organization|org|member|admin/i.test(item)),
        sourceRequired: missing.some(item => /source|provenance|capture|url/i.test(item)),
        stale: isRecord(artifact.readiness) && artifact.readiness.state === 'stale',
        missing,
    }
    const sourceRequests = sourceRequestsFor(actionPayloads as PublicTiHandoffPayload['actionPayloads'])
    const payload: PublicTiHandoffPayload = {
        schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
        source: PUBLIC_TI_HANDOFF_SOURCE,
        action,
        artifactId: artifact.id,
        query,
        generatedAt: typeof selectedPayload.generatedAt === 'string' ? selectedPayload.generatedAt : '',
        artifact,
        selectedPayload,
        actionPayloads: actionPayloads as PublicTiHandoffPayload['actionPayloads'],
        ...bridgeState,
        blockers: blockersForBridge(artifact, bridgeState),
        actionReadiness: actionReadinessFor(action, actionPayloads as PublicTiHandoffPayload['actionPayloads'], artifact, bridgeState, sourceRequests),
        evidenceRefs: evidenceRefsFor(artifact, actionPayloads as PublicTiHandoffPayload['actionPayloads'], sourceRequests),
        sourceRequests,
    }
    return { ok: true, payload, action, reasonCodes: [] }
}

function selectedPayloadForAction(action: PublicTiHandoffAction, payloads: PublicTiHandoffPayload['actionPayloads']) {
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild) return payloads.alertRebuild
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.case) return payloads.case
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.enrichment) return payloads.enrichment
    return payloads.watchlist
}

function blockersForBridge(artifact: PublicTiHandoffArtifact, bridgeState: Pick<AuthenticatedArtifactBridge, 'orgRequired' | 'sourceRequired' | 'stale' | 'missing'>): PublicTiHandoffPayload['blockers'] {
    return [
        ...(bridgeState.orgRequired ? [{ code: 'org_required' as const, detail: 'Open this payload in an authenticated organization context before creating watchlists, rebuilding alerts, or creating cases.' }] : []),
        ...(bridgeState.sourceRequired ? [{ code: 'source_required' as const, detail: 'Attach source details, capture ID, source URL, or request ID before using this artifact as alert or case evidence.' }] : []),
        ...(bridgeState.stale ? [{ code: 'stale_evidence' as const, detail: `Fresh source is required after ${formatDate(artifact.freshness)} before sending this to review.` }] : []),
        ...(!artifact.watchlistTerms.length && artifact.kind !== 'technique' ? [{ code: 'missing_watchlist_term' as const, detail: 'Add or select an organization watchlist term before alert rebuild.' }] : []),
    ]
}

function actionReadinessFor(
    selectedAction: PublicTiHandoffAction,
    payloads: PublicTiHandoffPayload['actionPayloads'],
    artifact: PublicTiHandoffArtifact,
    bridgeState: Pick<AuthenticatedArtifactBridge, 'orgRequired' | 'sourceRequired' | 'stale' | 'missing'>,
    sourceRequests: PublicTiHandoffPayload['sourceRequests']
): PublicTiHandoffPayload['actionReadiness'] {
    const entries = [
        { action: PUBLIC_TI_HANDOFF_ACTIONS.watchlist, payload: payloads.watchlist, ownerLane: 'org' as const },
        { action: PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild, payload: payloads.alertRebuild, ownerLane: 'alert' as const },
        { action: PUBLIC_TI_HANDOFF_ACTIONS.case, payload: payloads.case, ownerLane: 'case' as const },
        { action: PUBLIC_TI_HANDOFF_ACTIONS.enrichment, payload: payloads.enrichment, ownerLane: 'source' as const },
    ]
    return entries.map(entry => {
        const missing = unique([
            ...entry.payload.missing,
            ...(entry.action === PUBLIC_TI_HANDOFF_ACTIONS.enrichment ? [] : artifact.readiness.blockers),
        ])
        const blockerCodes = uniqueBlockerCodes([
            ...(bridgeState.orgRequired && (entry.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist || entry.action === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild || entry.action === PUBLIC_TI_HANDOFF_ACTIONS.case) ? ['org_required' as const] : []),
            ...(bridgeState.sourceRequired ? ['source_required' as const] : []),
            ...(bridgeState.stale ? ['stale_evidence' as const] : []),
            ...(!artifact.watchlistTerms.length && (entry.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist || entry.action === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild) ? ['missing_watchlist_term' as const] : []),
            ...(entry.payload.blocked ? ['action_blocked' as const] : []),
        ])
        return {
            action: entry.action,
            route: entry.payload.route,
            endpoint: entry.payload.endpoint,
            backedRoute: entry.payload.backedRoute,
            ready: !entry.payload.blocked && missing.length === 0 && !blockerCodes.length,
            missing,
            blockerCodes,
            ownerLane: entry.ownerLane,
            selected: entry.action === selectedAction,
            sourceRequestCount: sourceRequests.length,
        }
    })
}

function uniqueBlockerCodes(values: PublicTiHandoffActionBlockerCode[]) {
    return Array.from(new Set(values))
}

function evidenceRefsFor(artifact: PublicTiHandoffArtifact, payloads: PublicTiHandoffPayload['actionPayloads'], sourceRequests: PublicTiHandoffPayload['sourceRequests']): NonNullable<PublicTiHandoffPayload['evidenceRefs']> {
    const payloadList = [payloads.watchlist, payloads.alertRebuild, payloads.case, payloads.enrichment]
    return {
        sourceNames: unique([
            ...artifact.provenance,
            ...payloadList.flatMap(payload => payload.provenance.map(source => source.sourceName)),
            ...sourceRequests.map(request => request.sourceName),
        ]).slice(0, 20),
        provenanceRefs: unique([
            ...artifact.provenance,
            ...payloadList.flatMap(payload => payload.provenance.map(source => source.provenance)),
            ...sourceRequests.map(request => request.provenance),
        ]).slice(0, 20),
        captureIds: unique([
            ...payloadList.flatMap(payload => payload.provenance.map(source => source.captureId).filter((value): value is string => Boolean(value))),
            ...sourceRequests.map(request => request.captureId).filter((value): value is string => Boolean(value)),
            ...payloadList.flatMap(payload => collectStringFields(payload.body, ['captureId', 'captureIds'])),
        ]).slice(0, 20),
        alertIds: unique(payloadList.flatMap(payload => collectStringFields(payload.body, ['alertId', 'alertIds']))).slice(0, 20),
        casePaths: unique(payloadList.flatMap(payload => collectStringFields(payload.body, ['casePath', 'casePaths']))).slice(0, 20),
        watchlistTerms: unique([
            ...artifact.watchlistTerms.map(term => `${term.kind}:${term.value}`),
            ...payloadList.flatMap(payload => collectWatchlistTerms(payload.body)),
        ]).slice(0, 20),
        endpoints: unique(payloadList.flatMap(payload => [payload.endpoint, payload.backedRoute].filter((value): value is string => Boolean(value)))).slice(0, 20),
    }
}

function collectStringFields(value: unknown, keys: string[]): string[] {
    if (Array.isArray(value)) return value.flatMap(item => collectStringFields(item, keys))
    if (!isRecord(value)) return []
    return Object.entries(value).flatMap(([key, entry]) => {
        const nested = collectStringFields(entry, keys)
        if (!keys.includes(key)) return nested
        if (typeof entry === 'string' && entry.trim()) return [entry.trim(), ...nested]
        if (Array.isArray(entry)) return [...entry.filter((item): item is string => typeof item === 'string' && item.trim().length > 0), ...nested]
        return nested
    })
}

function collectWatchlistTerms(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(collectWatchlistTerms)
    if (!isRecord(value)) return []
    const termValue = typeof value.value === 'string' ? value.value.trim() : ''
    const termKind = typeof value.kind === 'string' ? value.kind.trim() : ''
    return [
        ...(termValue && (termKind === 'company' || termKind === 'domain' || termKind === 'vendor') ? [`${termKind}:${termValue}`] : []),
        ...Object.values(value).flatMap(collectWatchlistTerms),
    ]
}

function sourceRequestsFor(payloads: PublicTiHandoffPayload['actionPayloads']): PublicTiHandoffPayload['sourceRequests'] {
    return uniqueBy(Object.values(payloads).flatMap(payload => payload.provenance).map(source => ({
        sourceName: source.sourceName,
        provenance: source.provenance,
        captureId: source.captureId,
        confidence: source.confidence,
        missing: source.captureId ? [] : ['captureId or source request ID'],
        ownerLane: 'source' as const,
        route: PUBLIC_TI_HANDOFF_ROUTES.enrichment,
        sourceFamily: 'source_capture' as const,
        requestedFields: source.captureId
            ? ['sourceProvenance[].sourceName', 'sourceProvenance[].provenance', 'sourceProvenance[].captureId']
            : ['sourceProvenance[].sourceName', 'sourceProvenance[].provenance', 'sourceProvenance[].captureId', 'sourceProvenance[].sourceRequestId'],
    })), source => `${source.sourceName}:${source.provenance}:${source.captureId ?? ''}`)
}

function labelForHandoffAction(action: PublicTiHandoffAction) {
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist) return 'Create Watchlist'
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild) return 'Rebuild Alerts'
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.case) return 'Open Case'
    return 'Add Context'
}

function normalizeHandoffAction(value: string | null | undefined): PublicTiHandoffAction | null {
    if (value === PUBLIC_TI_HANDOFF_ACTIONS.watchlist || value === 'watchlist') return PUBLIC_TI_HANDOFF_ACTIONS.watchlist
    if (value === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild || value === 'alert_rebuild') return PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild
    if (value === PUBLIC_TI_HANDOFF_ACTIONS.case || value === 'case') return PUBLIC_TI_HANDOFF_ACTIONS.case
    if (value === PUBLIC_TI_HANDOFF_ACTIONS.enrichment || value === 'enrichment') return PUBLIC_TI_HANDOFF_ACTIONS.enrichment
    return null
}

function decodeMaybeURIComponent(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value.trim().startsWith('{') ? value : null
    }
}

function failure(code: PublicTiHandoffDecodeFailureCode, message: string): PublicTiHandoffDecodeResult {
    return { ok: false, code, message, reasonCodes: [code] }
}

function readPayloadQuery(payloads: PublicTiHandoffPayload['actionPayloads']) {
    return [payloads.watchlist, payloads.alertRebuild, payloads.case, payloads.enrichment]
        .map(payload => payload.query)
        .find(query => typeof query === 'string' && query.trim()) ?? ''
}

function readStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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
