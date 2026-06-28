import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { actorHasAdminSupportAccess, recordAdminAuditEvent, requireAuditReason } from '#utils/adminAudit.ts'
import {
    buildOrganizationDwmAlertReference,
    normalizeInviteInput,
    normalizeMemberRoleInput,
    toInvite,
    toOrganization,
    toWatchlistItem,
    type InviteInput,
    type OrganizationRole,
    type OrganizationInviteRow,
    type OrganizationRow,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'

type AuditQuery = {
    q?: string
    org?: string
    actor?: string
    target?: string
    action?: string
    severity?: string
    source?: string
    service?: string
    entity?: string
    request?: string
    outcome?: string
    from?: string
    to?: string
    limit?: string
}

type OrganizationParams = {
    id: string
}

type UserParams = {
    id: string
}

type OrganizationMemberParams = OrganizationParams & {
    userId: string
}

type SupportInspectionQuery = {
    org?: string
    orgId?: string
    user?: string
    userId?: string
    email?: string
    request?: string
    requestId?: string
    entity?: string
    entityId?: string
    entityType?: string
    action?: string
    severity?: string
    outcome?: string
    from?: string
    to?: string
    limit?: string
}

type SupportInviteBody = InviteInput & {
    reason?: unknown
    context?: unknown
}

type SupportInviteActionParams = OrganizationParams & {
    inviteId: string
}

type SupportInviteActionBody = {
    action?: unknown
    reason?: unknown
    context?: unknown
    expiresAt?: unknown
    expires_at?: unknown
}

type SupportMemberRoleRecoveryBody = {
    role?: unknown
    reason?: unknown
    context?: unknown
    requestId?: unknown
    request_id?: unknown
}

type SupportAccessRecoveryBody = InviteInput & {
    targetUserId?: unknown
    reason?: unknown
    context?: unknown
    caseId?: unknown
    approvalRequired?: unknown
}

type AccessRecoveryDecisionParams = {
    requestId: string
}

type AccessRecoveryApprovalQuery = {
    request?: string
    requestId?: string
    org?: string
    orgId?: string
    status?: string
    outcome?: string
    requester?: string
    requestedBy?: string
    approver?: string
    approvedBy?: string
    from?: string
    to?: string
    limit?: string
}

type SupportAccessRecoveryDecisionBody = {
    reason?: unknown
    context?: unknown
}

type AccessRecoveryApprovalRow = {
    request_id: string
    organization_id: string
    invite_id: string
    target_user_id?: string | null
    requested_by: string
    requested_reason: string
    request_context: string
    approval_required: boolean
    status: 'pending' | 'approved' | 'denied' | 'not_required'
    approved_by?: string | null
    approved_at?: string | null
    denied_by?: string | null
    denied_at?: string | null
    decision_reason?: string | null
    outcome: 'success' | 'denied' | 'failed'
    expires_at: string
    created_at: string
    updated_at: string
    email?: string
    role?: string
    invite_status?: string
    organization_name?: string
    audit_events?: unknown
}

type SupportOrganizationAvailability = {
    organizationId: string
    ownerCount: number
    activeOwnerCount: number
    adminCount: number
    activeAdminCount: number
    hasAvailableOwner: boolean
    hasAvailableAdmin: boolean
}

export async function getAdminAuditEvents(req: FastifyRequest, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as AuditQuery
    const where: string[] = []
    const values: Array<string | number | Date | null> = []
    const add = (value: string | number | Date | null) => {
        values.push(value)
        return `$${values.length}`
    }

    const q = text(query.q)
    const org = text(query.org)
    const actorFilter = text(query.actor)
    const target = text(query.target)
    const action = text(query.action)
    const severity = normalizeOption(query.severity, ['info', 'notice', 'warning', 'critical'])
    const source = text(query.source)
    const service = text(query.service)
    const entity = text(query.entity)
    const request = text(query.request)
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 200)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500) : 200

    if (q) {
        const placeholder = add(`%${q}%`)
        where.push(`(
            e.action_type ILIKE ${placeholder}
            OR e.source ILIKE ${placeholder}
            OR e.service ILIKE ${placeholder}
            OR e.actor_id ILIKE ${placeholder}
            OR actor.name ILIKE ${placeholder}
            OR e.target_id ILIKE ${placeholder}
            OR target_user.name ILIKE ${placeholder}
            OR e.target_type ILIKE ${placeholder}
            OR e.organization_id ILIKE ${placeholder}
            OR organization.name ILIKE ${placeholder}
            OR e.entity_id ILIKE ${placeholder}
            OR e.request_id ILIKE ${placeholder}
            OR e.outcome ILIKE ${placeholder}
            OR e.reason ILIKE ${placeholder}
        )`)
    }
    if (org) {
        const placeholder = add(`%${org}%`)
        where.push('(e.organization_id ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
    if (actorFilter) {
        const placeholder = add(`%${actorFilter}%`)
        where.push('(e.actor_id ILIKE ' + placeholder + ' OR actor.name ILIKE ' + placeholder + ')')
    }
    if (target) {
        const placeholder = add(`%${target}%`)
        where.push('(e.target_id ILIKE ' + placeholder + ' OR target_user.name ILIKE ' + placeholder + ' OR e.target_type ILIKE ' + placeholder + ')')
    }
    if (action) where.push(`e.action_type ILIKE ${add(`%${action}%`)}`)
    if (severity) where.push(`e.severity = ${add(severity)}`)
    if (source) where.push(`e.source ILIKE ${add(`%${source}%`)}`)
    if (service) where.push(`e.service ILIKE ${add(`%${service}%`)}`)
    if (entity) where.push(`e.entity_id ILIKE ${add(`%${entity}%`)}`)
    if (request) where.push(`e.request_id ILIKE ${add(`%${request}%`)}`)
    if (outcome) where.push(`e.outcome = ${add(outcome)}`)
    if (from && !Number.isNaN(Date.parse(from))) where.push(`e.created_at >= ${add(new Date(from).toISOString())}`)
    if (to && !Number.isNaN(Date.parse(to))) where.push(`e.created_at <= ${add(new Date(to).toISOString())}`)

    const result = await run(`
        SELECT
            e.id,
            e.action_type,
            e.severity,
            e.source,
            e.service,
            e.actor_id,
            actor.name AS actor_name,
            e.target_type,
            e.target_id,
            target_user.name AS target_name,
            e.organization_id,
            organization.name AS organization_name,
            e.entity_id,
            e.request_id,
            e.outcome,
            e.reason,
            e.context,
            e.ip,
            e.user_agent,
            e.created_at
        FROM admin_audit_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target_user ON target_user.id = e.target_id
        LEFT JOIN organizations organization ON organization.id = e.organization_id
        ${where.length ? `WHERE ${where.join('\n          AND ')}` : ''}
        ORDER BY e.created_at DESC
        LIMIT ${add(limit)}
    `, values)

    const events = result.rows.map(toAdminAuditEvent)
    return res.send({
        events,
        filters: { q, org, actor: actorFilter, target, action, severity, source, service, entity, request, outcome, from, to, limit },
        detail: {
            schemaVersion: 'admin.audit.timeline.v1',
            generatedAt: new Date().toISOString(),
            filters: { q, org, actor: actorFilter, target, action, severity, source, service, entity, request, outcome, from, to, limit },
            copyText: events.slice(0, 20).map(event => event.detail.copyText).join('\n'),
        },
    })
}

export async function getSupportOrganization(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.organization.inspect',
            actorId: actor.id,
            targetType: 'organization',
            targetId: req.params.id,
            organizationId: req.params.id,
            severity: 'notice',
            outcome: 'failed',
            context: { error: 'organization_not_found' },
        })
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const [members, invites, watchlists, audit] = await Promise.all([
        run(`
            SELECT
                om.organization_id,
                om.user_id,
                users.name,
                users.avatar,
                users.active,
                users.deactivated_at,
                users.deletion_scheduled_at,
                om.role,
                om.status,
                om.invited_by,
                om.joined_at,
                om.created_at
            FROM organization_members om
            JOIN users ON users.id = om.user_id
            WHERE om.organization_id = $1
            ORDER BY
                CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                users.name ASC
        `, [organization.id]),
        run(`
            SELECT *
            FROM organization_invites
            WHERE organization_id = $1
            ORDER BY status ASC, created_at DESC
        `, [organization.id]),
        run(`
            SELECT *
            FROM organization_watchlist_items
            WHERE organization_id = $1
              AND archived_at IS NULL
            ORDER BY kind ASC, value ASC
        `, [organization.id]),
        run(`
            SELECT id, action_type, severity, source, service, actor_id, target_type, target_id, entity_id, request_id, outcome, reason, context, created_at
            FROM admin_audit_events
            WHERE organization_id = $1
            ORDER BY created_at DESC
            LIMIT 25
        `, [organization.id]),
    ])

    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.inspect',
        actorId: actor.id,
        targetType: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        severity: 'info',
        outcome: 'success',
        context: {
            memberCount: members.rows.length,
            pendingInviteCount: invites.rows.filter((invite: { status: string }) => invite.status === 'pending').length,
            watchlistItemCount: watchlists.rows.length,
        },
    })

    const watchlistItems = watchlists.rows as OrganizationWatchlistRow[]
    const alertReferences = watchlistItems.map(item => buildOrganizationDwmAlertReference(organization, item))
    return res.send({
        organization: toOrganization(organization),
        members: members.rows.map(toSupportMember),
        invites: (invites.rows as OrganizationInviteRow[]).map(toInvite),
        watchlistItems: watchlistItems.map(toWatchlistItem),
        alertReadiness: {
            schemaVersion: 'support.organization.alert_readiness.v1',
            organizationId: organization.id,
            watchlistItemCount: alertReferences.length,
            generatedAlertReferences: alertReferences,
            links: {
                api: `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`,
                console: `/dashboard/dwm?organizationId=${encodeURIComponent(organization.id)}`,
                audit: `/dashboard/system/impersonation?org=${encodeURIComponent(organization.id)}&action=support.organization`,
            },
        },
        supportLinks: {
            inspectUser: '/api/admin/support/users/:id',
            inviteAssist: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/invites`,
            accessRecovery: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/access-recovery`,
            audit: `/api/admin/audit-events?org=${encodeURIComponent(organization.id)}`,
        },
        recentAuditEvents: audit.rows,
    })
}

