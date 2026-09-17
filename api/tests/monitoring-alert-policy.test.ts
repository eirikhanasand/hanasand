import { expect, test } from 'bun:test'
import { monitoringAlertReady } from '../src/utils/monitoringAlertPolicy.ts'

const history = (...entries: Array<[number, 'failure' | 'warning' | 'healthy']>) => entries.map(([seconds, kind]) => ({
    status: kind === 'failure' ? 'failed' : 'completed', warning: kind === 'warning',
    completed_at: new Date(seconds * 1000),
}))

test('all check failures wait at least a minute and require a fresh failure', () => {
    expect(monitoringAlertReady(history([0, 'failure']), 'failure')).toBe(false)
    expect(monitoringAlertReady(history([59, 'failure'], [0, 'failure']), 'failure')).toBe(false)
    expect(monitoringAlertReady(history([60, 'failure'], [0, 'failure']), 'failure')).toBe(true)
    expect(monitoringAlertReady(history([60, 'healthy'], [0, 'failure']), 'failure')).toBe(false)
})

test('alternating failures alert but two healthy checks reset the grace period', () => {
    expect(monitoringAlertReady(history([120, 'failure'], [60, 'healthy'], [0, 'failure']), 'failure')).toBe(true)
    expect(monitoringAlertReady(history([180, 'failure'], [120, 'healthy'], [60, 'healthy'], [0, 'failure']), 'failure')).toBe(false)
    expect(monitoringAlertReady(history([240, 'failure'], [180, 'failure'], [120, 'healthy'], [60, 'healthy'], [0, 'failure']), 'failure')).toBe(true)
})

test('warnings get the same grace period without advancing the failure timer', () => {
    expect(monitoringAlertReady(history([60, 'warning'], [0, 'warning']), 'warning')).toBe(true)
    expect(monitoringAlertReady(history([59, 'warning'], [0, 'warning']), 'warning')).toBe(false)
    expect(monitoringAlertReady(history([60, 'failure'], [0, 'warning']), 'failure')).toBe(false)
})
