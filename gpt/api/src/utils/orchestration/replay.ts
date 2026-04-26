import type { OrchestrationRun } from './types.ts'

export function buildReplayMarkdown(run: OrchestrationRun) {
    const lines = [
        `# Orchestration Replay: ${run.id}`,
        '',
        `- Task: ${run.task}`,
        `- Strategy: ${run.topology.strategy}`,
        `- Effective context capacity: ${run.context.effectiveCapacityTokens.toLocaleString()} tokens`,
        `- Evaluation: ${run.evaluation.summary || 'pending'}`,
        '',
        '## Nodes',
    ]

    for (const node of run.nodes) {
        lines.push(`- ${node.label} (${node.role})`)
        lines.push(`  - status: ${node.status}`)
        lines.push(`  - branch: ${node.branchKey}`)
        lines.push(`  - summary: ${node.summary || 'n/a'}`)
    }

    lines.push('', '## Timeline')
    for (const event of run.events.sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
        lines.push(`- ${event.createdAt} | ${event.role} | ${event.type} | ${event.summary}`)
        if (event.detail) {
            lines.push(`  - ${event.detail}`)
        }
        if (event.artifacts.length) {
            lines.push(`  - artifacts: ${event.artifacts.map((artifact) => artifact.label).join(', ')}`)
        }
    }

    lines.push('', '## Context packs')
    for (const pack of run.context.packs) {
        lines.push(`- ${pack.nodeId} used ${pack.usedTokens}/${pack.budgetTokens} tokens`)
        lines.push(`  - included: ${pack.included.map((segment) => `${segment.label} (${segment.reason})`).join('; ') || 'none'}`)
        lines.push(`  - omitted: ${pack.omitted.map((segment) => segment.label).join(', ') || 'none'}`)
    }

    return `${lines.join('\n')}\n`
}
