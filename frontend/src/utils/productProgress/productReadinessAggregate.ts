import { readFile } from 'node:fs/promises'

export const PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION = 'hanasand.product_readiness.v1' as const
export const PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION = 'product.readiness_aggregate_source.v1' as const

const INLINE_LEDGER_KEYS = [
    'PRODUCT_READINESS_AGGREGATE_JSON',
    'HANASAND_PRODUCT_READINESS_JSON',
] as const

const FILE_LEDGER_KEYS = [
    'PRODUCT_READINESS_AGGREGATE_PATH',
    'HANASAND_PRODUCT_READINESS_PATH',
] as const

const DEFAULT_AGGREGATE_STALE_AFTER_SECONDS = 2 * 60 * 60

export type ProductReadinessAggregateState = 'ready' | 'needs_action' | 'blocked' | 'unavailable'

export type ProductReadinessAggregate = {
    schemaVersion: typeof PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION
    checkedAt: string
    ok: boolean
    rowCount: number
    customerVisibleBlockedCount: number
    deployRisk: 'none' | 'low' | 'medium' | 'high' | string
    rows: ProductReadinessAggregateRow[]
}

export type ProductReadinessAggregateRow = {
    id: string
    ownerLane: string
    capabilityLabel: string
    proofArtifact: {
        schemaVersion: string
        artifactId: string
        route?: string
        probeId?: string
    }
    lastCheckedAt: string
    customerVisible: boolean
    customerVisibleState: ProductReadinessAggregateState
    blockers: string[]
    requiredNextAction: string
    deployRisk: string
    uiQualityProofExists: boolean
    workflowContract?: {
        route?: string
        proofRowId?: string
        testName?: string
        expectedAdapter?: string
        proofCommand?: string
    }
}

export type ProductReadinessAggregateSource = {
    schemaVersion: typeof PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION
    state: ProductReadinessAggregateState
    source: string
    checkedAt: string
    ok: boolean
    rowCount: number
    customerVisibleBlockedCount: number
    deployRisk: string
    staleAfterSeconds: number
    ageSeconds: number
    stale: boolean
    unavailableReason?: string
    blockingRows: ProductReadinessAggregateSourceRow[]
}

export type ProductReadinessAggregateSourceRow = {
    id: string
    label: string
    ownerLane: string
    state: ProductReadinessAggregateState
    lastCheckedAt: string
    lastCheckedAgeSeconds: number
    lastCheckedStale: boolean
    blockers: string[]
    proofArtifactSchemaVersion: string
    proofArtifactId: string
    route: string
    probeId: string
    requiredNextAction: string
    deployRisk: string
    uiQualityProofExists: boolean
    workflowRoute: string
    workflowProofRowId: string
    workflowTestName: string
    workflowExpectedAdapter: string
    workflowProofCommand: string
}

export async function loadProductReadinessAggregate(env: Record<string, string | undefined> = process.env): Promise<ProductReadinessAggregateSource> {
    const inlineLedger = firstValue(INLINE_LEDGER_KEYS, env)
    const parsedInline = parseJsonAggregate(inlineLedger)
    if (parsedInline) return toProductReadinessAggregateSource(parsedInline, 'env:PRODUCT_READINESS_AGGREGATE_JSON', env)

    const filePath = firstValue(FILE_LEDGER_KEYS, env)
    if (!filePath) return missingProductReadinessAggregateSource('product_readiness_aggregate_not_configured')

    try {
        const parsedFile = parseJsonAggregate(await readFile(filePath, 'utf8'))
        return parsedFile
            ? toProductReadinessAggregateSource(parsedFile, filePath, env)
            : missingProductReadinessAggregateSource('product_readiness_aggregate_schema_invalid', filePath)
    } catch {
        return missingProductReadinessAggregateSource('product_readiness_aggregate_file_unavailable', filePath)
    }
}

export function parseProductReadinessAggregate(input: unknown): ProductReadinessAggregate | undefined {
    if (!isRecord(input)) return undefined
    if (input.schemaVersion !== PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION) return undefined
    if (typeof input.checkedAt !== 'string') return undefined
    if (typeof input.ok !== 'boolean') return undefined
    if (typeof input.rowCount !== 'number') return undefined
    if (typeof input.customerVisibleBlockedCount !== 'number') return undefined
    if (typeof input.deployRisk !== 'string') return undefined
    if (!Array.isArray(input.rows)) return undefined
    const rows = input.rows.map(parseProductReadinessAggregateRow)
    if (rows.some(row => !row)) return undefined
    return {
        schemaVersion: PRODUCT_READINESS_AGGREGATE_SCHEMA_VERSION,
        checkedAt: input.checkedAt,
        ok: input.ok,
        rowCount: input.rowCount,
        customerVisibleBlockedCount: input.customerVisibleBlockedCount,
        deployRisk: input.deployRisk,
        rows: rows as ProductReadinessAggregateRow[],
    }
}

