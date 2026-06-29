import { readFile } from 'node:fs/promises'
import type { DwmAlert } from '@/utils/dwm/product'

export type ProductDwmAlertProofLedger = {
    schemaVersion: 'product.dwm_alert_proof_ledger.v1'
    generatedAt?: string
    tenantId?: string
    organizationId?: string
    source?: string
    ledgerPath?: string
    alerts: DwmAlert[]
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_DWM_ALERT_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_DWM_ALERT_PROOF_PATH',
] as const

export async function loadProductDwmAlertProofLedger(scope: {
    tenantId: string
    organizationId?: string
}, env: Record<string, string | undefined> = process.env): Promise<ProductDwmAlertProofLedger | undefined> {
    const inlineLedger = parseJsonLedger(firstValue(INLINE_LEDGER_KEYS, env), scope)
    if (inlineLedger) return inlineLedger

    const filePath = firstValue(FILE_LEDGER_KEYS, env)
    if (!filePath) return undefined

    try {
        const parsedFile = parseJsonLedger(await readFile(filePath, 'utf8'), scope)
        return parsedFile ? { ...parsedFile, ledgerPath: parsedFile.ledgerPath || filePath } : undefined
    } catch {
        return undefined
    }
}

export function dwmAlertPayloadFromLedger(ledger: ProductDwmAlertProofLedger) {
    return {
        alerts: ledger.alerts,
        proofLedger: {
            schemaVersion: ledger.schemaVersion,
            generatedAt: ledger.generatedAt,
            source: ledger.source,
            ledgerPath: ledger.ledgerPath,
        },
    }
}

function parseJsonLedger(input: string | undefined, scope: { tenantId: string, organizationId?: string }) {
    if (!input?.trim()) return undefined
    try {
        return parseProductDwmAlertProofLedger(JSON.parse(input), scope)
    } catch {
        return undefined
    }
}

export function parseProductDwmAlertProofLedger(input: unknown, scope: {
    tenantId: string
    organizationId?: string
}): ProductDwmAlertProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.dwm_alert_proof_ledger.v1') return undefined

    const ledgerTenantId = stringOrUndefined(input.tenantId)
    if (ledgerTenantId && ledgerTenantId !== scope.tenantId) return undefined
    const ledgerOrganizationId = stringOrUndefined(input.organizationId)
    if (ledgerOrganizationId && scope.organizationId && ledgerOrganizationId !== scope.organizationId) return undefined
    if (!Array.isArray(input.alerts)) return undefined

    const alerts = input.alerts.filter(alert => isDwmAlertItem(alert) && matchesScope(alert, scope))
    if (alerts.length === 0) return undefined
    if (!alerts.some(alert => !['suppressed', 'false_positive', 'dismissed'].includes(alert.reviewState))) return undefined

    return {
        schemaVersion: 'product.dwm_alert_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        tenantId: ledgerTenantId,
        organizationId: ledgerOrganizationId,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        alerts,
    }
}

function isDwmAlertItem(input: unknown): input is DwmAlert {
    if (!isRecord(input)) return false
    return Boolean(
        stringOrUndefined(input.id)
        && input.eventType === 'darkweb.monitoring.match'
        && stringOrUndefined(input.severity)
        && typeof input.confidence === 'number'
        && isRecord(input.matchedTerm)
        && stringOrUndefined(input.matchedTerm.value)
        && stringOrUndefined(input.company)
        && stringOrUndefined(input.sourceFamily)
        && stringOrUndefined(input.firstSeenAt)
        && stringOrUndefined(input.claimSummary)
        && stringOrUndefined(input.reviewState)
        && stringOrUndefined(input.recommendedAction)
        && Array.isArray(input.evidence)
        && input.evidence.some(isAlertEvidence)
        && isRecord(input.webhookDelivery)
        && stringOrUndefined(input.webhookDelivery.payloadHash)
        && stringOrUndefined(input.webhookDelivery.dedupeKey),
    )
}

function isAlertEvidence(input: unknown) {
    if (!isRecord(input)) return false
    return Boolean(
        stringOrUndefined(input.id)
        && stringOrUndefined(input.sourceName)
        && stringOrUndefined(input.sourceFamily)
        && stringOrUndefined(input.contentHash),
    )
}

function matchesScope(alert: DwmAlert, scope: { organizationId?: string }) {
    if (!scope.organizationId) return true
    const candidate = stringOrUndefined((alert as DwmAlert & { organizationId?: unknown }).organizationId)
        || stringOrUndefined((alert as DwmAlert & { orgId?: unknown }).orgId)
    return !candidate || candidate === scope.organizationId
}

function isRecord(input: unknown): input is Record<string, unknown> {
    return Boolean(input && typeof input === 'object' && !Array.isArray(input))
}

function stringOrUndefined(input: unknown) {
    return typeof input === 'string' && input.trim() ? input.trim() : undefined
}

function firstValue(keys: readonly string[], env: Record<string, string | undefined>) {
    for (const key of keys) {
        const value = env[key]
        if (value?.trim()) return value.trim()
    }
    return undefined
}
