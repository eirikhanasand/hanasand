import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { actorHasAdminSupportAccess, recordAdminAuditEvent, redactAuditValue, requireAuditReason, supportTimelineAuditBridgeEvent } from '#utils/adminAudit.ts'
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
    orgId?: string
    organizationId?: string
    actor?: string
    actorId?: string
    supportActor?: string
    supportActorId?: string
    target?: string
    targetId?: string
    user?: string
    userId?: string
    targetUserId?: string
    action?: string
    actionType?: string
    severity?: string
    source?: string
    service?: string
    entity?: string
    entityId?: string
    entityType?: string
    request?: string
    requestId?: string
    correlation?: string
    correlationId?: string
    idempotency?: string
    idempotencyKey?: string
    idempotency_key?: string
    session?: string
    supportSession?: string
    supportSessionId?: string
    workflow?: string
    bridgeWorkflow?: string
    blocker?: string
    blockerCode?: string
    reason?: string
    supportReason?: string
    context?: string
    supportContext?: string
    outcome?: string
    from?: string
    to?: string
    limit?: string
}

type AuditEventParams = {
    id: string
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
    q?: string
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
    session?: string
    supportSession?: string
    supportSessionId?: string
    action?: string
    severity?: string
    outcome?: string
    source?: string
    service?: string
    blocker?: string
    blockerCode?: string
    prepareAction?: string
    reason?: string
    supportReason?: string
    context?: string
    supportContext?: string
    scope?: string
    idempotencyKey?: string
    idempotency_key?: string
    durationMinutes?: string
    duration_minutes?: string
    expiresAt?: string
    expires_at?: string
    from?: string
    to?: string
    limit?: string
}

type SupportInviteBody = InviteInput & {
    reason?: unknown
    context?: unknown
    scope?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    idempotencyKey?: unknown
    idempotency_key?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
}

type SupportInviteActionParams = OrganizationParams & {
    inviteId: string
}

type SupportInviteActionBody = {
    action?: unknown
    reason?: unknown
    context?: unknown
    requestId?: unknown
    request_id?: unknown
    scope?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    idempotencyKey?: unknown
    idempotency_key?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
    expiresAt?: unknown
    expires_at?: unknown
}

type SupportMemberRoleRecoveryBody = {
    role?: unknown
    reason?: unknown
    context?: unknown
    requestId?: unknown
    request_id?: unknown
    scope?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    idempotencyKey?: unknown
    idempotency_key?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
}

type SupportAccessRecoveryBody = InviteInput & {
    targetUserId?: unknown
    reason?: unknown
    context?: unknown
    caseId?: unknown
    approvalRequired?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    requestId?: unknown
    request_id?: unknown
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
    supportSessionId?: unknown
    support_session_id?: unknown
}

type SupportSessionParams = {
    sessionId: string
}

type SupportSessionBody = {
    reason?: unknown
    context?: unknown
    org?: unknown
    orgId?: unknown
    organizationId?: unknown
    user?: unknown
    userId?: unknown
    targetUserId?: unknown
    actions?: unknown
    allowedActions?: unknown
    scope?: unknown
    durationMinutes?: unknown
    duration_minutes?: unknown
    expiresAt?: unknown
    expires_at?: unknown
    requestId?: unknown
    request_id?: unknown
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

type SupportTimelineFilter = {
    q?: string
    org: string
    user: string
    email: string
    request: string
    entity: string
    entityType: string
    supportSession: string
    action: string
    severity: string
    outcome: string
    source: string
    service: string
    blocker: string
    reason: string
    context: string
    from: string
    to: string
    limit: number
    unsupported: string[]
}

type SupportActionPreparationInput = {
    action: 'invite_assist' | 'access_recovery' | 'impersonation'
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    idempotencyKey: string
    durationMinutes: number | null
    expiresAt: string | null
}

const supportInspectionFilters = new Set([
    'q',
    'org',
    'orgId',
    'user',
    'userId',
    'email',
    'request',
    'requestId',
    'entity',
    'entityId',
    'entityType',
    'session',
    'supportSession',
    'supportSessionId',
    'action',
    'severity',
    'outcome',
    'source',
    'service',
    'blocker',
    'blockerCode',
    'prepareAction',
    'reason',
    'supportReason',
    'context',
    'supportContext',
    'scope',
    'idempotencyKey',
    'idempotency_key',
    'durationMinutes',
    'duration_minutes',
    'expiresAt',
    'expires_at',
    'from',
    'to',
    'limit',
])

const adminAuditFilters = new Set([
    'q',
    'org',
    'orgId',
    'organizationId',
    'actor',
    'actorId',
    'supportActor',
    'supportActorId',
    'target',
    'targetId',
    'user',
    'userId',
    'targetUserId',
    'action',
    'actionType',
    'severity',
    'source',
    'service',
    'entity',
    'entityId',
    'entityType',
    'request',
    'requestId',
    'correlation',
    'correlationId',
    'idempotency',
    'idempotencyKey',
    'idempotency_key',
    'session',
    'supportSession',
    'supportSessionId',
    'workflow',
    'bridgeWorkflow',
    'blocker',
    'blockerCode',
    'reason',
    'supportReason',
    'context',
    'supportContext',
    'outcome',
    'from',
    'to',
    'limit',
])

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
    const org = text(query.org || query.orgId || query.organizationId)
    const actorFilter = text(query.actor || query.actorId || query.supportActor || query.supportActorId)
    const target = text(query.target || query.targetId || query.user || query.userId || query.targetUserId)
    const action = text(query.action || query.actionType)
    const severity = normalizeOption(query.severity, ['info', 'notice', 'warning', 'critical'])
    const source = text(query.source)
    const service = text(query.service)
    const entity = text(query.entity || query.entityId)
    const entityType = text(query.entityType)
    const request = text(query.request || query.requestId)
    const correlation = text(query.correlation || query.correlationId)
    const idempotency = text(query.idempotency || query.idempotencyKey || query.idempotency_key)
    const supportSession = text(query.session || query.supportSession || query.supportSessionId)
    const workflow = text(query.workflow || query.bridgeWorkflow)
    const blocker = text(query.blocker || query.blockerCode)
    const reason = text(query.reason || query.supportReason)
    const contextFilter = text(query.context || query.supportContext)
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 200)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500) : 200
    const filterError = adminAuditFilterError(query, { severity, outcome, from, to, limit })
    if (filterError) {
        return res.status(400).send(filterError)
    }

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
    if (entityType) where.push(`e.target_type ILIKE ${add(`%${entityType}%`)}`)
    if (request) where.push(`e.request_id ILIKE ${add(`%${request}%`)}`)
    if (correlation) {
        const placeholder = add(`%${correlation}%`)
        where.push('(e.request_id ILIKE ' + placeholder + ' OR e.context->>\'correlationId\' ILIKE ' + placeholder + ')')
    }
    if (idempotency) where.push(`e.context->>'idempotencyKey' ILIKE ${add(`%${idempotency}%`)}`)
    if (supportSession) {
        const placeholder = add(`%${supportSession}%`)
        where.push('(e.entity_id ILIKE ' + placeholder + ' OR e.context->>\'supportSessionId\' ILIKE ' + placeholder + ')')
    }
    if (workflow) where.push(`e.context->>'workflow' ILIKE ${add(`%${workflow}%`)}`)
    if (blocker) {
        const placeholder = add(`%${blocker}%`)
        where.push('(e.context->>\'blockerCode\' ILIKE ' + placeholder + ' OR e.context->>\'blocker\' ILIKE ' + placeholder + ')')
    }
    if (reason) where.push(`e.reason ILIKE ${add(`%${reason}%`)}`)
    if (contextFilter) where.push(`e.context::text ILIKE ${add(`%${contextFilter}%`)}`)
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
    const timeline = events.map(event => event.detail.timelineEvent)
    const filters = { q, org, actor: actorFilter, target, action, severity, source, service, entity, entityType, request, correlation, idempotency, supportSession, workflow, blocker, reason, context: contextFilter, outcome, from, to, limit }
    return res.send({
        events,
        filters,
        detail: {
            schemaVersion: 'admin.audit.timeline.v1',
            generatedAt: new Date().toISOString(),
            filters,
            summary: auditTimelineSummary(timeline),
            filterContract: supportAuditFilterContract(filters, timeline),
            exportProof: supportAuditExportProof(filters, timeline),
            compliancePacket: supportAuditCompliancePacket(filters, timeline),
            bridgeAdapter: supportAuditBridgeAdapterContract(filters),
            timelineReplayContract: supportAuditTimelineReplayContract(filters, timeline),
            supportWorkflowPacket: supportAuditSupportWorkflowPacket(filters, timeline),
            workflowRollup: supportAuditWorkflowRollup(filters, timeline),
            actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
            decisionPackets: events.slice(0, 50).map(event => supportAuditEventDecisionPacket({
                detail: event.detail || {},
                timelineEvent: event.detail?.timelineEvent || {},
                relatedTimeline: timeline,
                filters,
            })),
            timeline,
            copyText: events.slice(0, 20).map(event => event.detail.copyText).join('\n'),
        },
    })
}

export async function getAdminAuditEvent(req: FastifyRequest<{ Params: AuditEventParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id < 1 || id !== Math.trunc(id)) {
        return res.status(400).send(supportError('invalid_audit_event_id', 'Audit event id must be a positive integer.', {
            field: 'id',
        }))
    }

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
        WHERE e.id = $1
        LIMIT 1
    `, [id])
    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) {
        return res.status(404).send(supportError('audit_event_not_found', 'Audit event not found.', {
            id,
        }))
    }

    const event = toAdminAuditEvent(row)
    const relatedTimeline = await loadAdminAuditEventRelatedTimeline(event)
    await recordAdminAuditEvent(req, {
        actionType: 'support.audit_event.inspect',
        actorId: actor.id,
        targetType: 'admin_audit_event',
        targetId: String(event.id),
        organizationId: event.detail?.organizationId || null,
        entityId: event.detail?.entityId || String(event.id),
        requestId: supportRequestId(req),
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.audit_event.inspect.v1',
            inspectedEventId: Number(event.id),
            inspectedActionType: event.detail?.actionType || null,
            inspectedOutcome: event.detail?.outcome || null,
            inspectedRequestId: event.detail?.requestId || null,
            inspectedEntityId: event.detail?.entityId || null,
            relatedEventIds: relatedTimeline.map(item => item.id),
            redactionRequired: true,
        },
    })
    return res.send({
        event,
        detail: supportAuditEventDetailResponse(event, relatedTimeline),
    })
}

export async function postSupportSession(req: FastifyRequest<{ Body: SupportSessionBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, 'Support session reason')
    } catch (error) {
        return res.status(400).send(supportError('missing_support_reason', error instanceof Error ? error.message : 'Support session reason is required.'))
    }

    const organizationId = text(req.body?.organizationId || req.body?.orgId || req.body?.org)
    const targetUserId = text(req.body?.targetUserId || req.body?.userId || req.body?.user)
    if (!organizationId && !targetUserId) {
        return res.status(400).send(supportError('missing_support_target', 'Support session requires a target organization or user.'))
    }

    const actions = normalizeSupportSessionActions(req.body?.allowedActions || req.body?.actions)
    const scope = normalizeSupportSessionScope(req.body?.scope)
    const duration = normalizeSupportSessionDuration(req.body?.durationMinutes ?? req.body?.duration_minutes)
    const expiry = normalizeSupportSessionExpiry(req.body?.expiresAt ?? req.body?.expires_at, duration.value)
    if (actions.error) return res.status(400).send(actions.error)
    if (scope.error) return res.status(400).send(scope.error)
    if (duration.error) return res.status(400).send(duration.error)
    if (expiry.error) return res.status(400).send(expiry.error)

    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    const supportSessionId = `support_session_${randomUUID()}`
    const context = {
        schemaVersion: 'support.scoped_session.v1',
        supportSessionId,
        requestId,
        targetOrganizationId: organizationId || null,
        targetUserId: targetUserId || null,
        allowedActions: actions.value,
        scope: scope.value,
        durationMinutes: duration.value,
        expiresAt: expiry.value,
        status: 'active',
        revokedAt: null,
        revokedBy: null,
        supportContext: cleanContext(req.body?.context),
        immutableAudit: true,
        redactionRequired: true,
    }
    await recordAdminAuditEvent(req, {
        actionType: 'support.session.create',
        actorId: actor.id,
        targetType: targetUserId ? 'user' : 'organization',
        targetId: targetUserId || organizationId,
        organizationId: organizationId || null,
        entityId: supportSessionId,
        requestId,
        severity: 'notice',
        outcome: 'success',
        reason,
        context,
    })
    const auditEventIds = await loadAdminAuditEventIds({ requestId, actionType: 'support.session.create', entityId: supportSessionId })

    return res.status(201).send({
        supportSession: supportSessionResponse({
            supportSessionId,
            actorId: actor.id,
            reason,
            requestId,
            organizationId,
            targetUserId,
            allowedActions: actions.value,
            scope: scope.value,
            durationMinutes: duration.value,
            expiresAt: expiry.value,
            status: 'active',
            auditEventIds,
        }),
    })
}

export async function getSupportSession(req: FastifyRequest<{ Params: SupportSessionParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const supportSessionId = text(req.params.sessionId)
    const requestId = supportRequestId(req)
    const state = await loadSupportSessionState(supportSessionId)
    if (!state) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.session.inspect',
            actorId: actor.id,
            targetType: 'support_session',
            targetId: supportSessionId,
            entityId: supportSessionId,
            requestId,
            severity: 'notice',
            outcome: 'failed',
            context: {
                schemaVersion: 'support.scoped_session.detail.v1',
                supportSessionId,
                blockerCode: 'support_session_not_found',
                redactionRequired: true,
            },
        })
        return res.status(404).send(supportError('support_session_not_found', 'Support session not found.', { supportSessionId }))
    }

    await recordAdminAuditEvent(req, {
        actionType: 'support.session.inspect',
        actorId: actor.id,
        targetType: state.targetUserId ? 'user' : 'support_session',
        targetId: state.targetUserId || supportSessionId,
        organizationId: state.organizationId || null,
        entityId: supportSessionId,
        requestId,
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.scoped_session.detail.v1',
            supportSessionId,
            status: state.status,
            targetOrganizationId: state.organizationId || null,
            targetUserId: state.targetUserId || null,
            allowedActions: state.allowedActions,
            scope: state.scope,
            expiresAt: state.expiresAt,
            redactionRequired: true,
        },
    })

    const timeline = await loadSupportSessionTimeline(supportSessionId)
    const response = supportSessionResponse({
        ...state,
        actorId: state.actorId,
        reason: state.reason,
        requestId: state.requestId,
        auditEventIds: state.auditEventIds,
    })
    const workflowRoutes = supportSessionWorkflowRoutes(state)
    const authorization = supportSessionAuthorizationProof({
        actorId: actor.id,
        state,
        supportSessionId,
        workflowRoutes,
    })
    const timelineFilters = {
        supportSession: supportSessionId,
        entity: supportSessionId,
        request: state.requestId,
        action: 'support.session',
        source: 'admin',
        service: 'hanasand-api',
    }
    const auditTimeline = {
        schemaVersion: 'support.scoped_session.audit_timeline.v1',
        filters: timelineFilters,
        eventIds: timeline.map(event => event.id),
        summary: auditTimelineSummary(timeline),
        filterContract: supportAuditFilterContract(timelineFilters, timeline),
        exportProof: supportAuditExportProof(timelineFilters, timeline),
        redacted: true,
        links: {
            timeline: auditFilterQuery(timelineFilters),
            details: timeline.map(event => event.links?.detail).filter(Boolean),
        },
    }
    return res.send({
        supportSession: response,
        detail: {
            schemaVersion: 'support.scoped_session.detail.v1',
            generatedAt: new Date().toISOString(),
            supportSession: response,
            authorization,
            timeline,
            auditTimeline,
            readinessProof: {
                schemaVersion: 'support.scoped_session.readiness_proof.v1',
                route: '/api/admin/support/sessions/:sessionId',
                auditRoute: auditTimeline.links.timeline,
                revokeRoute: `/api/admin/support/sessions/${encodeURIComponent(supportSessionId)}/revoke`,
                availableActions: state.allowedActions,
                scope: state.scope,
                blockers: state.status === 'active' ? [] : [state.status === 'revoked' ? 'support_session_revoked' : 'support_session_expired'],
                authorization,
                workflowRoutes,
                auditFields: ['actorId', 'targetId', 'organizationId', 'entityId', 'requestId', 'actionType', 'severity', 'outcome', 'createdAt'],
                testCommand: 'cd api && bun run smoke:admin-support-unit',
            },
            copyText: [
                `Support session ${state.status}: ${supportSessionId}`,
                `Actor: ${state.actorId}`,
                `Org: ${state.organizationId || '*'}`,
                `User: ${state.targetUserId || '*'}`,
                `Actions: ${state.allowedActions.join(', ') || 'none'}`,
                `Scope: ${state.scope.join(', ') || 'none'}`,
                `Expires: ${state.expiresAt}`,
                `Audit events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
                `Timeline: ${auditTimeline.links.timeline}`,
            ].join('\n'),
        },
    })
}

export async function postSupportSessionRevoke(req: FastifyRequest<{ Params: SupportSessionParams, Body: SupportSessionBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, 'Support session revoke reason')
    } catch (error) {
        return res.status(400).send(supportError('missing_support_reason', error instanceof Error ? error.message : 'Support session revoke reason is required.'))
    }

    const supportSessionId = text(req.params.sessionId)
    const state = await loadSupportSessionState(supportSessionId)
    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    if (!state) {
        await recordSupportSessionRevokeAudit(req, {
            actorId: actor.id,
            supportSessionId,
            requestId,
            reason,
            outcome: 'failed',
            blocker: 'support_session_not_found',
        })
        return res.status(404).send(supportError('support_session_not_found', 'Support session not found.', { supportSessionId }))
    }
    if (state.revokedAt) {
        await recordSupportSessionRevokeAudit(req, {
            actorId: actor.id,
            supportSessionId,
            requestId,
            reason,
            organizationId: state.organizationId,
            targetUserId: state.targetUserId,
            outcome: 'failed',
            blocker: 'support_session_revoked',
        })
        return res.status(409).send(supportError('support_session_revoked', 'Support session is already revoked.', {
            supportSession: supportSessionResponse({ ...state, actorId: state.actorId, reason: state.reason, requestId: state.requestId, auditEventIds: state.auditEventIds, status: 'revoked' }),
        }))
    }
    if (Date.parse(state.expiresAt) <= Date.now()) {
        await recordSupportSessionRevokeAudit(req, {
            actorId: actor.id,
            supportSessionId,
            requestId,
            reason,
            organizationId: state.organizationId,
            targetUserId: state.targetUserId,
            outcome: 'denied',
            blocker: 'support_session_expired',
        })
        return res.status(409).send(supportError('support_session_expired', 'Support session has expired; create a new scoped session.', {
            supportSession: supportSessionResponse({ ...state, actorId: state.actorId, reason: state.reason, requestId: state.requestId, auditEventIds: state.auditEventIds, status: 'expired' }),
        }))
    }

    await recordSupportSessionRevokeAudit(req, {
        actorId: actor.id,
        supportSessionId,
        requestId,
        reason,
        organizationId: state.organizationId,
        targetUserId: state.targetUserId,
        outcome: 'success',
        blocker: null,
    })
    const auditEventIds = await loadAdminAuditEventIds({ requestId, actionType: 'support.session.revoke', entityId: supportSessionId })
    return res.send({
        supportSession: supportSessionResponse({
            ...state,
            actorId: state.actorId,
            reason: state.reason,
            requestId,
            status: 'revoked',
            revokedBy: actor.id,
            revokedAt: new Date().toISOString(),
            auditEventIds,
        }),
    })
}

export async function getSupportOrganization(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const inspectionAudit = supportInspectionAuditMetadata(req)
    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.organization.inspect',
            actorId: actor.id,
            targetType: 'organization',
            targetId: req.params.id,
            organizationId: req.params.id,
            entityId: req.params.id,
            requestId: inspectionAudit.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason: inspectionAudit.reason || undefined,
            context: supportInspectionAuditContext(inspectionAudit, { error: 'organization_not_found' }),
        })
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const [members, invites, watchlists, audit, availability] = await Promise.all([
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
        loadOrganizationAvailability([organization.id]),
    ])

    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.inspect',
        actorId: actor.id,
        targetType: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        entityId: organization.id,
        requestId: inspectionAudit.requestId,
        severity: 'info',
        outcome: 'success',
        reason: inspectionAudit.reason || undefined,
        context: supportInspectionAuditContext(inspectionAudit, {
            memberCount: members.rows.length,
            pendingInviteCount: invites.rows.filter((invite: { status: string }) => invite.status === 'pending').length,
            watchlistItemCount: watchlists.rows.length,
        }),
    })

    const watchlistItems = watchlists.rows as OrganizationWatchlistRow[]
    const alertReferences = watchlistItems.map(item => buildOrganizationDwmAlertReference(organization, item))
    const recentAuditTimeline = supportRecentAuditTimeline({
        org: organization.id,
        target: organization.id,
        entity: organization.id,
        request: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        action: 'support.organization',
    }, audit.rows as Record<string, unknown>[])
    const supportActivityRollup = supportOrganizationActivityRollup({
        organizationId: organization.id,
        requestId: inspectionAudit.requestId,
        timeline: recentAuditTimeline.events,
    })
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const organizationTimelineFilter = supportTimelineFilter({
        q: '',
        org: organization.id,
        user: '',
        email: '',
        request: inspectionAudit.requestId,
        entity: organization.id,
        entityType: 'organization',
        supportSession: '',
        action: 'support.organization',
        severity: '',
        outcome: '',
        source: 'admin',
        service: 'hanasand-api',
        blocker: '',
        reason: inspectionAudit.reason,
        context: inspectionAudit.supportContext,
        from: '',
        to: '',
        limit: 25,
    })
    const organizationRecoveryEligibility = buildRecoveryEligibility({
        email: '',
        user: '',
        organizationIds: [organization.id],
        memberships: members.rows as Record<string, unknown>[],
        users: members.rows as Record<string, unknown>[],
        availabilityByOrg,
        invites: invites.rows as Record<string, unknown>[],
    })
    const organizationAccessStatus = buildSupportAccessStatus({
        org: organization.id,
        user: '',
        email: '',
        request: inspectionAudit.requestId,
        organizationIds: [organization.id],
        users: members.rows as Record<string, unknown>[],
        memberships: members.rows as Record<string, unknown>[],
        invites: invites.rows as Record<string, unknown>[],
        approvalDetails: [],
        recoveryEligibility: organizationRecoveryEligibility,
        availabilityByOrg,
        timeline: recentAuditTimeline.events,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: organization.id,
        user: '',
        email: '',
        request: inspectionAudit.requestId,
        organizationIds: [organization.id],
        memberships: members.rows as Record<string, unknown>[],
        invites: invites.rows as Record<string, unknown>[],
        approvalDetails: [],
        recoveryEligibility: organizationRecoveryEligibility,
        availabilityByOrg,
        timeline: recentAuditTimeline.events,
        timelineFilter: organizationTimelineFilter,
    })
    const authorization = buildSupportInspectionAuthorization({
        actorId: actor.id,
        requestedOrg: req.params.id,
        requestedUser: '',
        effectiveOrg: organization.id,
        effectiveUser: '',
        email: '',
        request: inspectionAudit.requestId,
        entity: organization.id,
        supportSession: '',
        sessionState: null,
        organizationIds: [organization.id],
    })
    const alertReadinessBridge = supportTimelineAuditBridgeEvent({
        workflow: 'watchlist',
        action: 'support.organization.alert_readiness.inspect',
        actorId: actor.id,
        targetType: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        entityId: organization.id,
        requestId: inspectionAudit.requestId,
        severity: 'info',
        outcome: 'success',
        reason: inspectionAudit.reason || 'Support inspected organization alert readiness.',
        source: 'support',
        service: 'hanasand-api',
        context: {
            watchlistItemCount: watchlistItems.length,
            generatedAlertReferenceCount: alertReferences.length,
            supportContext: inspectionAudit.supportContext || null,
        },
        after: {
            generatedAlertReferenceCount: alertReferences.length,
        },
    })
    return res.send({
        organization: toOrganization(organization),
        authorization,
        accessStatus: organizationAccessStatus,
        accessRecoveryPlan,
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
            supportTimelineBridge: {
                schemaVersion: 'support.organization.alert_readiness.audit_bridge.v1',
                event: alertReadinessBridge,
                auditFields: ['actionType', 'actorId', 'targetType', 'targetId', 'organizationId', 'entityId', 'requestId', 'severity', 'outcome', 'reason', 'source', 'service', 'context'],
                testCommand: 'cd api && bun run smoke:admin-support-unit',
            },
        },
        supportLinks: {
            inspectUser: '/api/admin/support/users/:id',
            inviteAssist: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/invites`,
            accessRecovery: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/access-recovery`,
            audit: `/api/admin/audit-events?org=${encodeURIComponent(organization.id)}`,
        },
        supportActivityRollup,
        recentAuditEvents: recentAuditTimeline.events,
        recentAuditTimeline,
        copyText: [
            `Support organization inspection ${organization.id}`,
            `Authorization: ${authorization.supportSessionScoped ? 'scoped support session' : 'support role'}`,
            `Access status: ${organizationAccessStatus.overall}`,
            `Members: ${members.rows.length}`,
            `Pending invites: ${(invites.rows as OrganizationInviteRow[]).filter(row => row.status === 'pending').length}`,
            `Audit events: ${recentAuditTimeline.eventIds.join(', ') || 'none'}`,
        ].join('\n'),
    })
}

