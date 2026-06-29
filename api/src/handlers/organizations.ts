import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import recordLog from '#utils/logs/recordLog.ts'
import {
    buildOrganizationBridgeContext,
    buildOrganizationDwmAlertReference,
    normalizeInviteActionInput,
    normalizeInviteInput,
    normalizeMemberRoleInput,
    normalizeOrganizationInput,
    normalizeOrganizationSettingsInput,
    normalizeOwnershipTransferInput,
    normalizeWatchlistActionInput,
    normalizeWatchlistCleanupInput,
    normalizeWatchlistInput,
    normalizeWatchlistRequestId,
    organizationAnalystPortalVisibilityAdapter,
    organizationAlertCaseWorkflowState,
    organizationAccessDenial,
    organizationInviteActionDenial,
    organizationInviteAcceptanceDenial,
    organizationInviteManagementDenial,
    organizationLastOwnerGuard,
    organizationLifecycleReadiness,
    organizationMemberMutationDenial,
    organizationDownstreamAuthorizationExport,
    organizationMemberAccessContract,
    organizationReadinessProof,
    organizationSettingsFromRow,
    organizationSettingsMutationDenial,
    organizationSharedWatchlistDownstreamProof,
    organizationVisibilityDecision,
    organizationWatchlistAlertGenerationContract,
    organizationWatchlistAlertTermsExport,
    organizationWatchlistAlertTermsExportDenial,
    organizationWatchlistMutationDenial,
    roleCanManageOrganization,
    roleCanWriteWatchlist,
    toInvite,
    toMember,
    toOrganization,
    toWatchlistItem,
    type OrganizationInviteRow,
    type OrganizationMemberRow,
    type OrganizationRole,
    type OrganizationRow,
    type InviteActionInput,
    type InviteInput,
    type OrganizationMemberRoleInput,
    type OrganizationInput,
    type OrganizationOwnershipTransferInput,
    type OrganizationSettingsInput,
    type WatchlistActionInput,
    type WatchlistCleanupInput,
    type WatchlistKind,
    type WatchlistInput,
    type OrganizationWatchlistAction,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'

type OrganizationParams = {
    id: string
}

type OrganizationMemberParams = {
    id: string
    userId: string
}

type InviteParams = {
    inviteId: string
}

type OrganizationInviteParams = OrganizationParams & InviteParams

type WatchlistParams = {
    organizationId: string
    itemId: string
}

type WatchlistQuery = {
    kind?: string
    status?: string
    includeArchived?: string
    include_archived?: string
}

type WatchlistMutationBody = WatchlistInput & {
    requestId?: unknown
    request_id?: unknown
}

type BulkInviteResult = {
    email: string
    role: OrganizationRole
    outcome: 'invited' | 'updated_pending_invite' | 'already_member' | 'blocked_removed_member' | 'blocked_deactivated_user'
    inviteId?: string
    acceptanceToken?: string
    acceptancePath?: string
    userId?: string
    memberRole?: OrganizationRole
    reason?: string
}

export async function getOrganizations(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const result = await run(`
        SELECT
            o.*,
            om.role,
            COUNT(DISTINCT active_member_users.id)::int AS member_count,
            COUNT(DISTINCT active_owner_users.id)::int AS owner_count,
            COUNT(DISTINCT active_admin_users.id)::int AS admin_count,
            COUNT(DISTINCT pending_invites.id)::int AS pending_invite_count,
            COUNT(DISTINCT active_watchlist_items.id)::int AS shared_watchlist_count
        FROM organizations o
        JOIN organization_members om
          ON om.organization_id = o.id
         AND om.user_id = $1
         AND om.status = 'active'
        JOIN users current_user
          ON current_user.id = om.user_id
         AND current_user.active = TRUE
        LEFT JOIN organization_members active_members
          ON active_members.organization_id = o.id
         AND active_members.status = 'active'
        LEFT JOIN users active_member_users
          ON active_member_users.id = active_members.user_id
         AND active_member_users.active = TRUE
        LEFT JOIN organization_members active_owners
          ON active_owners.organization_id = o.id
         AND active_owners.status = 'active'
         AND active_owners.role = 'owner'
        LEFT JOIN users active_owner_users
          ON active_owner_users.id = active_owners.user_id
         AND active_owner_users.active = TRUE
        LEFT JOIN organization_members active_admins
          ON active_admins.organization_id = o.id
         AND active_admins.status = 'active'
         AND active_admins.role IN ('owner', 'admin')
        LEFT JOIN users active_admin_users
          ON active_admin_users.id = active_admins.user_id
         AND active_admin_users.active = TRUE
        LEFT JOIN organization_invites pending_invites
          ON pending_invites.organization_id = o.id
         AND pending_invites.status = 'pending'
         AND pending_invites.expires_at > NOW()
        LEFT JOIN organization_watchlist_items active_watchlist_items
          ON active_watchlist_items.organization_id = o.id
         AND active_watchlist_items.archived_at IS NULL
         AND active_watchlist_items.status = 'active'
        GROUP BY o.id, om.role
        ORDER BY o.updated_at DESC, o.created_at DESC
    `, [userId])

    return res.send({ organizations: (result.rows as OrganizationRow[]).map(toOrganization) })
}

export async function postOrganization(req: FastifyRequest<{ Body: OrganizationInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    let input
    try {
        input = normalizeOrganizationInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid organization.' })
    }

    const organizationId = randomUUID()
    const slug = await uniqueOrganizationSlug(input.slug)
    const organization = await run(`
        WITH new_organization AS (
            INSERT INTO organizations (id, name, slug, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        ),
        owner_membership AS (
            INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
            SELECT id, $4, 'owner', 'active', $4
            FROM new_organization
            ON CONFLICT (organization_id, user_id)
            DO UPDATE SET role = 'owner', status = 'active'
            RETURNING organization_id
        )
        SELECT new_organization.*
        FROM new_organization
        JOIN owner_membership ON owner_membership.organization_id = new_organization.id
    `, [organizationId, input.name, slug, userId])
    logOrganizationEvent(req, 'organization_created', organizationId, userId, {
        name: input.name,
        slug,
    })

    const createdOrganization: OrganizationRow = {
        ...(organization.rows[0] as OrganizationRow),
        role: 'owner',
        member_count: 1,
        owner_count: 1,
        admin_count: 1,
        pending_invite_count: 0,
    }
    return res.status(201).send({
        organization: toOrganization(createdOrganization),
        lifecycleReadiness: organizationLifecycleReadiness(createdOrganization),
    })
}

export async function getOrganization(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        const denial = organizationAccessDenial({
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id',
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            route: denial.route,
            blockerCode: denial.blockerCode,
            denialReason: denial.denialReason,
        })
        return res.status(denial.statusCode).send({ error: denial.message, organizationAccessDenial: denial })
    }

    return res.send({
        organization: toOrganization(organization),
        lifecycleReadiness: organizationLifecycleReadiness(organization),
    })
}

export async function getOrganizationSettings(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    return res.send({
        organization: toOrganization(organization),
        settings: organizationSettingsFromRow(organization),
        permissions: organizationSettingsPermissions(organization.role),
        lifecycleReadiness: organizationLifecycleReadiness(organization),
    })
}

export async function putOrganizationSettings(req: FastifyRequest<{ Params: OrganizationParams, Body: OrganizationSettingsInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanManageOrganization(organization.role)) {
        const attemptedFields = Object.entries({
            name: req.body?.name,
            slug: req.body?.slug,
            defaultWebhookPolicy: req.body?.defaultWebhookPolicy ?? req.body?.default_webhook_policy,
            alertVisibilityPolicy: req.body?.alertVisibilityPolicy ?? req.body?.alert_visibility_policy,
            lifecycleStatus: req.body?.lifecycleStatus ?? req.body?.lifecycle_status,
            retentionDays: req.body?.retentionDays ?? req.body?.retention_days,
            auditSafeMetadata: req.body?.auditSafeMetadata ?? req.body?.audit_safe_metadata,
        }).filter(([, value]) => value !== undefined).map(([key]) => key)
        const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null
        const message = 'Only organization owners and admins can update settings.'
        const denial = organizationSettingsMutationDenial({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            attemptedFields,
            requestId,
            message,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            actorRole: organization.role,
            attemptedFields: denial.attemptedFields,
            denialReason: denial.denialReason,
        })
        return res.status(403).send({ error: message, settingsMutationDenial: denial })
    }

    let input
    try {
        input = normalizeOrganizationSettingsInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid organization settings.' })
    }

    const slug = input.slug ? await uniqueOrganizationSlug(input.slug, req.params.id) : undefined
    await run(`
        UPDATE organizations
        SET name = COALESCE($2, name),
            slug = COALESCE($3, slug),
            default_webhook_policy = COALESCE($4, default_webhook_policy),
            alert_visibility_policy = COALESCE($5, alert_visibility_policy),
            status = COALESCE($6, status),
            retention_days = COALESCE($7, retention_days),
            audit_safe_metadata = COALESCE($8::jsonb, audit_safe_metadata),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `, [
        req.params.id,
        input.name ?? null,
        slug ?? null,
        input.defaultWebhookPolicy ?? null,
        input.alertVisibilityPolicy ?? null,
        input.lifecycleStatus ?? null,
        input.retentionDays ?? null,
        input.auditSafeMetadata === undefined ? null : JSON.stringify(input.auditSafeMetadata),
    ])

    logOrganizationEvent(req, 'organization_settings_updated', req.params.id, userId, {
        fields: Object.entries({
            name: input.name,
            slug,
            defaultWebhookPolicy: input.defaultWebhookPolicy,
            alertVisibilityPolicy: input.alertVisibilityPolicy,
            lifecycleStatus: input.lifecycleStatus,
            retentionDays: input.retentionDays,
            auditSafeMetadata: input.auditSafeMetadata === undefined ? undefined : Object.keys(input.auditSafeMetadata),
        }).filter(([, value]) => value !== undefined).map(([key]) => key),
    })

    const updated = await loadOrganizationForMember(req.params.id, userId)
    return res.send({
        organization: updated ? toOrganization(updated) : null,
        settings: updated ? organizationSettingsFromRow(updated) : null,
        permissions: organizationSettingsPermissions(updated?.role),
        lifecycleReadiness: updated ? organizationLifecycleReadiness(updated) : null,
    })
}

export async function getOrganizationInvites(req: FastifyRequest<{ Params: OrganizationParams, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanManageOrganization(organization.role)) {
        return sendInviteManagementDenial(req, res, organization, userId, {
            action: 'list_invites',
            requestId: typeof req.query?.requestId === 'string' ? req.query.requestId : typeof req.query?.request_id === 'string' ? req.query.request_id : null,
            message: 'Only organization owners and admins can view invites.',
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE organization_id = $1
          AND status = 'pending'
          AND expires_at > NOW()
        ORDER BY status ASC, created_at DESC
    `, [req.params.id])

    const invites = result.rows as OrganizationInviteRow[]

    return res.send({
        invites: invites.map(toInvite),
        inviteLifecycleContract: organizationInviteListContract(organization, invites),
    })
}

export async function getOrganizationMembers(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const result = await run(`
        SELECT
            om.organization_id,
            om.user_id,
            u.name,
            u.avatar,
            om.role,
            om.status,
            om.invited_by,
            om.joined_at,
            om.created_at
        FROM organization_members om
        JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1
          AND om.status = 'active'
        ORDER BY
            CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
            om.joined_at ASC,
            om.user_id ASC
    `, [req.params.id])

    const members = result.rows as OrganizationMemberRow[]

    return res.send({
        organization: toOrganization(organization),
        members: members.map(toMember),
        memberAccessContract: organizationMemberAccessContract(organization, members),
    })
}

export async function deleteOrganizationMember(req: FastifyRequest<{ Params: OrganizationMemberParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const target = await loadOrganizationMembership(req.params.id, req.params.userId)
    if (!target || target.status !== 'active') {
        return res.status(404).send({ error: 'Organization member not found.' })
    }

    const permissionError = removalPermissionError(organization.role, target.role)
    if (permissionError) {
        const denial = organizationMemberMutationDenial({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            targetUserId: req.params.userId,
            targetRole: target.role,
            action: 'remove_member',
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
            message: permissionError,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            targetUserId: req.params.userId,
            targetRole: target.role,
            actorRole: organization.role,
            action: denial.action,
            denialReason: denial.denialReason,
        })
        return res.status(403).send({ error: permissionError, memberMutationDenial: denial })
    }

    const ownerCount = await activeOwnerCount(req.params.id)
    if (target.role === 'owner' && ownerCount <= 1) {
        const message = 'Transfer ownership before removing the last owner.'
        const guard = organizationLastOwnerGuard({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            targetUserId: req.params.userId,
            action: 'remove_owner',
            ownerCount,
            message,
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
        })
        logOrganizationEvent(req, guard.serviceLogAction, req.params.id, userId, {
            requestId: guard.requestId,
            targetUserId: req.params.userId,
            actorRole: organization.role,
            action: guard.action,
            blockerCode: guard.blockerCode,
            ownerCount,
        })
        return res.status(409).send({ error: message, lastOwnerGuard: guard })
    }

    const removed = await run(`
        UPDATE organization_members
        SET status = 'removed'
        WHERE organization_id = $1
          AND user_id = $2
          AND status = 'active'
        RETURNING *
    `, [req.params.id, req.params.userId])

    if (!removed.rows.length) {
        return res.status(404).send({ error: 'Organization member not found.' })
    }

    const revokedInvites = await run(`
        UPDATE organization_invites
        SET status = 'revoked',
            accepted_at = NULL,
            accepted_by = NULL
        FROM users
        WHERE organization_invites.organization_id = $1
          AND users.id = $2
          AND lower(organization_invites.email) = lower(users.email)
          AND organization_invites.status = 'pending'
        RETURNING organization_invites.*
    `, [req.params.id, req.params.userId])

    await touchOrganization(req.params.id)
    logOrganizationEvent(req, 'organization_member_removed', req.params.id, userId, {
        targetUserId: req.params.userId,
        targetRole: target.role,
        actorRole: organization.role,
        ownerCountBefore: ownerCount,
        revokedInviteIds: revokedInvites.rows.map((invite: OrganizationInviteRow) => invite.id),
        revokedInviteCount: revokedInvites.rows.length,
    })

    const updated = await loadOrganizationForMember(req.params.id, userId)
    return res.send({
        organization: updated ? toOrganization(updated) : null,
        member: toMember(removed.rows[0] as OrganizationMemberRow),
        memberRemovalCleanup: {
            schemaVersion: 'organization.member_removal_cleanup.v1',
            organizationId: req.params.id,
            tenantId: req.params.id,
            targetUserId: req.params.userId,
            targetRole: target.role,
            revokedInviteIds: revokedInvites.rows.map((invite: OrganizationInviteRow) => invite.id),
            revokedInviteCount: revokedInvites.rows.length,
            revokedInviteStatus: 'revoked' as const,
            staleInviteAcceptanceBlocker: 'member_revoked' as const,
            noOrphanedInviteTokens: true,
            serviceLogAction: 'organization_member_removed' as const,
        },
    })
}

export async function patchOrganizationMemberRole(req: FastifyRequest<{ Params: OrganizationMemberParams, Body: OrganizationMemberRoleInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'change member roles')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    const target = await loadOrganizationMembership(req.params.id, req.params.userId)
    if (!target || target.status !== 'active') {
        return res.status(404).send({ error: 'Organization member not found.' })
    }

    let input
    try {
        input = normalizeMemberRoleInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid member role update.' })
    }

    const permissionError = roleUpdatePermissionError(organization.role, target.role, input.role)
    if (permissionError) {
        const denial = organizationMemberMutationDenial({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            targetUserId: req.params.userId,
            targetRole: target.role,
            action: 'change_member_role',
            requestedRole: input.role,
            reason: input.reason,
            requestId: input.requestId,
            message: permissionError,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            targetUserId: req.params.userId,
            targetRole: target.role,
            actorRole: organization.role,
            action: denial.action,
            requestedRole: input.role,
            denialReason: denial.denialReason,
            reason: input.reason,
        })
        return res.status(403).send({ error: permissionError, memberMutationDenial: denial })
    }

    const ownerCount = await activeOwnerCount(req.params.id)
    if (target.role === 'owner' && input.role !== 'owner' && ownerCount <= 1) {
        const message = 'Transfer ownership before changing the last owner role.'
        const guard = organizationLastOwnerGuard({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            targetUserId: req.params.userId,
            action: 'change_owner_role',
            requestedRole: input.role,
            ownerCount,
            message,
            requestId: input.requestId,
        })
        logOrganizationEvent(req, guard.serviceLogAction, req.params.id, userId, {
            requestId: guard.requestId,
            targetUserId: req.params.userId,
            actorRole: organization.role,
            action: guard.action,
            requestedRole: input.role,
            blockerCode: guard.blockerCode,
            ownerCount,
            reason: input.reason,
        })
        return res.status(409).send({ error: message, lastOwnerGuard: guard })
    }

    const result = await run(`
        UPDATE organization_members
        SET role = $3
        WHERE organization_id = $1
          AND user_id = $2
          AND status = 'active'
        RETURNING *
    `, [req.params.id, req.params.userId, input.role])

    if (!result.rows.length) {
        return res.status(404).send({ error: 'Organization member not found.' })
    }

    await touchOrganization(req.params.id)
    const serviceLogAction = 'organization_member_role_updated'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        targetUserId: req.params.userId,
        previousRole: target.role,
        newRole: input.role,
        actorRole: organization.role,
        reason: input.reason,
    })

    const updated = await loadOrganizationForMember(req.params.id, userId)
    return res.send({
        organization: updated ? toOrganization(updated) : null,
        member: toMember(result.rows[0] as OrganizationMemberRow),
        roleChange: {
            schemaVersion: 'organization.member_role_change.v1',
            organizationId: req.params.id,
            tenantId: req.params.id,
            actorId: userId,
            targetUserId: req.params.userId,
            previousRole: target.role,
            newRole: input.role,
            reason: input.reason,
            requestId: input.requestId ?? null,
            serviceLogAction,
        },
    })
}

export async function postOrganizationOwnershipTransfer(req: FastifyRequest<{ Params: OrganizationParams, Body: OrganizationOwnershipTransferInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (organization.role !== 'owner') {
        return res.status(403).send({ error: 'Only organization owners can transfer ownership.' })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'transfer ownership')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input
    try {
        input = normalizeOwnershipTransferInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid ownership transfer.' })
    }

    if (input.targetUserId === userId) {
        return res.status(400).send({ error: 'Choose another active member as the new owner.' })
    }

    const target = await loadOrganizationMembership(req.params.id, input.targetUserId)
    if (!target || target.status !== 'active') {
        return res.status(404).send({ error: 'Target member not found.' })
    }

    const ownerCount = await activeOwnerCount(req.params.id)
    const result = await run(`
        WITH promoted AS (
            UPDATE organization_members
            SET role = 'owner'
            WHERE organization_id = $1
              AND user_id = $2
              AND status = 'active'
            RETURNING *
        ),
        demoted AS (
            UPDATE organization_members
            SET role = 'admin'
            WHERE organization_id = $1
              AND user_id = $3
              AND status = 'active'
              AND role = 'owner'
            RETURNING *
        )
        SELECT promoted.*
        FROM promoted
    `, [req.params.id, input.targetUserId, userId])

    if (!result.rows.length) {
        return res.status(404).send({ error: 'Target member not found.' })
    }

    await touchOrganization(req.params.id)
    logOrganizationEvent(req, 'organization_ownership_transferred', req.params.id, userId, {
        targetUserId: input.targetUserId,
        previousTargetRole: target.role,
        previousOwnerCount: ownerCount,
        reason: input.reason,
    })

    const updated = await loadOrganizationForMember(req.params.id, userId)
    return res.send({
        organization: updated ? toOrganization(updated) : null,
        transfer: {
            organizationId: req.params.id,
            previousOwnerId: userId,
            newOwnerId: input.targetUserId,
            reason: input.reason,
        },
        member: toMember(result.rows[0] as OrganizationMemberRow),
    })
}

export async function postOrganizationInvites(req: FastifyRequest<{ Params: OrganizationParams, Body: InviteInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanManageOrganization(organization.role)) {
        return sendInviteManagementDenial(req, res, organization, userId, {
            action: 'create_invite',
            requestId: typeof req.body?.requestId === 'string' ? req.body.requestId : typeof req.body?.request_id === 'string' ? req.body.request_id : null,
            message: 'Only organization owners and admins can invite members.',
        })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'invite members')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input
    try {
        input = normalizeInviteInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid invites.' })
    }

    const requestId = input.requestId || randomUUID()
    const rows: OrganizationInviteRow[] = []
    const results: BulkInviteResult[] = []
    for (const email of input.emails) {
        const recipient = await loadInviteRecipientState(req.params.id, email)
        if (recipient?.user_active === false) {
            results.push({
                email,
                role: input.role,
                outcome: 'blocked_deactivated_user',
                userId: recipient.user_id,
                reason: 'Recipient account is deactivated.',
            })
            continue
        }

        if (recipient?.member_status === 'active') {
            results.push({
                email,
                role: input.role,
                outcome: 'already_member',
                userId: recipient.user_id,
                memberRole: recipient.member_role ?? undefined,
                reason: 'Recipient is already an active organization member.',
            })
            continue
        }

        if (recipient?.member_status === 'removed') {
            results.push({
                email,
                role: input.role,
                outcome: 'blocked_removed_member',
                userId: recipient.user_id,
                memberRole: recipient.member_role ?? undefined,
                reason: 'Recipient was removed from this organization.',
            })
            continue
        }

        const existingInvite = await loadInviteForEmail(req.params.id, email)
        const invite = await run(`
            INSERT INTO organization_invites (id, organization_id, email, role, invited_by, status, expires_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6)
            ON CONFLICT (organization_id, email)
            DO UPDATE SET role = EXCLUDED.role,
                          invited_by = EXCLUDED.invited_by,
                          status = 'pending',
                          accepted_at = NULL,
                          accepted_by = NULL,
                          expires_at = EXCLUDED.expires_at,
                          created_at = NOW()
            RETURNING *
        `, [randomUUID(), req.params.id, email, input.role, userId, input.expiresAt])
        const inviteRow = invite.rows[0] as OrganizationInviteRow
        rows.push(inviteRow)
        results.push({
            email,
            role: input.role,
            outcome: existingInvite && existingInvite.status === 'pending' && Date.parse(existingInvite.expires_at) > Date.now()
                ? 'updated_pending_invite'
                : 'invited',
            inviteId: inviteRow.id,
            acceptanceToken: inviteRow.id,
            acceptancePath: `/api/organizations/invites/${encodeURIComponent(inviteRow.id)}/accept`,
        })
    }

    if (rows.length > 0) {
        await touchOrganization(req.params.id)
    }
    logOrganizationEvent(req, 'organization_invites_created', req.params.id, userId, {
        requestId,
        inviteCount: rows.length,
        submittedRecipientCount: input.submittedRecipientCount,
        recipientCount: results.length,
        duplicateRecipientCount: input.duplicateRecipientCount,
        skippedCount: results.length - rows.length,
        outcomes: results.reduce<Record<string, number>>((acc, result) => {
            acc[result.outcome] = (acc[result.outcome] ?? 0) + 1
            return acc
        }, {}),
        role: input.role,
        expiresAt: input.expiresAt,
    })
    return res.status(201).send({
        requestId,
        actorId: userId,
        organizationId: req.params.id,
        invites: rows.map(toInvite),
        workflow: {
            schemaVersion: 'organization.bulk_invite.v1',
            requestId,
            organizationId: req.params.id,
            actorId: userId,
            role: input.role,
            expiresAt: input.expiresAt,
            submittedRecipientCount: input.submittedRecipientCount,
            recipientCount: results.length,
            normalizedRecipientCount: input.normalizedRecipientCount,
            duplicateRecipientCount: input.duplicateRecipientCount,
            invitedCount: rows.length,
            skippedCount: results.length - rows.length,
            duplicateInviteCount: results.filter(result => result.outcome === 'updated_pending_invite').length,
            results,
        },
    })
}

export async function postOrganizationInviteAction(req: FastifyRequest<{ Params: OrganizationInviteParams, Body: InviteActionInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanManageOrganization(organization.role)) {
        const action = req.body?.action === 'revoke'
            ? 'revoke_invite'
            : req.body?.action === 'resend'
                ? 'resend_invite'
                : 'manage_invites'
        return sendInviteManagementDenial(req, res, organization, userId, {
            action,
            inviteId: req.params.inviteId,
            requestId: typeof req.body?.requestId === 'string' ? req.body.requestId : typeof req.body?.request_id === 'string' ? req.body.request_id : null,
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can manage invites.',
        })
    }

    let input
    try {
        input = normalizeInviteActionInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid invite action.' })
    }

    const existing = await loadInviteById(req.params.id, req.params.inviteId)
    if (!existing) {
        return res.status(404).send({ error: 'Invite not found.' })
    }

    if (existing.status === 'accepted') {
        const message = 'Accepted invites cannot be revoked or resent; manage the member instead.'
        const denial = organizationInviteActionDenial({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            invite: existing,
            action: input.action,
            requestId: input.requestId,
            reason: input.reason,
            message,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            inviteId: req.params.inviteId,
            role: existing.role,
            actorRole: organization.role,
            action: input.action,
            blockerCode: denial.blockerCode,
            reason: input.reason,
        })
        return res.status(409).send({ error: message, inviteActionDenial: denial })
    }

    const lifecycleBlocker = input.action === 'resend'
        ? inactiveOrganizationMutationBlocker(organization, 'resend invites')
        : null
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    const resendExpiresAt = input.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const result = input.action === 'resend'
        ? await run(`
            UPDATE organization_invites
            SET status = 'pending',
                accepted_at = NULL,
                accepted_by = NULL,
                expires_at = $3,
                created_at = NOW()
            WHERE id = $1
              AND organization_id = $2
              AND status <> 'accepted'
            RETURNING *
        `, [req.params.inviteId, req.params.id, resendExpiresAt])
        : await run(`
            UPDATE organization_invites
            SET status = 'revoked',
                accepted_at = NULL,
                accepted_by = NULL
            WHERE id = $1
              AND organization_id = $2
              AND status <> 'accepted'
            RETURNING *
        `, [req.params.inviteId, req.params.id])

    if (!result.rows.length) {
        return res.status(404).send({ error: 'Invite not found.' })
    }

    await touchOrganization(req.params.id)
    const serviceLogAction = input.action === 'resend'
        ? 'organization_invite_resent'
        : 'organization_invite_revoked'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        inviteId: req.params.inviteId,
        email: existing.email,
        role: existing.role,
        previousStatus: existing.status,
        newStatus: input.action === 'resend' ? 'pending' : 'revoked',
        expiresAt: input.action === 'resend' ? resendExpiresAt : null,
        reason: input.reason,
    })

    const invite = result.rows[0] as OrganizationInviteRow
    return res.send({
        invite: toInvite(invite),
        inviteAction: {
            schemaVersion: 'organization.invite_action.v1',
            organizationId: req.params.id,
            tenantId: req.params.id,
            inviteId: invite.id,
            email: invite.email,
            role: invite.role,
            action: input.action,
            actorId: userId,
            actorRole: organization.role,
            previousStatus: existing.status,
            status: invite.status,
            reason: input.reason,
            requestId: input.requestId ?? null,
            serviceLogAction,
            acceptanceToken: invite.id,
            acceptancePath: `/api/organizations/invites/${encodeURIComponent(invite.id)}/accept`,
        },
    })
}

export async function postOrganizationInviteAccept(req: FastifyRequest<{ Params: InviteParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const result = await run(`
        WITH accepted_invite AS (
            UPDATE organization_invites
            SET status = 'accepted',
                accepted_at = NOW(),
                accepted_by = $2
            WHERE id = $1
              AND status = 'pending'
              AND expires_at > NOW()
              AND EXISTS (
                  SELECT 1
                  FROM organizations
                  WHERE organizations.id = organization_invites.organization_id
                    AND COALESCE(organizations.status, 'active') = 'active'
              )
              AND EXISTS (
                  SELECT 1
                  FROM users
                  WHERE users.id = $2
                    AND COALESCE(users.active, TRUE) IS TRUE
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM organization_members
                  WHERE organization_members.organization_id = organization_invites.organization_id
                    AND organization_members.user_id = $2
                    AND organization_members.status = 'removed'
              )
            RETURNING *
        ),
        member AS (
            INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, joined_at)
            SELECT organization_id, $2, role, 'active', invited_by, NOW()
            FROM accepted_invite
            ON CONFLICT (organization_id, user_id)
            DO UPDATE SET role = CASE
                                WHEN organization_members.role = 'owner' THEN 'owner'
                                WHEN organization_members.role = 'admin' AND EXCLUDED.role IN ('member', 'viewer') THEN 'admin'
                                WHEN organization_members.role = 'member' AND EXCLUDED.role = 'viewer' THEN 'member'
                                ELSE EXCLUDED.role
                              END,
                          status = 'active',
                          invited_by = EXCLUDED.invited_by,
                          joined_at = NOW()
            RETURNING *
        )
        SELECT
            accepted_invite.id AS invite_id,
            accepted_invite.organization_id,
            accepted_invite.email,
            accepted_invite.role AS invite_role,
            accepted_invite.invited_by,
            accepted_invite.accepted_by,
            accepted_invite.status AS invite_status,
            accepted_invite.created_at AS invite_created_at,
            accepted_invite.expires_at,
            accepted_invite.accepted_at,
            member.user_id,
            member.role AS member_role,
            member.status AS member_status,
            member.joined_at,
            member.created_at AS member_created_at
        FROM accepted_invite
        JOIN member ON member.organization_id = accepted_invite.organization_id
    `, [req.params.inviteId, userId])

    if (!result.rows.length) {
        const inviteResult = await run(`
            SELECT *
            FROM organization_invites
            WHERE id = $1
            LIMIT 1
        `, [req.params.inviteId])
        const invite = inviteResult.rows[0] as OrganizationInviteRow | undefined
        const organizationStatusResult = invite
            ? await run(`
                SELECT COALESCE(status, 'active') AS status
                FROM organizations
                WHERE id = $1
                LIMIT 1
            `, [invite.organization_id])
            : { rows: [] }
        const memberStatusResult = invite
            ? await run(`
                SELECT status
                FROM organization_members
                WHERE organization_id = $1
                  AND user_id = $2
                LIMIT 1
            `, [invite.organization_id, userId])
            : { rows: [] }
        const userStatusResult = invite
            ? await run(`
                SELECT COALESCE(active, TRUE) AS active
                FROM users
                WHERE id = $1
                LIMIT 1
            `, [userId])
            : { rows: [] }
        const denial = organizationInviteAcceptanceDenial({
            invite,
            organizationStatus: organizationStatusResult.rows[0]?.status,
            memberStatus: memberStatusResult.rows[0]?.status,
            userActive: userStatusResult.rows[0]?.active,
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
        })
        if (invite) {
            logOrganizationEvent(req, denial.serviceLogAction, invite.organization_id, userId, {
                inviteId: invite.id,
                inviteStatus: invite.status,
                blockerCode: denial.blockerCode,
                requestId: denial.requestId,
            })
        }
        return res.status(denial.statusCode).send({
            error: invite ? 'Invite cannot be accepted.' : 'Pending invite not found.',
            inviteAcceptanceDenial: denial,
        })
    }

    const row = result.rows[0] as {
        invite_id: string
        organization_id: string
        email: string
        invite_role: OrganizationRole
        invited_by: string
        accepted_by: string
        invite_status: 'accepted'
        invite_created_at: string
        accepted_at: string
        expires_at: string
        user_id: string
        member_role: OrganizationRole
        member_status: 'active'
        joined_at: string
        member_created_at: string
    }

    await touchOrganization(row.organization_id)
    const serviceLogAction = 'organization_invite_accepted'
    logOrganizationEvent(req, serviceLogAction, row.organization_id, userId, {
        inviteId: row.invite_id,
        role: row.member_role,
    })
    const organization = await loadOrganizationForMember(row.organization_id, userId)
    return res.send({
        invite: toInvite({
            id: row.invite_id,
            organization_id: row.organization_id,
            email: row.email,
            role: row.invite_role,
            invited_by: row.invited_by,
            accepted_by: row.accepted_by,
            status: row.invite_status,
            created_at: row.invite_created_at,
            expires_at: row.expires_at,
            accepted_at: row.accepted_at,
        }),
        membership: {
            organizationId: row.organization_id,
            userId: row.user_id,
            role: row.member_role,
            status: row.member_status,
            joinedAt: row.joined_at,
            createdAt: row.member_created_at,
        },
        inviteAcceptance: {
            schemaVersion: 'organization.invite_acceptance.v1',
            organizationId: row.organization_id,
            tenantId: row.organization_id,
            inviteId: row.invite_id,
            acceptanceToken: row.invite_id,
            acceptancePath: `/api/organizations/invites/${encodeURIComponent(row.invite_id)}/accept`,
            acceptedBy: userId,
            invitedBy: row.invited_by,
            inviteRole: row.invite_role,
            appliedRole: row.member_role,
            membershipStatus: row.member_status,
            acceptedAt: row.accepted_at,
            expiresAt: row.expires_at,
            serviceLogAction,
            auditMetadataFields: ['inviteId', 'role', 'acceptedBy', 'organizationId'],
            reusedInviteBlocked: true,
            expiredInviteDenied: 'invite_expired',
            revokedInviteDenied: 'member_revoked',
        },
        organization: organization ? toOrganization(organization) : null,
    })
}

export async function getOrganizationWatchlists(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        const denial = organizationAccessDenial({
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/watchlists',
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            route: denial.route,
            blockerCode: denial.blockerCode,
            denialReason: denial.denialReason,
        })
        return res.status(denial.statusCode).send({ error: denial.message, organizationAccessDenial: denial })
    }

    const query = req.query as WatchlistQuery | undefined
    const kind = normalizeOptionalKind(query?.kind)
    const status = normalizeOptionalWatchlistStatus(query?.status)
    const includeArchived = status === 'archived' || query?.includeArchived === 'true' || query?.include_archived === 'true'
    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND ($2::boolean IS TRUE OR archived_at IS NULL)
          AND ($3::text IS NULL OR kind = $3)
          AND ($4::text IS NULL OR status = $4)
        ORDER BY status ASC, kind ASC, value ASC
    `, [req.params.id, includeArchived, kind, status])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]

    return res.send({
        organization: toOrganization(organization),
        watchlistItems: watchlistItems.map(toWatchlistItem),
        sharedWatchlistContract: organizationSharedWatchlistContract(organization, watchlistItems),
    })
}

export async function getOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.organizationId, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE id = $1
          AND organization_id = $2
        LIMIT 1
    `, [req.params.itemId, req.params.organizationId])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: 'read_watchlist',
            itemId: req.params.itemId,
        })
    }

    const watchlistItem = toWatchlistItem(result.rows[0] as OrganizationWatchlistRow)
    const visibility = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })

    return res.send({
        organization: toOrganization(organization),
        watchlistItem,
        watchlistReadContract: {
            schemaVersion: 'organization.watchlist_item_read.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            ownerOrganizationId: organization.id,
            watchlistItemId: watchlistItem.id,
            watchlistId: watchlistItem.id,
            member: {
                userId,
                role: organization.role ?? 'viewer',
                status: 'active',
            },
            visibility: {
                canReadSharedWatchlist: true,
                alertVisibilityAllowed: visibility.allowed,
                alertVisibilityPolicy: visibility.alertVisibilityPolicy,
                allowedAlertViewerRoles: visibility.allowedRoles,
                alertVisibilityDenialReason: visibility.reason,
            },
            ownerContext: {
                schemaVersion: 'organization.watchlist_owner_context.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                ownerOrganizationId: organization.id,
                watchlistItemId: watchlistItem.id,
                watchlistId: watchlistItem.id,
                actorId: userId,
                actorRole: organization.role ?? 'viewer',
                visibilityPolicy: visibility.alertVisibilityPolicy,
                allowedViewerRoles: visibility.allowedRoles,
                sourceFamily: 'organization_watchlist',
                route: 'organization_watchlist',
                alertBridgeFields: [
                    'organizationId',
                    'tenantId',
                    'ownerOrganizationId',
                    'watchlistItemId',
                    'watchlistId',
                    'workflowContext.alertGenerationRefs',
                    'workflowContext.alertGeneratorKeys',
                ],
                webhookBridgeFields: [
                    'organizationId',
                    'tenantId',
                    'ownerOrganizationId',
                    'watchlistItemId',
                    'destination.org_id',
                    'webhookDestinationIds[]',
                ],
                crossTenantCollisionAllowed: false,
                nonmemberEnumeration: false,
            },
            alertBridge: {
                activeTermsExportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
                alertGenerationReference: watchlistItem.alertGenerationReference,
                requiredPersistedFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemIds',
                    'workflowContext.alertGenerationRefs',
                    'workflowContext.alertGeneratorKeys',
                    'workflowContext.visibilityDecision',
                ],
            },
            webhookBridge: {
                route: 'POST /v1/dwm/webhooks/deliver',
                requiredDestinationOrgId: organization.id,
                selectedDestinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                nonmemberDestinationEnumeration: false,
                noLeakFields: ['destination.secret', 'otherOrg.destinationIds'],
            },
            lifecycle: {
                status: watchlistItem.status,
                enabled: watchlistItem.enabled,
                disabledReason: watchlistItem.disabledReason,
                alertGenerationEligible: watchlistItem.enabled,
            },
            noLeakFields: [
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'otherOrg.destinationIds',
                'destination.secret',
            ],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
    })
}

export async function getOrganizationAlertReadiness(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        const denial = organizationAccessDenial({
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/alert-readiness',
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            route: denial.route,
            blockerCode: denial.blockerCode,
            denialReason: denial.denialReason,
        })
        return res.status(denial.statusCode).send({ error: denial.message, organizationAccessDenial: denial })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND archived_at IS NULL
          AND status = 'active'
        ORDER BY kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const bridgeContext = buildOrganizationBridgeContext({
        ...organization,
        shared_watchlist_count: watchlistItems.length,
    })
    const bridgeOrganization = {
        ...organization,
        shared_watchlist_count: bridgeContext.sharedWatchlistCount,
    }
    const generatedAlertReferences = watchlistItems.map(item => buildOrganizationDwmAlertReference(bridgeOrganization, item))
    const teamOnboardingReadiness = organizationTeamOnboardingReadiness(bridgeContext)
    const alertGenerationBridge = organizationWatchlistAlertGenerationContract(bridgeOrganization, watchlistItems)
    const downstreamAuthorization = organizationDownstreamAuthorizationExport(bridgeOrganization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })
    const lifecycleReadiness = organizationLifecycleReadiness({
        ...organization,
        shared_watchlist_count: bridgeContext.sharedWatchlistCount,
    })
    const readinessProof = organizationReadinessProof({
        lifecycleReadiness,
        alertGenerationBridge,
        downstreamAuthorization,
    })
    const sharedWatchlistDownstreamProof = organizationSharedWatchlistDownstreamProof(bridgeOrganization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    }, alertGenerationBridge, downstreamAuthorization)

    return res.send({
        organization: toOrganization(organization),
        alertReadiness: {
            schemaVersion: 'organization.dwm_alert_readiness.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            defaultWebhookPolicy: bridgeContext.defaultWebhookPolicy,
            alertVisibilityPolicy: bridgeContext.alertVisibilityPolicy,
            memberCount: bridgeContext.memberCount,
            activeMemberCount: bridgeContext.activeMemberCount,
            ownerCount: bridgeContext.ownerCount,
            allowedViewerRoles: bridgeContext.allowedViewerRoles,
            removedMemberDenialReason: bridgeContext.removedMemberDenialReason,
            deactivatedMemberDenialReason: bridgeContext.deactivatedMemberDenialReason,
            pendingInviteCount: bridgeContext.pendingInviteCount,
            sharedWatchlistCount: bridgeContext.sharedWatchlistCount,
            readinessStatus: bridgeContext.readinessStatus,
            ready: generatedAlertReferences.length > 0,
            teamOnboardingReadiness,
            lifecycleReadiness,
            readinessProof,
            sharedWatchlistDownstreamProof,
            alertGenerationBridge,
            downstreamAuthorization,
            watchlistItemCount: generatedAlertReferences.length,
            generatedAlertReferences,
            downstreamFields: [
                'organizationId',
                'tenantId',
                'watchlistItemId',
                'watchlist.id',
                'watchlist.terms',
                'watchlist.status',
                'watchlist.createdBy',
                'watchlist.updatedBy',
                'matchedTerm',
                'route',
                'casePath',
                'dedupeKey',
                'defaultWebhookPolicy',
                'alertVisibilityPolicy',
                'memberCount',
                'activeMemberCount',
                'ownerCount',
                'allowedViewerRoles',
                'removedMemberDenialReason',
                'deactivatedMemberDenialReason',
                'pendingInviteCount',
                'sharedWatchlistCount',
                'readinessStatus',
                'teamOnboardingReadiness',
                'lifecycleReadiness',
                'readinessProof',
                'readinessProof.routes',
                'readinessProof.worker3Proof',
                'readinessProof.uiProof',
                'readinessProof.blockers',
                'alertGenerationBridge',
                'alertGenerationBridge.activeWatchlistTerms',
                'alertGenerationBridge.activeWatchlistTerms.status',
                'alertGenerationBridge.activeWatchlistTerms.createdBy',
                'alertGenerationBridge.activeWatchlistTerms.updatedBy',
                'alertGenerationBridge.termFamilies',
                'alertGenerationBridge.blockedReasons',
                'downstreamAuthorization.organizationId',
                'downstreamAuthorization.member.role',
                'downstreamAuthorization.watchlists.states',
                'downstreamAuthorization.allowedActions',
                'downstreamAuthorization.downstream.alertGeneration.blockerCodes',
            ],
        },
    })
}

export async function getOrganizationWatchlistAlertTerms(req: FastifyRequest<{ Params: OrganizationParams, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        const denial = organizationAccessDenial({
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            requestId: req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            route: denial.route,
            blockerCode: denial.blockerCode,
            denialReason: denial.denialReason,
        })
        return res.status(denial.statusCode).send({ error: denial.message, organizationAccessDenial: denial })
    }

    const requestId = normalizeWatchlistRequestId(req.query?.requestId ?? req.query?.request_id)
    const visibility = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })
    if (!visibility.allowed) {
        const deniedExport = organizationWatchlistAlertTermsExportDenial({
            organizationId: organization.id,
            tenantId: organization.id,
            member: {
                userId,
                role: organization.role ?? 'viewer',
            },
            visibility,
            requestId,
        })
        logOrganizationEvent(req, 'organization_watchlist_alert_terms_export_denied', req.params.id, userId, {
            requestId,
            role: organization.role,
            alertVisibilityPolicy: visibility.alertVisibilityPolicy,
            allowedRoles: visibility.allowedRoles,
            denialReason: visibility.reason,
            blockerCodes: deniedExport.blockerCodes,
        })
        return res.status(403).send({
            error: 'Organization alert visibility does not allow this member to export alert terms.',
            organization: toOrganization(organization),
            alertTermsExportDenial: deniedExport,
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
        ORDER BY status ASC, kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const exportContract = organizationWatchlistAlertTermsExport(organization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })

    logOrganizationEvent(req, 'organization_watchlist_alert_terms_exported', req.params.id, userId, {
        requestId,
        activeTermCount: exportContract.activeTerms.length,
        pausedCount: exportContract.excluded.pausedCount,
        archivedCount: exportContract.excluded.archivedCount,
        canGenerateAlerts: exportContract.canGenerateAlerts,
    })

    return res.send({
        organization: toOrganization(organization),
        alertTermsExport: exportContract,
    })
}

export async function getOrganizationAlertCaseVisibility(req: FastifyRequest<{ Params: OrganizationParams, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND archived_at IS NULL
        ORDER BY status ASC, kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const alertGeneration = organizationWatchlistAlertGenerationContract(organization, watchlistItems)
    const downstreamAuthorization = organizationDownstreamAuthorizationExport(organization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })
    const downstreamProof = organizationSharedWatchlistDownstreamProof(organization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    }, alertGeneration, downstreamAuthorization)
    const visibility = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })
    const routes = {
        alertList: 'GET /v1/dwm/alerts?organizationId=:organizationId',
        alertDetail: 'GET /v1/dwm/alerts/:id',
        caseList: 'GET /v1/cases?organizationId=:organizationId',
        caseDetail: 'GET /v1/cases/:id',
        webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
    } as const

    if (!visibility.allowed) {
        const requestId = typeof req.query?.requestId === 'string' ? req.query.requestId : typeof req.query?.request_id === 'string' ? req.query.request_id : null
        logOrganizationEvent(req, 'organization_alert_case_visibility_denied', organization.id, userId, {
            requestId,
            role: organization.role ?? 'viewer',
            allowedRoles: visibility.allowedRoles,
            denialReason: visibility.reason ?? 'role_not_allowed',
            blockerCodes: [visibility.reason ?? 'role_not_allowed'],
        })
        return res.status(403).send({
            error: 'Organization alert visibility does not allow this member to list org alerts or cases.',
            organization: toOrganization(organization),
            alertCaseVisibility: {
                schemaVersion: 'organization.alert_case_visibility_denial.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                member: {
                    userId,
                    role: organization.role ?? 'viewer',
                    status: 'active',
                },
                visibility,
                routes,
                requiredQueryFields: ['organizationId'],
                safeFields: [
                    'organizationId',
                    'tenantId',
                    'member.role',
                    'visibility.allowedRoles',
                    'visibility.reason',
                    'routes',
                    'blockerCodes',
                ],
                redactedFields: [
                    'activeTerms[]',
                    'watchlistScope.alertGeneratorKeys',
                    'case.evidence.rawContent',
                    'member.userId',
                ],
                blockerCodes: [visibility.reason ?? 'role_not_allowed'],
                nonmemberEnumeration: false,
                analystPortalAdapter: {
                    schemaVersion: 'organization.analyst_portal_visibility_denial_adapter.v1',
                    organizationId: organization.id,
                    tenantId: organization.id,
                    memberRole: organization.role ?? 'viewer',
                    visibility,
                    routeBindings: routes,
                    allowedActions: [],
                    actionMatrix: {
                        review_alert: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        acknowledge_alert: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        assign_case: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        link_case: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        replay_alert: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        deliver_webhook: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        open_audit_timeline: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                    },
                    redactedFields: [
                        'activeTerms[]',
                        'watchlistScope.alertGeneratorKeys',
                        'case.evidence.rawContent',
                        'destination.secret',
                    ],
                    nonmemberEnumeration: false,
                },
                auditProof: {
                    schemaVersion: 'organization.alert_case_visibility_denial_audit.v1',
                    organizationId: organization.id,
                    tenantId: organization.id,
                    memberRole: organization.role ?? 'viewer',
                    serviceLogAction: 'organization_alert_case_visibility_denied',
                    requestId,
                    requiredMetadataFields: ['requestId', 'role', 'allowedRoles', 'denialReason', 'blockerCodes'],
                    redactedFields: [
                        'activeTerms[]',
                        'watchlistScope.alertGeneratorKeys',
                        'case.evidence.rawContent',
                        'destination.secret',
                    ],
                    proofLogQuery: 'GET /api/logs?service=api&message=organization_alert_case_visibility_denied',
                },
                proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
            },
        })
    }

    const alertQueue = downstreamProof.alertBridge.queueVisibilityContract
    const caseWorkflow = downstreamProof.caseBridge.caseWorkflowContract
    const alertCaseWorkflowState = organizationAlertCaseWorkflowState(downstreamProof, downstreamAuthorization)
    return res.send({
        organization: toOrganization(organization),
        alertCaseVisibility: {
            schemaVersion: 'organization.alert_case_visibility.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            member: {
                userId,
                role: organization.role ?? 'viewer',
                status: 'active',
            },
            visibility,
            routes,
            requiredQueryFields: ['organizationId'],
            allowedActions: downstreamAuthorization.allowedActions,
            analystPortalAdapter: organizationAnalystPortalVisibilityAdapter(downstreamProof, downstreamAuthorization),
            workflowState: alertCaseWorkflowState,
            alertQueue: {
                route: alertQueue.routes.list,
                requiredQueryFields: alertQueue.requiredQueryFields,
                watchlistItemIds: alertQueue.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: alertQueue.watchlistScope.alertGeneratorKeys,
                actionGates: alertQueue.actionGates,
                blockerCodes: alertQueue.blockerCodes,
            },
            caseWorkflow: {
                route: caseWorkflow.routes.list,
                casePathTemplate: caseWorkflow.casePathTemplate,
                requiredQueryFields: caseWorkflow.requiredQueryFields,
                watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
                actorActions: caseWorkflow.actorActions,
                blockerCodes: caseWorkflow.blockerCodes,
            },
            guardrails: {
                schemaVersion: 'organization.alert_case_visibility_guardrails.v1',
                partitionKey: 'organizationId',
                tenantIdField: 'tenantId',
                requiredWorkflowContextFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemIds',
                    'workflowContext.visibilityDecision',
                ],
                crossTenantCollisionAllowed: false,
                nonmemberEnumeration: false,
                noLeakFields: [
                    'otherOrg.watchlistItemIds',
                    'otherOrg.alertGeneratorKeys',
                    'case.evidence.rawContent',
                    'destination.secret',
                ],
                lifecycleBlockers: downstreamProof.alertBridge.persistenceContract.lifecycleBlockers,
            },
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
    })
}

export async function postOrganizationWatchlist(req: FastifyRequest<{ Params: OrganizationParams, Body: WatchlistInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'create_watchlist',
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can update watchlists.',
        })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'create shared watchlists')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input
    try {
        input = normalizeWatchlistInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist item.' })
    }

    const existing = await run(`
        SELECT id
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND kind = $2
          AND lower(value) = lower($3)
          AND archived_at IS NULL
          AND status <> 'archived'
        LIMIT 1
    `, [req.params.id, input.kind, input.value])

    const result = existing.rows[0]
        ? await run(`
            UPDATE organization_watchlist_items
            SET value = $3,
                notes = $4,
                status = 'active',
                updated_by = $5,
                lifecycle_reason = $6,
                lifecycle_request_id = $7,
                updated_at = NOW()
            WHERE id = $1
              AND organization_id = $2
            RETURNING *
        `, [existing.rows[0].id, req.params.id, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])
        : await run(`
        INSERT INTO organization_watchlist_items (id, organization_id, kind, value, notes, status, created_by, updated_by, lifecycle_reason, lifecycle_request_id)
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $6, $7, $8)
        RETURNING *
    `, [randomUUID(), req.params.id, input.kind, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])

    await touchOrganization(req.params.id)
    const serviceLogAction = 'organization_watchlist_upserted'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        watchlistItemId: result.rows[0]?.id,
        kind: input.kind,
        value: input.value,
        reason: input.reason,
    })
    return res.status(201).send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: existing.rows[0] ? 'updated' : 'created',
            watchlistItemId: result.rows[0]?.id,
            actorId: userId,
            requestId: input.requestId,
            reason: input.reason,
            serviceLogAction,
            existingItemId: existing.rows[0]?.id ?? null,
            duplicateTermMatched: Boolean(existing.rows[0]),
        }),
    })
}

export async function putOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.organizationId, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'update_watchlist',
            itemId: req.params.itemId,
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can update watchlists.',
        })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'update shared watchlists')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input
    try {
        input = normalizeWatchlistInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist item.' })
    }

    const result = await run(`
        UPDATE organization_watchlist_items
        SET kind = $3,
            value = $4,
            notes = $5,
            updated_by = $6,
            lifecycle_reason = $7,
            lifecycle_request_id = $8,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND archived_at IS NULL
          AND status <> 'archived'
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, input.kind, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: 'update_watchlist',
            itemId: req.params.itemId,
            requestId: input.requestId,
            reason: input.reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = 'organization_watchlist_updated'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId: input.requestId,
        watchlistItemId: req.params.itemId,
        kind: input.kind,
        value: input.value,
        reason: input.reason,
    })
    return res.send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: 'updated',
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId: input.requestId,
            serviceLogAction,
        }),
    })
}

