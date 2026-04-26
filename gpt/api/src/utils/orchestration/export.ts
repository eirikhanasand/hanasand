import type {
    ContextPack,
    ContextSegment,
    OrchestrationEdge,
    OrchestrationNode,
    OrchestrationRun,
    OrchestratorAgentRole,
    PackedContextSegment,
} from './types.ts'

export type ContextExportStatus = 'pass' | 'warn' | 'fail'

export type ContextExportScopeProfile = {
    id: string
    label: string
    description: string
    roles?: OrchestratorAgentRole[]
    nodeIds?: string[]
}

export type ContextExportGate = {
    id: string
    label: string
    status: ContextExportStatus
    summary: string
    actual: number | string
    threshold: string
}

export type ContextExportScopedEntry = {
    id: string
    label: string
    kind: ContextSegment['kind'] | 'unknown'
    temperature: ContextSegment['temperature'] | 'unknown'
    branchKey: string | null
    estimatedTokens: number
    reasons: string[]
    preview: string
}

export type ContextExportScope = {
    id: string
    label: string
    description: string
    roles: OrchestratorAgentRole[]
    nodeIds: string[]
    packCount: number
    budgetTokens: number
    usedTokens: number
    includedTokens: number
    omittedTokens: number
    includedCount: number
    omittedCount: number
    omissionRate: number
    included: ContextExportScopedEntry[]
    omitted: ContextExportScopedEntry[]
}

export type ContextExportArtifact = {
    version: 'context_export.v1'
    exportedAt: string
    run: {
        id: string
        task: string
        createdAt: string
        updatedAt: string
        effectiveCapacityTokens: number
    }
    profile: {
        id: string
        label: string
        mode: 'healthy' | 'degraded'
        notes: string[]
    }
    summary: {
        nodeCount: number
        edgeCount: number
        eventCount: number
        segmentCount: number
        packCount: number
        artifactCount: number
        scopeCount: number
        includedTokens: number
        omittedTokens: number
        inclusionRate: number
    }
    graph: {
        edgeTypes: Array<{ type: OrchestrationEdge['type']; count: number }>
        roots: string[]
        leaves: string[]
        orphanNodes: string[]
    }
    scopes: ContextExportScope[]
    qualityGates: ContextExportGate[]
    exclusionAccounting: {
        omittedByReason: Array<{ reason: string; count: number; estimatedTokens: number }>
        omittedByRole: Array<{ role: OrchestratorAgentRole; count: number; estimatedTokens: number }>
        samples: ContextExportScopedEntry[]
    }
}

export function createContextExport({
    run,
    profile,
    scopeProfiles,
}: {
    run: OrchestrationRun
    profile: ContextExportArtifact['profile']
    scopeProfiles?: ContextExportScopeProfile[]
}) {
    const profiles = scopeProfiles?.length ? scopeProfiles : buildDefaultScopeProfiles(run)
    const segmentById = new Map(run.context.segments.map((segment) => [segment.id, segment]))
    const nodeById = new Map(run.nodes.map((node) => [node.id, node]))
    const scopes = profiles
        .map((entry) => buildScopeExport({ run, profile: entry, nodeById, segmentById }))
        .filter((entry) => entry !== null)

    const allPacks = scopes.flatMap((scope) => scope._packs)
    const includedTokens = scopes.reduce((total, scope) => total + scope.includedTokens, 0)
    const omittedTokens = scopes.reduce((total, scope) => total + scope.omittedTokens, 0)
    const artifactCount = run.events.reduce((total, event) => total + event.artifacts.length, 0)
    const inclusionRate = includedTokens + omittedTokens > 0
        ? Number((includedTokens / (includedTokens + omittedTokens)).toFixed(3))
        : 1

    const graph = summarizeGraph(run)
    const qualityGates = evaluateQualityGates({ run, scopes, graph, allPacks })
    const exclusionAccounting = summarizeExclusions(scopes)

    return {
        version: 'context_export.v1',
        exportedAt: new Date().toISOString(),
        run: {
            id: run.id,
            task: run.task,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt,
            effectiveCapacityTokens: run.context.effectiveCapacityTokens,
        },
        profile,
        summary: {
            nodeCount: run.nodes.length,
            edgeCount: run.edges.length,
            eventCount: run.events.length,
            segmentCount: run.context.segments.length,
            packCount: run.context.packs.length,
            artifactCount,
            scopeCount: scopes.length,
            includedTokens,
            omittedTokens,
            inclusionRate,
        },
        graph,
        scopes: scopes.map(stripInternalScopeFields),
        qualityGates,
        exclusionAccounting,
    } satisfies ContextExportArtifact
}

