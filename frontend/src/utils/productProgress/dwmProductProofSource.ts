import { readFile } from 'node:fs/promises'
import type { DwmProductSnapshot } from '@/utils/dwm/product'

export type ProductDwmProductProofLedger = {
    schemaVersion: 'product.dwm_product_proof_ledger.v1'
    generatedAt?: string
    tenantId?: string
    source?: string
    ledgerPath?: string
    snapshot: DwmProductSnapshot
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_DWM_PRODUCT_PROOF_PATH',
] as const

export async function loadProductDwmProductProofLedger(tenantId: string, env: Record<string, string | undefined> = process.env): Promise<ProductDwmProductProofLedger | undefined> {
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

export function dwmProductPayloadFromLedger(ledger: ProductDwmProductProofLedger) {
    return {
        ...ledger.snapshot,
        generatedAt: ledger.snapshot.generatedAt || ledger.generatedAt || new Date().toISOString(),
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
        return parseProductDwmProductProofLedger(JSON.parse(input), tenantId)
    } catch {
        return undefined
    }
}

export function parseProductDwmProductProofLedger(input: unknown, tenantId: string): ProductDwmProductProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.dwm_product_proof_ledger.v1') return undefined

    const ledgerTenantId = stringOrUndefined(input.tenantId)
    if (ledgerTenantId && ledgerTenantId !== tenantId) return undefined
    if (!isDwmProductSnapshot(input.snapshot, tenantId)) return undefined

    return {
        schemaVersion: 'product.dwm_product_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        tenantId: ledgerTenantId,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        snapshot: input.snapshot,
    }
}

function isDwmProductSnapshot(input: unknown, tenantId: string): input is DwmProductSnapshot {
    if (!isRecord(input)) return false
    if (input.schemaVersion !== 'dwm.product.v1') return false
    if (stringOrUndefined(input.tenantId) !== tenantId) return false
    if (!stringOrUndefined(input.generatedAt)) return false
    if (!Array.isArray(input.watchlist) || input.watchlist.length === 0) return false
    if (!Array.isArray(input.alerts) || input.alerts.length === 0) return false
    if (!Array.isArray(input.sourceCoverage) || input.sourceCoverage.length === 0) return false
    if (!Array.isArray(input.actorOverviews)) return false
    if (!isRecord(input.readiness) || !stringOrUndefined(input.readiness.decision)) return false
    return true
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
