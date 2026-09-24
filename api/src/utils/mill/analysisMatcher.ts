import { Worker } from 'node:worker_threads'
import { matchesMillRule, type MillCondition } from './conditions.ts'

let worker: Worker | undefined
let tail = Promise.resolve()
let pending = 0

// Reuse the isolated evaluator for live ingestion. Queue bounds and per-request
// termination keep untrusted expressions from blocking the API or exhausting it.
export function matchAnalysisEvents(events: Record<string, unknown>[], conditions: MillCondition[]): Promise<number[]> {
    if (!conditions.some(condition => condition.operator === 'regex'))
        return Promise.resolve(events.flatMap((event, index) => matchesMillRule(event, conditions) ? [index] : []))
    if (pending >= 128) return Promise.reject(new Error('Analysis expression queue is full; retry this batch.'))
    pending++
    const result = tail.then(() => new Promise<number[]>((resolve, reject) => {
        if (!worker) {
            const created = new Worker(new URL('./rulePreviewWorker.ts', import.meta.url), { workerData: { reusable: true } })
            const resetIdle = () => { if (worker === created) worker = undefined }
            created.on('error', resetIdle).on('exit', resetIdle)
            worker = created
        }
        const current = worker
        const reset = () => { if (worker === current) worker = undefined }
        const cleanup = () => {
            clearTimeout(timer)
            current.off('message', success).off('error', failure).off('exit', exited)
            current.unref()
        }
        const success = (indices: number[]) => { cleanup(); resolve(indices) }
        const failure = (error: Error) => { cleanup(); reset(); void current.terminate(); reject(error) }
        const exited = () => failure(new Error('Analysis expression worker stopped; retry this batch.'))
        const timer = setTimeout(() => failure(new Error('Analysis expression exceeded its time limit; retain this batch.')), 1500)
        current.ref()
        current.once('message', success).once('error', failure).once('exit', exited)
        try { current.postMessage({ events, conditions }) } catch (error) { failure(error as Error) }
    }))
    tail = result.then(() => { pending-- }, () => { pending-- })
    return result
}