export async function getSupportUser(req: FastifyRequest<{ Params: UserParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const inspectionAudit = supportInspectionAuditMetadata(req)
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
            entityId: req.params.id,
            requestId: inspectionAudit.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason: inspectionAudit.reason || undefined,
            context: supportInspectionAuditContext(inspectionAudit, { error: 'user_not_found' }),
        })
        return res.status(404).send({ error: 'User not found.' })
    }

    const [memberships, invites, audit, approvals] = await Promise.all([
        run(`
            SELECT
                om.user_id,
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
        loadInspectionApprovals({ org: '', user: req.params.id, email: '', request: inspectionAudit.requestId, outcome: '', limit: 25 }),
    ])

    await recordAdminAuditEvent(req, {
        actionType: 'support.user.inspect',
        actorId: actor.id,
        targetType: 'user',
        targetId: req.params.id,
        entityId: req.params.id,
        requestId: inspectionAudit.requestId,
        severity: 'info',
        outcome: 'success',
        reason: inspectionAudit.reason || undefined,
        context: supportInspectionAuditContext(inspectionAudit, {
            active: userRow.active,
            membershipCount: memberships.rows.length,
            pendingInviteCount: invites.rows.length,
            deletionScheduled: Boolean(userRow.deletion_scheduled_at),
        }),
    })

    const recentAuditTimeline = supportRecentAuditTimeline({
        target: req.params.id,
        entity: req.params.id,
        request: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        action: 'support.user',
    }, audit.rows as Record<string, unknown>[])
    const approvalDetails = (approvals as AccessRecoveryApprovalRow[]).map(toAccessRecoveryDecision)
    const organizationIds = Array.from(new Set([
        ...memberships.rows.map(row => String((row as Record<string, unknown>).organization_id || '')).filter(Boolean),
        ...invites.rows.map(row => String((row as Record<string, unknown>).organization_id || '')).filter(Boolean),
        ...approvalDetails.map(item => String(item.organizationId || '')).filter(Boolean),
    ]))
    const supportActivityRollup = supportUserActivityRollup({
        userId: req.params.id,
        requestId: inspectionAudit.requestId,
        organizationIds,
        timeline: recentAuditTimeline.events,
    })
    const availability = organizationIds.length ? await loadOrganizationAvailability(organizationIds) : []
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const userTimelineFilter = supportTimelineFilter({
        q: '',
        org: '',
        user: req.params.id,
        email: '',
        request: inspectionAudit.requestId,
        entity: req.params.id,
        entityType: 'user',
        supportSession: '',
        action: 'support.user',
        severity: '',
        outcome: '',
        source: 'admin',
        service: 'hanasand-api',
        blocker: '',
        reason: inspectionAudit.reason,
        context: inspectionAudit.supportContext,
        from: '',
        to: '',
        limit: 25,
    })
    const userRecoveryEligibility = buildRecoveryEligibility({
        email: '',
        user: req.params.id,
        organizationIds,
        memberships: memberships.rows as Record<string, unknown>[],
        users: [userRow],
        availabilityByOrg,
        invites: invites.rows as Record<string, unknown>[],
    })
    const userAccessStatus = buildSupportAccessStatus({
        org: '',
        user: req.params.id,
        email: '',
        request: inspectionAudit.requestId,
        organizationIds,
        users: [userRow],
        memberships: memberships.rows as Record<string, unknown>[],
        invites: invites.rows as Record<string, unknown>[],
        approvalDetails,
        recoveryEligibility: userRecoveryEligibility,
        availabilityByOrg,
        timeline: recentAuditTimeline.events,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: '',
        user: req.params.id,
        email: '',
        request: inspectionAudit.requestId,
        organizationIds,
        memberships: memberships.rows as Record<string, unknown>[],
        invites: invites.rows as Record<string, unknown>[],
        approvalDetails,
        recoveryEligibility: userRecoveryEligibility,
        availabilityByOrg,
        timeline: recentAuditTimeline.events,
        timelineFilter: userTimelineFilter,
    })
    const authorization = buildSupportInspectionAuthorization({
        actorId: actor.id,
        requestedOrg: '',
        requestedUser: req.params.id,
        effectiveOrg: '',
        effectiveUser: req.params.id,
        email: '',
        request: inspectionAudit.requestId,
        entity: req.params.id,
        supportSession: '',
        sessionState: null,
        organizationIds,
    })
    return res.send({
        user: toSupportUser(userRow),
        authorization,
        accessStatus: userAccessStatus,
        accessRecoveryPlan,
        memberships: memberships.rows.map(toSupportMembership),
        pendingInvites: invites.rows.map(toSupportInvite),
        approvalRequests: approvalDetails,
        supportActivityRollup,
        recentAuditEvents: recentAuditTimeline.events,
        recentAuditTimeline,
        copyText: [
            `Support user inspection ${req.params.id}`,
            `Authorization: ${authorization.supportSessionScoped ? 'scoped support session' : 'support role'}`,
            `Access status: ${userAccessStatus.overall}`,
            `Memberships: ${memberships.rows.length}`,
            `Pending invites: ${invites.rows.length}`,
            `Audit events: ${recentAuditTimeline.eventIds.join(', ') || 'none'}`,
        ].join('\n'),
    })
}

export async function getSupportInspection(req: FastifyRequest<{ Querystring: SupportInspectionQuery }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as SupportInspectionQuery
    const q = text(query.q)
    const requestedOrg = text(query.org || query.orgId)
    const requestedUser = text(query.user || query.userId)
    const email = text(query.email).toLowerCase()
    const requestedRequest = text(query.request || query.requestId)
    const requestedEntity = text(query.entity || query.entityId)
    const entityType = text(query.entityType)
    const supportSession = text(query.session || query.supportSession || query.supportSessionId)
    const action = text(query.action)
    const source = text(query.source)
    const service = text(query.service)
    const blocker = text(query.blocker || query.blockerCode)
    const reason = text(query.reason || query.supportReason)
    const contextFilter = text(query.context || query.supportContext)
    const prepareAction = normalizeOption(query.prepareAction, ['invite_assist', 'access_recovery', 'impersonation'])
    const severity = normalizeOption(query.severity, ['info', 'notice', 'warning', 'critical'])
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 50)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100) : 50
    const sessionState = supportSession ? await loadSupportSessionState(supportSession) : null
    const inspectionRequestId = supportRequestId(req)
    if (supportSession && !sessionState) {
        return res.status(404).send(supportError('support_session_not_found', 'Support session not found.', { supportSessionId: supportSession }))
    }
    if (sessionState) {
        const orgMismatch = Boolean(requestedOrg && sessionState.organizationId && requestedOrg !== sessionState.organizationId)
        const userMismatch = Boolean(requestedUser && sessionState.targetUserId && requestedUser !== sessionState.targetUserId)
        if (orgMismatch || userMismatch) {
            const blocker = orgMismatch ? 'support_session_org_mismatch' : 'support_session_user_mismatch'
            await recordAdminAuditEvent(req, {
                actionType: 'support.inspect',
                actorId: actor.id,
                targetType: 'support_session',
                targetId: supportSession,
                organizationId: sessionState.organizationId || requestedOrg || null,
                entityId: supportSession,
                requestId: inspectionRequestId,
                severity: 'warning',
                outcome: 'denied',
                reason: sessionState.reason || undefined,
                context: {
                    schemaVersion: 'support.inspection.session_scope_guard.v1',
                    supportSessionId: supportSession,
                    requestedOrg: requestedOrg || null,
                    requestedUser: requestedUser || null,
                    scopedOrg: sessionState.organizationId || null,
                    scopedUser: sessionState.targetUserId || null,
                    blockerCode: blocker,
                    noCrossOrgLeakage: true,
                    redactionRequired: true,
                },
            })
            return res.status(403).send(supportError(blocker, 'Support session scope does not allow this inspection target.', {
                supportSessionId: supportSession,
                requestedOrg: requestedOrg || null,
                requestedUser: requestedUser || null,
                scopedOrg: sessionState.organizationId || null,
                scopedUser: sessionState.targetUserId || null,
                noCrossOrgLeakage: true,
            }))
        }
    }
    const org = sessionState?.organizationId || requestedOrg || ''
    const user = sessionState?.targetUserId || requestedUser || ''
    const request = requestedRequest || sessionState?.requestId || ''
    const entity = requestedEntity || supportSession
    const filterError = supportInspectionFilterError(query, { q, org, user, email, request, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit })
    if (filterError) {
        return res.status(400).send(filterError)
    }
    const preparationInput = supportActionPreparationInput(query, prepareAction)
    if (preparationInput.error) {
        return res.status(400).send(preparationInput.error)
    }

    if (!q && !org && !user && !email && !request && !entity && !entityType && !supportSession && !action && !blocker && !reason && !contextFilter) {
        return res.status(400).send(supportError('missing_support_target', 'Add q, org, user, email, request, entity, entityType, supportSession, action, blocker, reason, or context to inspect support state.'))
    }

    const [organizations, users, memberships, invites, approvals, audit] = await Promise.all([
        loadInspectionOrganizations({ q, org, user, email, request, limit }),
        loadInspectionUsers({ q, user, request, limit }),
        loadInspectionMemberships({ q, org, user, request, limit }),
        loadInspectionInvites({ q, org, email, request, limit }),
        loadInspectionApprovals({ q, org, user, email, request, outcome, limit }),
        loadInspectionAuditEvents({ q, org, user, email, request, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit }),
    ])
    const timelineFilter = supportTimelineFilter({ q, org, user, email, request, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit })
    const auditTimelineFilters = {
        q,
        org,
        target: user || email,
        request,
        entity,
        entityType,
        supportSession,
        action,
        severity,
        outcome,
        source,
        service,
        blocker,
        reason,
        context: contextFilter,
        from,
        to,
        limit,
    }
    if (!organizations.length && !users.length && !memberships.length && !invites.length && !approvals.length && !audit.length) {
        return res.status(404).send(supportError('support_target_not_found', 'No support state matched the requested filters.', {
            filters: timelineFilter,
            unavailableFilters: [],
        }))
    }

    const organizationIds = Array.from(new Set([
        ...organizations.map(row => String(row.id)),
        ...memberships.map(row => String(row.organization_id)),
        ...invites.map(row => String(row.organization_id)),
        ...approvals.map(row => String(row.organization_id)),
        ...audit.map(row => String((row as Record<string, unknown>).organization_id || '')).filter(Boolean),
    ]))
    const authorization = buildSupportInspectionAuthorization({
        actorId: actor.id,
        requestedOrg,
        requestedUser,
        effectiveOrg: org,
        effectiveUser: user,
        email,
        request,
        entity,
        supportSession,
        sessionState,
        organizationIds,
    })
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
    const accessStatus = buildSupportAccessStatus({
        org,
        user,
        email,
        request,
        organizationIds,
        users,
        memberships,
        invites,
        approvalDetails,
        recoveryEligibility,
        availabilityByOrg,
        timeline,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org,
        user,
        email,
        request,
        organizationIds,
        memberships,
        invites,
        approvalDetails,
        recoveryEligibility,
        availabilityByOrg,
        timeline,
        timelineFilter,
    })
    const caseSummary = buildSupportCaseSummary({
        org,
        user,
        email,
        request,
        organizationIds,
        organizations,
        users,
        memberships,
        invites,
        approvalDetails,
        recoveryEligibility,
        accessStatus,
        timeline,
        timelineFilter,
    })
    const workbench = buildSupportWorkbench({
        org,
        user,
        email,
        request,
        organizationIds,
        users,
        memberships,
        invites,
        recoveryEligibility,
        caseSummary,
        timeline,
        timelineFilter,
        preparationInput: preparationInput.value,
    })
    const workbenchAdapter = supportWorkbenchAdapter({
        org,
        user,
        email,
        request,
        workbench,
        caseSummary,
        accessStatus,
        timeline,
        timelineFilter,
    })
    const searchProof = supportInspectionSearchProof({
        q,
        org,
        user,
        email,
        request,
        entity,
        supportSession,
        organizationIds,
        organizations,
        users,
        memberships,
        invites,
        approvalDetails,
        timeline,
        timelineFilter,
    })
    const authorizationMatrix = supportInspectionAuthorizationMatrix({
        authorization,
        workbench,
        accessRecoveryPlan,
        supportSession,
        sessionState,
        organizationIds,
        user,
        email,
        request,
        timelineFilter,
    })
    const auditDetailPacket = supportInspectionAuditDetailPacket({
        org,
        user,
        email,
        request,
        supportSession,
        organizationIds,
        memberships,
        invites,
        timeline,
        timelineFilter,
    })
    const orgBoundaryProof = supportInspectionOrgBoundaryProof({
        requestedOrg: org,
        requestedUser: user,
        email,
        request,
        supportSession,
        sessionState,
        authorization,
        organizationIds,
        memberships,
        invites,
        timeline,
        timelineFilter,
    })
    const recoveryFixturePacket = supportInspectionRecoveryFixturePacket({
        org,
        user,
        email,
        request,
        supportSession,
        accessRecoveryPlan,
        workbench,
        timelineFilter,
    })
    const auditFilterCoverage = supportInspectionAuditFilterCoverage({
        timelineFilter,
        timeline,
        organizationIds,
        user,
        email,
        request,
        supportSession,
    })

    await recordAdminAuditEvent(req, {
        actionType: 'support.inspect',
        actorId: actor.id,
        targetType: user ? 'user' : email ? 'invite' : org ? 'organization' : supportSession ? 'support_session' : 'request',
        targetId: user || email || org || supportSession || request,
        organizationId: organizationIds[0] || null,
        entityId: supportSession || request || user || email || org || null,
        requestId: supportRequestId(req),
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.inspection.v1',
            filters: { q, org, user, email, request, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit },
            organizationCount: organizations.length,
            membershipCount: memberships.length,
            pendingInviteCount: invites.filter(row => row.status === 'pending').length,
            approvalCount: approvals.length,
            auditEventIds: timeline.map(event => event.id),
            authorization,
        },
    })

    return res.send({
        inspection: {
            schemaVersion: 'support.inspection.v1',
            generatedAt: new Date().toISOString(),
            filters: { q, org, user, email, request, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit },
            supportSession: sessionState ? supportSessionResponse({
                ...sessionState,
                actorId: sessionState.actorId,
                reason: sessionState.reason,
                requestId: sessionState.requestId,
                auditEventIds: sessionState.auditEventIds,
            }) : null,
            authorization,
            organizations: organizations.map(row => ({
                ...toOrganization(row as OrganizationRow),
                adminAvailability: availabilityByOrg.get(String(row.id)) || null,
            })),
            users: users.map(toSupportUser),
            memberships: memberships.map(toSupportMemberDetail),
            invites: invites.map(toSupportInvite),
            pendingInvites: invites.filter(row => row.status === 'pending').map(toSupportInvite),
            approvalRequests: approvalDetails,
            accessStatus,
            accessRecoveryPlan,
            caseSummary,
            workbench,
            workbenchAdapter,
            searchProof,
            authorizationMatrix,
            auditDetailPacket,
            orgBoundaryProof,
            recoveryFixturePacket,
            auditFilterCoverage,
            actionPreparation: workbench.actionPreparation,
            recoveryEligibility,
            auditEventIds: timeline.map(event => event.id),
            auditTimeline: timeline,
            filteredTimeline: {
                schemaVersion: 'support.audit.filtered_timeline.v1',
                filter: timelineFilter,
                eventIds: timeline.map(event => event.id),
                summary: auditTimelineSummary(timeline),
                filterContract: supportAuditFilterContract(auditTimelineFilters, timeline),
                exportProof: supportAuditExportProof(auditTimelineFilters, timeline),
                workflowRollup: supportAuditWorkflowRollup(auditTimelineFilters, timeline),
                supportWorkflowPacket: supportAuditSupportWorkflowPacket(auditTimelineFilters, timeline),
                searchProof,
                auditFilterCoverage,
                events: timeline,
                links: {
                    timeline: auditFilterQuery(auditTimelineFilters),
                    details: timeline.map(event => event.links?.detail).filter(Boolean),
                    inviteAssistance: auditTimelineLink({ org, target: email, request, action: 'invite_assist', outcome }),
                    accessRecovery: auditTimelineLink({ org, target: user || email, request, action: 'access_recovery', outcome }),
                    impersonation: auditTimelineLink({ target: user, request, action: 'impersonation', outcome }),
                    supportSession: supportSession ? auditTimelineLink({ request, action: 'support.session', outcome }) : null,
                },
                redacted: true,
                copyText: [
                    `Support timeline: ${auditFilterQuery(auditTimelineFilters)}`,
                    `Events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
                    `Outcomes: ${uniqueTimelineValues(timeline.map(event => event.outcome)).join(', ') || 'none'}`,
                ].join('\n'),
            },
            controlledActions: {
                inviteAssist: organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
                inviteActions: invites.map(invite => `/api/admin/support/organizations/${encodeURIComponent(String(invite.organization_id))}/invites/${encodeURIComponent(String(invite.id))}/actions`),
                memberRoleRecovery: memberships.map(member => `/api/admin/support/organizations/${encodeURIComponent(String(member.organization_id))}/members/${encodeURIComponent(String(member.user_id))}/role-recovery`),
                accessRecovery: organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
                approvalSearch: `/api/admin/support/access-recovery${request ? `?request=${encodeURIComponent(request)}` : ''}`,
                supportSession: supportSession ? `/api/admin/support/sessions/${encodeURIComponent(supportSession)}` : null,
                impersonationGuard: {
                    reasonRequired: true,
                    durationRequired: true,
                    scopeRequired: true,
                    noSilentImpersonation: true,
                    auditTimeline: `/api/admin/audit-events?action=impersonation${request ? `&request=${encodeURIComponent(request)}` : ''}`,
                },
            },
            copyText: [
                `Support inspection q=${q || '*'} org=${org || '*'} user=${user || '*'} email=${email || '*'} request=${request || '*'} session=${supportSession || '*'}`,
                `Authorization: ${authorization.supportSessionScoped ? 'scoped support session' : 'support role'}`,
                `Organizations: ${organizations.length}`,
                `Memberships: ${memberships.length}`,
                `Pending invites: ${invites.filter(row => row.status === 'pending').length}`,
                `Access status: ${accessStatus.overall}`,
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

    const requestId = input.requestId || supportRequestId(req)
    const controls = supportInviteAssistExecutorControls(req, req.body, requestId)
    if (controls.error) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: controls.error.code,
            input,
            controls: controls.value,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(controls.error.status).send(supportError(controls.error.code, controls.error.message, {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: controls.value,
                input,
                blockers: [controls.error.code],
            }),
        }))
    }
    const executorControls = controls.value
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: executorControls.supportSessionId,
        action: 'invite_assist',
        requiredScope: 'invite:create',
        organizationId: organization.id,
    })
    if (sessionValidation.error) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: sessionValidation.error.code,
            input,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    const duplicate = await loadSupportInviteAssistByIdempotencyKey({
        organizationId: organization.id,
        idempotencyKey: executorControls.idempotencyKey,
    })
    if (duplicate) {
        const duplicateInviteIds = auditContextInviteIds(duplicate.context)
        const duplicateInvites = await loadOrganizationInvitesByIds(organization.id, duplicateInviteIds)
        return res.send({
            invites: duplicateInvites.map(toInvite),
            inviteAssistance: {
                schemaVersion: 'support.invite_assist.v1',
                requestId: duplicate.request_id,
                actorId: actor.id,
                organization: toOrganization(organization),
                invites: duplicateInvites.map(toInvite),
                reason,
                scope: {
                    organizationId: organization.id,
                    inviteIds: duplicateInviteIds,
                    role: duplicateInvites[0]?.role || input.role,
                    expiresAt: duplicateInvites[0]?.expires_at || input.expiresAt,
                },
                outcome: 'success',
                idempotentReplay: true,
                blockers: ['duplicate_idempotency_key'],
                auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                noSilentMembershipMutation: true,
                controlledExecutor: supportInviteAssistExecutorDetail({
                    organizationId: organization.id,
                    requestId: duplicate.request_id,
                    reason,
                    controls: executorControls,
                    input,
                    inviteIds: duplicateInviteIds,
                    outcome: 'success',
                    blockers: ['duplicate_idempotency_key'],
                }),
                audit: {
                    actionType: 'support.organization.invite_assist',
                    source: 'admin',
                    service: 'hanasand-api',
                    outcome: 'success',
                    severity: 'notice',
                    eventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                    query: supportInviteAssistAuditQuery({
                        requestId: duplicate.request_id,
                        organizationId: organization.id,
                        entityId: duplicate.entity_id || duplicateInviteIds.join(','),
                        correlationId: executorControls.correlationId,
                        idempotencyKey: executorControls.idempotencyKey,
                        reason,
                    }),
                },
                copyText: [
                    `Support invite assistance already executed for ${duplicateInvites.map(row => row.email).join(', ') || input.emails.join(', ')}`,
                    `Org: ${organization.name} (${organization.id})`,
                    `Request: ${duplicate.request_id}`,
                    `Idempotency: ${executorControls.idempotencyKey}`,
                    `Audit events: ${duplicate.id}`,
                    `Reason: ${reason}`,
                ].join('\n'),
            },
        })
    }

    const availability = await loadOrganizationAvailability([organization.id])
    const hasAvailableAdmin = availability[0]?.hasAvailableAdmin === true
    if (hasAvailableAdmin) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: 'active_admin_available',
            input,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(409).send(supportError('active_admin_available', 'An active organization admin is available; support invite assistance requires unavailable org administration.', {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                blockers: ['active_admin_available'],
            }),
        }))
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

    const inviteIds = rows.map(row => row.id)
    const entityId = inviteIds.join(',')
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organization.id])
    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.invite_assist',
        actorId: actor.id,
        targetType: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        entityId,
        requestId,
        severity: 'notice',
        outcome: 'success',
        reason,
        context: {
            schemaVersion: 'support.invite_assist.v1',
            requestId,
            organizationId: organization.id,
            emails: rows.map(row => row.email),
            role: input.role,
            expiresAt: input.expiresAt,
            inviteIds,
            correlationId: executorControls.correlationId,
            idempotencyKey: executorControls.idempotencyKey,
            supportSessionId: executorControls.supportSessionId || null,
            scope: executorControls.scope,
            handoffExpiresAt: executorControls.handoffExpiresAt,
            executor: supportInviteAssistExecutorDetail({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                inviteIds,
                outcome: 'success',
                blockers: [],
            }),
            noSilentMembershipMutation: true,
            mutation: 'invite_row_only',
            supportContext: cleanContext(req.body?.context),
        },
    })
    const auditEventIds = await loadAdminAuditEventIds({
        requestId,
        actionType: 'support.organization.invite_assist',
        entityId,
    })

    return res.status(201).send({
        invites: rows.map(toInvite),
        inviteAssistance: {
            schemaVersion: 'support.invite_assist.v1',
            requestId,
            actorId: actor.id,
            organization: toOrganization(organization),
            invites: rows.map(toInvite),
            reason,
            controlledExecutor: supportInviteAssistExecutorDetail({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                inviteIds,
                outcome: 'success',
                blockers: [],
            }),
            scope: {
                organizationId: organization.id,
                inviteIds,
                role: input.role,
                expiresAt: input.expiresAt,
                supportScope: executorControls.scope,
            },
            outcome: 'success',
            idempotencyKey: executorControls.idempotencyKey,
            correlationId: executorControls.correlationId,
            auditEventIds,
            noSilentMembershipMutation: true,
            audit: {
                actionType: 'support.organization.invite_assist',
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: 'notice',
                eventIds: auditEventIds,
                query: supportInviteAssistAuditQuery({
                    requestId,
                    organizationId: organization.id,
                    entityId,
                    correlationId: executorControls.correlationId,
                    idempotencyKey: executorControls.idempotencyKey,
                    reason,
                }),
            },
            copyText: [
                `Support invite assistance for ${rows.map(row => row.email).join(', ')}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${input.role}`,
                `Expires: ${input.expiresAt}`,
                `Request: ${requestId}`,
                `Idempotency: ${executorControls.idempotencyKey}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
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

    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    const actionType = action === 'revoke'
        ? 'support.organization.invite_revoke'
        : 'support.organization.invite_resend'
    const controls = supportInviteActionExecutorControls(req, req.body, requestId, action as 'revoke' | 'resend')
    if (controls.error) {
        await recordSupportInviteActionExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            inviteId: req.params.inviteId,
            requestId,
            action: action as 'revoke' | 'resend',
            actionType,
            reason,
            blocker: controls.error.code,
            controls: controls.value,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(controls.error.status).send(supportError(controls.error.code, controls.error.message, {
            executorBlocker: supportInviteActionExecutorDetail({
                organizationId: organization.id,
                requestId,
                action: action as 'revoke' | 'resend',
                actionType,
                reason,
                controls: controls.value,
                invite: null,
                before: null,
                after: null,
                outcome: 'denied',
                blockers: [controls.error.code],
            }),
        }))
    }
    const executorControls = controls.value

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

    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: executorControls.supportSessionId,
        action: action === 'revoke' ? 'invite_revoke' : 'invite_resend',
        requiredScope: action === 'revoke' ? 'invite:revoke' : 'invite:resend',
        organizationId: organization.id,
    })
    if (sessionValidation.error) {
        await recordSupportInviteActionExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            inviteId: invite.id,
            requestId,
            action: action as 'revoke' | 'resend',
            actionType,
            reason,
            blocker: sessionValidation.error.code,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            executorBlocker: supportInviteActionExecutorDetail({
                organizationId: organization.id,
                requestId,
                action: action as 'revoke' | 'resend',
                actionType,
                reason,
                controls: executorControls,
                invite,
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                outcome: 'denied',
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    const duplicate = await loadSupportInviteActionByIdempotencyKey({
        organizationId: organization.id,
        inviteId: invite.id,
        actionType,
        idempotencyKey: executorControls.idempotencyKey,
    })
    if (duplicate) {
        return res.send({
            inviteAction: {
                schemaVersion: 'support.invite_action.v1',
                action,
                requestId: duplicate.request_id,
                actorId: actor.id,
                organization: toOrganization(organization),
                invite: toInvite(invite),
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                reason,
                outcome: 'success',
                idempotentReplay: true,
                blockers: ['duplicate_idempotency_key'],
                auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                noSilentMembershipMutation: true,
                controlledExecutor: supportInviteActionExecutorDetail({
                    organizationId: organization.id,
                    requestId: duplicate.request_id,
                    action: action as 'revoke' | 'resend',
                    actionType,
                    reason,
                    controls: executorControls,
                    invite,
                    before: inviteSnapshot(invite),
                    after: inviteSnapshot(invite),
                    outcome: 'success',
                    blockers: ['duplicate_idempotency_key'],
                }),
                audit: {
                    actionType,
                    source: 'admin',
                    service: 'hanasand-api',
                    outcome: 'success',
                    severity: action === 'revoke' ? 'warning' : 'notice',
                    eventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                    query: supportInviteActionAuditQuery({
                        requestId: duplicate.request_id,
                        organizationId: organization.id,
                        inviteId: invite.id,
                        correlationId: executorControls.correlationId,
                        idempotencyKey: executorControls.idempotencyKey,
                        reason,
                        actionType,
                        outcome: 'success',
                    }),
                },
            },
        })
    }

    const availability = await loadOrganizationAvailability([organization.id])
    if (availability[0]?.hasAvailableAdmin === true) {
        await recordSupportInviteActionExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            inviteId: invite.id,
            requestId,
            action: action as 'revoke' | 'resend',
            actionType,
            reason,
            blocker: 'active_admin_available',
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(409).send(supportError('active_admin_available', 'An active organization admin is available; support invite action requires unavailable org administration.', {
            executorBlocker: supportInviteActionExecutorDetail({
                organizationId: organization.id,
                requestId,
                action: action as 'revoke' | 'resend',
                actionType,
                reason,
                controls: executorControls,
                invite,
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                outcome: 'denied',
                blockers: ['active_admin_available'],
            }),
        }))
    }

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
                correlationId: executorControls.correlationId,
                idempotencyKey: executorControls.idempotencyKey,
                supportSessionId: executorControls.supportSessionId || null,
                scope: executorControls.scope,
                handoffExpiresAt: executorControls.handoffExpiresAt,
                executor: supportInviteActionExecutorDetail({
                    organizationId: organization.id,
                    requestId,
                    action: action as 'revoke' | 'resend',
                    actionType,
                    reason,
                    controls: executorControls,
                    invite,
                    before: inviteSnapshot(invite),
                    after: inviteSnapshot(invite),
                    outcome: 'failed',
                    blockers: ['accepted_invite_not_mutable_by_support_action'],
                }),
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
                controlledExecutor: supportInviteActionExecutorDetail({
                    organizationId: organization.id,
                    requestId,
                    action: action as 'revoke' | 'resend',
                    actionType,
                    reason,
                    controls: executorControls,
                    invite,
                    before: inviteSnapshot(invite),
                    after: inviteSnapshot(invite),
                    outcome: 'failed',
                    blockers: ['accepted_invite_not_mutable_by_support_action'],
                }),
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
            correlationId: executorControls.correlationId,
            idempotencyKey: executorControls.idempotencyKey,
            supportSessionId: executorControls.supportSessionId || null,
            scope: executorControls.scope,
            handoffExpiresAt: executorControls.handoffExpiresAt,
            executor: supportInviteActionExecutorDetail({
                organizationId: organization.id,
                requestId,
                action: action as 'revoke' | 'resend',
                actionType,
                reason,
                controls: executorControls,
                invite: updatedInvite,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
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
            idempotencyKey: executorControls.idempotencyKey,
            correlationId: executorControls.correlationId,
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportInviteActionExecutorDetail({
                organizationId: organization.id,
                requestId,
                action: action as 'revoke' | 'resend',
                actionType,
                reason,
                controls: executorControls,
                invite: updatedInvite,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
            audit: {
                actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: action === 'revoke' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: supportInviteActionAuditQuery({
                    requestId,
                    organizationId: organization.id,
                    inviteId: updatedInvite.id,
                    correlationId: executorControls.correlationId,
                    idempotencyKey: executorControls.idempotencyKey,
                    reason,
                    actionType,
                    outcome: 'success',
                }),
            },
            copyText: [
                `Support invite ${action} for ${updatedInvite.email}`,
                `Org: ${organization.name} (${organization.id})`,
                `Invite: ${updatedInvite.id}`,
                `Status: ${before.status} -> ${after.status}`,
                `Request: ${requestId}`,
                `Idempotency: ${executorControls.idempotencyKey}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}

export async function getSupportOrganizationInvite(req: FastifyRequest<{ Params: SupportInviteActionParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const inspectionAudit = supportInspectionAuditMetadata(req)
    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.organization.invite.inspect',
            actorId: actor.id,
            targetType: 'invite',
            targetId: req.params.inviteId,
            organizationId: req.params.id,
            entityId: req.params.inviteId,
            requestId: inspectionAudit.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason: inspectionAudit.reason || undefined,
            context: supportInspectionAuditContext(inspectionAudit, { error: 'organization_not_found', inviteId: req.params.inviteId }),
        })
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const inviteResult = await run(`
        SELECT invite.*, organization.name AS organization_name, organization.slug AS organization_slug
        FROM organization_invites invite
        JOIN organizations organization ON organization.id = invite.organization_id
        WHERE invite.id = $1
          AND invite.organization_id = $2
        LIMIT 1
    `, [req.params.inviteId, organization.id])
    const invite = inviteResult.rows[0] as OrganizationInviteRow | undefined
    if (!invite) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.organization.invite.inspect',
            actorId: actor.id,
            targetType: 'invite',
            targetId: req.params.inviteId,
            organizationId: organization.id,
            entityId: req.params.inviteId,
            requestId: inspectionAudit.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason: inspectionAudit.reason || undefined,
            context: supportInspectionAuditContext(inspectionAudit, { error: 'invite_not_found', inviteId: req.params.inviteId }),
        })
        return res.status(404).send({ error: 'Invite not found for organization.' })
    }

    const auditRows = await run(`
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
        WHERE event.organization_id = $1
          AND (
              event.entity_id = $2
              OR event.target_id = $2
              OR event.context->>'inviteId' = $2
              OR event.context->'inviteIds' ? $2
          )
        ORDER BY event.created_at DESC
        LIMIT 25
    `, [organization.id, invite.id])
    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.invite.inspect',
        actorId: actor.id,
        targetType: 'invite',
        targetId: invite.email,
        organizationId: organization.id,
        entityId: invite.id,
        requestId: inspectionAudit.requestId,
        severity: 'info',
        outcome: 'success',
        reason: inspectionAudit.reason || undefined,
        context: supportInspectionAuditContext(inspectionAudit, {
            inviteId: invite.id,
            email: invite.email,
            status: invite.status,
            role: invite.role,
        }),
    })
    const recentAuditTimeline = supportRecentAuditTimeline({
        org: organization.id,
        target: invite.email,
        entity: invite.id,
        entityType: 'invite',
        request: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        action: 'support.organization.invite',
    }, auditRows.rows as Record<string, unknown>[])
    const [availability, approvals] = await Promise.all([
        loadOrganizationAvailability([organization.id]),
        loadInspectionApprovals({ org: organization.id, user: '', email: invite.email, request: inspectionAudit.requestId, outcome: '', limit: 25 }),
    ])
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const approvalDetails = (approvals as AccessRecoveryApprovalRow[]).map(toAccessRecoveryDecision)
    const inviteTimelineFilter = supportTimelineFilter({
        q: '',
        org: organization.id,
        user: '',
        email: invite.email,
        request: inspectionAudit.requestId,
        entity: invite.id,
        entityType: 'invite',
        supportSession: '',
        action: 'support.organization.invite',
        severity: '',
        outcome: '',
        source: 'admin',
        service: 'hanasand-api',
        blocker: '',
        reason: inspectionAudit.reason,
        context: inspectionAudit.supportContext,
        from: '',
        to: '',
        limit: 25,
    })
    const recoveryEligibility = buildRecoveryEligibility({
        email: invite.email,
        user: '',
        organizationIds: [organization.id],
        memberships: [],
        users: [],
        availabilityByOrg,
        invites: [invite as unknown as Record<string, unknown>],
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: organization.id,
        user: '',
        email: invite.email,
        request: inspectionAudit.requestId,
        organizationIds: [organization.id],
        memberships: [],
        invites: [invite as unknown as Record<string, unknown>],
        approvalDetails,
        recoveryEligibility,
        availabilityByOrg,
        timeline: recentAuditTimeline.events,
        timelineFilter: inviteTimelineFilter,
    })
    const authorization = buildSupportInspectionAuthorization({
        actorId: actor.id,
        requestedOrg: req.params.id,
        requestedUser: '',
        effectiveOrg: organization.id,
        effectiveUser: '',
        email: invite.email,
        request: inspectionAudit.requestId,
        entity: invite.id,
        supportSession: '',
        sessionState: null,
        organizationIds: [organization.id],
    })
    return res.send({
        invite: toSupportInvite(invite),
        inviteInspection: {
            schemaVersion: 'support.invite_inspection.v1',
            organization: toOrganization(organization),
            invite: toSupportInvite(invite),
            snapshot: inviteSnapshot(invite),
            authorization,
            accessRecoveryPlan,
            auditEventIds: recentAuditTimeline.eventIds,
            auditTimeline: recentAuditTimeline,
            links: {
                action: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/invites/${encodeURIComponent(invite.id)}/actions`,
                accessRecovery: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/access-recovery`,
                audit: auditFilterQuery({ org: organization.id, entity: invite.id, entityType: 'invite' }),
            },
            noMutation: true,
            redacted: true,
            copyText: [
                `Support invite inspection ${invite.id}`,
                `Organization: ${organization.name} (${organization.id})`,
                `Email: ${invite.email}`,
                `Status: ${invite.status}`,
                `Audit events: ${recentAuditTimeline.eventIds.join(', ') || 'none'}`,
            ].join('\n'),
        },
    })
}

