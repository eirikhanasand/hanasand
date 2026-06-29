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
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookDestinationHealth,
    buildDwmWebhookDestinationLifecycle,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDestinationContracts,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryRequestInput,
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
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations, deliveries, auditEvents, ...lifecycleAccess }),
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({ destinations, deliveries, auditEvents }),
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

    try {
        const destination = await createDwmWebhookDestination(userId, { ...req.body, orgId })
        const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
        return res.status(201).send({
            destination,
            destinationContract: buildDwmWebhookDestinationContracts({ destinations: [destination], auditEvents })[0],
            destinationHealth: buildDwmWebhookDestinationHealth({ destinations: [destination], auditEvents })[0],
            destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: [destination], auditEvents, viewerRole: 'owner', canManage: true })[0],
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
        const destination = await updateDwmWebhookDestination(userId, req.params.id, { ...req.body, orgId: nextOrgId })
        if (!destination) {
            return res.status(404).send({ error: 'Webhook destination not found.' })
        }
        const deliveries = await listDwmWebhookDeliveries(userId, destination.orgId)
        const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
        return res.send({
            destination,
            destinationContract: buildDwmWebhookDestinationContracts({ destinations: [destination], deliveries, auditEvents })[0],
            destinationHealth: buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents })[0],
            destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true })[0],
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

    const destination = await archiveDwmWebhookDestination(userId, req.params.id)
    if (!destination) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }
    const deliveries = await listDwmWebhookDeliveries(userId, destination.orgId)
    const auditEvents = await listDwmWebhookAuditEvents(userId, destination.orgId)
    return res.send({
        destination,
        destinationContract: buildDwmWebhookDestinationContracts({ destinations: [destination], deliveries, auditEvents })[0],
        destinationHealth: buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents })[0],
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true })[0],
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
        destinationContract: destination
            ? buildDwmWebhookDestinationContracts({ destinations: [destination], deliveries, auditEvents })[0]
            : null,
        destinationHealth: destination
            ? buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents })[0]
            : null,
        destinationLifecycle: destination
            ? buildDwmWebhookDestinationLifecycle({ destinations: [destination], deliveries, auditEvents, viewerRole: 'admin', canManage: true })[0]
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
    const evidence = buildDwmWebhookDeliveryEvidence({
        deliveries,
        auditEvents,
        filters: {
            orgId,
            destinationId: clean(req.query?.destinationId) || clean(req.query?.destination_id),
            alertId: clean(req.query?.alertId) || clean(req.query?.alert_id),
            casePath: clean(req.query?.casePath) || clean(req.query?.case_path),
            dedupeKey: clean(req.query?.dedupeKey) || clean(req.query?.dedupe_key),
        },
    })
    const deliveryLedger = buildDwmWebhookDeliveryLedger({
        deliveries,
        auditEvents,
        filters: {
            orgId,
            destinationId: clean(req.query?.destinationId) || clean(req.query?.destination_id),
            alertId: clean(req.query?.alertId) || clean(req.query?.alert_id),
            casePath: clean(req.query?.casePath) || clean(req.query?.case_path),
            dedupeKey: clean(req.query?.dedupeKey) || clean(req.query?.dedupe_key),
        },
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
        deliveryReadiness: buildDwmWebhookDeliveryReadiness({
            destinations: await listDwmWebhookDestinations(userId, orgId || undefined),
            deliveries,
            auditEvents,
        }),
        destinationHealth: buildDwmWebhookDestinationHealth({
            destinations: await listDwmWebhookDestinations(userId, orgId || undefined),
            deliveries,
            auditEvents,
        }),
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({
            destinations: await listDwmWebhookDestinations(userId, orgId || undefined),
            deliveries,
            auditEvents,
            ...destinationLifecycleAccess(orgId, userId, visibility),
        }),
        auditEventContracts: buildDwmWebhookAuditEventContracts({
            auditEvents,
            deliveries,
            destinations: await listDwmWebhookDestinations(userId, orgId || undefined),
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
    const permissionError = await memberPermissionError(orgId, userId)
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
        destinationLifecycle: buildDwmWebhookDestinationLifecycle({ destinations, deliveries: ledgerDeliveries, auditEvents, viewerRole: 'member', canManage: false }),
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
