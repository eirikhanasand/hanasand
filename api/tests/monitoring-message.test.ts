import { expect, test } from 'bun:test'
import { readableMonitoringMessage } from '../src/utils/monitoringMessage.ts'
import { monitoringCaseResolution } from '../src/utils/monitoringCaseWorkflow.ts'

const recovery = 'JSON check passed: ok = true; alert ne true (first).'
test('existing JSON recovery notes read naturally without changing stored evidence', () => {
    const resolution = { type: 'automation', note: recovery, id: 'run-one' }
    expect(monitoringCaseResolution({ resolution })).toEqual({ ...resolution, note: 'The service reports that it is healthy.' })
    expect(resolution.note).toBe(recovery)
    expect(monitoringCaseResolution({ resolution: { ...resolution, type: 'human' } })?.note).toBe(recovery)
    expect(monitoringCaseResolution({ resolution: { ...resolution, type: 'ai' } })?.note).toBe(recovery)
})
test('unhealthy and inverted results never become a healthy success', () => {
    expect(readableMonitoringMessage('JSON threshold exceeded: ok = false; alert ne true (first).')).toBe('The check failed. The service reports that it is unhealthy.')
    expect(readableMonitoringMessage('JSON threshold exceeded: ok = true; alert ne true (first).')).toBe('The check failed. The service reports that it is healthy.')
    expect(readableMonitoringMessage('JSON check passed: ok = false; alert ne true (first).')).toContain('The check passed.')
})
test('field readings keep their value, aggregation and outcome', () => {
    for (const [aggregate, label] of [['max', 'highest'], ['min', 'lowest'], ['avg', 'average'], ['first', 'first']]) {
        expect(readableMonitoringMessage(`JSON threshold exceeded: samples.*.temperature = 81.25; alert gt 80 (${aggregate}).`)).toBe(`The check failed. The ${label} value reported for "samples.*.temperature" was 81.25.`)
    }
    expect(readableMonitoringMessage('JSON check passed: status = ready; alert ne ready (first).')).toBe('The check passed. The value reported for "status" was ready.')
})
test('HTTP errors retain the status code and unrelated messages stay untouched', () => {
    expect(readableMonitoringMessage('JSON source returned HTTP 503.')).toBe('The health endpoint was unavailable and returned HTTP 503.')
    expect(readableMonitoringMessage('JSON source returned HTTP 401.')).toBe('The health endpoint returned HTTP 401.')
    for (const message of ['ETIMEDOUT', 'RAM usage is normal: 8% used (alert at 80%).', 'A person wrote JSON check passed in a comment.']) expect(readableMonitoringMessage(message)).toBe(message)
})
