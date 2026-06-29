import { buildProductProgressExternalState, type ProductProgressReadinessPayload, type ProductReadinessExternalState, type ProductReadinessSnapshotBase } from '@/app/dashboard/operatorConsoleModel'

type ReadinessStatus = 'ready' | 'needs_action' | 'blocked' | 'unavailable'

const PRODUCT_NORTH_STAR_ROW_IDS = [
    'organizations',
    'shared_watchlists',
    'source_coverage',
    'real_alert_generation',
    'webhook_delivery',
    'analyst_workflow',
    'support_admin_audit',
    'public_ti_enrichment',
    'deploy_live_status',
] as const

const PRODUCT_NORTH_STAR_DIRECTION_IDS = [
    'multi_org_threat_monitoring',
    'source_backed_intelligence',
    'shared_alert_workflow',
    'delivery_destinations',
    'enterprise_support',
] as const

const READINESS_STATUSES = ['ready', 'needs_action', 'blocked', 'unavailable'] as const

export type ProductNorthStarRowId =
    | 'organizations'
    | 'shared_watchlists'
    | 'source_coverage'
    | 'real_alert_generation'
    | 'webhook_delivery'
    | 'analyst_workflow'
    | 'support_admin_audit'
    | 'public_ti_enrichment'
    | 'deploy_live_status'

export type ProductNorthStarRow = {
    id: ProductNorthStarRowId
    label: string
    state: ReadinessStatus
    ownerLane: string
    detail: string
    href: string
    proofSource: string
    proofTimestamp: string
    staleAfterSeconds: number
    expectedDashboardRowId: string
    backendProofContractVersion: string
    blocker: string
    integrationProbeHint: string
}

export type ProductNorthStarDirectionId =
    | 'multi_org_threat_monitoring'
    | 'source_backed_intelligence'
    | 'shared_alert_workflow'
    | 'delivery_destinations'
    | 'enterprise_support'

export type ProductNorthStarDirection = {
    id: ProductNorthStarDirectionId
    label: string
    state: ReadinessStatus
    detail: string
    href: string
    ownerLanes: string[]
    backedRowIds: ProductNorthStarRowId[]
    blocker: string
    proofSummary: string
}

export type ProductNorthStarDeployGate = {
    state: ReadinessStatus
    fullChainReady: boolean
    readyRows: number
    totalRows: number
    blockerRows: ProductNorthStarRowId[]
    needsActionRows: ProductNorthStarRowId[]
    unavailableRows: ProductNorthStarRowId[]
    readyWorkflowLinks: string[]
    actionNeededWorkflowLinks: string[]
    proofContracts: string[]
    ownerLanes: string[]
    expectedDashboardRowIds: string[]
    firstBlocker: string
    blockingProofRows: ProductNorthStarDeployBlocker[]
}

export type ProductNorthStarDeployBlocker = {
    rowId: ProductNorthStarRowId
    state: Exclude<ReadinessStatus, 'ready'>
    ownerLane: string
    href: string
    blocker: string
    proofTimestamp: string
    staleAfterSeconds: number
    expectedDashboardRowId: string
    backendProofContractVersion: string
    integrationProbeHint: string
}

export type ProductNorthStarScoreboard = {
    schemaVersion: 'product.north_star.readiness.v1'
    generatedAt: string
    query: string
    fullChainReady: boolean
    readyRows: number
    totalRows: number
    firstBlocker?: string
    deployGate: ProductNorthStarDeployGate
    direction: ProductNorthStarDirection[]
    rows: ProductNorthStarRow[]
}

