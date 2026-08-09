import assert from 'node:assert/strict'
import { buildSourceProofReadinessFromProxy } from '../src/app/dashboard/operatorConsoleModel'

const readiness = buildSourceProofReadinessFromProxy({
    ok: true,
    baseConfigured: true,
    endpoints: { sourceInventory: { ok: true, status: 200 } },
    generatedAt: '2026-08-09T00:00:00.000Z',
    sourceInventory: {
        schemaVersion: 'dwm.source_inventory.v1',
        generatedAt: '2026-08-09T00:00:00.000Z',
        counts: { registeredTotal: 1000, registeredActiveOrCanary: 1000 },
    },
}, { route: '/api/ti/scraper/control', checkedAt: '2026-08-09T00:00:00.000Z' })

assert.notEqual(readiness.status, 'ready')
assert.equal(readiness.activeSourceCount, 1000)
assert.ok((readiness.blockers?.length ?? 0) > 0)