export async function getSupportUser(req: FastifyRequest<{ Params: UserParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const user = await run(`
        SELECT id, name, avatar, active, reserved, deactivated_at, deactivated_by, deletion_requested_at, deletion_scheduled_at
        FROM users
        WHERE id = $1
        LIMIT 1
    `, [req.params.id])
    const userRow = user.rows[0] as Record<string, unknown> | undefined
    if (!userRow) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.user.inspect',
            actorId: actor.id,
            targetType: 'user',
            targetId: req.params.id,
            severity: 'notice',
            outcome: 'failed',
            context: { error: 'user_not_found' },
        })
        return res.status(404).send({ error: 'User not found.' })
    }

    const [memberships, invites, audit] = await Promise.all([
        run(`
            SELECT
                om.organization_id,
                organizations.name AS organization_name,
                organizations.slug AS organization_slug,
                om.role,
                om.status,
                om.invited_by,
                om.joined_at,
                om.created_at
            FROM organization_members om
            JOIN organizations ON organizations.id = om.organization_id
            WHERE om.user_id = $1
            ORDER BY organizations.name ASC
        `, [req.params.id]),
        run(`
            SELECT organization_invites.*, organizations.name AS organization_name, organizations.slug AS organization_slug
            FROM organization_invites
            JOIN organizations ON organizations.id = organization_invites.organization_id
            WHERE lower(organization_invites.email) = lower($1)
              AND organization_invites.status = 'pending'
            ORDER BY organization_invites.created_at DESC
        `, [req.params.id]),
        run(`
            SELECT id, action_type, severity, source, service, actor_id, target_type, target_id, organization_id, entity_id, request_id, outcome, reason, context, created_at
            FROM admin_audit_events
            WHERE target_id = $1
               OR actor_id = $1
               OR entity_id = $1
            ORDER BY created_at DESC
            LIMIT 25
        `, [req.params.id]),
    ])

    await recordAdminAuditEvent(req, {
        actionType: 'support.user.inspect',
        actorId: actor.id,
        targetType: 'user',
        targetId: req.params.id,
        severity: 'info',
        outcome: 'success',
        context: {
            active: userRow.active,
            membershipCount: memberships.rows.length,
            pendingInviteCount: invites.rows.length,
            deletionScheduled: Boolean(userRow.deletion_scheduled_at),
        },
    })

    return res.send({
        user: toSupportUser(userRow),
        memberships: memberships.rows.map(toSupportMembership),
        pendingInvites: invites.rows.map(toSupportInvite),
        recentAuditEvents: audit.rows,
    })
}

export async function getSupportInspection(req: FastifyRequest<{ Querystring: SupportInspectionQuery }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as SupportInspectionQuery
    const org = text(query.org || query.orgId)
    const user = text(query.user || query.userId)
    const email = text(query.email).toLowerCase()
    const request = text(query.request || query.requestId)
    const entity = text(query.entity || query.entityId)
    const entityType = text(query.entityType)
    const action = text(query.action)
    const severity = normalizeOption(query.severity, ['info', 'notice', 'warning', 'critical'])
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 50)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100) : 50

    if (!org && !user && !email && !request && !entity && !entityType && !action) {
        return res.status(400).send({ error: 'Add org, user, email, request, entity, entityType, or action to inspect support state.' })
    }

    const [organizations, users, memberships, invites, approvals, audit] = await Promise.all([
        loadInspectionOrganizations({ org, user, email, request, limit }),
        loadInspectionUsers({ user, request, limit }),
        loadInspectionMemberships({ org, user, request, limit }),
        loadInspectionInvites({ org, email, request, limit }),
        loadInspectionApprovals({ org, user, email, request, outcome, limit }),
        loadInspectionAuditEvents({ org, user, email, request, entity, entityType, action, severity, outcome, from, to, limit }),
    ])

    const organizationIds = Array.from(new Set([
        ...organizations.map(row => String(row.id)),
        ...memberships.map(row => String(row.organization_id)),
        ...invites.map(row => String(row.organization_id)),
        ...approvals.map(row => String(row.organization_id)),
        ...audit.map(row => String((row as Record<string, unknown>).organization_id || '')).filter(Boolean),
    ]))
    const availability = organizationIds.length ? await loadOrganizationAvailability(organizationIds) : []
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const timeline = audit.map(toSupportAuditTimelineEvent)
    const approvalDetails = approvals.map(row => toAccessRecoveryDecision(row as AccessRecoveryApprovalRow))
    const recoveryEligibility = buildRecoveryEligibility({
        email,
        user,
        organizationIds,
        memberships,
        users,
        availabilityByOrg,
        invites,
    })

    await recordAdminAuditEvent(req, {
        actionType: 'support.inspect',
        actorId: actor.id,
        targetType: user ? 'user' : email ? 'invite' : org ? 'organization' : 'request',
        targetId: user || email || org || request,
        organizationId: organizationIds[0] || null,
        entityId: request || user || email || org || null,
        requestId: supportRequestId(req),
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.inspection.v1',
            filters: { org, user, email, request, entity, entityType, action, severity, outcome, from, to, limit },
            organizationCount: organizations.length,
            membershipCount: memberships.length,
            pendingInviteCount: invites.filter(row => row.status === 'pending').length,
            approvalCount: approvals.length,
            auditEventIds: timeline.map(event => event.id),
        },
    })

    return res.send({
        inspection: {
            schemaVersion: 'support.inspection.v1',
            generatedAt: new Date().toISOString(),
            filters: { org, user, email, request, entity, entityType, action, severity, outcome, from, to, limit },
            organizations: organizations.map(row => ({
                ...toOrganization(row as OrganizationRow),
                adminAvailability: availabilityByOrg.get(String(row.id)) || null,
            })),
            users: users.map(toSupportUser),
            memberships: memberships.map(toSupportMemberDetail),
            invites: invites.map(toSupportInvite),
            pendingInvites: invites.filter(row => row.status === 'pending').map(toSupportInvite),
            approvalRequests: approvalDetails,
            recoveryEligibility,
            auditEventIds: timeline.map(event => event.id),
            auditTimeline: timeline,
            controlledActions: {
                inviteAssist: organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
                inviteActions: invites.map(invite => `/api/admin/support/organizations/${encodeURIComponent(String(invite.organization_id))}/invites/${encodeURIComponent(String(invite.id))}/actions`),
                memberRoleRecovery: memberships.map(member => `/api/admin/support/organizations/${encodeURIComponent(String(member.organization_id))}/members/${encodeURIComponent(String(member.user_id))}/role-recovery`),
                accessRecovery: organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
                approvalSearch: `/api/admin/support/access-recovery${request ? `?request=${encodeURIComponent(request)}` : ''}`,
                impersonationGuard: {
                    reasonRequired: true,
                    durationRequired: true,
                    scopeRequired: true,
                    noSilentImpersonation: true,
                    auditTimeline: `/api/admin/audit-events?action=impersonation${request ? `&request=${encodeURIComponent(request)}` : ''}`,
                },
            },
            copyText: [
                `Support inspection org=${org || '*'} user=${user || '*'} email=${email || '*'} request=${request || '*'}`,
                `Organizations: ${organizations.length}`,
                `Memberships: ${memberships.length}`,
                `Pending invites: ${invites.filter(row => row.status === 'pending').length}`,
                `Approvals: ${approvalDetails.length}`,
                `Audit events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
            ].join('\n'),
        },
    })
}

export async function postSupportOrganizationInvite(req: FastifyRequest<{ Params: OrganizationParams, Body: SupportInviteBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    let input: ReturnType<typeof normalizeInviteInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Invite assistance reason')
        input = normalizeInviteInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support invite request.' })
    }

    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const rows: OrganizationInviteRow[] = []
    for (const email of input.emails) {
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
        `, [randomUUID(), organization.id, email, input.role, actor.id, input.expiresAt])
        rows.push(invite.rows[0] as OrganizationInviteRow)
    }

    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organization.id])
    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.invite_assist',
        actorId: actor.id,
        targetType: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        entityId: rows.map(row => row.id).join(','),
        severity: 'notice',
        outcome: 'success',
        reason,
        context: {
            emails: rows.map(row => row.email),
            role: input.role,
            expiresAt: input.expiresAt,
            inviteIds: rows.map(row => row.id),
            supportContext: cleanContext(req.body?.context),
        },
    })

    return res.status(201).send({ invites: rows.map(toInvite) })
}

