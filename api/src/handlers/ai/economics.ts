import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { listGptClients } from '#utils/ws/handleGptMessage.ts'
import { requireAiUser } from './shared.ts'

type UsageEconomicsRow = {
    bucket: string
    event_count: string | number
    token_units: string | number
    billable_units: string | number
    estimated_cost_nok: string | number
    verified_units: string | number
    platform_error_units: string | number
}

type RecentRunRow = {
    id: string | number
    kind: AIUsageEventKind
    units: string | number
    billable_units: string | number
    estimated_cost_nok: string | number
    billing_mode: string
    outcome: string
    metadata: Record<string, unknown> | null
    created_at: string
}

type QueueDepthRow = {
    lane: string
    kind: string
    status: string
    count: string | number
}

type VerificationLatencyRow = {
    kind: string
    p50_ms: string | number | null
    p95_ms: string | number | null
    sample_count: string | number
}

type BuildDeployRow = {
    kind: string
    completed: string | number
    failed: string | number
    cancelled: string | number
    total: string | number
}

type FailedProofRow = {
    category: string
    kind: string
    count: string | number
}

type TimingRow = {
    p50_ms: string | number | null
    p95_ms: string | number | null
    sample_count: string | number
}

export async function getAiEconomics(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const days = clampDays(Number((req.query as { days?: string })?.days) || 30)
    const since = `${days} days`
    const [summaryResult, trendResult, recentResult, cacheResult, queueResult, verificationLatencyResult, buildDeployResult, failedProofResult, firstOutputResult, deployTimingResult] = await Promise.all([
        run(`
            SELECT
                COUNT(*)::int AS event_count,
                COALESCE(SUM(units), 0)::int AS token_units,
                COALESCE(SUM(billable_units), 0)::int AS billable_units,
                COALESCE(SUM(estimated_cost_nok), 0)::float AS estimated_cost_nok,
                COALESCE(SUM(CASE WHEN outcome IN ('verified', 'deployed') THEN billable_units ELSE 0 END), 0)::int AS verified_units,
                COALESCE(SUM(CASE WHEN outcome = 'platform_error' THEN units ELSE 0 END), 0)::int AS platform_error_units,
                COALESCE(SUM(CASE WHEN kind = 'browser_proof_completed' THEN units ELSE 0 END), 0)::int AS browser_proofs,
                COALESCE(SUM(CASE WHEN kind = 'build_minutes_recorded' THEN units ELSE 0 END), 0)::int AS build_minutes,
                COALESCE(SUM(CASE WHEN kind = 'deploy_minutes_recorded' THEN units ELSE 0 END), 0)::int AS deploy_minutes
            FROM ai_usage_events
            WHERE owner_id = $1
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
        run(`
            SELECT
                date_trunc('day', created_at) AS bucket,
                COUNT(*)::int AS event_count,
                COALESCE(SUM(units), 0)::int AS token_units,
                COALESCE(SUM(billable_units), 0)::int AS billable_units,
                COALESCE(SUM(estimated_cost_nok), 0)::float AS estimated_cost_nok,
                COALESCE(SUM(CASE WHEN outcome IN ('verified', 'deployed') THEN billable_units ELSE 0 END), 0)::int AS verified_units,
                COALESCE(SUM(CASE WHEN outcome = 'platform_error' THEN units ELSE 0 END), 0)::int AS platform_error_units
            FROM ai_usage_events
            WHERE owner_id = $1
              AND created_at >= NOW() - $2::interval
            GROUP BY 1
            ORDER BY 1 ASC
        `, [userId, since]),
        run(`
            SELECT id, kind, units, billable_units, estimated_cost_nok, billing_mode, outcome, metadata, created_at
            FROM ai_usage_events
            WHERE owner_id = $1
              AND kind IN ('ai_run_completed', 'ai_run_failed', 'ai_run_platform_error', 'deployment_started', 'browser_proof_completed', 'build_minutes_recorded', 'deploy_minutes_recorded')
            ORDER BY created_at DESC
            LIMIT 20
        `, [userId]),
        run(`
            SELECT
                COALESCE(SUM(CASE WHEN kind = 'cache_hit' THEN units ELSE 0 END), 0)::int AS cache_hits,
                COALESCE(SUM(CASE WHEN kind <> 'cache_hit' AND metadata ? 'cacheKey' THEN units ELSE 0 END), 0)::int AS cacheable_events
            FROM ai_usage_events
            WHERE owner_id = $1
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
        run(`
            SELECT lane, kind, status, COUNT(*)::int AS count
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND (created_at >= NOW() - $2::interval OR status IN ('queued', 'running'))
            GROUP BY lane, kind, status
            ORDER BY lane ASC, kind ASC, status ASC
        `, [userId, since]),
        run(`
            SELECT
                kind,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::float AS p50_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::float AS p95_ms,
                COUNT(*)::int AS sample_count
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND started_at IS NOT NULL
              AND completed_at IS NOT NULL
              AND created_at >= NOW() - $2::interval
            GROUP BY kind
            ORDER BY kind ASC
        `, [userId, since]),
        run(`
            SELECT
                kind,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                COUNT(*)::int AS total
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND kind IN ('build', 'deploy')
              AND created_at >= NOW() - $2::interval
            GROUP BY kind
            ORDER BY kind ASC
        `, [userId, since]),
        run(`
            SELECT
                CASE
                    WHEN status = 'cancelled' THEN 'cancelled'
                    WHEN COALESCE(error, '') ILIKE 'HTTP %' THEN 'http_error'
                    WHEN COALESCE(error, '') ILIKE '%timeout%' OR COALESCE(error, '') ILIKE '%abort%' THEN 'timeout'
                    WHEN COALESCE(error, '') ILIKE '%missing target%' THEN 'missing_target'
                    WHEN COALESCE(error, '') ILIKE '%console%' THEN 'browser_console'
                    ELSE 'runner_error'
                END AS category,
                kind,
                COUNT(*)::int AS count
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND status IN ('failed', 'cancelled')
              AND created_at >= NOW() - $2::interval
            GROUP BY 1, 2
            ORDER BY count DESC
            LIMIT 12
        `, [userId, since]),
        run(`
            SELECT
                percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(metadata->>'durationMs', '')::float)::float AS p50_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(metadata->>'durationMs', '')::float)::float AS p95_ms,
                COUNT(*)::int AS sample_count
            FROM ai_usage_events
            WHERE owner_id = $1
              AND kind IN ('ai_run_completed', 'ai_run_failed', 'ai_run_platform_error')
              AND metadata ? 'durationMs'
              AND metadata->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$'
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
        run(`
            SELECT
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000)::float AS p50_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000)::float AS p95_ms,
                COUNT(*)::int AS sample_count
            FROM ai_deployments
            WHERE owner_id = $1
              AND completed_at IS NOT NULL
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
    ])

    const summary = summaryResult.rows[0] || {}
    const cache = cacheResult.rows[0] || {}
    const verifiedUnits = numberValue(summary.verified_units)
    const costNok = numberValue(summary.estimated_cost_nok)
    const eventCount = numberValue(summary.event_count)
    const denominator = costNok > 0 ? costNok : 1
    const reliability = buildReliability({
        estimatedCostNok: costNok,
        queueRows: queueResult.rows as QueueDepthRow[],
        latencyRows: verificationLatencyResult.rows as VerificationLatencyRow[],
        buildDeployRows: buildDeployResult.rows as BuildDeployRow[],
        failedProofRows: failedProofResult.rows as FailedProofRow[],
        firstOutput: firstOutputResult.rows[0] as TimingRow | undefined,
        deployTiming: deployTimingResult.rows[0] as TimingRow | undefined,
    })

    return res.send({
        windowDays: days,
        keyMetric: 'verified useful project progress per minute per NOK',
        summary: {
            eventCount,
            tokenUnits: numberValue(summary.token_units),
            billableUnits: numberValue(summary.billable_units),
            estimatedCostNok: costNok,
            verifiedUnits,
            verifiedProgressPerNok: verifiedUnits / denominator,
            platformErrorUnits: numberValue(summary.platform_error_units),
            browserProofs: numberValue(summary.browser_proofs),
            buildMinutes: numberValue(summary.build_minutes),
            deployMinutes: numberValue(summary.deploy_minutes),
            cacheHits: numberValue(cache.cache_hits),
            cacheableEvents: numberValue(cache.cacheable_events),
            failedPlatformDiscountNok: estimatePlatformDiscount(recentResult.rows as RecentRunRow[]),
        },
        modes: pricingModes(),
        subscriptionTiers: subscriptionTiers(),
        reliability,
        trend: (trendResult.rows as UsageEconomicsRow[]).map((row) => ({
            bucket: row.bucket,
            eventCount: numberValue(row.event_count),
            tokenUnits: numberValue(row.token_units),
            billableUnits: numberValue(row.billable_units),
            estimatedCostNok: numberValue(row.estimated_cost_nok),
            verifiedUnits: numberValue(row.verified_units),
            platformErrorUnits: numberValue(row.platform_error_units),
        })),
        recentRuns: (recentResult.rows as RecentRunRow[]).map((row) => ({
            id: String(row.id),
            kind: row.kind,
            units: numberValue(row.units),
            billableUnits: numberValue(row.billable_units),
            estimatedCostNok: numberValue(row.estimated_cost_nok),
            billingMode: row.billing_mode,
            outcome: row.outcome,
            metadata: row.metadata || {},
            createdAt: row.created_at,
        })),
    })
}

