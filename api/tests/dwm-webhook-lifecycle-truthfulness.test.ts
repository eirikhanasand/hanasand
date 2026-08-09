import { expect, test } from 'bun:test'
import { buildDwmWebhookDeliveryReadiness, buildDwmWebhookDeliveryReadinessConsumerProof, buildDwmWebhookDestinationLifecycle, buildDwmWebhookDestinationTestContract } from '../src/utils/dwm/webhooks.ts'

const baseDestination = {
    id: 'destination_1',
    ownerId: 'owner_1',
    orgId: 'org_1',
    name: 'Research receiver',
    kind: 'webhook',
    endpointHint: 'receiver.example/...',
    endpointHash: 'endpoint_hash',
    status: 'active',
    events: ['dwm.alert.created'],
    createdBy: 'owner_1',
    lastTestedAt: '2026-08-09T10:00:00.000Z',
    lastTestStatus: 'dry_run',
    lastTestError: null,
    lastTestHttpStatus: 204,
    lastDeliveryAt: null,
    createdAt: '2026-08-09T09:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z',
    signingConfigured: true,
} as const

function testDelivery(status: 'dry_run' | 'delivered', dryRun = status === 'dry_run') {
    return {
        id: `delivery_${status}`,
        destinationId: baseDestination.id,
        ownerId: baseDestination.ownerId,
        orgId: baseDestination.orgId,
        alertId: 'alert_test',
        eventType: 'dwm.alert.test',
        status,
        dryRun,
        endpointHint: baseDestination.endpointHint,
        endpointHash: baseDestination.endpointHash,
        payloadHash: 'payload_hash',
        payload: {},
        responseStatus: 204,
        responseBody: null,
        error: null,
        errorClass: null,
        attemptCount: 1,
        nextRetryAt: null,
        idempotencyKey: `idempotency_${status}`,
        watchlistId: null,
        watchlistName: null,
        route: 'POST /api/dwm/webhook-destinations/destination_1/test',
        casePath: null,
        attemptedAt: '2026-08-09T10:00:00.000Z',
        completedAt: '2026-08-09T10:00:00.100Z',
        deliveredAt: status === 'delivered' ? '2026-08-09T10:00:00.100Z' : null,
        createdAt: '2026-08-09T10:00:00.000Z',
        auditEventId: null,
        auditAction: null,
        auditActorId: null,
        reportValidation: null,
        reportExportChecksum: null,
        reportCaseId: null,
    }
}

test('dry-run history never makes a webhook destination live-ready', () => {
    const dryRun = buildDwmWebhookDestinationLifecycle({
        destinations: [baseDestination as any],
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    expect(dryRun.lifecycleState).toMatchObject({
        primary: 'test_required',
        active: false,
        liveDeliveryUnverified: true,
        liveVerified: false,
        verified: false,
    })
    expect(dryRun.lifecycleReadinessReceipt.status).toMatchObject({
        nextDeliveryState: 'test_required',
        readyForLive: false,
    })

    const delivered = buildDwmWebhookDestinationLifecycle({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        deliveries: [testDelivery('delivered') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    expect(delivered.lifecycleState).toMatchObject({
        primary: 'active',
        active: true,
        liveDeliveryUnverified: false,
        liveVerified: true,
    })
    expect(delivered.lifecycleReadinessReceipt.status).toMatchObject({
        nextDeliveryState: 'ready',
        readyForLive: true,
    })

    const deliveredDryRun = buildDwmWebhookDestinationLifecycle({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        deliveries: [testDelivery('delivered', true) as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })[0]
    expect(deliveredDryRun.lifecycleState).toMatchObject({
        primary: 'test_required',
        active: false,
        liveDeliveryUnverified: true,
        liveVerified: false,
        verified: false,
    })
    expect(deliveredDryRun.lifecycleReadinessReceipt.status).toMatchObject({
        readyForLive: false,
    })

    const deliveredDryRunContract = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestStatus: 'delivered' } as any,
        deliveries: [testDelivery('delivered', true) as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(deliveredDryRunContract.status).toBe('pending')

    const noTest = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestedAt: null, lastTestStatus: null } as any,
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(noTest.status).toBe('pending')

    const failed = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestStatus: 'failed' } as any,
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(failed.status).toBe('test_failed')

    const dryRunContract = buildDwmWebhookDestinationTestContract({
        destination: baseDestination as any,
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(dryRunContract.status).toBe('pending')

    const dryRunReadiness = buildDwmWebhookDeliveryReadiness({
        destinations: [baseDestination as any],
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
    })
    expect(dryRunReadiness.destinations[0]).toMatchObject({
        ready: false,
        blockers: expect.arrayContaining(['test_delivery_unverified']),
    })

    const deliveredContract = buildDwmWebhookDestinationTestContract({
        destination: { ...baseDestination, lastTestStatus: 'delivered' } as any,
        deliveries: [testDelivery('delivered') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(deliveredContract.status).toBe('verified')

    const deliveredReadiness = buildDwmWebhookDeliveryReadiness({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        deliveries: [testDelivery('delivered') as any],
        liveDeliveryEnabled: true,
    })
    expect(deliveredReadiness.destinations[0]).toMatchObject({ ready: true })

    const dryRunConsumerReadiness = buildDwmWebhookDeliveryReadinessConsumerProof({
        destinations: [baseDestination as any],
        deliveries: [testDelivery('dry_run') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(dryRunConsumerReadiness.rows[0]).toMatchObject({
        state: 'blocked',
        dryRun: true,
        readiness: { success: false },
    })

    const deliveredConsumerReadiness = buildDwmWebhookDeliveryReadinessConsumerProof({
        destinations: [{ ...baseDestination, lastTestStatus: 'delivered' } as any],
        deliveries: [testDelivery('delivered') as any],
        liveDeliveryEnabled: true,
        viewerRole: 'owner',
        canManage: true,
    })
    expect(deliveredConsumerReadiness.rows[0]).toMatchObject({
        state: 'idempotent_replay',
        readiness: { success: true },
    })
})
