import { readFile } from 'node:fs/promises'
import type { DwmOrganizationSummary } from '@/app/dashboard/operatorConsoleModel'

export type ProductOrganizationListProofLedger = {
    schemaVersion: 'product.organization_list_proof_ledger.v1'
    generatedAt?: string
    tenantId?: string
    source?: string
    ledgerPath?: string
    organizations: DwmOrganizationSummary[]
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_ORGANIZATION_LIST_PROOF_PATH',
] as const

export async function loadProductOrganizationListProofLedger(tenantId: string, env: Record<string, string | undefined> = process.env): Promise<ProductOrganizationListProofLedger | undefined> {
    const inlineLedger = parseJsonLedger(firstValue(INLINE_LEDGER_KEYS, env), tenantId)
    if (inlineLedger) return inlineLedger

    const filePath = firstValue(FILE_LEDGER_KEYS, env)
    if (!filePath) return undefined

    try {
        const parsedFile = parseJsonLedger(await readFile(filePath, 'utf8'), tenantId)
        return parsedFile ? { ...parsedFile, ledgerPath: parsedFile.ledgerPath || filePath } : undefined
    } catch {
        return undefined
    }
}

export function organizationListPayloadFromLedger(ledger: ProductOrganizationListProofLedger) {
    return {
        organizations: ledger.organizations,
        proofLedger: {
            schemaVersion: ledger.schemaVersion,
            generatedAt: ledger.generatedAt,
            source: ledger.source,
            ledgerPath: ledger.ledgerPath,
        },
    }
}

function parseJsonLedger(input: string | undefined, tenantId: string) {
    if (!input?.trim()) return undefined
    try {
        return parseProductOrganizationListProofLedger(JSON.parse(input), tenantId)
    } catch {
        return undefined
    }
}

export function parseProductOrganizationListProofLedger(input: unknown, tenantId: string): ProductOrganizationListProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.organization_list_proof_ledger.v1') return undefined

    const ledgerTenantId = stringOrUndefined(input.tenantId)
    if (ledgerTenantId && ledgerTenantId !== tenantId) return undefined
    if (!Array.isArray(input.organizations)) return undefined

    const organizations = input.organizations.filter(item => isDwmOrganizationSummary(item) && item.tenantId === tenantId)
    if (organizations.length === 0) return undefined
    if (!organizations.some(item => item.status === 'active')) return undefined

    return {
        schemaVersion: 'product.organization_list_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        tenantId: ledgerTenantId,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        organizations,
    }
}

function isDwmOrganizationSummary(input: unknown): input is DwmOrganizationSummary {
    if (!isRecord(input)) return false
    return Boolean(
        stringOrUndefined(input.id)
        && stringOrUndefined(input.tenantId)
        && stringOrUndefined(input.name)
        && stringOrUndefined(input.slug)
        && (input.status === 'active' || input.status === 'suspended')
        && stringOrUndefined(input.createdAt)
        && stringOrUndefined(input.updatedAt),
    )
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
