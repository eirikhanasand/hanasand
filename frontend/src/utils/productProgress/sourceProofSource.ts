import { readFile } from 'node:fs/promises'
import type { DashboardSourceProofProxyPayload } from '@/app/dashboard/operatorConsoleModel'

export type ProductSourceProxyProofLedger = {
    schemaVersion: 'product.source_proxy_proof_ledger.v1'
    generatedAt?: string
    query?: string
    source?: string
    ledgerPath?: string
    sourceProxy: DashboardSourceProofProxyPayload
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_SOURCE_PROXY_PROOF_PATH',
] as const

export async function loadProductSourceProxyProofLedger(query: string, env: Record<string, string | undefined> = process.env): Promise<ProductSourceProxyProofLedger | undefined> {
    const inlineLedger = parseJsonLedger(firstValue(INLINE_LEDGER_KEYS, env), query)
    if (inlineLedger) return inlineLedger

    const filePath = firstValue(FILE_LEDGER_KEYS, env)
    if (!filePath) return undefined

    try {
        const parsedFile = parseJsonLedger(await readFile(filePath, 'utf8'), query)
        return parsedFile ? { ...parsedFile, ledgerPath: parsedFile.ledgerPath || filePath } : undefined
    } catch {
        return undefined
    }
}

export function sourceProxyFromLedger(ledger: ProductSourceProxyProofLedger, query: string): DashboardSourceProofProxyPayload & {
    proofLedger: {
        schemaVersion: ProductSourceProxyProofLedger['schemaVersion']
        source?: string
        ledgerPath?: string
    }
} {
    return {
        ...ledger.sourceProxy,
        ok: ledger.sourceProxy.ok !== false,
        generatedAt: ledger.sourceProxy.generatedAt || ledger.generatedAt || new Date().toISOString(),
        query: ledger.sourceProxy.query || query,
        baseConfigured: ledger.sourceProxy.baseConfigured ?? false,
        proofLedger: {
            schemaVersion: ledger.schemaVersion,
            source: ledger.source,
            ledgerPath: ledger.ledgerPath,
        },
    }
}

function parseJsonLedger(input: string | undefined, query: string) {
    if (!input?.trim()) return undefined
    try {
        return parseProductSourceProxyProofLedger(JSON.parse(input), query)
    } catch {
        return undefined
    }
}

export function parseProductSourceProxyProofLedger(input: unknown, query: string): ProductSourceProxyProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.source_proxy_proof_ledger.v1') return undefined

    const ledgerQuery = stringOrUndefined(input.query)
    if (ledgerQuery && !queriesMatch(ledgerQuery, query)) return undefined
    if (!isRecord(input.sourceProxy)) return undefined

    const sourceProxy = input.sourceProxy as DashboardSourceProofProxyPayload
    const inventoryReady = sourceProxy.sourceInventory?.schemaVersion === 'dwm.source_inventory.v1'
    const packsReady = sourceProxy.sourcePacks?.schemaVersion === 'dwm.source_packs.v1'
    const endpointsReady = sourceProxy.endpoints?.sourceInventory?.ok === true && sourceProxy.endpoints?.sourcePacks?.ok === true
    if (!inventoryReady || !packsReady || !endpointsReady) return undefined

    return {
        schemaVersion: 'product.source_proxy_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        query: ledgerQuery,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        sourceProxy,
    }
}

function queriesMatch(left: string, right: string) {
    return left === '*' || left.trim().toLowerCase() === right.trim().toLowerCase()
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
