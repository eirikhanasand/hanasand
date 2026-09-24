import { parentPort, workerData } from 'node:worker_threads'
import { matchesMillRule, type MillCondition } from './conditions.ts'
const evaluate = (input: { events: Record<string, unknown>[], conditions: MillCondition[] }) =>
    parentPort?.postMessage(input.events.flatMap((event, index) => matchesMillRule(event, input.conditions) ? [index] : []))
if (workerData.reusable) parentPort?.on('message', evaluate)
else evaluate(workerData)
