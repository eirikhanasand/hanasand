import { readFile } from 'node:fs/promises'

export type ProductPublicTiProofLedger = {
    schemaVersion: 'product.public_ti_provenance_proof_ledger.v1'
    generatedAt?: string
    query?: string
    source?: string
    ledgerPath?: string
    searchPayload: PublicTiSearchProofPayload
}

type PublicTiSearchProofPayload = Record<string, unknown> & {
    query?: string
    rows?: Array<Record<string, unknown>>
    results?: Array<Record<string, unknown>>
    publicTiAnswer?: {
        status?: string
        evidenceLedgerReferences?: Array<Record<string, unknown>>
    }
    actionability?: {
        schemaVersion?: string
        sourceProvenance?: Array<Record<string, unknown>>
        handoffs?: Record<string, { endpoint?: string } | undefined>
        sourceFamilyCoverageMatrix?: {
            schemaVersion?: string
            rows?: unknown[]
            summary?: {
                publicTiReadyFamilies?: unknown[]
                latestCaptureAt?: string
            }
        }
    }
}

export type PublicTiProofFetchResult = {
    ok: true
    status: 200
    json: PublicTiSearchProofPayload
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_PUBLIC_TI_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_PUBLIC_TI_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_PUBLIC_TI_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_PUBLIC_TI_PROOF_PATH',
] as const

export async function loadProductPublicTiProofLedger(query: string, env: Record<string, string | undefined> = process.env): Promise<ProductPublicTiProofLedger | undefined> {
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

export function publicTiFetchResultFromLedger(ledger: ProductPublicTiProofLedger, query: string): PublicTiProofFetchResult {
    return {
        ok: true,
        status: 200,
        json: {
            ...ledger.searchPayload,
            query: ledger.searchPayload.query || query,
            proofLedger: {
                schemaVersion: ledger.schemaVersion,
                generatedAt: ledger.generatedAt,
                source: ledger.source,
                ledgerPath: ledger.ledgerPath,
            },
        },
    }
}

function parseJsonLedger(input: string | undefined, query: string) {
    if (!input?.trim()) return undefined
    try {
        return parseProductPublicTiProofLedger(JSON.parse(input), query)
    } catch {
        return undefined
    }
}

export function parseProductPublicTiProofLedger(input: unknown, query: string): ProductPublicTiProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.public_ti_provenance_proof_ledger.v1') return undefined

    const ledgerQuery = stringOrUndefined(input.query)
    if (ledgerQuery && !queriesMatch(ledgerQuery, query)) return undefined
    if (!isPublicTiSearchProofPayload(input.searchPayload, query)) return undefined

    return {
        schemaVersion: 'product.public_ti_provenance_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        query: ledgerQuery,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        searchPayload: input.searchPayload,
    }
}

function isPublicTiSearchProofPayload(input: unknown, query: string): input is PublicTiSearchProofPayload {
    if (!isRecord(input)) return false
    const payloadQuery = stringOrUndefined(input.query)
    if (payloadQuery && !queriesMatch(payloadQuery, query)) return false
    const evidenceRows = Array.isArray(input.rows) ? input.rows : Array.isArray(input.results) ? input.results : []
    if (evidenceRows.length === 0) return false
    if (!isRecord(input.publicTiAnswer) || input.publicTiAnswer.status !== 'ready') return false
    if (!Array.isArray(input.publicTiAnswer.evidenceLedgerReferences) || input.publicTiAnswer.evidenceLedgerReferences.length === 0) return false
    if (!isRecord(input.actionability) || input.actionability.schemaVersion !== 'ti.query.actionability.v1') return false
    if (!Array.isArray(input.actionability.sourceProvenance) || input.actionability.sourceProvenance.length === 0) return false
    if (!hasWorkflowHandoffs(input.actionability.handoffs)) return false
    return hasSourceFamilyMatrix(input.actionability.sourceFamilyCoverageMatrix)
}

function hasWorkflowHandoffs(input: unknown) {
    if (!isRecord(input)) return false
    return ['watchlist', 'alertRebuild', 'caseCreate'].every(key => isRecord(input[key]) && stringOrUndefined(input[key].endpoint))
}

function hasSourceFamilyMatrix(input: unknown) {
    if (!isRecord(input)) return false
    if (input.schemaVersion !== 'ti.public_actor.source_family_coverage_matrix.v1') return false
    if (!Array.isArray(input.rows) || input.rows.length === 0) return false
    if (!isRecord(input.summary)) return false
    if (!Array.isArray(input.summary.publicTiReadyFamilies) || input.summary.publicTiReadyFamilies.length === 0) return false
    return Boolean(stringOrUndefined(input.summary.latestCaptureAt))
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