export async function deleteOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistMutationBody, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.organizationId, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'archive_watchlist',
            itemId: req.params.itemId,
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id ?? req.query?.requestId ?? req.query?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can update watchlists.',
        })
    }

    const requestId = normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id ?? req.query?.requestId ?? req.query?.request_id)
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : undefined

    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = 'archived',
            archived_at = NOW(),
            updated_by = $3,
            lifecycle_reason = $4,
            lifecycle_request_id = $5,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND archived_at IS NULL
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, userId, reason ?? null, requestId ?? null])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: 'archive_watchlist',
            itemId: req.params.itemId,
            requestId,
            reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = 'organization_watchlist_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId,
        reason,
        watchlistItemId: req.params.itemId,
    })
    return res.send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: 'disabled',
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId,
            reason,
            serviceLogAction,
        }),
    })
}

export async function postOrganizationWatchlistAction(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistActionInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.organizationId, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'watchlist_lifecycle_action',
            itemId: req.params.itemId,
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can update watchlists.',
        })
    }

    let input
    try {
        input = normalizeWatchlistActionInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist action.' })
    }

    const lifecycleBlocker = input.action === 'archive'
        ? null
        : inactiveOrganizationMutationBlocker(organization, `${input.action} shared watchlists`)
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    const nextStatus = input.action === 'resume' || input.action === 'restore' ? 'active' : input.action === 'pause' ? 'paused' : 'archived'
    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = $3,
            archived_at = CASE WHEN $3 = 'archived' THEN NOW() WHEN $7 = 'restore' THEN NULL ELSE archived_at END,
            updated_by = $4,
            lifecycle_reason = $5,
            lifecycle_request_id = $6,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND ($7 = 'restore' OR archived_at IS NULL)
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, nextStatus, userId, input.reason ?? null, input.requestId ?? null, input.action])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: input.action,
            itemId: req.params.itemId,
            requestId: input.requestId,
            reason: input.reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = input.action === 'pause'
        ? 'organization_watchlist_paused'
        : input.action === 'resume'
            ? 'organization_watchlist_resumed'
            : input.action === 'restore'
                ? 'organization_watchlist_restored'
                : 'organization_watchlist_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId: input.requestId,
        reason: input.reason,
        watchlistItemId: req.params.itemId,
        action: input.action,
        status: nextStatus,
    })

    return res.send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: input.action,
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId: input.requestId,
            reason: input.reason,
            serviceLogAction,
        }),
    })
}