export async function getSupportOrganizationMember(req: FastifyRequest<{ Params: OrganizationMemberParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const inspectionAudit = supportInspectionAuditMetadata(req)
    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.organization.member.inspect',
            actorId: actor.id,
            targetType: 'member',
            targetId: req.params.userId,
            organizationId: req.params.id,
            entityId: req.params.userId,
            requestId: inspectionAudit.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason: inspectionAudit.reason || undefined,
            context: supportInspectionAuditContext(inspectionAudit, { error: 'organization_not_found', userId: req.params.userId }),
        })
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const member = await loadSupportMemberDetail(organization.id, req.params.userId)
    if (!member) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.organization.member.inspect',
            actorId: actor.id,
            targetType: 'member',
            targetId: req.params.userId,
            organizationId: organization.id,
            entityId: req.params.userId,
            requestId: inspectionAudit.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason: inspectionAudit.reason || undefined,
            context: supportInspectionAuditContext(inspectionAudit, { error: 'member_not_found', userId: req.params.userId }),
        })
        return res.status(404).send({ error: 'Organization member not found.' })
    }

    const auditRows = await run(`
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
        WHERE event.organization_id = $1
          AND (
              event.entity_id = $2
              OR event.target_id = $2
              OR event.context->>'targetUserId' = $2
              OR event.context->>'memberId' = $2
          )
        ORDER BY event.created_at DESC
        LIMIT 25
    `, [organization.id, req.params.userId])
    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.member.inspect',
        actorId: actor.id,
        targetType: 'member',
        targetId: req.params.userId,
        organizationId: organization.id,
        entityId: req.params.userId,
        requestId: inspectionAudit.requestId,
        severity: 'info',
        outcome: 'success',
        reason: inspectionAudit.reason || undefined,
        context: supportInspectionAuditContext(inspectionAudit, {
            userId: req.params.userId,
            role: member.role,
            status: member.status,
            active: member.active,
        }),
    })
    const recentAuditTimeline = supportRecentAuditTimeline({
        org: organization.id,
        target: req.params.userId,
        entity: req.params.userId,
        entityType: 'member',
        request: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        action: 'support.organization.member',
    }, auditRows.rows as Record<string, unknown>[])
    const [availability, approvals] = await Promise.all([
        loadOrganizationAvailability([organization.id]),
        loadInspectionApprovals({ org: organization.id, user: req.params.userId, email: '', request: inspectionAudit.requestId, outcome: '', limit: 25 }),
    ])
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const approvalDetails = (approvals as AccessRecoveryApprovalRow[]).map(toAccessRecoveryDecision)
    const memberTimelineFilter = supportTimelineFilter({
        q: '',
        org: organization.id,
        user: req.params.userId,
        email: '',
        request: inspectionAudit.requestId,
        entity: req.params.userId,
        entityType: 'member',
        supportSession: '',
        action: 'support.organization.member',
        severity: '',
        outcome: '',
        source: 'admin',
        service: 'hanasand-api',
        blocker: '',
        reason: inspectionAudit.reason,
        context: inspectionAudit.supportContext,
        from: '',
        to: '',
        limit: 25,
    })
    const recoveryEligibility = buildRecoveryEligibility({
        email: '',
        user: req.params.userId,
        organizationIds: [organization.id],
        memberships: [member],
        users: [member],
        availabilityByOrg,
        invites: [],
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: organization.id,
        user: req.params.userId,
        email: '',
        request: inspectionAudit.requestId,
        organizationIds: [organization.id],
        memberships: [member],
        invites: [],
        approvalDetails,
        recoveryEligibility,
        availabilityByOrg,
        timeline: recentAuditTimeline.events,
        timelineFilter: memberTimelineFilter,
    })
    const authorization = buildSupportInspectionAuthorization({
        actorId: actor.id,
        requestedOrg: req.params.id,
        requestedUser: req.params.userId,
        effectiveOrg: organization.id,
        effectiveUser: req.params.userId,
        email: '',
        request: inspectionAudit.requestId,
        entity: req.params.userId,
        supportSession: '',
        sessionState: null,
        organizationIds: [organization.id],
    })
    return res.send({
        member: toSupportMemberDetail(member),
        memberInspection: {
            schemaVersion: 'support.member_inspection.v1',
            organization: toOrganization(organization),
            member: toSupportMemberDetail(member),
            snapshot: membershipSnapshot(member),
            authorization,
            accessRecoveryPlan,
            auditEventIds: recentAuditTimeline.eventIds,
            auditTimeline: recentAuditTimeline,
            links: {
                roleRecovery: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/members/${encodeURIComponent(req.params.userId)}/role-recovery`,
                audit: auditFilterQuery({ org: organization.id, target: req.params.userId, entity: req.params.userId, entityType: 'member' }),
                user: `/api/admin/support/users/${encodeURIComponent(req.params.userId)}`,
            },
            noMutation: true,
            redacted: true,
            copyText: [
                `Support member inspection ${req.params.userId}`,
                `Organization: ${organization.name} (${organization.id})`,
                `Role: ${member.role}`,
                `Status: ${member.status}`,
                `Audit events: ${recentAuditTimeline.eventIds.join(', ') || 'none'}`,
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

    const requestId = input.requestId || supportRequestId(req)
    const actionType = 'support.organization.member_role_recovery'
    const controls = supportMemberRoleRecoveryExecutorControls(req, req.body, requestId)
    if (controls.error) {
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker: controls.error.code,
            requestedRole: input.role,
            controls: controls.value,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(controls.error.status).send(supportError(controls.error.code, controls.error.message, {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: controls.value,
                member: null,
                before: null,
                after: null,
                outcome: 'denied',
                blockers: [controls.error.code],
            }),
        }))
    }
    const executorControls = controls.value

    const member = await loadSupportMemberDetail(req.params.id, req.params.userId)
    if (!member) {
        return res.status(404).send({ error: 'Active organization member not found.' })
    }

    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: executorControls.supportSessionId,
        action: 'member_role_recovery',
        requiredScope: 'member:role_recovery',
        organizationId: organization.id,
        targetUserId: req.params.userId,
    })
    if (sessionValidation.error) {
        const snapshot = membershipSnapshot(member)
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker: sessionValidation.error.code,
            requestedRole: input.role,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
            before: snapshot,
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member,
                before: snapshot,
                after: snapshot,
                outcome: 'denied',
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    const duplicate = await loadSupportMemberRoleRecoveryByIdempotencyKey({
        organizationId: organization.id,
        userId: req.params.userId,
        idempotencyKey: executorControls.idempotencyKey,
    })
    if (duplicate) {
        const snapshot = membershipSnapshot(member)
        return res.send({
            memberRoleRecovery: {
                schemaVersion: 'support.member_role_recovery.v1',
                requestId: duplicate.request_id,
                actorId: actor.id,
                organization: toOrganization(organization),
                member: toSupportMemberDetail(member),
                before: snapshot,
                after: snapshot,
                requestedRole: input.role,
                reason,
                outcome: 'success',
                idempotentReplay: true,
                blockers: ['duplicate_idempotency_key'],
                auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                noSilentMembershipMutation: true,
                controlledExecutor: supportMemberRoleRecoveryExecutorDetail({
                    organizationId: organization.id,
                    userId: req.params.userId,
                    requestId: duplicate.request_id,
                    reason,
                    requestedRole: input.role,
                    controls: executorControls,
                    member,
                    before: snapshot,
                    after: snapshot,
                    outcome: 'success',
                    blockers: ['duplicate_idempotency_key'],
                }),
                audit: {
                    actionType,
                    source: 'admin',
                    service: 'hanasand-api',
                    outcome: 'success',
                    severity: input.role === 'admin' || snapshot.role === 'owner' ? 'warning' : 'notice',
                    eventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                    query: supportMemberRoleRecoveryAuditQuery({
                        requestId: duplicate.request_id,
                        organizationId: organization.id,
                        userId: req.params.userId,
                        correlationId: executorControls.correlationId,
                        idempotencyKey: executorControls.idempotencyKey,
                        reason,
                        outcome: 'success',
                    }),
                },
            },
        })
    }

    if (member.status !== 'active') {
        const snapshot = membershipSnapshot(member)
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker: 'revoked_member',
            requestedRole: input.role,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
            before: snapshot,
        })
        return res.status(409).send(supportError('revoked_member', 'Support role recovery requires an active organization member; inspect removed membership state first.', {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member,
                before: snapshot,
                after: snapshot,
                outcome: 'denied',
                blockers: ['revoked_member'],
            }),
        }))
    }

    const availability = await loadOrganizationAvailability([organization.id])
    if (availability[0]?.hasAvailableAdmin === true) {
        const snapshot = membershipSnapshot(member)
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker: 'active_admin_available',
            requestedRole: input.role,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
            before: snapshot,
        })
        return res.status(409).send(supportError('active_admin_available', 'An active organization admin is available; support member role recovery requires unavailable org administration.', {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member,
                before: snapshot,
                after: snapshot,
                outcome: 'denied',
                blockers: ['active_admin_available'],
            }),
        }))
    }

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
                correlationId: executorControls.correlationId,
                idempotencyKey: executorControls.idempotencyKey,
                supportSessionId: executorControls.supportSessionId || null,
                scope: executorControls.scope,
                handoffExpiresAt: executorControls.handoffExpiresAt,
                executor: supportMemberRoleRecoveryExecutorDetail({
                    organizationId: organization.id,
                    userId: req.params.userId,
                    requestId,
                    reason,
                    requestedRole: input.role,
                    controls: executorControls,
                    member,
                    before,
                    after: before,
                    outcome: permissionError ? 'denied' : 'failed',
                    blockers: [error],
                }),
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
                controlledExecutor: supportMemberRoleRecoveryExecutorDetail({
                    organizationId: organization.id,
                    userId: req.params.userId,
                    requestId,
                    reason,
                    requestedRole: input.role,
                    controls: executorControls,
                    member,
                    before,
                    after: before,
                    outcome: permissionError ? 'denied' : 'failed',
                    blockers: [error],
                }),
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
            correlationId: executorControls.correlationId,
            idempotencyKey: executorControls.idempotencyKey,
            supportSessionId: executorControls.supportSessionId || null,
            scope: executorControls.scope,
            handoffExpiresAt: executorControls.handoffExpiresAt,
            executor: supportMemberRoleRecoveryExecutorDetail({
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member: updatedMember as Record<string, unknown>,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
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
            idempotencyKey: executorControls.idempotencyKey,
            correlationId: executorControls.correlationId,
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportMemberRoleRecoveryExecutorDetail({
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member: updatedMember as Record<string, unknown>,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
            audit: {
                actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: input.role === 'admin' || before.role === 'owner' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: supportMemberRoleRecoveryAuditQuery({
                    requestId,
                    organizationId: organization.id,
                    userId: req.params.userId,
                    correlationId: executorControls.correlationId,
                    idempotencyKey: executorControls.idempotencyKey,
                    reason,
                    outcome: 'success',
                }),
            },
            copyText: [
                `Support member role recovery for ${req.params.userId}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${before.role} -> ${after.role}`,
                `Request: ${requestId}`,
                `Idempotency: ${executorControls.idempotencyKey}`,
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
    const filters = { request, org, status, outcome, requester, approver, from, to, limit }
    const approvalTimeline = supportAccessRecoveryApprovalTimeline(filters, approvals)
    return res.send({
        approvals,
        filters,
        detail: {
            schemaVersion: 'support.access_recovery.approval_search.v1',
            generatedAt: new Date().toISOString(),
            filters,
            approvalTimeline,
            copyText: approvals.slice(0, 20).map(approval => approval.copyText).join('\n\n'),
        },
    })
}

export async function getSupportAccessRecoveryApproval(req: FastifyRequest<{ Params: AccessRecoveryDecisionParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const requestId = text(req.params.requestId)
    const approval = requestId ? await loadAccessRecoveryApproval(requestId) : undefined
    const inspectionRequestId = supportRequestId(req)
    if (!approval) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.organization.access_recovery.inspect',
            actorId: actor.id,
            targetType: 'access_recovery',
            targetId: requestId || 'unknown',
            entityId: requestId || null,
            requestId: inspectionRequestId,
            severity: 'notice',
            outcome: 'failed',
            context: {
                schemaVersion: 'support.access_recovery.inspect.v1',
                requestId: requestId || null,
                error: 'access_recovery_request_not_found',
                redactionRequired: true,
            },
        })
        return res.status(404).send(supportError('access_recovery_request_not_found', 'Access recovery request not found.', {
            requestId: requestId || null,
        }))
    }

    const detail = toAccessRecoveryDecision(approval)
    const auditRows = await run(`
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
        WHERE event.request_id = $1
           OR event.entity_id = $2
        ORDER BY event.created_at DESC
        LIMIT 50
    `, [approval.request_id, approval.invite_id])
    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.access_recovery.inspect',
        actorId: actor.id,
        targetType: 'access_recovery',
        targetId: approval.request_id,
        organizationId: approval.organization_id,
        entityId: approval.invite_id,
        requestId: inspectionRequestId,
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.access_recovery.inspect.v1',
            requestId: approval.request_id,
            organizationId: approval.organization_id,
            inviteId: approval.invite_id,
            status: approval.status,
            outcome: approval.outcome,
            redactionRequired: true,
        },
    })
    const auditFilters = accessRecoveryApprovalAuditFilters({
        request: approval.request_id,
        org: approval.organization_id,
        status: approval.status,
        outcome: approval.outcome,
    })
    const timeline = (auditRows.rows as Record<string, unknown>[]).map(toSupportAuditTimelineEvent)
    const approvalTimeline = supportAccessRecoveryApprovalTimeline(auditFilters, [detail])
    const [availability, memberDetail] = await Promise.all([
        loadOrganizationAvailability([approval.organization_id]),
        detail.targetUserId ? loadSupportMemberDetail(approval.organization_id, detail.targetUserId) : Promise.resolve(undefined),
    ])
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const approvalInvite = {
        id: approval.invite_id,
        organization_id: approval.organization_id,
        organization_name: approval.organization_name,
        email: approval.email,
        role: approval.role,
        status: approval.invite_status,
        expires_at: approval.expires_at,
        accepted_at: null,
    } as Record<string, unknown>
    const recoveryEligibility = buildRecoveryEligibility({
        email: approval.email || '',
        user: detail.targetUserId || '',
        organizationIds: [approval.organization_id],
        memberships: memberDetail ? [memberDetail] : [],
        users: memberDetail ? [memberDetail] : [],
        availabilityByOrg,
        invites: [approvalInvite],
    })
    const timelineFilter = supportTimelineFilter({
        q: '',
        org: approval.organization_id,
        user: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        entity: approval.invite_id,
        entityType: 'invite',
        supportSession: '',
        action: 'support.organization.access_recovery',
        severity: '',
        outcome: approval.outcome,
        source: 'admin',
        service: 'hanasand-api',
        blocker: '',
        reason: detail.requestedReason || detail.decisionReason || '',
        context: '',
        from: '',
        to: '',
        limit: 50,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: approval.organization_id,
        user: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        organizationIds: [approval.organization_id],
        memberships: memberDetail ? [memberDetail] : [],
        invites: [approvalInvite],
        approvalDetails: [detail],
        recoveryEligibility,
        availabilityByOrg,
        timeline,
        timelineFilter,
    })
    const authorization = buildSupportInspectionAuthorization({
        actorId: actor.id,
        requestedOrg: approval.organization_id,
        requestedUser: detail.targetUserId || '',
        effectiveOrg: approval.organization_id,
        effectiveUser: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        entity: approval.invite_id,
        supportSession: '',
        sessionState: null,
        organizationIds: [approval.organization_id],
    })
    return res.send({
        accessRecovery: detail,
        accessRecoveryInspection: {
            schemaVersion: 'support.access_recovery.inspection.v1',
            approval: detail,
            authorization,
            accessRecoveryPlan,
            auditEventIds: timeline.map(event => event.id),
            auditTimeline: {
                schemaVersion: 'support.access_recovery.inspection_timeline.v1',
                filters: auditFilters,
                eventIds: timeline.map(event => event.id),
                summary: auditTimelineSummary(timeline),
                filterContract: supportAuditFilterContract(auditFilters, timeline),
                exportProof: supportAuditExportProof(auditFilters, timeline),
                workflowRollup: supportAuditWorkflowRollup(auditFilters, timeline),
                timeline,
                redacted: true,
            },
            approvalTimeline,
            links: {
                approve: `/api/admin/support/access-recovery/${encodeURIComponent(approval.request_id)}/approve`,
                deny: `/api/admin/support/access-recovery/${encodeURIComponent(approval.request_id)}/deny`,
                organization: `/api/admin/support/organizations/${encodeURIComponent(approval.organization_id)}`,
                invite: `/api/admin/support/organizations/${encodeURIComponent(approval.organization_id)}/invites/${encodeURIComponent(approval.invite_id)}`,
                audit: auditFilterQuery(auditFilters),
            },
            noMutation: true,
            redacted: true,
            copyText: [
                `Access recovery request ${approval.request_id}`,
                `Status: ${approval.status}`,
                `Outcome: ${approval.outcome}`,
                `Invite: ${approval.invite_id} (${approval.invite_status || 'unknown'})`,
                `Audit events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
            ].join('\n'),
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

    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    const targetUserId = text(req.body?.targetUserId)
    const supportSessionId = supportSessionIdFromRequest(req, req.body)
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId,
        action: 'access_recovery',
        requiredScope: 'recovery:invite',
        organizationId: organization.id,
        targetUserId: targetUserId || null,
    })
    if (sessionValidation.error) {
        await recordAdminAuditEvent(req, {
            actionType: 'support.organization.access_recovery',
            actorId: actor.id,
            targetType: targetUserId ? 'user' : 'invite',
            targetId: targetUserId || input.emails[0],
            organizationId: organization.id,
            entityId: supportSessionId || targetUserId || input.emails[0],
            requestId,
            severity: 'warning',
            outcome: 'denied',
            reason,
            context: {
                schemaVersion: 'support.access_recovery.session_guard.v1',
                requestId,
                supportSessionId: supportSessionId || null,
                targetUserId: targetUserId || null,
                email: input.emails[0],
                role: input.role,
                expiresAt: input.expiresAt,
                blockerCode: sessionValidation.error.code,
                requiredScope: 'recovery:invite',
                noSilentMembershipMutation: true,
                mutation: 'none',
                supportContext: cleanContext(req.body?.context),
                redactionRequired: true,
            },
        })
        const auditEventIds = await loadAdminAuditEventIds({
            requestId,
            actionType: 'support.organization.access_recovery',
            entityId: supportSessionId || targetUserId || input.emails[0],
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            schemaVersion: 'support.access_recovery.session_guard.v1',
            requestId,
            supportSessionId: supportSessionId || null,
            auditEventIds,
            noSilentMembershipMutation: true,
        }))
    }

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
            supportSessionId: supportSessionId || null,
            existingMembership: existingMembership.rows[0] || null,
            caseId: text(req.body?.caseId) || null,
            supportContext,
            mutation: 'controlled_invite_only',
            approval,
        },
    })
    const auditEventIds = await loadAdminAuditEventIds({
        requestId,
        actionType: 'support.organization.access_recovery',
        entityId: inviteRow.id,
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
            supportSessionId: supportSessionId || null,
            approval,
            auditEventIds,
            audit: {
                actionType: 'support.organization.access_recovery',
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: 'warning',
                eventIds: auditEventIds,
                query: `/api/admin/audit-events?request=${encodeURIComponent(requestId)}&outcome=success&source=admin&service=hanasand-api`,
            },
            copyText: [
                `Access recovery invite created for ${inviteRow.email}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${inviteRow.role}`,
                `Expires: ${inviteRow.expires_at}`,
                `Request: ${requestId}`,
                `Approval: ${approval.status}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
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

    const supportSessionId = supportSessionIdFromRequest(req, req.body)
    const requiredScope = decision === 'approved' ? 'recovery:approve' : 'recovery:deny'
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId,
        action: 'access_recovery',
        requiredScope,
        organizationId: current.organization_id,
        targetUserId: current.target_user_id || null,
    })
    if (sessionValidation.error) {
        await recordAccessRecoveryDecisionAudit(req, actor.id, current, decision, 'denied', reason, {
            error: sessionValidation.error.code,
            schemaVersion: 'support.access_recovery.session_guard.v1',
            supportSessionId: supportSessionId || null,
            requiredScope,
            blockerCode: sessionValidation.error.code,
            noSilentMembershipMutation: true,
            mutation: 'none',
            supportContext: cleanContext(req.body?.context),
            redactionRequired: true,
        })
        const auditEventIds = await loadAdminAuditEventIds({
            requestId: current.request_id,
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            entityId: current.invite_id,
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            schemaVersion: 'support.access_recovery.session_guard.v1',
            requestId: current.request_id,
            supportSessionId: supportSessionId || null,
            requiredScope,
            auditEventIds,
            noSilentMembershipMutation: true,
            decision: toAccessRecoveryDecision(current),
        }))
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
        supportSessionId: supportSessionId || null,
        supportContext: cleanContext(req.body?.context),
    })

    return res.send({ decision: detail })
}

async function requireAdminSupport(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id || actor.impersonating) {
        res.status(401).send(supportError('support_auth_required', actor.error || 'Unauthorized.'))
        return null
    }
    if (!await actorHasAdminSupportAccess(actor.id)) {
        res.status(403).send(supportError('support_role_required', 'Only admins can use support operations.'))
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

async function loadInspectionOrganizations(input: { q?: string, org: string, user: string, email: string, request: string, limit: number }) {
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
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push(`(
            o.id ILIKE ${placeholder}
            OR o.name ILIKE ${placeholder}
            OR o.slug ILIKE ${placeholder}
            OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = o.id AND om.user_id ILIKE ${placeholder})
            OR EXISTS (SELECT 1 FROM organization_invites invite WHERE invite.organization_id = o.id AND invite.email ILIKE ${placeholder})
            OR EXISTS (SELECT 1 FROM admin_audit_events event WHERE event.organization_id = o.id AND (event.action_type ILIKE ${placeholder} OR event.request_id ILIKE ${placeholder} OR event.entity_id ILIKE ${placeholder} OR event.reason ILIKE ${placeholder}))
        )`)
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

async function loadInspectionUsers(input: { q?: string, user: string, request: string, limit: number }) {
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
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
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

async function loadInspectionMemberships(input: { q?: string, org: string, user: string, request: string, limit: number }) {
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
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push('(om.organization_id ILIKE ' + placeholder + ' OR organizations.name ILIKE ' + placeholder + ' OR organizations.slug ILIKE ' + placeholder + ' OR om.user_id ILIKE ' + placeholder + ' OR users.name ILIKE ' + placeholder + ' OR om.role ILIKE ' + placeholder + ' OR om.status ILIKE ' + placeholder + ')')
    }
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

async function loadInspectionInvites(input: { q?: string, org: string, email: string, request: string, limit: number }) {
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
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push('(organization_invites.id ILIKE ' + placeholder + ' OR organization_invites.email ILIKE ' + placeholder + ' OR organization_invites.role ILIKE ' + placeholder + ' OR organization_invites.status ILIKE ' + placeholder + ' OR organizations.name ILIKE ' + placeholder + ' OR organizations.slug ILIKE ' + placeholder + ')')
    }
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

async function loadInspectionApprovals(input: { q?: string, org: string, user: string, email: string, request: string, outcome: string, limit: number }) {
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
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push('(approval.request_id ILIKE ' + placeholder + ' OR approval.requested_reason ILIKE ' + placeholder + ' OR approval.decision_reason ILIKE ' + placeholder + ' OR invite.email ILIKE ' + placeholder + ' OR invite.status ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
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

async function loadInspectionAuditEvents(input: { q: string, org: string, user: string, email: string, request: string, entity: string, entityType: string, supportSession: string, action: string, severity: string, outcome: string, source: string, service: string, blocker: string, reason: string, context: string, from: string, to: string, limit: number }) {
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
    if (input.q) {
        const placeholder = add(`%${input.q}%`)
        where.push(`(
            event.action_type ILIKE ${placeholder}
            OR event.actor_id ILIKE ${placeholder}
            OR event.target_id ILIKE ${placeholder}
            OR event.target_type ILIKE ${placeholder}
            OR event.organization_id ILIKE ${placeholder}
            OR organization.name ILIKE ${placeholder}
            OR organization.slug ILIKE ${placeholder}
            OR event.entity_id ILIKE ${placeholder}
            OR event.request_id ILIKE ${placeholder}
            OR event.outcome ILIKE ${placeholder}
            OR event.reason ILIKE ${placeholder}
            OR event.context::text ILIKE ${placeholder}
        )`)
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
    if (input.supportSession) {
        const placeholder = add(`%${input.supportSession}%`)
        where.push('(event.entity_id ILIKE ' + placeholder + ' OR event.context->>\'supportSessionId\' ILIKE ' + placeholder + ')')
    }
    if (input.entityType) where.push(`event.target_type ILIKE ${add(`%${input.entityType}%`)}`)
    if (input.action) where.push(`event.action_type ILIKE ${add(`%${input.action}%`)}`)
    if (input.severity) where.push(`event.severity = ${add(input.severity)}`)
    if (input.outcome) where.push(`event.outcome = ${add(input.outcome)}`)
    if (input.source) where.push(`event.source ILIKE ${add(`%${input.source}%`)}`)
    if (input.service) where.push(`event.service ILIKE ${add(`%${input.service}%`)}`)
    if (input.blocker) {
        const placeholder = add(`%${input.blocker}%`)
        where.push('(event.context->>\'blockerCode\' ILIKE ' + placeholder + ' OR event.context->>\'blocker\' ILIKE ' + placeholder + ')')
    }
    if (input.reason) where.push(`event.reason ILIKE ${add(`%${input.reason}%`)}`)
    if (input.context) where.push(`event.context::text ILIKE ${add(`%${input.context}%`)}`)
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

async function loadSupportSessionState(supportSessionId: string) {
    const result = await run(`
        SELECT id, action_type, actor_id, target_id, organization_id, entity_id, request_id, reason, outcome, context, created_at
        FROM admin_audit_events
        WHERE entity_id = $1
          AND action_type IN ('support.session.create', 'support.session.revoke')
        ORDER BY created_at ASC, id ASC
    `, [supportSessionId])
    const create = result.rows.find((row: Record<string, unknown>) => row.action_type === 'support.session.create') as Record<string, any> | undefined
    if (!create) return null
    const revoke = [...result.rows].reverse().find((row: Record<string, unknown>) => row.action_type === 'support.session.revoke' && row.outcome === 'success') as Record<string, any> | undefined
    const context = create.context as Record<string, unknown>
    return {
        supportSessionId,
        actorId: text(create.actor_id),
        reason: text(create.reason),
        requestId: text(create.request_id),
        organizationId: text(context.targetOrganizationId || create.organization_id),
        targetUserId: text(context.targetUserId || create.target_id),
        allowedActions: Array.isArray(context.allowedActions) ? context.allowedActions.map(action => text(action)).filter(Boolean) : [],
        scope: Array.isArray(context.scope) ? context.scope.map(item => text(item)).filter(Boolean) : [],
        durationMinutes: Number(context.durationMinutes || 0),
        expiresAt: text(context.expiresAt),
        status: revoke ? 'revoked' : Date.parse(text(context.expiresAt)) <= Date.now() ? 'expired' : 'active',
        revokedBy: revoke ? text(revoke.actor_id) : null,
        revokedAt: revoke ? text(revoke.created_at) : null,
        auditEventIds: result.rows.map((row: Record<string, unknown>) => Number(row.id)).filter(id => Number.isFinite(id)),
    }
}

async function loadSupportSessionTimeline(supportSessionId: string) {
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
        WHERE e.entity_id = $1
           OR e.context->>'supportSessionId' = $1
        ORDER BY e.created_at ASC, e.id ASC
        LIMIT 250
    `, [supportSessionId])
    return result.rows.map(toAdminAuditEvent).map(event => event.detail.timelineEvent)
}

async function loadAdminAuditEventRelatedTimeline(event: Record<string, any>) {
    const detail = event.detail || {}
    const context = detail.context || {}
    const eventId = Number(event.id)
    const requestId = text(detail.requestId)
    const entityId = text(detail.entityId)
    const supportSessionId = text(context.supportSessionId)
        || (entityId.startsWith('support_session_') ? entityId : '')
    const values: Array<string | number> = [eventId]
    const where = ['e.id = $1']
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (requestId) where.push(`e.request_id = ${add(requestId)}`)
    if (entityId) where.push(`e.entity_id = ${add(entityId)}`)
    if (supportSessionId) {
        const placeholder = add(supportSessionId)
        where.push(`(e.entity_id = ${placeholder} OR e.context->>'supportSessionId' = ${placeholder})`)
    }

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
        WHERE ${where.join('\n           OR ')}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 50
    `, values)
    return result.rows.map(toAdminAuditEvent).map(row => row.detail.timelineEvent)
}

async function validateSupportSessionForAction(input: {
    actorId: string
    supportSessionId?: string | null
    action: string
    requiredScope: string
    organizationId: string
    targetUserId?: string | null
}) {
    if (!input.supportSessionId) {
        return { state: null, error: null as { code: string, message: string, status: number } | null }
    }

    const state = await loadSupportSessionState(input.supportSessionId)
    if (!state) {
        return { state: null, error: { code: 'support_session_not_found', message: 'Support session not found.', status: 404 } }
    }
    if (state.status === 'revoked') {
        return { state, error: { code: 'support_session_revoked', message: 'Support session has been revoked.', status: 409 } }
    }
    if (state.status === 'expired') {
        return { state, error: { code: 'support_session_expired', message: 'Support session has expired.', status: 409 } }
    }
    if (state.actorId && state.actorId !== input.actorId) {
        return { state, error: { code: 'support_session_actor_mismatch', message: 'Support session belongs to a different support actor.', status: 403 } }
    }
    if (state.organizationId && state.organizationId !== input.organizationId) {
        return { state, error: { code: 'support_session_org_mismatch', message: 'Support session is not scoped to this organization.', status: 403 } }
    }
    if (state.targetUserId && input.targetUserId && state.targetUserId !== input.targetUserId) {
        return { state, error: { code: 'support_session_user_mismatch', message: 'Support session is not scoped to this target user.', status: 403 } }
    }
    if (!state.allowedActions.includes(input.action)) {
        return { state, error: { code: 'support_session_action_denied', message: 'Support session does not allow this support action.', status: 403 } }
    }
    if (!state.scope.includes(input.requiredScope)) {
        return { state, error: { code: 'support_session_scope_denied', message: 'Support session does not include the required action scope.', status: 403 } }
    }
    return { state, error: null }
}

async function recordSupportSessionRevokeAudit(req: FastifyRequest, input: {
    actorId: string
    supportSessionId: string
    requestId: string
    reason: string
    organizationId?: string | null
    targetUserId?: string | null
    outcome: 'success' | 'denied' | 'failed'
    blocker: string | null
}) {
    await recordAdminAuditEvent(req, {
        actionType: 'support.session.revoke',
        actorId: input.actorId,
        targetType: input.targetUserId ? 'user' : 'support_session',
        targetId: input.targetUserId || input.supportSessionId,
        organizationId: input.organizationId || null,
        entityId: input.supportSessionId,
        requestId: input.requestId,
        severity: 'notice',
        outcome: input.outcome,
        reason: input.reason,
        context: {
            schemaVersion: 'support.scoped_session.revoke.v1',
            supportSessionId: input.supportSessionId,
            targetOrganizationId: input.organizationId || null,
            targetUserId: input.targetUserId || null,
            revokedBy: input.actorId,
            revokedAt: new Date().toISOString(),
            blockerCode: input.blocker,
            immutableAudit: true,
            redactionRequired: true,
        },
    })
}

function supportSessionResponse(input: {
    supportSessionId: string
    actorId: string
    reason: string
    requestId: string
    organizationId?: string | null
    targetUserId?: string | null
    allowedActions?: string[]
    scope?: string[]
    durationMinutes?: number
    expiresAt: string
    status: string
    revokedBy?: string | null
    revokedAt?: string | null
    auditEventIds: number[]
}) {
    return {
        schemaVersion: 'support.scoped_session.v1',
        id: input.supportSessionId,
        status: input.status,
        actorId: input.actorId,
        target: {
            organizationId: input.organizationId || null,
            userId: input.targetUserId || null,
        },
        reason: input.reason,
        allowedActions: input.allowedActions || [],
        scope: input.scope || [],
        durationMinutes: input.durationMinutes || null,
        expiresAt: input.expiresAt,
        revokedBy: input.revokedBy || null,
        revokedAt: input.revokedAt || null,
        requestId: input.requestId,
        outcome: input.status === 'active' ? 'success' : input.status === 'revoked' ? 'success' : 'denied',
        auditEventIds: input.auditEventIds,
        audit: {
            actionType: input.status === 'revoked' ? 'support.session.revoke' : 'support.session.create',
            source: 'admin',
            service: 'hanasand-api',
            eventIds: input.auditEventIds,
            query: `/api/admin/audit-events?supportSession=${encodeURIComponent(input.supportSessionId)}&source=admin&service=hanasand-api`,
        },
        copyText: [
            `Support session ${input.status}`,
            `Session: ${input.supportSessionId}`,
            `Org: ${input.organizationId || '*'}`,
            `User: ${input.targetUserId || '*'}`,
            `Expires: ${input.expiresAt}`,
            `Request: ${input.requestId}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Reason: ${input.reason}`,
        ].join('\n'),
    }
}

function supportSessionWorkflowRoutes(input: {
    supportSessionId: string
    organizationId?: string | null
    targetUserId?: string | null
    allowedActions?: string[]
    scope?: string[]
}) {
    const organizationId = input.organizationId ? encodeURIComponent(input.organizationId) : ':organizationId'
    const targetUserId = input.targetUserId ? encodeURIComponent(input.targetUserId) : ':userId'
    const actions = new Set(input.allowedActions || [])
    const scope = new Set(input.scope || [])
    return {
        detail: `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}`,
        revoke: `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}/revoke`,
        audit: `/api/admin/audit-events?supportSession=${encodeURIComponent(input.supportSessionId)}&source=admin&service=hanasand-api`,
        inviteAssistance: actions.has('invite_assist') && scope.has('invite:create')
            ? `/api/admin/support/organizations/${organizationId}/invites`
            : null,
        inviteResend: actions.has('invite_resend') && scope.has('invite:resend')
            ? `/api/admin/support/organizations/${organizationId}/invites/:inviteId/actions`
            : null,
        inviteRevoke: actions.has('invite_revoke') && scope.has('invite:revoke')
            ? `/api/admin/support/organizations/${organizationId}/invites/:inviteId/actions`
            : null,
        accessRecovery: actions.has('access_recovery') && scope.has('recovery:invite')
            ? `/api/admin/support/organizations/${organizationId}/access-recovery`
            : null,
        accessRecoveryApproval: actions.has('access_recovery') && (scope.has('recovery:approve') || scope.has('recovery:deny'))
            ? '/api/admin/support/access-recovery/:requestId/:decision'
            : null,
        memberRoleRecovery: actions.has('member_role_recovery') && scope.has('member:role_recovery')
            ? `/api/admin/support/organizations/${organizationId}/members/${targetUserId}/role-recovery`
            : null,
        impersonation: actions.has('impersonation')
            ? '/api/impersonation/start'
            : null,
    }
}

function supportSessionAuthorizationProof(input: {
    actorId: string
    supportSessionId: string
    state: {
        actorId: string
        organizationId?: string | null
        targetUserId?: string | null
        allowedActions?: string[]
        scope?: string[]
        status?: string
        reason?: string
        requestId?: string
        expiresAt?: string
        auditEventIds?: number[]
    }
    workflowRoutes: Record<string, unknown>
}) {
    const status = text(input.state.status) || 'unknown'
    const blockers = [
        status === 'active' ? '' : status === 'revoked' ? 'support_session_revoked' : 'support_session_expired',
        input.actorId === input.state.actorId ? '' : 'support_session_actor_mismatch',
        input.state.reason ? '' : 'missing_support_reason',
        input.state.expiresAt ? '' : 'missing_expiry',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.scoped_session.authorization_proof.v1',
        supportRoleRequired: true,
        supportSessionId: input.supportSessionId,
        actor: {
            id: input.actorId,
            sessionActorId: input.state.actorId,
            matchesSessionActor: input.actorId === input.state.actorId,
        },
        target: {
            organizationId: input.state.organizationId || null,
            userId: input.state.targetUserId || null,
        },
        allowedActions: input.state.allowedActions || [],
        scope: input.state.scope || [],
        status,
        expiresAt: input.state.expiresAt || null,
        requestId: input.state.requestId || null,
        reasonPresent: Boolean(input.state.reason),
        guardrails: {
            noCrossOrgLeakage: true,
            noSilentImpersonation: true,
            noSilentMembershipMutation: true,
            reasonRequired: true,
            scopeRequired: true,
            durationOrExpiryRequired: true,
            redactionRequired: true,
        },
        blockers,
        workflowRoutes: input.workflowRoutes,
        audit: {
            eventIds: input.state.auditEventIds || [],
            timeline: auditFilterQuery({
                supportSession: input.supportSessionId,
                entity: input.supportSessionId,
                request: input.state.requestId || '',
                source: 'admin',
                service: 'hanasand-api',
            }),
        },
        redacted: true,
        copyText: [
            `Support session authorization ${input.supportSessionId}`,
            `Status: ${status}`,
            `Actor: ${input.actorId}`,
            `Target org: ${input.state.organizationId || '*'}`,
            `Target user: ${input.state.targetUserId || '*'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function normalizeSupportSessionActions(value: unknown): { value: string[], error: Record<string, unknown> | null } {
    const allowed = new Set(['invite_assist', 'invite_resend', 'invite_revoke', 'member_role_recovery', 'access_recovery', 'impersonation'])
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : ['invite_assist', 'invite_resend', 'invite_revoke', 'member_role_recovery']
    const actions = Array.from(new Set(raw.map(item => text(item).toLowerCase()).filter(Boolean)))
    const unsupported = actions.filter(action => !allowed.has(action))
    if (unsupported.length) {
        return { value: [], error: supportError('invalid_scope', `Unsupported support session action: ${unsupported[0]}.`, { supportedActions: Array.from(allowed) }) }
    }
    return { value: actions, error: null }
}

function normalizeSupportSessionScope(value: unknown): { value: string[], error: Record<string, unknown> | null } {
    const allowed = new Set(['invite:create', 'invite:resend', 'invite:revoke', 'member:role_recovery', 'recovery:invite', 'recovery:approve', 'recovery:deny', 'read_profile', 'read_org', 'support_debug'])
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : ['invite:create', 'invite:resend', 'invite:revoke', 'member:role_recovery']
    const scope = Array.from(new Set(raw.map(item => text(item).toLowerCase()).filter(Boolean)))
    const unsupported = scope.filter(item => !allowed.has(item))
    if (unsupported.length) {
        return { value: [], error: supportError('invalid_scope', `Unsupported support session scope: ${unsupported[0]}.`, { supportedScopes: Array.from(allowed) }) }
    }
    return { value: scope, error: null }
}

function normalizeSupportSessionDuration(value: unknown): { value: number, error: Record<string, unknown> | null } {
    if (value === undefined || value === null || value === '') return { value: 60, error: null }
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed !== Math.trunc(parsed) || parsed < 5 || parsed > 240) {
        return { value: 0, error: supportError('invalid_duration', 'Support session duration must be between 5 and 240 minutes.') }
    }
    return { value: parsed, error: null }
}

