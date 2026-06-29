import type { FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { actorHasAdminSupportAccess, recordAdminAuditEvent, requireAuditReason } from '#utils/adminAudit.ts'

type StartBody = {
    target_id?: string
    targetId?: string
    target_user_id?: string
    reason?: string
    duration_minutes?: number | string
    durationMinutes?: number | string
    scope?: unknown
    organization_id?: string
    organizationId?: string
    orgId?: string
    supportSessionId?: string
    support_session_id?: string
}
type StopBody = {
    reason?: string
    context?: unknown
}
type EventQuery = {
    q?: string
    actor?: string
    target?: string
    action?: string
    outcome?: string
    method?: string
    path?: string
    session?: string
    from?: string
    to?: string
    limit?: string
}

function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

async function getActiveUser(id: string) {
    const result = await run(`
        SELECT id, name, avatar
        FROM users
        WHERE id = $1
          AND active IS TRUE
          AND deletion_scheduled_at IS NULL
        LIMIT 1
    `, [id])
    return result.rows[0] as { id: string, name: string, avatar?: string | null } | undefined
}

async function audit(req: FastifyRequest, sessionId: string | null, actorId: string, targetId: string, actionPath: string, actionType: string, reason?: string, context: Record<string, unknown> = {}) {
    await run(`
        INSERT INTO impersonation_events (session_id, actor_id, target_id, method, path, ip, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
        sessionId,
        actorId,
        targetId,
        req.method || '',
        actionPath,
        req.ip,
        String(req.headers['user-agent'] || ''),
    ]).catch(error => {
        req.log.warn({ error, actorId, targetId, actionPath }, 'Failed to audit impersonation lifecycle event')
    })
    const requestId = supportRequestId(req)
    await recordAdminAuditEvent(req, {
        actionType,
        actorId,
        targetType: 'user',
        targetId,
        entityId: sessionId || targetId,
        severity: actionType.endsWith('.start') ? 'warning' : 'notice',
        outcome: 'success',
        reason,
        requestId,
        context: {
            sessionId,
            path: actionPath,
            ...context,
        },
    })
    const eventIds = await loadAdminAuditEventIds({
        requestId,
        actionType,
        entityId: sessionId || targetId,
    })
    return { requestId, eventIds }
}

async function auditDeniedImpersonationStart(req: FastifyRequest, input: {
    actorId: string
    targetId: string
    organizationId: string
    supportSessionId: string
    reason: string
    blocker: string
    message: string
    scope: string[]
    durationMinutes: number | null
    expiresAt: string | null
}) {
    const requestId = supportRequestId(req)
    await recordAdminAuditEvent(req, {
        actionType: 'impersonation.start',
        actorId: input.actorId,
        targetType: 'user',
        targetId: input.targetId,
        organizationId: input.organizationId || null,
        entityId: input.supportSessionId || input.targetId,
        severity: 'warning',
        outcome: 'denied',
        reason: input.reason,
        requestId,
        context: {
            schemaVersion: 'support.impersonation.denied.v1',
            requestId,
            targetUserId: input.targetId,
            organizationId: input.organizationId || null,
            supportSessionId: input.supportSessionId || null,
            blockerCode: input.blocker,
            message: input.message,
            scope: input.scope,
            durationMinutes: input.durationMinutes,
            expiresAt: input.expiresAt,
            outcome: 'denied',
            noSilentImpersonation: true,
            redactionRequired: true,
        },
    })
    const eventIds = await loadAdminAuditEventIds({
        requestId,
        actionType: 'impersonation.start',
        entityId: input.supportSessionId || input.targetId,
    })
    return { requestId, eventIds, message: input.message }
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
        actorId: cleanText(create.actor_id),
        reason: cleanText(create.reason),
        requestId: cleanText(create.request_id),
        organizationId: cleanText(context.targetOrganizationId || create.organization_id),
        targetUserId: cleanText(context.targetUserId || create.target_id),
        allowedActions: Array.isArray(context.allowedActions) ? context.allowedActions.map(action => cleanText(action)).filter(Boolean) : [],
        scope: Array.isArray(context.scope) ? context.scope.map(item => cleanText(item)).filter(Boolean) : [],
        expiresAt: cleanText(context.expiresAt),
        status: revoke ? 'revoked' : Date.parse(cleanText(context.expiresAt)) <= Date.now() ? 'expired' : 'active',
    }
}

async function validateSupportSessionForImpersonation(input: {
    actorId: string
    targetUserId: string
    organizationId: string
    supportSessionId: string
    scope: string[]
    expiresAt: string
}) {
    if (!input.supportSessionId) {
        return { error: null as { code: string, message: string, status: number } | null }
    }

    const state = await loadSupportSessionState(input.supportSessionId)
    if (!state) {
        return { error: { code: 'support_session_not_found', message: 'Support session not found.', status: 404 } }
    }
    if (state.status === 'revoked') {
        return { error: { code: 'support_session_revoked', message: 'Support session has been revoked.', status: 409 } }
    }
    if (state.status === 'expired') {
        return { error: { code: 'support_session_expired', message: 'Support session has expired.', status: 409 } }
    }
    if (state.actorId && state.actorId !== input.actorId) {
        return { error: { code: 'support_session_actor_mismatch', message: 'Support session belongs to a different support actor.', status: 403 } }
    }
    if (state.organizationId && !input.organizationId) {
        return { error: { code: 'support_session_org_required', message: 'Support session is scoped to an organization; include organizationId when starting impersonation.', status: 400 } }
    }
    if (state.organizationId && input.organizationId && state.organizationId !== input.organizationId) {
        return { error: { code: 'support_session_org_mismatch', message: 'Support session is not scoped to this organization.', status: 403 } }
    }
    if (state.targetUserId && state.targetUserId !== input.targetUserId) {
        return { error: { code: 'support_session_user_mismatch', message: 'Support session is not scoped to this target user.', status: 403 } }
    }
    if (!state.allowedActions.includes('impersonation')) {
        return { error: { code: 'support_session_action_denied', message: 'Support session does not allow impersonation.', status: 403 } }
    }
    const missingScope = input.scope.find(item => !state.scope.includes(item))
    if (missingScope) {
        return { error: { code: 'support_session_scope_denied', message: `Support session does not include impersonation scope ${missingScope}.`, status: 403 } }
    }
    const supportSessionExpiry = Date.parse(state.expiresAt)
    if (!Number.isNaN(supportSessionExpiry) && Date.parse(input.expiresAt) > supportSessionExpiry) {
        return { error: { code: 'support_session_duration_exceeds_scope', message: 'Impersonation expiry cannot exceed the scoped support session expiry.', status: 400 } }
    }
    return { error: null }
}

export async function startImpersonation(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id || actor.impersonating) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }
    const body = req.body as StartBody | undefined
    const targetId = cleanText(body?.target_id || body?.targetId || body?.target_user_id)
    if (!await actorHasAdminSupportAccess(actor.id)) {
        await recordAdminAuditEvent(req, {
            actionType: 'impersonation.start',
            actorId: actor.id,
            targetType: 'user',
            targetId: targetId || null,
            severity: 'warning',
            outcome: 'denied',
            context: { error: 'missing_admin_role' },
        })
        return res.status(403).send(impersonationError('impersonation_support_required', 'Only admins can impersonate users.'))
    }

    if (!targetId) {
        return res.status(400).send(impersonationError('missing_target_user', 'Missing target user.'))
    }
    if (targetId === actor.id) {
        return res.status(400).send(impersonationError('invalid_target_user', 'You are already viewing your own account.'))
    }

    const target = await getActiveUser(targetId)
    if (!target) {
        return res.status(404).send(impersonationError('target_user_not_found', 'Impersonated user not found.'))
    }

    let reason: string
    let durationMinutes: number
    let scope: string[]
    const organizationId = cleanText(body?.organization_id || body?.organizationId || body?.orgId)
    const supportSessionId = supportSessionIdFromRequest(req, body)
    try {
        reason = requireAuditReason(body?.reason, 'Impersonation reason')
        durationMinutes = normalizeDurationMinutes(body?.duration_minutes ?? body?.durationMinutes)
        scope = normalizeImpersonationScope(body?.scope)
    } catch (error) {
        const auditTrail = await auditDeniedImpersonationStart(req, {
            actorId: actor.id,
            targetId: target.id,
            organizationId,
            supportSessionId,
            reason: cleanText(body?.reason),
            blocker: 'invalid_impersonation_request',
            message: error instanceof Error ? error.message : 'Invalid impersonation request.',
            scope: [],
            durationMinutes: null,
            expiresAt: null,
        })
        return res.status(400).send(impersonationError('invalid_impersonation_request', auditTrail.message, {
            requestId: auditTrail.requestId,
            auditEventIds: auditTrail.eventIds,
        }))
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
    const sessionGuard = await validateSupportSessionForImpersonation({
        actorId: actor.id,
        targetUserId: target.id,
        organizationId,
        supportSessionId,
        scope,
        expiresAt: expiresAt.toISOString(),
    })
    if (sessionGuard.error) {
        const auditTrail = await auditDeniedImpersonationStart(req, {
            actorId: actor.id,
            targetId: target.id,
            organizationId,
            supportSessionId,
            reason,
            blocker: sessionGuard.error.code,
            message: sessionGuard.error.message,
            scope,
            durationMinutes,
            expiresAt: expiresAt.toISOString(),
        })
        return res.status(sessionGuard.error.status).send(impersonationError(sessionGuard.error.code, sessionGuard.error.message, {
            requestId: auditTrail.requestId,
            auditEventIds: auditTrail.eventIds,
            supportSessionId: supportSessionId || null,
        }))
    }

    const rawToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
    const session = await run(`
        INSERT INTO impersonation_sessions (token_hash, actor_id, target_id, reason, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, expires_at
    `, [hashToken(rawToken), actor.id, target.id, reason, expiresAt.toISOString()])
    const row = session.rows[0] as { id: string, created_at: string, expires_at: string }
    const auditTrail = await audit(req, row.id, actor.id, target.id, '/api/impersonation/start', 'impersonation.start', reason, {
        schemaVersion: 'support.impersonation.request.v1',
        requestId: supportRequestId(req),
        targetUserId: target.id,
        organizationId: organizationId || null,
        supportSessionId: supportSessionId || null,
        durationMinutes,
        scope,
        expiresAt: expiresAt.toISOString(),
        approvalRequired: false,
        approvalStatus: 'not_required',
        outcome: 'success',
        noSilentImpersonation: true,
    })

    return res.send({
        token: rawToken,
        session: {
            id: row.id,
            actor_id: actor.id,
            target,
            reason,
            duration_minutes: durationMinutes,
            scope,
            support_session_id: supportSessionId || null,
            supportSessionId: supportSessionId || null,
            organization_id: organizationId || null,
            created_at: row.created_at,
            expires_at: row.expires_at,
        },
        requestId: auditTrail.requestId,
        outcome: 'success',
        auditEventIds: auditTrail.eventIds,
        impersonationRequest: {
            schemaVersion: 'support.impersonation.request.v1',
            requestId: auditTrail.requestId,
            actorId: actor.id,
            targetUserId: target.id,
            organizationId: organizationId || null,
            supportSessionId: supportSessionId || null,
            reason,
            scope,
            durationMinutes,
            expiresAt: row.expires_at,
            approvalRequired: false,
            approvalStatus: 'not_required',
            outcome: 'success',
            auditEventIds: auditTrail.eventIds,
            audit: auditLink('impersonation.start', auditTrail.requestId, auditTrail.eventIds),
        },
        audit: auditLink('impersonation.start', auditTrail.requestId, auditTrail.eventIds),
    })
}

export async function stopImpersonation(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.authenticatedId) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }

    const body = req.body as StopBody | undefined
    const stopReason = cleanText(body?.reason) || 'Support ended impersonation session.'
    const stopContext = cleanStopContext(body?.context)
    const token = String(req.headers['x-impersonation-token'] || '')
    if (!token) {
        return res.send({ ok: true })
    }

    const result = await run(`
        UPDATE impersonation_sessions
        SET revoked_at = NOW(),
            revoked_by = $2
        WHERE token_hash = $1
          AND actor_id = $2
          AND revoked_at IS NULL
        RETURNING id, actor_id, target_id, reason, created_at, expires_at, revoked_at
    `, [hashToken(token), actor.authenticatedId])
    const row = result.rows[0] as { id: string, actor_id: string, target_id: string, reason?: string | null, created_at?: string, expires_at?: string, revoked_at?: string } | undefined
    if (row) {
        const auditTrail = await audit(req, row.id, row.actor_id, row.target_id, '/api/impersonation/stop', 'impersonation.stop', stopReason, {
            schemaVersion: 'support.impersonation.stop.v1',
            requestId: supportRequestId(req),
            targetUserId: row.target_id,
            startReason: row.reason || null,
            stopReason,
            supportContext: stopContext || null,
            createdAt: row.created_at || null,
            expiresAt: row.expires_at || null,
            revokedAt: row.revoked_at || null,
            outcome: 'success',
            noSilentImpersonation: true,
        })
        return res.send({
            ok: true,
            requestId: auditTrail.requestId,
            auditEventIds: auditTrail.eventIds,
            impersonationStop: {
                schemaVersion: 'support.impersonation.stop.v1',
                requestId: auditTrail.requestId,
                sessionId: row.id,
                actorId: row.actor_id,
                targetUserId: row.target_id,
                reason: stopReason,
                supportContext: stopContext || null,
                createdAt: row.created_at || null,
                expiresAt: row.expires_at || null,
                revokedAt: row.revoked_at || null,
                outcome: 'success',
                auditEventIds: auditTrail.eventIds,
                audit: auditLink('impersonation.stop', auditTrail.requestId, auditTrail.eventIds),
            },
            audit: auditLink('impersonation.stop', auditTrail.requestId, auditTrail.eventIds),
        })
    }
    return res.send({ ok: true })
}

export async function getImpersonationEvents(req: FastifyRequest, res: FastifyReply) {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id || actor.impersonating) {
        return res.status(401).send({ error: actor.error || 'Unauthorized.' })
    }
    if (!await actorHasAdminSupportAccess(actor.id)) {
        return res.status(403).send({ error: 'Only admins can view impersonation history.' })
    }

    const query = req.query as EventQuery
    const where: string[] = []
    const values: Array<string | number | boolean | string[] | Date | null> = []
    const add = (value: string | number | boolean | string[] | Date | null) => {
        values.push(value)
        return `$${values.length}`
    }
    const q = String(query.q || '').trim()
    const actorFilter = String(query.actor || '').trim()
    const targetFilter = String(query.target || '').trim()
    const actionFilter = String(query.action || '').trim().toLowerCase()
    const outcomeFilter = String(query.outcome || '').trim().toLowerCase()
    const methodFilter = String(query.method || '').trim().toUpperCase()
    const pathFilter = String(query.path || '').trim()
    const sessionFilter = String(query.session || '').trim()
    const fromFilter = String(query.from || '').trim()
    const toFilter = String(query.to || '').trim()
    const parsedLimit = Number(query.limit || 200)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500) : 200

    if (q) {
        const placeholder = add(`%${q}%`)
        where.push(`(
            e.actor_id ILIKE ${placeholder}
            OR actor.name ILIKE ${placeholder}
            OR e.target_id ILIKE ${placeholder}
            OR target.name ILIKE ${placeholder}
            OR e.path ILIKE ${placeholder}
            OR e.method ILIKE ${placeholder}
            OR e.ip ILIKE ${placeholder}
            OR e.user_agent ILIKE ${placeholder}
            OR e.session_id::text ILIKE ${placeholder}
        )`)
    }
    if (actorFilter) {
        const placeholder = add(`%${actorFilter}%`)
        where.push('(e.actor_id ILIKE ' + placeholder + ' OR actor.name ILIKE ' + placeholder + ')')
    }
    if (targetFilter) {
        const placeholder = add(`%${targetFilter}%`)
        where.push('(e.target_id ILIKE ' + placeholder + ' OR target.name ILIKE ' + placeholder + ')')
    }
    if (actionFilter && !['impersonation.start', 'impersonation.stop', 'start', 'stop'].includes(actionFilter)) {
        return res.status(400).send(impersonationError('unsupported_impersonation_action_filter', 'Unsupported impersonation action filter.', {
            supportedValues: ['impersonation.start', 'impersonation.stop'],
        }))
    }
    if (outcomeFilter && outcomeFilter !== 'success') {
        return res.status(400).send(impersonationError('unsupported_impersonation_outcome_filter', 'Impersonation lifecycle history only stores successful lifecycle events; use admin audit events for denied attempts.', {
            supportedValues: ['success'],
            auditRoute: '/api/admin/audit-events?action=impersonation&outcome=denied&source=admin&service=hanasand-api',
        }))
    }
    if (actionFilter) {
        where.push(`e.path ILIKE ${add(actionFilter.endsWith('stop') ? '%/stop%' : '%/start%')}`)
    }
    if (methodFilter) {
        where.push(`e.method = ${add(methodFilter)}`)
    }
    if (pathFilter) {
        where.push(`e.path ILIKE ${add(`%${pathFilter}%`)}`)
    }
    if (sessionFilter) {
        where.push(`e.session_id::text ILIKE ${add(`%${sessionFilter}%`)}`)
    }
    if (fromFilter && !Number.isNaN(Date.parse(fromFilter))) {
        where.push(`e.created_at >= ${add(new Date(fromFilter).toISOString())}`)
    }
    if (toFilter && !Number.isNaN(Date.parse(toFilter))) {
        where.push(`e.created_at <= ${add(new Date(toFilter).toISOString())}`)
    }

    const result = await run(`
        SELECT
            e.id,
            e.session_id,
            e.actor_id,
            actor.name AS actor_name,
            e.target_id,
            target.name AS target_name,
            e.method,
            e.path,
            e.ip,
            e.user_agent,
            e.created_at
        FROM impersonation_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target ON target.id = e.target_id
        ${where.length ? `WHERE ${where.join('\n          AND ')}` : ''}
        ORDER BY e.created_at DESC
        LIMIT ${add(limit)}
    `, values)
    const filters = { q, actor: actorFilter, target: targetFilter, action: actionFilter, outcome: outcomeFilter || 'success', method: methodFilter, path: pathFilter, session: sessionFilter, from: fromFilter, to: toFilter, limit }
    const timeline = result.rows.map(toImpersonationTimelineEvent)
    return res.send({
        events: result.rows,
        filters,
        timeline: {
            schemaVersion: 'support.impersonation.timeline.v1',
            filters,
            eventIds: timeline.map(event => event.id),
            summary: impersonationTimelineSummary(timeline),
            events: timeline,
            redacted: true,
            links: {
                audit: `/api/admin/audit-events?action=impersonation&source=admin&service=hanasand-api${sessionFilter ? `&entity=${encodeURIComponent(sessionFilter)}` : ''}`,
                details: timeline.map(event => event.links.detail),
            },
            copyText: timeline.map(event => event.copyText).join('\n'),
        },
    })
}

function toImpersonationTimelineEvent(row: Record<string, any>) {
    const actionType = String(row.path || '').includes('/stop') ? 'impersonation.stop' : 'impersonation.start'
    const id = Number(row.id)
    return {
        schemaVersion: 'support.impersonation.timeline_event.v1',
        id,
        timestamp: row.created_at,
        actionType,
        severity: actionType === 'impersonation.start' ? 'warning' : 'notice',
        outcome: 'success',
        actor: {
            id: row.actor_id,
            name: row.actor_name || null,
        },
        target: {
            type: 'user',
            id: row.target_id,
            name: row.target_name || null,
        },
        entity: {
            type: 'impersonation_session',
            id: row.session_id || null,
        },
        method: row.method,
        path: row.path,
        links: {
            detail: `/api/impersonation/events?session=${encodeURIComponent(String(row.session_id || ''))}`,
            audit: `/api/admin/audit-events?action=${encodeURIComponent(actionType)}&entity=${encodeURIComponent(String(row.session_id || ''))}&source=admin&service=hanasand-api`,
        },
        copyText: `${row.created_at} ${actionType} actor=${row.actor_id} target=${row.target_id} session=${row.session_id || ''}`,
    }
}

function impersonationTimelineSummary(timeline: Array<Record<string, any>>) {
    const unique = (values: unknown[]) => Array.from(new Set(values.map(value => cleanText(value)).filter(Boolean))).slice(0, 50)
    return {
        eventCount: timeline.length,
        actionTypes: unique(timeline.map(event => event.actionType)),
        actorIds: unique(timeline.map(event => event.actor?.id)),
        targetIds: unique(timeline.map(event => event.target?.id)),
        sessionIds: unique(timeline.map(event => event.entity?.id)),
        outcomes: unique(timeline.map(event => event.outcome)),
    }
}

function normalizeDurationMinutes(value: unknown) {
    if (value === undefined || value === null || value === '') {
        throw new Error('Impersonation duration is required.')
    }
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed !== Math.trunc(parsed)) {
        throw new Error('Impersonation duration must be a whole number of minutes.')
    }

    if (parsed < 5 || parsed > 240) {
        throw new Error('Impersonation duration must be between 5 and 240 minutes.')
    }
    return parsed
}

function normalizeImpersonationScope(value: unknown) {
    const allowed = new Set(['read_profile', 'read_org', 'support_debug'])
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
    if (!raw.length) {
        throw new Error('Impersonation scope is required.')
    }
    const unsupported = raw
        .map(item => typeof item === 'string' ? item.trim().toLowerCase() : '')
        .filter(item => !allowed.has(item))
    if (unsupported.length) {
        throw new Error(`Unsupported impersonation scope: ${unsupported[0] || 'blank'}.`)
    }
    const scope = raw
        .map(item => typeof item === 'string' ? item.trim().toLowerCase() : '')
        .filter(item => allowed.has(item))
    return Array.from(new Set(scope))
}

function auditLink(actionType: string, requestId: string, eventIds: number[] = []) {
    return {
        actionType,
        requestId,
        eventIds,
        href: `/dashboard/system/impersonation?request=${encodeURIComponent(requestId)}&action=${encodeURIComponent(actionType)}&source=admin&service=hanasand-api`,
        api: `/api/admin/audit-events?request=${encodeURIComponent(requestId)}&action=${encodeURIComponent(actionType)}&source=admin&service=hanasand-api`,
    }
}

function supportRequestId(req: FastifyRequest) {
    const header = req.headers['x-request-id']
    if (Array.isArray(header)) return header[0] || req.id
    return header || req.id
}

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function cleanStopContext(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 1000) : ''
}

function impersonationError(code: string, message: string, detail: Record<string, unknown> = {}) {
    return {
        error: message,
        detail: {
            schemaVersion: 'support.impersonation.error.v1',
            code,
            outcome: 'denied',
            ...detail,
        },
    }
}

function supportSessionIdFromRequest(req: FastifyRequest, body: StartBody | undefined) {
    return cleanText(headerText(req.headers['x-support-session-id']) || body?.supportSessionId || body?.support_session_id)
}

function headerText(value: string | string[] | undefined) {
    return Array.isArray(value) ? cleanText(value[0]) : cleanText(value)
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

export async function getImpersonationCurrent(req: FastifyRequest, res: FastifyReply) {
    const token = String(req.headers['x-impersonation-token'] || '')
    if (!token) {
        return res.send({ active: false })
    }
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.impersonating) {
        return res.status(401).send({ error: actor.error || 'Invalid impersonation session.' })
    }
    return res.send({
        active: true,
        actor_id: actor.authenticatedId,
        target_id: actor.id,
    })
}
