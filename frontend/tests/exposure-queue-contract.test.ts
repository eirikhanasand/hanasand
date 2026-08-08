import assert from 'node:assert/strict'
import { normalizeExposureQueue } from '../src/app/exposureQueue'

const queue = normalizeExposureQueue({
    status: 'live',
    items: [
        { id: 'capture-1', actor: 'Actor One', company: 'Company One' },
        { id: 'capture-2', company: 'Company Two' },
        { company: 'Company Three' },
    ],
})

assert.deepEqual(queue.items.map(item => item.id), ['capture-1'])
assert.equal(queue.items[0]?.status, 'unverified')
