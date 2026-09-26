import { parentPort, workerData } from 'node:worker_threads'
import { matchesRule, type Condition } from './conditions.ts'
const evaluate = (input: { events: Record<string, unknown>[], conditions: Condition[] }) =>
    parentPort?.postMessage(input.events.flatMap((event, index) => matchesRule(event, input.conditions) ? [index] : []))
if (workerData.reusable) parentPort?.on('message', evaluate)
else evaluate(workerData)
