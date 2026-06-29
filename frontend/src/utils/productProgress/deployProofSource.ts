import { readFile } from 'node:fs/promises'
import { parseProductDeployProofLedger, type ProductDeployProofLedger } from './deployLedger'

const INLINE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_DEPLOY_PROOF_JSON',
    'HANASAND_PRODUCT_PROGRESS_DEPLOY_PROOF_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_PROGRESS_DEPLOY_PROOF_PATH',
    'HANASAND_PRODUCT_PROGRESS_DEPLOY_PROOF_PATH',
] as const

export async function loadProductDeployProofLedger(env: Record<string, string | undefined> = process.env): Promise<ProductDeployProofLedger | undefined> {
    const inlineLedger = firstValue(INLINE_LEDGER_KEYS, env)
    const parsedInline = parseJsonLedger(inlineLedger)
    if (parsedInline) return parsedInline

    const filePath = firstValue(FILE_LEDGER_KEYS, env)
    if (!filePath) return undefined

    try {
        const parsedFile = parseJsonLedger(await readFile(filePath, 'utf8'))
        return parsedFile ? { ...parsedFile, ledgerPath: parsedFile.ledgerPath || filePath } : undefined
    } catch {
        return undefined
    }
}

function parseJsonLedger(input: string | undefined) {
    if (!input?.trim()) return undefined
    try {
        return parseProductDeployProofLedger(JSON.parse(input))
    } catch {
        return undefined
    }
}

function firstValue(keys: readonly string[], env: Record<string, string | undefined>) {
    for (const key of keys) {
        const value = env[key]
        if (value?.trim()) return value.trim()
    }
    return undefined
}
