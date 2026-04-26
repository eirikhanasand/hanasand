import { randomUUID } from 'node:crypto'
import type {
    ContextPack,
    ContextSegment,
    OrchestrationNode,
    OrchestratorAgentRole,
    PackedContextSegment,
} from './types.ts'

export function estimateTokens(content: string) {
    return Math.max(1, Math.ceil(content.length / 4))
}

export function createContextSegment({
    label,
    kind,
    temperature,
    roleAffinity,
    branchKey,
    content,
    priority,
    metadata,
}: {
    label: string
    kind: ContextSegment['kind']
    temperature: ContextSegment['temperature']
    roleAffinity: OrchestratorAgentRole[]
    branchKey?: string | null
    content: string
    priority?: number
    metadata?: Record<string, unknown>
}) {
    return {
        id: `segment-${randomUUID()}`,
        label,
        kind,
        temperature,
        roleAffinity,
        branchKey: branchKey || null,
        content,
        estimatedTokens: estimateTokens(content),
        priority: priority ?? 1,
        createdAt: new Date().toISOString(),
        metadata: metadata || {},
    } satisfies ContextSegment
}

export function getRoleBudget(role: OrchestratorAgentRole) {
    switch (role) {
        case 'orchestrator':
            return 12000
        case 'implementation':
            return 18000
        case 'builder':
            return 10000
        case 'reviewer':
            return 9000
    }
}

export function packContextForNode({
    node,
    segments,
    budgetTokens = getRoleBudget(node.role),
}: {
    node: OrchestrationNode
    segments: ContextSegment[]
    budgetTokens?: number
}) {
    const scored = [...segments].sort((left, right) => scoreSegment(right, node) - scoreSegment(left, node))

    let usedTokens = 0
    const included: PackedContextSegment[] = []
    const omitted: PackedContextSegment[] = []
    const includedDetailed: Array<{ summary: PackedContextSegment; score: number; temperature: ContextSegment['temperature'] }> = []

    for (const segment of scored) {
        const segmentScore = scoreSegment(segment, node)
        const reason = buildInclusionReason(segment, node)
        const summary = {
            id: segment.id,
            label: segment.label,
            estimatedTokens: segment.estimatedTokens,
            reason,
        }

        if (usedTokens + segment.estimatedTokens <= budgetTokens) {
            usedTokens += segment.estimatedTokens
            included.push(summary)
            includedDetailed.push({ summary, score: segmentScore, temperature: segment.temperature })
            continue
        }

        const remainingTokens = budgetTokens - usedTokens
        const compressedTarget = compressedTokenTarget(segment)
        if (shouldCompressSegment(segment) && remainingTokens > 0) {
            const compressedTokens = Math.min(segment.estimatedTokens, Math.max(1, Math.min(remainingTokens, compressedTarget)))
            usedTokens += compressedTokens
            const compressedSummary = {
                ...summary,
                estimatedTokens: compressedTokens,
                reason: `${reason}, compressed high-priority context`,
            }
            included.push(compressedSummary)
            includedDetailed.push({ summary: compressedSummary, score: segmentScore, temperature: segment.temperature })
            continue
        }

        if (shouldCompressSegment(segment)) {
            const rebalance = rebalanceForHigherPrioritySegment({
                segment,
                segmentScore,
                summary,
                includedDetailed,
                budgetTokens,
                usedTokens,
            })
            if (rebalance) {
                usedTokens = rebalance.usedTokens
                for (const removed of rebalance.removed) {
                    const includedIndex = included.findIndex((entry) => entry.id === removed.summary.id && entry.reason === removed.summary.reason)
                    if (includedIndex >= 0) {
                        included.splice(includedIndex, 1)
                    }
                    omitted.push({
                        ...removed.summary,
                        reason: `${removed.summary.reason}, evicted for higher-priority context`,
                    })
                }
                for (const removed of rebalance.removed) {
                    const detailIndex = includedDetailed.findIndex((entry) => entry.summary.id === removed.summary.id && entry.summary.reason === removed.summary.reason)
                    if (detailIndex >= 0) {
                        includedDetailed.splice(detailIndex, 1)
                    }
                }
                included.push(rebalance.added)
                includedDetailed.push({
                    summary: rebalance.added,
                    score: segmentScore,
                    temperature: segment.temperature,
                })
                usedTokens += rebalance.added.estimatedTokens
                continue
            }
        }

        if (shouldAlwaysIncludeAsMicroSummary(segment)) {
            const microTokens = Math.min(segment.estimatedTokens, 120)
            const rebalance = rebalanceForHigherPrioritySegment({
                segment,
                segmentScore,
                summary: {
                    ...summary,
                    estimatedTokens: microTokens,
                    reason: `${reason}, micro-summary fallback`,
                },
                includedDetailed,
                budgetTokens,
                usedTokens,
            })
            if (rebalance) {
                usedTokens = rebalance.usedTokens
                for (const removed of rebalance.removed) {
                    const includedIndex = included.findIndex((entry) => entry.id === removed.summary.id && entry.reason === removed.summary.reason)
                    if (includedIndex >= 0) {
                        included.splice(includedIndex, 1)
                    }
                    omitted.push({
                        ...removed.summary,
                        reason: `${removed.summary.reason}, evicted for micro-summary fallback`,
                    })
                }
                for (const removed of rebalance.removed) {
                    const detailIndex = includedDetailed.findIndex((entry) => entry.summary.id === removed.summary.id && entry.summary.reason === removed.summary.reason)
                    if (detailIndex >= 0) {
                        includedDetailed.splice(detailIndex, 1)
                    }
                }
                included.push(rebalance.added)
                includedDetailed.push({
                    summary: rebalance.added,
                    score: segmentScore,
                    temperature: segment.temperature,
                })
                usedTokens += rebalance.added.estimatedTokens
                continue
            }
        }

        omitted.push(summary)
    }

    return {
        nodeId: node.id,
        role: node.role,
        budgetTokens,
        usedTokens,
        included,
        omitted,
        generatedAt: new Date().toISOString(),
    } satisfies ContextPack
}

