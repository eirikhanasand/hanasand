import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskDetail, type ReviewTask } from '../src/app/dashboard/ti/review/automaticReviewQueue'

const [route, client, automaticQueue, workspace, sidebar] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/app/api/ti/claims/[[...path]]/route.ts'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/dashboard/ti/review/claimReviewClient.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/dashboard/ti/review/automaticReviewQueue.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/app/dashboard/ti/review/reviewWorkspace.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/components/dashboard/dashboardSidebar.tsx'), 'utf8'),
])

assert.match(route, /requireApiSession\(request, \['owner', 'system_admin', 'admin', 'administrator', 'analyst'\]\)/)
assert.match(route, /automaticListing/)
assert.match(route, /'\/v1\/intel\/automatic-reviews'/)
assert.match(route, /`\/v1\/intel\/automatic-reviews\/\$\{encodeURIComponent\(segments\[1\]\)\}\/replay`/)
assert.match(route, /'x-tenant-id': 'default'/)
assert.match(route, /cache: 'no-store'/)
assert.match(route, /query\.length > 200/)
assert.match(route, /automaticListing \? 250 : 100/)
assert.match(client, /'confirm' \| 'reject' \| 'mark_needs_review' \| 'mark_contradicted'/)
assert.match(client, /reason\.trim\(\)\.length < 8/)
assert.match(workspace, /AutomaticReviewQueue/)
assert.match(automaticQueue, /\/api\/ti\/claims\/automatic-reviews/)
assert.match(automaticQueue, /Queue eligible/)
assert.match(automaticQueue, /Run next batch/)
assert.match(automaticQueue, /Persisted decision history/)
assert.match(automaticQueue, /Governed evidence sent to Hanasand AI/)
assert.match(automaticQueue, /\['dead_letter', 'quarantined'\]/)
assert.match(automaticQueue, /selectedEvidenceIds/)
assert.match(automaticQueue, /linkedIndependentSourceCount/)
assert.match(automaticQueue, /falsePositiveReasons/)
assert.doesNotMatch(automaticQueue, /event\.evidenceIds|subject\.summary|capture\.title/)
assert.match(sidebar, /href: '\/dashboard\/ti\/review'/)

const rendered = renderToStaticMarkup(createElement(TaskDetail, {
    task: {
        id: 'automatic-review_test', subject: { type: 'incident', id: 'incident_test', incidentId: 'incident_test' },
        evidence: [{ id: 'evidence_test', relationship: 'supports', evidenceStage: 'captured_page', source: { id: 'source_test', name: 'Public report', independenceGroup: 'publisher_test' }, capture: { id: 'capture_test', safeExcerpt: 'APT29 targeted Northwind.' } }],
        selectedEvidenceIds: ['evidence_test'], linkedEvidenceCount: 1, linkedSourceCount: 1, linkedIndependentSourceCount: 1,
        state: 'terminal', outcome: 'decided', attempt: 1, maxAttempts: 3, replayCount: 0, requestedModelVersion: 'hanasand', promptVersion: 'prompt.v1',
        queuedAt: '2026-07-22T10:00:00.000Z', nextAttemptAt: '2026-07-22T10:00:00.000Z', completedAt: '2026-07-22T10:00:01.000Z', updatedAt: '2026-07-22T10:00:01.000Z', requestSha256: 'a'.repeat(64),
        decision: { action: 'confirm', claimValidity: 'supported', actorAttribution: { canonicalName: 'APT29', aliases: ['Midnight Blizzard'] }, supportingEvidenceIds: ['evidence_test'], contradictoryEvidenceIds: [], uncertainty: [], falsePositiveReasons: [], rationale: 'The retained report supports the proposition.', confidence: 0.9, modelVersion: 'hanasand', configuredModelVersion: 'hanasand', promptVersion: 'prompt.v1', runtimeIdentity: { provider: 'hanasand-ai', model: 'hanasand-inspur', conversationId: 'conversation-test' }, calibrationContext: { sourceCount: 1 } },
        history: [{ id: 'event_test', state: 'terminal', attempt: 1, occurredAt: '2026-07-22T10:00:01.000Z', selectedEvidenceIds: ['evidence_test'], requestSha256: 'a'.repeat(64) }]
    } satisfies ReviewTask,
    acting: false,
    replay: async () => undefined
}))
assert.match(rendered, /1 selected evidence record\(s\)/)
assert.match(rendered, /False-positive reasons/)