function normalizeSupportSessionExpiry(value: unknown, durationMinutes: number): { value: string, error: Record<string, unknown> | null } {
    if (value === undefined || value === null || value === '') {
        return { value: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(), error: null }
    }
    const timestamp = Date.parse(text(value))
    if (Number.isNaN(timestamp) || timestamp <= Date.now()) {
        return { value: '', error: supportError('invalid_expiry', 'Support session expiry must be a future timestamp.') }
    }
    if (timestamp > Date.now() + 240 * 60 * 1000) {
        return { value: '', error: supportError('invalid_expiry', 'Support session expiry must be within 240 minutes.') }
    }
    return { value: new Date(timestamp).toISOString(), error: null }
}

async function loadSupportInviteAssistByIdempotencyKey(input: { organizationId: string, idempotencyKey: string }) {
    const result = await run(`
        SELECT id, request_id, entity_id, context
        FROM admin_audit_events
        WHERE action_type = 'support.organization.invite_assist'
          AND organization_id = $1
          AND outcome = 'success'
          AND context->>'idempotencyKey' = $2
        ORDER BY created_at ASC, id ASC
        LIMIT 1
    `, [input.organizationId, input.idempotencyKey])
    return result.rows[0] as { id: number, request_id: string, entity_id: string | null, context: Record<string, unknown> } | undefined
}

async function loadSupportInviteActionByIdempotencyKey(input: { organizationId: string, inviteId: string, actionType: string, idempotencyKey: string }) {
    const result = await run(`
        SELECT id, request_id, entity_id, context
        FROM admin_audit_events
        WHERE action_type = $1
          AND organization_id = $2
          AND entity_id = $3
          AND outcome = 'success'
          AND context->>'idempotencyKey' = $4
        ORDER BY created_at ASC, id ASC
        LIMIT 1
    `, [input.actionType, input.organizationId, input.inviteId, input.idempotencyKey])
    return result.rows[0] as { id: number, request_id: string, entity_id: string | null, context: Record<string, unknown> } | undefined
}

async function loadSupportMemberRoleRecoveryByIdempotencyKey(input: { organizationId: string, userId: string, idempotencyKey: string }) {
    const result = await run(`
        SELECT id, request_id, entity_id, context
        FROM admin_audit_events
        WHERE action_type = 'support.organization.member_role_recovery'
          AND organization_id = $1
          AND entity_id = $2
          AND outcome = 'success'
          AND context->>'idempotencyKey' = $3
        ORDER BY created_at ASC, id ASC
        LIMIT 1
    `, [input.organizationId, input.userId, input.idempotencyKey])
    return result.rows[0] as { id: number, request_id: string, entity_id: string | null, context: Record<string, unknown> } | undefined
}

