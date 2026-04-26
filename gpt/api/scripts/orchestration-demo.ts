import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { decideBranches, explainBranchLimit } from '../src/utils/orchestration/branching.ts'
import { addContextPack, addContextSegment, appendEdge, appendEvent, appendNode, createArtifact, createEvent, createNode, createRun, readRun, updateNodeStatus, writeRunMarkdown } from '../src/utils/orchestration/store.ts'
import { createContextSegment, packContextForNode } from '../src/utils/orchestration/context.ts'
import { runWorker } from '../src/utils/orchestration/harness.ts'
import { getReplayPath } from '../src/utils/orchestration/paths.ts'
import { buildReplayMarkdown } from '../src/utils/orchestration/replay.ts'
import { buildInitialTopology } from '../src/utils/orchestration/topology.ts'
import type { OrchestrationNode } from '../src/utils/orchestration/types.ts'

type DemoScenario = {
    id: string
    label: string
    task: string
    branchPolicy?: {
        maxBranches: number
        maxDepth: number
    }
    workerProfile?: {
        tension: 'baseline' | 'context_pressure' | 'partial_failure' | 'contested'
        contradictionMode?: boolean
        expectedBlockedRoles?: Array<'implementation' | 'builder' | 'reviewer'>
    }
    additionalContext?: Array<{
        label: string
        kind: 'task' | 'constraint' | 'memory' | 'artifact' | 'repo_summary'
        temperature: 'hot' | 'warm' | 'cold'
        roleAffinity: Array<'orchestrator' | 'implementation' | 'builder' | 'reviewer'>
        branchKey?: string | null
        content: string
        priority?: number
    }>
}

const scenarioFileIndex = process.argv.indexOf('--scenario-file')
const scenarioPath = scenarioFileIndex >= 0 ? process.argv[scenarioFileIndex + 1] : null
const scenario = scenarioPath ? JSON.parse(await fs.readFile(path.resolve(process.cwd(), scenarioPath), 'utf8')) as DemoScenario : null
const task = scenario?.task || process.argv.slice(2).filter((entry, index, array) => !(array[index - 1] === '--scenario-file' || entry === '--scenario-file')).join(' ').trim() || 'Build a Next.js dashboard, verify Docker startup, and prepare a reviewer handoff.'
const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const workerWrapper = path.join(scriptDir, 'orchestrator-worker.sh')

const topology = buildInitialTopology(task)
await createRun({
    runId,
    task,
    branchPolicy: scenario?.branchPolicy || { maxBranches: 3, maxDepth: 2 },
    ownerNodeId: topology.ownerNodeId,
    strategy: topology.strategy,
    notes: scenario
        ? [...topology.notes, `Scenario profile: ${scenario.id} (${scenario.workerProfile?.tension || 'baseline'}).`]
        : topology.notes,
})

for (const node of topology.nodes) {
    await appendNode(runId, node)
}
for (const edge of topology.edges) {
    await appendEdge(runId, edge)
}

await addContextSegment(runId, createContextSegment({
    label: 'Task brief',
    kind: 'task',
    temperature: 'hot',
    roleAffinity: ['orchestrator', 'implementation'],
    branchKey: 'root',
    content: task,
    priority: 5,
}))
await addContextSegment(runId, createContextSegment({
    label: 'Repository constraints',
    kind: 'constraint',
    temperature: 'warm',
    roleAffinity: ['orchestrator', 'implementation', 'builder', 'reviewer'],
    content: 'Prefer TypeScript and shell scripts. Keep orchestration inspectable and replayable. Treat 10M context as effective retrieval-backed context rather than a single prompt.',
    priority: 4,
}))
await addContextSegment(runId, createContextSegment({
    label: 'Known product gap',
    kind: 'memory',
    temperature: 'cold',
    roleAffinity: ['orchestrator', 'reviewer'],
    content: 'Remote VM shell/file-write deploy flow is still incomplete, so orchestration should stay honest about local-only branches.',
    priority: 3,
}))

for (const segment of scenario?.additionalContext || []) {
    await addContextSegment(runId, createContextSegment(segment))
}

const decisions = decideBranches({
    task,
    policy: scenario?.branchPolicy || { maxBranches: 3, maxDepth: 2 },
})

const implementation = topology.nodes.find((node) => node.role === 'implementation')
if (!implementation) {
    throw new Error('Missing implementation node in topology.')
}

for (const decision of decisions) {
    const branchNode = createNode({
        role: decision.role,
        label: `${decision.role} branch`,
        parentId: implementation.id,
        branchKey: `${implementation.branchKey}:${decision.role}`,
        depth: implementation.depth + 1,
        task: decision.task,
    })
    await appendNode(runId, branchNode)
    await appendEdge(runId, {
        id: `edge-${branchNode.id}`,
        from: implementation.id,
        to: branchNode.id,
        type: 'branches_to',
        createdAt: new Date().toISOString(),
        label: decision.reason,
    })
    await appendEvent(runId, createEvent({
        runId,
        nodeId: implementation.id,
        role: implementation.role,
        type: 'branch_opened',
        summary: `Opened ${decision.role} branch`,
        detail: decision.reason,
        metadata: { branchNodeId: branchNode.id },
    }))
}

