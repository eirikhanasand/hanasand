import { readFile } from 'node:fs/promises'

export type ProductOrganizationReadinessProofLedger = {
    schemaVersion: 'product.organization_readiness_proof_ledger.v1'
    generatedAt?: string
    organizationId?: string
    source?: string
    ledgerPath?: string
    alertReadiness: {
        readinessProof: OrganizationWorker3ReadinessProof
    }
}

type OrganizationWorker3ReadinessProof = {
    schemaVersion: 'organization.worker3_ui_readiness_proof.v1'
    organizationId?: string
    tenantId?: string
    actor?: {
        role?: string
        canExportActiveTerms?: boolean
    }
    counts: {
        activeMemberCount?: number
        activeAdminCount?: number
        pendingInviteCount?: number
        activeWatchlistTermCount?: number
        pausedWatchlistCount?: number
        archivedWatchlistCount?: number
    }
    readiness: {
        organizationCanGenerateAlerts?: boolean
        actorCanExportActiveTerms?: boolean
        readyForWorker3Replay?: boolean
        readyForDashboard?: boolean
        cleanupRequired?: boolean
    }
    blockers?: string[]
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_ORG_READINESS_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_ORG_READINESS_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_ORG_READINESS_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_ORG_READINESS_PROOF_PATH',
] as const

export async function loadProductOrganizationReadinessProofLedger(organizationId: string, env: Record<string, string | undefined> = process.env): Promise<ProductOrganizationReadinessProofLedger | undefined> {
    const inlineLedger = parseJsonLedger(firstValue(INLINE_LEDGER_KEYS, env), organizationId)
    if (inlineLedger) return inlineLedger

    const filePath = firstValue(FILE_LEDGER_KEYS, env)
    if (!filePath) return undefined

    try {
        const parsedFile = parseJsonLedger(await readFile(filePath, 'utf8'), organizationId)
        return parsedFile ? { ...parsedFile, ledgerPath: parsedFile.ledgerPath || filePath } : undefined
    } catch {
        return undefined
    }
}

export function organizationReadinessPayloadFromLedger(ledger: ProductOrganizationReadinessProofLedger) {
    return {
        alertReadiness: ledger.alertReadiness,
        proofLedger: {
            schemaVersion: ledger.schemaVersion,
            generatedAt: ledger.generatedAt,
            source: ledger.source,
            ledgerPath: ledger.ledgerPath,
        },
    }
}

function parseJsonLedger(input: string | undefined, organizationId: string) {
    if (!input?.trim()) return undefined
    try {
        return parseProductOrganizationReadinessProofLedger(JSON.parse(input), organizationId)
    } catch {
        return undefined
    }
}

export function parseProductOrganizationReadinessProofLedger(input: unknown, organizationId: string): ProductOrganizationReadinessProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.organization_readiness_proof_ledger.v1') return undefined

    const ledgerOrganizationId = stringOrUndefined(input.organizationId)
    if (ledgerOrganizationId && ledgerOrganizationId !== organizationId) return undefined
    if (!isRecord(input.alertReadiness)) return undefined
    if (!isOrganizationReadinessProof(input.alertReadiness.readinessProof, organizationId)) return undefined

    return {
        schemaVersion: 'product.organization_readiness_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        organizationId: ledgerOrganizationId,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        alertReadiness: {
            readinessProof: input.alertReadiness.readinessProof,
        },
    }
}

function isOrganizationReadinessProof(input: unknown, organizationId: string): input is OrganizationWorker3ReadinessProof {
    if (!isRecord(input)) return false
    if (input.schemaVersion !== 'organization.worker3_ui_readiness_proof.v1') return false
    if (stringOrUndefined(input.organizationId) && input.organizationId !== organizationId) return false
    if (!isRecord(input.counts) || !isRecord(input.readiness)) return false
    return typeof input.counts.activeWatchlistTermCount === 'number'
        && Number.isFinite(input.counts.activeWatchlistTermCount)
        && typeof input.readiness.organizationCanGenerateAlerts === 'boolean'
        && typeof input.readiness.actorCanExportActiveTerms === 'boolean'
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
