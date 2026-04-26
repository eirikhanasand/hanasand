import path from 'node:path'
import { fileURLToPath } from 'node:url'

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
const API_ROOT = path.resolve(THIS_DIR, '../../..')

export function getOrchestrationRoot() {
    return path.join(API_ROOT, 'runtime', 'orchestration')
}

export function getRunDirectory(runId: string) {
    return path.join(getOrchestrationRoot(), runId)
}

export function getRunPath(runId: string) {
    return path.join(getRunDirectory(runId), 'run.json')
}

export function getReplayPath(runId: string) {
    return path.join(getRunDirectory(runId), 'replay.md')
}

export function getEvaluationPath(runId: string) {
    return path.join(getRunDirectory(runId), 'evaluation.json')
}
