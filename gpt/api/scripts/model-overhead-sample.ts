import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const latestPath = path.join(scriptDir, '..', 'runtime', 'model-overhead', 'latest.json')

type LatestSample = {
    recordedAt?: string
    conversationId?: string
    stages?: {
        totalMs?: number
    }
    loop?: {
        completionCalls?: number
        completionMs?: number
        toolCalls?: number
        toolMs?: number
    }
    derived?: {
        nextOptimizationTarget?: string
        nextOptimizationReason?: string
    }
}

const latest = JSON.parse(await readFile(latestPath, 'utf8')) as LatestSample

console.log(JSON.stringify({
    ok: true,
    latestPath,
    recordedAt: latest.recordedAt || null,
    conversationId: latest.conversationId || null,
    totalMs: latest.stages?.totalMs || null,
    completionCalls: latest.loop?.completionCalls || 0,
    completionMs: latest.loop?.completionMs || 0,
    toolCalls: latest.loop?.toolCalls || 0,
    toolMs: latest.loop?.toolMs || 0,
    nextOptimizationTarget: latest.derived?.nextOptimizationTarget || null,
    nextOptimizationReason: latest.derived?.nextOptimizationReason || null,
}, null, 2))