function buildReliability({ estimatedCostNok, queueRows, latencyRows, buildDeployRows, failedProofRows, firstOutput, deployTiming }: {
    estimatedCostNok: number
    queueRows: QueueDepthRow[]
    latencyRows: VerificationLatencyRow[]
    buildDeployRows: BuildDeployRow[]
    failedProofRows: FailedProofRow[]
    firstOutput?: TimingRow
    deployTiming?: TimingRow
}) {
    const queueDepth = queueRows.map((row) => ({
        lane: row.lane || 'standard',
        model: row.kind || 'verification',
        kind: row.kind,
        status: row.status,
        count: numberValue(row.count),
    }))
    const totalQueued = queueDepth
        .filter((row) => row.status === 'queued')
        .reduce((sum, row) => sum + row.count, 0)
    const verificationLatency = latencyRows.map((row) => ({
        kind: row.kind,
        p50Ms: numberValue(row.p50_ms),
        p95Ms: numberValue(row.p95_ms),
        sampleCount: numberValue(row.sample_count),
    }))
    const buildDeploy = buildDeployRows.map((row) => {
        const total = numberValue(row.total)
        const completed = numberValue(row.completed)
        return {
            kind: row.kind,
            completed,
            failed: numberValue(row.failed),
            cancelled: numberValue(row.cancelled),
            total,
            successRate: total > 0 ? completed / total : 0,
        }
    })
    const failedProofCategories = failedProofRows.map((row) => ({
        category: row.category,
        kind: row.kind,
        count: numberValue(row.count),
    }))
    const gpuLanes = liveGpuLanes()
    const totalAvailableSessions = gpuLanes.reduce((sum, lane) => sum + lane.availableSessions, 0)
    const totalActiveSessions = gpuLanes.reduce((sum, lane) => sum + lane.activeSessions, 0)
    const successfulVerifiedBuilds = buildDeploy
        .filter((row) => row.kind === 'build' || row.kind === 'deploy')
        .reduce((sum, row) => sum + row.completed, 0)
    const lowestSuccessRate = buildDeploy.length ? Math.min(...buildDeploy.map((row) => row.successRate || 0)) : 1
    const incidentStatus = incidentFrom({
        gpuLaneCount: gpuLanes.length,
        totalQueued,
        totalAvailableSessions,
        lowestSuccessRate,
        failedProofCount: failedProofCategories.reduce((sum, row) => sum + row.count, 0),
    })

    return {
        incidentStatus,
        queueDepth,
        verificationLatency,
        buildDeploy,
        failedProofCategories,
        gpuLanes,
        costPerSuccessfulVerifiedBuildNok: successfulVerifiedBuilds > 0 ? estimatedCostNok / successfulVerifiedBuilds : 0,
        promptTiming: {
            p50FirstUsefulOutputMs: numberValue(firstOutput?.p50_ms),
            p95FirstUsefulOutputMs: numberValue(firstOutput?.p95_ms),
            sampleCount: numberValue(firstOutput?.sample_count),
        },
        deployTiming: {
            p50PromptToVerifiedDeployMs: numberValue(deployTiming?.p50_ms),
            p95PromptToVerifiedDeployMs: numberValue(deployTiming?.p95_ms),
            sampleCount: numberValue(deployTiming?.sample_count),
        },
        capacity: {
            totalQueued,
            totalActiveSessions,
            totalAvailableSessions,
        },
    }
}

