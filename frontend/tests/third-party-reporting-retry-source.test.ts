import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/app/organizations/organizationWorkspaceClient.tsx', import.meta.url), 'utf8')

test('organization history retries the exact persisted failed report', () => {
    const start = source.indexOf('const replayDelivery =')
    const end = source.indexOf('const createSavedDestination =', start)
    const retrySource = source.slice(start, end)

    assert.notEqual(start, -1)
    assert.match(retrySource, /organizationId: selectedOrganization\.id/)
    assert.match(retrySource, /deliveryId: delivery\.id/)
    assert.doesNotMatch(retrySource, /\b(?:alertId|caseId|dedupeKey|dryRun|replay):/)
})
