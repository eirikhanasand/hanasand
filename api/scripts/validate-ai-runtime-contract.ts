import assert from 'node:assert/strict'
import { buildAiRuntimeState } from '../src/handlers/ai/runtime.ts'

const now = '2026-04-24T22:30:00.000Z'

const healthyConversation: AIConversation = {
    id: 'conv_healthy',
    title: 'Healthy workspace',
    preferredModel: 'fast-model',
    activeModel: 'fast-model',
    modelStrategy: 'auto',
    workspaceId: 'share_healthy',
    workspaceKind: 'repo',
    shareIds: ['share_healthy'],
    workspaceMeta: {
        selectedFilePath: 'src/app/page.tsx',
    },
    messages: [
        {
            id: 'tool_healthy',
            role: 'tool',
            content: 'Read src/app/page.tsx',
            createdAt: now,
            metadata: {
                tool: 'read_share',
                toolState: 'completed',
            },
        },
    ],
    metrics: {
        conversationId: 'conv_healthy',
        status: 'idle',
        currentTokens: 0,
        maxTokens: 8192,
        promptTokens: 0,
        generatedTokens: 0,
        contextTokens: 0,
        contextMaxTokens: 32768,
        tps: 42,
        lastUpdated: now,
        lastError: null,
    },
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
}

const healthyRuntime = buildAiRuntimeState({
    conversations: [healthyConversation],
    clients: [
        {
            name: 'fast-model',
            ram: [],
            cpu: [],
            gpu: [],
            model: {
                conversationId: 'conv_healthy',
                status: 'idle',
                currentTokens: 0,
                maxTokens: 8192,
                promptTokens: 0,
                generatedTokens: 0,
                contextTokens: 0,
                contextMaxTokens: 32768,
                tps: 42,
                lastUpdated: now,
                lastError: null,
            },
        },
    ],
})

assert.equal(healthyRuntime.status, 'idle')
assert.equal(healthyRuntime.connectedClientCount, 1)
assert.deepEqual(healthyRuntime.connectedModelNames, ['fast-model'])
assert.equal(healthyRuntime.activeConversationId, 'conv_healthy')
assert.equal(healthyRuntime.activeWorkspace.workspaceId, 'share_healthy')
assert.equal(healthyRuntime.lastToolRun?.label, 'read_share')
assert.equal(healthyRuntime.lastToolRun?.state, 'completed')
assert.equal(healthyRuntime.lastFailure, null)

const failingRuntime = buildAiRuntimeState({
    conversations: [
        {
            ...healthyConversation,
            id: 'conv_failure',
            title: 'Broken workspace',
            updatedAt: '2026-04-24T22:31:00.000Z',
            messages: [
                {
                    id: 'tool_failure',
                    role: 'tool',
                    content: 'Terminal command failed with exit code 1',
                    createdAt: '2026-04-24T22:31:00.000Z',
                    error: true,
                    metadata: {
                        tool: 'run_terminal_command',
                        toolState: 'error',
                    },
                },
            ],
        },
    ],
    clients: [],
})

assert.equal(failingRuntime.status, 'error')
assert.equal(failingRuntime.connectedClientCount, 0)
assert.equal(failingRuntime.lastToolRun?.label, 'run_terminal_command')
assert.equal(failingRuntime.lastToolRun?.state, 'error')
assert.equal(failingRuntime.lastFailure?.source, 'tool')
assert.equal(failingRuntime.lastFailure?.message, 'Terminal command failed with exit code 1')
assert.equal(failingRuntime.activeConversationId, 'conv_failure')

console.log('AI runtime contract validation passed for healthy and failing states.')