export async function postSupportOrganizationInviteAction(req: FastifyRequest<{ Params: SupportInviteActionParams, Body: SupportInviteActionBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const action = normalizeOption(req.body?.action, ['revoke', 'resend'])
    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, 'Invite assistance action reason')
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support invite action reason.' })
    }
    if (!action) {
        return res.status(400).send({ error: 'Invite assistance action must be revoke or resend.' })
    }

    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const existing = await run(`
        SELECT *
        FROM organization_invites
        WHERE id = $1
          AND organization_id = $2
        LIMIT 1
    `, [req.params.inviteId, organization.id])
    const invite = existing.rows[0] as OrganizationInviteRow | undefined
    if (!invite) {
        return res.status(404).send({ error: 'Invite not found for organization.' })
    }

    const requestId = supportRequestId(req)
    const actionType = action === 'revoke'
        ? 'support.organization.invite_revoke'
        : 'support.organization.invite_resend'
    if (invite.status === 'accepted') {
        await recordAdminAuditEvent(req, {
            actionType,
            actorId: actor.id,
            targetType: 'invite',
            targetId: invite.email,
            organizationId: organization.id,
            entityId: invite.id,
            requestId,
            severity: 'notice',
            outcome: 'failed',
            reason,
            context: {
                schemaVersion: 'support.invite_action.v1',
                action,
                requestId,
                inviteId: invite.id,
                email: invite.email,
                role: invite.role,
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                noSilentMembershipMutation: true,
                error: 'accepted_invite_not_mutable_by_support_action',
                supportContext: cleanContext(req.body?.context),
            },
        })
        const auditEventIds = await loadAdminAuditEventIds({ requestId, actionType, entityId: invite.id })
        return res.status(409).send({
            error: 'Accepted invites cannot be revoked or resent by support action; inspect membership state instead.',
            inviteAction: {
                schemaVersion: 'support.invite_action.v1',
                action,
                requestId,
                actorId: actor.id,
                organization: toOrganization(organization),
                invite: toInvite(invite),
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                outcome: 'failed',
                auditEventIds,
                noSilentMembershipMutation: true,
            },
        })
    }

    let expiresAt = invite.expires_at
    if (action === 'resend') {
        try {
            expiresAt = normalizeInviteInput({
                email: invite.email,
                role: invite.role,
                expiresAt: req.body?.expiresAt ?? req.body?.expires_at ?? invite.expires_at,
            }).expiresAt
        } catch (error) {
            return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid invite resend expiry.' })
        }
    }

    const before = inviteSnapshot(invite)
    const updated = await run(`
        UPDATE organization_invites
        SET status = $3,
            accepted_at = NULL,
            accepted_by = NULL,
            expires_at = $4,
            created_at = CASE WHEN $3 = 'pending' THEN NOW() ELSE created_at END
        WHERE id = $1
          AND organization_id = $2
        RETURNING *
    `, [invite.id, organization.id, action === 'resend' ? 'pending' : 'revoked', expiresAt])
    const updatedInvite = updated.rows[0] as OrganizationInviteRow
    const after = inviteSnapshot(updatedInvite)
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organization.id])

    await recordAdminAuditEvent(req, {
        actionType,
        actorId: actor.id,
        targetType: 'invite',
        targetId: updatedInvite.email,
        organizationId: organization.id,
        entityId: updatedInvite.id,
        requestId,
        severity: action === 'revoke' ? 'warning' : 'notice',
        outcome: 'success',
        reason,
        context: {
            schemaVersion: 'support.invite_action.v1',
            action,
            requestId,
            inviteId: updatedInvite.id,
            email: updatedInvite.email,
            role: updatedInvite.role,
            before,
            after,
            noSilentMembershipMutation: true,
            mutation: 'invite_row_only',
            supportContext: cleanContext(req.body?.context),
        },
    })
    const auditEventIds = await loadAdminAuditEventIds({ requestId, actionType, entityId: updatedInvite.id })

    return res.send({
        inviteAction: {
            schemaVersion: 'support.invite_action.v1',
            action,
            requestId,
            actorId: actor.id,
            organization: toOrganization(organization),
            invite: toInvite(updatedInvite),
            before,
            after,
            reason,
            outcome: 'success',
            auditEventIds,
            noSilentMembershipMutation: true,
            audit: {
                actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: action === 'revoke' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: `/api/admin/audit-events?request=${encodeURIComponent(requestId)}&entity=${encodeURIComponent(updatedInvite.id)}&outcome=success&source=admin&service=hanasand-api`,
            },
            copyText: [
                `Support invite ${action} for ${updatedInvite.email}`,
                `Org: ${organization.name} (${organization.id})`,
                `Invite: ${updatedInvite.id}`,
                `Status: ${before.status} -> ${after.status}`,
                `Request: ${requestId}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}

export async function postSupportOrganizationMemberRoleRecovery(req: FastifyRequest<{ Params: OrganizationMemberParams, Body: SupportMemberRoleRecoveryBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    let input: ReturnType<typeof normalizeMemberRoleInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Member role recovery reason')
        input = normalizeMemberRoleInput({
            role: req.body?.role,
            reason,
            requestId: req.body?.requestId,
            request_id: req.body?.request_id,
        })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support member role recovery request.' })
    }

    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const member = await loadSupportMemberDetail(req.params.id, req.params.userId)
    if (!member || member.status !== 'active') {
        return res.status(404).send({ error: 'Active organization member not found.' })
    }

    const requestId = input.requestId || supportRequestId(req)
    const actionType = 'support.organization.member_role_recovery'
    const before = membershipSnapshot(member)
    const ownerCount = await activeOwnerCount(req.params.id)
    const permissionError = supportRoleRecoveryPermissionError(String(member.role) as OrganizationRole, input.role, ownerCount)
    const noOp = member.role === input.role
    if (permissionError || noOp) {
        const error = permissionError || 'member_role_already_set'
        await recordAdminAuditEvent(req, {
            actionType,
            actorId: actor.id,
            targetType: 'member',
            targetId: req.params.userId,
            organizationId: organization.id,
            entityId: req.params.userId,
            requestId,
            severity: 'notice',
            outcome: permissionError ? 'denied' : 'failed',
            reason,
            context: {
                schemaVersion: 'support.member_role_recovery.v1',
                requestId,
                targetUserId: req.params.userId,
                requestedRole: input.role,
                ownerCount,
                before,
                after: before,
                noSilentMembershipMutation: true,
                mutation: 'none',
                error,
                supportContext: cleanContext(req.body?.context),
            },
        })
        const auditEventIds = await loadAdminAuditEventIds({ requestId, actionType, entityId: req.params.userId })
        return res.status(permissionError ? 403 : 409).send({
            error: permissionError || 'Member already has the requested role.',
            memberRoleRecovery: {
                schemaVersion: 'support.member_role_recovery.v1',
                requestId,
                actorId: actor.id,
                organization: toOrganization(organization),
                member: toSupportMemberDetail(member),
                before,
                after: before,
                requestedRole: input.role,
                outcome: permissionError ? 'denied' : 'failed',
                auditEventIds,
                noSilentMembershipMutation: true,
            },
        })
    }

    const updated = await run(`
        UPDATE organization_members
        SET role = $3
        WHERE organization_id = $1
          AND user_id = $2
          AND status = 'active'
        RETURNING *
    `, [organization.id, req.params.userId, input.role])
    if (!updated.rows.length) {
        return res.status(404).send({ error: 'Active organization member not found.' })
    }
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organization.id])
    const updatedMember = {
        ...member,
        ...(updated.rows[0] as Record<string, unknown>),
    }
    const after = membershipSnapshot(updatedMember)

    await recordAdminAuditEvent(req, {
        actionType,
        actorId: actor.id,
        targetType: 'member',
        targetId: req.params.userId,
        organizationId: organization.id,
        entityId: req.params.userId,
        requestId,
        severity: input.role === 'admin' || before.role === 'owner' ? 'warning' : 'notice',
        outcome: 'success',
        reason,
        context: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId,
            targetUserId: req.params.userId,
            previousRole: before.role,
            newRole: after.role,
            ownerCount,
            before,
            after,
            noSilentMembershipMutation: true,
            mutation: 'member_role_only',
            supportContext: cleanContext(req.body?.context),
        },
    })
    const auditEventIds = await loadAdminAuditEventIds({ requestId, actionType, entityId: req.params.userId })

    return res.send({
        memberRoleRecovery: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId,
            actorId: actor.id,
            organization: toOrganization(organization),
            member: toSupportMemberDetail(updatedMember),
            before,
            after,
            reason,
            outcome: 'success',
            auditEventIds,
            noSilentMembershipMutation: true,
            audit: {
                actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: input.role === 'admin' || before.role === 'owner' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: `/api/admin/audit-events?request=${encodeURIComponent(requestId)}&entity=${encodeURIComponent(req.params.userId)}&action=member_role_recovery&outcome=success&source=admin&service=hanasand-api`,
            },
            copyText: [
                `Support member role recovery for ${req.params.userId}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${before.role} -> ${after.role}`,
                `Request: ${requestId}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}

export async function getSupportAccessRecoveryApprovals(req: FastifyRequest<{ Querystring: AccessRecoveryApprovalQuery }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as AccessRecoveryApprovalQuery
    const where: string[] = []
    const values: Array<string | number | Date | null> = []
    const add = (value: string | number | Date | null) => {
        values.push(value)
        return `$${values.length}`
    }

    const request = text(query.request || query.requestId)
    const org = text(query.org || query.orgId)
    const status = normalizeApprovalStatus(query.status)
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const requester = text(query.requester || query.requestedBy)
    const approver = text(query.approver || query.approvedBy)
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 100)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 250) : 100

    if (request) where.push(`approval.request_id ILIKE ${add(`%${request}%`)}`)
    if (org) {
        const placeholder = add(`%${org}%`)
        where.push('(approval.organization_id ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
    if (status) where.push(`approval.status = ${add(status)}`)
    if (outcome) where.push(`approval.outcome = ${add(outcome)}`)
    if (requester) where.push(`approval.requested_by ILIKE ${add(`%${requester}%`)}`)
    if (approver) {
        const placeholder = add(`%${approver}%`)
        where.push('(approval.approved_by ILIKE ' + placeholder + ' OR approval.denied_by ILIKE ' + placeholder + ')')
    }
    if (from && !Number.isNaN(Date.parse(from))) where.push(`approval.created_at >= ${add(new Date(from).toISOString())}`)
    if (to && !Number.isNaN(Date.parse(to))) where.push(`approval.created_at <= ${add(new Date(to).toISOString())}`)

    const result = await run(`
        SELECT
            approval.*,
            invite.email,
            invite.role,
            invite.status AS invite_status,
            organization.name AS organization_name,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', event.id,
                    'actionType', event.action_type,
                    'outcome', event.outcome,
                    'severity', event.severity,
                    'createdAt', event.created_at
                ) ORDER BY event.created_at ASC)
                FROM admin_audit_events event
                WHERE event.request_id = approval.request_id
                  AND event.action_type ILIKE 'support.organization.access_recovery%'
            ), '[]'::jsonb) AS audit_events
        FROM admin_access_recovery_approvals approval
        JOIN organization_invites invite ON invite.id = approval.invite_id
        LEFT JOIN organizations organization ON organization.id = approval.organization_id
        ${where.length ? `WHERE ${where.join('\n          AND ')}` : ''}
        ORDER BY approval.updated_at DESC, approval.created_at DESC
        LIMIT ${add(limit)}
    `, values)

    const approvals = (result.rows as AccessRecoveryApprovalRow[]).map(toAccessRecoveryDecision)
    return res.send({
        approvals,
        filters: { request, org, status, outcome, requester, approver, from, to, limit },
        detail: {
            schemaVersion: 'support.access_recovery.approval_search.v1',
            generatedAt: new Date().toISOString(),
            filters: { request, org, status, outcome, requester, approver, from, to, limit },
            copyText: approvals.slice(0, 20).map(approval => approval.copyText).join('\n\n'),
        },
    })
}

export async function postSupportAccessRecovery(req: FastifyRequest<{ Params: OrganizationParams, Body: SupportAccessRecoveryBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    let input: ReturnType<typeof normalizeInviteInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Access recovery reason')
        input = normalizeInviteInput({
            email: req.body?.email,
            emails: req.body?.emails,
            role: req.body?.role || 'admin',
            expiresAt: req.body?.expiresAt,
        })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid access recovery request.' })
    }

    if (input.emails.length !== 1) {
        return res.status(400).send({ error: 'Access recovery creates one controlled invite at a time.' })
    }

    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const targetUserId = text(req.body?.targetUserId)
    const existingMembership = targetUserId
        ? await run(`
            SELECT organization_id, user_id, role, status
            FROM organization_members
            WHERE organization_id = $1
              AND user_id = $2
            LIMIT 1
        `, [organization.id, targetUserId])
        : { rows: [] }

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
    `, [randomUUID(), organization.id, input.emails[0], input.role, actor.id, input.expiresAt])
    let inviteRow = invite.rows[0] as OrganizationInviteRow
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organization.id])

    const requestId = supportRequestId(req)
    const supportContext = cleanContext(req.body?.context)
    const approval = accessRecoveryApprovalMetadata({
        actorId: actor.id,
        role: inviteRow.role,
        expiresAt: inviteRow.expires_at,
        requestId,
        outcome: 'success',
        context: supportContext,
        existingMembership: existingMembership.rows[0],
        requestedApprovalRequired: req.body?.approvalRequired,
    })
    if (approval.approvalRequired) {
        const revokedInvite = await run(`
            UPDATE organization_invites
            SET status = 'revoked',
                accepted_at = NULL,
                accepted_by = NULL
            WHERE id = $1
            RETURNING *
        `, [inviteRow.id])
        inviteRow = revokedInvite.rows[0] as OrganizationInviteRow
    }
    await run(`
        INSERT INTO admin_access_recovery_approvals (
            request_id,
            organization_id,
            invite_id,
            target_user_id,
            requested_by,
            requested_reason,
            request_context,
            approval_required,
            status,
            outcome,
            expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'success', $10)
        ON CONFLICT (request_id)
        DO UPDATE SET organization_id = EXCLUDED.organization_id,
                      invite_id = EXCLUDED.invite_id,
                      target_user_id = EXCLUDED.target_user_id,
                      requested_by = EXCLUDED.requested_by,
                      requested_reason = EXCLUDED.requested_reason,
                      request_context = EXCLUDED.request_context,
                      approval_required = EXCLUDED.approval_required,
                      status = EXCLUDED.status,
                      approved_by = NULL,
                      approved_at = NULL,
                      denied_by = NULL,
                      denied_at = NULL,
                      decision_reason = NULL,
                      outcome = EXCLUDED.outcome,
                      expires_at = EXCLUDED.expires_at,
                      updated_at = NOW()
    `, [
        requestId,
        organization.id,
        inviteRow.id,
        targetUserId || null,
        actor.id,
        reason,
        supportContext,
        approval.approvalRequired,
        approval.approvalRequired ? 'pending' : 'not_required',
        inviteRow.expires_at,
    ])
    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.access_recovery',
        actorId: actor.id,
        targetType: targetUserId ? 'user' : 'invite',
        targetId: targetUserId || inviteRow.email,
        organizationId: organization.id,
        entityId: inviteRow.id,
        requestId,
        severity: 'warning',
        outcome: 'success',
        reason,
        context: {
            email: inviteRow.email,
            role: inviteRow.role,
            expiresAt: inviteRow.expires_at,
            inviteId: inviteRow.id,
            inviteStatus: inviteRow.status,
            targetUserId: targetUserId || null,
            existingMembership: existingMembership.rows[0] || null,
            caseId: text(req.body?.caseId) || null,
            supportContext,
            mutation: 'controlled_invite_only',
            approval,
        },
    })

    return res.status(201).send({
        recovery: {
            schemaVersion: 'support.access_recovery.v1',
            organization: toOrganization(organization),
            targetUserId: targetUserId || null,
            invite: toInvite(inviteRow),
            existingMembership: existingMembership.rows[0] || null,
            reason,
            requestId,
            requestedBy: actor.id,
            approvalRequired: approval.approvalRequired,
            approvalStatus: approval.status,
            approvedBy: approval.approvedBy,
            approvedAt: approval.approvedAt,
            approval,
            audit: {
                actionType: 'support.organization.access_recovery',
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: 'warning',
                query: `/api/admin/audit-events?request=${encodeURIComponent(requestId)}&outcome=success&source=admin&service=hanasand-api`,
            },
            copyText: [
                `Access recovery invite created for ${inviteRow.email}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${inviteRow.role}`,
                `Expires: ${inviteRow.expires_at}`,
                `Request: ${requestId}`,
                `Approval: ${approval.status}`,
                approval.approvalRequired ? 'Share status: blocked until approved' : 'Share status: ready',
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}

export async function postSupportAccessRecoveryApprove(req: FastifyRequest<{ Params: AccessRecoveryDecisionParams, Body: SupportAccessRecoveryDecisionBody }>, res: FastifyReply) {
    return decideSupportAccessRecovery(req, res, 'approved')
}

export async function postSupportAccessRecoveryDeny(req: FastifyRequest<{ Params: AccessRecoveryDecisionParams, Body: SupportAccessRecoveryDecisionBody }>, res: FastifyReply) {
    return decideSupportAccessRecovery(req, res, 'denied')
}

async function decideSupportAccessRecovery(
    req: FastifyRequest<{ Params: AccessRecoveryDecisionParams, Body: SupportAccessRecoveryDecisionBody }>,
    res: FastifyReply,
    decision: 'approved' | 'denied',
) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, decision === 'approved' ? 'Access recovery approval reason' : 'Access recovery denial reason')
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid access recovery decision reason.' })
    }

    const current = await loadAccessRecoveryApproval(req.params.requestId)
    if (!current) {
        await recordAdminAuditEvent(req, {
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            actorId: actor.id,
            targetType: 'access_recovery',
            targetId: req.params.requestId,
            entityId: req.params.requestId,
            requestId: req.params.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason,
            context: { error: 'access_recovery_request_not_found' },
        })
        return res.status(404).send({ error: 'Access recovery request not found.' })
    }

    if (!current.approval_required) {
        await recordAccessRecoveryDecisionAudit(req, actor.id, current, decision, 'failed', reason, { error: 'approval_not_required' })
        return res.status(409).send({ error: 'This access recovery request does not require approval.', decision: toAccessRecoveryDecision(current) })
    }

    if (current.requested_by === actor.id) {
        await recordAccessRecoveryDecisionAudit(req, actor.id, current, decision, 'denied', reason, { error: 'self_approval_denied' })
        return res.status(403).send({ error: 'Access recovery approval requires a different admin than the requester.', decision: toAccessRecoveryDecision(current) })
    }

    if (current.status !== 'pending') {
        await recordAccessRecoveryDecisionAudit(req, actor.id, current, decision, 'failed', reason, { error: 'approval_not_pending', status: current.status })
        return res.status(409).send({ error: `Access recovery request is already ${current.status}.`, decision: toAccessRecoveryDecision(current) })
    }

    const updatedApproval = decision === 'approved'
        ? await run(`
            UPDATE admin_access_recovery_approvals
            SET status = 'approved',
                approved_by = $2,
                approved_at = NOW(),
                denied_by = NULL,
                denied_at = NULL,
                decision_reason = $3,
                outcome = 'success',
                updated_at = NOW()
            WHERE request_id = $1
            RETURNING *
        `, [current.request_id, actor.id, reason])
        : await run(`
            UPDATE admin_access_recovery_approvals
            SET status = 'denied',
                approved_by = NULL,
                approved_at = NULL,
                denied_by = $2,
                denied_at = NOW(),
                decision_reason = $3,
                outcome = 'denied',
                updated_at = NOW()
            WHERE request_id = $1
            RETURNING *
        `, [current.request_id, actor.id, reason])

    const invite = await run(`
        UPDATE organization_invites
        SET status = $2,
            accepted_at = NULL,
            accepted_by = NULL
        WHERE id = $1
        RETURNING *
    `, [current.invite_id, decision === 'approved' ? 'pending' : 'revoked'])

    const updated = {
        ...current,
        ...(updatedApproval.rows[0] as AccessRecoveryApprovalRow),
        email: current.email,
        role: current.role,
        organization_name: current.organization_name,
        invite_status: (invite.rows[0] as OrganizationInviteRow | undefined)?.status || current.invite_status,
    } as AccessRecoveryApprovalRow
    const detail = toAccessRecoveryDecision(updated)
    await recordAccessRecoveryDecisionAudit(req, actor.id, updated, decision, decision === 'approved' ? 'success' : 'denied', reason, {
        decision: detail,
        supportContext: cleanContext(req.body?.context),
    })

    return res.send({ decision: detail })
}

async function requireAdminSupport(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id || actor.impersonating) {
        res.status(401).send({ error: actor.error || 'Unauthorized.' })
        return null
    }
    if (!await actorHasAdminSupportAccess(actor.id)) {
        res.status(403).send({ error: 'Only admins can use support operations.' })
        return null
    }
    return { id: actor.id }
}

async function loadOrganizationSupportDetail(organizationId: string) {
    const result = await run(`
        SELECT
            o.*,
            COUNT(DISTINCT active_members.user_id)::int AS member_count,
            COUNT(DISTINCT pending_invites.id)::int AS pending_invite_count
        FROM organizations o
        LEFT JOIN organization_members active_members
          ON active_members.organization_id = o.id
         AND active_members.status = 'active'
        LEFT JOIN organization_invites pending_invites
          ON pending_invites.organization_id = o.id
         AND pending_invites.status = 'pending'
        WHERE o.id = $1
        GROUP BY o.id
        LIMIT 1
    `, [organizationId])

    return result.rows[0] as OrganizationRow | undefined
}

async function loadInspectionOrganizations(input: { org: string, user: string, email: string, request: string, limit: number }) {
    const where: string[] = []
    const values: Array<string | number> = []
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(o.id ILIKE ' + placeholder + ' OR o.name ILIKE ' + placeholder + ' OR o.slug ILIKE ' + placeholder + ')')
    }
    if (input.user) {
        where.push(`EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = o.id
              AND om.user_id ILIKE ${add(`%${input.user}%`)}
        )`)
    }
    if (input.email) {
        where.push(`EXISTS (
            SELECT 1 FROM organization_invites invite
            WHERE invite.organization_id = o.id
              AND lower(invite.email) = lower(${add(input.email)})
        )`)
    }
    if (input.request) {
        const placeholder = add(`%${input.request}%`)
        where.push(`(
            EXISTS (SELECT 1 FROM admin_access_recovery_approvals approval WHERE approval.organization_id = o.id AND approval.request_id ILIKE ${placeholder})
            OR EXISTS (SELECT 1 FROM admin_audit_events event WHERE event.organization_id = o.id AND event.request_id ILIKE ${placeholder})
        )`)
    }
    if (!where.length) return []

    const result = await run(`
        SELECT
            o.*,
            COUNT(DISTINCT active_members.user_id)::int AS member_count,
            COUNT(DISTINCT pending_invites.id)::int AS pending_invite_count
        FROM organizations o
        LEFT JOIN organization_members active_members
          ON active_members.organization_id = o.id
         AND active_members.status = 'active'
        LEFT JOIN organization_invites pending_invites
          ON pending_invites.organization_id = o.id
         AND pending_invites.status = 'pending'
        WHERE ${where.join('\n           OR ')}
        GROUP BY o.id
        ORDER BY o.updated_at DESC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}

async function loadInspectionUsers(input: { user: string, request: string, limit: number }) {
    const where: string[] = []
    const values: Array<string | number> = []
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (input.user) {
        const placeholder = add(`%${input.user}%`)
        where.push('(users.id ILIKE ' + placeholder + ' OR users.name ILIKE ' + placeholder + ')')
    }
    if (input.request) {
        const placeholder = add(`%${input.request}%`)
        where.push(`(
            EXISTS (
                SELECT 1 FROM admin_access_recovery_approvals approval
                WHERE approval.request_id ILIKE ${placeholder}
                  AND users.id IN (approval.requested_by, approval.target_user_id, approval.approved_by, approval.denied_by)
            )
            OR EXISTS (
                SELECT 1 FROM admin_audit_events event
                WHERE event.request_id ILIKE ${placeholder}
                  AND users.id IN (event.actor_id, event.target_id)
            )
        )`)
    }
    if (!where.length) return []

    const result = await run(`
        SELECT id, name, avatar, active, reserved, deactivated_at, deactivated_by, deletion_requested_at, deletion_scheduled_at
        FROM users
        WHERE ${where.join('\n           OR ')}
        ORDER BY name ASC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}

async function loadInspectionMemberships(input: { org: string, user: string, request: string, limit: number }) {
    const where: string[] = []
    const values: Array<string | number> = []
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(om.organization_id ILIKE ' + placeholder + ' OR organizations.name ILIKE ' + placeholder + ' OR organizations.slug ILIKE ' + placeholder + ')')
    }
    if (input.user) where.push(`om.user_id ILIKE ${add(`%${input.user}%`)}`)
    if (input.request) {
        const placeholder = add(`%${input.request}%`)
        where.push(`EXISTS (
            SELECT 1 FROM admin_access_recovery_approvals approval
            WHERE approval.request_id ILIKE ${placeholder}
              AND approval.organization_id = om.organization_id
              AND (approval.target_user_id = om.user_id OR approval.requested_by = om.user_id)
        )`)
    }
    if (!where.length) return []

    const result = await run(`
        SELECT
            om.organization_id,
            organizations.name AS organization_name,
            organizations.slug AS organization_slug,
            om.user_id,
            users.name,
            users.avatar,
            users.active,
            users.deactivated_at,
            users.deletion_scheduled_at,
            om.role,
            om.status,
            om.invited_by,
            om.joined_at,
            om.created_at
        FROM organization_members om
        JOIN users ON users.id = om.user_id
        JOIN organizations ON organizations.id = om.organization_id
        WHERE ${where.join('\n           AND ')}
        ORDER BY organizations.name ASC, users.name ASC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}

async function loadInspectionInvites(input: { org: string, email: string, request: string, limit: number }) {
    const where: string[] = []
    const values: Array<string | number> = []
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(organization_invites.organization_id ILIKE ' + placeholder + ' OR organizations.name ILIKE ' + placeholder + ' OR organizations.slug ILIKE ' + placeholder + ')')
    }
    if (input.email) where.push(`lower(organization_invites.email) = lower(${add(input.email)})`)
    if (input.request) {
        const placeholder = add(`%${input.request}%`)
        where.push(`EXISTS (
            SELECT 1 FROM admin_access_recovery_approvals approval
            WHERE approval.request_id ILIKE ${placeholder}
              AND approval.invite_id = organization_invites.id
        )`)
    }
    if (!where.length) return []

    const result = await run(`
        SELECT organization_invites.*, organizations.name AS organization_name, organizations.slug AS organization_slug
        FROM organization_invites
        JOIN organizations ON organizations.id = organization_invites.organization_id
        WHERE ${where.join('\n           AND ')}
        ORDER BY organization_invites.status ASC, organization_invites.created_at DESC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}

async function loadInspectionApprovals(input: { org: string, user: string, email: string, request: string, outcome: string, limit: number }) {
    const where: string[] = []
    const values: Array<string | number> = []
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(approval.organization_id ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
    if (input.user) {
        const placeholder = add(`%${input.user}%`)
        where.push('(approval.target_user_id ILIKE ' + placeholder + ' OR approval.requested_by ILIKE ' + placeholder + ' OR approval.approved_by ILIKE ' + placeholder + ' OR approval.denied_by ILIKE ' + placeholder + ')')
    }
    if (input.email) where.push(`lower(invite.email) = lower(${add(input.email)})`)
    if (input.request) where.push(`approval.request_id ILIKE ${add(`%${input.request}%`)}`)
    if (input.outcome) where.push(`approval.outcome = ${add(input.outcome)}`)
    if (!where.length) return []

    const result = await run(`
        SELECT
            approval.*,
            invite.email,
            invite.role,
            invite.status AS invite_status,
            organization.name AS organization_name,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', event.id,
                    'actionType', event.action_type,
                    'outcome', event.outcome,
                    'severity', event.severity,
                    'createdAt', event.created_at
                ) ORDER BY event.created_at ASC)
                FROM admin_audit_events event
                WHERE event.request_id = approval.request_id
                  AND event.action_type ILIKE 'support.organization.access_recovery%'
            ), '[]'::jsonb) AS audit_events
        FROM admin_access_recovery_approvals approval
        JOIN organization_invites invite ON invite.id = approval.invite_id
        LEFT JOIN organizations organization ON organization.id = approval.organization_id
        WHERE ${where.join('\n           AND ')}
        ORDER BY approval.updated_at DESC, approval.created_at DESC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as AccessRecoveryApprovalRow[]
}

