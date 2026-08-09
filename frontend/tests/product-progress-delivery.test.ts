import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { isDurableDelivered } from '../src/utils/productProgress/readiness.ts'

test('only durable delivered rows count as product-progress delivery evidence', () => {
    assert.equal(isDurableDelivered('delivered'), true)
    for (const status of ['dry_run', 'queued', 'running', 'failed', 'skipped', 'unknown', undefined, null]) {
        assert.equal(isDurableDelivered(status), false, status ?? 'missing')
    }
})