export function parseProductNorthStarScoreboard(input: unknown): ProductNorthStarScoreboard | null {
    if (!input || typeof input !== 'object') return null
    const candidate = input as Partial<ProductNorthStarScoreboard>
    if (candidate.schemaVersion !== 'product.north_star.readiness.v1') return null
    if (!Array.isArray(candidate.rows) || !Array.isArray(candidate.direction)) return null
    if (typeof candidate.fullChainReady !== 'boolean') return null
    if (typeof candidate.generatedAt !== 'string' || typeof candidate.query !== 'string') return null
    if (typeof candidate.readyRows !== 'number' || typeof candidate.totalRows !== 'number') return null
    if (!candidate.rows.every(isProductNorthStarRow)) return null
    if (!candidate.direction.every(isProductNorthStarDirection)) return null
    if (!isProductNorthStarDeployGate(candidate.deployGate)) return null
    if (candidate.totalRows !== candidate.rows.length) return null
    if (candidate.readyRows !== candidate.rows.filter(row => row.state === 'ready').length) return null
    if (candidate.fullChainReady !== candidate.rows.every(row => row.state === 'ready')) return null
    if (candidate.deployGate.totalRows !== candidate.totalRows) return null
    if (candidate.deployGate.readyRows !== candidate.readyRows) return null
    if (candidate.deployGate.fullChainReady !== candidate.fullChainReady) return null
    if (candidate.deployGate.firstBlocker !== (candidate.firstBlocker || '')) return null
    if (!deployGateMatchesRows(candidate.deployGate, candidate.rows)) return null
    return candidate as ProductNorthStarScoreboard
}

function isProductNorthStarRow(input: unknown): input is ProductNorthStarRow {
    if (!input || typeof input !== 'object') return false
    const row = input as Partial<ProductNorthStarRow>
    return isRowId(row.id)
        && isReadinessStatus(row.state)
        && isFilledString(row.label)
        && isFilledString(row.ownerLane)
        && typeof row.detail === 'string'
        && isFilledString(row.href)
        && typeof row.proofSource === 'string'
        && isFilledString(row.proofTimestamp)
        && typeof row.staleAfterSeconds === 'number'
        && row.staleAfterSeconds > 0
        && isFilledString(row.expectedDashboardRowId)
        && isFilledString(row.backendProofContractVersion)
        && typeof row.blocker === 'string'
        && isFilledString(row.integrationProbeHint)
        && (row.state === 'ready' || Boolean(row.blocker))
}

function isProductNorthStarDirection(input: unknown): input is ProductNorthStarDirection {
    if (!input || typeof input !== 'object') return false
    const direction = input as Partial<ProductNorthStarDirection>
    return isDirectionId(direction.id)
        && isReadinessStatus(direction.state)
        && isFilledString(direction.label)
        && typeof direction.detail === 'string'
        && isFilledString(direction.href)
        && Array.isArray(direction.ownerLanes)
        && direction.ownerLanes.every(isFilledString)
        && Array.isArray(direction.backedRowIds)
        && direction.backedRowIds.every(isRowId)
        && typeof direction.blocker === 'string'
        && isFilledString(direction.proofSummary)
        && (direction.state === 'ready' || Boolean(direction.blocker))
}

function isProductNorthStarDeployGate(input: unknown): input is ProductNorthStarDeployGate {
    if (!input || typeof input !== 'object') return false
    const deployGate = input as Partial<ProductNorthStarDeployGate>
    return isReadinessStatus(deployGate.state)
        && typeof deployGate.fullChainReady === 'boolean'
        && typeof deployGate.readyRows === 'number'
        && typeof deployGate.totalRows === 'number'
        && Array.isArray(deployGate.blockerRows)
        && deployGate.blockerRows.every(isRowId)
        && Array.isArray(deployGate.needsActionRows)
        && deployGate.needsActionRows.every(isRowId)
        && Array.isArray(deployGate.unavailableRows)
        && deployGate.unavailableRows.every(isRowId)
        && Array.isArray(deployGate.readyWorkflowLinks)
        && deployGate.readyWorkflowLinks.every(isFilledString)
        && Array.isArray(deployGate.actionNeededWorkflowLinks)
        && deployGate.actionNeededWorkflowLinks.every(isFilledString)
        && Array.isArray(deployGate.proofContracts)
        && deployGate.proofContracts.every(isFilledString)
        && Array.isArray(deployGate.ownerLanes)
        && deployGate.ownerLanes.every(isFilledString)
        && Array.isArray(deployGate.expectedDashboardRowIds)
        && deployGate.expectedDashboardRowIds.every(isFilledString)
        && typeof deployGate.firstBlocker === 'string'
        && Array.isArray(deployGate.blockingProofRows)
        && deployGate.blockingProofRows.every(isProductNorthStarDeployBlocker)
        && deployGate.blockingProofRows.length === deployGate.blockerRows.length + deployGate.needsActionRows.length + deployGate.unavailableRows.length
}

