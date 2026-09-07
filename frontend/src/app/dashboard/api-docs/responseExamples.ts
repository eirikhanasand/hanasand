// Hand-authored documentation fixtures. Never populate these from customer responses.
export type ResponseExample = { status: number, body: unknown }
const example = (body: unknown, status = 200): ResponseExample => ({ status, body })
const at = '2026-06-12T09:30:00Z'
const organization = { id: 'org_example', name: 'Cedar Bay Studio', slug: 'cedar-bay-studio', role: 'owner', status: 'active' }
const profile = { id: 'profile_example', name: 'Vendor review', tools: [{ id: 'tool_example', name: 'Vendor website', url: 'https://vendor.example.com' }] }
const share = { id: 'share_example', path: 'review-notes.md', content: 'Review the vendor documentation before Friday.', wordCount: 6, estimatedMinutes: 1, timestamp: at, git: null, locked: false, owner: 'user_example', parent: '', alias: 'review-notes', type: 'file' }
const tree = [{ id: share.id, name: share.path, type: 'file' }]
const apiKey = { id: 'key_example', name: 'Reporting integration', organizationId: organization.id, keyPrefix: 'example_', enabled: true, createdAt: at }
const watchlistItem = { id: 'watch_example', organizationId: organization.id, kind: 'domain', value: 'cedar-bay.example.com', notes: 'Monitor our public website.', status: 'active', createdAt: at, updatedAt: at }
const settings = { name: organization.name, slug: organization.slug, defaultWebhookPolicy: 'disabled', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 90 }
const destination = { id: 'destination_example', orgId: organization.id, name: 'Security inbox', kind: 'webhook', endpointHint: 'https://hooks.example.com/…', status: 'active', events: ['dwm.alert.created'], signingConfigured: true, createdAt: at }
const savedSearch = { query: 'cedar-bay.example.com', savedAt: at }
const search = {
    query: 'cedar-bay.example.com', queryKind: 'domain', generatedAt: at, mode: 'scraper', status: 'ready',
    summary: 'One public report mentions the domain. An analyst has not yet confirmed the finding.', confidence: 0.72,
    aliases: [], recentActivity: [{ date: '2026-06-12', title: 'Domain mentioned in a public report', detail: 'The report lists the domain among affected websites.', confidence: 0.72, sourceIds: ['source_example'] }],
    targets: [], ttps: [], datasets: [], sources: [{ id: 'source_example', name: 'Harbor Security Bulletin', type: 'vendor_report', provenance: 'Public advisory', url: 'https://reports.example.com/advisories/42' }], notes: ['Review the source report before taking action.'],
}
const collection = (item: unknown) => example({ data: [item], pagination: { limit: 50, total: 1, nextCursor: null }, meta: { requestId: 'request_example' } })

