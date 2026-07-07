import assert from 'node:assert/strict'
import { normalizeStages, normalizeTimeout } from '../src/handlers/test/post.ts'

const baseline = [{ duration: '30s', target: 1 }]
const ramp = [{ duration: '30s', target: 5 }, { duration: '1m', target: 20 }, { duration: '30s', target: 0 }]
const spike = [{ duration: '15s', target: 5 }, { duration: '20s', target: 40 }, { duration: '25s', target: 0 }]

assert.equal(normalizeTimeout(30000), 30)
assert.equal(normalizeTimeout(45000), 45)
assert.equal(normalizeTimeout(60000), 60)
assert.deepEqual(normalizeStages(baseline), baseline)
assert.deepEqual(normalizeStages(ramp), ramp)
assert.deepEqual(normalizeStages(spike), spike)
assert.deepEqual(normalizeStages([{ duration: '30 seconds', target: 999 }]), baseline)

console.log('load-test queue shape smoke passed')