export function buildDefaultScopeProfiles(run: OrchestrationRun) {
    const allWorkerRoles = run.nodes
        .filter((node) => node.role !== 'orchestrator')
        .map((node) => node.role)

    return [
        {
            id: 'all_workers',
            label: 'All worker branches',
            description: 'Union of every non-orchestrator context pack for the run.',
            roles: [...new Set(allWorkerRoles)],
        },
        {
            id: 'implementation_focus',
            label: 'Implementation focus',
            description: 'Implementation and builder branches only, tuned for the main delivery path.',
            roles: ['implementation', 'builder'],
        },
        {
            id: 'review_focus',
            label: 'Review focus',
            description: 'Reviewer-oriented context to inspect what shipped and what was omitted.',
            roles: ['reviewer'],
        },
    ] satisfies ContextExportScopeProfile[]
}

type InternalScope = ContextExportScope & { _packs: ContextPack[] }

function buildScopeExport({
    run,
    profile,
    nodeById,
    segmentById,
}: {
    run: OrchestrationRun
    profile: ContextExportScopeProfile
    nodeById: Map<string, OrchestrationNode>
    segmentById: Map<string, ContextSegment>
}) {
    const packs = run.context.packs.filter((pack) => {
        if (profile.nodeIds?.length) {
            return profile.nodeIds.includes(pack.nodeId)
        }
        if (profile.roles?.length) {
            return profile.roles.includes(pack.role)
        }
        return true
    })

    if (!packs.length) {
        return null
    }

    const nodeIds = [...new Set(packs.map((pack) => pack.nodeId))]
    const roles = [...new Set(packs.map((pack) => pack.role))]
    const includedEntries = dedupeScopedEntries(packs.flatMap((pack) => {
        return pack.included.map((entry) => materializeScopedEntry(entry, segmentById))
    }))
    const omittedEntries = dedupeScopedEntries(packs.flatMap((pack) => {
        return pack.omitted.map((entry) => materializeScopedEntry(entry, segmentById))
    }))

    const includedTokens = packs.reduce((total, pack) => total + pack.usedTokens, 0)
    const omittedTokens = packs.reduce((total, pack) => {
        return total + pack.omitted.reduce((packTotal, entry) => packTotal + entry.estimatedTokens, 0)
    }, 0)
    const budgetTokens = packs.reduce((total, pack) => total + pack.budgetTokens, 0)
    const omissionRate = includedTokens + omittedTokens > 0
        ? Number((omittedTokens / (includedTokens + omittedTokens)).toFixed(3))
        : 0

    return {
        id: profile.id,
        label: profile.label,
        description: profile.description,
        roles,
        nodeIds: nodeIds.filter((id) => nodeById.has(id)),
        packCount: packs.length,
        budgetTokens,
        usedTokens: includedTokens,
        includedTokens,
        omittedTokens,
        includedCount: includedEntries.length,
        omittedCount: omittedEntries.length,
        omissionRate,
        included: includedEntries,
        omitted: omittedEntries,
        _packs: packs,
    } satisfies InternalScope
}

function materializeScopedEntry(
    entry: PackedContextSegment,
    segmentById: Map<string, ContextSegment>,
) {
    const segment = segmentById.get(entry.id)
    return {
        id: entry.id,
        label: entry.label,
        kind: segment?.kind || 'unknown',
        temperature: segment?.temperature || 'unknown',
        branchKey: segment?.branchKey || null,
        estimatedTokens: entry.estimatedTokens,
        reasons: entry.reason.split(',').map((reason) => reason.trim()).filter(Boolean),
        preview: segment ? summarizePreview(segment.content) : 'No backing segment found in the stored run.',
    } satisfies ContextExportScopedEntry
}

