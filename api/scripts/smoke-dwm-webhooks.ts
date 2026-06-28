import crypto from 'node:crypto'
import run from '#db'
import ensureSchema from '#utils/db/ensureSchema.ts'
import {
    buildDwmAlertDeliveryPayload,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDestinationContracts,
    createDwmWebhookDestination,
    deliverDwmAlertNotification,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    testDwmWebhookDestination,
} from '#utils/dwm/webhooks.ts'

const suffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
const ownerId = `dwm_webhook_owner_${suffix}`
const otherUserId = `dwm_webhook_member_${suffix}`
const orgId = `dwm_webhook_org_${suffix}`
const endpointSecret = `discord-secret-${suffix}`
const discordEndpoint = `https://discord.com/api/webhooks/1234567890/${endpointSecret}`

function expect(condition: unknown, message: string, details?: unknown): asserts condition {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) {
            Object.assign(error, { details })
        }
        throw error
    }
}

async function main() {
    process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'false'
    await ensureSchema()
    await cleanup()
    await seedOrganization()

    const destination = await createDwmWebhookDestination(ownerId, {
        orgId,
        name: 'Customer Discord',
        kind: 'discord',
        endpointUrl: discordEndpoint,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
    })

    expect(destination.orgId === orgId, 'Destination did not persist org scope.', destination)
    expect(destination.kind === 'discord', 'Discord destination kind was not persisted.', destination)
    expect(destination.endpointHint.includes('/api/webhooks/1234567890/...'), 'Endpoint hint should be Discord-friendly and redacted.', destination)
    expect(destination.endpointHash?.startsWith('endpoint_'), 'Destination should expose an endpoint hash for support correlation.', destination)
    expect(!JSON.stringify(destination).includes(endpointSecret), 'Destination response leaked webhook secret.', destination)

    const stored = await run('SELECT endpoint_encrypted, endpoint_hint, endpoint_hash FROM dwm_webhook_destinations WHERE id = $1', [destination.id])
    expect(stored.rows.length === 1, 'Destination row was not persisted.')
    expect(!String(stored.rows[0].endpoint_encrypted).includes(endpointSecret), 'Encrypted endpoint leaked raw secret.', stored.rows[0])
    expect(!String(stored.rows[0].endpoint_hint).includes(endpointSecret), 'Endpoint hint leaked raw secret.', stored.rows[0])
    expect(String(stored.rows[0].endpoint_hash).startsWith('endpoint_'), 'Endpoint hash was not persisted.', stored.rows[0])

    const alert = {
        id: `alert_${suffix}`,
        orgName: 'Acme Security',
        company: 'Acme Security',
        severity: 'critical',
        claimSummary: 'A ransomware leak-site post claims Acme Security source archives were published.',
        recommendedAction: 'Validate the source, preserve evidence, notify the customer owner, and rotate affected credentials if confirmed.',
        matchedTerm: { value: 'acme-security.com', kind: 'domain' },
        sourceFamily: 'ransomware_leak_site',
        artifactType: 'victim_claim',
        route: 'customer_discord',
        casePath: `/dashboard/dwm?alert=alert_${suffix}`,
        watchlist: {
            id: 'watchlist-acme',
            name: 'Acme customer watchlist',
            terms: ['acme-security.com', 'Acme Security'],
        },
        evidence: [
            { label: 'Leak-site claim', detail: 'Claim references Acme Security domain and source archive filenames.', source: 'collector', capturedAt: new Date().toISOString() },
        ],
    }

    const previewPayload = buildDwmAlertDeliveryPayload({
        destination: { id: destination.id, kind: 'discord', name: destination.name, org_id: orgId },
        alert,
        eventType: 'dwm.alert.created',
        deliveryId: 'preview-delivery',
    }) as Record<string, unknown>
    const previewContext = previewPayload._hanasand as Record<string, unknown>
    expect(Array.isArray(previewPayload.embeds), 'Discord payload should include embeds.', previewPayload)
    expect(JSON.stringify(previewPayload).includes('Acme Security'), 'Payload should include organization context.', previewPayload)
    expect(JSON.stringify(previewContext).includes('acme-security.com'), 'Payload should include watchlist or matched-term context.', previewContext)
    expect(JSON.stringify(previewPayload).includes('Evidence count'), 'Discord payload should expose evidence count.', previewPayload)
    expect(JSON.stringify(previewPayload).includes('customer_discord'), 'Discord payload should expose delivery route.', previewPayload)
    expect(JSON.stringify(previewPayload).includes('/dashboard/dwm?alert='), 'Discord payload should expose the case path.', previewPayload)
    expect(JSON.stringify(previewPayload).includes('dwm.alert.created'), 'Discord payload should expose event type in context.', previewPayload)
    expect(!JSON.stringify(previewPayload).includes(endpointSecret), 'Delivery payload leaked webhook secret.', previewPayload)

    const testDelivery = await testDwmWebhookDestination(ownerId, destination.id, { dryRun: true })
    expect(testDelivery?.status === 'dry_run', 'Test delivery should default to dry_run.', testDelivery)
    expect(testDelivery.alertId === 'webhook_test', 'Test delivery should use the test alert contract.', testDelivery)
    expect(testDelivery.endpointHash?.startsWith('endpoint_'), 'Test delivery should persist endpoint hash.', testDelivery)
    expect(testDelivery.payloadHash?.startsWith('payload_'), 'Test delivery should persist payload hash.', testDelivery)
    expect(testDelivery.attemptedAt, 'Test delivery should expose attemptedAt.', testDelivery)
    expect(!JSON.stringify(testDelivery).includes(endpointSecret), 'Test delivery leaked webhook secret.', testDelivery)

    const replayDeliveries = await deliverDwmAlertNotification(ownerId, {
        organizationId: orgId,
        eventType: 'dwm.alert.replayed',
        alertId: alert.id,
        watchlistItemId: 'watchlist-acme',
        watchlistName: 'Acme customer watchlist',
        dedupeKey: `dwm_dedupe_${suffix}`,
        route: alert.route,
        casePath: alert.casePath,
        evidenceCount: 1,
        sourceFamily: alert.sourceFamily,
        alert,
        dryRun: true,
    })
    expect(replayDeliveries.length === 1, 'Replay should deliver to the active org destination.', replayDeliveries)
    expect(replayDeliveries[0].status === 'dry_run', 'Replay delivery should stay dry-run when requested.', replayDeliveries[0])
    expect(replayDeliveries[0].payload && JSON.stringify(replayDeliveries[0].payload).includes('dwm.alert.replayed'), 'Replay payload should include event type.', replayDeliveries[0])
    expect(replayDeliveries[0].watchlistId === 'watchlist-acme', 'Replay delivery should persist watchlist context.', replayDeliveries[0])
    expect(replayDeliveries[0].route === 'customer_discord', 'Replay delivery should persist route context.', replayDeliveries[0])
    expect(replayDeliveries[0].casePath?.includes('/dashboard/dwm?alert='), 'Replay delivery should persist case path.', replayDeliveries[0])

    const blockedLive = await deliverDwmAlertNotification(ownerId, {
        orgId,
        destinationId: destination.id,
        eventType: 'dwm.alert.created',
        alert,
        dryRun: false,
        live: true,
    })
    expect(blockedLive[0]?.status === 'skipped', 'Live delivery should be skipped unless explicitly enabled by env.', blockedLive)
    expect(String(blockedLive[0]?.error || '').includes('Live DWM webhook delivery is disabled'), 'Skipped live delivery should explain the safety gate.', blockedLive[0])

    const orgDestinationsForMember = await listDwmWebhookDestinations(otherUserId, orgId)
    expect(orgDestinationsForMember.some(item => item.id === destination.id), 'Org member should be able to see org-scoped destinations through the shared contract.', orgDestinationsForMember)

    const deliveries = await listDwmWebhookDeliveries(ownerId, orgId)
    expect(deliveries.length >= 3, 'Deliveries were not persisted.', deliveries)
    expect(deliveries.every(delivery => delivery.endpointHash && delivery.payloadHash && delivery.attemptedAt), 'Delivery ledger should include hashes and attemptedAt.', deliveries)
    const refreshedDestination = (await listDwmWebhookDestinations(ownerId, orgId)).find(item => item.id === destination.id)
    expect(refreshedDestination?.lastTestStatus === 'dry_run', 'Destination should persist the latest test result.', refreshedDestination)

    const auditEvents = await listDwmWebhookAuditEvents(ownerId, orgId)
    const destinationContracts = buildDwmWebhookDestinationContracts({
        destinations: [refreshedDestination].filter(Boolean) as NonNullable<typeof refreshedDestination>[],
        deliveries,
        auditEvents,
    })
    const destinationContract = destinationContracts[0]
    const testPreview = buildDwmWebhookDeliveryPreview(testDelivery)
    expect(destinationContract, 'Destination contract should be built from the refreshed destination.', destinationContracts)
    expect(destinationContract?.type === 'discord' && destinationContract.label === 'Customer Discord', 'Destination contract should expose customer-facing type and label.', destinationContract)
    expect(destinationContract.enabled === true && destinationContract.redactedUrl.includes('/api/webhooks/1234567890/...'), 'Destination contract should expose enabled redacted Discord ref.', destinationContract)
    expect(destinationContract.lastTest.requestId === testDelivery.id && destinationContract.lastTest.auditEventId, 'Destination contract should expose last test request and audit ids.', destinationContract)
    expect(destinationContract.lastDelivery.requestId === replayDeliveries[0].id && destinationContract.lastDelivery.auditEventId, 'Destination contract should expose last delivery request and audit ids.', destinationContract)
    expect(!JSON.stringify(destinationContract).includes(endpointSecret), 'Destination contract leaked Discord endpoint secret.', destinationContract)
    expect(testPreview.discord.embeds.length === 1, 'Dry-run test preview should expose Discord-ready embeds.', testPreview)
    expect(testPreview.context.org.id === orgId, 'Dry-run test preview should expose org context.', testPreview)
    expect(testPreview.context.watchlist.id === 'test-watchlist', 'Dry-run test preview should expose watchlist context.', testPreview)
    expect(testPreview.context.alert.severity === 'medium' && testPreview.context.alert.casePath === '/dashboard/dwm', 'Dry-run test preview should expose alert severity and case path.', testPreview)
    expect(!JSON.stringify(testPreview).includes(endpointSecret), 'Dry-run test preview leaked Discord endpoint secret.', testPreview)

    const deliveryEvidence = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents })
    const replayEvidence = deliveryEvidence.find(item => item.alertId === alert.id && item.eventType === 'dwm.alert.replayed')
    const skippedLiveEvidence = deliveryEvidence.find(item => item.alertId === alert.id && item.status === 'skipped')
    const testEvidence = deliveryEvidence.find(item => item.alertId === 'webhook_test')
    expect(deliveryEvidence.length >= 3, 'Delivery evidence view should include persisted attempts.', deliveryEvidence)
    expect(replayEvidence?.destinationId === destination.id, 'Replay evidence should include destination id.', replayEvidence)
    expect(replayEvidence?.requestId && replayEvidence.requestId === replayEvidence.deliveryId, 'Replay evidence should include stable request id.', replayEvidence)
    expect(replayEvidence?.status === 'dry_run' && replayEvidence.dryRun === true && replayEvidence.live === false && replayEvidence.liveRequested === false, 'Replay evidence should distinguish dry-run replay.', replayEvidence)
    expect(replayEvidence?.replay === true, 'Replay evidence should mark replay attempts.', replayEvidence)
    expect(replayEvidence?.dedupeKey === `dwm_dedupe_${suffix}`, 'Replay evidence should expose alert dedupe key.', replayEvidence)
    expect(replayEvidence?.casePath === alert.casePath, 'Replay evidence should expose case path.', replayEvidence)
    expect(replayEvidence?.watchlistId === 'watchlist-acme', 'Replay evidence should include watchlist id.', replayEvidence)
    expect(replayEvidence?.redactedDestination.endpointHint.includes('/api/webhooks/1234567890/...'), 'Evidence should include redacted Discord destination.', replayEvidence)
    expect(replayEvidence?.redactedDestination.endpointHash?.startsWith('endpoint_'), 'Evidence should include destination hash.', replayEvidence)
    expect(replayEvidence?.payloadHash?.startsWith('payload_'), 'Evidence should include payload hash.', replayEvidence)
    expect(replayEvidence?.auditEventId, 'Replay evidence should link to the audit event id.', replayEvidence)
    expect(replayEvidence?.auditAction === 'delivery.replayed', 'Replay evidence should expose audit action.', replayEvidence)
    expect(skippedLiveEvidence?.liveRequested === true && skippedLiveEvidence.live === false && skippedLiveEvidence.status === 'skipped', 'Skipped live evidence should show no external send occurred.', skippedLiveEvidence)
    expect(String(skippedLiveEvidence?.error || '').includes('Live DWM webhook delivery is disabled'), 'Skipped live evidence should preserve safety-gate error.', skippedLiveEvidence)
    expect(testEvidence?.status === 'dry_run' && testEvidence.replay === false, 'Test evidence should remain dry-run non-replay.', testEvidence)
    expect(!JSON.stringify(deliveryEvidence).includes(endpointSecret), 'Delivery evidence leaked Discord endpoint secret.', deliveryEvidence)

    const byOrg = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters: { orgId } })
    const byWrongOrg = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters: { orgId: `${orgId}_wrong` } })
    const byDestination = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters: { destinationId: destination.id } })
    const byAlert = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters: { alertId: alert.id } })
    const byCasePath = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters: { casePath: alert.casePath } })
    const byDedupe = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters: { dedupeKey: `dwm_dedupe_${suffix}` } })
    const byIdempotency = buildDwmWebhookDeliveryEvidence({ deliveries, auditEvents, filters: { dedupeKey: replayEvidence?.idempotencyKey } })
    expect(byOrg.length === deliveryEvidence.length, 'Org evidence filter should include org-scoped attempts.', { byOrg, deliveryEvidence })
    expect(byWrongOrg.length === 0, 'Org evidence filter should exclude wrong-org attempts.', byWrongOrg)
    expect(byDestination.length === deliveryEvidence.length, 'Destination evidence filter should include all attempts for the destination.', byDestination)
    expect(byAlert.length >= 2 && byAlert.every(item => item.alertId === alert.id), 'Alert evidence filter should include replay and skipped attempts for the alert.', byAlert)
    expect(byCasePath.some(item => item.requestId === replayEvidence?.requestId), 'Case path evidence filter should include replay attempt.', byCasePath)
    expect(byDedupe.length === 1 && byDedupe[0].requestId === replayEvidence?.requestId, 'Dedupe evidence filter should isolate replay attempt.', byDedupe)
    expect(byIdempotency.length === 1 && byIdempotency[0].requestId === replayEvidence?.requestId, 'Idempotency evidence filter should isolate replay attempt.', byIdempotency)
    const visibleToMember = filterDwmWebhookDeliveryEvidenceForVisibility({
        evidence: deliveryEvidence,
        visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
    })
    const hiddenFromWrongOrg = filterDwmWebhookDeliveryEvidenceForVisibility({
        evidence: deliveryEvidence,
        visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
    })
    const hiddenFromRemoved = filterDwmWebhookDeliveryEvidenceForVisibility({
        evidence: deliveryEvidence,
        visibility: { role: 'admin', status: 'removed', userActive: true, alertVisibilityPolicy: 'members' },
    })
    const hiddenFromDeactivated = filterDwmWebhookDeliveryEvidenceForVisibility({
        evidence: deliveryEvidence,
        visibility: { role: 'owner', status: 'active', userActive: false, alertVisibilityPolicy: 'members' },
    })
    const hiddenFromMemberByAdminPolicy = filterDwmWebhookDeliveryEvidenceForVisibility({
        evidence: deliveryEvidence,
        visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'admins' },
    })
    const visibleToAdminByAdminPolicy = filterDwmWebhookDeliveryEvidenceForVisibility({
        evidence: deliveryEvidence,
        visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'admins' },
    })
    expect(visibleToMember.deliveryEvidence.length === deliveryEvidence.length, 'Members visibility policy should allow active members to read evidence.', visibleToMember)
    expect(hiddenFromWrongOrg.decision.reason === 'not_member' && hiddenFromWrongOrg.deliveryEvidence.length === 0, 'Visibility should deny nonmembers/wrong org.', hiddenFromWrongOrg)
    expect(hiddenFromRemoved.decision.reason === 'member_removed' && hiddenFromRemoved.deliveryEvidence.length === 0, 'Visibility should deny removed members.', hiddenFromRemoved)
    expect(hiddenFromDeactivated.decision.reason === 'member_deactivated' && hiddenFromDeactivated.deliveryEvidence.length === 0, 'Visibility should deny deactivated members.', hiddenFromDeactivated)
    expect(hiddenFromMemberByAdminPolicy.decision.reason === 'role_not_allowed' && hiddenFromMemberByAdminPolicy.deliveryEvidence.length === 0, 'Admin-only visibility policy should deny members.', hiddenFromMemberByAdminPolicy)
    expect(visibleToAdminByAdminPolicy.decision.allowed === true && visibleToAdminByAdminPolicy.deliveryEvidence.length === deliveryEvidence.length, 'Admin-only visibility policy should allow admins.', visibleToAdminByAdminPolicy)

    const audit = await run(`
        SELECT action, metadata
        FROM dwm_webhook_audit_events
        WHERE org_id = $1
        ORDER BY created_at ASC
    `, [orgId])
    const actions = audit.rows.map((row: { action: string }) => row.action)
    expect(actions.includes('destination.created'), 'Destination create audit event missing.', actions)
    expect(actions.includes('delivery.tested'), 'Test delivery audit event missing.', actions)
    expect(actions.includes('delivery.replayed'), 'Replay delivery audit event missing.', actions)
    expect(actions.includes('delivery.skipped'), 'Skipped live delivery audit event missing.', actions)
    expect(!JSON.stringify(audit.rows).includes(endpointSecret), 'Audit metadata leaked webhook secret.', audit.rows)

    console.log(JSON.stringify({
        ok: true,
        destinationId: destination.id,
        orgId,
        checked: [
            'discord payload context',
            'encrypted destination persistence',
            'dry-run test delivery',
            'destination last test result',
            'replay delivery',
            'live-disabled safety gate',
            'delivery hashes and attemptedAt',
            'delivery evidence filters',
            'delivery evidence redaction',
            'delivery evidence visibility policy',
            'delivery evidence replay/live/dry-run states',
            'destination contract fields and audit ids',
            'dry-run Discord preview fields',
            'watchlist/route/case context',
            'org-shared destination list',
            'structured audit events',
            'secret redaction',
        ],
        integrationChecklist: [
            'Postgres reachable at DB_HOST/DB_PORT and migrations can run ensureSchema().',
            'DWM_WEBHOOK_LIVE_DELIVERY is unset or false for dry-run verification.',
            'Set DWM_WEBHOOK_LIVE_DELIVERY=true only for deliberate live-send Discord tests.',
            'No external network is required for this smoke while live delivery is disabled.',
        ],
    }, null, 2))
}

