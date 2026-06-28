import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { roleCanManageOrganization, type OrganizationRole } from '#utils/organizations.ts'
import {
    archiveDwmWebhookDestination,
    createDwmWebhookDestination,
    deliverDwmAlertNotification,
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
}

type Membership = {
    role: OrganizationRole
}

export async function getDwmWebhookDestinations(req: FastifyRequest<{ Querystring: OrgQuery }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = orgIdFromQuery(req.query)
    if (orgId && orgId !== userId && !await loadOrganizationMembership(orgId, userId)) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    return res.send({ destinations: await listDwmWebhookDestinations(userId, orgId || undefined) })
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
        return res.status(201).send({ destination })
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
        return res.send({ destination })
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
    return res.send({ destination })
}

export async function postDwmWebhookDestinationTest(req: FastifyRequest<{ Params: IdParams, Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const existing = await updatePreview(req.params.id, userId)
    if (!existing) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }

    const permissionError = await memberPermissionError(existing.orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const delivery = await testDwmWebhookDestination(userId, req.params.id, req.body || {})
    if (!delivery) {
        return res.status(404).send({ error: 'Webhook destination not found.' })
    }
    return res.status(202).send({ delivery })
}

export async function getDwmWebhookDeliveries(req: FastifyRequest<{ Querystring: OrgQuery }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = orgIdFromQuery(req.query)
    if (orgId && orgId !== userId && !await loadOrganizationMembership(orgId, userId)) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const payload: Record<string, unknown> = {
        deliveries: await listDwmWebhookDeliveries(userId, orgId || undefined),
    }
    if (req.query?.includeAudit === 'true') {
        payload.auditEvents = await listDwmWebhookAuditEvents(userId, orgId || undefined)
    }

    return res.send(payload)
}

export async function postDwmWebhookDelivery(req: FastifyRequest<{ Body: DwmAlertNotificationInput }>, res: FastifyReply) {
    const userId = await authenticatedUserId(req, res)
    if (!userId) return

    const orgId = clean(req.body?.orgId) || clean(req.body?.organizationId) || clean(req.body?.tenantId) || userId
    const permissionError = await memberPermissionError(orgId, userId)
    if (permissionError) {
        return res.status(permissionError.status).send({ error: permissionError.message })
    }

    const deliveries = await deliverDwmAlertNotification(userId, { ...req.body, orgId })
    return res.status(202).send({
        deliveries,
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

function orgIdFromQuery(query: OrgQuery | undefined) {
    return clean(query?.orgId) || clean(query?.org_id)
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