function dedupeScopedEntries(entries: ContextExportScopedEntry[]) {
    const seen = new Set<string>()
    const deduped: ContextExportScopedEntry[] = []
    for (const entry of entries) {
        if (seen.has(entry.id)) {
            continue
        }
        seen.add(entry.id)
        deduped.push(entry)
    }
    return deduped
}

function summarizePreview(content: string) {
    return content.replace(/\s+/g, ' ').trim().slice(0, 220)
}

function summarizeGraph(run: OrchestrationRun) {
    const inbound = new Map<string, number>()
    const outbound = new Map<string, number>()
    for (const node of run.nodes) {
        inbound.set(node.id, 0)
        outbound.set(node.id, 0)
    }
    for (const edge of run.edges) {
        inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1)
        outbound.set(edge.from, (outbound.get(edge.from) || 0) + 1)
    }

    const edgeTypeCounts = new Map<OrchestrationEdge['type'], number>()
    for (const edge of run.edges) {
        edgeTypeCounts.set(edge.type, (edgeTypeCounts.get(edge.type) || 0) + 1)
    }

    return {
        edgeTypes: [...edgeTypeCounts.entries()].map(([type, count]) => ({ type, count })),
        roots: run.nodes.filter((node) => (inbound.get(node.id) || 0) === 0).map((node) => node.id),
        leaves: run.nodes.filter((node) => (outbound.get(node.id) || 0) === 0).map((node) => node.id),
        orphanNodes: run.nodes
            .filter((node) => node.parentId !== null && (inbound.get(node.id) || 0) === 0)
            .map((node) => node.id),
    }
}

function evaluateQualityGates({
    run,
    scopes,
    graph,
    allPacks,
}: {
    run: OrchestrationRun
    scopes: InternalScope[]
    graph: ReturnType<typeof summarizeGraph>
    allPacks: ContextPack[]
}) {
    const uniquePackedNodeIds = new Set(run.context.packs.map((pack) => pack.nodeId))
    const expectedPackNodeIds = run.nodes.filter((node) => node.role !== 'orchestrator').map((node) => node.id)
    const packCoverage = expectedPackNodeIds.length > 0
        ? uniquePackedNodeIds.size / expectedPackNodeIds.length
        : 1

    const hotSegments = run.context.segments.filter((segment) => segment.temperature === 'hot')
    const includedHotIds = new Set(
        allPacks.flatMap((pack) => pack.included.map((entry) => entry.id))
            .filter((id) => hotSegments.some((segment) => segment.id === id)),
    )
    const hotCoverage = hotSegments.length > 0 ? includedHotIds.size / hotSegments.length : 1

    const omissionRate = scopes.length > 0
        ? scopes.reduce((total, scope) => total + weightedOmissionRate(scope), 0) / scopes.length
        : 0
    const budgetOverflow = run.context.packs.some((pack) => pack.usedTokens > pack.budgetTokens)

    return [
        buildGate({
            id: 'pack_coverage',
            label: 'Pack coverage',
            score: packCoverage,
            passAt: 1,
            warnAt: 0.67,
            actual: `${uniquePackedNodeIds.size}/${expectedPackNodeIds.length} nodes`,
            passSummary: 'Every worker node has a stored context pack.',
            warnSummary: 'Some worker nodes are missing context packs.',
            failSummary: 'Most worker nodes are missing context packs.',
        }),
        buildGate({
            id: 'hot_segment_coverage',
            label: 'Hot segment coverage',
            score: hotCoverage,
            passAt: 0.75,
            warnAt: 0.4,
            actual: `${includedHotIds.size}/${hotSegments.length} hot segments`,
            passSummary: 'Hot task context is represented across the exported scopes.',
            warnSummary: 'Some hot task context was omitted from the exported scopes.',
            failSummary: 'Hot task context is mostly missing from the exported scopes.',
        }),
        {
            id: 'budget_discipline',
            label: 'Budget discipline',
            status: budgetOverflow ? 'fail' : 'pass',
            summary: budgetOverflow
                ? 'At least one stored pack exceeded its token budget.'
                : 'No stored pack exceeded its token budget.',
            actual: budgetOverflow ? 'overflow detected' : 'within budget',
            threshold: 'usedTokens <= budgetTokens for every pack',
        } satisfies ContextExportGate,
        buildGate({
            id: 'omission_pressure',
            label: 'Omission pressure',
            score: 1 - omissionRate,
            passAt: 0.7,
            warnAt: 0.45,
            actual: `${Math.round(omissionRate * 100)}% omitted`,
            passSummary: 'The priority-weighted export kept omission pressure under control.',
            warnSummary: 'The priority-weighted export is carrying noticeable omission pressure.',
            failSummary: 'The export drops too much high-priority context to trust without inspection.',
        }),
        {
            id: 'graph_integrity',
            label: 'Graph integrity',
            status: graph.orphanNodes.length === 0 ? 'pass' : 'fail',
            summary: graph.orphanNodes.length === 0
                ? 'Every child node has at least one inbound graph edge.'
                : 'One or more child nodes are disconnected from the orchestration graph.',
            actual: graph.orphanNodes.length === 0 ? '0 orphan nodes' : graph.orphanNodes.join(', '),
            threshold: 'no orphan nodes',
        } satisfies ContextExportGate,
    ]
}

