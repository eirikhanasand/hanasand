import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'bun:test'

test('product progress passes live helpdesk and TI responses through without proof ledgers', async() => {
    const route = await readFile(new URL('../src/app/api/product-progress/route.ts', import.meta.url), 'utf8')
    assert.match(route, /recovery: supportRecovery/)
    assert.match(route, /audit: auditEvents/)
    assert.match(route, /fetch: publicTi/)
    assert.doesNotMatch(route, /loadProductHelpdeskAuditProofLedger|helpdeskAuditFetchResultsFromLedger|loadProductPublicTiProofLedger|publicTiFetchResultFromLedger|PRODUCT_PROGRESS_(HELPDESK_AUDIT|PUBLIC_TI)/)
    assert.doesNotMatch(route, /webhookDeliveryProofLedger|product\.webhook_delivery_proof_ledger\.v1|delivery ledger when the ledger fallback is active/)
    assert.doesNotMatch(route, /sourceProxyFromDwmProductFallback|source_proxy_fallback_from_dwm_product/)
    assert.match(route, /searchParams\.get\('q'\)\?\.trim\(\) \|\| ''/)
    assert.match(route, /query\s*\?\s*fetchInternalJson\(request, routes\.publicTiProvenance/)
    assert.doesNotMatch(route, /acworth-ga\.gov/)
})
