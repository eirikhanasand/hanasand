import fs from 'node:fs/promises'
import { createArtifact, createEvent } from '../store.ts'
import { serializeWorkerEvent } from '../protocol.ts'
import type { OrchestratorAgentRole, WorkerInput } from '../types.ts'

async function main() {
    const [, , roleArg, runId, nodeId, inputPath] = process.argv
    const role = roleArg as OrchestratorAgentRole
    if (!role || !runId || !nodeId || !inputPath) {
        throw new Error('Usage: demoWorker.ts <role> <runId> <nodeId> <inputPath>')
    }

    const input = JSON.parse(await fs.readFile(inputPath, 'utf8')) as WorkerInput
    emit(createEvent({
        runId,
        nodeId,
        role,
        type: 'worker_started',
        summary: `${capitalize(role)} worker started`,
        detail: `Task: ${input.task}`,
    }))

    emit(createEvent({
        runId,
        nodeId,
        role,
        type: 'status_update',
        summary: role === 'implementation' ? 'Thinking through the requested change set' : `Preparing ${role} branch`,
        detail: `Packed context includes ${input.packedContext.included.length} segments using ${input.packedContext.usedTokens} tokens.`,
    }))

    const blockedForRole = input.scenario?.expectedBlockedRoles?.includes(role) || false
    const contradictionMode = input.scenario?.contradictionMode || false
    const tension = input.scenario?.tension || 'baseline'

    if (role === 'implementation') {
        emit(createEvent({
            runId,
            nodeId,
            role,
            type: 'artifact_produced',
            state: 'completed',
            summary: 'Prepared implementation plan artifact',
            artifacts: [
                createArtifact({
                    label: 'implementation-plan.md',
                    kind: 'text',
                    content: `# Implementation plan\n\n- Task: ${input.task}\n- Branch: ${input.branchKey}\n- Scenario tension: ${tension}\n- Recommended stance: ${contradictionMode ? 'ship the narrow fix after lightweight verification' : 'proceed with the scoped change'}\n- Selected context:\n${input.packedContext.included.map((segment) => `  - ${segment.label}: ${segment.reason}`).join('\n')}\n\n- Omitted context count: ${input.packedContext.omitted.length}${input.packedContext.omitted.length ? '\n- Follow-up: implementation branch should call out anything dropped from the pack before claiming confidence.' : ''}`,
                }),
            ],
        }))
    } else if (role === 'builder') {
        if (blockedForRole) {
            emit(createEvent({
                runId,
                nodeId,
                role,
                type: 'status_update',
                state: 'blocked',
                summary: 'Builder branch hit a partial failure',
                detail: 'Verification exposed a dependency/runtime issue that needs manual follow-up instead of a false green summary.',
                artifacts: [
                    createArtifact({
                        label: 'builder-failure.log',
                        kind: 'log',
                        content: [
                            'npm install',
                            'npm run build',
                            'docker compose up --build -d',
                            'ERROR: healthcheck never reached ready state',
                        ].join('\n'),
                    }),
                ],
            }))
        }

        emit(createEvent({
            runId,
            nodeId,
            role,
            type: 'artifact_produced',
            state: blockedForRole ? 'blocked' : 'completed',
            summary: blockedForRole ? 'Prepared blocked build-and-verify log' : 'Prepared build-and-verify command log',
            artifacts: [
                createArtifact({
                    label: 'builder-commands.log',
                    kind: 'log',
                    content: [
                        'npm install',
                        'npm run build',
                        'npm test',
                        'docker compose up --build -d',
                        blockedForRole ? 'manual follow-up required after partial failure' : 'healthcheck passed',
                    ].join('\n'),
                }),
            ],
        }))
    } else if (role === 'reviewer') {
        emit(createEvent({
            runId,
            nodeId,
            role,
            type: 'review_requested',
            state: 'completed',
            summary: 'Prepared reviewer summary',
            artifacts: [
                createArtifact({
                    label: 'review-summary.md',
                    kind: 'text',
                    content: `# Review summary\n\n- Risk posture: ${blockedForRole || contradictionMode ? 'medium' : 'low'}\n- Notes: ${contradictionMode ? 'review branch found disagreement between branches and recommends an explicit merge decision.' : blockedForRole ? 'review branch confirms the blocked builder result should pause shipping.' : 'review branch confirms the task is still aligned with the requested outcome.'}\n- Context pack size: ${input.packedContext.usedTokens} tokens\n- Omitted segments: ${input.packedContext.omitted.length}`,
                }),
            ],
        }))
    }

    emit(createEvent({
        runId,
        nodeId,
        role,
        type: 'worker_completed',
        state: 'completed',
        summary: `${capitalize(role)} worker completed`,
        detail: 'Structured upstream reporting emitted successfully.',
    }))
}

function emit(event: ReturnType<typeof createEvent>) {
    process.stdout.write(`${serializeWorkerEvent(event)}\n`)
}

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Worker failed')
    process.exit(1)
})
