import { readFile } from 'node:fs/promises'
import type { DwmOrganizationWebhookDestination } from '@/app/dashboard/operatorConsoleModel'

export type ProductWebhookProofLedger = {
    schemaVersion: 'product.webhook_proof_ledger.v1'
    generatedAt?: string
    organizationId?: string
    source?: string
    ledgerPath?: string
    destinations: DwmOrganizationWebhookDestination[]
    destinationAdminProof: {
        productProgress: {
            schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1'
            status?: string
            destinationCount?: number
            activeDestinationCount?: number
            deliveryReadyCount?: number
            retryEligibleCount?: number
            liveDeliveryEnabled?: boolean
            blockerCodes?: string[]
            href?: string
        }
    }
}

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_WEBHOOK_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_WEBHOOK_PROOF_PATH',
] as const

export async function loadProductWebhookProofLedger(organizationId: string, env: Record<string, string | undefined> = process.env): Promise<ProductWebhookProofLedger | undefined> {
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

export function webhookPayloadFromLedger(ledger: ProductWebhookProofLedger) {
    return {
        destinations: ledger.destinations,
        destinationAdminProof: ledger.destinationAdminProof,
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
        return parseProductWebhookProofLedger(JSON.parse(input), organizationId)
    } catch {
        return undefined
    }
}

export function parseProductWebhookProofLedger(input: unknown, organizationId: string): ProductWebhookProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.webhook_proof_ledger.v1') return undefined

    const ledgerOrganizationId = stringOrUndefined(input.organizationId)
    if (ledgerOrganizationId && ledgerOrganizationId !== organizationId) return undefined
    if (!Array.isArray(input.destinations)) return undefined
    if (!isRecord(input.destinationAdminProof)) return undefined
    if (!isRecord(input.destinationAdminProof.productProgress)) return undefined
    if (input.destinationAdminProof.productProgress.schemaVersion !== 'dwm.webhook.destination_admin_product_progress.v1') return undefined

    const proof = input.destinationAdminProof.productProgress
    if (proof.status === 'ready' && !(Number(proof.activeDestinationCount) > 0 && Number(proof.deliveryReadyCount) > 0)) return undefined

    return {
        schemaVersion: 'product.webhook_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        organizationId: ledgerOrganizationId,
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        destinations: input.destinations as DwmOrganizationWebhookDestination[],
        destinationAdminProof: {
            productProgress: {
                schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1',
                status: stringOrUndefined(proof.status),
                destinationCount: numberOrUndefined(proof.destinationCount),
                activeDestinationCount: numberOrUndefined(proof.activeDestinationCount),
                deliveryReadyCount: numberOrUndefined(proof.deliveryReadyCount),
                retryEligibleCount: numberOrUndefined(proof.retryEligibleCount),
                liveDeliveryEnabled: typeof proof.liveDeliveryEnabled === 'boolean' ? proof.liveDeliveryEnabled : undefined,
                blockerCodes: stringArray(proof.blockerCodes),
                href: stringOrUndefined(proof.href),
            },
        },
    }
}

function isRecord(input: unknown): input is Record<string, unknown> {
    return Boolean(input && typeof input === 'object' && !Array.isArray(input))
}

function stringOrUndefined(input: unknown) {
    return typeof input === 'string' && input.trim() ? input.trim() : undefined
}

function numberOrUndefined(input: unknown) {
    return typeof input === 'number' && Number.isFinite(input) ? input : undefined
}

function stringArray(input: unknown) {
    return Array.isArray(input)
        ? input.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim())
        : undefined
}

function firstValue(keys: readonly string[], env: Record<string, string | undefined>) {
    for (const key of keys) {
        const value = env[key]
        if (value?.trim()) return value.trim()
    }
    return undefined
}
