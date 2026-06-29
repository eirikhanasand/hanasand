import { readFile } from 'node:fs/promises'
import type { DwmWatchlistSummary } from '@/app/dashboard/operatorConsoleModel'

export type ProductDwmWatchlistProofLedger = {
    schemaVersion: 'product.dwm_watchlist_proof_ledger.v1'
    generatedAt?: string
    tenantId?: string
    organizationId?: string
    source?: string
    ledgerPath?: string
    watchlists: DwmWatchlistSummary[]
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_DWM_WATCHLIST_PROOF_PATH',
] as const

export async function loadProductDwmWatchlistProofLedger(scope: {
    tenantId: string
    organizationId?: string
}, env: Record<string, string | undefined> = process.env): Promise<ProductDwmWatchlistProofLedger | undefined> {
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

export function watchlistPayloadFromLedger(ledger: ProductDwmWatchlistProofLedger) {
    return {
        watchlists: ledger.watchlists,
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
        return parseProductDwmWatchlistProofLedger(JSON.parse(input), scope)
    } catch {
        return undefined
    }
}

export function parseProductDwmWatchlistProofLedger(input: unknown, scope: {
    tenantId: string
    organizationId?: string
}): ProductDwmWatchlistProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.dwm_watchlist_proof_ledger.v1') return undefined

    const ledgerTenantId = stringOrUndefined(input.tenantId)
    if (ledgerTenantId && ledgerTenantId !== scope.tenantId) return undefined
    const ledgerOrganizationId = stringOrUndefined(input.organizationId)
    if (ledgerOrganizationId && scope.organizationId && ledgerOrganizationId !== scope.organizationId) return undefined
    if (!Array.isArray(input.watchlists)) return undefined

    const watchlists = input.watchlists.filter(item => isDwmWatchlistSummary(item) && matchesScope(item, scope))
    if (watchlists.length === 0) return undefined
    if (!watchlists.some(item => item.status === 'active' && item.terms.length > 0)) return undefined

    return {
        schemaVersion: 'product.dwm_watchlist_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        tenantId: ledgerTenantId,
        organizationId: ledgerOrganizationId,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        watchlists,
    }
}

function isDwmWatchlistSummary(input: unknown): input is DwmWatchlistSummary {
    if (!isRecord(input)) return false
    return Boolean(
        stringOrUndefined(input.id)
        && stringOrUndefined(input.tenantId)
        && stringOrUndefined(input.name)
        && (input.status === 'active' || input.status === 'paused')
        && stringOrUndefined(input.createdAt)
        && stringOrUndefined(input.updatedAt)
        && Array.isArray(input.terms)
        && input.terms.every(isWatchlistTerm),
    )
}

function isWatchlistTerm(input: unknown) {
    if (!isRecord(input)) return false
    return Boolean(stringOrUndefined(input.value))
}

function matchesScope(watchlist: DwmWatchlistSummary, scope: { tenantId: string, organizationId?: string }) {
    if (watchlist.tenantId !== scope.tenantId) return false
    if (!scope.organizationId) return true
    return !watchlist.organizationId || watchlist.organizationId === scope.organizationId
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