function isProductNorthStarDeployBlocker(input: unknown): input is ProductNorthStarDeployBlocker {
    if (!input || typeof input !== 'object') return false
    const blocker = input as Partial<ProductNorthStarDeployBlocker>
    return isRowId(blocker.rowId)
        && (blocker.state === 'blocked' || blocker.state === 'needs_action' || blocker.state === 'unavailable')
        && isFilledString(blocker.ownerLane)
        && isFilledString(blocker.href)
        && isFilledString(blocker.blocker)
        && isFilledString(blocker.proofTimestamp)
        && typeof blocker.staleAfterSeconds === 'number'
        && blocker.staleAfterSeconds > 0
        && isFilledString(blocker.expectedDashboardRowId)
        && isFilledString(blocker.backendProofContractVersion)
        && isFilledString(blocker.integrationProbeHint)
}

function deployGateMatchesRows(deployGate: ProductNorthStarDeployGate, rows: ProductNorthStarRow[]) {
    const readyRows = rows.filter(row => row.state === 'ready')
    const nonReadyRows = rows.filter(row => row.state !== 'ready')
    const rowById = new Map(rows.map(row => [row.id, row]))
    if (!sameStringSet(deployGate.blockerRows, rows.filter(row => row.state === 'blocked').map(row => row.id))) return false
    if (!sameStringSet(deployGate.needsActionRows, rows.filter(row => row.state === 'needs_action').map(row => row.id))) return false
    if (!sameStringSet(deployGate.unavailableRows, rows.filter(row => row.state === 'unavailable').map(row => row.id))) return false
    if (!sameStringSet(deployGate.blockingProofRows.map(row => row.rowId), nonReadyRows.map(row => row.id))) return false
    if (!deployGate.blockingProofRows.every(blocker => {
        const row = rowById.get(blocker.rowId)
        return Boolean(row)
            && row?.state === blocker.state
            && row.ownerLane === blocker.ownerLane
            && row.href === blocker.href
            && row.blocker === blocker.blocker
            && row.proofTimestamp === blocker.proofTimestamp
            && row.staleAfterSeconds === blocker.staleAfterSeconds
            && row.expectedDashboardRowId === blocker.expectedDashboardRowId
            && row.backendProofContractVersion === blocker.backendProofContractVersion
            && row.integrationProbeHint === blocker.integrationProbeHint
    })) return false
    if (!sameStringSet(deployGate.readyWorkflowLinks, readyRows.map(row => row.href))) return false
    if (!sameStringSet(deployGate.actionNeededWorkflowLinks, nonReadyRows.map(row => row.href))) return false
    return true
}

function sameStringSet(left: string[], right: string[]) {
    const cleanLeft = Array.from(new Set(left.filter(Boolean))).sort()
    const cleanRight = Array.from(new Set(right.filter(Boolean))).sort()
    return cleanLeft.length === cleanRight.length && cleanLeft.every((value, index) => value === cleanRight[index])
}

function isRowId(input: unknown): input is ProductNorthStarRowId {
    return typeof input === 'string' && PRODUCT_NORTH_STAR_ROW_IDS.includes(input as ProductNorthStarRowId)
}

function isDirectionId(input: unknown): input is ProductNorthStarDirectionId {
    return typeof input === 'string' && PRODUCT_NORTH_STAR_DIRECTION_IDS.includes(input as ProductNorthStarDirectionId)
}

function isReadinessStatus(input: unknown): input is ReadinessStatus {
    return typeof input === 'string' && READINESS_STATUSES.includes(input as ReadinessStatus)
}

function isFilledString(input: unknown): input is string {
    return typeof input === 'string' && input.trim().length > 0
}

type BuildOptions = {
    generatedAt: string
    query?: string
    external?: ProductReadinessExternalState
}