export function isProductReadinessAggregateSource(input: unknown): input is ProductReadinessAggregateSource {
    if (!isRecord(input)) return false
    return input.schemaVersion === PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION
        && isAggregateState(input.state)
        && typeof input.source === 'string'
        && typeof input.checkedAt === 'string'
        && typeof input.ok === 'boolean'
        && typeof input.rowCount === 'number'
        && typeof input.customerVisibleBlockedCount === 'number'
        && typeof input.deployRisk === 'string'
        && typeof input.staleAfterSeconds === 'number'
        && typeof input.ageSeconds === 'number'
        && typeof input.stale === 'boolean'
        && (typeof input.unavailableReason === 'string' || input.unavailableReason === undefined)
        && Array.isArray(input.blockingRows)
        && input.blockingRows.every(isProductReadinessAggregateSourceRow)
        && (input.state === 'ready' || Boolean(input.unavailableReason) || input.blockingRows.length > 0)
}

export function missingProductReadinessAggregateSource(reason: string, source = 'not configured'): ProductReadinessAggregateSource {
    return {
        schemaVersion: PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION,
        state: 'unavailable',
        source,
        checkedAt: '',
        ok: false,
        rowCount: 0,
        customerVisibleBlockedCount: 0,
        deployRisk: 'unknown',
        staleAfterSeconds: DEFAULT_AGGREGATE_STALE_AFTER_SECONDS,
        ageSeconds: 0,
        stale: false,
        unavailableReason: reason,
        blockingRows: [],
    }
}

function toProductReadinessAggregateSource(
    aggregate: ProductReadinessAggregate,
    source: string,
    env: Record<string, string | undefined>,
): ProductReadinessAggregateSource {
    const staleAfterSeconds = staleAfterSecondsFromEnv(env)
    const blockingRows = aggregate.rows
        .filter(row => row.customerVisible && row.customerVisibleState !== 'ready')
        .map(row => {
            const lastCheckedAgeSeconds = ageSecondsSince(row.lastCheckedAt)
            return {
                id: row.id,
                label: row.capabilityLabel,
                ownerLane: row.ownerLane,
                state: row.customerVisibleState,
                lastCheckedAt: row.lastCheckedAt,
                lastCheckedAgeSeconds,
                lastCheckedStale: lastCheckedAgeSeconds > staleAfterSeconds,
                blockers: row.blockers,
                proofArtifactSchemaVersion: row.proofArtifact.schemaVersion,
                proofArtifactId: row.proofArtifact.artifactId,
                route: row.proofArtifact.route || row.workflowContract?.route || '',
                probeId: row.proofArtifact.probeId || row.workflowContract?.proofRowId || '',
                requiredNextAction: row.requiredNextAction,
                deployRisk: row.deployRisk,
                uiQualityProofExists: row.uiQualityProofExists,
                workflowRoute: row.workflowContract?.route || '',
                workflowProofRowId: row.workflowContract?.proofRowId || '',
                workflowTestName: row.workflowContract?.testName || '',
                workflowExpectedAdapter: row.workflowContract?.expectedAdapter || '',
                workflowProofCommand: row.workflowContract?.proofCommand || '',
            }
        })
    const ageSeconds = ageSecondsSince(aggregate.checkedAt)
    const stale = ageSeconds > staleAfterSeconds
    const state = aggregate.ok && blockingRows.length === 0 && !stale
        ? 'ready'
        : aggregate.deployRisk === 'high' || blockingRows.some(row => row.state === 'blocked')
            ? 'blocked'
            : 'needs_action'
    return {
        schemaVersion: PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION,
        state,
        source,
        checkedAt: aggregate.checkedAt,
        ok: aggregate.ok,
        rowCount: aggregate.rowCount,
        customerVisibleBlockedCount: aggregate.customerVisibleBlockedCount,
        deployRisk: aggregate.deployRisk,
        staleAfterSeconds,
        ageSeconds,
        stale,
        unavailableReason: state === 'ready' ? undefined : stale ? 'product_readiness_aggregate_stale' : 'product_readiness_aggregate_blocked',
        blockingRows,
    }
}

