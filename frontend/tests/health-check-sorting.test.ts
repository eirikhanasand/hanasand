import { test } from 'node:test'
import assert from 'node:assert/strict'
import { healthCheckCertificate, healthCheckStatus, healthCheckTag, sortHealthChecks, type HealthSortKey } from '../src/app/dashboard/automation/healthCheckSorting'
import type { AgentAutomation } from '../src/utils/automations/client'

const monitor = (name: string, overrides: Partial<AgentAutomation> = {}) => ({ id: name, name, targetUrl: 'https://example.test', actionType: 'agent_prompt', status: 'active', monitoringType: 'fetch', lastStatus: 'completed', consecutiveFailures: 0, ...overrides } as AgentAutomation)
const names = (rows: AgentAutomation[], key: HealthSortKey, direction: 'asc' | 'desc') => sortHealthChecks(rows, key, direction).map(row => row.name)

test('all six columns sort both directions, with alphabetical ties', () => {
    const rows = [monitor('Zulu', { lastStatus: 'failed', certificateStatus: 'valid', uptime: 90, history: [{ id: 'z', status: 'failed', warning: false, started_at: '' }] }), monitor('Beta', { certificateStatus: 'invalid', uptime: 100, history: [{ id: 'b', status: 'completed', warning: false, started_at: '' }] }), monitor('Alpha', { certificateStatus: 'invalid', uptime: 100, history: [{ id: 'a', status: 'completed', warning: false, started_at: '' }] })]
    assert.deepEqual(names(rows, 'name', 'asc'), ['Alpha', 'Beta', 'Zulu'])
    assert.deepEqual(names(rows, 'name', 'desc'), ['Zulu', 'Beta', 'Alpha'])
    for (const key of ['status', 'cert', 'history'] as const) {
        assert.deepEqual(names(rows, key, 'asc'), ['Alpha', 'Beta', 'Zulu'])
        assert.deepEqual(names(rows, key, 'desc'), ['Zulu', 'Alpha', 'Beta'])
    }
    assert.deepEqual(names(rows, 'uptime', 'asc'), ['Zulu', 'Alpha', 'Beta'])
    assert.deepEqual(names(rows, 'uptime', 'desc'), ['Alpha', 'Beta', 'Zulu'])
    const tags = [monitor('Zed', { actionType: 'echo' }), monitor('Beta', { actionType: 'system_alert' }), monitor('Alpha', { actionType: 'system_alert' }), monitor('Untagged')]
    assert.deepEqual(names(tags, 'tags', 'asc'), ['Zed', 'Alpha', 'Beta', 'Untagged'])
    assert.deepEqual(names(tags, 'tags', 'desc'), ['Alpha', 'Beta', 'Zed', 'Untagged'])
    assert.deepEqual(rows.map(row => row.name), ['Zulu', 'Beta', 'Alpha'])
})

test('unknown uptime and history stay last, without treating zero as missing', () => {
    const rows = [monitor('Missing'), monitor('Zero', { uptime: 0, history: [{ id: '0', status: 'completed', warning: false, started_at: '' }] }), monitor('Warning', { uptime: 90, history: [{ id: '1', status: 'completed', warning: true, started_at: '' }] })]
    for (const key of ['uptime', 'history'] as const) {
        assert.deepEqual(names(rows, key, 'asc'), ['Zero', 'Warning', 'Missing'])
        assert.deepEqual(names(rows, key, 'desc'), ['Warning', 'Zero', 'Missing'])
    }
})

test('sorting uses the same visible status, certificate and tag labels', () => {
    assert.equal(healthCheckStatus(monitor('JSON', { monitoringType: 'json', lastStatus: 'failed' })), 'Unhealthy')
    assert.equal(healthCheckStatus(monitor('HTTP', { consecutiveFailures: 1 })), 'Unhealthy')
    assert.equal(healthCheckTag(monitor('Host')), '')
    assert.equal(healthCheckCertificate(monitor('Host', { targetUrl: 'system:metrics', certificateStatus: 'valid' })).label, 'N/A')
    assert.equal(healthCheckCertificate(monitor('TCP', { targetUrl: 'example.test:443', monitoringType: 'tcp', certificateStatus: 'valid' })).label, 'Valid')
    assert.equal(healthCheckCertificate(monitor('Pending', { certificateStatus: 'not_applicable' })).label, 'Pending')
})