async function seedOrganization() {
    await run(`
        INSERT INTO users (id, name, password, avatar, active)
        VALUES
            ($1, 'DWM Webhook Smoke Owner', crypt($3, gen_salt('bf')), '', TRUE),
            ($2, 'DWM Webhook Smoke Member', crypt($3, gen_salt('bf')), '', TRUE)
        ON CONFLICT (id) DO NOTHING
    `, [ownerId, otherUserId, `Smoke-${suffix}-Aa11!!`])
    await run(`
        INSERT INTO organizations (id, name, slug, created_by)
        VALUES ($1, 'DWM Webhook Smoke Org', $2, $3)
        ON CONFLICT (id) DO NOTHING
    `, [orgId, orgId, ownerId])
    await run(`
        INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
        VALUES
            ($1, $2, 'owner', 'active', $2),
            ($1, $3, 'member', 'active', $2)
        ON CONFLICT (organization_id, user_id)
        DO UPDATE SET status = 'active'
    `, [orgId, ownerId, otherUserId])
}

async function cleanup() {
    await run('DELETE FROM dwm_webhook_audit_events WHERE owner_id = $1 OR owner_id = $2 OR org_id = $3', [ownerId, otherUserId, orgId]).catch(() => {})
    await run('DELETE FROM dwm_webhook_deliveries WHERE owner_id = $1 OR owner_id = $2 OR org_id = $3', [ownerId, otherUserId, orgId]).catch(() => {})
    await run('DELETE FROM dwm_webhook_destinations WHERE owner_id = $1 OR owner_id = $2 OR org_id = $3', [ownerId, otherUserId, orgId]).catch(() => {})
    await run('DELETE FROM organization_members WHERE organization_id = $1 OR user_id = $2 OR user_id = $3', [orgId, ownerId, otherUserId]).catch(() => {})
    await run('DELETE FROM organization_invites WHERE organization_id = $1', [orgId]).catch(() => {})
    await run('DELETE FROM organization_watchlist_items WHERE organization_id = $1', [orgId]).catch(() => {})
    await run('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {})
    await run('DELETE FROM tokens WHERE id = $1 OR id = $2', [ownerId, otherUserId]).catch(() => {})
    await run('DELETE FROM users WHERE id = $1 OR id = $2', [ownerId, otherUserId]).catch(() => {})
}

main()
    .catch((error) => {
        console.error((error as Error & { details?: unknown }).details ?? error)
        process.exitCode = 1
    })
    .finally(cleanup)
