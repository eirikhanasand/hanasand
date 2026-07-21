import assert from 'node:assert/strict'
import { evidenceTimestamp } from '../src/utils/ti/search'

assert.equal(evidenceTimestamp('2026-02-12T00:00:00.000Z'), '2026-02-12T00:00:00.000Z')
assert.equal(evidenceTimestamp(undefined, '2025-09-02'), '2025-09-02')
assert.equal(evidenceTimestamp(undefined, ''), 'Observation date unavailable')