function rebalanceForHigherPrioritySegment({
    segment,
    segmentScore,
    summary,
    includedDetailed,
    budgetTokens,
    usedTokens,
}: {
    segment: ContextSegment
    segmentScore: number
    summary: PackedContextSegment
    includedDetailed: Array<{ summary: PackedContextSegment; score: number; temperature: ContextSegment['temperature'] }>
    budgetTokens: number
    usedTokens: number
}) {
    const requiredTokens = Math.max(0, usedTokens + summary.estimatedTokens - budgetTokens)
    if (requiredTokens <= 0) {
        return { added: summary, removed: [], usedTokens }
    }

    const candidates = [...includedDetailed]
        .filter((entry) => shouldEvictForSegment(entry, segment, segmentScore))
        .sort((left, right) => left.score - right.score || left.summary.estimatedTokens - right.summary.estimatedTokens)

    const removed: Array<{ summary: PackedContextSegment; score: number; temperature: ContextSegment['temperature'] }> = []
    let freedTokens = 0
    for (const candidate of candidates) {
        removed.push(candidate)
        freedTokens += candidate.summary.estimatedTokens
        if (freedTokens >= requiredTokens) {
            break
        }
    }

    if (freedTokens < requiredTokens) {
        return null
    }

    return {
        added: summary,
        removed,
        usedTokens: usedTokens - freedTokens,
    }
}

function shouldCompressSegment(segment: ContextSegment) {
    return segment.temperature === 'hot' || segment.priority >= 5 || (segment.temperature === 'warm' && segment.priority >= 4)
}

function shouldAlwaysIncludeAsMicroSummary(segment: ContextSegment) {
    return segment.temperature === 'hot' && segment.priority >= 5
}

function compressedTokenTarget(segment: ContextSegment) {
    if (segment.temperature === 'hot') {
        return 420
    }
    if (segment.temperature === 'warm') {
        return 240
    }
    return 180
}

function shouldEvictForSegment(
    entry: { summary: PackedContextSegment; score: number; temperature: ContextSegment['temperature'] },
    incoming: ContextSegment,
    incomingScore: number,
) {
    if (entry.score >= incomingScore) {
        return false
    }
    if (entry.temperature === 'hot' && incoming.temperature !== 'hot') {
        return false
    }
    return true
}

function scoreSegment(segment: ContextSegment, node: OrchestrationNode) {
    let score = segment.priority * 10
    if (segment.roleAffinity.includes(node.role)) {
        score += 100
    }
    if (segment.branchKey === node.branchKey) {
        score += 80
    } else if (segment.branchKey === null) {
        score += 25
    }
    if (segment.temperature === 'hot') {
        score += 50
    } else if (segment.temperature === 'warm') {
        score += 25
    }
    return score
}

function buildInclusionReason(segment: ContextSegment, node: OrchestrationNode) {
    const reasons = []
    if (segment.roleAffinity.includes(node.role)) {
        reasons.push(`role match for ${node.role}`)
    }
    if (segment.branchKey === node.branchKey) {
        reasons.push('same branch')
    } else if (segment.branchKey === null) {
        reasons.push('shared global context')
    }
    reasons.push(`${segment.temperature} memory`)
    return reasons.join(', ')
}