function liveGpuLanes() {
    return listGptClients('gpt').flatMap((client) => {
        const model = client.modelId || client.model?.conversationId || client.name
        const clientPowerWatts = numberValue(client.power?.totalWatts)
        const lanes = client.lanes?.length ? client.lanes : []
        return lanes.map((lane) => ({
            clientName: client.displayName || client.name,
            lane: lane.label || lane.id || `GPU ${lane.gpuIndex + 1}`,
            model: lane.model || model,
            status: client.model?.status || 'unknown',
            tier: lane.tier || 'fast',
            activeSessions: numberValue(lane.activeRequests),
            queuedSessions: numberValue(lane.queuedRequests),
            maxSessions: numberValue(lane.maxRequests),
            availableSessions: numberValue(lane.availableRequests),
            contextMaxTokens: numberValue(lane.contextMaxTokens),
            memoryUsedMb: numberValue(lane.memoryUsedMb),
            memoryTotalMb: numberValue(lane.memoryTotalMb),
            gpuLoad: numberValue(lane.gpuLoad),
            powerWatts: numberValue(lane.powerDrawWatts) || clientPowerWatts / Math.max(1, lanes.length),
            powerLimitWatts: numberValue(lane.powerLimitWatts),
            temperatureC: numberValue(lane.temperatureC),
        }))
    })
}

