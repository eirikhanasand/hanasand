import { classifyApplicationError } from '../events/applicationError.ts'
import { analyzeCdnDelivery } from '../events/analyzeCdnDeliveryLog.ts'
import { analyzeIngestion } from '../events/analyzeIngestion.ts'
import { analyzeModelDiscovery, analyzeModelHealthCheck } from '../events/analyzeModelDiscoveryLog.ts'
import { analyzeReadinessAuditBatch } from '../events/analyzeReadinessAuditLog.ts'
import { analyzeCdnRefresh } from '../events/analyzeCdnRefreshLog.ts'
import { analyzeRoutineGroupBatch } from '../events/analyzeRoutineGroupBatch.ts'
import { analyzeCollectorExecution } from '../events/analyzeCollectorLog.ts'
import { analyzeProxy } from '../events/analyzeProxy.ts'
import run from '#db'
import { analyzePostgresBatch } from '../events/analyzePostgresBatch.ts'
import { customRetentionAction, loadLogRetentionRules, recordCustomDropReceipts } from '../events/customRetention.ts'
import { normalizeLogEvent } from '../events/logEvent.ts'
import { redactLogText, redactLogValue } from './redact.ts'
import { verifiedAccessFromLog } from '../events/analyzeAccess.ts'
import { analyzeAccess, analyzeMongoPing } from '../events/analyzeLog.ts'
import { createHash, randomUUID } from 'node:crypto'

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
    const redactedMessage = redactLogText(message)
    const redactedMetadata = redactLogValue(metadata) as Record<string, unknown>
    const baseLog = { id: sourceEventId || '', service, host, level,
        message: redactedMessage, metadata: redactedMetadata, created_at: timestamp || new Date() }
    const baseNormalized = normalizeLogEvent(baseLog, undefined, { classify: false, includeSeverity: false })
    const retentionAction = Object.hasOwn(metadata, 'unrecognized_ingest_fields') ? 'keep' : customRetentionAction(baseNormalized, retention.get(scopeId || '')!)
    if (retentionAction === 'drop') {
        await recordCustomDropReceipts(baseNormalized, retention.get(scopeId || '')!, sourceEventId, scopeId || undefined, query)
        return
    }

    const classification = classifyApplicationError(baseLog, retention.get(scopeId || ''))
    if (classification) { level = classification.level; metadata = classification.metadata }
    // Explicit Store exceptions must win before any built-in analyzer can drop.
    if (retentionAction !== 'keep') {
        if (await analyzeModelDiscovery({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeModelHealthCheck({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeCdnDelivery({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeCdnRefresh({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeCollectorExecution({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
        if (await analyzeMongoPing({ service, host, level, message, metadata, sourceEventId }, query === run ? undefined : query)) return
        const access = verifiedAccessFromLog({ service, host, level, message, metadata, sourceEventId, timestamp })
        if (access && await analyzeAccess(access, query === run ? undefined : query)) return
    }
    message = redactedMessage
    metadata = redactedMetadata
    if (retentionAction !== 'keep' && await analyzeIngestion({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
    if (retentionAction !== 'keep' && await analyzeProxy({ service, host, level, message, metadata, sourceEventId, timestamp }, query === run ? undefined : query)) return
    if (!scopeId && isOrganizationRequest(metadata)) {
        service = 'hanasand-api'
        host = ''
        level = 'error'
        message = 'organization_request_error'
        metadata = { category: 'organization_request_error', surface: 'organizations' }
    }

    const identity = sourceEventId || randomUUID()
    return [service, host, level, message, JSON.stringify(metadata), scopeId, identity, timestamp || null,
        createHash('sha256').update(`service:${identity}`).digest('hex')]
}

function eventRow(values: Awaited<ReturnType<typeof prepareLog>>) {
    if (!values) return null
    const [service, host, level, message, metadataJson, scopeId, sourceEventId, timestamp, id] = values
    const metadata = JSON.parse(metadataJson || '{}')
    const event = { ...normalizeLogEvent({ id: sourceEventId || '', service: service || 'hanasand-api', host: host || '', level: level || 'info', message: message || '', metadata, created_at: timestamp || new Date() }),
        source_event_id: sourceEventId }
    return { id, scopeId, event, timestamp: event.timestamp }
}

export default async function recordLog(entry: Parameters<typeof prepareLog>[0], query: typeof run = run) {
    const values = await prepareLog(preserveUnrecognizedFields(entry), query)
    if (!values) return
    const row = eventRow(values)!
    const inserted = await insertEvents([row], query)
    return inserted[0]
}

async function insertEvents(rows: NonNullable<ReturnType<typeof eventRow>>[], query: typeof run) {
    if (!rows.length) return []
    const payload = rows.map(({ id, scopeId, event, timestamp }) => ({ id, scope_id: scopeId, timestamp,
        event_type: event.event_type, action: event.action, outcome: event.outcome,
        user_id: event.user?.id == null ? null : String(event.user.id), user_email: event.user?.email == null ? null : String(event.user.email),
        source_ip: event.source?.ip == null ? null : String(event.source.ip),
        source_country: (event.source as Record<string, unknown>)?.country == null ? null : String((event.source as Record<string, unknown>).country),
        source_city: (event.source as Record<string, unknown>)?.city == null ? null : String((event.source as Record<string, unknown>).city),
        device_id: event.device && typeof event.device === 'object' && 'id' in event.device ? String(event.device.id) : null,
        normalized: event }))
    const result = await query(`WITH input AS MATERIALIZED (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(id text, scope_id text, timestamp timestamptz,
            event_type text, action text, outcome text, user_id text, user_email text, source_ip text,
            source_country text, source_city text, device_id text, normalized jsonb)
    ), organization_privacy AS MATERIALIZED (
        SELECT id, status, audit_safe_metadata FROM organizations
        WHERE id IN (SELECT scope_id FROM input WHERE scope_id IS NOT NULL) ORDER BY id FOR KEY SHARE
    ), target AS MATERIALIZED (
        SELECT i.*, COALESCE((SELECT id FROM organizations o WHERE o.id=i.scope_id AND o.status='active'),
            (SELECT id FROM organizations WHERE status='active' AND (id=$2 OR ($2::text IS NULL AND lower(name)='hanasand')) ORDER BY created_at LIMIT 1)) organization_id,
            COALESCE(o.status='deleted' OR o.audit_safe_metadata ? 'privacyDeletedAt', FALSE) deleted,
            o.audit_safe_metadata->>'privacyDeletionRunId' privacy_deletion_run_id
        FROM input i LEFT JOIN organization_privacy o ON o.id=i.scope_id
    )
    INSERT INTO events(id,ingestion_id,organization_id,source_vendor,source_product,event_timestamp,event_type,action,outcome,
        user_id,user_email,source_ip,source_country,source_city,device_id,parser_version,normalized,original,processing_status)
    SELECT id,'logs',organization_id,'Hanasand','Logs',timestamp,
        CASE WHEN deleted THEN 'application' ELSE event_type END,
        CASE WHEN deleted THEN 'post_delete_event' ELSE action END,
        CASE WHEN deleted THEN 'recorded' ELSE outcome END,
        CASE WHEN deleted THEN NULL ELSE user_id END, CASE WHEN deleted THEN NULL ELSE user_email END,
        CASE WHEN deleted THEN NULL ELSE source_ip END, CASE WHEN deleted THEN NULL ELSE source_country END,
        CASE WHEN deleted THEN NULL ELSE source_city END, CASE WHEN deleted THEN NULL ELSE device_id END,'logs.v1',
        CASE WHEN deleted THEN jsonb_build_object('schema_version','logs.v1','source_vendor','Hanasand','source_product','Logs',
            'timestamp',timestamp,'event_type','application','action','post_delete_event','outcome','recorded','level','info',
            'service','hanasand-api','host','','message','organization_event','metadata',jsonb_strip_nulls(jsonb_build_object(
                'category','organization_privacy','action','post_delete_event','organizationId',scope_id,'tenantId',scope_id,
                'outcome','recorded','privacyDeletionRunId',privacy_deletion_run_id))) ELSE normalized END,
        '{}'::jsonb,'pending'
    FROM target WHERE organization_id IS NOT NULL ON CONFLICT(id) DO NOTHING RETURNING id`,
        [JSON.stringify(payload), process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
    return result.rows.map(row => row.id as string)
}


// Keep analyzer decisions and the insert in the caller's transaction, while
// ordinary collector rows share one insert instead of 100 sequential round trips.
export async function recordLogBatch(entries: Parameters<typeof prepareLog>[0][], query: typeof run) {
    const rows: NonNullable<ReturnType<typeof eventRow>>[] = []
    const retention = new Map<string, Awaited<ReturnType<typeof loadLogRetentionRules>>>()
    const originals = entries.map(entry => ({ ...preserveUnrecognizedFields(entry), service: entry.service ?? process.env.SERVICE_NAME ?? 'hanasand-api' }))
    for (const entry of await analyzeRoutineGroupBatch(await analyzePostgresBatch(await analyzeReadinessAuditBatch(originals, query), query), query)) {
        const values = await prepareLog(entry, query, retention)
        const row = eventRow(values)
        if (row) rows.push(row)
    }
    if (!rows.length) return
    await insertEvents(rows, query)
}