function weightedOmissionRate(scope: InternalScope) {
    const included = scope.included.reduce((total, entry) => total + weightedTokens(entry), 0)
    const omitted = scope.omitted.reduce((total, entry) => total + weightedTokens(entry), 0)
    return included + omitted > 0 ? omitted / (included + omitted) : 0
}

function weightedTokens(entry: ContextExportScopedEntry) {
    return entry.estimatedTokens * temperatureWeight(entry.temperature)
}

function temperatureWeight(temperature: ContextExportScopedEntry['temperature']) {
    switch (temperature) {
        case 'hot':
            return 4
        case 'warm':
            return 2
        case 'cold':
            return 0.25
        default:
            return 1
    }
}

function buildGate({
    id,
    label,
    score,
    passAt,
    warnAt,
    actual,
    passSummary,
    warnSummary,
    failSummary,
}: {
    id: string
    label: string
    score: number
    passAt: number
    warnAt: number
    actual: string
    passSummary: string
    warnSummary: string
    failSummary: string
}) {
    const status: ContextExportStatus = score >= passAt ? 'pass' : score >= warnAt ? 'warn' : 'fail'
    return {
        id,
        label,
        status,
        summary: status === 'pass' ? passSummary : status === 'warn' ? warnSummary : failSummary,
        actual,
        threshold: `pass >= ${passAt}, warn >= ${warnAt}`,
    } satisfies ContextExportGate
}

function summarizeExclusions(scopes: InternalScope[]) {
    const reasonTotals = new Map<string, { count: number; estimatedTokens: number }>()
    const roleTotals = new Map<OrchestratorAgentRole, { count: number; estimatedTokens: number }>()

    for (const scope of scopes) {
        for (const omitted of scope.omitted) {
            for (const reason of omitted.reasons) {
                const current = reasonTotals.get(reason) || { count: 0, estimatedTokens: 0 }
                current.count += 1
                current.estimatedTokens += omitted.estimatedTokens
                reasonTotals.set(reason, current)
            }
        }
        for (const role of scope.roles) {
            const tokens = scope.omittedTokens
            const current = roleTotals.get(role) || { count: 0, estimatedTokens: 0 }
            current.count += scope.omittedCount
            current.estimatedTokens += tokens
            roleTotals.set(role, current)
        }
    }

    return {
        omittedByReason: [...reasonTotals.entries()]
            .map(([reason, value]) => ({ reason, ...value }))
            .sort((left, right) => right.estimatedTokens - left.estimatedTokens),
        omittedByRole: [...roleTotals.entries()]
            .map(([role, value]) => ({ role, ...value }))
            .sort((left, right) => right.estimatedTokens - left.estimatedTokens),
        samples: scopes.flatMap((scope) => scope.omitted).slice(0, 8),
    }
}

function stripInternalScopeFields(scope: InternalScope) {
    const { _packs, ...rest } = scope
    void _packs
    return rest
}
