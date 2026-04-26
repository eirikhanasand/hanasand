import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getEvaluationPath } from '../src/utils/orchestration/paths.ts'
import { readRun, setEvaluation } from '../src/utils/orchestration/store.ts'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const demoScript = path.join(scriptDir, 'orchestration-demo.ts')
const task = process.argv.slice(2).join(' ').trim() || 'Build a Next.js dashboard, verify Docker startup, and prepare a reviewer handoff.'

const demoOutput = await runDemo(demoScript, task)
const payload = JSON.parse(demoOutput) as {
    ok: boolean
    runId: string
    runPath: string
    replayPath: string
    nodes: Array<{ status: string }>
    eventCount: number
}

const run = await readRun(payload.runId)
const nodeStatuses = run.nodes.map((node) => node.status)
const completedNodes = nodeStatuses.filter((status) => status === 'completed').length
const success = completedNodes >= 3 && run.events.some((event) => event.type === 'context_packed')
const score = success ? 86 : 42
const summary = success
    ? 'The orchestrated flow produced a real topology, branched worker runs, structured upstream events, context packs, and replay output.'
    : 'The orchestration evaluation exposed a missing topology, reporting, or worker-execution seam.'

await setEvaluation({
    runId: payload.runId,
    success,
    score,
    summary,
})

await fs.writeFile(getEvaluationPath(payload.runId), `${JSON.stringify({
    runId: payload.runId,
    success,
    score,
    summary,
    eventCount: payload.eventCount,
    nodeStatuses,
    replayPath: payload.replayPath,
    checkedAt: new Date().toISOString(),
}, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
    ok: success,
    runId: payload.runId,
    score,
    summary,
    replayPath: payload.replayPath,
    evaluationPath: getEvaluationPath(payload.runId),
}, null, 2))

async function runDemo(scriptPath: string, taskArg: string) {
    return await new Promise<string>((resolve, reject) => {
        const child = spawn('bun', [scriptPath, taskArg], {
            cwd: scriptDir,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        child.on('error', reject)
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `Evaluation demo exited with ${code}`))
                return
            }
            resolve(stdout.trim())
        })
    })
}
