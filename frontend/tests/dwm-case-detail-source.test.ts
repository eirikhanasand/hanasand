import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/app/dashboard/dwm/cases/[id]/case-detail-client.tsx', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../src/app/dashboard/dwm/cases/[id]/page.tsx', import.meta.url), 'utf8')

test('DWM case detail exposes webhook delivery traceability', () => {
    assert.match(source, /<CollapsiblePanel title='Evidence rows' action=\{`\$\{evidence\.length\} rows`\}/)
    assert.match(source, /<CollapsiblePanel title='Audit timeline' action=\{`\$\{timeline\.length\} events`\}/)
    assert.match(source, /function CollapsiblePanel/)
    assert.match(source, /sendWebhook/)
    assert.match(source, /Manage destination/)
    assert.match(source, /Delivery history/)
    assert.match(source, /focus: 'destinations'/)
    assert.match(source, /latestDelivery\.nextRetryAt/)
    assert.match(source, /latestDelivery\.requestId \|\| latestDelivery\.auditEventId/)
    assert.match(source, /\/dashboard\/dwm\$\{queryString\(\{ tenantId, organizationId, alert: alertId \}\)\}/)
    assert.match(source, /Selected alert/)
    assert.doesNotMatch(source, /\/api\/dwm\/alerts/)
    assert.doesNotMatch(source, /What returned/)
})

test('DWM case detail server-loads the backed case workbench', () => {
    assert.match(pageSource, /loadCaseDetail/)
    assert.match(pageSource, /loadCaseExport/)
    assert.match(pageSource, /initialDetail=\{initialDetail\}/)
    assert.match(pageSource, /initialExportPayload=\{initialExportPayload\}/)
    assert.match(source, /initialDetail\?: CaseDetail/)
    assert.match(source, /loading: !initialDetail/)
    assert.match(source, /detail: initialDetail/)
})
