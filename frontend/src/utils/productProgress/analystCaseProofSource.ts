import { readFile } from 'node:fs/promises'

export type AnalystCaseProofRow = {
    id: string
    tenantId?: string
    organizationId?: string
    alertId: string
    status: string
    assignedOwner?: string
    updatedAt?: string
    createdAt?: string
}

export type ProductAnalystCaseProofLedger = {
    schemaVersion: 'product.analyst_case_proof_ledger.v1'
    generatedAt?: string
    tenantId?: string
    organizationId?: string
    source?: string
    ledgerPath?: string
    cases: AnalystCaseProofRow[]
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_ANALYST_CASE_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_ANALYST_CASE_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_ANALYST_CASE_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_ANALYST_CASE_PROOF_PATH',
] as const

export async function loadProductAnalystCaseProofLedger(scope: {
    tenantId: string
    organizationId?: string
}, env: Record<string, string | undefined> = process.env): Promise<ProductAnalystCaseProofLedger | undefined> {
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

export function analystCasePayloadFromLedger(ledger: ProductAnalystCaseProofLedger) {
    return {
        cases: ledger.cases,
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
        return parseProductAnalystCaseProofLedger(JSON.parse(input), scope)
    } catch {
        return undefined
    }
}

export function parseProductAnalystCaseProofLedger(input: unknown, scope: {
    tenantId: string
    organizationId?: string
}): ProductAnalystCaseProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.analyst_case_proof_ledger.v1') return undefined

    const ledgerTenantId = stringOrUndefined(input.tenantId)
    if (ledgerTenantId && ledgerTenantId !== scope.tenantId) return undefined
    const ledgerOrganizationId = stringOrUndefined(input.organizationId)
    if (ledgerOrganizationId && scope.organizationId && ledgerOrganizationId !== scope.organizationId) return undefined
    if (!Array.isArray(input.cases)) return undefined

    const cases = input.cases.filter(item => isAnalystCaseProofRow(item) && matchesScope(item, scope))
    if (cases.length === 0) return undefined
    if (!cases.some(item => !['closed', 'false_positive', 'suppressed'].includes(item.status))) return undefined

    return {
        schemaVersion: 'product.analyst_case_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        tenantId: ledgerTenantId,
        organizationId: ledgerOrganizationId,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        cases,
    }
}

function isAnalystCaseProofRow(input: unknown): input is AnalystCaseProofRow {
    if (!isRecord(input)) return false
    return Boolean(
        stringOrUndefined(input.id)
        && stringOrUndefined(input.alertId)
        && stringOrUndefined(input.status)
        && (stringOrUndefined(input.updatedAt) || stringOrUndefined(input.createdAt)),
    )
}

function matchesScope(row: AnalystCaseProofRow, scope: { tenantId: string, organizationId?: string }) {
    if (row.tenantId && row.tenantId !== scope.tenantId) return false
    if (!scope.organizationId) return true
    return !row.organizationId || row.organizationId === scope.organizationId
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
