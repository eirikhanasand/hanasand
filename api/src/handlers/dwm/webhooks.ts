import type { FastifyReply, FastifyRequest } from 'fastify'
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
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookDestinationCrudContract,
    buildDwmWebhookDestinationAdminProof,
    buildDwmWebhookDestinationDeliveryMatrix,
    buildDwmWebhookDestinationHealth,
    buildDwmWebhookDestinationLifecycle,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDestinationContracts,
    buildDwmWebhookDestinationTestContract,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryHistory,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryReceipts,
    buildDwmWebhookDeliveryReplayGuard,
    buildDwmWebhookDeliveryTimeline,
    buildDwmWebhookDeliveryRetryPersistence,
    buildDwmWebhookDeliveryRetryQueue,
    buildDwmWebhookDeliveryRetryRequestContract,
    buildDwmWebhookDeliveryRetryWorkOrders,
    buildDwmWebhookDeliveryRequestInput,
    buildDwmWebhookDeliveryRetryContract,
    createDwmWebhookDestination,
    buildDwmWebhookDeliveryReadiness,
    deliverDwmAlertNotification,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    testDwmWebhookDestination,
    updateDwmWebhookDestination,
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
}

type Membership = {
    role: OrganizationRole
    status?: 'active' | 'removed'
    user_active?: boolean
    alert_visibility_policy?: OrganizationAlertVisibilityPolicy
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
    const permissionError = await configurationPermissionError(nextOrgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    try {
        const currentDestinations = await listDwmWebhookDestinations(userId, nextOrgId)
        const destinationBefore = currentDestinations.find(item => item.id === req.params.id) || null
        const action = destinationCrudActionForUpdate(req.body, destinationBefore)
        const preflightCrud = buildDwmWebhookDestinationCrudContract({
            action,
            ownerId: userId,
            input: { ...req.body, orgId: nextOrgId },
            destination: destinationBefore,
            destinations: currentDestinations,
            deliveries: await listDwmWebhookDeliveries(userId, nextOrgId),
            auditEvents: await listDwmWebhookAuditEvents(userId, nextOrgId),
            viewerRole: 'admin',
            canManage: true,
        })
        if (!preflightCrud.canApply) {
            return res.status(400).send({
                error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be updated.',
                destinationCrud: preflightCrud,
            })
        }

        const destination = await updateDwmWebhookDestination(userId, req.params.id, { ...req.body, orgId: nextOrgId })
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
        action: 'disable',
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
            error: preflightCrud.blockers[0]?.message || 'Webhook destination cannot be disabled.',
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
            action: 'disable',
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

    const deliveries = await listDwmWebhookDeliveries(userId, orgId || undefined)
    const auditEvents = await listDwmWebhookAuditEvents(userId, orgId || undefined)
    const destinations = await listDwmWebhookDestinations(userId, orgId || undefined)
    const deliveryFilters = {
        orgId,
        destinationId: clean(req.query?.destinationId) || clean(req.query?.destination_id),
        alertId: clean(req.query?.alertId) || clean(req.query?.alert_id),
        casePath: clean(req.query?.casePath) || clean(req.query?.case_path),
        dedupeKey: clean(req.query?.dedupeKey) || clean(req.query?.dedupe_key),
        requestId: clean(req.query?.requestId) || clean(req.query?.request_id) || clean(req.query?.deliveryId) || clean(req.query?.delivery_id),
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

export async function postDwmWebhookDelivery(req: FastifyRequest<{ Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const input = buildDwmWebhookDeliveryRequestInput(req.body || {})
    const orgId = clean(input.orgId) || clean(input.organizationId) || clean(input.tenantId) || userId
    const permissionError = await configurationPermissionError(orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const deliveries = await deliverDwmAlertNotification(userId, { ...input, orgId })
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

async function authenticatedUserId(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    return id
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
    if (!roleCanManageOrganization(membership.role)) {
        return { status: 403, message: 'Only organization owners and admins can configure webhook destinations.' }
    }
    return null
}

async function memberPermissionError(orgId: string, userId: string) {
    if (!orgId || orgId === userId) return null
    const membership = await loadOrganizationMembership(orgId, userId)
    if (!membership) {
        return { status: 404, message: 'Organization not found.' }
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
        SELECT role
        FROM organization_members
        WHERE organization_id = $1
          AND user_id = $2
          AND status = 'active'
        LIMIT 1
    `, [orgId, userId])

    return result.rows[0] as Membership | undefined || null
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
