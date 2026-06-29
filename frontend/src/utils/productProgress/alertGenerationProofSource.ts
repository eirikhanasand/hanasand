import { readFile } from 'node:fs/promises'

export type ProductAlertGenerationProofLedger = {
    schemaVersion: 'product.alert_generation_proof_ledger.v1'
    generatedAt?: string
    tenantId?: string
    source?: string
    ledgerPath?: string
    readiness: DwmAlertGenerationProof
}

type DwmAlertGenerationProof = {
    schemaVersion: 'dwm.alert_generation_readiness.v1'
    generatedAt?: string
    readyForCustomerDelivery: boolean
    counts?: {
        candidateCount?: number
        captureRefCount?: number
        matchedCandidateCount?: number
        missingRouteCandidateCount?: number
    }
    webhookReadiness?: {
        missingRouteCandidateCount?: number
    }
    generationEvidenceWindow?: GenerationEvidenceWindow
    plan?: {
        candidates?: Array<{
            evidenceWindow?: GenerationEvidenceWindow
        }>
    }
    blockerCodes?: string[]
    blockers?: string[]
}

type GenerationEvidenceWindow = {
    captureIds?: string[]
    sourceFamilies?: string[]
    contentHashes?: string[]
    firstObservedAt?: string
    lastObservedAt?: string
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_ALERT_GENERATION_PROOF_PATH',
] as const

export async function loadProductAlertGenerationProofLedger(tenantId: string, env: Record<string, string | undefined> = process.env): Promise<ProductAlertGenerationProofLedger | undefined> {
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

export function alertGenerationPayloadFromLedger(ledger: ProductAlertGenerationProofLedger) {
    return {
        readiness: ledger.readiness,
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
        return parseProductAlertGenerationProofLedger(JSON.parse(input), tenantId)
    } catch {
        return undefined
    }
}

export function parseProductAlertGenerationProofLedger(input: unknown, tenantId: string): ProductAlertGenerationProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.alert_generation_proof_ledger.v1') return undefined

    const ledgerTenantId = stringOrUndefined(input.tenantId)
    if (ledgerTenantId && ledgerTenantId !== tenantId) return undefined
    if (!isDwmAlertGenerationProof(input.readiness)) return undefined

    return {
        schemaVersion: 'product.alert_generation_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        tenantId: ledgerTenantId,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        readiness: input.readiness,
    }
}

function isDwmAlertGenerationProof(input: unknown): input is DwmAlertGenerationProof {
    if (!isRecord(input)) return false
    if (input.schemaVersion !== 'dwm.alert_generation_readiness.v1') return false
    if (input.readyForCustomerDelivery !== true) return false
    return hasReadyEvidenceWindow(input.generationEvidenceWindow) || (
        isRecord(input.plan)
        && Array.isArray(input.plan.candidates)
        && input.plan.candidates.some(candidate => isRecord(candidate) && hasReadyEvidenceWindow(candidate.evidenceWindow))
    )
}

function hasReadyEvidenceWindow(input: unknown) {
    if (!isRecord(input)) return false
    return Array.isArray(input.captureIds)
        && input.captureIds.length > 0
        && Boolean(stringOrUndefined(input.lastObservedAt))
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
