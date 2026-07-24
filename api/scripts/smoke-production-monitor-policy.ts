import assert from 'node:assert/strict'
import { activityCountDrop, latencyStatus, notificationEvent } from '../src/utils/status/monitorPolicy.ts'

assert.equal(latencyStatus(2_999, { degraded: 3_000, down: 10_000 }), 'up')
assert.equal(latencyStatus(3_000, { degraded: 3_000, down: 10_000 }), 'degraded')
assert.equal(latencyStatus(10_000, { degraded: 3_000, down: 10_000 }), 'down')

assert.equal(notificationEvent('down', ['up', 'up']), undefined)
assert.equal(notificationEvent('down', []), undefined)
assert.equal(notificationEvent('down', ['down', 'up']), 'alert')
assert.equal(notificationEvent('down', ['down', 'down']), undefined)
assert.equal(notificationEvent('up', ['down', 'up', 'up']), undefined)
assert.equal(notificationEvent('up', ['up', 'down']), undefined)
assert.equal(notificationEvent('up', ['up', 'down', 'down']), 'recovered')

const possibleDrop = activityCountDrop(2_000, { status: 'up', message: 'Latest customer activity returned 5,000 retained records.' })
assert.deepEqual(possibleDrop, { status: 'down', message: '2000 retained records; possible drop from 5000.' })
const confirmedDrop = activityCountDrop(2_000, { status: 'down', message: possibleDrop?.message })
assert.deepEqual(confirmedDrop, { status: 'down', message: '2000 retained records; confirmed drop from 5000.' })
assert.equal(activityCountDrop(2_000, { status: 'down', message: confirmedDrop?.message }), undefined)

console.log('production monitor policy smoke passed')
