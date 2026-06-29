import type { FastifyRequest } from 'fastify'
import run from '#db'

export type AdminAuditSeverity = 'info' | 'notice' | 'warning' | 'critical'
export type AdminAuditOutcome = 'success' | 'denied' | 'failed'

export type AdminAuditEventInput = {
    actionType: string
    actorId: string
    source?: string | null
    service?: string | null
    targetType?: string | null
    targetId?: string | null
    organizationId?: string | null
    entityId?: string | null
    severity?: AdminAuditSeverity
    outcome?: AdminAuditOutcome
    reason?: string | null
    requestId?: string | null
    context?: Record<string, unknown>
}

export type SupportTimelineAuditBridgeInput = {
    workflow: 'organization' | 'watchlist' | 'webhook' | 'alert' | 'impersonation' | 'support'
    action: string
    actorId: string
    targetType: string
    targetId: string
    organizationId?: string | null
    entityId?: string | null
    requestId?: string | null
    severity?: AdminAuditSeverity
    outcome?: AdminAuditOutcome
    reason?: string | null
    source?: string | null
    service?: string | null
    scope?: unknown
    before?: unknown
    after?: unknown
    context?: Record<string, unknown>
    correlationId?: string | null
    idempotencyKey?: string | null
}

export function cleanAuditReason(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 1000) : ''
}

export function requireAuditReason(value: unknown, label = 'Reason') {
    const reason = cleanAuditReason(value)
    if (reason.length < 10) {
        throw new Error(`${label} must be at least 10 characters.`)
    }
    return reason
}

const sensitiveAuditKeyPattern = /(password|token|secret|authorization|cookie|apikey|api_key|session|credential|webhook|endpoint|url|source_url|sourceurl|private_url|privateurl)/i

export function redactAuditValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(item => redactAuditValue(item))
    }
    if (!value || typeof value !== 'object') {
        return value
    }
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sensitiveAuditKeyPattern.test(key) ? '[redacted]' : redactAuditValue(item),
    ]))
}

export function supportTimelineAuditBridgeEvent(input: SupportTimelineAuditBridgeInput): AdminAuditEventInput {
    const action = cleanAuditAction(input.action)
    const workflow = cleanAuditDimension(input.workflow) || 'support'
    const actionType = action.includes('.') ? action : `${workflow}.${action}`
    const entityId = cleanAuditId(input.entityId) || cleanAuditId(input.targetId) || cleanAuditId(input.organizationId)
    const organizationId = cleanAuditId(input.organizationId)
    const requestId = cleanAuditId(input.requestId)
    const correlationId = cleanAuditId(input.correlationId) || requestId
    const idempotencyKey = cleanAuditId(input.idempotencyKey)

    return {
        actionType,
        actorId: cleanAuditId(input.actorId),
        targetType: cleanAuditDimension(input.targetType) || workflow,
        targetId: cleanAuditId(input.targetId),
        organizationId: organizationId || null,
        entityId: entityId || null,
        requestId: requestId || null,
        severity: input.severity || 'info',
        outcome: input.outcome || 'success',
        reason: cleanAuditReason(input.reason),
        source: cleanAuditDimension(input.source) || workflow,
        service: cleanAuditDimension(input.service) || 'hanasand-api',
        context: {
            ...(input.context || {}),
            schemaVersion: 'support.audit.bridge_event.v1',
            workflow,
            action,
            actionType,
            actor: {
                id: cleanAuditId(input.actorId),
            },
            target: {
                type: cleanAuditDimension(input.targetType) || workflow,
                id: cleanAuditId(input.targetId),
            },
            organizationId: organizationId || null,
            entityId: entityId || null,
            requestId: requestId || null,
            correlationId: correlationId || null,
            idempotencyKey: idempotencyKey || null,
            scope: redactAuditValue(input.scope ?? null),
            before: redactAuditValue(input.before ?? null),
            after: redactAuditValue(input.after ?? null),
            supportTimeline: {
                schemaVersion: 'support.audit.timeline_adapter.v1',
                filters: {
                    org: organizationId || null,
                    actor: cleanAuditId(input.actorId),
                    target: cleanAuditId(input.targetId),
                    action: actionType,
                    entity: entityId || null,
                    request: requestId || null,
                    outcome: input.outcome || 'success',
                    severity: input.severity || 'info',
                    source: cleanAuditDimension(input.source) || workflow,
                    service: cleanAuditDimension(input.service) || 'hanasand-api',
                },
                detailRouteTemplate: '/api/admin/audit-events/:id',
                redactionRequired: true,
            },
            redactionRequired: true,
        },
    }
}

export async function actorHasAdminSupportAccess(actorId: string) {
    const result = await run(`
        SELECT r.id, r.name
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
    `, [actorId])

    return result.rows.some((role: { id: string, name?: string }) => {
        const id = role.id.toLowerCase()
        const name = (role.name || '').toLowerCase()
        return id === 'administrator'
            || id === 'system_admin'
            || id === 'user_admin'
            || id.includes('admin')
            || name.includes('admin')
    })
}

export async function recordAdminAuditEvent(req: FastifyRequest, input: AdminAuditEventInput) {
    const requestId = input.requestId || requestIdFrom(req)
    await run(`
        INSERT INTO admin_audit_events (
            action_type,
            severity,
            source,
            service,
            actor_id,
            target_type,
            target_id,
            organization_id,
            entity_id,
            request_id,
            outcome,
            reason,
            context,
            ip,
            user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
    `, [
        input.actionType,
        input.severity || 'info',
        cleanAuditDimension(input.source) || 'admin',
        cleanAuditDimension(input.service) || 'hanasand-api',
        input.actorId,
        input.targetType || null,
        input.targetId || null,
        input.organizationId || null,
        input.entityId || input.targetId || input.organizationId || null,
        requestId,
        input.outcome || 'success',
        cleanAuditReason(input.reason),
        JSON.stringify(input.context || {}),
        req.ip,
        String(req.headers['user-agent'] || ''),
    ]).catch(error => {
        req.log.warn({ error, actionType: input.actionType, actorId: input.actorId }, 'Failed to write admin audit event')
    })
}

function cleanAuditDimension(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, '-').slice(0, 80) : ''
}

function cleanAuditAction(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/_+/g, '_').slice(0, 120) : 'event'
}

function cleanAuditId(value: unknown) {
    return typeof value === 'string' ? value.trim().slice(0, 200) : ''
}

function requestIdFrom(req: FastifyRequest) {
    const header = req.headers['x-request-id']
    if (Array.isArray(header)) return header[0] || null
    return header || req.id || null
}
