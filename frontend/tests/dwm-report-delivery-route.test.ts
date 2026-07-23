import { strict as assert } from 'node:assert'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { POST } from '../src/app/api/dwm/webhooks/deliver/route.ts'

test('rejects duplicate evidence before fetching an alert or canonical report', async () => {
    const response = await POST(new NextRequest('http://local/api/dwm/webhooks/deliver', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            alertId: 'alert_1',
            organizationId: 'org_1',
            caseId: 'case_1',
            evidenceIds: ['evidence_1', 'evidence_1'],
        }),
    }))

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
        error: {
            code: 'report_duplicate_evidence_selection',
            message: 'Each evidence row may be selected only once.',
        },
    })
})