function parseProductReadinessAggregateRow(input: unknown): ProductReadinessAggregateRow | undefined {
    if (!isRecord(input) || !isRecord(input.proofArtifact)) return undefined
    if (!isAggregateState(input.customerVisibleState)) return undefined
    if (!Array.isArray(input.blockers) || !input.blockers.every(value => typeof value === 'string')) return undefined
    const id = stringValue(input.id)
    const ownerLane = stringValue(input.ownerLane)
    const capabilityLabel = stringValue(input.capabilityLabel)
    const artifactSchemaVersion = stringValue(input.proofArtifact.schemaVersion)
    const artifactId = stringValue(input.proofArtifact.artifactId)
    const lastCheckedAt = stringValue(input.lastCheckedAt)
    const requiredNextAction = stringValue(input.requiredNextAction)
    const deployRisk = stringValue(input.deployRisk)
    if (!id || !ownerLane || !capabilityLabel || !artifactSchemaVersion || !artifactId || !lastCheckedAt || !requiredNextAction || !deployRisk) return undefined
    return {
        id,
        ownerLane,
        capabilityLabel,
        proofArtifact: {
            schemaVersion: artifactSchemaVersion,
            artifactId,
            route: typeof input.proofArtifact.route === 'string' ? input.proofArtifact.route : undefined,
            probeId: typeof input.proofArtifact.probeId === 'string' ? input.proofArtifact.probeId : undefined,
        },
        lastCheckedAt,
        customerVisible: input.customerVisible === true,
        customerVisibleState: input.customerVisibleState,
        blockers: input.blockers,
        requiredNextAction,
        deployRisk,
        uiQualityProofExists: input.uiQualityProofExists === true,
        workflowContract: isRecord(input.workflowContract)
            ? {
                route: typeof input.workflowContract.route === 'string' ? input.workflowContract.route : undefined,
                proofRowId: typeof input.workflowContract.proofRowId === 'string' ? input.workflowContract.proofRowId : undefined,
                testName: typeof input.workflowContract.testName === 'string' ? input.workflowContract.testName : undefined,
                expectedAdapter: typeof input.workflowContract.expectedAdapter === 'string' ? input.workflowContract.expectedAdapter : undefined,
                proofCommand: typeof input.workflowContract.proofCommand === 'string' ? input.workflowContract.proofCommand : undefined,
            }
            : undefined,
    }
}

function isProductReadinessAggregateSourceRow(input: unknown): input is ProductReadinessAggregateSourceRow {
    if (!isRecord(input)) return false
    return typeof input.id === 'string'
        && typeof input.label === 'string'
        && typeof input.ownerLane === 'string'
        && isAggregateState(input.state)
        && typeof input.lastCheckedAt === 'string'
        && typeof input.lastCheckedAgeSeconds === 'number'
        && typeof input.lastCheckedStale === 'boolean'
        && Array.isArray(input.blockers)
        && input.blockers.every(value => typeof value === 'string')
        && typeof input.proofArtifactSchemaVersion === 'string'
        && typeof input.proofArtifactId === 'string'
        && typeof input.route === 'string'
        && typeof input.probeId === 'string'
        && typeof input.requiredNextAction === 'string'
        && typeof input.deployRisk === 'string'
        && typeof input.uiQualityProofExists === 'boolean'
        && typeof input.workflowRoute === 'string'
        && typeof input.workflowProofRowId === 'string'
        && typeof input.workflowTestName === 'string'
        && typeof input.workflowExpectedAdapter === 'string'
        && typeof input.workflowProofCommand === 'string'
}

function parseJsonAggregate(input: string | undefined) {
    if (!input?.trim()) return undefined
    try {
        return parseProductReadinessAggregate(JSON.parse(input))
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

function staleAfterSecondsFromEnv(env: Record<string, string | undefined>) {
    const configured = Number(env.PRODUCT_READINESS_AGGREGATE_STALE_AFTER_SECONDS || env.HANASAND_PRODUCT_READINESS_STALE_AFTER_SECONDS || '')
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_AGGREGATE_STALE_AFTER_SECONDS
}

function ageSecondsSince(value: string) {
    const checked = new Date(value).getTime()
    if (!value || Number.isNaN(checked)) return 0
    return Math.max(0, Math.floor((Date.now() - checked) / 1000))
}

function isAggregateState(input: unknown): input is ProductReadinessAggregateState {
    return input === 'ready' || input === 'needs_action' || input === 'blocked' || input === 'unavailable'
}

function isRecord(input: unknown): input is Record<string, unknown> {
    return Boolean(input) && typeof input === 'object'
}

function stringValue(input: unknown) {
    return typeof input === 'string' ? input.trim() : ''
}