export function buildProductNorthStarScoreboard(payload: ProductProgressReadinessPayload | null | undefined, options: BuildOptions): ProductNorthStarScoreboard {
    const generatedAt = payload?.generatedAt || options.generatedAt
    const query = options.query || 'company watchlist'
    const external = options.external || buildProductProgressExternalState(payload, {
        checkedAt: payload?.checkedAt || generatedAt,
        staleAfterMinutes: 120,
    })
    const rows: ProductNorthStarRow[] = [
        organizationsRow(external, generatedAt),
        snapshotRow({
            id: 'shared_watchlists',
            label: 'Shared watchlists',
            snapshot: external.orgAlertExport,
            fallbackHref: '/dashboard/dwm',
            fallbackOwner: 'org',
            fallbackExpectedDashboardRowId: 'org_alert_export',
            fallbackContract: 'organization.watchlist_alert_terms_export.v1',
            fallbackProbe: 'GET /api/organizations/:id/watchlist-alert-terms must return active terms and canGenerateAlerts.',
            fallbackBlocker: 'Shared watchlist export proof is not loaded.',
            readyDetail: 'Active organization terms can generate DWM alerts.',
        }),
        snapshotRow({
            id: 'source_coverage',
            label: 'Source coverage',
            snapshot: external.sourceGrowth,
            fallbackHref: '/dashboard/ti/sources',
            fallbackOwner: 'source',
            fallbackExpectedDashboardRowId: 'source_inventory_probe',
            fallbackContract: 'dwm.source_inventory.v1',
            fallbackProbe: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, and workerReadiness.',
            fallbackBlocker: 'Source inventory and worker readiness proof is not loaded.',
            readyDetail: 'Source inventory and worker readiness are current.',
        }),
        snapshotRow({
            id: 'real_alert_generation',
            label: 'Real alert generation',
            snapshot: external.dashboardEvidence,
            fallbackHref: '/dashboard/ti/workbench',
            fallbackOwner: 'dashboard',
            fallbackExpectedDashboardRowId: 'dashboard_evidence',
            fallbackContract: 'dashboard.alert_evidence.readiness.v1',
            fallbackProbe: 'Product progress must include a dashboard-visible alert with matching delivery/source/deploy proof.',
            fallbackBlocker: 'Dashboard-visible alert proof is not loaded.',
            readyDetail: 'A backend alert is visible in the dashboard with matched delivery evidence.',
            hrefOverride: '/dashboard/ti/workbench',
        }),
        webhookDeliveryRow(external, generatedAt),
        snapshotRow({
            id: 'analyst_workflow',
            label: 'Analyst workflow',
            snapshot: external.dashboardEvidence,
            fallbackHref: '/dashboard/ti/workbench',
            fallbackOwner: 'dashboard',
            fallbackExpectedDashboardRowId: 'dashboard_evidence',
            fallbackContract: 'dashboard.alert_evidence.readiness.v1',
            fallbackProbe: 'Dashboard evidence must include a real alert id that can be opened by the analyst workbench.',
            fallbackBlocker: 'No backed alert is available for analyst review.',
            readyDetail: 'A backed alert is available for analyst review.',
            hrefOverride: '/dashboard/ti/workbench',
        }),
        snapshotRow({
            id: 'support_admin_audit',
            label: 'Support and admin audit',
            snapshot: external.helpdeskAudit,
            fallbackHref: '/dashboard/system/impersonation',
            fallbackOwner: 'helpdesk',
            fallbackExpectedDashboardRowId: 'helpdesk_audit',
            fallbackContract: 'support.audit.readiness.v1',
            fallbackProbe: 'GET /api/admin/support/readiness must return structured audit and recovery queue readiness.',
            fallbackBlocker: 'Support and admin audit proof is not loaded.',
            readyDetail: 'Support actions and recovery state have structured audit proof.',
        }),
        publicTiEnrichmentRow(external, query),
        snapshotRow({
            id: 'deploy_live_status',
            label: 'Deploy and live status',
            snapshot: external.deployProbe,
            fallbackHref: '/status',
            fallbackOwner: 'integration',
            fallbackExpectedDashboardRowId: 'deploy_probe',
            fallbackContract: 'product.deploy_probe.readiness.v1',
            fallbackProbe: 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
            fallbackBlocker: 'Live deploy probe proof is not loaded.',
            readyDetail: 'Deploy probe is fresh and tied to product-progress proof.',
        }),
    ]
    const readyRows = rows.filter(row => row.state === 'ready').length
    const firstBlocker = rows.find(row => row.state !== 'ready')?.blocker
    const fullChainReady = rows.every(row => row.state === 'ready')

    return {
        schemaVersion: 'product.north_star.readiness.v1',
        generatedAt,
        query,
        fullChainReady,
        readyRows,
        totalRows: rows.length,
        firstBlocker,
        deployGate: buildDeployGate(rows, { fullChainReady, readyRows, firstBlocker }),
        direction: buildProductDirection(rows),
        rows,
    }
}

