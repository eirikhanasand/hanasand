export type ProductDeployProofLedger = {
    schemaVersion: 'product.deploy_proof_ledger.v1'
    generatedAt?: string
    latestProbeAt?: string
    deployedCommit?: string
    frontendHealthy?: boolean
    apiHealthy?: boolean
    scraperHealthy?: boolean
    dashboardAlertId?: string
    deliveryId?: string
    source?: string
    ledgerPath?: string
    blockers?: string[]
}

type DeployLedgerContainer = {
    productProgressDeployProof?: unknown
    deployProof?: unknown
    productProgress?: {
        deployProof?: unknown
        deployProbe?: unknown
    }
}

export function deployLedgerFromStatusPayload(payload: unknown): ProductDeployProofLedger | undefined {
    if (!isRecord(payload)) return undefined
    const container = payload as DeployLedgerContainer
    return parseProductDeployProofLedger(container.productProgressDeployProof)
        || parseProductDeployProofLedger(container.deployProof)
        || parseProductDeployProofLedger(container.productProgress?.deployProof)
        || parseProductDeployProofLedger(container.productProgress?.deployProbe)
}

export function parseProductDeployProofLedger(input: unknown): ProductDeployProofLedger | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== 'product.deploy_proof_ledger.v1') return undefined

    const ledger: ProductDeployProofLedger = {
        schemaVersion: 'product.deploy_proof_ledger.v1',
        generatedAt: stringOrUndefined(input.generatedAt),
        latestProbeAt: stringOrUndefined(input.latestProbeAt),
        deployedCommit: stringOrUndefined(input.deployedCommit),
        frontendHealthy: booleanOrUndefined(input.frontendHealthy),
        apiHealthy: booleanOrUndefined(input.apiHealthy),
        scraperHealthy: booleanOrUndefined(input.scraperHealthy),
        dashboardAlertId: stringOrUndefined(input.dashboardAlertId),
        deliveryId: stringOrUndefined(input.deliveryId),
        source: stringOrUndefined(input.source),
        ledgerPath: stringOrUndefined(input.ledgerPath),
        blockers: stringArray(input.blockers),
    }

    const hasProof = Boolean(
        ledger.generatedAt
        || ledger.latestProbeAt
        || ledger.deployedCommit
        || typeof ledger.frontendHealthy === 'boolean'
        || typeof ledger.apiHealthy === 'boolean'
        || typeof ledger.scraperHealthy === 'boolean'
        || ledger.dashboardAlertId
        || ledger.deliveryId
        || ledger.blockers?.length,
    )

    return hasProof ? ledger : undefined
}

function isRecord(input: unknown): input is Record<string, unknown> {
    return Boolean(input && typeof input === 'object' && !Array.isArray(input))
}

function stringOrUndefined(input: unknown) {
    return typeof input === 'string' && input.trim() ? input.trim() : undefined
}

function booleanOrUndefined(input: unknown) {
    return typeof input === 'boolean' ? input : undefined
}

function stringArray(input: unknown) {
    return Array.isArray(input)
        ? input.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim())
        : undefined
}
