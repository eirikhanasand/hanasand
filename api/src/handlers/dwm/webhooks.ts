import type { FastifyReply, FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import {
    organizationVisibilityDecision,
    roleCanManageOrganization,
    type OrganizationAlertVisibilityPolicy,
    type OrganizationRole,
} from '#utils/organizations.ts'
import {
    archiveDwmWebhookDestination,
    buildDwmOrgAlertWebhookDeliveryContract,
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookDeliveryActionPlan,
    buildDwmWebhookDeliveryAuditTrail,
    buildDwmWebhookDeliveryAttemptContract,
    buildDwmWebhookDeliveryAttemptPersistenceProof,
    buildDwmWebhookDeliveryAttemptPersistenceReadModel,
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookCustomerSetupProof,
    buildDwmWebhookDestinationCrudContract,
    buildDwmWebhookDestinationAdminProof,
    buildDwmWebhookDestinationDeliveryMatrix,
    buildDwmWebhookDestinationHealth,
    buildDwmWebhookDestinationLifecycle,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDestinationContracts,
    buildDwmWebhookDestinationLookupContract,
    buildDwmWebhookDestinationTestContract,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryHistory,
    buildDwmWebhookDeliveryHistoryConsumerProof,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryPersistenceProof,
    buildDwmWebhookDeliveryReceipts,
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDeliveryReplayGuard,
    buildDwmWebhookDeliveryReplayApiContract,
    buildDwmWebhookDeliveryTimeline,
    buildDwmWebhookDeliveryRetryPersistence,
    buildDwmWebhookDeliveryRetryQueue,
    buildDwmWebhookDeliveryRetryRequestContract,
    buildDwmWebhookDeliveryRetryWorkOrders,
    buildDwmWebhookDeliveryRequestInput,
    buildDwmWebhookDeliveryRetryContract,
    createDwmWebhookDestination,
    buildDwmWebhookDeliveryReadiness,
    triggerDwmAlertWebhookNotification,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    listDwmWebhookReceiverReceipts,
    recordDwmWebhookReceiverReceipt,
    retryDwmWebhookDelivery,
    testDwmWebhookDestination,
    updateDwmWebhookDestination,
    validateOutboundThirdPartyReport,
    type DwmAlertNotificationInput,
    type DwmWebhookDestinationInput,
} from '#utils/dwm/webhooks.ts'

type IdParams = {
    id: string
}

type OrgQuery = {
    orgId?: string
    org_id?: string
    includeAudit?: string
    destinationId?: string
    destination_id?: string
    alertId?: string
    alert_id?: string
    casePath?: string
    case_path?: string
    dedupeKey?: string
    dedupe_key?: string
    requestId?: string
    request_id?: string
    deliveryId?: string
    delivery_id?: string
    idempotencyKey?: string
    idempotency_key?: string
    action?: string
    status?: string
    timeFrom?: string
    time_from?: string
    timeTo?: string
    time_to?: string
    retryState?: string
    retry_state?: string
    actorId?: string
    actor_id?: string
    reportCaseId?: string
    report_case_id?: string
    reportExportChecksum?: string
    report_export_checksum?: string
}

type Membership = {
    role: OrganizationRole
    status?: 'active' | 'removed'
    user_active?: boolean
    alert_visibility_policy?: OrganizationAlertVisibilityPolicy
    organization_status?: string
    privacy_deletion_run_id?: string | null
}

export async function getDwmWebhookDestinations(req: FastifyRequest<{ Querystring: OrgQuery }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = orgIdFromQuery(req.query)
    const membership = orgId && orgId !== userId ? await loadOrganizationMembership(orgId, userId) : null
    if (orgId && orgId !== userId && !membership) {
        return res.status(404).send({ error: 'Organization not found.' })
    }
    const lifecycleAccess = destinationLifecycleAccess(orgId, userId, membership)

    const destinations = await listDwmWebhookDestinations(userId, orgId || undefined)
    const deliveries = await listDwmWebhookDeliveries(userId, orgId || undefined)
    const auditEvents = await listDwmWebhookAuditEvents(userId, orgId || undefined)

    return res.send({
        destinations,
        destinationContracts: buildDwmWebhookDestinationContracts({ destinations, deliveries, auditEvents }),
        destinationHealth: buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents }),
        customerSetup: buildDwmWebhookCustomerSetupProof({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        dashboardReadiness: buildDwmWebhookDashboardReadinessAdapter({
            destinations,
            deliveries,
            auditEvents,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations, deliveries, auditEvents, ...lifecycleAccess }),
        destinationLookup: buildDwmWebhookDestinationLookupContract({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        destinationTests: destinations.map(destination => buildDwmWebhookDestinationTestContract({
            destination,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
        })),
        destinationAdminProof: buildDwmWebhookDestinationAdminProof({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({ destinations, deliveries, auditEvents }),
        deliveryRetryQueue: buildDwmWebhookDeliveryRetryQueue({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryRetryRequest: buildDwmWebhookDeliveryRetryRequestContract({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryRetryWorkOrders: buildDwmWebhookDeliveryRetryWorkOrders({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        destinationDeliveryMatrix: buildDwmWebhookDestinationDeliveryMatrix({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryAuditTrail: buildDwmWebhookDeliveryAuditTrail({
            destinations,
            deliveries,
            auditEvents,
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryPersistenceProof: buildDwmWebhookDeliveryPersistenceProof({
            deliveries,
            auditEvents,
            destinations,
            filters: { orgId },
        }),
        deliveryReadinessConsumer: buildDwmWebhookDeliveryReadinessConsumerProof({
            destinations,
            deliveries,
            auditEvents,
            filters: { orgId },
            ...lifecycleAccess,
            visibility: orgId && orgId !== userId
                ? {
                    role: membership?.role,
                    status: 'active',
                    userActive: true,
                    alertVisibilityPolicy: membership?.alert_visibility_policy,
                }
                : null,
        }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations }),
    })
}

export async function postDwmWebhookDestination(req: FastifyRequest<{ Body: DwmWebhookDestinationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = clean(req.body?.orgId) || userId
    const permissionError = await configurationPermissionError(orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const existingDestinations = await listDwmWebhookDestinations(userId, orgId)
    const destinationCrud = buildDwmWebhookDestinationCrudContract({
        action: 'create',
        ownerId: userId,
        input: { ...req.body, orgId },
        destinations: existingDestinations,
        viewerRole: orgId === userId ? 'owner' : 'admin',
        canManage: true,
    })
    if (!destinationCrud.canApply) {
        return res.status(destinationCrud.blockingCodes.includes('duplicate_destination') ? 409 : 400).send({
            error: destinationCrud.blockers[0]?.message || 'Webhook destination cannot be created.',
            destinationCrud,
        })
    }

    try {
        const destination = await createDwmWebhookDestination(userId, { ...req.body, orgId })
        const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
        const destinations = [destination, ...existingDestinations.filter(item => item.id !== destination.id)]
        return res.status(201).send({
            destination,
            destinationCrud: buildDwmWebhookDestinationCrudContract({
                action: 'create',
                ownerId: userId,
                input: { ...req.body, orgId },
                destination,
                destinations,
                auditEvents,
                viewerRole: orgId === userId ? 'owner' : 'admin',
                canManage: true,
            }),
            destinationContract: buildDwmWebhookDestinationContracts({ destinations: [destination], auditEvents })[0],
            destinationHealth: buildDwmWebhookDestinationHealth({ destinations: [destination], auditEvents })[0],
            customerSetup: buildDwmWebhookCustomerSetupProof({ destinations, auditEvents, viewerRole: orgId === userId ? 'owner' : 'admin', canManage: true }),
            destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: [destination], auditEvents, viewerRole: 'owner', canManage: true })[0],
            destinationAdminProof: buildDwmWebhookDestinationAdminProof({ destinations: [destination], auditEvents, viewerRole: 'owner', canManage: true }),
            auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, destinations: [destination] }),
        })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid webhook destination.' })
    }
}

export async function putDwmWebhookDestination(req: FastifyRequest<{ Params: IdParams, Body: DwmWebhookDestinationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    const nextOrgId = clean(req.body?.orgId) || existing.orgId || userId
    const destinationOrgId = existing.orgId || userId
    const permissionError = await configurationPermissionError(destinationOrgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    try {
        const currentDestinations = await listDwmWebhookDestinations(userId, destinationOrgId)
        const destinationBefore = currentDestinations.find(item => item.id === req.params.id) || null
        const action = destinationCrudActionForUpdate(req.body, destinationBefore)
        const preflightCrud = buildDwmWebhookDestinationCrudContract({
            action,
            ownerId: userId,
            input: { ...req.body, orgId: nextOrgId },
            destination: destinationBefore,
            destinations: currentDestinations,
            deliveries: await listDwmWebhookDeliveries(userId, destinationOrgId),
            auditEvents: await listDwmWebhookAuditEvents(userId, destinationOrgId),
            viewerRole: 'admin',
            canManage: true,
        })
        if (!preflightCrud.canApply) {
            return res.status(400).send({
                error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be updated.',
                destinationCrud: preflightCrud,
            })
        }

        const destination = await updateDwmWebhookDestination(userId, req.params.id, { ...req.body, orgId: destinationOrgId })
        if (!destination) {
            return res.status(404).send({ error: 'Webhook destination not found.' })
        }
        const deliveries = await listDwmWebhookDeliveries(userId, destination.orgId)
        const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
        return res.send({
            destination,
            destinationCrud: buildDwmWebhookDestinationCrudContract({
                action,
                ownerId: userId,
                input: { ...req.body, orgId: nextOrgId },
                destination,
                destinations: currentDestinations.map(item => item.id === destination.id ? destination : item),
                deliveries,
                auditEvents,
                viewerRole: 'admin',
                canManage: true,
            }),
            destinationContract: buildDwmWebhookDestinationContracts({ destinations: [destination], deliveries, auditEvents })[0],
            destinationHealth: buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents })[0],
            customerSetup: buildDwmWebhookCustomerSetupProof({
                destinations: currentDestinations.map(item => item.id === destination.id ? destination : item),
                deliveries,
                auditEvents,
                viewerRole: 'admin',
                canManage: true,
            }),
            destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true })[0],
            destinationAdminProof: buildDwmWebhookDestinationAdminProof({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true }),
            auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations: [destination] }),
        })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid webhook destination.' })
    }
}

export async function deleteDwmWebhookDestination(req: FastifyRequest<{ Params: IdParams }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    const permissionError = await configurationPermissionError(existing.orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const currentDestinations = await listDwmWebhookDestinations(userId, existing.orgId)
    const destinationBefore = currentDestinations.find(item => item.id === req.params.id) || null
    const preflightCrud = buildDwmWebhookDestinationCrudContract({
        action: 'delete',
        ownerId: userId,
        input: { orgId: existing.orgId },
        destination: destinationBefore,
        destinations: currentDestinations,
        deliveries: await listDwmWebhookDeliveries(userId, existing.orgId),
        auditEvents: await listDwmWebhookAuditEvents(userId, existing.orgId),
        viewerRole: 'admin',
        canManage: true,
    })
    if (!preflightCrud.canApply) {
        return res.status(400).send({
            error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be deleted.',
            destinationCrud: preflightCrud,
        })
    }

    const destination = await archiveDwmWebhookDestination(userId, req.params.id)
    if (!destination) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }
    const deliveries = await listDwmWebhookDeliveries(userId, destination.orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
    return res.send({
        destination,
        destinationCrud: buildDwmWebhookDestinationCrudContract({
            action: 'delete',
            ownerId: userId,
            input: { orgId: destination.orgId },
            destination,
            destinations: [destination, ...currentDestinations.filter(item => item.id !== destination.id)],
            deliveries,
            auditEvents,
            viewerRole: 'admin',
            canManage: true,
        }),
        destinationContract: buildDwmWebhookDestinationContracts({ destinations: [destination], deliveries, auditEvents })[0],
        destinationHealth: buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents })[0],
        customerSetup: buildDwmWebhookCustomerSetupProof({
            destinations: [destination, ...currentDestinations.filter(item => item.id !== destination.id)],
            deliveries,
            auditEvents,
            viewerRole: 'admin',
            canManage: true,
        }),
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true })[0],
        destinationAdminProof: buildDwmWebhookDestinationAdminProof({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations: [destination] }),
    })
}

export async function postDwmWebhookDestinationTest(req: FastifyRequest<{ Params: IdParams, Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    const permissionError = await configurationPermissionError(existing.orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const preflightDestinations = await listDwmWebhookDestinations(userId, existing.orgId)
    const preflightDestination = preflightDestinations.find(item => item.id === req.params.id) || null
    const preflightDeliveries = await listDwmWebhookDeliveries(userId, existing.orgId)
    const preflightAuditEvents = await listDwmWebhookAuditEvents(userId, existing.orgId)
    const preflightCrud = buildDwmWebhookDestinationCrudContract({
        action: 'test',
        ownerId: userId,
        input: { ...(req.body || {}), orgId: existing.orgId },
        destination: preflightDestination,
        destinations: preflightDestinations,
        deliveries: preflightDeliveries,
        auditEvents: preflightAuditEvents,
        viewerRole: 'admin',
        canManage: true,
    })
    if (!preflightCrud.canApply) {
        return res.status(400).send({
            error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be tested.',
            destinationCrud: preflightCrud,
        })
    }

    const delivery = await testDwmWebhookDestination(userId, req.params.id, req.body || {})
    if (!delivery) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }
    const destinations = await listDwmWebhookDestinations(userId, existing.orgId)
    const destination = destinations.find(item => item.id === req.params.id)
    const deliveries = await listDwmWebhookDeliveries(userId, existing.orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, existing.orgId)
    return res.status(202).send({
        delivery,
        preview: buildDwmWebhookDeliveryPreview(delivery),
        destinationCrud: destination
            ? buildDwmWebhookDestinationCrudContract({
                action: 'test',
                ownerId: userId,
                input: { ...(req.body || {}), orgId: existing.orgId },
                destination,
                destinations,
                deliveries,
                auditEvents,
                viewerRole: 'admin',
                canManage: true,
            })
            : null,
        destinationContract: destination
            ? buildDwmWebhookDestinationContracts({ destinations: [destination], deliveries, auditEvents })[0]
            : null,
        destinationHealth: destination
            ? buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents })[0]
            : null,
        destinationTest: destination
            ? buildDwmWebhookDestinationTestContract({
                destination,
                deliveries,
                auditEvents,
                viewerRole: 'admin',
                canManage: true,
            })
            : null,
        customerSetup: buildDwmWebhookCustomerSetupProof({
            destinations,
            deliveries,
            auditEvents,
            viewerRole: 'admin',
            canManage: true,
        }),
        destinationLifecycle: destination
            ? buildDwmWebhookDestinationLifecycle({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true })[0]
            : null,
        destinationAdminProof: destination
            ? buildDwmWebhookDestinationAdminProof({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true })
            : null,
        auditEventContracts: buildDwmWebhookAuditEventContracts({
            auditEvents,
            deliveries,
            destinations: destination ? [destination] : destinations,
        }),
    })
}

export async function getDwmWebhookDeliveries(req: FastifyRequest<{ Querystring: OrgQuery }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = orgIdFromQuery(req.query)
    const visibility = orgId && orgId !== userId ? await loadOrganizationVisibilityMembership(orgId, userId) : null
    if (orgId && orgId !== userId) {
        const decision = organizationVisibilityDecision({
            role: visibility?.role,
            status: visibility?.status,
            userActive: visibility?.user_active,
            alertVisibilityPolicy: visibility?.alert_visibility_policy,
        })
        if (!decision.allowed) {
            return res.status(decision.reason === 'not_member' ? 404 : 403).send({
                error: decision.reason === 'not_member' ? 'Organization not found.' : 'Webhook delivery evidence is not visible for this organization membership.',
                reason: decision.reason,
                alertVisibilityPolicy: decision.alertVisibilityPolicy,
                allowedRoles: decision.allowedRoles,
            })
        }
    }

    const alertId = clean(req.query?.alertId) || clean(req.query?.alert_id)
    const reportCaseId = clean(req.query?.reportCaseId) || clean(req.query?.report_case_id)
    const reportExportChecksum = clean(req.query?.reportExportChecksum) || clean(req.query?.report_export_checksum)
    const deliveries = await listDwmWebhookDeliveries(userId, orgId || undefined, {
        alertId,
        reportCaseId,
        reportExportChecksum,
    })
    const auditEvents = await listDwmWebhookAuditEvents(userId, orgId || undefined)
    const destinations = await listDwmWebhookDestinations(userId, orgId || undefined)
    const deliveryFilters = {
        orgId,
        destinationId: clean(req.query?.destinationId) || clean(req.query?.destination_id),
        alertId,
        casePath: clean(req.query?.casePath) || clean(req.query?.case_path),
        dedupeKey: clean(req.query?.dedupeKey) || clean(req.query?.dedupe_key),
        requestId: clean(req.query?.requestId) || clean(req.query?.request_id) || clean(req.query?.deliveryId) || clean(req.query?.delivery_id),
        idempotencyKey: clean(req.query?.idempotencyKey) || clean(req.query?.idempotency_key),
        action: clean(req.query?.action),
        status: clean(req.query?.status),
        timeFrom: clean(req.query?.timeFrom) || clean(req.query?.time_from),
        timeTo: clean(req.query?.timeTo) || clean(req.query?.time_to),
        retryState: clean(req.query?.retryState) || clean(req.query?.retry_state),
        actorId: clean(req.query?.actorId) || clean(req.query?.actor_id),
        reportCaseId,
        reportExportChecksum,
    }
    const evidence = buildDwmWebhookDeliveryEvidence({
        deliveries,
        auditEvents,
        filters: deliveryFilters,
    })
    const deliveryLedger = buildDwmWebhookDeliveryLedger({
        deliveries,
        auditEvents,
        filters: deliveryFilters,
    })
    const visibilityResult = orgId && orgId !== userId
        ? filterDwmWebhookDeliveryEvidenceForVisibility({
            evidence,
            visibility: {
                role: visibility?.role,
                status: visibility?.status,
                userActive: visibility?.user_active,
                alertVisibilityPolicy: visibility?.alert_visibility_policy,
            },
        })
        : null
    const payload: Record<string, unknown> = {
        deliveries,
        deliveryEvidence: visibilityResult ? visibilityResult.deliveryEvidence : evidence,
        deliveryLedger: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveryLedger,
        deliveryOperations: visibilityResult && !visibilityResult.decision.allowed
            ? {
                schemaVersion: 'dwm.webhook.delivery_operations.v1',
                liveDeliveryEnabled: process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
                filters: deliveryFilters,
                total: 0,
                counts: { queued: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0, live: 0, replay: 0, retryable: 0 },
                recentDeliveries: [],
            }
            : buildDwmWebhookDeliveryOperations({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
            }),
        deliveryHistory: visibilityResult && !visibilityResult.decision.allowed
            ? buildDwmWebhookDeliveryHistory({
                deliveries: [],
                auditEvents: [],
                destinations: [],
                filters: deliveryFilters,
            })
            : buildDwmWebhookDeliveryHistory({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
            }),
        deliveryHistoryConsumer: buildDwmWebhookDeliveryHistoryConsumerProof({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            filters: deliveryFilters,
        }),
        deliveryReadinessConsumer: buildDwmWebhookDeliveryReadinessConsumerProof({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            filters: deliveryFilters,
            ...destinationLifecycleAccess(orgId, userId, visibility),
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryPersistenceProof: visibilityResult && !visibilityResult.decision.allowed
            ? buildDwmWebhookDeliveryPersistenceProof({
                deliveries: [],
                auditEvents: [],
                destinations: [],
                filters: deliveryFilters,
            })
            : buildDwmWebhookDeliveryPersistenceProof({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
            }),
        deliveryAttemptPersistence: buildDwmWebhookDeliveryAttemptPersistenceReadModel({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            filters: deliveryFilters,
        }),
        deliveryReceipts: buildDwmWebhookDeliveryReceipts({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            filters: deliveryFilters,
            ...destinationLifecycleAccess(orgId, userId, visibility),
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryTimeline: buildDwmWebhookDeliveryTimeline({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            filters: deliveryFilters,
            ...destinationLifecycleAccess(orgId, userId, visibility),
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryActionPlan: buildDwmWebhookDeliveryActionPlan({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            filters: deliveryFilters,
            ...destinationLifecycleAccess(orgId, userId, visibility),
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryReplayGuard: buildDwmWebhookDeliveryReplayGuard({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            filters: deliveryFilters,
            ...destinationLifecycleAccess(orgId, userId, visibility),
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryReplayApi: buildDwmWebhookDeliveryReplayApiContract({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            filters: deliveryFilters,
            ...destinationLifecycleAccess(orgId, userId, visibility),
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryRetryPersistence: visibilityResult && !visibilityResult.decision.allowed
            ? buildDwmWebhookDeliveryRetryPersistence({
                deliveries: [],
                auditEvents: [],
                destinations: [],
                filters: deliveryFilters,
            })
            : buildDwmWebhookDeliveryRetryPersistence({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
            }),
        deliveryRetryQueue: visibilityResult && !visibilityResult.decision.allowed
            ? buildDwmWebhookDeliveryRetryQueue({
                deliveries: [],
                auditEvents: [],
                destinations: [],
                filters: deliveryFilters,
                ...destinationLifecycleAccess(orgId, userId, visibility),
                visibility: orgId && orgId !== userId
                    ? {
                        role: visibility?.role,
                        status: visibility?.status,
                        userActive: visibility?.user_active,
                        alertVisibilityPolicy: visibility?.alert_visibility_policy,
                    }
                    : null,
            })
            : buildDwmWebhookDeliveryRetryQueue({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
                ...destinationLifecycleAccess(orgId, userId, visibility),
                visibility: orgId && orgId !== userId
                    ? {
                        role: visibility?.role,
                        status: visibility?.status,
                        userActive: visibility?.user_active,
                        alertVisibilityPolicy: visibility?.alert_visibility_policy,
                    }
                    : null,
            }),
        deliveryRetryRequest: visibilityResult && !visibilityResult.decision.allowed
            ? buildDwmWebhookDeliveryRetryRequestContract({
                deliveries: [],
                auditEvents: [],
                destinations: [],
                filters: deliveryFilters,
                ...destinationLifecycleAccess(orgId, userId, visibility),
                visibility: orgId && orgId !== userId
                    ? {
                        role: visibility?.role,
                        status: visibility?.status,
                        userActive: visibility?.user_active,
                        alertVisibilityPolicy: visibility?.alert_visibility_policy,
                    }
                    : null,
            })
            : buildDwmWebhookDeliveryRetryRequestContract({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
                ...destinationLifecycleAccess(orgId, userId, visibility),
                visibility: orgId && orgId !== userId
                    ? {
                        role: visibility?.role,
                        status: visibility?.status,
                        userActive: visibility?.user_active,
                        alertVisibilityPolicy: visibility?.alert_visibility_policy,
                    }
                    : null,
            }),
        deliveryRetryWorkOrders: visibilityResult && !visibilityResult.decision.allowed
            ? buildDwmWebhookDeliveryRetryWorkOrders({
                deliveries: [],
                auditEvents: [],
                destinations: [],
                filters: deliveryFilters,
                ...destinationLifecycleAccess(orgId, userId, visibility),
                visibility: orgId && orgId !== userId
                    ? {
                        role: visibility?.role,
                        status: visibility?.status,
                        userActive: visibility?.user_active,
                        alertVisibilityPolicy: visibility?.alert_visibility_policy,
                    }
                    : null,
            })
            : buildDwmWebhookDeliveryRetryWorkOrders({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
                ...destinationLifecycleAccess(orgId, userId, visibility),
                visibility: orgId && orgId !== userId
                    ? {
                        role: visibility?.role,
                        status: visibility?.status,
                        userActive: visibility?.user_active,
                        alertVisibilityPolicy: visibility?.alert_visibility_policy,
                    }
                    : null,
            }),
        destinationDeliveryMatrix: buildDwmWebhookDestinationDeliveryMatrix({
            deliveries: visibilityResult && !visibilityResult.decision.allowed ? [] : deliveries,
            auditEvents: visibilityResult && !visibilityResult.decision.allowed ? [] : auditEvents,
            destinations: visibilityResult && !visibilityResult.decision.allowed ? [] : destinations,
            ...destinationLifecycleAccess(orgId, userId, visibility),
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryAuditTrail: visibilityResult && !visibilityResult.decision.allowed
            ? buildDwmWebhookDeliveryAuditTrail({
                deliveries: [],
                auditEvents: [],
                destinations: [],
                filters: deliveryFilters,
                ...destinationLifecycleAccess(orgId, userId, visibility),
                visibility: orgId && orgId !== userId
                    ? {
                        role: visibility?.role,
                        status: visibility?.status,
                        userActive: visibility?.user_active,
                        alertVisibilityPolicy: visibility?.alert_visibility_policy,
                    }
                    : null,
            })
            : buildDwmWebhookDeliveryAuditTrail({
                deliveries,
                auditEvents,
                destinations,
                filters: deliveryFilters,
                ...destinationLifecycleAccess(orgId, userId, visibility),
                visibility: orgId && orgId !== userId
                    ? {
                        role: visibility?.role,
                        status: visibility?.status,
                        userActive: visibility?.user_active,
                        alertVisibilityPolicy: visibility?.alert_visibility_policy,
                    }
                    : null,
            }),
        dashboardReadiness: buildDwmWebhookDashboardReadinessAdapter({
            destinations,
            deliveries,
            auditEvents,
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({
            destinations,
            deliveries,
            auditEvents,
        }),
        destinationHealth: buildDwmWebhookDestinationHealth({
            destinations,
            deliveries,
            auditEvents,
        }),
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({
            destinations,
            deliveries,
            auditEvents,
            ...destinationLifecycleAccess(orgId, userId, visibility),
        }),
        destinationAdminProof: buildDwmWebhookDestinationAdminProof({
            destinations,
            deliveries,
            auditEvents,
            ...destinationLifecycleAccess(orgId, userId, visibility),
            visibility: orgId && orgId !== userId
                ? {
                    role: visibility?.role,
                    status: visibility?.status,
                    userActive: visibility?.user_active,
                    alertVisibilityPolicy: visibility?.alert_visibility_policy,
                }
                : null,
        }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({
            auditEvents,
            deliveries,
            destinations,
        }),
        visibility: visibilityResult?.decision ?? {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members',
            allowedRoles: ['owner', 'admin', 'member', 'viewer'],
        },
    }
    if (req.query?.includeAudit === 'true') {
        payload.auditEvents = auditEvents
    }

    return res.send(payload)
}

export async function postDwmWebhookReceiver(req: FastifyRequest<{ Body: unknown }>, res: FastifyReply) {
    if (!serviceTokenMatches(req.headers['x-hanasand-service-token'])) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const result = await recordDwmWebhookReceiverReceipt(req.body)
    if (!result.ok) return res.status(result.status).send({ accepted: false, error: result.error })
    return res.status(result.created ? 201 : 200).send({
        accepted: true,
        created: result.created,
        receipt: result.receipt,
    })
}

export async function getDwmWebhookReceiverReceipts(req: FastifyRequest<{ Querystring: OrgQuery }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = orgIdFromQuery(req.query)
    if (!orgId) return res.status(400).send({ error: 'orgId is required.' })
    const visibility = orgId !== userId ? await loadOrganizationVisibilityMembership(orgId, userId) : null
    if (orgId !== userId) {
        const decision = organizationVisibilityDecision({
            role: visibility?.role,
            status: visibility?.status,
            userActive: visibility?.user_active,
            alertVisibilityPolicy: visibility?.alert_visibility_policy,
        })
        if (!decision.allowed) {
            return res.status(decision.reason === 'not_member' ? 404 : 403).send({
                error: decision.reason === 'not_member' ? 'Organization not found.' : 'Receiver receipts are not visible for this organization membership.',
                reason: decision.reason,
            })
        }
    }

    const receipts = await listDwmWebhookReceiverReceipts(orgId, {
        destinationId: req.query.destinationId || req.query.destination_id,
        deliveryId: req.query.deliveryId || req.query.delivery_id,
        reportCaseId: req.query.reportCaseId || req.query.report_case_id,
        reportExportChecksum: req.query.reportExportChecksum || req.query.report_export_checksum,
    })
    return res.send({
        schemaVersion: 'dwm.webhook.receiver_receipts.v1',
        orgId,
        total: receipts.length,
        receipts,
    })
}

export async function postDwmWebhookDelivery(req: FastifyRequest<{ Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    let input = buildDwmWebhookDeliveryRequestInput(req.body || {})
    const orgId = clean(input.orgId) || clean(input.organizationId) || clean(input.tenantId) || userId
    const permissionError = await configurationPermissionError(orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const retryDeliveryId = clean(req.body?.deliveryId)
    if (retryDeliveryId) {
        const retry = await retryDwmWebhookDelivery(userId, orgId, retryDeliveryId)
        if (!retry.ok) return res.status(retry.status).send({ error: retry.error, code: retry.code, ...('nextRetryAt' in retry ? { nextRetryAt: retry.nextRetryAt } : {}) })
        input = { ...input, alertId: retry.delivery.alertId, destinationId: retry.delivery.destinationId }
        return sendDwmWebhookDeliveryResult(res, userId, orgId, input, [retry.delivery])
    }

    const submittedReport = req.body?.alert?.report
    if (submittedReport !== undefined) {
        const destinationId = clean(input.destinationId) || clean(input.destination_id)
        if (!destinationId) {
            return res.status(400).send({ error: 'Select one configured destination for third-party report delivery.', code: 'report_destination_required' })
        }
        const canonical = await canonicalThirdPartyReportForDelivery({
            submittedReport,
            organizationId: orgId,
            alertId: req.body?.alert?.id,
            dedupeKey: req.body?.alert?.dedupeKey,
            actorId: userId,
            authorization: clean(req.headers.authorization),
        })
        if (!canonical.report) return res.status(canonical.status).send({ error: canonical.error, code: canonical.code })
        input = {
            ...input,
            destinationId,
            dedupeKey: canonical.report.exportChecksum,
            alert: {
                ...input.alert,
                report: canonical.report,
                dedupeKey: canonical.report.exportChecksum,
                evidenceCount: Number((canonical.report.reportPolicy as Record<string, unknown>).evidenceCount),
            },
        }
    }

    const orgName = orgId === userId ? undefined : await loadOrganizationName(orgId)
    const deliveries = await triggerDwmAlertWebhookNotification(userId, { ...input.alert, ...input, orgId, orgName }, input)
    return sendDwmWebhookDeliveryResult(res, userId, orgId, input, deliveries)
}

async function sendDwmWebhookDeliveryResult(res: FastifyReply, userId: string, orgId: string, input: DwmAlertNotificationInput, deliveries: Awaited<ReturnType<typeof triggerDwmAlertWebhookNotification>>) {
    const destinations = await listDwmWebhookDestinations(userId, orgId)
    const ledgerDeliveries = await listDwmWebhookDeliveries(userId, orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, orgId)
    return res.status(202).send({
        deliveries,
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
        }),
        destinationHealth: buildDwmWebhookDestinationHealth({ destinations, deliveries: ledgerDeliveries, auditEvents }),
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations, deliveries: ledgerDeliveries, auditEvents, viewerRole: 'admin', canManage: true }),
        destinationAdminProof: buildDwmWebhookDestinationAdminProof({
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryOperations: buildDwmWebhookDeliveryOperations({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
        }),
        deliveryHistory: buildDwmWebhookDeliveryHistory({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
        }),
        deliveryReadinessConsumer: buildDwmWebhookDeliveryReadinessConsumerProof({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryPersistenceProof: buildDwmWebhookDeliveryPersistenceProof({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
        }),
        deliveryAttemptContract: buildDwmWebhookDeliveryAttemptContract({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
        }),
        deliveryAttemptPersistence: buildDwmWebhookDeliveryAttemptPersistenceProof({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
        }),
        deliveryReceipts: buildDwmWebhookDeliveryReceipts({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryTimeline: buildDwmWebhookDeliveryTimeline({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryActionPlan: buildDwmWebhookDeliveryActionPlan({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryReplayGuard: buildDwmWebhookDeliveryReplayGuard({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryRetry: buildDwmWebhookDeliveryRetryContract({
            ownerId: userId,
            input: { ...input, orgId },
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            canManage: true,
        }),
        deliveryRetryPersistence: buildDwmWebhookDeliveryRetryPersistence({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
        }),
        deliveryRetryQueue: buildDwmWebhookDeliveryRetryQueue({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryRetryRequest: buildDwmWebhookDeliveryRetryRequestContract({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryRetryWorkOrders: buildDwmWebhookDeliveryRetryWorkOrders({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        destinationDeliveryMatrix: buildDwmWebhookDestinationDeliveryMatrix({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            viewerRole: 'admin',
            canManage: true,
        }),
        deliveryAuditTrail: buildDwmWebhookDeliveryAuditTrail({
            deliveries: ledgerDeliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: clean(input.destinationId) || clean(input.destination_id),
                alertId: clean(input.alertId) || clean(input.alert?.id),
                casePath: clean(input.casePath) || clean(input.caseUrl) || clean(input.alert?.casePath),
                dedupeKey: clean(input.dedupeKey) || clean(input.alert?.dedupeKey),
            },
            viewerRole: 'admin',
            canManage: true,
        }),
        dashboardReadiness: buildDwmWebhookDashboardReadinessAdapter({
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            visibility: null,
        }),
        orgAlertDelivery: buildDwmOrgAlertWebhookDeliveryContract({
            ownerId: userId,
            input,
            destinations,
            deliveries: ledgerDeliveries,
            auditEvents,
            viewerRole: 'admin',
            canManage: true,
        }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({ auditEvents, deliveries: ledgerDeliveries, destinations }),
        dryRunDefault: true,
        liveDeliveryEnabled: process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    })
}

export async function canonicalThirdPartyReportForDelivery(input: {
    submittedReport: unknown
    organizationId: string
    alertId: unknown
    dedupeKey: unknown
    actorId: string
    authorization?: string
}, fetcher: typeof fetch = fetch) {
    const submitted = validateOutboundThirdPartyReport(input.submittedReport, {
        organizationId: input.organizationId,
        alertId: input.alertId,
        dedupeKey: input.dedupeKey,
    })
    if (!submitted.valid || !submitted.report) {
        return { status: 400, code: 'invalid_third_party_report', error: submitted.error || 'The submitted report is invalid.' }
    }

    const policy = submitted.report.reportPolicy as Record<string, unknown>
    const caseId = clean(policy.caseId)
    const alertId = clean(policy.alertId)
    const evidenceIds = Array.isArray(policy.evidenceIds) ? policy.evidenceIds.map(clean).filter(Boolean) : []
    const format = clean(policy.format) === 'hanasand-json' ? 'json' : 'stix'
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN
    if (!base || !token) {
        return { status: 503, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification is not configured.' }
    }

    let url: URL
    try {
        url = new URL(`${base}/v1/cases/${encodeURIComponent(caseId)}/export`)
    } catch {
        return { status: 503, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification is not configured.' }
    }
    url.searchParams.set('organizationId', input.organizationId)
    url.searchParams.set('alertId', alertId)
    url.searchParams.set('report', 'true')
    url.searchParams.set('format', format)
    for (const evidenceId of evidenceIds) url.searchParams.append('evidenceId', evidenceId)
    let response: Response
    try {
        response = await fetcher(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
                'x-hanasand-service-token': token,
                'x-organization-id': input.organizationId,
                id: input.actorId,
                ...(input.authorization ? { authorization: input.authorization } : {}),
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(20_000),
        })
    } catch {
        return { status: 503, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification is temporarily unavailable.' }
    }
    let payload: Record<string, unknown>
    try {
        payload = await response.json() as Record<string, unknown>
    } catch {
        return { status: 502, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification returned an invalid response.' }
    }
    if (!response.ok) {
        if (response.status >= 500) {
            return { status: 502, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification is temporarily unavailable.' }
        }
        return {
            status: response.status >= 400 && response.status < 500 ? response.status : 502,
            code: 'canonical_third_party_report_rejected',
            error: 'Canonical report verification rejected the requested case evidence.',
        }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { status: 502, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification returned an invalid response.' }
    }

    const canonicalPolicy = payload.reportPolicy as Record<string, unknown>
    const canonicalChecksum = clean(payload.exportChecksum)
    const canonical = validateOutboundThirdPartyReport(payload, {
        organizationId: input.organizationId,
        alertId,
        dedupeKey: canonicalChecksum,
    })
    const exactSelection = clean(canonicalPolicy.caseId) === caseId
        && clean(canonicalPolicy.alertId) === alertId
        && clean(canonicalPolicy.format) === clean(policy.format)
        && JSON.stringify(canonicalPolicy.evidenceIds) === JSON.stringify(evidenceIds)
    if (!canonical.valid || !canonical.report || !exactSelection) {
        return { status: 502, code: 'canonical_third_party_report_invalid', error: canonical.error || 'The canonical report did not match the requested case evidence.' }
    }
    if (canonicalChecksum !== clean(submitted.report.exportChecksum)) {
        return { status: 409, code: 'third_party_report_checksum_mismatch', error: 'The submitted report checksum does not match the canonical case export.' }
    }
    return { status: 200, report: canonical.report }
}

async function authenticatedUserId(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    return id
}

function serviceTokenMatches(value: string | string[] | undefined) {
    const expected = process.env.TI_SCRAPER_SERVICE_TOKEN || ''
    const presented = Array.isArray(value) ? value[0] || '' : value || ''
    const expectedBytes = Buffer.from(expected)
    const presentedBytes = Buffer.from(presented)
    return expectedBytes.length > 0
        && expectedBytes.length === presentedBytes.length
        && timingSafeEqual(expectedBytes, presentedBytes)
}

async function updatePreview(destinationId: string, userId: string) {
    const destinations = await run(`
        SELECT id, org_id
        FROM dwm_webhook_destinations
        WHERE id = $1
          AND status <> 'archived'
          AND (
              owner_id = $2
              OR org_id IN (
                  SELECT organization_id
                  FROM organization_members
                  WHERE user_id = $2
                    AND status = 'active'
              )
          )
        LIMIT 1
    `, [destinationId, userId])

    const row = destinations.rows[0] as { id: string, org_id: string } | undefined
    return row ? { id: row.id, orgId: row.org_id } : null
}

async function configurationPermissionError(orgId: string, userId: string) {
    if (!orgId || orgId === userId) return null
    const membership = await loadOrganizationMembership(orgId, userId)
    if (!membership) {
        return { status: 404, message: 'Organization not found.' }
    }
    if (membership.privacy_deletion_run_id || membership.organization_status !== 'active') {
        return { status: 409, message: membership.privacy_deletion_run_id ? 'Organization deletion is in progress; writes are blocked.' : 'Organization lifecycle blocks webhook changes.' }
    }
    if (!roleCanManageOrganization(membership.role)) {
        return { status: 403, message: 'Only organization owners and admins can configure webhook destinations.' }
    }
    return null
}

function destinationLifecycleAccess(orgId: string, userId: string, membership: Membership | null) {
    const role = orgId && orgId !== userId ? membership?.role || null : 'owner'
    return {
        viewerRole: role,
        canManage: roleCanManageOrganization(role || undefined),
    }
}

function destinationCrudActionForUpdate(input: DwmWebhookDestinationInput, destination: { status?: string } | null) {
    const nextStatus = clean(input.status)
    if (destination && destination.status !== 'active' && nextStatus === 'active') return 'enable' as const
    return 'update' as const
}

async function loadOrganizationMembership(orgId: string, userId: string): Promise<Membership | null> {
    const result = await run(`
        SELECT member.role, organization.status AS organization_status,
               organization.audit_safe_metadata->>'privacyDeletionRunId' AS privacy_deletion_run_id
        FROM organization_members member
        JOIN organizations organization ON organization.id = member.organization_id
        WHERE member.organization_id = $1
          AND member.user_id = $2
          AND member.status = 'active'
        LIMIT 1
    `, [orgId, userId])

    return result.rows[0] as Membership | undefined || null
}

async function loadOrganizationName(orgId: string): Promise<string | undefined> {
    const result = await run('SELECT name FROM organizations WHERE id = $1 LIMIT 1', [orgId])
    return clean((result.rows[0] as { name?: string } | undefined)?.name) || undefined
}

async function loadOrganizationVisibilityMembership(orgId: string, userId: string): Promise<Membership | null> {
    const result = await run(`
        SELECT
            om.role,
            om.status,
            u.active AS user_active,
            o.alert_visibility_policy
        FROM organizations o
        LEFT JOIN organization_members om
          ON om.organization_id = o.id
         AND om.user_id = $2
        LEFT JOIN users u
          ON u.id = $2
        WHERE o.id = $1
        LIMIT 1
    `, [orgId, userId])

    return result.rows[0] as Membership | undefined || null
}

function orgIdFromQuery(query: OrgQuery | undefined) {
    return clean(query?.orgId) || clean(query?.org_id)
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