function buildDeployGate(rows: ProductNorthStarRow[], summary: {
    fullChainReady: boolean
    readyRows: number
    firstBlocker?: string
}): ProductNorthStarDeployGate {
    const rowsNeedingAction = rows.filter(row => row.state !== 'ready')
    return {
        state: summary.fullChainReady ? 'ready' : combineDirectionState(rows.map(row => row.state)),
        fullChainReady: summary.fullChainReady,
        readyRows: summary.readyRows,
        totalRows: rows.length,
        blockerRows: rows.filter(row => row.state === 'blocked').map(row => row.id),
        needsActionRows: rows.filter(row => row.state === 'needs_action').map(row => row.id),
        unavailableRows: rows.filter(row => row.state === 'unavailable').map(row => row.id),
        readyWorkflowLinks: uniqueStrings(rows.filter(row => row.state === 'ready').map(row => row.href)),
        actionNeededWorkflowLinks: uniqueStrings(rowsNeedingAction.map(row => row.href)),
        proofContracts: uniqueStrings(rows.map(row => row.backendProofContractVersion)),
        ownerLanes: uniqueStrings(rows.map(row => row.ownerLane)),
        expectedDashboardRowIds: uniqueStrings(rows.flatMap(row => row.expectedDashboardRowId.split(',').map(id => id.trim()))),
        firstBlocker: summary.firstBlocker || '',
        blockingProofRows: rowsNeedingAction.map(row => ({
            rowId: row.id,
            state: row.state === 'ready' ? 'needs_action' : row.state,
            ownerLane: row.ownerLane,
            href: row.href,
            blocker: row.blocker,
            proofTimestamp: row.proofTimestamp,
            staleAfterSeconds: row.staleAfterSeconds,
            expectedDashboardRowId: row.expectedDashboardRowId,
            backendProofContractVersion: row.backendProofContractVersion,
            integrationProbeHint: row.integrationProbeHint,
        })),
    }
}

function buildProductDirection(rows: ProductNorthStarRow[]): ProductNorthStarDirection[] {
    return [
        directionItem({
            id: 'multi_org_threat_monitoring',
            label: 'Multi-organization monitoring',
            backedRowIds: ['organizations', 'shared_watchlists'],
            detailReady: 'Organization access and shared watchlists are ready for team monitoring.',
            detailBlocked: 'Team monitoring needs organization access and shared watchlist proof before it can be treated as ready.',
            rows,
        }),
        directionItem({
            id: 'source_backed_intelligence',
            label: 'Source-backed intelligence',
            backedRowIds: ['source_coverage', 'public_ti_enrichment'],
            detailReady: 'Source coverage and public TI enrichment are both backed by loaded contracts.',
            detailBlocked: 'Intelligence quality depends on current source coverage and source-linked TI enrichment.',
            rows,
        }),
        directionItem({
            id: 'shared_alert_workflow',
            label: 'Shared alert workflow',
            backedRowIds: ['real_alert_generation', 'analyst_workflow'],
            detailReady: 'A backed alert is visible and can be handled in the analyst workflow.',
            detailBlocked: 'The alert workflow is not complete until a real alert is visible and reviewable by an analyst.',
            rows,
        }),
        directionItem({
            id: 'delivery_destinations',
            label: 'Delivery destinations',
            backedRowIds: ['webhook_delivery'],
            detailReady: 'Webhook delivery is tied to a dashboard-visible alert.',
            detailBlocked: 'Delivery needs webhook lifecycle proof and a matched delivery row.',
            rows,
        }),
        directionItem({
            id: 'enterprise_support',
            label: 'Enterprise support',
            backedRowIds: ['support_admin_audit', 'deploy_live_status'],
            detailReady: 'Support audit and live deploy status are current.',
            detailBlocked: 'Support and release readiness need audit proof and a fresh deploy probe.',
            rows,
        }),
    ]
}