async function loadInspectionAuditEvents(input: { org: string, user: string, email: string, request: string, entity: string, entityType: string, action: string, severity: string, outcome: string, from: string, to: string, limit: number }) {
    const where: string[] = []
    const values: Array<string | number> = []
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (input.org) {
        const placeholder = add(`%${input.org}%`)
        where.push('(event.organization_id ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
    if (input.user) {
        const placeholder = add(`%${input.user}%`)
        where.push('(event.actor_id ILIKE ' + placeholder + ' OR event.target_id ILIKE ' + placeholder + ' OR event.entity_id ILIKE ' + placeholder + ')')
    }
    if (input.email) {
        const placeholder = add(`%${input.email}%`)
        where.push('(event.target_id ILIKE ' + placeholder + ' OR event.context->>\'email\' ILIKE ' + placeholder + ')')
    }
    if (input.request) where.push(`event.request_id ILIKE ${add(`%${input.request}%`)}`)
    if (input.entity) {
        const placeholder = add(`%${input.entity}%`)
        where.push('(event.entity_id ILIKE ' + placeholder + ' OR event.target_id ILIKE ' + placeholder + ' OR event.context->>\'inviteId\' ILIKE ' + placeholder + ')')
    }
    if (input.entityType) where.push(`event.target_type ILIKE ${add(`%${input.entityType}%`)}`)
    if (input.action) where.push(`event.action_type ILIKE ${add(`%${input.action}%`)}`)
    if (input.severity) where.push(`event.severity = ${add(input.severity)}`)
    if (input.outcome) where.push(`event.outcome = ${add(input.outcome)}`)
    if (input.from && !Number.isNaN(Date.parse(input.from))) where.push(`event.created_at >= ${add(new Date(input.from).toISOString())}`)
    if (input.to && !Number.isNaN(Date.parse(input.to))) where.push(`event.created_at <= ${add(new Date(input.to).toISOString())}`)
    if (!where.length) return []

    const result = await run(`
        SELECT
            event.id,
            event.action_type,
            event.severity,
            event.source,
            event.service,
            event.actor_id,
            actor.name AS actor_name,
            event.target_type,
            event.target_id,
            target_user.name AS target_name,
            event.organization_id,
            organization.name AS organization_name,
            event.entity_id,
            event.request_id,
            event.outcome,
            event.reason,
            event.context,
            event.created_at
        FROM admin_audit_events event
        LEFT JOIN users actor ON actor.id = event.actor_id
        LEFT JOIN users target_user ON target_user.id = event.target_id
        LEFT JOIN organizations organization ON organization.id = event.organization_id
        WHERE ${where.join('\n           AND ')}
        ORDER BY event.created_at DESC
        LIMIT ${add(input.limit)}
    `, values)
    return result.rows as Record<string, unknown>[]
}

async function loadAdminAuditEventIds(input: { requestId: string, actionType: string, entityId: string }) {
    const result = await run(`
        SELECT id
        FROM admin_audit_events
        WHERE request_id = $1
          AND action_type = $2
          AND entity_id = $3
        ORDER BY created_at DESC, id DESC
        LIMIT 10
    `, [input.requestId, input.actionType, input.entityId])
    return result.rows.map((row: Record<string, unknown>) => Number(row.id)).filter(id => Number.isFinite(id))
}

async function loadSupportMemberDetail(organizationId: string, userId: string) {
    const result = await run(`
        SELECT
            om.organization_id,
            organizations.name AS organization_name,
            organizations.slug AS organization_slug,
            om.user_id,
            users.name,
            users.avatar,
            users.active,
            users.deactivated_at,
            users.deletion_scheduled_at,
            om.role,
            om.status,
            om.invited_by,
            om.joined_at,
            om.created_at
        FROM organization_members om
        JOIN users ON users.id = om.user_id
        JOIN organizations ON organizations.id = om.organization_id
        WHERE om.organization_id = $1
          AND om.user_id = $2
        LIMIT 1
    `, [organizationId, userId])
    return result.rows[0] as Record<string, unknown> | undefined
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

function supportRoleRecoveryPermissionError(currentRole: OrganizationRole, newRole: OrganizationRole, ownerCount: number) {
    if (newRole === 'owner') return 'Support role recovery cannot grant organization owner.'
    if (!['owner', 'admin', 'member', 'viewer'].includes(currentRole)) return 'Unsupported current member role.'
    if (currentRole === 'owner' && ownerCount <= 1) return 'Support role recovery cannot demote the last active owner.'
    return ''
}

async function loadOrganizationAvailability(organizationIds: string[]) {
    const result = await run(`
        SELECT
            om.organization_id,
            COUNT(*) FILTER (WHERE om.role = 'owner' AND om.status = 'active')::int AS owner_count,
            COUNT(*) FILTER (WHERE om.role = 'owner' AND om.status = 'active' AND users.active)::int AS active_owner_count,
            COUNT(*) FILTER (WHERE om.role IN ('owner', 'admin') AND om.status = 'active')::int AS admin_count,
            COUNT(*) FILTER (WHERE om.role IN ('owner', 'admin') AND om.status = 'active' AND users.active)::int AS active_admin_count
        FROM organization_members om
        JOIN users ON users.id = om.user_id
        WHERE om.organization_id = ANY($1::text[])
        GROUP BY om.organization_id
    `, [organizationIds])
    return result.rows.map((row: Record<string, unknown>) => {
        const activeOwnerCount = Number(row.active_owner_count || 0)
        const activeAdminCount = Number(row.active_admin_count || 0)
        return {
            organizationId: String(row.organization_id),
            ownerCount: Number(row.owner_count || 0),
            activeOwnerCount,
            adminCount: Number(row.admin_count || 0),
            activeAdminCount,
            hasAvailableOwner: activeOwnerCount > 0,
            hasAvailableAdmin: activeAdminCount > 0,
        }
    }) as SupportOrganizationAvailability[]
}

async function loadAccessRecoveryApproval(requestId: string) {
    const result = await run(`
        SELECT
            approval.*,
            invite.email,
            invite.role,
            invite.status AS invite_status,
            organization.name AS organization_name
        FROM admin_access_recovery_approvals approval
        JOIN organization_invites invite ON invite.id = approval.invite_id
        LEFT JOIN organizations organization ON organization.id = approval.organization_id
        WHERE approval.request_id = $1
        LIMIT 1
    `, [requestId])
    return result.rows[0] as AccessRecoveryApprovalRow | undefined
}

async function recordAccessRecoveryDecisionAudit(
    req: FastifyRequest,
    actorId: string,
    row: AccessRecoveryApprovalRow,
    decision: 'approved' | 'denied',
    outcome: 'success' | 'denied' | 'failed',
    reason: string,
    extra: Record<string, unknown> = {},
) {
    await recordAdminAuditEvent(req, {
        actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
        actorId,
        targetType: 'invite',
        targetId: row.invite_id,
        organizationId: row.organization_id,
        entityId: row.invite_id,
        requestId: row.request_id,
        severity: outcome === 'success' ? 'warning' : 'notice',
        outcome,
        reason,
        context: {
            schemaVersion: 'support.access_recovery.decision_audit.v1',
            requestId: row.request_id,
            inviteId: row.invite_id,
            inviteStatus: row.invite_status,
            requestedBy: row.requested_by,
            approvalRequired: row.approval_required,
            status: row.status,
            approvedBy: row.approved_by || null,
            approvedAt: row.approved_at || null,
            deniedBy: row.denied_by || null,
            deniedAt: row.denied_at || null,
            outcome,
            ...extra,
        },
    })
}

function toSupportUser(row: Record<string, unknown>) {
    return {
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        active: row.active,
        reserved: row.reserved,
        deactivatedAt: row.deactivated_at,
        deactivatedBy: row.deactivated_by,
        deletionRequestedAt: row.deletion_requested_at,
        deletionScheduledAt: row.deletion_scheduled_at,
    }
}

function toSupportMember(row: Record<string, unknown>) {
    return {
        organizationId: row.organization_id,
        userId: row.user_id,
        name: row.name,
        avatar: row.avatar,
        active: row.active,
        deactivatedAt: row.deactivated_at,
        deletionScheduledAt: row.deletion_scheduled_at,
        role: row.role,
        status: row.status,
        invitedBy: row.invited_by,
        joinedAt: row.joined_at,
        createdAt: row.created_at,
    }
}

function toSupportMemberDetail(row: Record<string, unknown>) {
    return {
        ...toSupportMember(row),
        organizationName: row.organization_name,
        organizationSlug: row.organization_slug,
        removed: row.status === 'removed',
        deactivated: row.active === false || Boolean(row.deactivated_at),
        deletionScheduled: Boolean(row.deletion_scheduled_at),
    }
}

function membershipSnapshot(row: Record<string, unknown>) {
    return {
        organizationId: row.organization_id,
        userId: row.user_id,
        role: row.role,
        status: row.status,
        active: row.active,
        deactivatedAt: row.deactivated_at || null,
        invitedBy: row.invited_by || null,
        joinedAt: row.joined_at || null,
        createdAt: row.created_at || null,
    }
}

function toSupportMembership(row: Record<string, unknown>) {
    return {
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationSlug: row.organization_slug,
        role: row.role,
        status: row.status,
        invitedBy: row.invited_by,
        joinedAt: row.joined_at,
        createdAt: row.created_at,
    }
}

function buildRecoveryEligibility(input: {
    email: string
    user: string
    organizationIds: string[]
    memberships: Record<string, unknown>[]
    users: Record<string, unknown>[]
    availabilityByOrg: Map<string, SupportOrganizationAvailability>
    invites: Record<string, unknown>[]
}) {
    return input.organizationIds.map((organizationId) => {
        const availability = input.availabilityByOrg.get(organizationId) || {
            organizationId,
            ownerCount: 0,
            activeOwnerCount: 0,
            adminCount: 0,
            activeAdminCount: 0,
            hasAvailableOwner: false,
            hasAvailableAdmin: false,
        }
        const membership = input.memberships.find(row => row.organization_id === organizationId && (!input.user || row.user_id === input.user))
        const user = input.users.find(row => row.id === input.user)
        const invites = input.invites.filter(row => row.organization_id === organizationId)
        const reasons = [
            availability.hasAvailableAdmin ? 'available_admin_present' : 'no_available_admin',
            membership?.status === 'removed' ? 'member_removed' : '',
            user && user.active === false ? 'user_deactivated' : '',
            invites.some(row => row.status === 'pending') ? 'pending_invite_exists' : '',
            input.email || input.user ? '' : 'missing_target_email_or_user',
        ].filter(Boolean)
        return {
            schemaVersion: 'support.access_recovery.eligibility.v1',
            organizationId,
            targetEmail: input.email || null,
            targetUserId: input.user || null,
            canCreateControlledInvite: Boolean(input.email && organizationId),
            noSilentMembershipMutation: true,
            requiresApproval: true,
            recommended: !availability.hasAvailableAdmin || membership?.status === 'removed' || user?.active === false,
            reasons,
            adminAvailability: availability,
        }
    })
}

function toSupportInvite(row: Record<string, unknown>) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationSlug: row.organization_slug,
        email: row.email,
        role: row.role,
        invitedBy: row.invited_by,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
    }
}

function inviteSnapshot(row: OrganizationInviteRow) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        email: row.email,
        role: row.role,
        status: row.status,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at || null,
        acceptedBy: row.accepted_by || null,
    }
}

