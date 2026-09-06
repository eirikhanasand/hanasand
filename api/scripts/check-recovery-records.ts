import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { queryOnce, withTransaction, closeDatabase } from '../src/utils/db.ts'
import { issueToken } from '../src/utils/auth/session.ts'

if (process.env.RECOVERY_LIVE_CHECK !== '1') throw new Error('Explicit recovery fixture check required')
const id = `recovery_probe_${randomUUID().replaceAll('-', '')}`
const caseId = `case_${id}`
const alertId = `alert_${id}`
const marker = `Recovery validation ${id}`
const frontend = process.env.RECOVERY_FRONTEND || 'http://127.0.0.1:19300'
const statusUrl = process.env.RECOVERY_STATUS || 'http://127.0.0.1:19911/status'
let checks = 0
let readOnlyChecks = 0
try {
    await queryOnce('INSERT INTO users (id, name, password, avatar, active) VALUES ($1, $2, $3, $4, true)', [id, 'Temporary recovery validation', 'disabled-test-login', ''])
    const session = await issueToken({ id, ip: '127.0.0.1', userAgent: 'Recovery validation' })
    assert(session)
    const at = new Date().toISOString()
    const record = { id: caseId, tenantId: id, sourceType: 'manual', sourceId: 'recovery_validation', title: marker, summary: 'Temporary replication and recovery fixture', priority: 'low', status: 'open', assignedOwner: id, createdAt: at, updatedAt: at, workflowEvents: [{ id: `event_${id}`, at, actor: id, action: 'created', note: marker }], lastDecision: marker }
    await queryOnce('INSERT INTO threat_intel.workflow_records (record_type, id, tenant_id, record) VALUES (\'case\', $1, $2, $3::jsonb)', [caseId, id, JSON.stringify(record)])
    const alert = { id: alertId, tenantId: id, title: marker, company: marker, eventType: 'darkweb.monitoring.match', matchedTerm: { value: marker, kind: 'company' }, severity: 'low', confidence: 0.5, reviewState: 'needs_review', deliveryState: 'pending', createdAt: at, updatedAt: at, firstSeenAt: at, lastSeenAt: at, evidence: [], sourceCount: 0, sourceFamily: 'public_advisory', artifactType: 'mention', assertionKind: 'observed_mention', observedMatchSummary: marker, claimSummary: marker, confidenceReasoning: ['Temporary recovery fixture'], provenance: { generatedAt: at, sourceIds: [], captureIds: [], matchedEvidenceIds: [], sourceFamilies: [], metadataOnly: true }, customerState: { state: 'newly_collected', label: 'Newly collected', reason: 'Temporary validation fixture' }, dedupeKey: alertId, matchContext: { normalizedTerm: marker.toLowerCase(), termKind: 'company', matchType: 'bounded_text_or_metadata', matchedFieldHints: [] }, evidenceSummary: { evidenceCount: 0, sourceFamilyCounts: {}, metadataOnlyCount: 0, publicSafeCount: 0 }, routingContext: { queue: 'analyst_review', urgency: 'watch', customerVisibleEvidence: 'metadata_only', reason: 'Temporary validation fixture' }, recommendedAction: 'Review fixture', recommendedRoute: 'analyst_review', webhookDelivery: { recommendedRoute: 'analyst_review', payloadHash: alertId, dedupeKey: alertId } }
    await queryOnce('INSERT INTO threat_intel.alerts (id, tenant_id, dedupe_key, severity, confidence, review_state, delivery_state, first_seen_at, last_seen_at, updated_at, record) VALUES ($1,$2,$1,\'low\',0.5,\'needs_review\',\'pending\',NOW(),NOW(),NOW(),$3::jsonb)', [alertId, id, JSON.stringify(alert)])
    const headers = { cookie: `id=${id}; access_token=${session.token}`, authorization: `Bearer ${session.token}`, id }
    await Bun.sleep(20000)
    const deadline = Date.now() + Number(process.env.RECOVERY_CHECK_SECONDS || 120) * 1000
    console.log('Recovery fixture created; credentials are not printed.')
    while (Date.now() < deadline) {
        const state = await (await fetch(statusUrl, { signal: AbortSignal.timeout(8000) })).json()
        for (const path of ['/api/cases', `/api/cases/${caseId}`, '/api/dwm/alerts']) {
            const response = await fetch(frontend + path, { headers, signal: AbortSignal.timeout(15000) })
            const text = await response.text()
            assert.equal(response.status, 200, `Case and timeline access must survive recovery: ${path}`)
            assert(text.includes(marker), 'The replicated fixture must be returned, not an empty fallback')
            if (path === `/api/cases/${caseId}`) assert(JSON.parse(text).timeline.some((event: { id: string }) => event.id === `event_${id}`), 'The actual timeline event must be replicated')
        }
        const search = await fetch(frontend + '/api/ti/search?q=apt28', { signal: AbortSignal.timeout(15000) })
        assert.equal(search.status, 200)
        assert.equal((await search.json()).query?.toLowerCase(), 'apt28')
        if (state.readOnly && state.mode !== 'unknown') {
            const changed = await fetch(frontend + '/api/cases', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ title: marker }), signal: AbortSignal.timeout(8000) })
            assert.equal(changed.status, 503, 'The frontend must block mutations during read-only recovery')
            assert((await changed.text()).includes('recovery_read_only'))
            const before = await queryOnce('SELECT timestamp FROM tokens WHERE id=$1', [id])
            const auth = await fetch('http://127.0.0.1:19090/api/auth/token/' + id, { headers, signal: AbortSignal.timeout(8000) })
            assert.equal(auth.status, 200)
            const body = await auth.json()
            const after = await queryOnce('SELECT timestamp FROM tokens WHERE id=$1', [id])
            assert.equal(String(before.rows[0].timestamp), String(after.rows[0].timestamp), 'Replica validation must not touch session timestamps')
            assert(Date.parse(body.expires_at) <= new Date(before.rows[0].timestamp).getTime() + 24 * 3600_000 + 1000, 'Offline validation must not extend the stored session expiry')
            readOnlyChecks++
        }
        checks++
        await Bun.sleep(2000)
    }
    if (process.env.RECOVERY_REQUIRE_READ_ONLY === '1') assert(readOnlyChecks > 0, 'The drill must actually exercise read-only recovery')
    console.log(JSON.stringify({ caseAndTimelineChecks: checks, alertChecks: checks, searchChecks: checks, readOnlyChecks }))
} finally {
    await withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'120s\'')
        await query('DELETE FROM threat_intel.workflow_records WHERE record_type=\'case\' AND id=$1 AND tenant_id=$2', [caseId, id])
        await query('DELETE FROM threat_intel.alerts WHERE id=$1 AND tenant_id=$2', [alertId, id])
        await query('DELETE FROM tokens WHERE id=$1', [id])
        await query('DELETE FROM login_events WHERE user_id=$1', [id])
        await query('DELETE FROM attempts WHERE id=$1', [id])
        await query('DELETE FROM users WHERE id=$1', [id])
    })
    await closeDatabase()
}