export async function postOrganizationWatchlistCleanup(req: FastifyRequest<{ Params: OrganizationParams, Body: WatchlistCleanupInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'cleanup_watchlists',
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can clean up watchlists.',
        })
    }

    let input
    try {
        input = normalizeWatchlistCleanupInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist cleanup.' })
    }

    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = 'archived',
            archived_at = COALESCE(archived_at, NOW()),
            updated_by = $3,
            lifecycle_reason = $4,
            lifecycle_request_id = $5,
            updated_at = NOW()
        WHERE organization_id = $1
          AND id = ANY($2::text[])
          AND archived_at IS NULL
        RETURNING *
    `, [req.params.id, input.itemIds, userId, input.reason ?? null, input.requestId ?? null])
    const archivedItems = result.rows as OrganizationWatchlistRow[]
    const archivedIds = new Set(archivedItems.map(item => item.id))
    const skippedItemIds = input.itemIds.filter(itemId => !archivedIds.has(itemId))

    if (archivedItems.length > 0) {
        await touchOrganization(req.params.id)
    }

    const serviceLogAction = 'organization_watchlist_cleanup_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        reason: input.reason,
        requestedItemIds: input.itemIds,
        archivedItemIds: archivedItems.map(item => item.id),
        skippedItemIds,
        archivedCount: archivedItems.length,
    })

    return res.send({
        cleanup: {
            schemaVersion: 'organization.watchlist_cleanup.v1',
            organizationId: req.params.id,
            tenantId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            requestId: input.requestId ?? null,
            reason: input.reason ?? null,
            requestedItemIds: input.itemIds,
            archivedItemIds: archivedItems.map(item => item.id),
            skippedItemIds,
            archivedCount: archivedItems.length,
            serviceLogAction,
        },
        archivedItems: archivedItems.map(toWatchlistItem),
    })
}

async function loadOrganizationForMember(organizationId: string, userId: string) {
    const result = await run(`
        SELECT
            o.*,
            om.role,
            COUNT(DISTINCT active_member_users.id)::int AS member_count,
            COUNT(DISTINCT active_owner_users.id)::int AS owner_count,
            COUNT(DISTINCT active_admin_users.id)::int AS admin_count,
            COUNT(DISTINCT pending_invites.id)::int AS pending_invite_count,
            COUNT(DISTINCT active_watchlist_items.id)::int AS shared_watchlist_count
        FROM organizations o
        JOIN organization_members om
          ON om.organization_id = o.id
         AND om.user_id = $2
         AND om.status = 'active'
        JOIN users current_user
          ON current_user.id = om.user_id
         AND current_user.active = TRUE
        LEFT JOIN organization_members active_members
          ON active_members.organization_id = o.id
         AND active_members.status = 'active'
        LEFT JOIN users active_member_users
          ON active_member_users.id = active_members.user_id
         AND active_member_users.active = TRUE
        LEFT JOIN organization_members active_owners
          ON active_owners.organization_id = o.id
         AND active_owners.status = 'active'
         AND active_owners.role = 'owner'
        LEFT JOIN users active_owner_users
          ON active_owner_users.id = active_owners.user_id
         AND active_owner_users.active = TRUE
        LEFT JOIN organization_members active_admins
          ON active_admins.organization_id = o.id
         AND active_admins.status = 'active'
         AND active_admins.role IN ('owner', 'admin')
        LEFT JOIN users active_admin_users
          ON active_admin_users.id = active_admins.user_id
         AND active_admin_users.active = TRUE
        LEFT JOIN organization_invites pending_invites
          ON pending_invites.organization_id = o.id
         AND pending_invites.status = 'pending'
         AND pending_invites.expires_at > NOW()
        LEFT JOIN organization_watchlist_items active_watchlist_items
          ON active_watchlist_items.organization_id = o.id
         AND active_watchlist_items.archived_at IS NULL
         AND active_watchlist_items.status = 'active'
        WHERE o.id = $1
        GROUP BY o.id, om.role
        LIMIT 1
    `, [organizationId, userId])

    return result.rows[0] as OrganizationRow | undefined
}

async function loadOrganizationMembership(organizationId: string, userId: string) {
    const result = await run(`
        SELECT
            om.organization_id,
            om.user_id,
            u.name,
            u.avatar,
            om.role,
            om.status,
            om.invited_by,
            om.joined_at,
            om.created_at
        FROM organization_members om
        JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1
          AND om.user_id = $2
        LIMIT 1
    `, [organizationId, userId])

    return result.rows[0] as OrganizationMemberRow | undefined
}

async function loadInviteRecipientState(organizationId: string, email: string) {
    const result = await run(`
        SELECT
            u.id AS user_id,
            COALESCE(u.active, TRUE) AS user_active,
            om.role AS member_role,
            om.status AS member_status
        FROM users u
        LEFT JOIN organization_members om
          ON om.organization_id = $1
         AND om.user_id = u.id
        WHERE lower(u.email) = lower($2)
        LIMIT 1
    `, [organizationId, email])

    return result.rows[0] as {
        user_id: string
        user_active: boolean
        member_role?: OrganizationRole | null
        member_status?: OrganizationMemberRow['status'] | null
    } | undefined
}

async function loadInviteForEmail(organizationId: string, email: string) {
    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE organization_id = $1
          AND lower(email) = lower($2)
        LIMIT 1
    `, [organizationId, email])

    return result.rows[0] as OrganizationInviteRow | undefined
}