function toSupportAuditTimelineEvent(row: Record<string, unknown>) {
    const event = row as Record<string, any>
    const context = event.context && typeof event.context === 'object' ? event.context : {}
    const beforeAfter = auditBeforeAfter(context)
    return {
        id: Number(event.id),
        actor: {
            id: event.actor_id,
            name: event.actor_name || null,
        },
        target: {
            type: event.target_type || null,
            id: event.target_id || null,
            name: event.target_name || null,
        },
        entityType: event.target_type || 'admin_audit_event',
        entityId: event.entity_id || event.target_id || event.organization_id || null,
        organizationId: event.organization_id || null,
        organizationName: event.organization_name || null,
        action: event.action_type,
        outcome: event.outcome,
        severity: event.severity,
        requestId: event.request_id || null,
        reason: event.reason || '',
        before: beforeAfter.before,
        after: beforeAfter.after,
        context,
        createdAt: event.created_at,
        copyText: `${event.created_at} ${event.severity}/${event.outcome} ${event.action_type} actor=${event.actor_id} entity=${event.entity_id || event.target_id || ''} request=${event.request_id || ''}`,
    }
}

function toAdminAuditEvent(row: Record<string, unknown>): Record<string, any> {
    const event = row as Record<string, any>
    const context = event.context || {}
    const beforeAfter = auditBeforeAfter(context)
    return {
        ...event,
        detail: {
            schemaVersion: 'admin.audit.event_detail.v1',
            actionType: event.action_type,
            source: event.source,
            service: event.service,
            severity: event.severity,
            outcome: event.outcome,
            actorId: event.actor_id,
            targetType: event.target_type,
            targetId: event.target_id,
            organizationId: event.organization_id,
            entityId: event.entity_id,
            requestId: event.request_id,
            reason: event.reason,
            before: beforeAfter.before,
            after: beforeAfter.after,
            context,
            copyText: `${event.created_at} ${event.severity}/${event.outcome} ${event.action_type} actor=${event.actor_id} target=${event.target_id || ''} org=${event.organization_id || ''} request=${event.request_id || ''} reason=${event.reason || ''}`,
        },
    }
}