const runBeforeWorkers = await readRun(runId)
const branchLimitNotice = explainBranchLimit({
    existingNodes: runBeforeWorkers.nodes,
    policy: runBeforeWorkers.branchPolicy,
})
if (branchLimitNotice) {
    await appendEvent(runId, createEvent({
        runId,
        nodeId: runBeforeWorkers.topology.ownerNodeId,
        role: 'orchestrator',
        type: 'branch_blocked',
        state: 'blocked',
        summary: 'Branch policy blocked additional work',
        detail: branchLimitNotice,
    }))
}

const runWithBranches = await readRun(runId)
const workers = runWithBranches.nodes.filter((node) => node.role !== 'orchestrator')
for (const node of workers) {
    const current = await readRun(runId)
    const pack = packContextForNode({
        node,
        segments: current.context.segments.map((segment) => ({
            ...segment,
            branchKey: segment.branchKey === 'root' && node.branchKey !== 'root' ? null : segment.branchKey,
        })),
    })
    await addContextPack(runId, pack)
    await appendEvent(runId, createEvent({
        runId,
        nodeId: node.id,
        role: node.role,
        type: 'context_packed',
        summary: `Packed context for ${node.role}`,
        detail: `Included ${pack.included.length} segments and omitted ${pack.omitted.length}.`,
        metadata: {
            budgetTokens: pack.budgetTokens,
            usedTokens: pack.usedTokens,
        },
    }))
}

const runnableNodes = (await readRun(runId)).nodes.filter((node) => node.role !== 'orchestrator')
for (const node of runnableNodes) {
    const freshRun = await readRun(runId)
    const pack = freshRun.context.packs.find((entry) => entry.nodeId === node.id)
    if (!pack) {
        throw new Error(`Missing context pack for node ${node.id}`)
    }

    await runWorker({
        runId,
        node,
        wrapperPath: workerWrapper,
        input: {
            runId,
            nodeId: node.id,
            role: node.role,
            task: node.task,
            branchKey: node.branchKey,
            packedContext: pack,
            scenario: scenario?.workerProfile
                ? {
                    id: scenario.id,
                    tension: scenario.workerProfile.tension,
                    contradictionMode: scenario.workerProfile.contradictionMode,
                    expectedBlockedRoles: scenario.workerProfile.expectedBlockedRoles,
                }
                : null,
        },
    })
}

if (scenario?.workerProfile?.contradictionMode) {
    const runAfterWorkers = await readRun(runId)
    const implementationNotes = runAfterWorkers.events
        .filter((event) => event.role === 'implementation')
        .flatMap((event) => event.artifacts.map((artifact) => artifact.content))
        .join('\n')
    const reviewerNotes = runAfterWorkers.events
        .filter((event) => event.role === 'reviewer')
        .flatMap((event) => event.artifacts.map((artifact) => artifact.content))
        .join('\n')
    const resolvedTowardReview = /hold|merge decision|risk posture: medium/i.test(reviewerNotes)
    const mergeDecision = resolvedTowardReview
        ? 'Hold shipping until the reviewer concern is cleared.'
        : 'Proceed with the implementation recommendation.'

    await appendEvent(runId, createEvent({
        runId,
        nodeId: topology.ownerNodeId,
        role: 'orchestrator',
        type: 'merge_resolved',
        state: 'completed',
        summary: 'Resolved contested branch outputs',
        detail: `Implementation branch argued for immediate progress, reviewer branch argued for caution. Final merge decision: ${mergeDecision}`,
        artifacts: [
            createArtifact({
                label: 'merge-resolution.md',
                kind: 'text',
                content: `# Merge resolution\n\n- Implementation stance: ${/ship the narrow fix/i.test(implementationNotes) ? 'ship narrow fix' : 'proceed'}\n- Reviewer stance: ${resolvedTowardReview ? 'hold for review follow-up' : 'approve'}\n- Final decision: ${mergeDecision}`,
            }),
        ],
    }))
}

await appendEvent(runId, createEvent({
    runId,
    nodeId: topology.ownerNodeId,
    role: 'orchestrator',
    type: 'run_summary',
    state: 'completed',
    summary: 'Orchestrator collected child updates and closed the run.',
    detail: `Executed ${runnableNodes.length} worker nodes with structured upstream events.`,
}))
await updateNodeStatus({
    runId,
    nodeId: topology.ownerNodeId,
    status: 'completed',
    summary: 'Closed orchestration run and persisted replay output.',
})

const finishedRun = await readRun(runId)
const replay = buildReplayMarkdown(finishedRun)
await writeRunMarkdown(runId, path.basename(getReplayPath(runId)), replay)

console.log(JSON.stringify({
    ok: true,
    runId,
    runPath: getReplayPath(runId).replace(/replay\.md$/, 'run.json'),
    replayPath: getReplayPath(runId),
    nodes: finishedRun.nodes.map((node: OrchestrationNode) => ({
        id: node.id,
        role: node.role,
        status: node.status,
    })),
    eventCount: finishedRun.events.length,
}, null, 2))