async function loadInviteById(organizationId: string, inviteId: string) {
    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE id = $1
          AND organization_id = $2
        LIMIT 1
    `, [inviteId, organizationId])

    return result.rows[0] as OrganizationInviteRow | undefined
}

async function activeOwnerCount(organizationId: string) {
    const result = await run(`
        SELECT COUNT(*)::int AS owner_count
        FROM organization_members
        WHERE organization_id = $1
          AND status = 'active'
          AND role = 'owner'
    `, [organizationId])

    return Number(result.rows[0]?.owner_count ?? 0)
}

async function uniqueOrganizationSlug(baseSlug: string, currentOrganizationId?: string) {
    const result = await run(`
        SELECT id, slug
        FROM organizations
        WHERE (slug = $1 OR slug LIKE $2)
          AND ($3::text IS NULL OR id <> $3)
    `, [baseSlug, `${baseSlug}-%`, currentOrganizationId ?? null])
    const existing = new Set(result.rows.map((row: { slug: string }) => row.slug))
    if (!existing.has(baseSlug)) {
        return baseSlug
    }

    let suffix = 2
    while (existing.has(`${baseSlug}-${suffix}`)) {
        suffix += 1
    }

    return `${baseSlug}-${suffix}`
}

async function touchOrganization(organizationId: string) {
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organizationId])
}

function normalizeOptionalKind(value: unknown): WatchlistKind | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null
    }

    const kind = value.trim().toLowerCase()
    return ['company', 'domain', 'vendor', 'actor', 'keyword'].includes(kind) ? kind as WatchlistKind : null
}

function normalizeOptionalWatchlistStatus(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
        return null
    }

    const status = value.trim().toLowerCase()
    return ['active', 'paused', 'archived'].includes(status) ? status : null
}

function logOrganizationEvent(req: FastifyRequest, action: string, organizationId: string, actorId: string, metadata: Record<string, unknown>) {
    void recordLog({
        service: 'hanasand-api',
        level: 'info',
        message: action,
        metadata: {
            category: 'organization',
            action,
            organizationId,
            actorId,
            ...metadata,
        },
    }).catch(error => req.log.warn({ error, action, organizationId }, 'Failed to persist organization event log'))
}

function inactiveOrganizationMutationBlocker(organization: Pick<OrganizationRow, 'id' | 'status'>, action: string) {
    const status = organization.status ?? 'active'
    if (status !== 'archived' && status !== 'deleted') {
        return null
    }

    return {
        schemaVersion: 'organization.lifecycle_mutation_blocker.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        status,
        code: status === 'deleted' ? 'org_deleted' : 'org_archived',
        action,
        message: `Organization is ${status}; reactivate it before ${action}.`,
    }
}

function sendOrganizationLifecycleBlocker(req: FastifyRequest, res: FastifyReply, blocker: NonNullable<ReturnType<typeof inactiveOrganizationMutationBlocker>>, actorId: string, actorRole: OrganizationRole | undefined) {
    const serviceLogAction = 'organization_lifecycle_mutation_blocked'
    const body = req.body as { requestId?: unknown, request_id?: unknown, reason?: unknown } | undefined
    const requestId = typeof body?.requestId === 'string'
        ? body.requestId
        : typeof body?.request_id === 'string'
            ? body.request_id
            : null
    const reason = typeof body?.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 1000)
        : null
    logOrganizationEvent(req, serviceLogAction, blocker.organizationId, actorId, {
        requestId,
        reason,
        actorRole: actorRole ?? null,
        blockedAction: blocker.action,
        lifecycleStatus: blocker.status,
        blockerCode: blocker.code,
    })

    return res.status(409).send({
        error: blocker.message,
        lifecycleBlocker: {
            ...blocker,
            serviceLogAction,
            requestId,
        },
        auditEvent: {
            schemaVersion: 'organization.lifecycle_mutation_blocker_audit.v1',
            organizationId: blocker.organizationId,
            tenantId: blocker.tenantId,
            actorId,
            actorRole: actorRole ?? null,
            serviceLogAction,
            requestId,
            blockedAction: blocker.action,
            blockerCode: blocker.code,
            lifecycleStatus: blocker.status,
        },
    })
}

function organizationSettingsPermissions(role: OrganizationRole | undefined) {
    const canEdit = roleCanManageOrganization(role)
    return {
        canEdit,
        editableFields: canEdit ? ['name', 'slug', 'defaultWebhookPolicy', 'alertVisibilityPolicy', 'retentionDays', 'auditSafeMetadata'] : [],
    }
}

function sendInviteManagementDenial(
    req: FastifyRequest,
    res: FastifyReply,
    organization: OrganizationRow,
    actorId: string,
    input: {
        action: 'list_invites' | 'create_invite' | 'revoke_invite' | 'resend_invite' | 'manage_invites'
        inviteId?: string | null
        requestId?: string | null
        reason?: string | null
        message: string
    }
) {
    const denial = organizationInviteManagementDenial({
        organizationId: organization.id,
        actorId,
        actorRole: organization.role,
        ...input,
    })
    logOrganizationEvent(req, denial.serviceLogAction, organization.id, actorId, {
        requestId: denial.requestId,
        reason: denial.reason,
        action: denial.action,
        inviteId: denial.inviteId,
        actorRole: organization.role,
        denialReason: denial.denialReason,
    })
    return res.status(403).send({ error: input.message, inviteManagementDenial: denial })
}

function sendWatchlistMutationDenial(
    req: FastifyRequest,
    res: FastifyReply,
    organization: OrganizationRow,
    actorId: string,
    input: {
        action: 'create_watchlist' | 'update_watchlist' | 'archive_watchlist' | 'watchlist_lifecycle_action' | 'cleanup_watchlists'
        itemId?: string | null
        requestId?: string | null
        reason?: string | null
        message: string
    }
) {
    const denial = organizationWatchlistMutationDenial({
        organizationId: organization.id,
        actorId,
        actorRole: organization.role,
        ...input,
    })
    logOrganizationEvent(req, denial.serviceLogAction, organization.id, actorId, {
        requestId: denial.requestId,
        reason: denial.reason,
        action: denial.action,
        itemId: denial.itemId,
        actorRole: organization.role,
        denialReason: denial.denialReason,
    })
    return res.status(403).send({ error: input.message, watchlistMutationDenial: denial })
}

function sendWatchlistLookupDenial(
    req: FastifyRequest,
    res: FastifyReply,
    organization: OrganizationRow,
    actorId: string,
    input: {
        action: 'read_watchlist' | 'update_watchlist' | 'archive_watchlist' | OrganizationWatchlistAction
        itemId: string
        requestId?: string | null
        reason?: string | null
    }
) {
    const denial = {
        schemaVersion: 'organization.watchlist_lookup_denial.v1' as const,
        organizationId: organization.id,
        tenantId: organization.id,
        actorId,
        actorRole: organization.role ?? null,
        action: input.action,
        itemId: input.itemId,
        blockerCode: 'watchlist_not_found_or_cross_org' as const,
        statusCode: 404,
        nonmemberEnumeration: false as const,
        crossOrgEnumerationAllowed: false as const,
        message: 'Watchlist item not found.',
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'actorRole',
            'action',
            'itemId',
            'blockerCode',
            'requestId',
        ],
        noLeakFields: [
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'activeTerms[]',
        ],
        serviceLogAction: 'organization_watchlist_lookup_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
    logOrganizationEvent(req, denial.serviceLogAction, organization.id, actorId, {
        requestId: denial.requestId,
        reason: denial.reason,
        action: denial.action,
        itemId: denial.itemId,
        actorRole: organization.role,
        blockerCode: denial.blockerCode,
    })
    return res.status(404).send({ error: denial.message, watchlistLookupDenial: denial })
}

function removalPermissionError(actorRole: OrganizationRole | undefined, targetRole: OrganizationRole) {
    if (actorRole === 'owner') return null
    if (actorRole === 'admin' && (targetRole === 'member' || targetRole === 'viewer')) return null
    if (actorRole === 'admin') return 'Organization admins can only remove members and viewers.'
    return 'Only organization owners and admins can remove members.'
}

function roleUpdatePermissionError(actorRole: OrganizationRole | undefined, targetRole: OrganizationRole, newRole: OrganizationRole) {
    if (actorRole === 'owner') return null
    if (actorRole === 'admin' && (targetRole === 'member' || targetRole === 'viewer') && (newRole === 'member' || newRole === 'viewer')) return null
    if (actorRole === 'admin') return 'Organization admins can only update members and viewers to member or viewer roles.'
    return 'Only organization owners and admins can update member roles.'
}

function organizationTeamOnboardingReadiness(organization: ReturnType<typeof buildOrganizationBridgeContext>) {
    const targetMemberCount = 10
    const acceptedOrInvitedCount = organization.activeMemberCount + organization.pendingInviteCount
    const blockedReasons: string[] = []
    if (acceptedOrInvitedCount < targetMemberCount) {
        blockedReasons.push('needs_10_active_members_or_pending_invites')
    }

    if (organization.sharedWatchlistCount < 1) {
        blockedReasons.push('needs_shared_watchlist_item')
    }

    return {
        schemaVersion: 'organization.team_onboarding_readiness.v1',
        targetMemberCount,
        activeMemberCount: organization.activeMemberCount,
        pendingInviteCount: organization.pendingInviteCount,
        acceptedOrInvitedCount,
        sharedWatchlistCount: organization.sharedWatchlistCount,
        alertVisibilityPolicy: organization.alertVisibilityPolicy,
        canSupportTenMemberSharedWatchlistRollout: blockedReasons.length === 0,
        blockedReasons,
    }
}

function organizationSharedWatchlistContract(organization: OrganizationRow, items: OrganizationWatchlistRow[]) {
    const bridgeContext = buildOrganizationBridgeContext({
        ...organization,
        shared_watchlist_count: items.length,
    })
    const alertGeneration = organizationWatchlistAlertGenerationContract(organization, items)
    const activeItems = items.filter(item => (item.status ?? 'active') === 'active' && !item.archived_at)
    const pausedItems = items.filter(item => item.status === 'paused' && !item.archived_at)
    const archivedItems = items.filter(item => item.status === 'archived' || Boolean(item.archived_at))
    return {
        schemaVersion: 'organization.shared_watchlist_contract.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        visibilityPolicy: bridgeContext.alertVisibilityPolicy,
        allowedViewerRoles: bridgeContext.allowedViewerRoles,
        activeWatchlistTerms: alertGeneration.activeWatchlistTerms,
        termFamilies: alertGeneration.termFamilies,
        blockedReasons: alertGeneration.blockedReasons,
        canGenerateAlerts: alertGeneration.canGenerateAlerts,
        ownership: {
            organizationId: organization.id,
            ownerOrganizationId: organization.id,
            itemIds: items.map(item => item.id),
            activeItemIds: activeItems.map(item => item.id),
            pausedItemIds: pausedItems.map(item => item.id),
            archivedItemIds: archivedItems.map(item => item.id),
            creatorUserIds: [...new Set(items.map(item => item.created_by))].sort(),
            updaterUserIds: [...new Set(items.map(item => item.updated_by).filter(Boolean))].sort(),
            duplicateTermScope: 'organization',
            crossOrgEnumerationAllowed: false,
        },
        lifecycle: {
            activeCount: activeItems.length,
            pausedCount: pausedItems.length,
            archivedCount: archivedItems.length,
            cleanupRequired: pausedItems.length + archivedItems.length > 0,
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            archiveRoute: 'DELETE /api/organizations/:organizationId/watchlists/:itemId',
            actionRoute: 'POST /api/organizations/:organizationId/watchlists/:itemId/actions',
            cleanupIdempotent: true,
        },
        alertExportBridge: {
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            organizationId: organization.id,
            tenantId: organization.id,
            watchlistItemIds: alertGeneration.activeWatchlistTerms.map(term => term.watchlistItemId),
            termFamilies: alertGeneration.termFamilies,
            requiredFields: [
                'organizationId',
                'tenantId',
                'ownerOrganizationId',
                'sourceFamily',
                'activeTerms[].watchlistItemId',
                'activeTerms[].ownerOrganizationId',
                'activeTerms[].matchedTerm.termFamily',
                'activeTerms[].alertGenerationRef',
                'activeTerms[].alertGeneratorKey',
            ],
            ownerContextFields: [
                'ownerOrganizationId',
                'activeTerms[].ownerOrganizationId',
                'activeTerms[].createdBy',
                'activeTerms[].updatedBy',
                'activeTerms[].lifecycleRequestId',
            ],
            webhookOwnership: {
                schemaVersion: 'organization.shared_watchlist_webhook_ownership_hint.v1',
                requiredDestinationOrgId: organization.id,
                selectedDestinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                requiredAlertFields: ['alert.organizationId', 'alert.ownerOrganizationId', 'alert.watchlistItemIds'],
                redactedFields: ['destination.secret'],
                nonmemberDestinationEnumeration: false,
            },
            blockedReasons: alertGeneration.blockedReasons,
        },
        permissions: {
            actorRole: organization.role ?? 'viewer',
            canRead: true,
            canWrite: roleCanWriteWatchlist(organization.role),
            canArchive: roleCanWriteWatchlist(organization.role),
            canCleanup: roleCanWriteWatchlist(organization.role),
            writeRoles: ['owner', 'admin'],
            readRoles: ['owner', 'admin', 'member', 'viewer'],
            nonmemberEnumeration: false,
        },
    }
}

function organizationInviteListContract(organization: OrganizationRow, invites: OrganizationInviteRow[]) {
    const actorRole = organization.role ?? 'viewer'
    const pendingInvites = invites.filter(invite => invite.status === 'pending')
    return {
        schemaVersion: 'organization.invite_list_contract.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        actor: {
            role: actorRole,
            canListPendingInvites: roleCanManageOrganization(actorRole),
            canCreateInvites: roleCanManageOrganization(actorRole),
            canRevokeInvites: roleCanManageOrganization(actorRole),
            canResendInvites: roleCanManageOrganization(actorRole),
        },
        counts: {
            pendingInviteCount: pendingInvites.length,
            pendingAdminCount: pendingInvites.filter(invite => invite.role === 'admin').length,
            pendingMemberCount: pendingInvites.filter(invite => invite.role === 'member').length,
            pendingViewerCount: pendingInvites.filter(invite => invite.role === 'viewer').length,
        },
        routes: {
            inviteMembers: 'POST /api/organizations/:id/invites',
            acceptInvite: 'POST /api/organizations/invites/:inviteId/accept',
            inviteActions: 'POST /api/organizations/:id/invites/:inviteId/actions',
        },
        supportedRoles: ['admin', 'member', 'viewer'],
        supportedActions: ['revoke', 'resend'],
        idempotentActions: ['revoke', 'resend'],
        defaultExpiryDays: 14,
        acceptanceTokenField: 'invite.acceptanceToken',
        lifecycleDenials: {
            expiredInvite: 'invite_expired',
            revokedInvite: 'member_revoked',
            acceptedInviteReuse: 'invite_expired',
            nonManager: 'role_not_allowed',
            nonmemberEnumeration: false,
        },
        audit: {
            source: 'service_logs',
            eventActions: [
                'organization_invites_created',
                'organization_invite_accepted',
                'organization_invite_revoked',
                'organization_invite_resent',
            ],
            requiredMetadataFields: [
                'requestId',
                'role',
                'recipientCount',
                'invitedCount',
                'skippedCount',
                'inviteId',
                'action',
                'previousStatus',
                'newStatus',
            ],
        },
        noLeakFields: [
            'otherOrg.invites',
            'acceptedInvite.acceptanceToken',
            'revokedInvite.acceptanceToken',
        ],
    }
}

function organizationWatchlistOperation(
    organization: OrganizationRow,
    input: {
        action: 'created' | 'updated' | 'disabled' | 'pause' | 'resume' | 'archive' | 'restore'
        watchlistItemId: string
        actorId: string
        requestId?: string
        reason?: string
        serviceLogAction: string
        existingItemId?: string | null
        duplicateTermMatched?: boolean
    }
) {
    const decision = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })
    const nextLifecycle = organizationWatchlistOperationLifecycle(input.action)
    return {
        schemaVersion: 'organization.watchlist_operation.v1',
        action: input.action,
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        watchlistItemId: input.watchlistItemId,
        watchlistId: input.watchlistItemId,
        actorId: input.actorId,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        visibilityPolicy: decision.alertVisibilityPolicy,
        allowedViewerRoles: decision.allowedRoles,
        serviceLogAction: input.serviceLogAction,
        duplicateTermScope: 'organization' as const,
        ownerContext: {
            schemaVersion: 'organization.watchlist_owner_context.v1' as const,
            organizationId: organization.id,
            tenantId: organization.id,
            ownerOrganizationId: organization.id,
            watchlistItemId: input.watchlistItemId,
            watchlistId: input.watchlistItemId,
            actorId: input.actorId,
            actorRole: organization.role ?? 'viewer',
            visibilityPolicy: decision.alertVisibilityPolicy,
            allowedViewerRoles: decision.allowedRoles,
            sourceFamily: 'organization_watchlist' as const,
            route: 'organization_watchlist' as const,
            alertBridgeFields: [
                'organizationId',
                'tenantId',
                'ownerOrganizationId',
                'watchlistItemId',
                'watchlistId',
                'workflowContext.alertGenerationRefs',
                'workflowContext.alertGeneratorKeys',
            ],
            webhookBridgeFields: [
                'organizationId',
                'tenantId',
                'ownerOrganizationId',
                'watchlistItemId',
                'destination.org_id',
                'webhookDestinationIds[]',
            ],
            crossTenantCollisionAllowed: false,
            nonmemberEnumeration: false,
        },
        upsert: input.action === 'created' || input.action === 'updated'
            ? {
                schemaVersion: 'organization.watchlist_upsert.v1' as const,
                watchlistItemId: input.watchlistItemId,
                ownerOrganizationId: organization.id,
                idempotent: true,
                duplicateTermMatched: Boolean(input.duplicateTermMatched),
                existingItemId: input.existingItemId ?? null,
                actionTaken: input.duplicateTermMatched ? 'updated_existing_item' as const : 'created_new_item' as const,
                crossOrganizationDuplicateAllowed: true,
                sameOrganizationDuplicateCreatesNewItem: false,
                duplicateScopeKeyFields: ['organizationId', 'kind', 'normalizedValue'] as const,
                alertDedupeKeyFields: ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'] as const,
                webhookDestinationOrgField: 'destination.org_id' as const,
            }
            : null,
        lifecycleTransition: {
            schemaVersion: 'organization.watchlist_lifecycle_transition.v1',
            action: input.action,
            statusAfter: nextLifecycle.statusAfter,
            enabledAfter: nextLifecycle.enabledAfter,
            disabledReasonAfter: nextLifecycle.disabledReasonAfter,
            alertGenerationEligibleAfter: nextLifecycle.enabledAfter,
            activeTermsExportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            blockerAfter: nextLifecycle.disabledReasonAfter,
            mutationAfterArchiveDeniedByLookup: nextLifecycle.statusAfter === 'archived',
            lookupDenialBlockerAfter: nextLifecycle.statusAfter === 'archived'
                ? 'watchlist_not_found_or_cross_org' as const
                : null,
        },
    }
}

function organizationWatchlistOperationLifecycle(action: 'created' | 'updated' | 'disabled' | 'pause' | 'resume' | 'archive' | 'restore') {
    if (action === 'pause') {
        return {
            statusAfter: 'paused' as const,
            enabledAfter: false,
            disabledReasonAfter: 'watchlist_paused' as const,
        }
    }
    if (action === 'archive' || action === 'disabled') {
        return {
            statusAfter: 'archived' as const,
            enabledAfter: false,
            disabledReasonAfter: 'watchlist_archived' as const,
        }
    }
    return {
        statusAfter: 'active' as const,
        enabledAfter: true,
        disabledReasonAfter: null,
    }
}
