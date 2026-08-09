import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { exposureQueueFallback, normalizeExposureQueue } from '../src/app/exposureQueue'

assert.equal(exposureQueueFallback('unavailable', 10).generatedAt, '')
assert.equal(normalizeExposureQueue({ items: [] }).status, 'unavailable')
const [home, activity] = await Promise.all([
    readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/activity/page.tsx', import.meta.url), 'utf8'),
])
assert.match(home, /exposureQueueFallback\('unavailable', 10\)/)
assert.match(activity, /exposureQueueFallback\('unavailable', 50\)/)
