import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'

test('DWM marks only durable webhook delivery as success', async () => {
    const root = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')
    const source = await readFile(path.join(root, 'src/app/dashboard/dwm/dwm-analyst-portal.tsx'), 'utf8')

    assert.match(source, /state: latestDelivery\?\.status === 'delivered' \? 'ready'/)
    assert.match(source, /const lastSuccessfulDelivery = visible\.find\(delivery => delivery\.status === 'delivered'\)/)
    assert.doesNotMatch(source, /latestDelivery\?\.status === 'delivered' \|\| latestDelivery\?\.status === 'dry_run'/)
    assert.doesNotMatch(source, /lastSuccessfulDelivery = visible\.find\(delivery => delivery\.status === 'delivered' \|\| delivery\.status === 'dry_run'/)
})