function directionItem(input: {
    id: ProductNorthStarDirectionId
    label: string
    backedRowIds: ProductNorthStarRowId[]
    detailReady: string
    detailBlocked: string
    rows: ProductNorthStarRow[]
}): ProductNorthStarDirection {
    const backedRows = input.backedRowIds
        .map(id => input.rows.find(row => row.id === id))
        .filter((row): row is ProductNorthStarRow => Boolean(row))
    const state = combineDirectionState(backedRows.map(row => row.state))
    const blocker = backedRows.find(row => row.state !== 'ready')?.blocker || ''
    const href = backedRows.find(row => row.state !== 'ready')?.href || backedRows[0]?.href || '/dashboard'
    const ownerLanes = Array.from(new Set(backedRows.map(row => row.ownerLane).filter(Boolean)))
    const proofSummary = backedRows
        .map(row => `${row.label}: ${row.backendProofContractVersion}`)
        .join('; ')

    return {
        id: input.id,
        label: input.label,
        state,
        detail: state === 'ready' ? input.detailReady : input.detailBlocked,
        href,
        ownerLanes,
        backedRowIds: input.backedRowIds,
        blocker,
        proofSummary,
    }
}

function combineDirectionState(states: ReadinessStatus[]): ReadinessStatus {
    if (!states.length) return 'unavailable'
    if (states.every(state => state === 'ready')) return 'ready'
    if (states.some(state => state === 'blocked')) return 'blocked'
    if (states.some(state => state === 'needs_action')) return 'needs_action'
    return 'unavailable'
}

function organizationsRow(external: ProductReadinessExternalState, generatedAt: string): ProductNorthStarRow {
    const entitlement = external.entitlement
    const orgExport = external.orgAlertExport
    const state = combineState(entitlement?.status, orgExport?.status)
    const blocker = [
        rowBlocker(entitlement, 'DWM entitlement proof is not loaded.'),
        rowBlocker(orgExport, 'Organization alert-term export proof is not loaded.'),
    ].filter(Boolean).join(' ')
    return {
        id: 'organizations',
        label: 'Organizations',
        state,
        ownerLane: entitlement?.ownerLane || orgExport?.ownerLane || 'org',
        detail: state === 'ready' ? 'Organization entitlement and alert-term export are both ready.' : 'Organization access needs entitlement and alert-term export proof.',
        href: entitlement?.href || orgExport?.href || '/dashboard/dwm',
        proofSource: [entitlement?.source, orgExport?.source].filter(Boolean).join(' + ') || 'Missing organization readiness proof',
        proofTimestamp: latestTimestamp([entitlement?.proofTimestamp, orgExport?.proofTimestamp, generatedAt]) || generatedAt,
        staleAfterSeconds: Math.min(entitlement?.staleAfterSeconds || 900, orgExport?.staleAfterSeconds || 900),
        expectedDashboardRowId: [entitlement?.expectedDashboardRowId || 'entitlement_readiness', orgExport?.expectedDashboardRowId || 'org_alert_export'].join(','),
        backendProofContractVersion: [entitlement?.backendProofContractVersion || entitlement?.schemaVersion, orgExport?.backendProofContractVersion || orgExport?.schemaVersion].filter(Boolean).join(' + ') || 'organization.readiness.v1',
        blocker: state === 'ready' ? '' : blocker || 'Organization readiness proof is incomplete.',
        integrationProbeHint: [entitlement?.integrationProbeHint, orgExport?.integrationProbeHint].filter(Boolean).join(' ') || 'Load entitlement and organization alert-term export readiness.',
    }
}

function webhookDeliveryRow(external: ProductReadinessExternalState, generatedAt: string): ProductNorthStarRow {
    const health = external.webhookHealth
    const dashboard = external.dashboardEvidence
    const hasMatchedDelivery = dashboard?.deliveryEvidenceMatched === true && Boolean(dashboard.deliveryId)
    const state = health?.status === 'ready' && hasMatchedDelivery ? 'ready' : health?.status === 'blocked' ? 'blocked' : 'needs_action'
    return {
        id: 'webhook_delivery',
        label: 'Webhook delivery',
        state,
        ownerLane: health?.ownerLane || 'webhook',
        detail: state === 'ready' ? 'Webhook lifecycle and matched delivery proof are loaded.' : 'Webhook delivery needs lifecycle proof and a delivery matched to a dashboard alert.',
        href: health?.href || '/dashboard/automations?setup=dwm',
        proofSource: health?.source || 'Missing DWM webhook health readiness contract',
        proofTimestamp: latestTimestamp([health?.proofTimestamp, dashboard?.proofTimestamp, generatedAt]) || generatedAt,
        staleAfterSeconds: Math.min(health?.staleAfterSeconds || 900, dashboard?.staleAfterSeconds || 600),
        expectedDashboardRowId: [health?.expectedDashboardRowId || 'webhook_health', dashboard?.expectedDashboardRowId || 'dashboard_evidence'].join(','),
        backendProofContractVersion: [health?.backendProofContractVersion || health?.schemaVersion, dashboard?.backendProofContractVersion || dashboard?.schemaVersion].filter(Boolean).join(' + ') || 'dwm.webhook.readiness.v1',
        blocker: state === 'ready' ? '' : [rowBlocker(health, 'Webhook lifecycle proof is not loaded.'), hasMatchedDelivery ? '' : 'No delivery row is matched to a dashboard-visible alert.'].filter(Boolean).join(' '),
        integrationProbeHint: health?.integrationProbeHint || 'GET /api/dwm/webhooks must return active destination count and lifecycle health.',
    }
}

