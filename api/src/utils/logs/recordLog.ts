import run from '#db'

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
}: {
    service?: string
    host?: string
    level: LogLevel
    message: string
    metadata?: Record<string, unknown>
}) {
    if (!metadata || Array.isArray(metadata)) metadata = {}
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

    await run(`
        WITH organization_privacy AS MATERIALIZED (
            SELECT status, audit_safe_metadata
              FROM organizations
             WHERE id = $6
             FOR KEY SHARE
        )
        INSERT INTO service_logs (service, host, level, message, metadata)
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
            )) ELSE $5::jsonb END
        FROM (
            SELECT
                COALESCE((SELECT status = 'deleted' OR (audit_safe_metadata ? 'privacyDeletedAt') FROM organization_privacy), FALSE) deleted,
                (SELECT audit_safe_metadata->>'privacyDeletionRunId' FROM organization_privacy) privacy_deletion_run_id
        ) private
    `, [service, host, level, message, JSON.stringify(metadata), scopeId])
}
