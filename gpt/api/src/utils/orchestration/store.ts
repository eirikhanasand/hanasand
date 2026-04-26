import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getRunDirectory, getRunPath } from './paths.ts'
import type {
    BranchPolicy,
    ContextPack,
    ContextSegment,
    OrchestrationArtifact,
    OrchestrationEdge,
    OrchestrationEvent,
    OrchestrationEventType,
    OrchestrationNode,
    OrchestrationNodeStatus,
    OrchestratorAgentRole,
    OrchestrationRun,
} from './types.ts'

export async function ensureRunDirectory(runId: string) {
    await fs.mkdir(getRunDirectory(runId), { recursive: true })
}

export async function createRun({
    runId,
    task,
    branchPolicy,
    ownerNodeId,
    strategy,
    notes,
}: {
    runId: string
    task: string
    branchPolicy: BranchPolicy
    ownerNodeId: string
    strategy: string
    notes: string[]
}) {
    const now = new Date().toISOString()
    const run: OrchestrationRun = {
        id: runId,
        task,
        createdAt: now,
        updatedAt: now,
        topology: {
            ownerNodeId,
            strategy,
            notes,
        },
        branchPolicy,
        nodes: [],
        edges: [],
        events: [],
        context: {
            effectiveCapacityTokens: 10_000_000,
            segments: [],
            packs: [],
        },
        evaluation: {
            success: null,
            score: null,
            summary: null,
            checkedAt: null,
        },
    }

    await writeRun(run)
    return run
}

export async function readRun(runId: string) {
    const contents = await fs.readFile(getRunPath(runId), 'utf8')
    return JSON.parse(contents) as OrchestrationRun
}

export async function writeRun(run: OrchestrationRun) {
    await ensureRunDirectory(run.id)
    run.updatedAt = new Date().toISOString()
    await fs.writeFile(getRunPath(run.id), `${JSON.stringify(run, null, 2)}\n`, 'utf8')
}

export async function appendNode(runId: string, node: OrchestrationNode) {
    const run = await readRun(runId)
    run.nodes.push(node)
    await writeRun(run)
    return run
}

export async function appendEdge(runId: string, edge: OrchestrationEdge) {
    const run = await readRun(runId)
    run.edges.push(edge)
    await writeRun(run)
    return run
}

export async function addContextSegment(runId: string, segment: ContextSegment) {
    const run = await readRun(runId)
    run.context.segments.push(segment)
    await writeRun(run)
    return run
}

export async function addContextPack(runId: string, pack: ContextPack) {
    const run = await readRun(runId)
    run.context.packs = [...run.context.packs.filter((entry) => entry.nodeId !== pack.nodeId), pack]
    await writeRun(run)
    return run
}

export async function updateNodeStatus({
    runId,
    nodeId,
    status,
    summary,
}: {
    runId: string
    nodeId: string
    status: OrchestrationNodeStatus
    summary?: string | null
}) {
    const run = await readRun(runId)
    run.nodes = run.nodes.map((node) => {
        if (node.id !== nodeId) {
            return node
        }

        const next = {
            ...node,
            status,
            summary: summary === undefined ? node.summary : summary,
        }
        if (status === 'running' && !node.startedAt) {
            next.startedAt = new Date().toISOString()
        }
        if (['completed', 'blocked', 'error', 'skipped'].includes(status)) {
            next.completedAt = new Date().toISOString()
        }
        return next
    })

    await writeRun(run)
    return run
}

export async function appendEvent(runId: string, event: OrchestrationEvent) {
    const run = await readRun(runId)
    run.events.push(event)
    await writeRun(run)
    return run
}

export async function setEvaluation({
    runId,
    success,
    score,
    summary,
}: {
    runId: string
    success: boolean
    score: number
    summary: string
}) {
    const run = await readRun(runId)
    run.evaluation = {
        success,
        score,
        summary,
        checkedAt: new Date().toISOString(),
    }
    await writeRun(run)
    return run
}

export function createNode({
    role,
    label,
    parentId,
    branchKey,
    depth,
    task,
}: {
    role: OrchestratorAgentRole
    label: string
    parentId: string | null
    branchKey: string
    depth: number
    task: string
}) {
    return {
        id: `${role}-${randomUUID()}`,
        role,
        label,
        parentId,
        branchKey,
        depth,
        status: 'pending',
        task,
        assignedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        summary: null,
    } satisfies OrchestrationNode
}

export function createEdge({
    from,
    to,
    type,
    label,
}: {
    from: string
    to: string
    type: OrchestrationEdge['type']
    label?: string | null
}) {
    return {
        id: `edge-${randomUUID()}`,
        from,
        to,
        type,
        createdAt: new Date().toISOString(),
        label: label || null,
    } satisfies OrchestrationEdge
}

export function createArtifact({
    label,
    kind,
    content,
}: {
    label: string
    kind: OrchestrationArtifact['kind']
    content: string
}) {
    return {
        id: `artifact-${randomUUID()}`,
        label,
        kind,
        content,
        createdAt: new Date().toISOString(),
    } satisfies OrchestrationArtifact
}

export function createEvent({
    runId,
    nodeId,
    role,
    type,
    state,
    summary,
    detail,
    artifacts,
    metadata,
}: {
    runId: string
    nodeId: string
    role: OrchestratorAgentRole
    type: OrchestrationEventType
    state?: OrchestrationEvent['state']
    summary: string
    detail?: string | null
    artifacts?: OrchestrationArtifact[]
    metadata?: Record<string, unknown>
}) {
    return {
        id: `event-${randomUUID()}`,
        runId,
        nodeId,
        role,
        type,
        state: state || 'info',
        summary,
        detail: detail || null,
        artifacts: artifacts || [],
        createdAt: new Date().toISOString(),
        metadata: metadata || {},
    } satisfies OrchestrationEvent
}

export async function writeRunMarkdown(runId: string, filename: string, content: string) {
    await ensureRunDirectory(runId)
    await fs.writeFile(path.join(getRunDirectory(runId), filename), content, 'utf8')
}
