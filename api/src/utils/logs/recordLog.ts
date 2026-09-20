import run from '#db'
import { redactLogText, redactLogValue } from './redact.ts'
import { accessFromLog } from '../mill/analyzeAccess.ts'
import { analyzeAccess } from '../mill/analyzeLog.ts'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

function isOrganizationRequest(metadata: Record<string, unknown>) {
    if (metadata.surface === 'organizations') return true
    return [metadata.path, metadata.url].some(value => {
        if (typeof value !== 'string') return false
        let path = value.split(/[?#]/, 1)[0]
        try {
            path = new URL(value, 'https://hanasand.invalid').pathname
        } catch {
            // The raw path is enough for the prefix check below.
        }
        return path === '/api/organizations'
            || path.startsWith('/api/organizations/')
            || path === '/api/admin/support/organizations'
            || path.startsWith('/api/admin/support/organizations/')
    })
}

export default async function recordLog({
    service = process.env.SERVICE_NAME || 'hanasand-api',
    host = process.env.HOSTNAME || 'local',
    level,
    message,
    metadata = {},
    sourceEventId,
    timestamp,
}: {
    service?: string
    host?: string
    level: LogLevel
    message: string
    metadata?: Record<string, unknown>
    sourceEventId?: string
    timestamp?: string
}, query: typeof run = run) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) metadata = {}
    const access = accessFromLog({ service, level, metadata, sourceEventId, timestamp })
    if (access && await analyzeAccess(access, query === run ? undefined : query)) return
    message = redactLogText(message)
    metadata = redactLogValue(metadata) as Record<string, unknown>
    const scopeId = typeof metadata.organizationId === 'string' && metadata.organizationId
        ? metadata.organizationId
        : typeof metadata.tenantId === 'string' && metadata.tenantId
            ? metadata.tenantId
            : null
    if (!scopeId && isOrganizationRequest(metadata)) {
        service = 'hanasand-api'
        host = ''
        level = 'error'
        message = 'organization_request_error'
        metadata = { category: 'organization_request_error', surface: 'organizations' }
    }

    await query(`
        WITH organization_privacy AS MATERIALIZED (
            SELECT status, audit_safe_metadata
              FROM organizations
             WHERE id = $6
             FOR KEY SHARE
        )
        INSERT INTO service_logs (service, host, level, message, metadata, source_event_id, created_at)
        SELECT
            CASE WHEN private.deleted THEN 'hanasand-api' ELSE $1 END,
            CASE WHEN private.deleted THEN '' ELSE $2 END,
            CASE WHEN private.deleted THEN 'info' ELSE $3 END,
            CASE WHEN private.deleted THEN 'organization_event' ELSE $4 END,
            CASE WHEN private.deleted THEN jsonb_strip_nulls(jsonb_build_object(
                'category', 'organization_privacy',
                'action', 'post_delete_event',
                'organizationId', $6::text,
                'tenantId', $6::text,
                'outcome', 'recorded',
                'privacyDeletionRunId', private.privacy_deletion_run_id
            )) ELSE $5::jsonb END,
            $7, COALESCE($8::timestamptz, NOW())
        FROM (
            SELECT
                COALESCE((SELECT status = 'deleted' OR (audit_safe_metadata ? 'privacyDeletedAt') FROM organization_privacy), FALSE) deleted,
                (SELECT audit_safe_metadata->>'privacyDeletionRunId' FROM organization_privacy) privacy_deletion_run_id
        ) private
        ON CONFLICT (source_event_id) DO NOTHING
    `, [service, host, level, message, JSON.stringify(metadata), scopeId, sourceEventId || null, timestamp || null])
}
