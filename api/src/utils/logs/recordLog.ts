import { classifyApplicationError } from '../mill/applicationError.ts'
import { analyzeCdnDelivery } from '../mill/analyzeCdnDeliveryLog.ts'
import { analyzeIngestion } from '../mill/analyzeIngestion.ts'
import { analyzeModelDiscovery } from '../mill/analyzeModelDiscoveryLog.ts'
import { analyzeReadinessAuditBatch } from '../mill/analyzeReadinessAuditLog.ts'
import { analyzeCdnRefresh } from '../mill/analyzeCdnRefreshLog.ts'
import { analyzeRoutineGroupBatch } from '../mill/analyzeRoutineGroupBatch.ts'
import { analyzeCollectorExecution } from '../mill/analyzeCollectorLog.ts'
import { analyzeProxy } from '../mill/analyzeProxy.ts'
import run from '#db'
import { analyzePostgresBatch } from '../mill/analyzePostgresBatch.ts'
import { customRetentionAction, loadLogRetentionRules } from '../mill/customRetention.ts'
import { normalizeLogEvent } from '../mill/logEvent.ts'
import { redactLogText, redactLogValue } from './redact.ts'
import { verifiedAccessFromLog } from '../mill/analyzeAccess.ts'
import { analyzeAccess, analyzeMongoPing } from '../mill/analyzeLog.ts'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

function preserveUnrecognizedFields(entry: Parameters<typeof prepareLog>[0]) {
    const fields = Object.fromEntries(Object.entries(entry).filter(([key]) => !['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'].includes(key)))
    if (!Object.keys(fields).length) return entry
    const metadata = entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata) ? entry.metadata : {}
    // Preserve extras before destructuring or batch correlation can erase them.
    // Keep the original marker too if a caller already supplied one.
    return { ...entry, metadata: { ...metadata, unrecognized_ingest_fields: {
        fields, ...(Object.hasOwn(metadata, 'unrecognized_ingest_fields') ? { previous: metadata.unrecognized_ingest_fields } : {}),
    } } }
}

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
}, query: typeof run = run, retention = new Map<string, Awaited<ReturnType<typeof loadLogRetentionRules>>>()) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) metadata = {}
    const scopeId = typeof metadata.organizationId === 'string' && metadata.organizationId
        ? metadata.organizationId
        : typeof metadata.tenantId === 'string' && metadata.tenantId
            ? metadata.tenantId
            : null
    if (!retention.has(scopeId || '')) retention.set(scopeId || '', await loadLogRetentionRules(scopeId, query))
    const classification = classifyApplicationError({ service, level, message, metadata }, retention.get(scopeId || ''))
    if (classification) { level = classification.level; metadata = classification.metadata }
    const redactedMessage = redactLogText(message)
    const redactedMetadata = redactLogValue(metadata) as Record<string, unknown>
    const retentionAction = Object.hasOwn(metadata, 'unrecognized_ingest_fields') ? 'keep' : customRetentionAction(normalizeLogEvent({ id: sourceEventId || '', service, host, level,
        message: redactedMessage, metadata: redactedMetadata, created_at: timestamp || new Date() }, retention.get(scopeId || '')), retention.get(scopeId || '')!)
    // Explicit Store exceptions must win before any built-in analyzer can drop.
    if (retentionAction !== 'keep') {
        if (await analyzeModelDiscovery({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeCdnDelivery({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeCdnRefresh({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeCollectorExecution({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeMongoPing({ service, host, level, message, metadata, sourceEventId }, query === run ? undefined : query)) return
        const access = verifiedAccessFromLog({ service, host, level, message, metadata, sourceEventId, timestamp })
        if (access && await analyzeAccess(access, query === run ? undefined : query)) return
    }
    message = redactedMessage
    metadata = redactedMetadata
    if (retentionAction === 'drop') return
    if (retentionAction !== 'keep' && await analyzeIngestion({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
    if (retentionAction !== 'keep' && await analyzeProxy({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
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
    const values = await prepareLog(preserveUnrecognizedFields(entry), query)
    if (!values) return
    const inserted = await query(`
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
        ON CONFLICT (source_event_id) DO NOTHING RETURNING id
    `, values)
    return inserted.rows[0]?.id as string | undefined
}


// Keep analyzer decisions and the insert in the caller's transaction, while
// ordinary collector rows share one insert instead of 100 sequential round trips.
export async function recordLogBatch(entries: Parameters<typeof prepareLog>[0][], query: typeof run) {
    const rows = []
    const retention = new Map<string, Awaited<ReturnType<typeof loadLogRetentionRules>>>()
    const originals = entries.map(entry => ({ ...preserveUnrecognizedFields(entry), service: entry.service ?? process.env.SERVICE_NAME ?? 'hanasand-api' }))
    for (const entry of await analyzeRoutineGroupBatch(await analyzePostgresBatch(await analyzeReadinessAuditBatch(originals, query), query), query)) {
        const values = await prepareLog(entry, query, retention)
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
