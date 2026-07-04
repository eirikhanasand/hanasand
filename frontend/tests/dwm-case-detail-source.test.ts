import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/app/dashboard/dwm/cases/[id]/case-detail-client.tsx', import.meta.url), 'utf8')

test('DWM case detail exposes webhook delivery traceability', () => {
    assert.match(source, /<Panel title='Evidence' action=\{`\$\{evidence\.length\} rows`\}/)
    assert.match(source, /<Panel title='Audit timeline' action=\{`\$\{timeline\.length\} events`\}/)
    assert.match(source, /sendWebhook/)
    assert.match(source, /Manage destination/)
    assert.match(source, /Delivery history/)
    assert.match(source, /focus: 'destinations'/)
    assert.match(source, /latestDelivery\.nextRetryAt/)
    assert.match(source, /latestDelivery\.requestId \|\| latestDelivery\.auditEventId/)
    assert.doesNotMatch(source, /What returned/)
})
