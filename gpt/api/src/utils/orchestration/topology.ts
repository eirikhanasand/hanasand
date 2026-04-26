import { createEdge, createNode } from './store.ts'
import type { BranchDecision, BranchPolicy, OrchestrationEdge, OrchestrationNode } from './types.ts'

export function createDefaultBranchPolicy(): BranchPolicy {
    return {
        maxBranches: 3,
        maxDepth: 2,
    }
}

export function buildInitialTopology(task: string) {
    const orchestrator = createNode({
        role: 'orchestrator',
        label: 'Orchestrator',
        parentId: null,
        branchKey: 'root',
        depth: 0,
        task,
    })
    const implementation = createNode({
        role: 'implementation',
        label: 'Implementation agent',
        parentId: orchestrator.id,
        branchKey: 'implementation',
        depth: 1,
        task,
    })

    const edges: OrchestrationEdge[] = [
        createEdge({
            from: orchestrator.id,
            to: implementation.id,
            type: 'delegates_to',
            label: 'primary delivery path',
        }),
        createEdge({
            from: implementation.id,
            to: orchestrator.id,
            type: 'reports_to',
            label: 'upstream summary',
        }),
    ]

    return {
        nodes: [orchestrator, implementation] satisfies OrchestrationNode[],
        edges,
        ownerNodeId: orchestrator.id,
        strategy: 'orchestrator -> implementation -> optional builder/reviewer branches',
        notes: [
            'The orchestrator owns steering, branch policy, context packaging, and final upstream reporting.',
            'The implementation node owns direct task execution and requests specialist branches when needed.',
            'Builder and reviewer branches are opened through branch-control policy rather than by default.',
        ],
    }
}

export function addDecisionBranch({
    parent,
    decision,
}: {
    parent: OrchestrationNode
    decision: BranchDecision
}) {
    const node = createNode({
        role: decision.role,
        label: `${decision.role[0]!.toUpperCase()}${decision.role.slice(1)} agent`,
        parentId: parent.id,
        branchKey: `${parent.branchKey}:${decision.role}`,
        depth: parent.depth + 1,
        task: decision.task,
    })

    return {
        node,
        edges: [
            createEdge({
                from: parent.id,
                to: node.id,
                type: 'branches_to',
                label: decision.reason,
            }),
            createEdge({
                from: node.id,
                to: parent.id,
                type: decision.role === 'reviewer' ? 'reviews' : 'reports_to',
                label: 'upstream report',
            }),
        ],
    }
}
