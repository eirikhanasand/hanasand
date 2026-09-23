import run from '#db'
import { redactLogText, redactLogValue } from './redact.ts'
import { accessFromLog } from '../mill/analyzeAccess.ts'
import { analyzeAccess, analyzeMongoPing } from '../mill/analyzeLog.ts'

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

async function prepareLog({
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
    if (await analyzeMongoPing({ service, host, level, message, metadata, sourceEventId }, query === run ? undefined : query)) return
    const access = accessFromLog({ service, host, level, message, metadata, sourceEventId, timestamp })
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

    return [service, host, level, message, JSON.stringify(metadata), scopeId, sourceEventId || null, timestamp || null]
}

export default async function recordLog(entry: Parameters<typeof prepareLog>[0], query: typeof run = run) {
    const values = await prepareLog(entry, query)
    if (!values) return
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
    `, values)
}


// Keep analyzer decisions and the insert in the caller's transaction, while
// ordinary collector rows share one insert instead of 100 sequential round trips.
export async function recordLogBatch(entries: Parameters<typeof prepareLog>[0][], query: typeof run) {
    const rows = []
    for (const entry of entries) {
        const values = await prepareLog(entry, query)
        if (values) rows.push(values)
    }
    if (!rows.length) return
    await query(`WITH input AS MATERIALIZED (
        SELECT v->>0 service, v->>1 host, v->>2 level, v->>3 message, (v->>4)::jsonb metadata,
            v->>5 scope_id, v->>6 source_event_id, (v->>7)::timestamptz created_at
        FROM jsonb_array_elements($1::jsonb) v
    ), organization_privacy AS MATERIALIZED (
        SELECT id, status, audit_safe_metadata FROM organizations
        WHERE id IN (SELECT scope_id FROM input WHERE scope_id IS NOT NULL)
        ORDER BY id FOR KEY SHARE
    )
    INSERT INTO service_logs(service, host, level, message, metadata, source_event_id, created_at)
    SELECT CASE WHEN private.deleted THEN 'hanasand-api' ELSE i.service END,
        CASE WHEN private.deleted THEN '' ELSE i.host END,
        CASE WHEN private.deleted THEN 'info' ELSE i.level END,
        CASE WHEN private.deleted THEN 'organization_event' ELSE i.message END,
        CASE WHEN private.deleted THEN jsonb_strip_nulls(jsonb_build_object(
            'category','organization_privacy','action','post_delete_event',
            'organizationId',i.scope_id,'tenantId',i.scope_id,'outcome','recorded',
            'privacyDeletionRunId',o.audit_safe_metadata->>'privacyDeletionRunId')) ELSE i.metadata END,
        i.source_event_id, COALESCE(i.created_at, NOW())
    FROM input i LEFT JOIN organization_privacy o ON o.id=i.scope_id
    CROSS JOIN LATERAL (SELECT COALESCE(o.status='deleted' OR o.audit_safe_metadata ? 'privacyDeletedAt', FALSE) AS deleted) private
    ON CONFLICT (source_event_id) DO NOTHING`, [JSON.stringify(rows)])
}
