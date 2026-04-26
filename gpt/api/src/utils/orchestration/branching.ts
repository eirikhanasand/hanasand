import type { BranchDecision, BranchPolicy, OrchestrationNode } from './types.ts'

export function decideBranches({
    task,
    policy,
}: {
    task: string
    policy: BranchPolicy
}) {
    const decisions: BranchDecision[] = []
    const normalized = task.toLowerCase()

    if (/(build|docker|compose|run|deploy|verify|test)/.test(normalized)) {
        decisions.push({
            role: 'builder',
            task: `Build and verification branch for: ${task}`,
            reason: 'The task mentions build/run/verification work and benefits from a dedicated builder branch.',
        })
    }

    if (/(review|diff|safety|verify|check|qa|ship)/.test(normalized) || decisions.length === 0) {
        decisions.push({
            role: 'reviewer',
            task: `Review branch for: ${task}`,
            reason: 'A reviewer branch keeps final reporting and risk assessment separate from direct implementation.',
        })
    }

    return decisions.slice(0, policy.maxBranches)
}

export function explainBranchLimit({
    existingNodes,
    policy,
}: {
    existingNodes: OrchestrationNode[]
    policy: BranchPolicy
}) {
    const activeBranches = existingNodes.filter((node) => node.depth > 0 && node.status !== 'completed')
    if (activeBranches.length < policy.maxBranches) {
        return null
    }

    return `Branch limit reached at ${policy.maxBranches} active branches. Existing branches must close or merge before more work can fork.`
}
