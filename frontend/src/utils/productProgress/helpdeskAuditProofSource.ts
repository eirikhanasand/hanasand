import { readFile } from 'node:fs/promises'

export type ProductHelpdeskAuditProofLedger = {
    schemaVersion: 'product.helpdesk_audit_proof_ledger.v1'
    generatedAt?: string
    source?: string
    ledgerPath?: string
    recovery: {
        approvals: unknown[]
    }
    audit: {
        events: Array<Record<string, unknown>>
        detail: {
            exportProof: SupportAuditExportProof
        }
    }
}

type SupportAuditExportProof = {
    schemaVersion: 'support.audit.export_proof.v1'
    generatedAt?: string
    eventCount: number
    blockers?: string[]
    replay?: {
        query?: string
    }
    worker3?: {
        readinessName?: string
        route?: string
        expectedResponsePath?: string
    }
}

export type HelpdeskAuditProofFetchResults = {
    recovery: {
        ok: true
        status: 200
        json: ProductHelpdeskAuditProofLedger['recovery']
    }
    audit: {
        ok: true
        status: 200
        json: ProductHelpdeskAuditProofLedger['audit']
    }
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_HELPDESK_AUDIT_PROOF_PATH',
] as const

export async function loadProductHelpdeskAuditProofLedger(env: Record<string, string | undefined> = process.env): Promise<ProductHelpdeskAuditProofLedger | undefined> {
    const inlineLedger = parseJsonLedger(firstValue(INLINE_LEDGER_KEYS, env))
    if (inlineLedger) return inlineLedger

    const filePath = firstValue(FILE_LEDGER_KEYS, env)
    if (!filePath) return undefined

    try {
        const parsedFile = parseJsonLedger(await readFile(filePath, 'utf8'))
        return parsedFile ? { ...parsedFile, ledgerPath: parsedFile.ledgerPath || filePath } : undefined
    } catch {
        return undefined
    }
}

export function helpdeskAuditFetchResultsFromLedger(ledger: ProductHelpdeskAuditProofLedger): HelpdeskAuditProofFetchResults {
    return {
        recovery: {
            ok: true,
            status: 200,
            json: ledger.recovery,
        },
        audit: {
            ok: true,
            status: 200,
            json: ledger.audit,
        },
    }
}

function parseJsonLedger(input: string | undefined) {
    if (!input?.trim()) return undefined
    try {
        return parseProductHelpdeskAuditProofLedger(JSON.parse(input))
    } catch {
        return undefined
    }
}

export function parseProductHelpdeskAuditProofLedger(input: unknown): ProductHelpdeskAuditProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.helpdesk_audit_proof_ledger.v1') return undefined
    if (!isRecord(input.recovery) || !Array.isArray(input.recovery.approvals)) return undefined
    if (!isRecord(input.audit) || !Array.isArray(input.audit.events)) return undefined
    if (!isRecord(input.audit.detail)) return undefined
    if (!isSupportAuditExportProof(input.audit.detail.exportProof)) return undefined
    if (input.audit.events.length === 0) return undefined

    return {
        schemaVersion: 'product.helpdesk_audit_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        recovery: {
            approvals: input.recovery.approvals,
        },
        audit: {
            events: input.audit.events as Array<Record<string, unknown>>,
            detail: {
                exportProof: input.audit.detail.exportProof,
            },
        },
    }
}

function isSupportAuditExportProof(input: unknown): input is SupportAuditExportProof {
    if (!isRecord(input)) return false
    if (input.schemaVersion !== 'support.audit.export_proof.v1') return false
    if (typeof input.eventCount !== 'number' || !Number.isFinite(input.eventCount) || input.eventCount <= 0) return false
    if (input.blockers !== undefined && !stringArray(input.blockers)) return false
    return true
}

function isRecord(input: unknown): input is Record<string, unknown> {
    return Boolean(input && typeof input === 'object' && !Array.isArray(input))
}

function stringOrUndefined(input: unknown) {
    return typeof input === 'string' && input.trim() ? input.trim() : undefined
}

function stringArray(input: unknown): input is string[] {
    return Array.isArray(input) && input.every(item => typeof item === 'string')
}

function firstValue(keys: readonly string[], env: Record<string, string | undefined>) {
    for (const key of keys) {
        const value = env[key]
        if (value?.trim()) return value.trim()
    }
    return undefined
}