export const responseExamples: Record<string, ResponseExample> = {
    'GET /share/:id': example(share),
    'GET /share/tree/:id': example(tree),
    'GET /share/user/:id': example([share]),
    'GET /share/lock/:id': example({ ...share, locked: true }),
    'POST /share': example(share, 201),
    'PUT /share/:id': example(share),
    'DELETE /share/:id': example({ deleted: share.id }),
    'GET /project/:alias': example({ share, tree }),
    'GET /projects/user/:id': example([{ alias: share.alias, owner: share.owner, editors: [share.owner], file_count: 1, total_size: 50, last_updated: at }]),
    'DELETE /project/:alias': example({ deleted: share.alias }),
    'GET /browser/profiles': example({ profiles: [{ ...profile, createdAt: at, updatedAt: at }] }),
    'PUT /browser/profiles': example({ profiles: [profile] }),
    'GET /browser/stats': example({ runs24h: 24, darkwebRuns24h: 3 }),
    'GET /browser/runs': example({ runs: [{ id: 'run_example', target: 'https://vendor.example.com', network: 'regular', status: 'ended', startedAt: at, checkCount: 1, title: 'Vendor documentation', providerResults: {} }], quota: { plan: 'browser', limit: 100, used: 4, remaining: 96, resetsAt: '2026-07-01T00:00:00Z', identityKind: 'user' } }),
    'GET /browser/runs/:id/report': example({ title: 'Vendor website review', summary: 'The documentation page loaded successfully.', url: 'https://vendor.example.com', checkedAt: at }),
    'POST /browser/runs/:id/report': example({ ok: true, reportUrl: 'https://app.example.com/browser/report/run_example?token=example-not-a-valid-token' }),
    'GET /support/tickets': example({ role: 'user', tickets: [{ id: 'ticket_example', user_id: 'user_example', user_name: 'Morgan Reed', subject: 'Help connecting a webhook', status: 'open', created_at: at, updated_at: at, last_message: 'Where can I send a test notification?' }] }),
    'POST /support/tickets': example({ id: 'ticket_example' }, 201),
    'GET /support/tickets/:id/messages': example({ messages: [{ id: 'message_example', sender_id: 'user_example', sender_name: 'Morgan Reed', body: 'Where can I send a test notification?', created_at: at }] }),
    'POST /support/tickets/:id/messages': example({ ok: true }),
    'GET /ti/enrichment': example({ ok: false, error: 'api_ti_enrichment_retired', message: 'API-owned actor enrichment is retired. Read canonical evidence through the TI scraper.', canonicalRoute: '/v1/intel/search' }, 410),
    'POST /ti/enrichment/run': example({ ok: false, error: 'api_ti_enrichment_retired', message: 'API-owned actor enrichment is retired. Run collection through the canonical TI scraper.', canonicalRoute: '/v1/intel/search' }, 409),
    'GET /ti/saved-searches': example({ savedSearches: [savedSearch] }),
    'POST /ti/saved-searches': example({ savedSearch }, 201),
    'DELETE /ti/saved-searches': example({ ok: true }),
    'GET /organizations': example({ organizations: [organization] }),
    'POST /organizations': example({ organization }, 201),
    'GET /organizations/:id': example({ organization }),
    'GET /organizations/:id/members': example({ organization, members: [{ userId: 'user_example', name: 'Morgan Reed', organizationId: organization.id, role: 'owner', status: 'active', joinedAt: at }] }),
    'GET /organizations/:id/settings': example({ organization, settings }),
    'PUT /organizations/:id/settings': example({ organization, settings }),
    'GET /organizations/:id/api-keys': example({ organizationId: organization.id, apiKeys: [apiKey] }),
    'POST /organizations/:id/api-keys': example({ apiKey, secret: 'example-not-a-valid-api-key' }, 201),
    'DELETE /organizations/:id/api-keys/:keyId': example({ apiKey: { ...apiKey, enabled: false } }),
    'GET /organizations/:id/watchlists': example({ organization, watchlistItems: [watchlistItem] }),
    'POST /organizations/:id/watchlists': example({ watchlistItem }, 201),
    'GET /dwm/webhook-destinations': example({ destinations: [destination] }),
    'POST /dwm/webhook-destinations': example({ destination }, 201),
    'PUT /dwm/webhook-destinations/:id': example({ destination }),
    'DELETE /dwm/webhook-destinations/:id': example({ destination: { ...destination, status: 'archived', updatedAt: at } }),
    'GET /billing/subscription': example({ subscription: { planId: 'browser', status: 'active', currentPeriodStart: '2026-06-01T00:00:00Z', currentPeriodEnd: '2026-07-01T00:00:00Z', cancelAtPeriodEnd: false }, entitlements: [{ planId: 'browser', quotas: { browserRunsPerMonth: 100 }, features: [] }], quotas: [{ key: 'browserRunsPerMonth', limit: 100, used: 4, remaining: 96, periodStart: '2026-06-01T00:00:00Z', resetsAt: '2026-07-01T00:00:00Z' }] }),
    'POST /billing/portal': example({ url: 'https://billing.example.com/session/example-session' }),
    'POST /ti/search': example(search),
    'POST /ti/search/batch': example({ generatedAt: at, count: 1, partial: false, results: [{ query: search.query, status: 'ok', result: search }] }),
    'GET /actors': collection({ id: 'actor_example', canonicalName: 'Copper Finch', aliases: ['Finch Group'], confidence: 0.78, sourceIds: ['source_example'], captureIds: ['capture_example'] }),
    'GET /aliases': collection({ id: 'alias_example', actorProfileId: 'actor_example', alias: 'Finch Group', normalizedAlias: 'finch group', confidence: 0.78, sourceIds: ['source_example'] }),
    'GET /incidents': collection({ id: 'incident_example', title: 'Reported disruption at Cedar Bay Studio', summary: 'A public advisory describes a brief website outage. Attribution remains unconfirmed.', assertionKind: 'inferred', reviewState: 'needs_review', actorAttribution: null }),
    'GET /findings': collection({ id: 'finding_example', claimType: 'domain_mention', subjectType: 'domain', subjectId: 'cedar-bay.example.com', value: { value: 'cedar-bay.example.com', summary: 'Domain named in a public advisory.' }, summary: 'A public advisory mentions the monitored domain.', confidence: 0.72, reviewState: 'needs_review', sourceIds: ['source_example'], captureIds: ['capture_example'] }),
    'GET /evidence': collection({ id: 'evidence_example', captureId: 'capture_example', subjectType: 'incident', subjectId: 'incident_example', relationship: 'supports', confidence: 0.72 }),
    'GET /sources': collection({ id: 'source_example', name: 'Harbor Security Bulletin', type: 'vendor_report', status: 'active', risk: 'low', trustScore: 0.85, tags: ['public-advisories'], url: 'https://reports.example.com', urlHash: 'example-url-hash', locatorRedacted: false, operatingMode: { accessMethod: 'https', metadataOnly: false, approvalState: 'approved' }, collection: { cadenceSeconds: 3600 } }),
    'GET /validations': collection({ id: 'validation_example', validationType: 'source_comparison', status: 'unconfirmed', referenceUrl: 'https://reports.example.com/advisories/42', matchedAt: at, notes: 'An independent report has not yet confirmed the claim.' }),
    'GET /alerts': collection({ id: 'alert_example', assertionKind: 'inferred', reviewState: 'needs_review', summary: 'A new public report mentions cedar-bay.example.com.', severity: 'medium', evidence: { captureIds: ['capture_example'], sourceIds: ['source_example'], evidenceCount: 1, sourceCount: 1, metadataOnly: true } }),
    'GET /evaluation': collection({ id: 'evaluation_example', labelType: 'domain_extraction', outcome: 'correct', labeledBy: 'reviewer_example', labelingMethod: 'manual', labeledAt: at, datasetSplit: 'test', expectedValue: 'cedar-bay.example.com', observedValue: 'cedar-bay.example.com' }),
    'GET /timeliness': collection({ id: 'timeliness_example', sourceId: 'source_example', captureId: 'capture_example', incidentId: 'incident_example', publishedAt: '2026-06-12T09:00:00Z', collectedAt: '2026-06-12T09:05:00Z', processedAt: '2026-06-12T09:06:00Z', timestampAnomalies: [], latencies: { publicationToCollectionSeconds: 300, collectionToProcessingSeconds: 60 } }),
}
