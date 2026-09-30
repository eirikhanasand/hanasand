import { describe, expect, test } from 'bun:test'
import { isLogProcessorHealthy, maxActiveLogPassMs } from '../src/utils/events/processorHealth.ts'

describe('log processor health', () => {
    test('keeps a current tick healthy and ages it out', () => {
        const input = { shuttingDown: false, lastSuccessfulTickAt: 90_000, processingStartedAt: null, consecutiveFailures: 0 }
        expect(isLogProcessorHealthy(input, 100_000)).toBe(true)
        expect(isLogProcessorHealthy(input, 220_001)).toBe(false)
    })

    test('counts an active backlog pass as healthy until it stalls', () => {
        const input = { shuttingDown: false, lastSuccessfulTickAt: null, processingStartedAt: 100_000, consecutiveFailures: 0 }
        expect(isLogProcessorHealthy(input, 100_000 + maxActiveLogPassMs - 1)).toBe(true)
        expect(isLogProcessorHealthy(input, 100_000 + maxActiveLogPassMs + 1)).toBe(false)
    })

    test('fails readiness during shutdown or after repeated processing failures', () => {
        const base = { shuttingDown: false, lastSuccessfulTickAt: 100_000, processingStartedAt: 100_000, consecutiveFailures: 0 }
        expect(isLogProcessorHealthy({ ...base, shuttingDown: true }, 100_001)).toBe(false)
        expect(isLogProcessorHealthy({ ...base, consecutiveFailures: 10 }, 100_001)).toBe(false)
    })
})
