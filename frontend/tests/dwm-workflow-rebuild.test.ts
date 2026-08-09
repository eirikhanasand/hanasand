// @ts-expect-error Bun provides this module when running focused tests.
import { test, expect } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { normalizeAlertRebuildOutcome } from '../src/utils/dwm/alertRebuildOutcome'

test('inline alert rebuild reports only durable outcomes as success', () => {
    expect(normalizeAlertRebuildOutcome({ status: 'failed', error: { message: 'backend failed' }, savedAlertCount: 0 }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'completed', savedAlertCount: 0, alertIds: [] }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'queued', savedAlertCount: 0 }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ ok: true, savedAlertCount: 0, alertIds: [] }).ok).toBe(false)
    expect(normalizeAlertRebuildOutcome({ status: 'completed', savedAlertCount: 1, alertIds: ['alert_1'], tenantId: 'tenant_1', organizationId: 'org_1' })).toMatchObject({ ok: true, tenantId: 'tenant_1', organizationId: 'org_1' })
})

test('without inline outcome, the helper keeps the scoped rebuild POST path', async () => {
    const source = await readFile(new URL('../src/app/dashboard/dwm/dwm-workflow-actions.tsx', import.meta.url), 'utf8')
    expect(source).toContain('return normalizeAlertRebuildOutcome(await postJson(\'/api/dwm/alerts/rebuild\', scope))')
    expect(source).toContain('const rebuildOutcome = normalizeAlertRebuildOutcome(rebuild)')
    expect(source).toContain('if (!caseId) throw new Error(\'No durable case was returned.\')')
    expect(source).toContain('ok: !failed && !dryRun')
    const caseDetail = await readFile(new URL('../src/app/dashboard/dwm/cases/[id]/case-detail-client.tsx', import.meta.url), 'utf8')
    expect(caseDetail).toContain('if (!payload.case || typeof payload.case.id !== \'string\') throw new Error(\'No durable case update was returned.\')')
    expect(caseDetail).toContain('if (!payload.receipt || typeof payload.receipt.id !== \'string\') throw new Error(\'No durable notification record was returned.\')')
    expect(source).toContain('if (!requestId || (!sourceId && !duplicateOf)) throw new Error(\'No durable source request was returned.\')')
})
