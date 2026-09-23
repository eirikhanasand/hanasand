import { parentPort, workerData } from 'node:worker_threads'
import { matchesMillRule } from './conditions.ts'
parentPort?.postMessage(workerData.events.map((event: Record<string, unknown>, index: number) => matchesMillRule(event, workerData.conditions) ? index : -1).filter((index: number) => index >= 0))
