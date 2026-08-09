// @ts-expect-error Bun provides this module when running focused tests.
import { test, expect } from 'bun:test'
import { normalizeAlertRebuildOutcome } from '../src/utils/dwm/alertRebuildOutcome'

test('inline alert rebuild reports only durable outcomes as success', () => {
    expect(normalizeAlertRebuildOutcome({ status: 'failed', error: { message: 'backend failed' }, savedAlertCount: 0 }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'completed', savedAlertCount: 0, alertIds: [] }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'queued', savedAlertCount: 0 }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'completed', savedAlertCount: 1, alertIds: ['alert_1'], tenantId: 'tenant_1', organizationId: 'org_1' })).toMatchObject({ ok: true, tenantId: 'tenant_1', organizationId: 'org_1' })
})
