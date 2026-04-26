export type OrchestratorAgentRole =
    | 'orchestrator'
    | 'implementation'
    | 'builder'
    | 'reviewer'

export type OrchestrationNodeStatus =
    | 'pending'
    | 'running'
    | 'completed'
    | 'blocked'
    | 'error'
    | 'skipped'

export type OrchestrationEdgeType =
    | 'delegates_to'
    | 'branches_to'
    | 'reports_to'
    | 'reviews'

export type OrchestrationEventType =
    | 'status_update'
    | 'artifact_produced'
    | 'branch_opened'
    | 'branch_closed'
    | 'branch_blocked'
    | 'merge_resolved'
    | 'review_requested'
    | 'worker_started'
    | 'worker_completed'
    | 'context_packed'
    | 'run_summary'

export type ContextTemperature = 'hot' | 'warm' | 'cold'

export type OrchestrationArtifact = {
    id: string
    label: string
    kind: 'text' | 'json' | 'diff' | 'log'
    content: string
    createdAt: string
}

export type OrchestrationNode = {
    id: string
    role: OrchestratorAgentRole
    label: string
    parentId: string | null
    branchKey: string
    depth: number
    status: OrchestrationNodeStatus
    task: string
    assignedAt: string
    startedAt: string | null
    completedAt: string | null
    summary: string | null
}

export type OrchestrationEdge = {
    id: string
    from: string
    to: string
    type: OrchestrationEdgeType
    createdAt: string
    label: string | null
}

export type OrchestrationEvent = {
    id: string
    runId: string
    nodeId: string
    role: OrchestratorAgentRole
    type: OrchestrationEventType
    state: 'info' | 'completed' | 'blocked' | 'error'
    summary: string
    detail: string | null
    artifacts: OrchestrationArtifact[]
    createdAt: string
    metadata: Record<string, unknown>
}

export type ContextSegment = {
    id: string
    label: string
    kind: 'task' | 'repo_summary' | 'constraint' | 'artifact' | 'memory'
    temperature: ContextTemperature
    roleAffinity: OrchestratorAgentRole[]
    branchKey: string | null
    content: string
    estimatedTokens: number
    priority: number
    createdAt: string
    metadata: Record<string, unknown>
}

export type PackedContextSegment = {
    id: string
    label: string
    estimatedTokens: number
    reason: string
}

export type ContextPack = {
    nodeId: string
    role: OrchestratorAgentRole
    budgetTokens: number
    usedTokens: number
    included: PackedContextSegment[]
    omitted: PackedContextSegment[]
    generatedAt: string
}

export type BranchPolicy = {
    maxBranches: number
    maxDepth: number
}

export type BranchDecision = {
    role: Extract<OrchestratorAgentRole, 'builder' | 'reviewer'>
    task: string
    reason: string
}

export type OrchestrationRun = {
    id: string
    task: string
    createdAt: string
    updatedAt: string
    topology: {
        ownerNodeId: string
        strategy: string
        notes: string[]
    }
    branchPolicy: BranchPolicy
    nodes: OrchestrationNode[]
    edges: OrchestrationEdge[]
    events: OrchestrationEvent[]
    context: {
        effectiveCapacityTokens: number
        segments: ContextSegment[]
        packs: ContextPack[]
    }
    evaluation: {
        success: boolean | null
        score: number | null
        summary: string | null
        checkedAt: string | null
    }
}

export type WorkerInput = {
    runId: string
    nodeId: string
    role: OrchestratorAgentRole
    task: string
    branchKey: string
    packedContext: ContextPack
    scenario: null | {
        id: string
        tension: 'baseline' | 'context_pressure' | 'partial_failure' | 'contested'
        contradictionMode?: boolean
        expectedBlockedRoles?: OrchestratorAgentRole[]
    }
}

export type WorkerResult = {
    exitCode: number
    events: OrchestrationEvent[]
    stdout: string
    stderr: string
}