async function loadOrganizationInvitesByIds(organizationId: string, inviteIds: string[]) {
    if (!inviteIds.length) return []
    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE organization_id = $1
          AND id = ANY($2::text[])
        ORDER BY created_at DESC
    `, [organizationId, inviteIds])
    return result.rows as OrganizationInviteRow[]
}

function auditContextInviteIds(context: Record<string, unknown>) {
    const direct = Array.isArray(context.inviteIds) ? context.inviteIds : []
    return direct.map(id => text(id)).filter(Boolean)
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

function buildSupportInspectionAuthorization(input: {
    actorId: string
    requestedOrg: string
    requestedUser: string
    effectiveOrg: string
    effectiveUser: string
    email: string
    request: string
    entity: string
    supportSession: string
    sessionState: Record<string, any> | null
    organizationIds: string[]
}) {
    const supportSessionScoped = Boolean(input.supportSession)
    const scopedOrg = input.sessionState?.organizationId ? text(input.sessionState.organizationId) : ''
    const scopedUser = input.sessionState?.targetUserId ? text(input.sessionState.targetUserId) : ''
    const supportSessionId = input.supportSession || input.sessionState?.supportSessionId || ''
    const targetOrgIds = uniqueTimelineValues([
        input.effectiveOrg,
        ...input.organizationIds,
    ])
    return {
        schemaVersion: 'support.inspection.authorization.v1',
        supportRoleRequired: true,
        supportSessionScoped,
        supportSessionId: supportSessionId || null,
        actor: {
            id: input.actorId,
            role: 'support',
        },
        requested: {
            organizationId: input.requestedOrg || null,
            userId: input.requestedUser || null,
            email: input.email || null,
            requestId: input.request || null,
            entityId: input.entity || null,
        },
        effective: {
            organizationIds: targetOrgIds,
            organizationId: input.effectiveOrg || targetOrgIds[0] || null,
            userId: input.effectiveUser || null,
            email: input.email || null,
            requestId: input.request || null,
            entityId: input.entity || null,
        },
        scoped: input.sessionState ? {
            organizationId: scopedOrg || null,
            userId: scopedUser || null,
            allowedActions: Array.isArray(input.sessionState.allowedActions) ? input.sessionState.allowedActions : [],
            scope: Array.isArray(input.sessionState.scope) ? input.sessionState.scope : [],
            status: text(input.sessionState.status) || null,
            expiresAt: text(input.sessionState.expiresAt) || null,
            reasonPresent: Boolean(text(input.sessionState.reason)),
            auditEventIds: Array.isArray(input.sessionState.auditEventIds) ? input.sessionState.auditEventIds : [],
        } : null,
        guardrails: {
            noCrossOrgLeakage: true,
            noMutation: true,
            noSecretsReturned: true,
            reasonRequiredForActions: true,
            scopeRequiredForActions: true,
            durationRequiredForScopedSessions: true,
        },
        blockers: [
            supportSessionScoped && !input.sessionState ? 'support_session_not_found' : '',
            input.sessionState && text(input.sessionState.status) !== 'active' ? `support_session_${text(input.sessionState.status)}` : '',
        ].filter(Boolean),
        audit: {
            timeline: auditTimelineLink({
                org: input.effectiveOrg || targetOrgIds[0],
                target: input.effectiveUser || input.email,
                request: input.request,
                action: 'support.inspect',
            }),
            supportSession: supportSessionId ? auditTimelineLink({
                request: input.request,
                action: 'support.session',
            }) : null,
        },
        redacted: true,
        copyText: [
            `Support authorization: ${supportSessionScoped ? 'scoped session' : 'support role'}`,
            `Target org: ${input.effectiveOrg || targetOrgIds[0] || '*'}`,
            `Target user: ${input.effectiveUser || input.email || '*'}`,
            `Session: ${supportSessionId || 'none'}`,
        ].join('\n'),
    }
}

function buildSupportAccessStatus(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    recoveryEligibility: Array<Record<string, any>>
    availabilityByOrg: Map<string, SupportOrganizationAvailability>
    timeline: Array<Record<string, any>>
}) {
    const activeMemberships = input.memberships.filter(row => row.status === 'active')
    const removedMemberships = input.memberships.filter(row => row.status === 'removed')
    const inactiveMemberships = input.memberships.filter(row => row.status !== 'active')
    const pendingInvites = input.invites.filter(row => row.status === 'pending')
    const revokedInvites = input.invites.filter(row => row.status === 'revoked')
    const expiredInvites = input.invites.filter(row => row.expires_at && Date.parse(String(row.expires_at)) <= Date.now())
    const activeUsers = input.users.filter(row => row.active !== false && !row.deactivated_at && !row.deletion_scheduled_at)
    const blockedUsers = input.users.filter(row => row.active === false || row.deactivated_at || row.deletion_scheduled_at)
    const adminAvailable = input.organizationIds.some(id => input.availabilityByOrg.get(id)?.hasAvailableAdmin === true)
    const recoveryRecommended = input.recoveryEligibility.some(item => item.recommended === true)
    const openRecoveryRequests = input.approvalDetails.filter(item => ['pending', 'approved'].includes(String(item.status || '')))
    const overall = activeMemberships.length && activeUsers.length
        ? 'active_access'
        : pendingInvites.length
            ? 'invite_pending'
            : recoveryRecommended || removedMemberships.length || blockedUsers.length
                ? 'recovery_recommended'
                : 'access_unknown'
    const blockers = uniqueTimelineValues([
        input.organizationIds.length ? '' : 'missing_org_target',
        input.user || input.email ? '' : 'missing_user_or_email',
        adminAvailable ? 'active_admin_available' : '',
        blockedUsers.length ? 'user_deactivated' : '',
        removedMemberships.length ? 'member_removed' : '',
        expiredInvites.length ? 'invite_expired' : '',
        revokedInvites.length ? 'invite_revoked' : '',
    ])
    return {
        schemaVersion: 'support.access_status.v1',
        overall,
        generatedAt: new Date().toISOString(),
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        counts: {
            activeMemberships: activeMemberships.length,
            inactiveMemberships: inactiveMemberships.length,
            removedMemberships: removedMemberships.length,
            pendingInvites: pendingInvites.length,
            revokedInvites: revokedInvites.length,
            expiredInvites: expiredInvites.length,
            openRecoveryRequests: openRecoveryRequests.length,
            relatedAuditEvents: input.timeline.length,
        },
        adminAvailability: input.organizationIds.map(id => input.availabilityByOrg.get(id) || {
            organizationId: id,
            ownerCount: 0,
            activeOwnerCount: 0,
            adminCount: 0,
            activeAdminCount: 0,
            hasAvailableOwner: false,
            hasAvailableAdmin: false,
        }),
        recovery: {
            recommended: recoveryRecommended,
            eligibility: input.recoveryEligibility,
            openRequests: openRecoveryRequests.map(item => ({
                requestId: item.requestId,
                status: item.status,
                outcome: item.outcome,
                approvalRequired: item.approvalRequired,
                auditEventIds: item.auditEventIds || [],
            })),
        },
        audit: {
            eventIds: input.timeline.map(event => event.id),
            links: {
                timeline: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request }),
                inviteAssistance: auditTimelineLink({ org: input.org, target: input.email, request: input.request, action: 'invite_assist' }),
                accessRecovery: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
            },
            redacted: true,
        },
        blockers,
        noMutation: true,
        copyText: [
            `Access status: ${overall}`,
            `Active memberships: ${activeMemberships.length}`,
            `Pending invites: ${pendingInvites.length}`,
            `Open recovery requests: ${openRecoveryRequests.length}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function buildSupportAccessRecoveryPlan(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    recoveryEligibility: Array<Record<string, any>>
    availabilityByOrg: Map<string, SupportOrganizationAvailability>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const planItems = input.organizationIds.map((organizationId) => {
        const availability = input.availabilityByOrg.get(organizationId) || {
            organizationId,
            ownerCount: 0,
            activeOwnerCount: 0,
            adminCount: 0,
            activeAdminCount: 0,
            hasAvailableOwner: false,
            hasAvailableAdmin: false,
        }
        const memberships = input.memberships.filter(row => row.organization_id === organizationId)
        const activeMembers = memberships.filter(row => row.status === 'active')
        const removedMembers = memberships.filter(row => row.status === 'removed')
        const targetMembership = memberships.find(row => !input.user || row.user_id === input.user)
        const invites = input.invites.filter(row => row.organization_id === organizationId)
        const pendingInvites = invites.filter(row => row.status === 'pending')
        const revokedInvites = invites.filter(row => row.status === 'revoked')
        const expiredInvites = invites.filter(row => row.status === 'expired')
        const approvals = input.approvalDetails.filter(approval => approval.organizationId === organizationId)
        const openApprovals = approvals.filter(approval => ['pending', 'not_required'].includes(String(approval.status || '')))
        const eligibility = input.recoveryEligibility.find(item => item.organizationId === organizationId) || null
        const noAvailableAdmin = !availability.hasAvailableAdmin
        const targetRemoved = Boolean(targetMembership && targetMembership.status === 'removed')
        const targetEmailMissing = !input.email && !input.user
        const inviteAssistAvailable = Boolean(input.email && pendingInvites.length)
        const controlledInviteAvailable = Boolean(input.email && eligibility?.canCreateControlledInvite)
        const roleCorrectionAvailable = Boolean(input.user && targetMembership && targetMembership.status !== 'active')
        const recommendedActions = uniqueTimelineValues([
            inviteAssistAvailable ? 'resend_pending_invite' : '',
            revokedInvites.length || expiredInvites.length ? 'review_invite_recovery' : '',
            controlledInviteAvailable && (noAvailableAdmin || targetRemoved || !pendingInvites.length) ? 'create_controlled_recovery_invite' : '',
            roleCorrectionAvailable ? 'member_role_recovery' : '',
            noAvailableAdmin ? 'access_recovery_approval' : '',
        ])
        const blockers = uniqueTimelineValues([
            targetEmailMissing ? 'missing_user_or_email' : '',
            noAvailableAdmin ? '' : 'active_admin_available',
            controlledInviteAvailable ? '' : 'recovery_unavailable',
            input.organizationIds.length > 1 && !input.org ? 'ambiguous_org_target' : '',
        ])
        return {
            schemaVersion: 'support.access_recovery.plan_item.v1',
            organizationId,
            targetUserId: input.user || null,
            targetEmail: input.email || null,
            adminAvailability: availability,
            memberState: {
                activeMemberCount: activeMembers.length,
                removedMemberCount: removedMembers.length,
                targetMembership: targetMembership ? toSupportMemberDetail(targetMembership) : null,
            },
            inviteState: {
                pending: pendingInvites.map(toSupportInvite),
                revoked: revokedInvites.map(toSupportInvite),
                expired: expiredInvites.map(toSupportInvite),
            },
            approvalState: {
                openRequests: openApprovals.map(approval => ({
                    requestId: approval.requestId,
                    status: approval.status,
                    outcome: approval.outcome,
                    approvalRequired: approval.approvalRequired,
                    auditEventIds: approval.auditEventIds || [],
                })),
                allRequestIds: approvals.map(approval => approval.requestId).filter(Boolean),
            },
            recommendedActions,
            guardedOperations: {
                inviteResend: {
                    available: inviteAssistAvailable,
                    route: pendingInvites[0]?.id ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(String(pendingInvites[0].id))}/actions` : null,
                    required: ['reason', 'context', 'scope', 'idempotencyKey'],
                },
                inviteRevoke: {
                    available: Boolean(pendingInvites.length),
                    route: pendingInvites[0]?.id ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(String(pendingInvites[0].id))}/actions` : null,
                    required: ['reason', 'context', 'scope', 'idempotencyKey'],
                },
                controlledRecoveryInvite: {
                    available: controlledInviteAvailable,
                    route: `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery`,
                    required: ['reason', 'context', 'expiresAt', 'requestId'],
                },
                memberRoleRecovery: {
                    available: roleCorrectionAvailable,
                    route: input.user ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(input.user)}/role-recovery` : null,
                    required: ['reason', 'context', 'role', 'requestId'],
                },
            },
            blockers,
            audit: {
                eventIds: input.timeline
                    .filter(event => event.organization?.id === organizationId || event.organizationId === organizationId)
                    .map(event => event.id)
                    .filter((id): id is number => Number.isFinite(id)),
                links: {
                    timeline: auditTimelineLink({ org: organizationId, target: input.user || input.email, request: input.request }),
                    inviteAssistance: auditTimelineLink({ org: organizationId, target: input.email, request: input.request, action: 'invite' }),
                    accessRecovery: auditTimelineLink({ org: organizationId, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
                    memberRoleRecovery: auditTimelineLink({ org: organizationId, target: input.user, request: input.request, action: 'member_role_recovery' }),
                },
                redacted: true,
            },
        }
    })
    const blockers = uniqueTimelineValues([
        input.organizationIds.length ? '' : 'missing_org_target',
        input.user || input.email ? '' : 'missing_user_or_email',
        input.organizationIds.length > 1 && !input.org ? 'ambiguous_org_target' : '',
        ...planItems.flatMap(item => item.blockers),
    ])
    return {
        schemaVersion: 'support.access_recovery.plan.v1',
        generatedAt: new Date().toISOString(),
        noMutation: true,
        supportRoleRequired: true,
        reasonRequiredForActions: true,
        contextRequiredForActions: true,
        scopedActionRequired: true,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        filters: input.timelineFilter,
        items: planItems,
        audit: {
            eventIds: input.timeline.map(event => event.id),
            timeline: auditFilterQuery(input.timelineFilter),
            filterContract: supportAuditFilterContract(input.timelineFilter, input.timeline),
            redacted: true,
        },
        blockers,
        copyText: [
            `Access recovery plan org=${input.org || input.organizationIds.join(',') || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Organizations: ${planItems.length}`,
            `Recommended actions: ${uniqueTimelineValues(planItems.flatMap(item => item.recommendedActions)).join(', ') || 'none'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
            `Audit replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}

function buildSupportCaseSummary(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    organizations: Record<string, unknown>[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    recoveryEligibility: Array<Record<string, unknown>>
    accessStatus: Record<string, any>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const pendingInvites = input.invites.filter(row => row.status === 'pending')
    const activeMemberships = input.memberships.filter(row => row.status === 'active')
    const removedMemberships = input.memberships.filter(row => row.status === 'removed')
    const recoveryRequests = input.approvalDetails.map(approval => ({
        requestId: approval.requestId,
        organizationId: approval.organizationId,
        inviteId: approval.inviteId,
        targetUserId: approval.targetUserId,
        status: approval.status,
        outcome: approval.outcome,
        approvalRequired: approval.approvalRequired,
        auditEventIds: approval.auditEventIds || [],
        audit: approval.audit,
    }))
    const impersonationEvents = input.timeline
        .filter(event => String(event.action || '').startsWith('impersonation.'))
        .map(event => ({
            id: event.id,
            action: event.action,
            outcome: event.outcome,
            severity: event.severity,
            requestId: event.requestId,
            targetUserId: event.target?.id || event.entityId,
            durationMinutes: event.context?.durationMinutes ?? null,
            scope: event.context?.scope ?? null,
            expiresAt: event.context?.expiresAt ?? null,
            createdAt: event.createdAt,
            audit: auditTimelineLink({
                request: event.requestId,
                action: event.action,
                outcome: event.outcome,
            }),
        }))
    const target = {
        organizationIds: input.organizationIds,
        userId: input.user || null,
        email: input.email || null,
        requestId: input.request || null,
    }
    const blockers = [
        input.organizationIds.length ? '' : 'organization_not_identified',
        input.user || input.email ? '' : 'user_or_email_not_identified',
        input.timeline.length ? '' : 'no_timeline_events_matched',
    ].filter(Boolean)
    const nextActions = {
        inspectAuditTimeline: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request }),
        impersonationTimeline: auditTimelineLink({ target: input.user, request: input.request, action: 'impersonation' }),
        inviteAssist: {
            available: Boolean(input.organizationIds.length && input.email),
            reasonRequired: true,
            scopeRequired: true,
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
        },
        accessRecovery: {
            available: Boolean(input.organizationIds.length && (input.email || input.user)),
            reasonRequired: true,
            expiryRequired: true,
            approvalState: recoveryRequests[0]?.status || 'not_requested',
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
        },
        impersonationRequest: {
            available: Boolean(input.user),
            reasonRequired: true,
            scopeRequired: true,
            durationRequired: true,
            approvalState: 'not_required',
            endpoint: '/api/impersonation/start',
        },
    }

    return {
        schemaVersion: 'support.case_summary.v1',
        target,
        state: {
            organizations: input.organizations.map(row => toOrganization(row as OrganizationRow)),
            users: input.users.map(toSupportUser),
            activeMembershipCount: activeMemberships.length,
            removedMembershipCount: removedMemberships.length,
            pendingInviteCount: pendingInvites.length,
            recoveryRequestCount: recoveryRequests.length,
            impersonationEventCount: impersonationEvents.length,
            memberships: input.memberships.map(toSupportMemberDetail),
            pendingInvites: pendingInvites.map(toSupportInvite),
            recoveryRequests,
            impersonationRequests: impersonationEvents,
            accessStatus: input.accessStatus,
        },
        recoveryEligibility: input.recoveryEligibility,
        nextActions,
        audit: {
            eventIds: input.timeline.map(event => event.id),
            timelineQuery: nextActions.inspectAuditTimeline.api,
            impersonationTimelineQuery: nextActions.impersonationTimeline.api,
            filter: input.timelineFilter,
            redacted: true,
        },
        blockers,
        copyText: [
            `Support case summary org=${input.org || input.organizationIds.join(',') || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Memberships: active=${activeMemberships.length} removed=${removedMemberships.length}`,
            `Pending invites: ${pendingInvites.length}`,
            `Recovery requests: ${recoveryRequests.length}`,
            `Impersonation events: ${impersonationEvents.length}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function buildSupportWorkbench(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    recoveryEligibility: Array<Record<string, any>>
    caseSummary: Record<string, any>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
    preparationInput?: SupportActionPreparationInput | null
}) {
    const activeMemberships = input.memberships.filter(row => row.status === 'active')
    const inactiveMemberships = input.memberships.filter(row => row.status !== 'active')
    const pendingInvites = input.invites.filter(row => row.status === 'pending')
    const targetUser = input.users.find(row => row.id === input.user)
    const userInactive = Boolean(targetUser && (targetUser.active === false || targetUser.deactivated_at || targetUser.deletion_scheduled_at))
    const noAdminAvailable = input.recoveryEligibility.some(item => {
        const availability = item.adminAvailability as SupportOrganizationAvailability | undefined
        return availability && !availability.hasAvailableAdmin
    })
    const ambiguousTarget = input.organizationIds.length > 1 && !input.org
    const recoveryAvailable = input.recoveryEligibility.some(item => item.canCreateControlledInvite)
    const inviteAssistAvailable = Boolean(input.organizationIds.length && input.email)
    const impersonationEligible = Boolean(input.user && !userInactive)
    const blockers = uniqueTimelineValues([
        input.organizationIds.length ? '' : 'missing_org_target',
        input.user || input.email ? '' : 'missing_user_target',
        ambiguousTarget ? 'ambiguous_target' : '',
        inactiveMemberships.length ? 'inactive_member' : '',
        noAdminAvailable ? 'no_admin_available' : '',
        recoveryAvailable ? '' : 'recovery_unavailable',
        impersonationEligible ? '' : 'impersonation_ineligible',
        input.timelineFilter.unsupported.length ? 'audit_filter_unavailable' : '',
    ])
    const inviteAssistBlockers = uniqueTimelineValues([
        inviteAssistAvailable ? '' : 'missing_org_or_email',
        ambiguousTarget ? 'ambiguous_target' : '',
    ])
    const accessRecoveryBlockers = uniqueTimelineValues([
        recoveryAvailable ? '' : 'recovery_unavailable',
        ambiguousTarget ? 'ambiguous_target' : '',
        input.user || input.email ? '' : 'missing_user_target',
    ])
    const impersonationBlockers = uniqueTimelineValues([
        input.user ? '' : 'missing_user_target',
        userInactive ? 'inactive_user' : '',
    ])
    const actionPreparation = input.preparationInput
        ? buildSupportActionPreparation({
            input: input.preparationInput,
            organizationIds: input.organizationIds,
            user: input.user,
            email: input.email,
            request: input.request,
            inviteAssistBlockers,
            accessRecoveryBlockers,
            impersonationBlockers,
            noAdminAvailable,
            timeline: input.timeline,
        })
        : {
            schemaVersion: 'support.action_prepare.v1',
            requested: false,
            supportedActions: ['invite_assist', 'access_recovery', 'impersonation'],
            reasonRequired: true,
            contextRequired: true,
            scopeRequired: true,
            durationRequiredFor: ['impersonation'],
            expiryRelevantFor: ['invite_assist', 'access_recovery'],
        }
    const readinessProof = supportWorkbenchReadinessProof({
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        organizationIds: input.organizationIds,
        activeMembershipCount: activeMemberships.length,
        pendingInviteCount: pendingInvites.length,
        noAdminAvailable,
        inviteAssistAvailable,
        recoveryAvailable,
        impersonationEligible,
        timeline: input.timeline,
        timelineFilter: input.timelineFilter,
        blockers,
        inviteAssistBlockers,
        accessRecoveryBlockers,
        impersonationBlockers,
        actionPreparation,
    })

    return {
        schemaVersion: 'support.workbench.v1',
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            ambiguous: ambiguousTarget,
        },
        state: {
            activeMembershipCount: activeMemberships.length,
            inactiveMembershipCount: inactiveMemberships.length,
            pendingInviteCount: pendingInvites.length,
            recoveryRequestCount: input.caseSummary.state?.recoveryRequestCount || 0,
            impersonationEventCount: input.caseSummary.state?.impersonationEventCount || 0,
            userInactive,
            noAdminAvailable,
        },
        inviteAssistance: {
            available: inviteAssistAvailable && !ambiguousTarget,
            reasonRequired: true,
            contextRequired: true,
            scope: {
                organizationIds: input.organizationIds,
                email: input.email || null,
                inviteIds: input.invites.map(row => row.id).filter(Boolean),
            },
            blockers: inviteAssistBlockers,
            pendingInvites: pendingInvites.map(toSupportInvite),
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
            audit: auditTimelineLink({ org: input.org, target: input.email, request: input.request, action: 'invite_assist' }),
        },
        accessRecovery: {
            available: recoveryAvailable && !ambiguousTarget,
            reasonRequired: true,
            contextRequired: true,
            expiryRequired: true,
            approvalState: input.caseSummary.nextActions?.accessRecovery?.approvalState || 'not_requested',
            options: input.recoveryEligibility,
            blockers: accessRecoveryBlockers,
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
            audit: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
        },
        impersonationAssistance: {
            eligible: impersonationEligible,
            reasonRequired: true,
            contextRequired: true,
            scopeRequired: true,
            durationRequired: true,
            targetUserId: input.user || null,
            organizationIds: input.organizationIds,
            blockers: impersonationBlockers,
            endpoint: '/api/impersonation/start',
            audit: auditTimelineLink({ target: input.user, request: input.request, action: 'impersonation' }),
        },
        timelineProof: {
            schemaVersion: 'support.workbench.timeline_proof.v1',
            filter: input.timelineFilter,
            eventIds: input.timeline.map(event => event.id),
            inviteAssistance: auditTimelineLink({ org: input.org, target: input.email, request: input.request, action: 'invite_assist' }),
            accessRecovery: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
            impersonation: auditTimelineLink({ target: input.user, request: input.request, action: 'impersonation' }),
            redacted: true,
        },
        actionPreparation,
        readinessProof,
        blockers,
        copyText: [
            `Support workbench org=${input.org || input.organizationIds.join(',') || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Invite assist: ${inviteAssistAvailable && !ambiguousTarget ? 'available' : inviteAssistBlockers.join(',') || 'blocked'}`,
            `Access recovery: ${recoveryAvailable && !ambiguousTarget ? 'available' : accessRecoveryBlockers.join(',') || 'blocked'}`,
            `Impersonation: ${impersonationEligible ? 'eligible' : impersonationBlockers.join(',') || 'ineligible'}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function supportWorkbenchAdapter(input: {
    org: string
    user: string
    email: string
    request: string
    workbench: Record<string, any>
    caseSummary: Record<string, any>
    accessStatus: Record<string, any>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const memberships = Array.isArray(input.caseSummary.state?.memberships) ? input.caseSummary.state.memberships : []
    const pendingInvites = Array.isArray(input.caseSummary.state?.pendingInvites) ? input.caseSummary.state.pendingInvites : []
    const recoveryRequests = Array.isArray(input.caseSummary.state?.recoveryRequests) ? input.caseSummary.state.recoveryRequests : []
    const rows = [
        ...memberships.map((member: Record<string, any>) => ({
            id: `member:${member.organizationId || input.org}:${member.userId || member.id || 'unknown'}`,
            type: 'member',
            label: member.userEmail || member.userName || member.userId || 'Organization member',
            organizationId: member.organizationId || input.org || null,
            targetUserId: member.userId || null,
            status: member.status || 'unknown',
            role: member.role || null,
            outcome: member.status === 'active' ? 'success' : 'denied',
            route: member.organizationId && member.userId ? `/api/admin/support/organizations/${encodeURIComponent(String(member.organizationId))}/members/${encodeURIComponent(String(member.userId))}` : null,
            actionRoute: member.organizationId && member.userId ? `/api/admin/support/organizations/${encodeURIComponent(String(member.organizationId))}/members/${encodeURIComponent(String(member.userId))}/role-recovery` : null,
        })),
        ...pendingInvites.map((invite: Record<string, any>) => ({
            id: `invite:${invite.organizationId || input.org}:${invite.id || invite.email || 'unknown'}`,
            type: 'invite',
            label: invite.email || invite.id || 'Pending invite',
            organizationId: invite.organizationId || input.org || null,
            targetUserId: null,
            status: invite.status || 'pending',
            role: invite.role || null,
            outcome: 'success',
            route: invite.organizationId && invite.id ? `/api/admin/support/organizations/${encodeURIComponent(String(invite.organizationId))}/invites/${encodeURIComponent(String(invite.id))}` : null,
            actionRoute: invite.organizationId && invite.id ? `/api/admin/support/organizations/${encodeURIComponent(String(invite.organizationId))}/invites/${encodeURIComponent(String(invite.id))}/actions` : null,
        })),
        ...recoveryRequests.map((request: Record<string, any>) => ({
            id: `recovery:${request.requestId || 'unknown'}`,
            type: 'access_recovery',
            label: request.requestId || request.inviteId || 'Access recovery request',
            organizationId: request.organizationId || input.org || null,
            targetUserId: request.targetUserId || null,
            status: request.status || 'unknown',
            role: null,
            outcome: request.outcome || 'success',
            route: request.requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(String(request.requestId))}` : null,
            actionRoute: request.requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(String(request.requestId))}/approve` : null,
        })),
    ].slice(0, 100)
    const selected = rows[0] || null
    const timelineRows = input.timeline.slice(0, 25).map(event => ({
        id: event.id,
        timestamp: event.createdAt || event.timestamp || null,
        actionType: event.action || event.actionType || null,
        severity: event.severity || null,
        outcome: event.outcome || null,
        requestId: event.requestId || null,
        entityId: event.entityId || event.entity?.id || null,
        reasonPresent: Boolean(event.reason),
        actionEvidence: event.actionEvidence || null,
        detail: event.links?.detail || null,
    }))

    return {
        schemaVersion: 'support.workbench.adapter.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        route: '/api/admin/support/inspect',
        query: {
            org: input.org || null,
            user: input.user || null,
            email: input.email || null,
            request: input.request || null,
            filters: input.timelineFilter,
        },
        list: {
            schemaVersion: 'support.workbench.list.v1',
            rows,
            rowCount: rows.length,
            searchableFields: ['type', 'label', 'organizationId', 'targetUserId', 'status', 'role', 'outcome', 'requestId'],
            emptyState: rows.length ? null : 'No members, invites, or recovery requests matched the support filters.',
        },
        selectedDetail: selected ? {
            schemaVersion: 'support.workbench.detail.v1',
            row: selected,
            accessStatus: input.accessStatus,
            requiredOperatorInputs: {
                reason: true,
                context: true,
                scope: ['invite:create', 'invite:resend', 'invite:revoke', 'recovery:invite', 'member:role_recovery', 'read_profile', 'read_org'],
                durationMinutesFor: ['impersonation'],
                expiresAtFor: ['invite_assistance', 'access_recovery'],
            },
            actions: {
                inspect: selected.route,
                execute: selected.actionRoute,
                audit: auditFilterQuery({
                    org: selected.organizationId || input.org,
                    target: selected.targetUserId || input.user || input.email,
                    entity: selected.type === 'access_recovery' ? input.request : selected.id,
                    request: input.request,
                    outcome: selected.outcome,
                    source: 'admin',
                    service: 'hanasand-api',
                }),
            },
        } : null,
        timeline: {
            schemaVersion: 'support.workbench.timeline_adapter.v1',
            rows: timelineRows,
            filter: input.timelineFilter,
            eventIds: timelineRows.map(row => row.id).filter((id): id is number => Number.isFinite(id)),
            actionEvidenceRollup: supportAuditActionEvidenceRollup(input.timeline),
            links: {
                replay: auditFilterQuery(input.timelineFilter),
                details: timelineRows.map(row => row.detail).filter(Boolean),
            },
        },
        backedActions: {
            inviteAssistance: input.workbench.inviteAssistance?.endpoints || [],
            inviteActions: rows.filter(row => row.type === 'invite').map(row => row.actionRoute).filter(Boolean),
            accessRecovery: input.workbench.accessRecovery?.endpoints || [],
            memberRoleRecovery: rows.filter(row => row.type === 'member').map(row => row.actionRoute).filter(Boolean),
            impersonation: input.workbench.impersonationAssistance?.endpoint || null,
        },
        readinessProof: {
            schemaVersion: 'support.workbench.adapter_readiness.v1',
            routeAvailable: true,
            supportRoleRequired: true,
            reasonRequiredForActions: true,
            auditFiltersAvailable: ['org', 'actor', 'target', 'action', 'severity', 'outcome', 'entity', 'request', 'time', 'reason', 'blocker'],
            noSilentMutation: true,
            redactionRequired: true,
            blockers: input.workbench.blockers || [],
            focusedCheck: 'cd api && bun run smoke:admin-support-unit',
        },
        copyText: [
            `Support workbench adapter org=${input.org || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Rows: ${rows.length}`,
            `Timeline events: ${timelineRows.length}`,
            `Selected: ${selected?.id || 'none'}`,
            `Audit replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}

function supportInspectionSearchProof(input: {
    q: string
    org: string
    user: string
    email: string
    request: string
    entity: string
    supportSession: string
    organizationIds: string[]
    organizations: Record<string, unknown>[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    approvalDetails: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const pendingInvites = input.invites.filter(row => text(row.status) === 'pending')
    const activeMemberships = input.memberships.filter(row => text(row.status) === 'active')
    const removedMemberships = input.memberships.filter(row => text(row.status) === 'removed')
    const auditQuery = auditFilterQuery({
        q: input.q,
        org: input.org,
        target: input.user || input.email,
        request: input.request,
        entity: input.entity || input.supportSession,
        supportSession: input.supportSession,
    })
    const blockers = [
        input.q || input.org || input.user || input.email || input.request || input.entity || input.supportSession ? '' : 'missing_search_target',
        input.organizationIds.length ? '' : 'organization_not_identified',
        input.timeline.length ? '' : 'audit_unavailable',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.inspection.search_proof.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        query: {
            q: input.q || null,
            org: input.org || null,
            user: input.user || null,
            email: input.email || null,
            request: input.request || null,
            entity: input.entity || null,
            supportSession: input.supportSession || null,
        },
        resultCounts: {
            organizations: input.organizations.length,
            users: input.users.length,
            memberships: input.memberships.length,
            activeMemberships: activeMemberships.length,
            removedMemberships: removedMemberships.length,
            pendingInvites: pendingInvites.length,
            approvals: input.approvalDetails.length,
            auditEvents: input.timeline.length,
        },
        matchedIds: {
            organizationIds: input.organizationIds,
            userIds: uniqueTimelineValues(input.users.map(row => row.id)),
            memberUserIds: uniqueTimelineValues(input.memberships.map(row => row.user_id)),
            inviteIds: uniqueTimelineValues(input.invites.map(row => row.id)),
            requestIds: uniqueTimelineValues([
                ...input.approvalDetails.map(approval => approval.requestId),
                ...input.timeline.map(event => event.requestId),
            ]),
            auditEventIds: input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
        },
        availableActions: {
            inviteAssist: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
            inviteActions: input.invites.map(invite => `/api/admin/support/organizations/${encodeURIComponent(String(invite.organization_id))}/invites/${encodeURIComponent(String(invite.id))}/actions`),
            memberRoleRecovery: input.memberships.map(member => `/api/admin/support/organizations/${encodeURIComponent(String(member.organization_id))}/members/${encodeURIComponent(String(member.user_id))}/role-recovery`),
            accessRecovery: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
            supportSession: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
        },
        audit: {
            filter: input.timelineFilter,
            query: auditQuery,
            details: input.timeline.map(event => event.links?.detail).filter(Boolean),
            redactionRequired: true,
        },
        blockers,
        copyText: [
            `Support inspection search q=${input.q || '*'} org=${input.org || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Organizations: ${input.organizations.length}`,
            `Memberships: ${input.memberships.length}`,
            `Pending invites: ${pendingInvites.length}`,
            `Approvals: ${input.approvalDetails.length}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
            `Audit query: ${auditQuery}`,
        ].join('\n'),
    }
}

function supportInspectionAuthorizationMatrix(input: {
    authorization: Record<string, any>
    workbench: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    supportSession: string
    sessionState: Record<string, any> | null
    organizationIds: string[]
    user: string
    email: string
    request: string
    timelineFilter: SupportTimelineFilter
}) {
    const scoped = Boolean(input.supportSession)
    const sessionBlockers = Array.isArray(input.authorization.blockers) ? input.authorization.blockers : []
    const planBlockers = Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []
    const actions = {
        inspect: {
            allowed: true,
            requiredInputs: ['org|user|email|request|entity|supportSession'],
            blockers: sessionBlockers,
            auditAction: 'support.inspect',
        },
        inviteAssist: {
            allowed: Boolean(input.workbench.inviteAssistance?.available) && !sessionBlockers.length,
            requiredInputs: ['reason', 'context', 'scope', 'idempotencyKey'],
            blockers: uniqueTimelineValues([...(input.workbench.inviteAssistance?.blockers || []), ...sessionBlockers]),
            auditAction: 'support.organization.invite_assist',
        },
        accessRecovery: {
            allowed: Boolean(input.workbench.accessRecovery?.available) && !sessionBlockers.length,
            requiredInputs: ['reason', 'context', 'expiresAt', 'requestId'],
            blockers: uniqueTimelineValues([...(input.workbench.accessRecovery?.blockers || []), ...planBlockers, ...sessionBlockers]),
            auditAction: 'support.organization.access_recovery',
        },
        memberRoleRecovery: {
            allowed: Boolean(input.accessRecoveryPlan.items?.some((item: Record<string, any>) => item.guardedOperations?.memberRoleRecovery?.available)) && !sessionBlockers.length,
            requiredInputs: ['reason', 'context', 'role', 'requestId'],
            blockers: uniqueTimelineValues([...planBlockers, ...sessionBlockers]),
            auditAction: 'support.organization.member_role_recovery',
        },
        impersonation: {
            allowed: Boolean(input.workbench.impersonationAssistance?.eligible) && !sessionBlockers.length,
            requiredInputs: ['reason', 'context', 'scope', 'durationMinutes', 'targetUserId', 'organizationId'],
            blockers: uniqueTimelineValues([...(input.workbench.impersonationAssistance?.blockers || []), ...sessionBlockers]),
            auditAction: 'impersonation.start',
        },
    }
    return {
        schemaVersion: 'support.inspection.authorization_matrix.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        supportSessionScoped: scoped,
        supportSessionId: input.supportSession || null,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        scopedSession: input.sessionState ? {
            status: input.sessionState.status || null,
            allowedActions: Array.isArray(input.sessionState.allowedActions) ? input.sessionState.allowedActions : [],
            scope: Array.isArray(input.sessionState.scope) ? input.sessionState.scope : [],
            expiresAt: input.sessionState.expiresAt || null,
            reasonPresent: Boolean(text(input.sessionState.reason)),
        } : null,
        actions,
        audit: {
            filter: input.timelineFilter,
            matrixReplay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            supportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }) : null,
        },
        guardrails: {
            noCrossOrgLeakage: true,
            reasonRequiredForActions: true,
            contextRequiredForActions: true,
            scopeRequiredForActions: true,
            noSilentMembershipMutation: true,
            redactionRequired: true,
        },
        blockers: uniqueTimelineValues([
            ...sessionBlockers,
            ...Object.values(actions).flatMap(action => action.blockers),
        ]),
        copyText: [
            `Support authorization matrix user=${input.user || '*'} email=${input.email || '*'} org=${input.organizationIds.join(',') || '*'}`,
            `Scoped session: ${input.supportSession || 'none'}`,
            `Invite/recovery/member/impersonation: ${actions.inviteAssist.allowed}/${actions.accessRecovery.allowed}/${actions.memberRoleRecovery.allowed}/${actions.impersonation.allowed}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}

function supportInspectionAuditDetailPacket(input: {
    org: string
    user: string
    email: string
    request: string
    supportSession: string
    organizationIds: string[]
    memberships: Array<Record<string, any>>
    invites: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const detailEvents = input.timeline.slice(0, 25).map(event => ({
        id: event.id || null,
        detailRoute: event.id ? `/api/admin/audit-events/${encodeURIComponent(String(event.id))}` : null,
        actionType: event.actionType || null,
        outcome: event.outcome || null,
        severity: event.severity || null,
        requestId: event.requestId || null,
        organizationId: event.organizationId || null,
        targetId: event.targetId || null,
        entityId: event.entityId || null,
        createdAt: event.createdAt || null,
        reasonPresent: Boolean(text(event.reason)),
        links: event.links || {},
    }))
    const memberEntityIds = uniqueTimelineValues(input.memberships.map(member => member.id || member.user_id))
    const inviteEntityIds = uniqueTimelineValues(input.invites.map(invite => invite.id))
    const targetUserIds = uniqueTimelineValues([
        input.user,
        ...input.memberships.map(member => member.user_id),
        ...input.invites.map(invite => invite.user_id),
    ])
    const requestIds = uniqueTimelineValues([
        input.request,
        ...input.timeline.map(event => event.requestId),
    ])
    return {
        schemaVersion: 'support.inspection.audit_detail_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        detailEvents,
        detailRoutes: detailEvents.map(event => event.detailRoute).filter(Boolean),
        replayFilters: {
            current: auditFilterQuery(input.timelineFilter),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            request: requestIds.map(requestId => auditFilterQuery({ request: requestId })),
            organization: input.organizationIds.map(organizationId => auditFilterQuery({ org: organizationId })),
            user: targetUserIds.map(userId => auditFilterQuery({ target: userId })),
            member: memberEntityIds.map(entityId => auditFilterQuery({ entity: entityId, entityType: 'member' })),
            invite: inviteEntityIds.map(entityId => auditFilterQuery({ entity: entityId, entityType: 'invite' })),
            supportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession }) : null,
        },
        supportActionRequirements: {
            inviteAssistance: ['reason', 'context', 'scope', 'expiresAt', 'idempotencyKey'],
            accessRecovery: ['reason', 'context', 'scope', 'expiresAt', 'requestId'],
            memberRoleRecovery: ['reason', 'context', 'scope', 'role', 'requestId'],
            impersonation: ['reason', 'context', 'scope', 'durationMinutes', 'targetUserId', 'organizationId'],
        },
        guardrails: {
            supportRoleRequired: true,
            noCrossOrgLeakage: true,
            reasonRequiredForSensitiveActions: true,
            detailRetrievalRequiresSupport: true,
            redactionRequired: true,
        },
        blockers: uniqueTimelineValues([
            detailEvents.length ? '' : 'missing_audit_events',
            input.organizationIds.length || input.supportSession ? '' : 'missing_org_or_support_session_scope',
            ...detailEvents.map(event => event.reasonPresent ? '' : 'missing_reason_on_source_event'),
        ]),
        copyText: [
            `Support inspection audit details org=${input.organizationIds.join(',') || '*'} user=${input.user || '*'} request=${input.request || '*'}`,
            `Detail routes: ${detailEvents.map(event => event.detailRoute).filter(Boolean).join(', ') || 'none'}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
            `Redacted: true`,
        ].join('\n'),
    }
}

function supportInspectionOrgBoundaryProof(input: {
    requestedOrg: string
    requestedUser: string
    email: string
    request: string
    supportSession: string
    sessionState: Record<string, any> | null
    authorization: Record<string, any>
    organizationIds: string[]
    memberships: Array<Record<string, any>>
    invites: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const membershipOrgIds = uniqueTimelineValues(input.memberships.map(member => member.organization_id || member.organizationId))
    const inviteOrgIds = uniqueTimelineValues(input.invites.map(invite => invite.organization_id || invite.organizationId))
    const timelineOrgIds = uniqueTimelineValues(input.timeline.map(event => event.organizationId || event.organization?.id))
    const matchedOrgIds = uniqueTimelineValues([
        ...input.organizationIds,
        ...membershipOrgIds,
        ...inviteOrgIds,
        ...timelineOrgIds,
    ])
    const scopedOrg = text(input.sessionState?.organizationId)
    const scopedUser = text(input.sessionState?.targetUserId)
    const crossOrgMatches = input.requestedOrg
        ? matchedOrgIds.filter(orgId => orgId !== input.requestedOrg)
        : []
    const sessionOrgMismatch = Boolean(scopedOrg && input.requestedOrg && scopedOrg !== input.requestedOrg)
    const sessionUserMismatch = Boolean(scopedUser && input.requestedUser && scopedUser !== input.requestedUser)
    const blockers = uniqueTimelineValues([
        matchedOrgIds.length ? '' : 'missing_org_match',
        input.requestedOrg || input.supportSession ? '' : 'missing_org_or_support_session_scope',
        crossOrgMatches.length ? 'cross_org_match_requires_explicit_scope' : '',
        sessionOrgMismatch ? 'support_session_org_mismatch' : '',
        sessionUserMismatch ? 'support_session_user_mismatch' : '',
        ...(Array.isArray(input.authorization.blockers) ? input.authorization.blockers : []),
    ])
    return {
        schemaVersion: 'support.inspection.org_boundary_proof.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        requested: {
            organizationId: input.requestedOrg || null,
            userId: input.requestedUser || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        matched: {
            organizationIds: matchedOrgIds,
            membershipOrgIds,
            inviteOrgIds,
            timelineOrgIds,
            crossOrgMatches,
        },
        scopedSession: input.sessionState ? {
            organizationId: scopedOrg || null,
            targetUserId: scopedUser || null,
            allowedActions: Array.isArray(input.sessionState.allowedActions) ? input.sessionState.allowedActions : [],
            status: input.sessionState.status || null,
            expiresAt: input.sessionState.expiresAt || null,
            reasonPresent: Boolean(text(input.sessionState.reason)),
            orgMismatch: sessionOrgMismatch,
            userMismatch: sessionUserMismatch,
        } : null,
        authorization: {
            supportRoleRequired: true,
            supportSessionScoped: Boolean(input.supportSession),
            effectiveOrgIds: input.authorization.effective?.organizationIds || input.organizationIds,
            effectiveUserId: input.authorization.effective?.userId || input.requestedUser || null,
            blockers,
        },
        audit: {
            filter: input.timelineFilter,
            replay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            orgReplays: matchedOrgIds.map(orgId => auditFilterQuery({ org: orgId })),
            supportSessionReplay: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession }) : null,
            detailRoutes: input.timeline.map(event => event.links?.detail).filter(Boolean),
            eventIds: input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
        },
        guardrails: {
            noCrossOrgLeakage: true,
            explicitOrgScopeRequired: true,
            supportSessionScopeEnforced: true,
            deniedAccessIsAuditable: true,
            redactionRequired: true,
        },
        blockers,
        copyText: [
            `Support org boundary requested=${input.requestedOrg || '*'} matched=${matchedOrgIds.join(',') || 'none'}`,
            `Cross-org matches: ${crossOrgMatches.join(',') || 'none'}`,
            `Session mismatch: org=${sessionOrgMismatch} user=${sessionUserMismatch}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}

function supportInspectionRecoveryFixturePacket(input: {
    org: string
    user: string
    email: string
    request: string
    supportSession: string
    accessRecoveryPlan: Record<string, any>
    workbench: Record<string, any>
    timelineFilter: SupportTimelineFilter
}) {
    const requestId = input.request || 'support-request-id'
    const targetEmail = input.email || 'customer@example.com'
    const targetUserId = input.user || 'target-user-id'
    const reason = 'Verified customer access recovery request with scoped support approval.'
    const supportContext = 'Support case notes, requester verification, and operator identity.'
    const planItems = Array.isArray(input.accessRecoveryPlan.items) ? input.accessRecoveryPlan.items : []
    const fixtures = planItems.flatMap((item: Record<string, any>) => {
        const organizationId = text(item.organizationId || input.org) || 'organization-id'
        const operations = item.guardedOperations || {}
        const pendingInvite = item.inviteState?.pending?.[0] || null
        const inviteId = text(pendingInvite?.id) || 'invite-id'
        const baseBody = {
            reason,
            context: supportContext,
            requestId,
            supportSessionId: input.supportSession || undefined,
        }
        return [
            {
                name: 'invite_resend_prepare',
                method: 'POST',
                route: operations.inviteResend?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
                body: {
                    ...baseBody,
                    action: 'resend',
                    scope: 'invite:resend',
                    idempotencyKey: `support-${organizationId}-invite-resend`,
                },
                available: Boolean(operations.inviteResend?.available),
                expectedAuditAction: 'support.organization.invite_resend',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.invite_resend', request: requestId, entity: inviteId }),
            },
            {
                name: 'invite_revoke_prepare',
                method: 'POST',
                route: operations.inviteRevoke?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`,
                body: {
                    ...baseBody,
                    action: 'revoke',
                    scope: 'invite:revoke',
                    idempotencyKey: `support-${organizationId}-invite-revoke`,
                },
                available: Boolean(operations.inviteRevoke?.available),
                expectedAuditAction: 'support.organization.invite_revoke',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.invite_revoke', request: requestId, entity: inviteId }),
            },
            {
                name: 'controlled_recovery_invite_prepare',
                method: 'POST',
                route: operations.controlledRecoveryInvite?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery`,
                body: {
                    ...baseBody,
                    email: targetEmail,
                    role: 'admin',
                    scope: 'recovery:invite',
                    expiresAt: 'future ISO timestamp',
                },
                available: Boolean(operations.controlledRecoveryInvite?.available),
                expectedAuditAction: 'support.organization.access_recovery',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.access_recovery', request: requestId, target: targetEmail }),
            },
            {
                name: 'member_role_recovery_prepare',
                method: 'POST',
                route: operations.memberRoleRecovery?.route || `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(targetUserId)}/role-recovery`,
                body: {
                    ...baseBody,
                    role: 'admin',
                    scope: 'member:role_recovery',
                },
                available: Boolean(operations.memberRoleRecovery?.available),
                expectedAuditAction: 'support.organization.member_role_recovery',
                auditReplay: auditFilterQuery({ org: organizationId, action: 'support.organization.member_role_recovery', request: requestId, target: targetUserId }),
            },
        ]
    })
    const impersonationFixture = {
        name: 'impersonation_prepare',
        method: 'POST',
        route: '/api/impersonation/start',
        body: {
            reason,
            context: supportContext,
            requestId,
            targetUserId,
            organizationId: input.org || input.accessRecoveryPlan.target?.organizationIds?.[0] || 'organization-id',
            scope: ['read_profile', 'read_org'],
            durationMinutes: 30,
            supportSessionId: input.supportSession || undefined,
        },
        available: Boolean(input.workbench.impersonationAssistance?.eligible),
        expectedAuditAction: 'impersonation.start',
        auditReplay: auditFilterQuery({ action: 'impersonation.start', request: requestId, target: targetUserId }),
    }
    const allFixtures = [...fixtures, impersonationFixture]
    return {
        schemaVersion: 'support.inspection.recovery_fixture_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        purpose: 'support_workbench_recovery_and_impersonation_validation',
        target: {
            organizationIds: input.accessRecoveryPlan.target?.organizationIds || [],
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        requiredFields: ['reason', 'context', 'scope', 'requestId', 'idempotencyKey|durationMinutes|expiresAt'],
        fixtures: allFixtures,
        audit: {
            currentReplay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            expectedActions: uniqueTimelineValues(allFixtures.map(fixture => fixture.expectedAuditAction)),
            expectedRequestId: requestId,
        },
        blockers: uniqueTimelineValues([
            planItems.length ? '' : 'missing_access_recovery_plan_items',
            allFixtures.some(fixture => fixture.available) ? '' : 'no_available_support_recovery_action',
            ...(Array.isArray(input.accessRecoveryPlan.blockers) ? input.accessRecoveryPlan.blockers : []),
        ]),
        copyText: [
            `Support recovery fixtures request=${requestId} user=${input.user || '*'} email=${input.email || '*'}`,
            `Fixtures: ${allFixtures.map(fixture => fixture.name).join(', ')}`,
            `Expected actions: ${uniqueTimelineValues(allFixtures.map(fixture => fixture.expectedAuditAction)).join(', ')}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}

function supportInspectionAuditFilterCoverage(input: {
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    organizationIds: string[]
    user: string
    email: string
    request: string
    supportSession: string
}) {
    const filterEntries = Object.entries(input.timelineFilter)
        .filter(([key, value]) => key !== 'unsupported' && key !== 'limit' && value !== undefined && value !== null && value !== '')
        .map(([key, value]) => ({ key, value: String(value) }))
    const activeKeys = filterEntries.map(entry => entry.key)
    const targetBounded = Boolean(input.timelineFilter.org || input.timelineFilter.user || input.timelineFilter.email || input.timelineFilter.request || input.timelineFilter.entity || input.timelineFilter.supportSession)
    const detailRoutes = input.timeline.map(event => event.links?.detail).filter(Boolean)
    const eventIds = input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const actionValues = uniqueTimelineValues(input.timeline.map(event => event.action || event.actionType))
    const outcomeValues = uniqueTimelineValues(input.timeline.map(event => event.outcome))
    const severityValues = uniqueTimelineValues(input.timeline.map(event => event.severity))
    const entityIds = uniqueTimelineValues(input.timeline.map(event => event.entityId || event.entity?.id))
    const requestIds = uniqueTimelineValues([
        input.request,
        ...input.timeline.map(event => event.requestId),
    ])
    return {
        schemaVersion: 'support.inspection.audit_filter_coverage.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportedFilters: Array.from(supportInspectionFilters),
        activeFilters: filterEntries,
        activeKeys,
        unsupportedFilters: input.timelineFilter.unsupported,
        targetBounded,
        requiredForBoundedSearch: ['org|user|email|request|entity|supportSession'],
        resultCoverage: {
            eventCount: input.timeline.length,
            eventIds,
            actionValues,
            outcomeValues,
            severityValues,
            entityIds,
            requestIds,
            detailRoutes,
        },
        replay: {
            current: auditFilterQuery(input.timelineFilter),
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            success: auditFilterQuery({ ...input.timelineFilter, outcome: 'success' }),
            byRequest: requestIds.map(requestId => auditFilterQuery({ request: requestId })),
            byOrg: input.organizationIds.map(org => auditFilterQuery({ org })),
            byTarget: input.user || input.email ? auditFilterQuery({ target: input.user || input.email }) : null,
            bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession }) : null,
            byEntity: entityIds.map(entity => auditFilterQuery({ entity })),
            byActionOutcome: actionValues.flatMap(action => outcomeValues.map(outcome => auditFilterQuery({ action, outcome }))).slice(0, 25),
        },
        guardrails: {
            supportRoleRequired: true,
            detailRetrievalRequiresSupport: true,
            noOverbroadInspection: true,
            redactionRequired: true,
            unsupportedFiltersAreTyped: true,
        },
        blockers: uniqueTimelineValues([
            targetBounded ? '' : 'overbroad_support_inspection',
            input.timelineFilter.unsupported.length ? 'unsupported_audit_filter' : '',
            input.timeline.length ? '' : 'missing_audit_events',
            detailRoutes.length ? '' : 'missing_detail_routes',
        ]),
        copyText: [
            `Support audit filters active=${activeKeys.join(',') || 'none'} targetBounded=${targetBounded}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
            `Denied: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}

function supportWorkbenchReadinessProof(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    activeMembershipCount: number
    pendingInviteCount: number
    noAdminAvailable: boolean
    inviteAssistAvailable: boolean
    recoveryAvailable: boolean
    impersonationEligible: boolean
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
    blockers: string[]
    inviteAssistBlockers: string[]
    accessRecoveryBlockers: string[]
    impersonationBlockers: string[]
    actionPreparation: Record<string, any>
}) {
    const lastProof = input.timeline[0] || null
    return {
        schemaVersion: 'support.workbench.readiness_proof.v1',
        generatedAt: new Date().toISOString(),
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        supportActionsAvailable: {
            scopedSession: Boolean(input.organizationIds.length || input.user),
            inviteAssistance: input.inviteAssistAvailable && input.noAdminAvailable,
            inviteResendRevoke: input.pendingInviteCount > 0 && input.noAdminAvailable,
            memberRoleRecovery: input.activeMembershipCount > 0 && input.noAdminAvailable,
            accessRecovery: input.recoveryAvailable,
            impersonation: input.impersonationEligible,
        },
        requiredInputs: {
            reason: true,
            scope: true,
            expiryFor: ['inviteAssistance', 'inviteResend', 'accessRecovery'],
            durationFor: ['impersonation'],
            idempotencyKey: true,
        },
        auditFiltersAvailable: ['org', 'target', 'actor', 'action', 'outcome', 'request', 'entity', 'from', 'to', 'correlation', 'idempotency', 'supportSession', 'reason'],
        timelineFilter: input.timelineFilter,
        lastProof: lastProof ? {
            eventId: lastProof.id,
            action: lastProof.action,
            outcome: lastProof.outcome,
            severity: lastProof.severity,
            requestId: lastProof.requestId || null,
            organizationId: lastProof.organizationId || null,
            entityId: lastProof.entityId || null,
            createdAt: lastProof.createdAt || null,
        } : null,
        blockers: uniqueTimelineValues([
            ...input.blockers,
            ...input.inviteAssistBlockers,
            ...input.accessRecoveryBlockers,
            ...input.impersonationBlockers,
            input.noAdminAvailable ? '' : 'active_admin_available',
        ]),
        actionPreparation: {
            requested: Boolean(input.actionPreparation?.requested),
            action: input.actionPreparation?.action || null,
            outcome: input.actionPreparation?.outcome || null,
            requestId: input.actionPreparation?.requestId || null,
            correlationId: input.actionPreparation?.correlationId || null,
            idempotencyKey: input.actionPreparation?.idempotencyKey || null,
            blockers: input.actionPreparation?.blockers || [],
        },
        redacted: true,
    }
}

function buildSupportActionPreparation(input: {
    input: SupportActionPreparationInput
    organizationIds: string[]
    user: string
    email: string
    request: string
    inviteAssistBlockers: string[]
    accessRecoveryBlockers: string[]
    impersonationBlockers: string[]
    noAdminAvailable: boolean
    timeline: Array<Record<string, any>>
}) {
    const actionBlockers = input.input.action === 'invite_assist'
        ? input.inviteAssistBlockers
        : input.input.action === 'access_recovery'
            ? input.accessRecoveryBlockers
            : input.impersonationBlockers
    const blockers = uniqueTimelineValues([
        ...actionBlockers,
        input.input.scope.length ? '' : 'missing_scope',
        input.input.action === 'impersonation' && !input.input.durationMinutes ? 'invalid_duration' : '',
    ])
    const allowed = blockers.length === 0
    const actionType = input.input.action === 'impersonation'
        ? 'impersonation.start'
        : input.input.action === 'access_recovery'
            ? 'support.organization.access_recovery'
            : 'support.organization.invite_assist'
    const organizationId = input.organizationIds[0] || null
    const targetId = input.user || input.email || organizationId || null
    const requestId = input.request || 'generated-on-submit'
    const correlationId = requestId === 'generated-on-submit' ? input.input.idempotencyKey : requestId
    const handoffExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const executionHandoff = supportActionExecutionHandoff({
        action: input.input.action,
        allowed,
        organizationId,
        user: input.user,
        email: input.email,
        requestId,
        correlationId,
        idempotencyKey: input.input.idempotencyKey,
        reason: input.input.reason,
        context: input.input.context,
        scope: input.input.scope,
        supportSessionId: input.input.supportSessionId,
        durationMinutes: input.input.durationMinutes,
        expiresAt: input.input.expiresAt,
        handoffExpiresAt,
        noAdminAvailable: input.noAdminAvailable,
        blockers,
    })
    const executorReadiness = executionHandoff.executorReadiness

    return {
        schemaVersion: 'support.action_prepare.v1',
        requested: true,
        dryRun: true,
        action: input.input.action,
        allowed,
        outcome: allowed ? 'success' : 'denied',
        requestId,
        correlationId,
        idempotencyKey: input.input.idempotencyKey,
        handoffExpiresAt,
        target: {
            organizationId,
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
        },
        reason: input.input.reason,
        context: input.input.context,
        scope: input.input.scope,
        durationMinutes: input.input.durationMinutes,
        expiresAt: input.input.expiresAt,
        blockers,
        executionHandoff,
        executorReadiness,
        auditPreview: {
            actionType,
            source: 'admin',
            service: 'hanasand-api',
            severity: input.input.action === 'impersonation' || input.input.action === 'access_recovery' ? 'warning' : 'notice',
            outcome: allowed ? 'success' : 'denied',
            targetType: input.input.action === 'impersonation' ? 'user' : input.input.action === 'access_recovery' ? 'invite' : 'organization',
            targetId,
            organizationId,
            entityId: targetId,
            requestId,
            reason: input.input.reason,
            context: redactAuditValue({
                schemaVersion: 'support.action_prepare.audit_preview.v1',
                action: input.input.action,
                dryRun: true,
                correlationId,
                idempotencyKey: input.input.idempotencyKey,
                supportSessionId: input.input.supportSessionId || null,
                handoffExpiresAt,
                execution: executionHandoff.execution,
                targetUserId: input.user || null,
                email: input.email || null,
                organizationIds: input.organizationIds,
                scope: input.input.scope,
                durationMinutes: input.input.durationMinutes,
                expiresAt: input.input.expiresAt,
                blockers,
                blockerCode: blockers[0] || null,
                timelineEventIds: input.timeline.map(event => event.id),
            }),
        },
        audit: auditTimelineLink({
            org: organizationId,
            target: input.user || input.email,
            request: input.request,
            action: input.input.action === 'impersonation' ? 'impersonation' : input.input.action,
            outcome: allowed ? 'success' : 'denied',
        }),
        copyText: [
            `Support action prepare ${input.input.action}`,
            `Target org=${organizationId || '*'} user=${input.user || '*'} email=${input.email || '*'}`,
            `Outcome: ${allowed ? 'allowed' : `blocked:${blockers.join(',')}`}`,
            `Request: ${requestId}`,
            `Reason: ${input.input.reason}`,
        ].join('\n'),
    }
}

function supportActionExecutionHandoff(input: {
    action: SupportActionPreparationInput['action']
    allowed: boolean
    organizationId: string | null
    user: string
    email: string
    requestId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    durationMinutes: number | null
    expiresAt: string | null
    handoffExpiresAt: string
    noAdminAvailable: boolean
    blockers: string[]
}) {
    const execution = supportActionExecutionTarget(input)
    const executorReadiness = supportActionExecutorReadiness({
        ...input,
        execution,
    })
    return {
        schemaVersion: 'support.action_execution_handoff.v1',
        immutable: true,
        dryRun: true,
        executable: executorReadiness.ready,
        action: input.action,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        requestId: input.requestId,
        expiresAt: input.handoffExpiresAt,
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_request',
        blockers: executorReadiness.blockers,
        preparationBlockers: input.blockers,
        execution,
        executorReadiness,
        audit: {
            actionType: execution.auditActionType,
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            supportSessionId: input.supportSessionId || null,
            outcome: executorReadiness.ready ? 'success' : 'denied',
            blockerCode: executorReadiness.blockers[0] || null,
        },
    }
}

function supportActionExecutorReadiness(input: {
    action: SupportActionPreparationInput['action']
    allowed: boolean
    organizationId: string | null
    user: string
    email: string
    requestId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    durationMinutes: number | null
    expiresAt: string | null
    handoffExpiresAt: string
    noAdminAvailable: boolean
    blockers: string[]
    execution: ReturnType<typeof supportActionExecutionTarget>
}) {
    const selectedSafeAction: SupportActionPreparationInput['action'] = 'invite_assist'
    const executorBlockers = uniqueTimelineValues([
        ...input.blockers,
        input.action === selectedSafeAction ? '' : 'mutation_unavailable',
        input.action === selectedSafeAction && (!input.organizationId || !input.email) ? 'invite_unavailable' : '',
        input.action !== 'impersonation' && !input.noAdminAvailable ? 'active_admin_available' : '',
    ])
    const ready = input.allowed && input.action === selectedSafeAction && executorBlockers.length === 0
    return {
        schemaVersion: 'support.action_executor_readiness.v1',
        mutationMode: 'no_mutation_readiness',
        noMutation: true,
        immutableHandoffRequired: true,
        selectedAction: selectedSafeAction,
        action: input.action,
        ready,
        executableByExistingEndpoint: ready,
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        durationRequired: input.action === 'impersonation',
        expiryRelevant: input.action !== 'impersonation',
        requestId: input.requestId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        supportSessionId: input.supportSessionId || null,
        target: {
            organizationId: input.organizationId,
            userId: input.user || null,
            email: input.email || null,
        },
        freshness: {
            expiresAt: input.handoffExpiresAt,
            staleBlocker: 'stale_prepare_payload',
            staleHandoffBlocker: 'stale_handoff',
            validation: 'executor_must_reject_after_handoff_expires',
        },
        idempotency: {
            key: input.idempotencyKey,
            requiredHeader: 'x-idempotency-key',
            duplicateBlocker: 'duplicate_request',
            duplicateIdempotencyKeyBlocker: 'duplicate_idempotency_key',
            validation: 'executor_must_reject_reused_key_for_target_and_action',
        },
        executorContract: {
            method: input.execution.method,
            path: input.execution.path,
            requiredHeaders: input.supportSessionId
                ? ['authorization', 'x-request-id', 'x-idempotency-key', 'x-support-session-id']
                : ['authorization', 'x-request-id', 'x-idempotency-key'],
            requiredBody: supportActionExecutorRequiredBody(input.action),
            bodyPreview: input.execution.body,
            auditActionType: input.execution.auditActionType,
        },
        blockers: executorBlockers,
        blockerCatalog: [
            'support_role_required',
            'missing_support_reason',
            'missing_scope',
            'invalid_scope',
            'invalid_duration',
            'invalid_expiry',
            'stale_handoff',
            'stale_prepare_payload',
            'duplicate_request',
            'duplicate_idempotency_key',
            'ambiguous_target',
            'active_admin_available',
            'mutation_unavailable',
            'invite_unavailable',
            'impersonation_ineligible',
            'audit_unavailable',
            'redaction_required',
        ],
        redactedAuditPreview: redactAuditValue({
            schemaVersion: 'support.action_executor_readiness.audit_preview.v1',
            actionType: input.execution.auditActionType,
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            supportSessionId: input.supportSessionId || null,
            outcome: ready ? 'success' : 'denied',
            blockerCode: executorBlockers[0] || null,
            targetOrganizationId: input.organizationId,
            targetUserId: input.user || null,
            targetEmail: input.email || null,
            reason: input.reason,
            context: input.context,
            scope: input.scope,
            durationMinutes: input.durationMinutes,
            expiresAt: input.expiresAt,
            execution: input.execution,
            redactionRequired: true,
        }),
    }
}

function supportActionExecutorRequiredBody(action: SupportActionPreparationInput['action']) {
    if (action === 'impersonation') {
        return ['target_id', 'organization_id', 'reason', 'scope', 'duration_minutes', 'context']
    }
    if (action === 'access_recovery') {
        return ['email', 'targetUserId', 'reason', 'context', 'scope', 'expiresAt']
    }
    return ['email', 'reason', 'context', 'scope', 'expiresAt']
}

function supportActionExecutionTarget(input: {
    action: SupportActionPreparationInput['action']
    organizationId: string | null
    user: string
    email: string
    requestId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId?: string
    durationMinutes: number | null
    expiresAt: string | null
}) {
    const headers = {
        'x-request-id': input.requestId,
        'x-idempotency-key': input.idempotencyKey,
        ...(input.supportSessionId ? { 'x-support-session-id': input.supportSessionId } : {}),
    }
    if (input.action === 'impersonation') {
        return {
            method: 'POST',
            path: '/api/impersonation/start',
            headers,
            auditActionType: 'impersonation.start',
            body: redactAuditValue({
                target_id: input.user,
                organization_id: input.organizationId,
                reason: input.reason,
                scope: input.scope,
                duration_minutes: input.durationMinutes,
                context: input.context,
            }),
        }
    }

    const organizationPath = input.organizationId ? encodeURIComponent(input.organizationId) : ':organizationId'
    if (input.action === 'access_recovery') {
        return {
            method: 'POST',
            path: `/api/admin/support/organizations/${organizationPath}/access-recovery`,
            headers,
            auditActionType: 'support.organization.access_recovery',
            body: redactAuditValue({
                email: input.email,
                targetUserId: input.user || null,
                reason: input.reason,
                context: input.context,
                scope: input.scope,
                expiresAt: input.expiresAt,
            }),
        }
    }

    return {
        method: 'POST',
        path: `/api/admin/support/organizations/${organizationPath}/invites`,
        headers,
        auditActionType: 'support.organization.invite_assist',
        body: redactAuditValue({
            email: input.email,
            reason: input.reason,
            context: input.context,
            scope: input.scope,
            expiresAt: input.expiresAt,
        }),
    }
}

function supportActionPreparationInput(query: SupportInspectionQuery, action: string): { value: SupportActionPreparationInput | null, error: Record<string, unknown> | null } {
    if (!query.prepareAction) {
        return { value: null, error: null }
    }
    if (!action) {
        return {
            value: null,
            error: supportError('unsupported_support_action', 'Unsupported support action prepare request.', {
                supportedActions: ['invite_assist', 'access_recovery', 'impersonation'],
            }),
        }
    }

    let reason: string
    try {
        reason = requireAuditReason(query.reason, 'Support action preparation reason')
    } catch (error) {
        return {
            value: null,
            error: supportError('missing_support_reason', error instanceof Error ? error.message : 'Support action preparation reason is required.'),
        }
    }

    const scopeResult = normalizeSupportPreparationScope(query.scope, action)
    if (scopeResult.error) return { value: null, error: scopeResult.error }
    const durationResult = normalizeSupportPreparationDuration(query.durationMinutes ?? query.duration_minutes, action)
    if (durationResult.error) return { value: null, error: durationResult.error }
    const expiryResult = normalizeSupportPreparationExpiry(query.expiresAt ?? query.expires_at)
    if (expiryResult.error) return { value: null, error: expiryResult.error }
    const idempotencyKey = supportActionIdempotencyKey(query.idempotencyKey || query.idempotency_key, action)

    return {
        value: {
            action: action as SupportActionPreparationInput['action'],
            reason,
            context: cleanContext(query.context),
            scope: scopeResult.value,
            supportSessionId: text(query.session || query.supportSession || query.supportSessionId),
            idempotencyKey,
            durationMinutes: durationResult.value,
            expiresAt: expiryResult.value,
        },
        error: null,
    }
}

function supportActionIdempotencyKey(value: unknown, action: string) {
    const cleaned = text(value).replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 120)
    return cleaned || `support-${action}-${randomUUID()}`
}

function supportInviteAssistExecutorControls(
    req: FastifyRequest,
    body: SupportInviteBody | undefined,
    requestId: string,
): {
    value: {
        schemaVersion: string
        requestId: string
        correlationId: string
        idempotencyKey: string
        supportSessionId: string
        scope: string[]
        handoffExpiresAt: string | null
        staleBlocker: string
        duplicateBlocker: string
    },
    error: { code: string, message: string, status: number } | null,
} {
    const idempotencyKey = supportActionIdempotencyKey(
        headerText(req.headers['x-idempotency-key']) || body?.idempotencyKey || body?.idempotency_key || requestId,
        'invite_assist',
    )
    const correlationId = text(headerText(req.headers['x-correlation-id']) || body?.correlationId || body?.correlation_id || requestId) || requestId
    const supportSessionId = supportSessionIdFromRequest(req, body)
    const scopeResult = normalizeSupportPreparationScope(body?.scope || 'invite:create', 'invite_assist')
    const base = {
        schemaVersion: 'support.action_execute.controls.v1',
        requestId,
        correlationId,
        idempotencyKey,
        supportSessionId,
        scope: scopeResult.value,
        handoffExpiresAt: null as string | null,
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_idempotency_key',
    }
    if (scopeResult.error) {
        return { value: base, error: { code: 'invalid_scope', message: 'Invite assistance execution requires invite:create scope.', status: 400 } }
    }
    if (!scopeResult.value.includes('invite:create')) {
        return { value: base, error: { code: 'invalid_scope', message: 'Invite assistance execution requires invite:create scope.', status: 400 } }
    }

    const handoffExpiresAt = text(headerText(req.headers['x-support-handoff-expires-at']) || body?.handoffExpiresAt || body?.handoff_expires_at)
    if (!handoffExpiresAt) {
        return { value: base, error: null }
    }
    const timestamp = Date.parse(handoffExpiresAt)
    if (Number.isNaN(timestamp)) {
        return { value: base, error: { code: 'invalid_expiry', message: 'Support invite assistance handoff expiry must be a valid timestamp.', status: 400 } }
    }
    const normalized = new Date(timestamp).toISOString()
    const value = { ...base, handoffExpiresAt: normalized }
    if (timestamp <= Date.now()) {
        return { value, error: { code: 'stale_prepare_payload', message: 'Support invite assistance handoff has expired; prepare a fresh action before executing.', status: 409 } }
    }
    return { value, error: null }
}

async function recordSupportInviteAssistExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    requestId: string
    reason: string
    blocker: string
    input: ReturnType<typeof normalizeInviteInput>
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    supportContext: string
}) {
    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.invite_assist',
        actorId: input.actorId,
        targetType: 'organization',
        targetId: input.organizationId,
        organizationId: input.organizationId,
        entityId: input.input.emails.join(','),
        requestId: input.requestId,
        severity: 'notice',
        outcome: 'denied',
        reason: input.reason,
        context: {
            schemaVersion: 'support.action_executor_blocker.v1',
            action: 'invite_assist',
            blocker: input.blocker,
            blockerCode: input.blocker,
            requestId: input.requestId,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            targetOrganizationId: input.organizationId,
            emails: input.input.emails,
            role: input.input.role,
            expiresAt: input.input.expiresAt,
            scope: input.controls.scope,
            handoffExpiresAt: input.controls.handoffExpiresAt,
            noSilentMembershipMutation: true,
            mutation: 'none',
            redactionRequired: true,
            supportContext: input.supportContext,
        },
    })
}

function supportInviteAssistExecutorBlocker(input: {
    organizationId: string
    requestId: string
    reason: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    input: ReturnType<typeof normalizeInviteInput>
    blockers: string[]
}) {
    return supportInviteAssistExecutorDetail({
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        controls: input.controls,
        input: input.input,
        inviteIds: [],
        outcome: 'denied',
        blockers: input.blockers,
    })
}

function supportInviteAssistExecutorDetail(input: {
    organizationId: string
    requestId: string
    reason: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    input: ReturnType<typeof normalizeInviteInput>
    inviteIds: string[]
    outcome: 'success' | 'denied'
    blockers: string[]
}) {
    return {
        schemaVersion: 'support.action_execute.invite_assist.v1',
        mutationMode: 'controlled_invite_row_only',
        action: 'invite_assist',
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        expiryRequired: true,
        noSilentMembershipMutation: true,
        requestId: input.requestId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        staleBlocker: input.controls.staleBlocker,
        duplicateBlocker: input.controls.duplicateBlocker,
        target: {
            organizationId: input.organizationId,
            emails: input.input.emails,
            inviteIds: input.inviteIds,
        },
        scope: input.controls.scope,
        expiresAt: input.input.expiresAt,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        outcome: input.outcome,
        blockers: input.blockers,
        blockerCatalog: [
            'support_role_required',
            'missing_support_reason',
            'stale_prepare_payload',
            'duplicate_idempotency_key',
            'ambiguous_target',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'invite_unavailable',
            'mutation_unavailable',
            'audit_unavailable',
            'redaction_required',
            'unsafe_impersonation',
        ],
        redactedAuditPreview: redactAuditValue({
            schemaVersion: 'support.action_execute.audit_preview.v1',
            actionType: 'support.organization.invite_assist',
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            organizationId: input.organizationId,
            emails: input.input.emails,
            inviteIds: input.inviteIds,
            reason: input.reason,
            scope: input.controls.scope,
            expiresAt: input.input.expiresAt,
            outcome: input.outcome,
            blockerCode: input.blockers[0] || null,
            redactionRequired: true,
        }),
    }
}

function supportInviteAssistAuditQuery(input: {
    requestId: string
    organizationId: string
    entityId: string
    correlationId: string
    idempotencyKey: string
    reason: string
}) {
    const params = new URLSearchParams()
    params.set('request', input.requestId)
    params.set('correlation', input.correlationId)
    params.set('idempotency', input.idempotencyKey)
    params.set('org', input.organizationId)
    if (input.entityId) params.set('entity', input.entityId)
    params.set('reason', input.reason)
    params.set('action', 'support.organization.invite_assist')
    params.set('outcome', 'success')
    params.set('source', 'admin')
    params.set('service', 'hanasand-api')
    return `/api/admin/audit-events?${params.toString()}`
}

function supportInviteActionExecutorControls(
    req: FastifyRequest,
    body: SupportInviteActionBody | undefined,
    requestId: string,
    action: 'revoke' | 'resend',
): {
    value: {
        schemaVersion: string
        requestId: string
        correlationId: string
        idempotencyKey: string
        supportSessionId: string
        scope: string[]
        handoffExpiresAt: string | null
        staleBlocker: string
        duplicateBlocker: string
    },
    error: { code: string, message: string, status: number } | null,
} {
    const requiredScope = action === 'revoke' ? 'invite:revoke' : 'invite:resend'
    const idempotencyKey = supportActionIdempotencyKey(
        headerText(req.headers['x-idempotency-key']) || body?.idempotencyKey || body?.idempotency_key || requestId,
        `invite_${action}`,
    )
    const correlationId = text(headerText(req.headers['x-correlation-id']) || body?.correlationId || body?.correlation_id || requestId) || requestId
    const supportSessionId = supportSessionIdFromRequest(req, body)
    const scopeResult = normalizeSupportPreparationScope(body?.scope || requiredScope, 'invite_assist')
    const base = {
        schemaVersion: 'support.action_execute.controls.v1',
        requestId,
        correlationId,
        idempotencyKey,
        supportSessionId,
        scope: scopeResult.value,
        handoffExpiresAt: null as string | null,
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_idempotency_key',
    }
    if (scopeResult.error || !scopeResult.value.includes(requiredScope)) {
        return { value: base, error: { code: 'invalid_scope', message: `Invite ${action} execution requires ${requiredScope} scope.`, status: 400 } }
    }

    const handoffExpiresAt = text(headerText(req.headers['x-support-handoff-expires-at']) || body?.handoffExpiresAt || body?.handoff_expires_at)
    if (!handoffExpiresAt) {
        return { value: base, error: null }
    }
    const timestamp = Date.parse(handoffExpiresAt)
    if (Number.isNaN(timestamp)) {
        return { value: base, error: { code: 'invalid_expiry', message: `Support invite ${action} handoff expiry must be a valid timestamp.`, status: 400 } }
    }
    const value = { ...base, handoffExpiresAt: new Date(timestamp).toISOString() }
    if (timestamp <= Date.now()) {
        return { value, error: { code: 'stale_prepare_payload', message: `Support invite ${action} handoff has expired; prepare a fresh action before executing.`, status: 409 } }
    }
    return { value, error: null }
}

async function recordSupportInviteActionExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    inviteId: string
    requestId: string
    action: 'revoke' | 'resend'
    actionType: string
    reason: string
    blocker: string
    controls: ReturnType<typeof supportInviteActionExecutorControls>['value']
    supportContext: string
}) {
    await recordAdminAuditEvent(req, {
        actionType: input.actionType,
        actorId: input.actorId,
        targetType: 'invite',
        targetId: input.inviteId,
        organizationId: input.organizationId,
        entityId: input.inviteId,
        requestId: input.requestId,
        severity: input.action === 'revoke' ? 'warning' : 'notice',
        outcome: 'denied',
        reason: input.reason,
        context: {
            schemaVersion: 'support.action_executor_blocker.v1',
            action: input.action,
            blocker: input.blocker,
            blockerCode: input.blocker,
            requestId: input.requestId,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            targetOrganizationId: input.organizationId,
            inviteId: input.inviteId,
            scope: input.controls.scope,
            handoffExpiresAt: input.controls.handoffExpiresAt,
            noSilentMembershipMutation: true,
            mutation: 'none',
            redactionRequired: true,
            supportContext: input.supportContext,
        },
    })
}

function supportInviteActionExecutorDetail(input: {
    organizationId: string
    requestId: string
    action: 'revoke' | 'resend'
    actionType: string
    reason: string
    controls: ReturnType<typeof supportInviteActionExecutorControls>['value']
    invite: OrganizationInviteRow | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
}) {
    return {
        schemaVersion: 'support.action_execute.invite_action.v1',
        mutationMode: 'controlled_invite_row_only',
        action: input.action,
        actionType: input.actionType,
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        expiryRequired: input.action === 'resend',
        noSilentMembershipMutation: true,
        requestId: input.requestId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        staleBlocker: input.controls.staleBlocker,
        duplicateBlocker: input.controls.duplicateBlocker,
        target: {
            organizationId: input.organizationId,
            inviteId: input.invite?.id || null,
            email: input.invite?.email || null,
        },
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        before: input.before,
        after: input.after,
        outcome: input.outcome,
        blockers: input.blockers,
        blockerCatalog: [
            'support_role_required',
            'missing_support_reason',
            'stale_prepare_payload',
            'duplicate_idempotency_key',
            'ambiguous_target',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'invite_unavailable',
            'accepted_invite_not_mutable_by_support_action',
            'mutation_unavailable',
            'audit_unavailable',
            'redaction_required',
            'unsafe_impersonation',
        ],
        redactedAuditPreview: redactAuditValue({
            schemaVersion: 'support.action_execute.audit_preview.v1',
            actionType: input.actionType,
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            organizationId: input.organizationId,
            inviteId: input.invite?.id || null,
            email: input.invite?.email || null,
            reason: input.reason,
            scope: input.controls.scope,
            outcome: input.outcome,
            blockerCode: input.blockers[0] || null,
            redactionRequired: true,
        }),
    }
}

function supportInviteActionAuditQuery(input: {
    requestId: string
    organizationId: string
    inviteId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    actionType: string
    outcome: string
}) {
    const params = new URLSearchParams()
    params.set('request', input.requestId)
    params.set('correlation', input.correlationId)
    params.set('idempotency', input.idempotencyKey)
    params.set('org', input.organizationId)
    params.set('entity', input.inviteId)
    params.set('reason', input.reason)
    params.set('action', input.actionType)
    params.set('outcome', input.outcome)
    params.set('source', 'admin')
    params.set('service', 'hanasand-api')
    return `/api/admin/audit-events?${params.toString()}`
}

function supportMemberRoleRecoveryExecutorControls(
    req: FastifyRequest,
    body: SupportMemberRoleRecoveryBody | undefined,
    requestId: string,
): {
    value: {
        schemaVersion: string
        requestId: string
        correlationId: string
        idempotencyKey: string
        supportSessionId: string
        scope: string[]
        handoffExpiresAt: string | null
        staleBlocker: string
        duplicateBlocker: string
    },
    error: { code: string, message: string, status: number } | null,
} {
    const idempotencyKey = supportActionIdempotencyKey(
        headerText(req.headers['x-idempotency-key']) || body?.idempotencyKey || body?.idempotency_key || requestId,
        'member_role_recovery',
    )
    const correlationId = text(headerText(req.headers['x-correlation-id']) || body?.correlationId || body?.correlation_id || requestId) || requestId
    const supportSessionId = supportSessionIdFromRequest(req, body)
    const scopeResult = normalizeSupportPreparationScope(body?.scope || 'member:role_recovery', 'member_role_recovery')
    const base = {
        schemaVersion: 'support.action_execute.controls.v1',
        requestId,
        correlationId,
        idempotencyKey,
        supportSessionId,
        scope: scopeResult.value,
        handoffExpiresAt: null as string | null,
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_idempotency_key',
    }
    if (scopeResult.error || !scopeResult.value.includes('member:role_recovery')) {
        return { value: base, error: { code: 'invalid_scope', message: 'Member role recovery execution requires member:role_recovery scope.', status: 400 } }
    }

    const handoffExpiresAt = text(headerText(req.headers['x-support-handoff-expires-at']) || body?.handoffExpiresAt || body?.handoff_expires_at)
    if (!handoffExpiresAt) {
        return { value: base, error: null }
    }
    const timestamp = Date.parse(handoffExpiresAt)
    if (Number.isNaN(timestamp)) {
        return { value: base, error: { code: 'invalid_expiry', message: 'Member role recovery handoff expiry must be a valid timestamp.', status: 400 } }
    }
    const value = { ...base, handoffExpiresAt: new Date(timestamp).toISOString() }
    if (timestamp <= Date.now()) {
        return { value, error: { code: 'stale_prepare_payload', message: 'Member role recovery handoff has expired; prepare a fresh action before executing.', status: 409 } }
    }
    return { value, error: null }
}

async function recordSupportMemberRoleRecoveryExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    userId: string
    requestId: string
    reason: string
    blocker: string
    requestedRole: string
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
    supportContext: string
    before?: Record<string, unknown> | null
}) {
    await recordAdminAuditEvent(req, {
        actionType: 'support.organization.member_role_recovery',
        actorId: input.actorId,
        targetType: 'member',
        targetId: input.userId,
        organizationId: input.organizationId,
        entityId: input.userId,
        requestId: input.requestId,
        severity: input.requestedRole === 'admin' ? 'warning' : 'notice',
        outcome: 'denied',
        reason: input.reason,
        context: {
            schemaVersion: 'support.action_executor_blocker.v1',
            action: 'member_role_recovery',
            blocker: input.blocker,
            blockerCode: input.blocker,
            requestId: input.requestId,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            targetOrganizationId: input.organizationId,
            targetUserId: input.userId,
            requestedRole: input.requestedRole,
            scope: input.controls.scope,
            handoffExpiresAt: input.controls.handoffExpiresAt,
            before: input.before || null,
            noSilentMembershipMutation: true,
            mutation: 'none',
            redactionRequired: true,
            supportContext: input.supportContext,
        },
    })
}

function supportMemberRoleRecoveryExecutorDetail(input: {
    organizationId: string
    userId: string
    requestId: string
    reason: string
    requestedRole: string
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
    member: Record<string, unknown> | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
}) {
    return {
        schemaVersion: 'support.action_execute.member_role_recovery.v1',
        mutationMode: 'controlled_member_role_only',
        action: 'member_role_recovery',
        actionType: 'support.organization.member_role_recovery',
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        noSilentMembershipMutation: true,
        requestId: input.requestId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        staleBlocker: input.controls.staleBlocker,
        duplicateBlocker: input.controls.duplicateBlocker,
        target: {
            organizationId: input.organizationId,
            userId: input.userId,
            currentRole: input.before?.role || input.member?.role || null,
            requestedRole: input.requestedRole,
        },
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        before: input.before,
        after: input.after,
        outcome: input.outcome,
        blockers: input.blockers,
        blockerCatalog: [
            'support_role_required',
            'missing_support_reason',
            'stale_prepare_payload',
            'duplicate_idempotency_key',
            'invalid_scope',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'revoked_member',
            'member_role_already_set',
            'last_owner_demote_denied',
            'owner_grant_denied',
            'audit_unavailable',
            'redaction_required',
        ],
        redactedAuditPreview: redactAuditValue({
            schemaVersion: 'support.action_execute.audit_preview.v1',
            actionType: 'support.organization.member_role_recovery',
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            organizationId: input.organizationId,
            targetUserId: input.userId,
            requestedRole: input.requestedRole,
            reason: input.reason,
            scope: input.controls.scope,
            outcome: input.outcome,
            blockerCode: input.blockers[0] || null,
            redactionRequired: true,
        }),
    }
}

function supportMemberRoleRecoveryAuditQuery(input: {
    requestId: string
    organizationId: string
    userId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    outcome: string
}) {
    const params = new URLSearchParams()
    params.set('request', input.requestId)
    params.set('correlation', input.correlationId)
    params.set('idempotency', input.idempotencyKey)
    params.set('org', input.organizationId)
    params.set('entity', input.userId)
    params.set('target', input.userId)
    params.set('reason', input.reason)
    params.set('action', 'support.organization.member_role_recovery')
    params.set('outcome', input.outcome)
    params.set('source', 'admin')
    params.set('service', 'hanasand-api')
    return `/api/admin/audit-events?${params.toString()}`
}

function normalizeSupportPreparationScope(value: unknown, action: string): { value: string[], error: Record<string, unknown> | null } {
    const allowedByAction: Record<string, Set<string>> = {
        invite_assist: new Set(['invite:create', 'invite:resend', 'invite:revoke']),
        access_recovery: new Set(['recovery:invite', 'recovery:approve', 'recovery:deny']),
        member_role_recovery: new Set(['member:role_recovery']),
        impersonation: new Set(['read_profile', 'read_org', 'support_debug']),
    }
    const allowed = allowedByAction[action] || new Set<string>()
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
    const scope = Array.from(new Set(raw.map(item => text(item).toLowerCase()).filter(Boolean)))
    if (!scope.length) {
        return { value: [], error: supportError('missing_scope', 'Support action preparation scope is required.', { supportedScopes: Array.from(allowed) }) }
    }
    const unsupported = scope.filter(item => !allowed.has(item))
    if (unsupported.length) {
        return { value: [], error: supportError('invalid_scope', `Unsupported support action scope: ${unsupported[0]}.`, { supportedScopes: Array.from(allowed) }) }
    }
    return { value: scope, error: null }
}

function normalizeSupportPreparationDuration(value: unknown, action: string): { value: number | null, error: Record<string, unknown> | null } {
    if (action !== 'impersonation' && (value === undefined || value === null || value === '')) {
        return { value: null, error: null }
    }
    if (value === undefined || value === null || value === '') {
        return { value: null, error: supportError('invalid_duration', 'Impersonation preparation duration is required.') }
    }
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed !== Math.trunc(parsed) || parsed < 5 || parsed > 240) {
        return { value: null, error: supportError('invalid_duration', 'Impersonation preparation duration must be between 5 and 240 minutes.') }
    }
    return { value: parsed, error: null }
}

function normalizeSupportPreparationExpiry(value: unknown): { value: string | null, error: Record<string, unknown> | null } {
    const expiresAt = text(value)
    if (!expiresAt) {
        return { value: null, error: null }
    }
    const timestamp = Date.parse(expiresAt)
    if (Number.isNaN(timestamp) || timestamp <= Date.now()) {
        return { value: null, error: supportError('invalid_expiry', 'Support action preparation expiry must be a future timestamp.') }
    }
    return { value: new Date(timestamp).toISOString(), error: null }
}

function supportInspectionFilterError(rawQuery: SupportInspectionQuery, filter: Omit<SupportTimelineFilter, 'unsupported'>) {
    const unsupported = Object.keys(rawQuery as Record<string, unknown>).filter(key => !supportInspectionFilters.has(key))
    if (unsupported.length) {
        return supportError('unsupported_support_filter', `Unsupported support inspection filter: ${unsupported[0]}.`, {
            unavailableFilters: unsupported,
            supportedFilters: Array.from(supportInspectionFilters),
        })
    }
    if (rawQuery.severity && !filter.severity) {
        return supportError('invalid_support_filter', 'Unsupported audit severity filter.', {
            filter: 'severity',
            supportedValues: ['info', 'notice', 'warning', 'critical'],
        })
    }
    if (rawQuery.outcome && !filter.outcome) {
        return supportError('invalid_support_filter', 'Unsupported audit outcome filter.', {
            filter: 'outcome',
            supportedValues: ['success', 'denied', 'failed'],
        })
    }
    if (filter.from && Number.isNaN(Date.parse(filter.from))) {
        return supportError('invalid_support_filter', 'Invalid audit timeline start time.', { filter: 'from' })
    }
    if (filter.to && Number.isNaN(Date.parse(filter.to))) {
        return supportError('invalid_support_filter', 'Invalid audit timeline end time.', { filter: 'to' })
    }
    if (rawQuery.limit !== undefined && (!Number.isFinite(Number(rawQuery.limit)) || Number(rawQuery.limit) < 1)) {
        return supportError('invalid_support_filter', 'Support inspection limit must be a positive number.', { filter: 'limit' })
    }
    const hasTarget = Boolean(filter.q || filter.org || filter.user || filter.email || filter.request || filter.entity || filter.entityType || filter.supportSession || filter.blocker || filter.reason || filter.context)
    if (!hasTarget && Boolean(filter.action || filter.source || filter.service || filter.severity || filter.outcome || filter.from || filter.to)) {
        return supportError('overbroad_support_timeline_filter', 'Add org, user, email, request, entity, entityType, or supportSession with audit timeline filters.', {
            filters: supportTimelineFilter(filter),
        })
    }
    return null
}

function supportTimelineFilter(input: Omit<SupportTimelineFilter, 'unsupported'>): SupportTimelineFilter {
    return {
        q: input.q || '',
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        entity: input.entity,
        entityType: input.entityType,
        supportSession: input.supportSession,
        action: input.action,
        severity: input.severity,
        outcome: input.outcome,
        source: input.source,
        service: input.service,
        blocker: input.blocker,
        reason: input.reason,
        context: input.context,
        from: input.from,
        to: input.to,
        limit: input.limit,
        unsupported: [],
    }
}

function auditTimelineLink(input: { org?: string | null, target?: string | null, request?: string | null, action?: string | null, outcome?: string | null }) {
    const params = new URLSearchParams()
    if (input.org) params.set('org', input.org)
    if (input.target) params.set('target', input.target)
    if (input.request) params.set('request', input.request)
    if (input.action) params.set('action', input.action)
    if (input.outcome) params.set('outcome', input.outcome)
    params.set('source', 'admin')
    params.set('service', 'hanasand-api')
    const query = params.toString()
    return {
        api: `/api/admin/audit-events?${query}`,
        href: `/dashboard/system/impersonation?${query}`,
    }
}

function supportAuditEntityLinks(input: {
    event: Record<string, any>
    context: Record<string, unknown>
    entityId?: unknown
    supportSessionId?: string
}) {
    const organizationId = text(input.event.organization_id || input.context.organizationId || input.context.targetOrganizationId)
    const targetUserId = text(input.context.targetUserId || (input.event.target_type === 'user' ? input.event.target_id : ''))
    const inviteId = text(input.context.inviteId)
        || (Array.isArray(input.context.inviteIds) ? text(input.context.inviteIds[0]) : '')
        || (input.event.target_type === 'invite' ? text(input.event.entity_id || input.event.target_id) : '')
    const memberId = text(input.context.memberId)
        || (input.event.target_type === 'member' ? text(input.event.entity_id || input.event.target_id) : '')
        || (input.event.target_type === 'user' ? targetUserId : '')
    const alertId = text(input.context.alertId || input.context.alert_id || input.context.dwmAlertId || input.context.alertReferenceId)
        || (input.event.target_type === 'alert' ? text(input.event.entity_id || input.event.target_id) : '')
    const watchlistId = text(input.context.watchlistId || input.context.watchlistItemId || input.context.watchlist_item_id)
        || (input.event.target_type === 'watchlist' ? text(input.event.entity_id || input.event.target_id) : '')
    const webhookId = text(input.context.webhookId || input.context.deliveryId || input.context.webhookDeliveryId)
        || (input.event.target_type === 'webhook' ? text(input.event.entity_id || input.event.target_id) : '')
    const requestId = text(input.event.request_id || input.context.requestId)
    const entityId = text(input.entityId)
    const inspectionParams = new URLSearchParams()
    if (organizationId) inspectionParams.set('org', organizationId)
    if (targetUserId) inspectionParams.set('user', targetUserId)
    if (inviteId) inspectionParams.set('entity', inviteId)
    if (requestId) inspectionParams.set('request', requestId)
    const inspectionQuery = inspectionParams.toString()
    return {
        inspection: inspectionQuery ? `/api/admin/support/inspect?${inspectionQuery}` : null,
        organization: organizationId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}` : null,
        user: targetUserId ? `/api/admin/support/users/${encodeURIComponent(targetUserId)}` : null,
        inviteAction: organizationId && inviteId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions` : null,
        accessRecovery: organizationId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery` : null,
        memberRoleRecovery: organizationId && targetUserId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(targetUserId)}/role-recovery` : null,
        impersonation: targetUserId ? `/api/impersonation/events?target=${encodeURIComponent(targetUserId)}` : null,
        auditEntity: entityId ? `/api/admin/audit-events?entity=${encodeURIComponent(entityId)}` : null,
        member: memberId ? `/api/admin/audit-events?entity=${encodeURIComponent(memberId)}&entityType=member` : null,
        alert: alertId ? `/api/admin/audit-events?entity=${encodeURIComponent(alertId)}&action=alert` : null,
        watchlist: watchlistId ? `/api/admin/audit-events?entity=${encodeURIComponent(watchlistId)}&action=watchlist` : null,
        webhook: webhookId ? `/api/admin/audit-events?entity=${encodeURIComponent(webhookId)}&action=webhook` : null,
        supportSession: input.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}` : null,
        timelineFilters: supportAuditEntityTimelineFilters({
            organizationId,
            targetUserId,
            inviteId,
            memberId,
            alertId,
            watchlistId,
            webhookId,
            requestId,
            entityId,
        }),
    }
}

function supportAuditEntityTimelineFilters(input: {
    organizationId: string
    targetUserId: string
    inviteId: string
    memberId: string
    alertId: string
    watchlistId: string
    webhookId: string
    requestId: string
    entityId: string
}) {
    return {
        schemaVersion: 'support.audit.entity_timeline_filters.v1',
        organization: input.organizationId ? auditFilterQuery({ org: input.organizationId }) : null,
        user: input.targetUserId ? auditFilterQuery({ target: input.targetUserId }) : null,
        invite: input.inviteId ? auditFilterQuery({ entity: input.inviteId, entityType: 'invite' }) : null,
        member: input.memberId ? auditFilterQuery({ entity: input.memberId, entityType: 'member' }) : null,
        alert: input.alertId ? auditFilterQuery({ entity: input.alertId, action: 'alert' }) : null,
        watchlist: input.watchlistId ? auditFilterQuery({ entity: input.watchlistId, action: 'watchlist' }) : null,
        webhook: input.webhookId ? auditFilterQuery({ entity: input.webhookId, action: 'webhook' }) : null,
        request: input.requestId ? auditFilterQuery({ request: input.requestId }) : null,
        entity: input.entityId ? auditFilterQuery({ entity: input.entityId }) : null,
        redacted: true,
    }
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

function supportRecentAuditTimeline(filters: Record<string, unknown>, rows: Record<string, unknown>[]) {
    const events = rows.map(toSupportAuditTimelineEvent)
    const timeline = events.map(event => ({
        schemaVersion: 'admin.audit.timeline_event.v1',
        id: event.id,
        timestamp: event.createdAt,
        actionType: event.action,
        severity: event.severity,
        outcome: event.outcome,
        actor: event.actor,
        target: event.target,
        organization: {
            id: event.organizationId,
            name: event.organizationName,
        },
        entity: {
            id: event.entityId,
            type: event.entityType,
        },
        requestId: event.requestId,
        reason: event.reason,
        before: event.before,
        after: event.after,
        actionEvidence: event.actionEvidence,
        context: event.context,
        links: event.links,
    }))
    return {
        schemaVersion: 'support.recent_audit_timeline.v1',
        filters,
        eventIds: events.map(event => event.id),
        summary: auditTimelineSummary(timeline),
        filterContract: supportAuditFilterContract(filters, timeline),
        exportProof: supportAuditExportProof(filters, timeline),
        compliancePacket: supportAuditCompliancePacket(filters, timeline),
        workflowRollup: supportAuditWorkflowRollup(filters, timeline),
        events,
        redacted: true,
        links: {
            timeline: auditFilterQuery(filters),
            details: events.map(event => event.links?.detail).filter(Boolean),
        },
        copyText: [
            `Support recent timeline: ${auditFilterQuery(filters)}`,
            `Events: ${events.map(event => event.id).join(', ') || 'none'}`,
            `Outcomes: ${uniqueTimelineValues(events.map(event => event.outcome)).join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function supportOrganizationActivityRollup(input: {
    organizationId: string
    requestId: string
    timeline: Array<Record<string, any>>
}) {
    const supportEvents = input.timeline.filter(event => text(event.action).startsWith('support.') || text(event.action).startsWith('impersonation.'))
    const actions = {
        inviteAssistance: supportEvents.filter(event => text(event.action).includes('invite')),
        accessRecovery: supportEvents.filter(event => text(event.action).includes('access_recovery')),
        memberRoleRecovery: supportEvents.filter(event => text(event.action).includes('member_role_recovery')),
        impersonation: supportEvents.filter(event => text(event.action).startsWith('impersonation.')),
        supportSessions: supportEvents.filter(event => text(event.action).startsWith('support.session')),
    }
    const eventIds = supportEvents.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const blockerCodes = uniqueTimelineValues(supportEvents.flatMap(event => [
        event.actionEvidence?.blockers,
        event.context?.blockerCode,
        event.context?.blocker,
    ].flat()))
    return {
        schemaVersion: 'support.organization.activity_rollup.v1',
        generatedAt: new Date().toISOString(),
        organizationId: input.organizationId,
        requestId: input.requestId || null,
        eventCount: supportEvents.length,
        eventIds,
        actionCounts: {
            inviteAssistance: actions.inviteAssistance.length,
            accessRecovery: actions.accessRecovery.length,
            memberRoleRecovery: actions.memberRoleRecovery.length,
            impersonation: actions.impersonation.length,
            supportSessions: actions.supportSessions.length,
        },
        outcomes: uniqueTimelineValues(supportEvents.map(event => event.outcome)),
        severities: uniqueTimelineValues(supportEvents.map(event => event.severity)),
        requestIds: uniqueTimelineValues(supportEvents.map(event => event.requestId)),
        actorIds: uniqueTimelineValues(supportEvents.map(event => event.actor?.id)),
        targetIds: uniqueTimelineValues(supportEvents.map(event => event.target?.id)),
        blockerCodes,
        links: {
            timeline: auditFilterQuery({ org: input.organizationId, source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: input.organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            inviteAssistance: auditFilterQuery({ org: input.organizationId, action: 'invite', source: 'admin', service: 'hanasand-api' }),
            accessRecovery: auditFilterQuery({ org: input.organizationId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            memberRoleRecovery: auditFilterQuery({ org: input.organizationId, action: 'member_role_recovery', source: 'admin', service: 'hanasand-api' }),
            impersonation: auditFilterQuery({ org: input.organizationId, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
        },
        guardrails: {
            supportRoleRequired: true,
            reasonRequiredForActions: true,
            contextRequiredForActions: true,
            noSilentMembershipMutation: true,
            redactionRequired: true,
        },
        redacted: true,
        copyText: [
            `Support activity org=${input.organizationId}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Invite/access/member/impersonation: ${actions.inviteAssistance.length}/${actions.accessRecovery.length}/${actions.memberRoleRecovery.length}/${actions.impersonation.length}`,
            `Denied replay: ${auditFilterQuery({ org: input.organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}

function supportUserActivityRollup(input: {
    userId: string
    requestId: string
    organizationIds: string[]
    timeline: Array<Record<string, any>>
}) {
    const supportEvents = input.timeline.filter(event => text(event.action).startsWith('support.') || text(event.action).startsWith('impersonation.'))
    const actionEvents = {
        inspections: supportEvents.filter(event => text(event.action).includes('.inspect')),
        inviteAssistance: supportEvents.filter(event => text(event.action).includes('invite')),
        accessRecovery: supportEvents.filter(event => text(event.action).includes('access_recovery')),
        memberRoleRecovery: supportEvents.filter(event => text(event.action).includes('member_role_recovery')),
        impersonation: supportEvents.filter(event => text(event.action).startsWith('impersonation.')),
    }
    const eventIds = supportEvents.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const blockerCodes = uniqueTimelineValues(supportEvents.flatMap(event => [
        event.actionEvidence?.blockers,
        event.context?.blockerCode,
        event.context?.blocker,
    ].flat()))
    return {
        schemaVersion: 'support.user.activity_rollup.v1',
        generatedAt: new Date().toISOString(),
        userId: input.userId,
        organizationIds: input.organizationIds,
        requestId: input.requestId || null,
        eventCount: supportEvents.length,
        eventIds,
        actionCounts: {
            inspections: actionEvents.inspections.length,
            inviteAssistance: actionEvents.inviteAssistance.length,
            accessRecovery: actionEvents.accessRecovery.length,
            memberRoleRecovery: actionEvents.memberRoleRecovery.length,
            impersonation: actionEvents.impersonation.length,
        },
        outcomes: uniqueTimelineValues(supportEvents.map(event => event.outcome)),
        requestIds: uniqueTimelineValues(supportEvents.map(event => event.requestId)),
        organizationTimelineLinks: input.organizationIds.map(organizationId => ({
            organizationId,
            timeline: auditFilterQuery({ org: organizationId, target: input.userId, source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ org: organizationId, target: input.userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
        })),
        links: {
            timeline: auditFilterQuery({ target: input.userId, source: 'admin', service: 'hanasand-api' }),
            denied: auditFilterQuery({ target: input.userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            accessRecovery: auditFilterQuery({ target: input.userId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
            memberRoleRecovery: auditFilterQuery({ target: input.userId, action: 'member_role_recovery', source: 'admin', service: 'hanasand-api' }),
            impersonation: auditFilterQuery({ target: input.userId, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
        },
        guardrails: {
            supportRoleRequired: true,
            reasonRequiredForActions: true,
            contextRequiredForActions: true,
            scopedSessionRequiredForImpersonation: true,
            redactionRequired: true,
        },
        blockerCodes,
        redacted: true,
        copyText: [
            `Support activity user=${input.userId}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Recovery/member/impersonation: ${actionEvents.accessRecovery.length}/${actionEvents.memberRoleRecovery.length}/${actionEvents.impersonation.length}`,
            `Denied replay: ${auditFilterQuery({ target: input.userId, outcome: 'denied', source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}

function toSupportAuditTimelineEvent(row: Record<string, unknown>) {
    const event = row as Record<string, any>
    const context = redactAuditValue(event.context && typeof event.context === 'object' ? event.context : {}) as Record<string, unknown>
    const beforeAfter = auditBeforeAfter(context)
    const id = Number(event.id)
    const entityId = event.entity_id || event.target_id || event.organization_id || null
    const supportSessionId = text(context.supportSessionId)
        || (text(entityId).startsWith('support_session_') ? text(entityId) : '')
    const actionEvidence = supportAuditActionEvidence({ event, context, entityId, supportSessionId })
    return {
        id,
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
        entityId,
        organizationId: event.organization_id || null,
        organizationName: event.organization_name || null,
        action: event.action_type,
        outcome: event.outcome,
        severity: event.severity,
        requestId: event.request_id || null,
        reason: event.reason || '',
        before: beforeAfter.before,
        after: beforeAfter.after,
        actionEvidence,
        context,
        links: {
            detail: `/api/admin/audit-events/${encodeURIComponent(String(id))}`,
            request: event.request_id ? `/api/admin/audit-events?request=${encodeURIComponent(String(event.request_id))}` : null,
            entity: entityId ? `/api/admin/audit-events?entity=${encodeURIComponent(String(entityId))}` : null,
            supportSession: supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(supportSessionId)}` : null,
            entities: supportAuditEntityLinks({ event, context, entityId, supportSessionId }),
        },
        createdAt: event.created_at,
        copyText: `${event.created_at} ${event.severity}/${event.outcome} ${event.action_type} actor=${event.actor_id} entity=${event.entity_id || event.target_id || ''} request=${event.request_id || ''}`,
    }
}

function supportError(code: string, message: string, extra: Record<string, unknown> = {}) {
    return {
        error: message,
        detail: {
            schemaVersion: 'support.error.v1',
            code,
            outcome: 'denied',
            ...extra,
        },
    }
}

function toAdminAuditEvent(row: Record<string, unknown>): Record<string, any> {
    const event = row as Record<string, any>
    const context = redactAuditValue(event.context || {}) as Record<string, unknown>
    const beforeAfter = auditBeforeAfter(context)
    const id = Number(event.id)
    const entityId = event.entity_id || event.target_id || event.organization_id || null
    const supportSessionId = text(context.supportSessionId)
        || (text(entityId).startsWith('support_session_') ? text(entityId) : '')
    const actionEvidence = supportAuditActionEvidence({ event, context, entityId, supportSessionId })
    const timelineEvent = {
        schemaVersion: 'admin.audit.timeline_event.v1',
        id,
        timestamp: event.created_at,
        actionType: event.action_type,
        severity: event.severity,
        outcome: event.outcome,
        source: event.source,
        service: event.service,
        actor: {
            id: event.actor_id,
            name: event.actor_name || null,
        },
        target: {
            type: event.target_type || null,
            id: event.target_id || null,
            name: event.target_name || null,
        },
        organization: {
            id: event.organization_id || null,
            name: event.organization_name || null,
        },
        entity: {
            id: entityId,
            type: event.target_type || 'admin_audit_event',
        },
        requestId: event.request_id || null,
        reason: event.reason || '',
        scope: auditEventScope(context),
        before: beforeAfter.before,
        after: beforeAfter.after,
        actionEvidence,
        context,
        links: {
            detail: `/api/admin/audit-events/${encodeURIComponent(String(id))}`,
            request: event.request_id ? `/api/admin/audit-events?request=${encodeURIComponent(String(event.request_id))}` : null,
            entity: entityId ? `/api/admin/audit-events?entity=${encodeURIComponent(String(entityId))}` : null,
            supportSession: supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(supportSessionId)}` : null,
            entities: supportAuditEntityLinks({ event, context, entityId, supportSessionId }),
        },
    }
    return {
        ...event,
        context,
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
            actionEvidence,
            timelineEvent,
            redactedSummary: {
                schemaVersion: 'support.audit.redacted_summary.v1',
                eventId: Number(event.id),
                actionType: event.action_type,
                outcome: event.outcome,
                severity: event.severity,
                actorId: event.actor_id,
                targetId: event.target_id || null,
                entityId: event.entity_id || null,
                requestId: event.request_id || null,
                correlationId: text(context.correlationId) || event.request_id || null,
                idempotencyKey: text(context.idempotencyKey) || null,
                reasonPresent: Boolean(event.reason),
                contextRedacted: true,
                detailRoute: `/api/admin/audit-events/${encodeURIComponent(String(event.id))}`,
                supportActionEvidence: actionEvidence,
                relatedEntityLinks: timelineEvent.links.entities,
            },
            copyText: `${event.created_at} ${event.severity}/${event.outcome} ${event.action_type} actor=${event.actor_id} target=${event.target_id || ''} org=${event.organization_id || ''} request=${event.request_id || ''} reason=${event.reason || ''}`,
        },
    }
}

function supportAuditActionEvidence(input: {
    event: Record<string, any>
    context: Record<string, unknown>
    entityId: unknown
    supportSessionId: string
}) {
    const actionType = text(input.event.action_type)
    const workflow = supportAuditWorkflowName({
        actionType,
        source: input.event.source,
        context: input.context,
    })
    const reason = text(input.event.reason)
    const blockerCode = text(input.context.blockerCode || input.context.blocker)
    const scope = input.context.scope ?? null
    const durationMinutes = input.context.durationMinutes ?? null
    const expiresAt = input.context.expiresAt ?? null
    const requiresReason = workflow === 'support' || workflow === 'impersonation' || actionType.startsWith('support.') || actionType.startsWith('impersonation.')
    const requiresScope = actionType.includes('invite') || actionType.includes('recovery') || actionType.includes('impersonation') || actionType.includes('role_recovery')
    const requiresDurationOrExpiry = actionType.includes('impersonation') || actionType.includes('invite') || actionType.includes('recovery')
    const actionLinkFilters = {
        org: input.event.organization_id || '',
        actor: input.event.actor_id || '',
        target: input.event.target_id || '',
        action: actionType,
        outcome: input.event.outcome || '',
        entity: input.entityId || '',
        request: input.event.request_id || '',
        supportSession: input.supportSessionId || '',
        reason,
    }

    return {
        schemaVersion: 'support.audit.action_evidence.v1',
        generatedAt: new Date().toISOString(),
        workflow,
        actionType,
        outcome: input.event.outcome || null,
        severity: input.event.severity || null,
        actor: {
            id: input.event.actor_id || null,
        },
        target: {
            type: input.event.target_type || null,
            id: input.event.target_id || null,
        },
        organizationId: input.event.organization_id || null,
        entityId: input.entityId || null,
        requestId: input.event.request_id || null,
        correlationId: text(input.context.correlationId) || input.event.request_id || null,
        idempotencyKey: text(input.context.idempotencyKey) || null,
        supportSessionId: input.supportSessionId || null,
        reasonPresent: Boolean(reason),
        reason: reason || null,
        scope,
        durationMinutes,
        expiresAt,
        blockerCode: blockerCode || null,
        controls: {
            supportRoleRequired: actionType.startsWith('support.'),
            reasonRequired: requiresReason,
            scopeRequired: requiresScope,
            durationOrExpiryRequired: requiresDurationOrExpiry,
            noSilentMembershipMutation: Boolean(input.context.noSilentMembershipMutation),
            redactionRequired: true,
        },
        beforeAfterPresent: {
            before: Boolean((input.context as Record<string, unknown>).before),
            after: Boolean((input.context as Record<string, unknown>).after),
        },
        links: {
            replay: auditFilterQuery(actionLinkFilters),
            request: input.event.request_id ? auditFilterQuery({ request: input.event.request_id }) : null,
            entity: input.entityId ? auditFilterQuery({ entity: input.entityId }) : null,
            supportSession: input.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}` : null,
        },
        blockers: [
            requiresReason && !reason ? 'missing_reason_on_source_event' : '',
            requiresScope && !scope ? 'missing_scope_on_source_event' : '',
            requiresDurationOrExpiry && !durationMinutes && !expiresAt ? 'missing_duration_or_expiry_on_source_event' : '',
            'redaction_required',
        ].filter(Boolean),
        redacted: true,
        copyText: [
            `Support action evidence ${actionType || 'unknown'}`,
            `Outcome: ${input.event.outcome || 'unknown'}`,
            `Reason present: ${Boolean(reason)}`,
            `Request: ${input.event.request_id || 'none'}`,
            `Replay: ${auditFilterQuery(actionLinkFilters)}`,
        ].join('\n'),
    }
}

function supportAuditEventDetailResponse(event: Record<string, any>, relatedTimeline: Array<Record<string, any>> = []) {
    const detail = event.detail || {}
    const context = detail.context || {}
    const timelineEvent = detail.timelineEvent || {}
    const supportSessionId = text(context.supportSessionId)
        || (text(detail.entityId).startsWith('support_session_') ? text(detail.entityId) : '')
    const filters = {
        org: detail.organizationId || '',
        actor: detail.actorId || '',
        target: detail.targetId || '',
        action: detail.actionType || '',
        severity: detail.severity || '',
        entity: detail.entityId || '',
        request: detail.requestId || '',
        outcome: detail.outcome || '',
        supportSession: supportSessionId,
        source: detail.source || '',
        service: detail.service || '',
    }
    return {
        schemaVersion: 'admin.audit.event_detail.v1',
        generatedAt: new Date().toISOString(),
        event: detail,
        timelineEvent,
        redacted: true,
        filterContract: supportAuditFilterContract(filters, [timelineEvent]),
        exportProof: supportAuditExportProof(filters, [timelineEvent]),
        compliancePacket: supportAuditCompliancePacket(filters, [timelineEvent]),
        bridgeAdapter: supportAuditBridgeAdapterContract(filters),
        workflowProof: supportAuditEventWorkflowProof({ detail, timelineEvent, filters }),
        decisionPacket: supportAuditEventDecisionPacket({ detail, timelineEvent, relatedTimeline, filters }),
        integrationFixture: supportAuditEventIntegrationFixture({ detail, timelineEvent, relatedTimeline, filters }),
        timelineReplayContract: supportAuditTimelineReplayContract(filters, relatedTimeline.length ? relatedTimeline : [timelineEvent]),
        supportWorkflowPacket: supportAuditSupportWorkflowPacket(filters, relatedTimeline.length ? relatedTimeline : [timelineEvent]),
        workflowRollup: supportAuditWorkflowRollup(filters, relatedTimeline.length ? relatedTimeline : [timelineEvent]),
        relatedTimeline: {
            schemaVersion: 'admin.audit.event_related_timeline.v1',
            filters,
            eventIds: relatedTimeline.map(item => item.id),
            summary: auditTimelineSummary(relatedTimeline),
            filterContract: supportAuditFilterContract(filters, relatedTimeline),
            exportProof: supportAuditExportProof(filters, relatedTimeline),
            compliancePacket: supportAuditCompliancePacket(filters, relatedTimeline),
            timelineReplayContract: supportAuditTimelineReplayContract(filters, relatedTimeline),
            supportWorkflowPacket: supportAuditSupportWorkflowPacket(filters, relatedTimeline),
            workflowRollup: supportAuditWorkflowRollup(filters, relatedTimeline),
            timeline: relatedTimeline,
            redacted: true,
            links: {
                timeline: auditFilterQuery(filters),
                details: relatedTimeline.map(item => item.links?.detail).filter(Boolean),
            },
            copyText: relatedTimeline
                .map(item => `${item.timestamp} ${item.severity}/${item.outcome} ${item.actionType} actor=${item.actor?.id || ''} entity=${item.entity?.id || ''} request=${item.requestId || ''}`)
                .join('\n'),
        },
        links: {
            self: `/api/admin/audit-events/${encodeURIComponent(String(event.id))}`,
            timeline: auditFilterQuery(filters),
            request: detail.requestId ? `/api/admin/audit-events?request=${encodeURIComponent(String(detail.requestId))}` : null,
            entity: detail.entityId ? `/api/admin/audit-events?entity=${encodeURIComponent(String(detail.entityId))}` : null,
            supportSession: supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(supportSessionId)}` : null,
        },
        copyText: [
            detail.copyText,
            `Detail: /api/admin/audit-events/${event.id}`,
            `Timeline: ${auditFilterQuery(filters)}`,
            'Workflow proof: support.audit.event_workflow_proof.v1',
        ].filter(Boolean).join('\n'),
    }
}

function supportAuditTimelineReplayContract(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const replayQuery = auditFilterQuery(filters)
    return {
        schemaVersion: 'support.audit.timeline_replay_contract.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        route: '/api/admin/audit-events',
        detailRouteTemplate: '/api/admin/audit-events/:id',
        supportedFilters: {
            org: ['org', 'orgId', 'organizationId'],
            actor: ['actor', 'actorId', 'supportActor', 'supportActorId'],
            target: ['target', 'targetId', 'user', 'userId', 'targetUserId'],
            action: ['action', 'actionType'],
            severity: ['severity'],
            time: ['from', 'to'],
            entity: ['entity', 'entityId', 'entityType'],
            request: ['request', 'requestId', 'correlation', 'correlationId'],
            outcome: ['outcome'],
            query: ['q'],
            reason: ['reason', 'supportReason'],
        },
        replay: {
            query: replayQuery,
            filters,
            eventIds: timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
            detailRoutes: timeline.map(event => event.links?.detail).filter(Boolean),
        },
        timelineShape: {
            requiredFields: ['id', 'timestamp', 'actionType', 'severity', 'outcome', 'actor.id', 'target.id', 'organization.id', 'entity.id', 'requestId', 'reason', 'actionEvidence'],
            detailPayloads: ['filterContract', 'exportProof', 'compliancePacket', 'workflowProof', 'integrationFixture', 'timelineReplayContract', 'supportWorkflowPacket', 'actionEvidenceRollup'],
            redactionRequired: true,
        },
        exampleQueries: {
            organization: auditFilterQuery({ org: filters.org || 'organization-id' }),
            actor: auditFilterQuery({ actor: filters.actor || 'support-actor-id' }),
            target: auditFilterQuery({ target: filters.target || 'target-user-id' }),
            actionOutcome: auditFilterQuery({ action: filters.action || 'support.organization.access_recovery', outcome: filters.outcome || 'success' }),
            entity: auditFilterQuery({ entity: filters.entity || 'entity-id', entityType: filters.entityType || 'invite' }),
            request: auditFilterQuery({ request: filters.request || 'request-id' }),
            timeRange: auditFilterQuery({ from: filters.from || '2026-01-01T00:00:00.000Z', to: filters.to || '2026-01-02T00:00:00.000Z' }),
            textQuery: auditFilterQuery({ q: filters.q || 'customer@example.com' }),
        },
        denialReplay: {
            schemaVersion: 'support.audit.denial_replay.v1',
            supportedOutcomes: ['success', 'denied', 'failed'],
            deniedActionQuery: auditFilterQuery({ action: filters.action || 'support.organization.access_recovery', outcome: 'denied', org: filters.org || '' }),
            missingReasonQuery: auditFilterQuery({ action: filters.action || 'support', outcome: filters.outcome || 'denied', reason: '' }),
            requiredAuditFields: ['actor.id', 'target.id', 'organization.id', 'actionType', 'outcome', 'reason', 'requestId'],
            expectedDeniedActions: [
                'support.inspect',
                'support.organization.invite_assist',
                'support.organization.invite_resend',
                'support.organization.invite_revoke',
                'support.organization.member_role_recovery',
                'support.organization.access_recovery',
                'impersonation.start',
            ],
            redactionRequired: true,
        },
        integrationReadiness: {
            fixtureName: 'support-audit-timeline-replay',
            expectedResponsePath: 'detail.timelineReplayContract',
            focusedCheck: 'cd api && bun run smoke:admin-support-unit',
            apiTypecheck: 'cd api && ./node_modules/.bin/tsc --noEmit --pretty false',
            validation: [
                'detail.timelineReplayContract.schemaVersion = support.audit.timeline_replay_contract.v1',
                'detail.timelineReplayContract.replay.eventIds contains returned audit event ids',
                'detail.timelineReplayContract.exampleQueries.actionOutcome is copy-ready',
                'detail.timelineReplayContract.timelineShape.redactionRequired = true',
            ],
        },
        blockers: [
            timeline.length ? '' : 'audit_unavailable',
            replayQuery.includes('?') ? '' : 'missing_replay_filter',
        ].filter(Boolean),
        copyText: [
            'Support audit timeline replay',
            `Replay: ${replayQuery}`,
            `Events: ${timeline.map(event => event.id).filter(Boolean).join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function supportAuditEventIntegrationFixture(input: {
    detail: Record<string, any>
    timelineEvent: Record<string, any>
    relatedTimeline: Array<Record<string, any>>
    filters: Record<string, unknown>
}) {
    const links = input.timelineEvent.links?.entities || {}
    const organizationId = text(input.detail.organizationId || input.filters.org)
    const targetId = text(input.detail.targetId || input.filters.target)
    const entityId = text(input.detail.entityId || input.filters.entity)
    const requestId = text(input.detail.requestId || input.filters.request)
    const actionType = text(input.detail.actionType)
    const outcome = text(input.detail.outcome)
    const relatedEventIds = input.relatedTimeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    return {
        schemaVersion: 'support.audit.integration_fixture.v1',
        fixtureName: 'support-audit-detail-timeline',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        seedEntities: {
            organizationId: organizationId || null,
            targetId: targetId || null,
            entityId: entityId || null,
            requestId: requestId || null,
            actionType: actionType || null,
            outcome: outcome || null,
        },
        auditFilters: {
            detail: `/api/admin/audit-events/${encodeURIComponent(String(input.timelineEvent.id || 'event-id'))}`,
            replay: auditFilterQuery(input.filters),
            request: requestId ? auditFilterQuery({ request: requestId }) : null,
            entity: entityId ? auditFilterQuery({ entity: entityId }) : null,
            outcome: outcome ? auditFilterQuery({ outcome, action: actionType }) : null,
        },
        supportRoutes: {
            inspection: links.inspection || null,
            inviteAction: links.inviteAction || null,
            accessRecovery: links.accessRecovery || null,
            memberRoleRecovery: links.memberRoleRecovery || null,
            impersonation: links.impersonation || null,
            supportSession: links.supportSession || null,
        },
        expectedAuditFields: [
            'actor.id',
            'target.id',
            'organization.id',
            'entity.id',
            'actionType',
            'severity',
            'outcome',
            'requestId',
            'reason',
            'timestamp',
            'actionEvidence',
        ],
        assertions: {
            reasonRequiredForSupportActions: true,
            scopeRequiredForMutationActions: true,
            durationRequiredForImpersonation: true,
            redactionRequired: true,
            relatedEventIds,
            expectedOutcome: outcome || null,
            expectedActionType: actionType || null,
        },
        blockers: [
            organizationId || targetId || entityId ? '' : 'missing_structured_target',
            requestId ? '' : 'missing_request_id',
            actionType ? '' : 'missing_action_type',
        ].filter(Boolean),
        copyText: [
            'Support audit integration fixture',
            `Action: ${actionType || 'unknown'}`,
            `Outcome: ${outcome || 'unknown'}`,
            `Request: ${requestId || 'none'}`,
            `Replay: ${auditFilterQuery(input.filters)}`,
            `Related events: ${relatedEventIds.join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function supportAuditEventWorkflowProof(input: {
    detail: Record<string, any>
    timelineEvent: Record<string, any>
    filters: Record<string, unknown>
}) {
    const links = input.timelineEvent.links?.entities || {}
    const availableActions = [
        links.inspection ? 'inspect_support_state' : '',
        links.inviteAction ? 'review_invite_action' : '',
        links.accessRecovery ? 'prepare_access_recovery' : '',
        links.memberRoleRecovery ? 'prepare_member_role_recovery' : '',
        links.impersonation ? 'review_impersonation' : '',
        links.supportSession ? 'review_support_session' : '',
    ].filter(Boolean)
    const actionType = text(input.detail.actionType)
    const outcome = text(input.detail.outcome)
    const reason = text(input.detail.reason)
    const blockers = [
        reason ? '' : 'missing_reason_on_source_event',
        input.detail.organizationId || input.detail.targetId || input.detail.entityId ? '' : 'missing_structured_target',
        availableActions.length ? '' : 'no_backed_support_action_link',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.event_workflow_proof.v1',
        generatedAt: new Date().toISOString(),
        actionType,
        outcome,
        reasonPresent: Boolean(reason),
        target: {
            organizationId: input.detail.organizationId || null,
            targetType: input.detail.targetType || null,
            targetId: input.detail.targetId || null,
            entityId: input.detail.entityId || null,
            requestId: input.detail.requestId || null,
        },
        availableActions,
        guardedActionRequirements: {
            supportRoleRequired: true,
            reasonRequired: true,
            scopeRequired: true,
            durationOrExpiryRequired: ['prepare_access_recovery', 'review_impersonation'].some(action => availableActions.includes(action)),
            noSilentMembershipMutation: true,
            redactionRequired: true,
        },
        actionRequestTemplates: supportAuditEventActionTemplates({ links, detail: input.detail, filters: input.filters }),
        blockers,
        links: {
            inspection: links.inspection || null,
            inviteAction: links.inviteAction || null,
            accessRecovery: links.accessRecovery || null,
            memberRoleRecovery: links.memberRoleRecovery || null,
            impersonation: links.impersonation || null,
            supportSession: links.supportSession || null,
            auditTimeline: auditFilterQuery(input.filters),
        },
        copyText: [
            `Audit workflow proof for ${actionType || 'unknown action'}`,
            `Outcome: ${outcome || 'unknown'}`,
            `Reason present: ${Boolean(reason)}`,
            `Actions: ${availableActions.join(', ') || 'none'}`,
            `Timeline: ${auditFilterQuery(input.filters)}`,
        ].join('\n'),
        redacted: true,
    }
}

function supportAuditEventDecisionPacket(input: {
    detail: Record<string, any>
    timelineEvent: Record<string, any>
    relatedTimeline: Array<Record<string, any>>
    filters: Record<string, unknown>
}) {
    const workflowProof = supportAuditEventWorkflowProof({
        detail: input.detail,
        timelineEvent: input.timelineEvent,
        filters: input.filters,
    })
    const actionEvidenceRollup = supportAuditActionEvidenceRollup(input.relatedTimeline.length ? input.relatedTimeline : [input.timelineEvent])
    const actionType = text(input.detail.actionType)
    const outcome = text(input.detail.outcome)
    const reason = text(input.detail.reason)
    const requestId = text(input.detail.requestId || input.filters.request)
    const organizationId = text(input.detail.organizationId || input.filters.org)
    const targetId = text(input.detail.targetId || input.filters.target)
    const entityId = text(input.detail.entityId || input.filters.entity)
    const allowed = outcome === 'success'
    const denied = outcome === 'denied' || outcome === 'failed'
    const blockers = uniqueTimelineValues([
        ...workflowProof.blockers,
        ...actionEvidenceRollup.blockers,
        allowed || denied ? '' : 'unknown_action_outcome',
        requestId ? '' : 'missing_request_id',
        reason ? '' : 'missing_reason_on_source_event',
    ])
    return {
        schemaVersion: 'support.audit.event_decision_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        sourceEvent: {
            id: input.timelineEvent.id || input.detail.id || null,
            actionType,
            outcome,
            severity: input.detail.severity || null,
            requestId: requestId || null,
            organizationId: organizationId || null,
            targetId: targetId || null,
            entityId: entityId || null,
            reasonPresent: Boolean(reason),
        },
        decision: {
            allowed,
            denied,
            status: allowed ? 'allowed' : denied ? 'denied' : 'needs_review',
            operatorReviewRequired: denied || blockers.some(blocker => blocker !== 'redaction_required'),
            blockers,
        },
        requiredOperatorInputs: {
            supportRole: true,
            reason: true,
            context: true,
            scope: true,
            durationMinutesFor: ['impersonation'],
            expiresAtFor: ['invite_assistance', 'access_recovery'],
            idempotencyKeyFor: ['invite_assistance', 'invite_action', 'member_role_recovery'],
        },
        availableActions: workflowProof.availableActions,
        actionRequestTemplates: workflowProof.actionRequestTemplates,
        auditReplay: {
            eventDetail: input.timelineEvent.id ? `/api/admin/audit-events/${encodeURIComponent(String(input.timelineEvent.id))}` : null,
            request: requestId ? auditFilterQuery({ request: requestId }) : null,
            actionOutcome: auditFilterQuery({ action: actionType, outcome }),
            entity: entityId ? auditFilterQuery({ entity: entityId }) : null,
            supportWorkflow: auditFilterQuery(input.filters),
            deniedOnly: auditFilterQuery({ ...input.filters, outcome: 'denied' }),
        },
        evidence: {
            relatedEventIds: input.relatedTimeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
            actionEvidenceRollup,
            workflowProof,
        },
        copyText: [
            `Support audit decision ${actionType || 'unknown'} outcome=${outcome || 'unknown'}`,
            `Status: ${allowed ? 'allowed' : denied ? 'denied' : 'needs_review'}`,
            `Request: ${requestId || 'none'}`,
            `Reason present: ${Boolean(reason)}`,
            `Actions: ${workflowProof.availableActions.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(input.filters)}`,
        ].join('\n'),
    }
}

function supportAuditEventActionTemplates(input: {
    links: Record<string, any>
    detail: Record<string, any>
    filters: Record<string, unknown>
}) {
    const organizationId = text(input.detail.organizationId || input.filters.org)
    const targetId = text(input.detail.targetId || input.filters.target)
    const entityId = text(input.detail.entityId || input.filters.entity)
    const requestId = text(input.detail.requestId || input.filters.request)
    const baseBody = {
        reason: 'Required support reason describing the customer request.',
        context: 'Support case, requester, and verification notes.',
        requestId: requestId || 'generated-request-id',
    }
    return {
        schemaVersion: 'support.audit.event_action_templates.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        sourceEvent: {
            actionType: input.detail.actionType || null,
            outcome: input.detail.outcome || null,
            organizationId: organizationId || null,
            targetId: targetId || null,
            entityId: entityId || null,
            requestId: requestId || null,
        },
        templates: {
            inspect: input.links.inspection ? {
                method: 'GET',
                route: input.links.inspection,
                reasonRequired: false,
                expectedAuditAction: 'support.inspect',
            } : null,
            inviteAction: input.links.inviteAction ? {
                method: 'POST',
                route: input.links.inviteAction,
                body: {
                    ...baseBody,
                    action: 'resend',
                    scope: 'invite:resend',
                    expiresAt: 'future ISO timestamp for resend',
                },
                reasonRequired: true,
                scopeRequired: true,
                expiryRequired: true,
                expectedAuditAction: 'support.organization.invite_resend',
            } : null,
            accessRecovery: input.links.accessRecovery ? {
                method: 'POST',
                route: input.links.accessRecovery,
                body: {
                    ...baseBody,
                    email: targetId || 'customer@example.com',
                    role: 'admin',
                    scope: 'recovery:invite',
                    expiresAt: 'future ISO timestamp',
                },
                reasonRequired: true,
                scopeRequired: true,
                expiryRequired: true,
                expectedAuditAction: 'support.organization.access_recovery',
            } : null,
            memberRoleRecovery: input.links.memberRoleRecovery ? {
                method: 'POST',
                route: input.links.memberRoleRecovery,
                body: {
                    ...baseBody,
                    role: 'admin',
                    scope: 'member:role_recovery',
                },
                reasonRequired: true,
                scopeRequired: true,
                expectedAuditAction: 'support.organization.member_role_recovery',
            } : null,
            impersonation: input.links.impersonation ? {
                method: 'POST',
                route: '/api/impersonation/start',
                body: {
                    ...baseBody,
                    target_id: targetId || entityId || 'target-user-id',
                    organizationId: organizationId || undefined,
                    scope: ['read_profile', 'read_org'],
                    durationMinutes: 30,
                },
                reasonRequired: true,
                scopeRequired: true,
                durationRequired: true,
                expectedAuditAction: 'impersonation.start',
            } : null,
            supportSession: input.links.supportSession ? {
                method: 'GET',
                route: input.links.supportSession,
                reasonRequired: false,
                expectedAuditAction: 'support.session.inspect',
            } : null,
        },
        auditReplay: auditFilterQuery(input.filters),
        blockers: [
            organizationId || targetId || entityId ? '' : 'missing_structured_target',
            requestId ? '' : 'missing_request_id',
        ].filter(Boolean),
    }
}

function adminAuditFilterError(rawQuery: AuditQuery, filter: { severity: string, outcome: string, from: string, to: string, limit: number }) {
    const unsupported = Object.keys(rawQuery as Record<string, unknown>).filter(key => !adminAuditFilters.has(key))
    if (unsupported.length) {
        return supportError('unsupported_audit_filter', `Unsupported audit filter: ${unsupported[0]}.`, {
            unavailableFilters: unsupported,
            supportedFilters: Array.from(adminAuditFilters),
        })
    }
    if (rawQuery.severity && !filter.severity) {
        return supportError('invalid_audit_filter', 'Unsupported audit severity filter.', {
            filter: 'severity',
            supportedValues: ['info', 'notice', 'warning', 'critical'],
        })
    }
    if (rawQuery.outcome && !filter.outcome) {
        return supportError('invalid_audit_filter', 'Unsupported audit outcome filter.', {
            filter: 'outcome',
            supportedValues: ['success', 'denied', 'failed'],
        })
    }
    if (filter.from && Number.isNaN(Date.parse(filter.from))) {
        return supportError('invalid_audit_filter', 'Invalid audit start time.', { filter: 'from' })
    }
    if (filter.to && Number.isNaN(Date.parse(filter.to))) {
        return supportError('invalid_audit_filter', 'Invalid audit end time.', { filter: 'to' })
    }
    if (rawQuery.limit !== undefined && (!Number.isFinite(Number(rawQuery.limit)) || Number(rawQuery.limit) < 1)) {
        return supportError('invalid_audit_filter', 'Audit limit must be a positive number.', { filter: 'limit' })
    }
    return null
}

function auditTimelineSummary(timeline: Array<Record<string, any>>) {
    return {
        eventCount: timeline.length,
        actionTypes: uniqueTimelineValues(timeline.map(event => event.actionType)),
        outcomes: uniqueTimelineValues(timeline.map(event => event.outcome)),
        severities: uniqueTimelineValues(timeline.map(event => event.severity)),
        requestIds: uniqueTimelineValues(timeline.map(event => event.requestId)),
        organizationIds: uniqueTimelineValues(timeline.map(event => event.organization?.id)),
        actorIds: uniqueTimelineValues(timeline.map(event => event.actor?.id)),
        entityIds: uniqueTimelineValues(timeline.map(event => event.entity?.id)),
        entityLinkRollup: supportAuditEntityLinkRollup(timeline),
        actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
    }
}

function supportAuditFilterContract(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const blockers = [
        timeline.length ? '' : 'audit_unavailable',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.filter_contract.v1',
        filters,
        supportedFilters: Array.from(adminAuditFilters),
        redacted: true,
        redactedSummary: supportAuditRedactedSummary(timeline),
        entityLinkRollup: supportAuditEntityLinkRollup(timeline),
        actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
        filterReadiness: supportAuditFilterReadiness(filters, timeline),
        stableRequestIds: uniqueTimelineValues(timeline.map(event => event.requestId)),
        correlationIds: uniqueTimelineValues(timeline.map(event => event.context?.correlationId || event.requestId)),
        idempotencyKeys: uniqueTimelineValues(timeline.map(event => event.context?.idempotencyKey)),
        blockerCatalog: [
            'missing_support_reason',
            'support_role_required',
            'ambiguous_target',
            'unsupported_audit_filter',
            'invalid_audit_filter',
            'stale_prepare_payload',
            'duplicate_request',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers,
        handoffPreviewLinkage: {
            request: filters.request || null,
            correlation: filters.correlation || null,
            idempotency: filters.idempotency || null,
            query: auditFilterQuery(filters),
        },
    }
}

function supportAuditFilterReadiness(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const filterText = (key: string) => text(filters[key])
    const appliedFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => text(value)))
    const targetFilters = ['org', 'organizationId', 'actor', 'target', 'entity', 'entityType', 'request', 'correlation', 'idempotency', 'supportSession']
        .filter(key => filterText(key))
    const actionFilters = ['action', 'severity', 'outcome', 'source', 'service', 'workflow']
        .filter(key => filterText(key))
    const textQueryFilters = ['q']
        .filter(key => filterText(key))
    const reasonContextFilters = ['reason', 'context', 'blocker']
        .filter(key => filterText(key))
    const from = filterText('from')
    const to = filterText('to')
    const timeRangeValid = (!from || !Number.isNaN(Date.parse(from))) && (!to || !Number.isNaN(Date.parse(to)))
    const targetBounded = Boolean(targetFilters.length || textQueryFilters.length || reasonContextFilters.length)
    const blockers = [
        timeRangeValid ? '' : 'invalid_time_range',
        !targetBounded && (actionFilters.length || from || to) ? 'overbroad_audit_query' : '',
        timeline.length ? '' : 'audit_unavailable',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.filter_readiness.v1',
        appliedFilters,
        targetBounded,
        targetFilters,
        actionFilters,
        textQueryFilters,
        reasonContextFilters,
        timeRange: {
            from: from || null,
            to: to || null,
            valid: timeRangeValid,
        },
        supportedAliases: {
            query: ['q'],
            organization: ['org', 'orgId', 'organizationId'],
            actor: ['actor', 'actorId', 'supportActor', 'supportActorId'],
            target: ['target', 'targetId', 'user', 'userId', 'targetUserId'],
            action: ['action', 'actionType'],
            entity: ['entity', 'entityId', 'entityType'],
            request: ['request', 'requestId', 'correlation', 'correlationId'],
            blocker: ['blocker', 'blockerCode'],
            reason: ['reason', 'supportReason'],
            context: ['context', 'supportContext'],
            supportSession: ['session', 'supportSession', 'supportSessionId'],
        },
        replay: {
            query: auditFilterQuery(filters),
            eventIds: timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
        },
        blockers,
        redacted: true,
        copyText: [
            `Audit filters: ${Object.keys(appliedFilters).join(', ') || 'none'}`,
            `Target bounded: ${targetBounded}`,
            `Text query: ${textQueryFilters.join(', ') || 'none'}`,
            `Time range: ${from || '*'} to ${to || '*'}`,
            `Replay: ${auditFilterQuery(filters)}`,
        ].join('\n'),
    }
}

function supportAuditBridgeAdapterContract(filters: Record<string, unknown>) {
    const filterFields = Array.from(adminAuditFilters)
    return {
        schemaVersion: 'support.audit.bridge_adapter_contract.v1',
        route: '/api/admin/audit-events',
        adapter: 'supportTimelineAuditBridgeEvent',
        supportedWorkflows: ['organization', 'watchlist', 'webhook', 'alert', 'impersonation', 'support'],
        requiredFields: [
            'workflow',
            'action',
            'actorId',
            'targetType',
            'targetId',
            'organizationId',
            'entityId',
            'requestId',
            'severity',
            'outcome',
            'reason',
        ],
        filterFields,
        supportAliases: {
            actor: ['actor', 'actorId', 'supportActor', 'supportActorId'],
            organization: ['org', 'orgId', 'organizationId'],
            target: ['target', 'targetId', 'user', 'userId', 'targetUserId'],
            request: ['request', 'requestId', 'correlation', 'correlationId'],
            entity: ['entity', 'entityId', 'entityType'],
            supportSession: ['session', 'supportSession', 'supportSessionId'],
            blocker: ['blocker', 'blockerCode'],
            reason: ['reason', 'supportReason'],
            context: ['context', 'supportContext'],
        },
        currentFilters: filters,
        redaction: {
            required: true,
            redactedFields: ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey', 'session', 'credential', 'webhookUrl', 'privateSourceUrl'],
            beforeAfterRedacted: true,
        },
        blockerCatalog: [
            'missing_support_reason',
            'unsupported_audit_filter',
            'audit_unavailable',
            'redaction_required',
        ],
        replay: {
            query: auditFilterQuery(filters),
            detailRouteTemplate: '/api/admin/audit-events/:id',
        },
        controlledRecoveryFixtures: supportControlledRecoveryAuditFixtures(filters),
        worker3: {
            readinessName: 'support-audit-bridge-adapter',
            testCommand: 'cd api && bun run smoke:admin-support-unit',
            expectedResponsePath: 'detail.bridgeAdapter',
            validation: [
                'detail.bridgeAdapter.schemaVersion = support.audit.bridge_adapter_contract.v1',
                'detail.bridgeAdapter.supportedWorkflows includes webhook and alert',
                'detail.bridgeAdapter.redaction.required = true',
                'detail.bridgeAdapter.replay.query is copy-ready',
            ],
        },
    }
}

function supportControlledRecoveryAuditFixtures(filters: Record<string, unknown>) {
    const organizationId = text(filters.org) || 'organization-id'
    const actorId = text(filters.actor) || 'support-actor-id'
    const targetId = text(filters.target) || 'target-user-or-email'
    const requestId = text(filters.request) || 'support-request-id'
    return {
        schemaVersion: 'support.audit.controlled_recovery_fixtures.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        purpose: 'org_invite_access_recovery_audit_integration',
        requiredEventFields: [
            'actionType',
            'actorId',
            'targetType',
            'targetId',
            'organizationId',
            'entityId',
            'requestId',
            'severity',
            'outcome',
            'reason',
            'context.schemaVersion',
            'context.scope',
            'context.idempotencyKey',
        ],
        fixtures: [
            {
                name: 'invite_resend_allowed',
                actionType: 'support.organization.invite_resend',
                severity: 'notice',
                outcome: 'success',
                targetType: 'invite',
                targetId,
                organizationId,
                entityId: 'invite-id',
                actorId,
                requestId,
                reason: 'Verified customer request to resend pending invite.',
                context: {
                    schemaVersion: 'support.action_execute.invite_action.v1',
                    action: 'resend',
                    scope: ['invite:resend'],
                    idempotencyKey: 'support-invite-resend-key',
                    correlationId: 'support-correlation-id',
                    supportSessionId: 'support-session-id',
                    noSilentMembershipMutation: true,
                    redactionRequired: true,
                },
                replay: auditFilterQuery({ org: organizationId, action: 'support.organization.invite_resend', outcome: 'success', entity: 'invite-id', request: requestId }),
            },
            {
                name: 'access_recovery_pending_approval',
                actionType: 'support.organization.access_recovery',
                severity: 'warning',
                outcome: 'success',
                targetType: 'invite',
                targetId,
                organizationId,
                entityId: 'invite-id',
                actorId,
                requestId,
                reason: 'Verified customer cannot reach an organization admin.',
                context: {
                    schemaVersion: 'support.access_recovery.v1',
                    approvalRequired: true,
                    approvalStatus: 'pending',
                    scope: ['recovery:invite'],
                    expiresAt: 'future ISO timestamp',
                    noSilentMembershipMutation: true,
                    redactionRequired: true,
                },
                replay: auditFilterQuery({ org: organizationId, action: 'support.organization.access_recovery', outcome: 'success', request: requestId }),
            },
            {
                name: 'member_role_recovery_denied',
                actionType: 'support.organization.member_role_recovery',
                severity: 'warning',
                outcome: 'denied',
                targetType: 'user',
                targetId,
                organizationId,
                entityId: targetId,
                actorId,
                requestId,
                reason: 'Support attempted role recovery without sufficient org condition.',
                context: {
                    schemaVersion: 'support.action_execute.member_role_recovery.v1',
                    blockerCode: 'active_admin_available',
                    scope: ['member:role_recovery'],
                    idempotencyKey: 'support-member-role-key',
                    noSilentMembershipMutation: true,
                    redactionRequired: true,
                },
                replay: auditFilterQuery({ org: organizationId, action: 'support.organization.member_role_recovery', outcome: 'denied', target: targetId, request: requestId }),
            },
        ],
        filterExpectations: {
            byOrganization: auditFilterQuery({ org: organizationId, source: 'admin', service: 'hanasand-api' }),
            byRequest: auditFilterQuery({ request: requestId }),
            byTarget: auditFilterQuery({ target: targetId }),
            deniedOnly: auditFilterQuery({ org: organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            recoveryOnly: auditFilterQuery({ org: organizationId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
        },
        redaction: {
            beforeAfterRedacted: true,
            forbiddenFields: ['token', 'secret', 'authorization', 'cookie', 'webhookUrl', 'privateSourceUrl'],
        },
    }
}

function supportAuditWorkflowRollup(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const workflows = ['organization', 'watchlist', 'webhook', 'alert', 'impersonation', 'support']
    const rollup = workflows.map(workflow => {
        const events = timeline.filter(event => supportAuditWorkflowName(event) === workflow)
        const workflowFilters = {
            ...filters,
            workflow,
            source: filters.source || workflow,
        }
        return {
            workflow,
            eventCount: events.length,
            eventIds: events.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
            actionTypes: uniqueTimelineValues(events.map(event => event.actionType)),
            outcomes: uniqueTimelineValues(events.map(event => event.outcome)),
            severities: uniqueTimelineValues(events.map(event => event.severity)),
            requestIds: uniqueTimelineValues(events.map(event => event.requestId)),
            redactedSummary: supportAuditRedactedSummary(events),
            links: {
                timeline: auditFilterQuery(workflowFilters),
                details: events.map(event => event.links?.detail).filter(Boolean),
            },
        }
    })
    return {
        schemaVersion: 'support.audit.workflow_rollup.v1',
        filters,
        workflows,
        rollup,
        redacted: true,
        copyText: rollup
            .filter(item => item.eventCount)
            .map(item => `${item.workflow}: ${item.eventCount} event(s), actions=${item.actionTypes.join(',') || 'none'}`)
            .join('\n'),
    }
}

function supportAuditWorkflowName(event: Record<string, any>) {
    const contextWorkflow = text(event.context?.workflow)
    if (contextWorkflow) return contextWorkflow
    const source = text(event.source)
    if (source) return source
    const action = text(event.actionType)
    if (action.startsWith('organization.')) return 'organization'
    if (action.includes('watchlist')) return 'watchlist'
    if (action.includes('webhook')) return 'webhook'
    if (action.includes('alert')) return 'alert'
    if (action.startsWith('impersonation.')) return 'impersonation'
    return 'support'
}

function supportAuditExportProof(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const replayQuery = auditFilterQuery(filters)
    const eventIds = timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const summary = supportAuditRedactedSummary(timeline)
    const requestIds = uniqueTimelineValues(timeline.map(event => event.requestId))
    const supportSessionIds = uniqueTimelineValues(timeline.map(event => {
        const contextSession = text(event.context?.supportSessionId)
        const entityId = text(event.entity?.id)
        return contextSession || (entityId.startsWith('support_session_') ? entityId : '')
    }))
    const blockers = [
        timeline.length ? '' : 'audit_unavailable',
        eventIds.length === timeline.length ? '' : 'event_id_unavailable',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.export_proof.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        immutableEventIds: eventIds,
        eventCount: timeline.length,
        route: '/api/admin/audit-events',
        dashboardRoute: '/dashboard/system/impersonation',
        replay: {
            method: 'GET',
            query: replayQuery,
            filters,
            requestIds,
            supportSessionIds,
            entityLinks: supportAuditEntityLinkRollup(timeline),
        },
        exposedFields: [
            'id',
            'timestamp',
            'actionType',
            'severity',
            'source',
            'service',
            'actor.id',
            'target.type',
            'target.id',
            'organization.id',
            'entity.id',
            'requestId',
            'outcome',
            'reason',
            'before',
            'after',
            'scope',
            'context',
            'links.detail',
            'links.request',
            'links.entity',
            'links.supportSession',
            'links.entities',
        ],
        supportedFilters: Array.from(adminAuditFilters),
        supportWorkflows: [
            'support_session',
            'invite_assistance',
            'access_recovery',
            'member_role_recovery',
            'impersonation',
            'support_inspection',
        ],
        blockerCatalog: [
            'support_role_required',
            'unsupported_audit_filter',
            'invalid_audit_filter',
            'audit_unavailable',
            'event_id_unavailable',
            'redaction_required',
        ],
        blockers,
        redactedSummary: summary,
        entityLinkRollup: supportAuditEntityLinkRollup(timeline),
        actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
        copyText: [
            'Support audit export proof',
            `Replay: ${replayQuery}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Requests: ${requestIds.join(', ') || 'none'}`,
            `Outcomes: ${summary.outcomes.join(', ') || 'none'}`,
            `Actions: ${summary.actions.join(', ') || 'none'}`,
            'Redacted: true',
        ].join('\n'),
        worker3: {
            readinessName: 'support-audit-export-proof',
            route: '/api/admin/audit-events',
            testCommand: 'cd api && bun run smoke:admin-support-unit',
            expectedResponsePath: 'detail.exportProof',
            validation: [
                'detail.exportProof.schemaVersion = support.audit.export_proof.v1',
                'detail.exportProof.immutableEventIds contains returned event ids',
                'detail.exportProof.replay.query is copy-ready',
                'detail.exportProof.redacted = true',
            ],
        },
    }
}

function supportAuditCompliancePacket(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const replayQuery = auditFilterQuery(filters)
    const eventIds = timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const summary = supportAuditRedactedSummary(timeline)
    const actions = uniqueTimelineValues(timeline.map(event => event.actionType || event.action))
    const reasonsPresent = timeline.filter(event => Boolean(text(event.reason))).length
    const blockers = [
        timeline.length ? '' : 'audit_unavailable',
        eventIds.length === timeline.length ? '' : 'event_id_unavailable',
        reasonsPresent === timeline.length ? '' : 'missing_reason_on_some_events',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.compliance_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        purpose: 'customer_support_evidence_review',
        route: '/api/admin/audit-events',
        replay: {
            query: replayQuery,
            filters,
            immutableEventIds: eventIds,
            detailRoutes: timeline.map(event => event.links?.detail).filter(Boolean),
        },
        evidence: {
            eventCount: timeline.length,
            actions,
            outcomes: summary.outcomes,
            severities: summary.severities,
            actorIds: summary.actorIds,
            targetIds: summary.targetIds,
            entityIds: summary.entityIds,
            requestIds: summary.requestIds,
            reasonsPresent,
            entityLinks: supportAuditEntityLinkRollup(timeline),
            actionEvidence: supportAuditActionEvidenceRollup(timeline),
        },
        redactionAttestation: {
            contextRedacted: true,
            beforeAfterRedacted: true,
            secretsExcluded: true,
            sensitiveFields: ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey', 'session', 'credential', 'webhookUrl', 'privateSourceUrl'],
        },
        blockerCatalog: [
            'audit_unavailable',
            'event_id_unavailable',
            'missing_reason_on_some_events',
            'missing_action_evidence',
            'redaction_required',
        ],
        blockers,
        copyText: [
            'Support audit compliance packet',
            `Replay: ${replayQuery}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Actions: ${actions.join(', ') || 'none'}`,
            `Outcomes: ${summary.outcomes.join(', ') || 'none'}`,
            `Reasons present: ${reasonsPresent}/${timeline.length}`,
            'Redacted: true',
        ].join('\n'),
    }
}

function supportAuditRedactedSummary(timeline: Array<Record<string, any>>) {
    return {
        eventCount: timeline.length,
        actions: uniqueTimelineValues(timeline.map(event => event.actionType)),
        outcomes: uniqueTimelineValues(timeline.map(event => event.outcome)),
        severities: uniqueTimelineValues(timeline.map(event => event.severity)),
        actorIds: uniqueTimelineValues(timeline.map(event => event.actor?.id)),
        targetIds: uniqueTimelineValues(timeline.map(event => event.target?.id)),
        entityIds: uniqueTimelineValues(timeline.map(event => event.entity?.id)),
        requestIds: uniqueTimelineValues(timeline.map(event => event.requestId)),
        reasonsPresent: timeline.filter(event => Boolean(event.reason)).length,
        actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
        entityLinks: supportAuditEntityLinkRollup(timeline),
        contextsRedacted: true,
    }
}

function supportAuditSupportWorkflowPacket(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const actionEvidenceRollup = supportAuditActionEvidenceRollup(timeline)
    const entityLinks = supportAuditEntityLinkRollup(timeline)
    const eventIds = timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const blockers = uniqueTimelineValues([
        timeline.length ? '' : 'missing_audit_events',
        ...actionEvidenceRollup.blockers,
    ].filter(Boolean))
    return {
        schemaVersion: 'support.audit.support_workflow_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        ok: !blockers.some(blocker => blocker !== 'redaction_required'),
        customerVisible: false,
        route: '/api/admin/support/inspect',
        auditRoute: auditFilterQuery(filters),
        detailRouteTemplate: '/api/admin/audit-events/:id',
        filters,
        evidence: {
            eventCount: timeline.length,
            eventIds,
            actionEvidenceRollup,
            entityLinks,
        },
        operatorContract: {
            requiredInputs: ['reason', 'context'],
            scopedInputs: ['scope', 'supportSessionId', 'durationMinutes', 'expiresAt', 'idempotencyKey'],
            guardedActions: ['invite_assist', 'invite_action', 'member_role_recovery', 'access_recovery', 'impersonation'],
            noSilentMutation: true,
            redactionRequired: true,
        },
        routes: {
            inspect: '/api/admin/support/inspect',
            audit: auditFilterQuery(filters),
            details: timeline.map(event => event.links?.detail).filter(Boolean),
            inviteActions: entityLinks.inviteAction,
            memberRoleRecovery: entityLinks.memberRoleRecovery,
            accessRecovery: entityLinks.accessRecovery,
            supportSessions: entityLinks.supportSession,
            impersonation: entityLinks.impersonation,
        },
        blockers,
        nextActions: supportAuditWorkflowNextActions(blockers, filters),
        copyText: [
            'Support workflow packet',
            `Audit route: ${auditFilterQuery(filters)}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function supportAuditActionEvidenceRollup(timeline: Array<Record<string, any>>) {
    const evidence = timeline
        .map(event => event.actionEvidence)
        .filter(item => item && typeof item === 'object') as Array<Record<string, any>>
    const eventIds = timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const missingEvidenceEventIds = timeline
        .filter(event => !event.actionEvidence)
        .map(event => event.id)
        .filter((id): id is number => Number.isFinite(id))
    const evidenceBlockers = uniqueTimelineValues(evidence.flatMap(item => Array.isArray(item.blockers) ? item.blockers : []))
    const reasonMissingEventIds = evidence
        .filter(item => item.controls?.reasonRequired && !item.reasonPresent)
        .map(item => Number(timeline.find(event => event.actionEvidence === item)?.id))
        .filter((id): id is number => Number.isFinite(id))
    const scopeMissingEventIds = evidence
        .filter(item => item.controls?.scopeRequired && !item.scope)
        .map(item => Number(timeline.find(event => event.actionEvidence === item)?.id))
        .filter((id): id is number => Number.isFinite(id))
    const durationMissingEventIds = evidence
        .filter(item => item.controls?.durationOrExpiryRequired && !item.durationMinutes && !item.expiresAt)
        .map(item => Number(timeline.find(event => event.actionEvidence === item)?.id))
        .filter((id): id is number => Number.isFinite(id))

    return {
        schemaVersion: 'support.audit.action_evidence_rollup.v1',
        eventCount: timeline.length,
        evidenceCount: evidence.length,
        eventIds,
        workflows: uniqueTimelineValues(evidence.map(item => item.workflow)),
        actionTypes: uniqueTimelineValues(evidence.map(item => item.actionType)),
        outcomes: uniqueTimelineValues(evidence.map(item => item.outcome)),
        supportSessionIds: uniqueTimelineValues(evidence.map(item => item.supportSessionId)),
        idempotencyKeys: uniqueTimelineValues(evidence.map(item => item.idempotencyKey)),
        reasonRequiredCount: evidence.filter(item => item.controls?.reasonRequired).length,
        reasonPresentCount: evidence.filter(item => item.reasonPresent).length,
        scopeRequiredCount: evidence.filter(item => item.controls?.scopeRequired).length,
        durationOrExpiryRequiredCount: evidence.filter(item => item.controls?.durationOrExpiryRequired).length,
        missingEvidenceEventIds,
        reasonMissingEventIds,
        scopeMissingEventIds,
        durationMissingEventIds,
        blockerCodes: evidenceBlockers,
        blockers: [
            missingEvidenceEventIds.length ? 'missing_action_evidence' : '',
            reasonMissingEventIds.length ? 'missing_reason_on_source_event' : '',
            scopeMissingEventIds.length ? 'missing_scope_on_source_event' : '',
            durationMissingEventIds.length ? 'missing_duration_or_expiry_on_source_event' : '',
            'redaction_required',
        ].filter(Boolean),
        redacted: true,
        copyText: [
            'Support audit action evidence rollup',
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Evidence: ${evidence.length}/${timeline.length}`,
            `Missing reason: ${reasonMissingEventIds.join(', ') || 'none'}`,
            `Missing scope: ${scopeMissingEventIds.join(', ') || 'none'}`,
            `Missing duration/expiry: ${durationMissingEventIds.join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function supportAuditWorkflowNextActions(blockers: string[], filters: Record<string, unknown>) {
    const actions = []
    if (blockers.includes('missing_audit_events')) {
        actions.push({
            ownerLane: 'support',
            action: 'inspect_support_filters',
            blockerCode: 'missing_audit_events',
            route: '/api/admin/support/inspect',
        })
    }
    if (blockers.includes('missing_action_evidence')) {
        actions.push({
            ownerLane: 'support',
            action: 'open_audit_timeline',
            blockerCode: 'missing_action_evidence',
            route: auditFilterQuery(filters),
        })
    }
    if (blockers.includes('missing_reason_on_source_event')) {
        actions.push({
            ownerLane: 'support',
            action: 'review_operator_rationale',
            blockerCode: 'missing_reason_on_source_event',
            route: auditFilterQuery({ ...filters, reason: '' }),
        })
    }
    if (blockers.includes('missing_scope_on_source_event') || blockers.includes('missing_duration_or_expiry_on_source_event')) {
        actions.push({
            ownerLane: 'support',
            action: 'review_scoped_session',
            blockerCode: blockers.includes('missing_scope_on_source_event') ? 'missing_scope_on_source_event' : 'missing_duration_or_expiry_on_source_event',
            route: auditFilterQuery(filters),
        })
    }
    return actions
}

function supportAuditEntityLinkRollup(timeline: Array<Record<string, any>>) {
    const links = timeline.map(event => event.links?.entities || {}).filter(item => item && typeof item === 'object')
    const valuesFor = (key: string) => uniqueTimelineValues(links.map(item => (item as Record<string, unknown>)[key]))
    return {
        schemaVersion: 'support.audit.entity_link_rollup.v1',
        inspection: valuesFor('inspection'),
        organization: valuesFor('organization'),
        user: valuesFor('user'),
        inviteAction: valuesFor('inviteAction'),
        accessRecovery: valuesFor('accessRecovery'),
        memberRoleRecovery: valuesFor('memberRoleRecovery'),
        impersonation: valuesFor('impersonation'),
        auditEntity: valuesFor('auditEntity'),
        member: valuesFor('member'),
        alert: valuesFor('alert'),
        watchlist: valuesFor('watchlist'),
        webhook: valuesFor('webhook'),
        supportSession: valuesFor('supportSession'),
        timelineFilters: uniqueTimelineValues(links.flatMap(item => {
            const filters = (item as Record<string, any>).timelineFilters
            if (!filters || typeof filters !== 'object') return []
            return Object.values(filters).filter(value => typeof value === 'string')
        })),
        redacted: true,
    }
}

function auditFilterQuery(filters: Record<string, unknown>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue
        params.set(key, String(value))
    }
    return `/api/admin/audit-events?${params.toString()}`
}

function uniqueTimelineValues(values: unknown[]) {
    return Array.from(new Set(values.map(value => text(value)).filter(Boolean))).slice(0, 50)
}

function auditEventScope(context: Record<string, unknown>) {
    return {
        durationMinutes: context.durationMinutes ?? null,
        scope: context.scope ?? null,
        targetUserId: context.targetUserId ?? null,
        organizationId: context.organizationId ?? null,
        expiresAt: context.expiresAt ?? null,
        requestId: context.requestId ?? null,
        supportContext: context.supportContext ?? null,
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

function supportAccessRecoveryApprovalTimeline(filters: Record<string, unknown>, approvals: Array<Record<string, any>>) {
    const auditFilters = accessRecoveryApprovalAuditFilters(filters)
    const timeline = approvals.map((approval) => {
        const actionType = approval.status === 'denied'
            ? 'support.organization.access_recovery.deny'
            : approval.status === 'approved'
                ? 'support.organization.access_recovery.approve'
                : 'support.organization.access_recovery.request'
        const auditEventIds = Array.isArray(approval.auditEventIds) ? approval.auditEventIds : []
        return {
            schemaVersion: 'admin.audit.timeline_event.v1',
            id: Number(auditEventIds[0] || 0),
            timestamp: approval.updatedAt || approval.createdAt,
            actionType,
            severity: approval.approvalRequired ? 'warning' : 'notice',
            outcome: approval.outcome || (approval.status === 'denied' ? 'denied' : 'success'),
            source: 'admin',
            service: 'hanasand-api',
            actor: {
                id: approval.approvedBy || approval.deniedBy || approval.requestedBy,
                name: null,
            },
            target: {
                type: 'invite',
                id: approval.inviteId,
                name: approval.invite?.email || null,
            },
            organization: {
                id: approval.organizationId,
                name: approval.organizationName || null,
            },
            entity: {
                id: approval.requestId,
                type: 'access_recovery_request',
            },
            requestId: approval.requestId,
            reason: approval.decisionReason || approval.requestedReason || '',
            scope: {
                approvalRequired: approval.approvalRequired,
                status: approval.status,
                expiresAt: approval.expiresAt,
            },
            before: null,
            after: {
                status: approval.status,
                outcome: approval.outcome,
                inviteStatus: approval.invite?.status || null,
            },
            context: {
                schemaVersion: 'support.access_recovery.approval_timeline.v1',
                requestId: approval.requestId,
                inviteId: approval.inviteId,
                targetUserId: approval.targetUserId || null,
                auditEventIds,
                redactionRequired: true,
            },
            links: {
                detail: auditEventIds[0] ? `/api/admin/audit-events/${encodeURIComponent(String(auditEventIds[0]))}` : null,
                request: `/api/admin/audit-events?request=${encodeURIComponent(String(approval.requestId))}&source=admin&service=hanasand-api`,
                entity: `/api/admin/audit-events?entity=${encodeURIComponent(String(approval.requestId))}&source=admin&service=hanasand-api`,
            },
        }
    })
    return {
        schemaVersion: 'support.access_recovery.approval_timeline.v1',
        filters,
        auditFilters,
        eventIds: timeline.map(event => event.id).filter(id => Number.isFinite(id) && id > 0),
        summary: auditTimelineSummary(timeline),
        filterContract: supportAuditFilterContract(auditFilters, timeline),
        exportProof: supportAuditExportProof(auditFilters, timeline),
        workflowRollup: supportAuditWorkflowRollup(auditFilters, timeline),
        events: timeline,
        redacted: true,
        links: {
            timeline: auditFilterQuery(auditFilters),
            details: timeline.map(event => event.links.detail).filter(Boolean),
        },
        copyText: [
            `Access recovery approval timeline: ${auditFilterQuery(auditFilters)}`,
            `Requests: ${approvals.map(approval => approval.requestId).filter(Boolean).join(', ') || 'none'}`,
            `Audit events: ${timeline.flatMap(event => event.context.auditEventIds || []).join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function accessRecoveryApprovalAuditFilters(filters: Record<string, unknown>) {
    return {
        org: filters.org || '',
        request: filters.request || '',
        action: 'support.organization.access_recovery',
        outcome: filters.outcome || '',
        source: 'admin',
        service: 'hanasand-api',
        from: filters.from || '',
        to: filters.to || '',
        limit: filters.limit || '',
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

function supportInspectionAuditMetadata(req: FastifyRequest) {
    const query = req.query as Record<string, unknown>
    return {
        requestId: text(query.request || query.requestId) || supportRequestId(req),
        reason: text(query.reason),
        supportContext: cleanContext(query.context),
    }
}

function supportInspectionAuditContext(input: { requestId: string, reason: string, supportContext: string }, extra: Record<string, unknown>) {
    return {
        schemaVersion: 'support.inspection.audit_context.v1',
        requestId: input.requestId,
        reasonProvided: Boolean(input.reason),
        supportContext: input.supportContext || null,
        redactionRequired: true,
        ...extra,
    }
}

function supportRequestId(req: FastifyRequest) {
    const header = req.headers['x-request-id']
    if (Array.isArray(header)) return header[0] || req.id
    return header || req.id
}

function headerText(value: string | string[] | undefined) {
    return Array.isArray(value) ? text(value[0]) : text(value)
}

function supportSessionIdFromRequest(req: FastifyRequest, body: { supportSessionId?: unknown, support_session_id?: unknown } | undefined) {
    return text(headerText(req.headers['x-support-session-id']) || body?.supportSessionId || body?.support_session_id)
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
