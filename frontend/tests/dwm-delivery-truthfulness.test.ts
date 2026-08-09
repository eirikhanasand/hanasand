import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'

test('DWM marks only durable webhook delivery as success', async () => {
    const root = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')
    const [portal, actions, workbench] = await Promise.all([
        readFile(path.join(root, 'src/app/dashboard/dwm/dwm-analyst-portal.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/dwm/dwm-workflow-actions.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/ti/workbench/workbenchClient.tsx'), 'utf8'),
    ])

    assert.match(portal, /state: latestDelivery\?\.status === 'delivered' \? 'ready'/)
    assert.match(portal, /const lastSuccessfulDelivery = visible\.find\(delivery => delivery\.status === 'delivered'\)/)
    assert.doesNotMatch(portal, /latestDelivery\?\.status === 'delivered' \|\| latestDelivery\?\.status === 'dry_run'/)
    assert.doesNotMatch(portal, /lastSuccessfulDelivery = visible\.find\(delivery => delivery\.status === 'delivered' \|\| delivery\.status === 'dry_run'/)
    assert.match(actions, /deliveryReady = deliveryRows\.some\(row => row\.status === 'delivered'\)/)
    assert.match(actions, /const deliveredCount = deliveryRows\.filter\(row => row\.status === 'delivered' && row\.dryRun !== true\)\.length/)
    assert.match(actions, /setResult\(\{ ok: !failed && deliveredCount > 0, message \}\)/)
    assert.doesNotMatch(actions, /setResult\(\{ ok: true, message: `Webhook delivery attempted/)
    assert.match(actions, /Dry-run delivery recorded; no customer notification was sent\./)
    assert.match(workbench, /delivery\.status === 'delivered' \? 'ready'/)
    assert.doesNotMatch(workbench, /delivery\.status === 'delivered' \|\| delivery\.status === 'dry_run'/)
})
