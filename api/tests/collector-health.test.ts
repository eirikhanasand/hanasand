import { describe, expect, it } from 'bun:test'
import { collectorHeartbeatStatus, type CollectorHeartbeat } from '../src/utils/status/collectorHealth.ts'

const now = Date.parse('2026-09-29T17:00:00Z')
const healthy = (overrides: Partial<CollectorHeartbeat> = {}): CollectorHeartbeat => ({
    created_at: new Date(now - 30_000),
    message: 'Collection healthy',
    metadata: { source_status: { audit_live: { ok: true }, delivery_live: { ok: true } } },
    ...overrides,
})

describe('collector heartbeat health', () => {
    it('accepts a recent heartbeat with working audit and delivery workers', () => {
        expect(collectorHeartbeatStatus(healthy(), now).status).toBe('up')
    })

    it('reports missing and stale heartbeats as down', () => {
        expect(collectorHeartbeatStatus(null, now).status).toBe('down')
        expect(collectorHeartbeatStatus(healthy({ created_at: new Date(now - 91_000) }), now).message).toContain('90 seconds')
    })

    it('reports failed audit and delivery workers as down', () => {
        expect(collectorHeartbeatStatus(healthy({ metadata: { source_status: { audit_live: { ok: false }, delivery_live: { ok: true } } } }), now).message).toContain('audit log')
        expect(collectorHeartbeatStatus(healthy({ metadata: { source_status: { audit_live: { ok: true }, delivery_live: { ok: false } } } }), now).message).toContain('cannot send')
    })

    it('reports collection errors without exposing collector details in the case message', () => {
        expect(collectorHeartbeatStatus(healthy({ message: 'Collection failed: guests: private host detail' }), now)).toEqual({
            status: 'down', message: 'The host log collector reported a collection failure.',
        })
    })
})