function incidentFrom({ gpuLaneCount, totalQueued, totalAvailableSessions, lowestSuccessRate, failedProofCount }: {
    gpuLaneCount: number
    totalQueued: number
    totalAvailableSessions: number
    lowestSuccessRate: number
    failedProofCount: number
}) {
    if (!gpuLaneCount) {
        return { state: 'degraded', label: 'No live model lanes', message: 'Users can queue work, but no GPU model lanes are currently reporting capacity.' }
    }
    if (lowestSuccessRate < 0.8) {
        return { state: 'degraded', label: 'Verification failures elevated', message: 'Build or deploy checks are failing often enough that published progress may slow down.' }
    }
    if (totalQueued > Math.max(3, totalAvailableSessions * 2)) {
        return { state: 'busy', label: 'Queue pressure', message: 'More work is queued than currently available lane capacity can absorb quickly.' }
    }
    if (failedProofCount > 0) {
        return { state: 'watching', label: 'Proof failures present', message: 'Some checks failed in this window; users can still work while the system tracks the categories.' }
    }
    return { state: 'operational', label: 'Users can get work done', message: 'Model lanes, verification, and deploy checks are reporting normal capacity.' }
}

function clampDays(days: number) {
    if (!Number.isFinite(days)) return 30
    return Math.min(90, Math.max(7, Math.trunc(days)))
}

function numberValue(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
}

function estimatePlatformDiscount(rows: RecentRunRow[]) {
    return rows
        .filter((row) => row.outcome === 'platform_error')
        .reduce((sum, row) => sum + numberValue(row.estimated_cost_nok), 0)
}

function pricingModes() {
    return [
        { id: 'draft', label: 'Cheap draft', priority: 0, concurrency: 1, verification: 'none', discountFailedPlatformRuns: true },
        { id: 'standard', label: 'Standard', priority: 1, concurrency: 2, verification: 'basic build and smoke', discountFailedPlatformRuns: true },
        { id: 'verified', label: 'Verified', priority: 2, concurrency: 3, verification: 'browser proof, build, mobile, a11y basics', discountFailedPlatformRuns: true },
        { id: 'priority', label: 'Priority', priority: 4, concurrency: 5, verification: 'verified lane plus faster queue', discountFailedPlatformRuns: true },
    ]
}

function subscriptionTiers() {
    return [
        {
            id: 'free',
            label: 'Free',
            outcomeAllowance: 5,
            queuePriority: 'draft',
            concurrency: 1,
            fit: 'Small prototypes',
            features: ['limited verification', 'cheap draft lane', 'community queue'],
        },
        {
            id: 'starter',
            label: 'Starter',
            outcomeAllowance: 25,
            queuePriority: 'standard',
            concurrency: 1,
            fit: 'Personal sites',
            features: ['async queue', 'basic deploy', 'basic verification'],
        },
        {
            id: 'pro',
            label: 'Pro',
            outcomeAllowance: 120,
            queuePriority: 'verified',
            concurrency: 3,
            fit: 'Larger projects',
            features: ['custom domains', 'priority verification', 'rollback'],
        },
        {
            id: 'agency',
            label: 'Agency',
            outcomeAllowance: 350,
            queuePriority: 'priority',
            concurrency: 6,
            fit: 'Multiple client workspaces',
            features: ['handoff reports', 'white-label deploy', 'client workspace separation'],
        },
        {
            id: 'business',
            label: 'Business',
            outcomeAllowance: 900,
            queuePriority: 'priority',
            concurrency: 10,
            fit: 'Controlled teams',
            features: ['audit logs', 'approvals', 'scoped secrets', 'SSO later'],
        },
    ]
}
