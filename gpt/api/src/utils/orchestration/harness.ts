import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { appendEvent, updateNodeStatus } from './store.ts'
import { parseWorkerEventLine } from './protocol.ts'
import { getRunDirectory } from './paths.ts'
import type { OrchestrationEvent, OrchestrationNode, WorkerInput, WorkerResult } from './types.ts'

export async function runWorker({
    runId,
    node,
    wrapperPath,
    input,
}: {
    runId: string
    node: OrchestrationNode
    wrapperPath: string
    input: WorkerInput
}) {
    await updateNodeStatus({ runId, nodeId: node.id, status: 'running' })

    const inputPath = path.join(getRunDirectory(runId), `${node.id}.input.json`)
    await fs.writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8')

    return await new Promise<WorkerResult>((resolve, reject) => {
        const child = spawn('/bin/sh', [wrapperPath, node.role, runId, node.id, inputPath], {
            cwd: path.dirname(wrapperPath),
            env: {
                ...process.env,
                HANASAND_RUN_ID: runId,
                HANASAND_NODE_ID: node.id,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        const events: OrchestrationEvent[] = []
        let stdout = ''
        let stderr = ''
        let stdoutBuffer = ''

        child.stdout.on('data', (chunk) => {
            const text = chunk.toString()
            stdout += text
            stdoutBuffer += text
            const lines = stdoutBuffer.split('\n')
            stdoutBuffer = lines.pop() || ''

            for (const line of lines) {
                const event = parseWorkerEventLine(line.trim())
                if (!event) {
                    continue
                }
                events.push(event)
            }
        })

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })

        child.on('error', async (error) => {
            await updateNodeStatus({
                runId,
                nodeId: node.id,
                status: 'error',
                summary: error.message,
            })
            reject(error)
        })

        child.on('close', async (code) => {
            const exitCode = code ?? 1
            const terminalStatus = exitCode === 0
                ? events.some((event) => event.state === 'blocked') ? 'blocked' : 'completed'
                : 'error'

            for (const event of events) {
                await appendEvent(runId, event)
            }

            await updateNodeStatus({
                runId,
                nodeId: node.id,
                status: terminalStatus,
                summary: events.at(-1)?.summary || null,
            })

            resolve({
                exitCode,
                events,
                stdout,
                stderr,
            })
        })
    })
}
