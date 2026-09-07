import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateStatusFeed, checkStatusFeed } from './status-feed.mjs'
const now = Date.now()
const at = new Date(now).toISOString()
const healthy = { monitoring: 'live', last_verified_at: at, history_available: true, history_generated_at: at,
    checks: ['API Health', 'Public Website', 'Public Search', 'Processing Backlog', 'Source Collection', 'Browser Workspace', 'Monitoring Workspace', 'Latest Activity'].map(check_name => ({ check_name, status: 'up', checked_at: at })) }
test('feed alert distinguishes service failure from monitoring failure', () => {
    assert.equal(evaluateStatusFeed(healthy, now), null)
    assert.equal(evaluateStatusFeed({ ...healthy, checks: healthy.checks.map(row => ({ ...row, status: 'down' })) }, now), null)
    for (const value of [null, {}, { checks: [] }, { ...healthy, monitoring: 'unavailable' }, { ...healthy, checks: healthy.checks.slice(1) }, { ...healthy, history_available: false }]) assert.ok(evaluateStatusFeed(value, now))
    assert.ok(evaluateStatusFeed(healthy, now + 6 * 60_000))
})
test('HTTP failures and malformed responses trigger the independent monitor', async () => {
    for (const fetcher of [async () => { throw Error('network failure') }, async () => new Response('bad', { status: 503 }), async () => new Response('not JSON'), async () => Response.json({ checks: [] })]) {
        assert.equal((await checkStatusFeed('https://example.test/api/status', fetcher)).ok, false)
    }
    assert.equal((await checkStatusFeed('https://example.test/api/status', async () => Response.json(healthy))).ok, true)
})