function snapshotRow(input: {
    id: ProductNorthStarRowId
    label: string
    snapshot?: ProductReadinessSnapshotBase & { schemaVersion?: string }
    fallbackHref: string
    fallbackOwner: string
    fallbackExpectedDashboardRowId: string
    fallbackContract: string
    fallbackProbe: string
    fallbackBlocker: string
    readyDetail: string
    hrefOverride?: string
}): ProductNorthStarRow {
    const snapshot = input.snapshot
    const state = snapshot?.status || 'unavailable'
    return {
        id: input.id,
        label: input.label,
        state,
        ownerLane: snapshot?.ownerLane || input.fallbackOwner,
        detail: state === 'ready' ? input.readyDetail : snapshot?.detail || input.fallbackBlocker,
        href: input.hrefOverride || snapshot?.href || input.fallbackHref,
        proofSource: snapshot?.source || input.fallbackBlocker,
        proofTimestamp: snapshot?.proofTimestamp || snapshot?.checkedAt || '',
        staleAfterSeconds: snapshot?.staleAfterSeconds || 900,
        expectedDashboardRowId: snapshot?.expectedDashboardRowId || input.fallbackExpectedDashboardRowId,
        backendProofContractVersion: snapshot?.backendProofContractVersion || snapshot?.schemaVersion || input.fallbackContract,
        blocker: state === 'ready' ? '' : rowBlocker(snapshot, input.fallbackBlocker),
        integrationProbeHint: snapshot?.integrationProbeHint || input.fallbackProbe,
    }
}

function publicTiEnrichmentRow(external: ProductReadinessExternalState, query: string): ProductNorthStarRow {
    const row = snapshotRow({
        id: 'public_ti_enrichment',
        label: 'Public TI enrichment',
        snapshot: external.publicTiProvenance,
        fallbackHref: actorIntelligenceHref(query),
        fallbackOwner: 'public-ti',
        fallbackExpectedDashboardRowId: 'public_ti_provenance',
        fallbackContract: 'ti.public_provenance.readiness.v1',
        fallbackProbe: 'GET /api/public-ti/provenance/readiness must return source/evidence/freshness readiness.',
        fallbackBlocker: 'Public TI provenance proof is not loaded.',
        readyDetail: 'Public TI enrichment has source, evidence, and freshness proof.',
    })
    if (row.href === '/ti') return { ...row, href: actorIntelligenceHref(query) }
    return row
}

function actorIntelligenceHref(query: string) {
    const slug = query.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
    return slug ? `/ti/${encodeURIComponent(slug)}` : '/ti'
}

function combineState(...states: Array<ReadinessStatus | undefined>): ReadinessStatus {
    if (states.some(state => state === 'blocked')) return 'blocked'
    if (states.length && states.every(state => state === 'ready')) return 'ready'
    if (states.some(state => state === 'needs_action')) return 'needs_action'
    return 'unavailable'
}

function rowBlocker(snapshot: ProductReadinessSnapshotBase | undefined, fallback: string) {
    if (!snapshot) return fallback
    if (snapshot.status === 'ready') return ''
    if (snapshot.unavailableReason) return snapshot.unavailableReason
    if (snapshot.blockers?.length) return snapshot.blockers.join(' ')
    return snapshot.detail || fallback
}

function latestTimestamp(values: Array<string | undefined>) {
    return values
        .filter(Boolean)
        .sort()
        .at(-1)
}

function uniqueStrings(values: Array<string | undefined>) {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))))
}
