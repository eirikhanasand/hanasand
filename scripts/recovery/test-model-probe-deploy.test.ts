import { describe, expect, test } from 'bun:test'
import { modelLanesIdle } from './deploy-model-probe-client.ts'

describe('model client drain guard', () => {
    const idleMetrics = 'vllm:num_requests_running{model_name="hanasand"} 0.0\nvllm:num_requests_waiting{model_name="hanasand"} 0.0\n'

    test('requires running and waiting counts to be zero on every lane', () => {
        expect(modelLanesIdle(() => idleMetrics)).toBe(true)
        for (const metric of ['running', 'waiting']) {
            const busy = idleMetrics.replace(`${metric}{model_name="hanasand"} 0.0`, `${metric}{model_name="hanasand"} 1.0`)
            expect(modelLanesIdle(port => port === 18081 ? busy : idleMetrics)).toBe(false)
        }
    })

    test('rejects missing, nonnumeric, or unavailable lane metrics', () => {
        expect(modelLanesIdle(() => '')).toBe(false)
        expect(modelLanesIdle(() => idleMetrics.replaceAll('0.0', 'NaN'))).toBe(false)
        expect(modelLanesIdle(() => idleMetrics.replaceAll('0.0', 'invalid'))).toBe(false)
        expect(modelLanesIdle(() => { throw new Error('offline') })).toBe(false)
    })
})