function auditBeforeAfter(context: Record<string, unknown>) {
    const before = context.before || context.previous || pickPrefixedContext(context, 'previous')
    const after = context.after || context.next || pickPrefixedContext(context, 'new')
    return {
        before: isPlainObject(before) && Object.keys(before).length ? before : null,
        after: isPlainObject(after) && Object.keys(after).length ? after : null,
    }
}

function pickPrefixedContext(context: Record<string, unknown>, prefix: string) {
    return Object.fromEntries(Object.entries(context).filter(([key]) => key.toLowerCase().startsWith(prefix)))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function toAccessRecoveryDecision(row: AccessRecoveryApprovalRow) {
    const displayStatus = row.status === 'pending' ? 'pending_approval' : row.status
    const auditEvents = normalizeAuditEventList(row.audit_events)
    return {
        schemaVersion: 'support.access_recovery.approval_decision.v1',
        requestId: row.request_id,
        organizationId: row.organization_id,
        organizationName: row.organization_name || '',
        inviteId: row.invite_id,
        targetUserId: row.target_user_id || null,
        requestedBy: row.requested_by,
        requestedReason: row.requested_reason,
        requestContext: row.request_context,
        approvalRequired: row.approval_required,
        status: displayStatus,
        approvedBy: row.approved_by || null,
        approvedAt: row.approved_at || null,
        deniedBy: row.denied_by || null,
        deniedAt: row.denied_at || null,
        decisionReason: row.decision_reason || null,
        outcome: row.outcome,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        auditEventIds: auditEvents.map(event => event.id),
        auditEvents,
        invite: {
            id: row.invite_id,
            email: row.email || '',
            role: row.role || '',
            status: row.invite_status || '',
            expiresAt: row.expires_at,
        },
        audit: {
            actionType: row.status === 'denied'
                ? 'support.organization.access_recovery.deny'
                : 'support.organization.access_recovery.approve',
            source: 'admin',
            service: 'hanasand-api',
            outcome: row.outcome,
            eventIds: auditEvents.map(event => event.id),
            query: `/api/admin/audit-events?request=${encodeURIComponent(row.request_id)}&source=admin&service=hanasand-api`,
        },
        copyText: [
            `Access recovery ${displayStatus} for ${row.email || row.invite_id}`,
            `Org: ${row.organization_name || row.organization_id} (${row.organization_id})`,
            `Invite: ${row.invite_id} (${row.invite_status || 'unknown'})`,
            `Request: ${row.request_id}`,
            `Requested by: ${row.requested_by}`,
            auditEvents.length ? `Audit events: ${auditEvents.map(event => `${event.id}:${event.actionType}/${event.outcome}`).join(', ')}` : '',
            row.approved_by ? `Approved by: ${row.approved_by} at ${row.approved_at}` : '',
            row.denied_by ? `Denied by: ${row.denied_by} at ${row.denied_at}` : '',
            row.decision_reason ? `Decision reason: ${row.decision_reason}` : '',
        ].filter(Boolean).join('\n'),
    }
}

function normalizeAuditEventList(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const event = item as Record<string, unknown>
        const id = Number(event.id)
        return [{
            id: Number.isFinite(id) ? id : 0,
            actionType: text(event.actionType),
            outcome: text(event.outcome),
            severity: text(event.severity),
            createdAt: text(event.createdAt),
        }]
    })
}

