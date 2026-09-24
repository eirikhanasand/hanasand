import { expect, test } from 'bun:test'
import { matchAnalysisEvents } from '../src/utils/mill/analysisMatcher.ts'

test('queued policy evaluations remain isolated and use current conditions', async () => {
    const results = await Promise.all(Array.from({ length: 40 }, (_, index) => matchAnalysisEvents([{ message: `event-${index}` }],
        [{ path: 'message', operator: 'regex', value: `^event-${index}$`, caseSensitive: true }])))
    expect(results.every(result => result.length === 1 && result[0] === 0)).toBe(true)
    expect(await matchAnalysisEvents([{ message: 'EVENT-1' }], [{ path: 'message', operator: 'regex', value: '^event-1$', caseSensitive: true }])).toEqual([])
    expect(await matchAnalysisEvents([{ message: 'EVENT-1' }], [{ path: 'message', operator: 'regex', value: '^event-1$' }])).toEqual([0])
})

test('a stalled expression is terminated and the following evaluation recovers', async () => {
    const stalled = matchAnalysisEvents(Array.from({ length: 40 }, () => ({ message: `${'a'.repeat(100)}!` })), [{ path: 'message', operator: 'regex', value: '^(a+)+$' }])
    const next = matchAnalysisEvents([{ message: 'healthy' }], [{ path: 'message', operator: 'regex', value: '^healthy$' }])
    await expect(stalled).rejects.toThrow('time limit')
    expect(await next).toEqual([0])
})

test('queue overload rejects without mixing or losing admitted evaluations', async () => {
    const results = await Promise.allSettled(Array.from({ length: 129 }, () => matchAnalysisEvents([{ message: 'ok' }],
        [{ path: 'message', operator: 'regex', value: '^ok$' }])))
    expect(results.slice(0, 128).every(result => result.status === 'fulfilled' && result.value[0] === 0)).toBe(true)
    expect(results[128].status).toBe('rejected')
})