function accessRecoveryApprovalMetadata(input: {
    actorId: string
    role: string
    expiresAt: unknown
    requestId: string
    outcome: 'success' | 'failure'
    context: string
    existingMembership: unknown
    requestedApprovalRequired: unknown
}) {
    const existingRole = typeof input.existingMembership === 'object' && input.existingMembership
        ? String((input.existingMembership as { role?: unknown }).role || '')
        : ''
    const approvalRequired = Boolean(input.requestedApprovalRequired)
        || input.role === 'admin'
        || existingRole === 'owner'
        || existingRole === 'admin'

    return {
        schemaVersion: 'support.access_recovery.approval.v1',
        requestedBy: input.actorId,
        approvalRequired,
        status: approvalRequired ? 'pending_approval' : 'not_required',
        approvedBy: null as string | null,
        approvedAt: null as string | null,
        expiresAt: input.expiresAt,
        requestId: input.requestId,
        outcome: input.outcome,
        context: input.context,
        enforcement: approvalRequired ? 'invite_revoked_until_approved' : 'invite_pending_immediately',
        reason: approvalRequired
            ? 'Admin-role recovery or elevated existing membership requires second review before use.'
            : 'Member recovery does not require second review by default.',
    }
}

function cleanContext(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 1000) : ''
}

function supportRequestId(req: FastifyRequest) {
    const header = req.headers['x-request-id']
    if (Array.isArray(header)) return header[0] || req.id
    return header || req.id
}

function text(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function normalizeOption(value: unknown, allowed: string[]) {
    const normalized = text(value).toLowerCase()
    return allowed.includes(normalized) ? normalized : ''
}

function normalizeApprovalStatus(value: unknown) {
    const normalized = text(value).toLowerCase()
    if (normalized === 'pending_approval') return 'pending'
    return ['pending', 'approved', 'denied', 'not_required'].includes(normalized) ? normalized : ''
}
