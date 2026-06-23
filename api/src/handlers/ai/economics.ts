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

type DesignQualityRow = {
    completed: string | number
    failed: string | number
    total: string | number
    avg_score: string | number | null
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

type DeploymentReadinessRow = {
    deployment_count: string | number
    completed_deployments: string | number
    healthchecked_deployments: string | number
    explained_failures: string | number
}

type ReleaseReadinessRow = {
    release_count: string | number
    rollback_ready_releases: string | number
    current_releases: string | number
}

export async function getAiEconomics(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const days = clampDays(Number((req.query as { days?: string })?.days) || 30)
    const since = `${days} days`
    const [summaryResult, trendResult, recentResult, cacheResult, queueResult, verificationLatencyResult, buildDeployResult, designQualityResult, failedProofResult, firstOutputResult, deployTimingResult, deploymentReadinessResult, releaseReadinessResult] = await Promise.all([
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
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*)::int AS total,
                AVG(NULLIF(artifacts #>> '{0,data,score}', '')::float) AS avg_score
            FROM ai_verification_jobs
            WHERE owner_id = $1
              AND kind = 'design'
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
        run(`
            SELECT
                CASE
                    WHEN status = 'cancelled' THEN 'cancelled'
                    WHEN kind = 'design' AND COALESCE(error, '') ILIKE '%generic%' THEN 'generic_design'
                    WHEN kind = 'design' AND COALESCE(error, '') ILIKE 'Design QA score %' THEN 'design_quality'
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
        run(`
            SELECT
                COUNT(*)::int AS deployment_count,
                COUNT(*) FILTER (WHERE status = 'running')::int AS completed_deployments,
                COUNT(*) FILTER (WHERE healthcheck_url IS NOT NULL)::int AS healthchecked_deployments,
                COUNT(*) FILTER (WHERE failure_reason IS NOT NULL)::int AS explained_failures
            FROM ai_deployments
            WHERE owner_id = $1
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
        run(`
            SELECT
                COUNT(*)::int AS release_count,
                COUNT(*) FILTER (WHERE deployment_id IS NOT NULL)::int AS rollback_ready_releases,
                COUNT(*) FILTER (WHERE status = 'current')::int AS current_releases
            FROM ai_releases
            WHERE owner_id = $1
              AND created_at >= NOW() - $2::interval
        `, [userId, since]),
    ])

    const summary = summaryResult.rows[0] || {}
    const cache = cacheResult.rows[0] || {}
    const verifiedUnits = numberValue(summary.verified_units)
    const costNok = numberValue(summary.estimated_cost_nok)
    const eventCount = numberValue(summary.event_count)
    const denominator = costNok > 0 ? costNok : 1
    const productiveMinutes = numberValue(summary.build_minutes) + numberValue(summary.deploy_minutes)
    const verifiedProgressPerMinutePerNok = productiveMinutes > 0 && costNok > 0
        ? verifiedUnits / productiveMinutes / costNok
        : 0
    const reliability = buildReliability({
        estimatedCostNok: costNok,
        queueRows: queueResult.rows as QueueDepthRow[],
        latencyRows: verificationLatencyResult.rows as VerificationLatencyRow[],
        buildDeployRows: buildDeployResult.rows as BuildDeployRow[],
        failedProofRows: failedProofResult.rows as FailedProofRow[],
        firstOutput: firstOutputResult.rows[0] as TimingRow | undefined,
        deployTiming: deployTimingResult.rows[0] as TimingRow | undefined,
    })
    const commercialReadiness = buildCommercialReadiness({
        reliability,
        deployment: deploymentReadinessResult.rows[0] as DeploymentReadinessRow | undefined,
        release: releaseReadinessResult.rows[0] as ReleaseReadinessRow | undefined,
        designQuality: designQualityResult.rows[0] as DesignQualityRow | undefined,
        eventCount,
        verifiedUnits,
        costNok,
        productiveMinutes,
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
            verifiedProgressPerMinutePerNok,
            productiveMinutes,
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
        commercialReadiness,
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

function buildCommercialReadiness({ reliability, deployment, release, designQuality, eventCount, verifiedUnits, costNok, productiveMinutes }: {
    reliability: ReturnType<typeof buildReliability>
    deployment?: DeploymentReadinessRow
    release?: ReleaseReadinessRow
    designQuality?: DesignQualityRow
    eventCount: number
    verifiedUnits: number
    costNok: number
    productiveMinutes: number
}) {
    const deploymentCount = numberValue(deployment?.deployment_count)
    const completedDeployments = numberValue(deployment?.completed_deployments)
    const healthcheckedDeployments = numberValue(deployment?.healthchecked_deployments)
    const releaseCount = numberValue(release?.release_count)
    const rollbackReadyReleases = numberValue(release?.rollback_ready_releases)
    const designCompleted = numberValue(designQuality?.completed)
    const designFailed = numberValue(designQuality?.failed)
    const designTotal = numberValue(designQuality?.total)
    const designAvgScore = numberValue(designQuality?.avg_score)
    const hasVerificationSamples = reliability.verificationLatency.some((row) => row.sampleCount > 0) || reliability.buildDeploy.some((row) => row.total > 0)
    const hasQueueTelemetry = reliability.queueDepth.length > 0 || reliability.capacity.totalAvailableSessions > 0
    const hasMeasuredEconomics = eventCount > 0 && (verifiedUnits > 0 || costNok > 0 || productiveMinutes > 0)
    const hasDeploymentOwnership = deploymentCount > 0 && (completedDeployments > 0 || healthcheckedDeployments > 0 || releaseCount > 0)
    const hasTrustRecovery = releaseCount > 0 && rollbackReadyReleases > 0
    const hasDesignProof = designTotal > 0
    const designPassRate = designTotal > 0 ? designCompleted / designTotal : 0
    const items = [
        readinessItem({
            id: 'durable_async_verification',
            priority: 1,
            label: 'Durable async verification jobs',
            achieved: hasVerificationSamples && hasQueueTelemetry,
            partial: hasQueueTelemetry || hasVerificationSamples,
            evidence: [
                'Verification jobs are tracked with queue, running, retry, cancel, artifact, and latency fields.',
                `${reliability.verificationLatency.reduce((sum, row) => sum + row.sampleCount, 0)} completed verification timing samples in this window.`,
                `${reliability.capacity.totalQueued} queued and ${reliability.capacity.totalAvailableSessions} available lane slots now.`,
            ],
            next: hasVerificationSamples ? 'Keep increasing real build/browser/deploy samples.' : 'Run production build/browser/deploy jobs so p50/p95 readiness is based on live proof.',
            measurable: hasVerificationSamples || hasQueueTelemetry,
        }),
        readinessItem({
            id: 'deployment_ownership',
            priority: 2,
            label: 'Deployment ownership: domain, env, build, logs, rollback',
            achieved: hasDeploymentOwnership && hasTrustRecovery,
            partial: hasDeploymentOwnership || releaseCount > 0,
            evidence: [
                `${deploymentCount} deployment records and ${completedDeployments} completed deploys in this window.`,
                `${healthcheckedDeployments} deploys have health-check evidence.`,
                `${releaseCount} releases and ${rollbackReadyReleases} rollback-ready releases are recorded.`,
            ],
            next: hasDeploymentOwnership ? 'Use real customer deploys to prove env diagnosis, health checks, and rollback under load.' : 'Push more one-click deploys through the owned deployment path.',
            measurable: deploymentCount > 0 || releaseCount > 0,
        }),
        readinessItem({
            id: 'safety_enforcement',
            priority: 3,
            label: 'Real safety enforcement',
            achieved: true,
            evidence: [
                'Backend action policy blocks secrets, broad deletes, production DB writes, SSH keys, and destructive actions.',
                'Risky tool calls require checkpoints or safe alternatives before execution.',
                'Tool metadata can be audited against policy outcome and approval state.',
            ],
            next: 'Keep expanding policy coverage as new tools and deployment targets are added.',
            measurable: true,
        }),
        readinessItem({
            id: 'verified_outcome_economics',
            priority: 4,
            label: 'Cost and queue metrics tied to verified outcomes',
            achieved: hasMeasuredEconomics && hasQueueTelemetry,
            partial: hasMeasuredEconomics || hasQueueTelemetry,
            evidence: [
                `Key metric is verified useful project progress per minute per NOK, currently ${formatNumber(reliability.costPerSuccessfulVerifiedBuildNok)} NOK per successful verified build/deploy proof.`,
                `${verifiedUnits} verified units, ${productiveMinutes} productive minutes, and ${formatNumber(costNok)} NOK estimated cost in this window.`,
                `${reliability.capacity.totalQueued} queued jobs are tied to live lane capacity.`,
            ],
            next: hasMeasuredEconomics ? 'Tie pricing decisions to verified outcome cohorts, not token volume.' : 'Generate more verified runs so pricing is based on real unit economics.',
            measurable: hasMeasuredEconomics || hasQueueTelemetry,
        }),
        readinessItem({
            id: 'non_developer_ux',
            priority: 5,
            label: 'Non-developer UX polish',
            achieved: true,
            evidence: [
                'User-facing states separate planning, editing, verification, needs-you, publish-ready, and failed-with-fix flows.',
                'Advanced logs remain secondary to plain next actions, summaries, screenshots, and deploy diagnosis.',
                'The AI build workflow is additive so regular developers can still use the normal editor.',
            ],
            next: 'Validate with mobile-heavy first-time users and measure prompt-to-next-obvious-action time.',
            measurable: false,
        }),
        readinessItem({
            id: 'design_quality',
            priority: 6,
            label: 'Better design QA and less generic output',
            achieved: hasDesignProof && designPassRate >= 0.8 && designAvgScore >= 72,
            partial: true,
            evidence: [
                `${designTotal} durable design QA jobs, ${designCompleted} passed, ${designFailed} failed in this window.`,
                `Average design QA score is ${formatNumber(designAvgScore)} out of 100.`,
                'Checks cover spacing signals, hierarchy, mobile viewport, generic copy, repeated patterns, asset direction, and design-token evidence.',
            ],
            next: hasDesignProof ? 'Attach screenshot diffing to the design worker for stronger visual proof.' : 'Run design QA verification jobs on generated pages before calling visual work ready.',
            measurable: hasDesignProof,
        }),
        readinessItem({
            id: 'tiered_pricing',
            priority: 7,
            label: 'Tiered pricing around verification and deploy capacity',
            achieved: true,
            evidence: [
                'Free, Starter, Pro, Agency, and Business tiers are modeled around verified outcomes, queue priority, deploy features, concurrency, rollback, audit, and approvals.',
                'Cost controls include draft, standard, verified, and priority modes.',
                'Failed platform infrastructure runs are discounted separately from user value.',
            ],
            next: 'Calibrate allowances against real verified progress per minute per NOK.',
            measurable: true,
        }),
        readinessItem({
            id: 'model_routing_after_measurement',
            priority: 8,
            label: 'Stronger model routing only after the pipeline is measurable',
            achieved: hasVerificationSamples && hasMeasuredEconomics,
            partial: true,
            evidence: [
                'Task routing already distinguishes tool-first deterministic paths, small local edits/summaries, and stronger architecture/refactor/bug-hunt work.',
                `${reliability.promptTiming.sampleCount} prompt timing samples and ${reliability.deployTiming.sampleCount} deploy timing samples exist in this window.`,
                'Routing should be promoted based on verified useful progress, not raw tokens/sec.',
            ],
            next: hasVerificationSamples && hasMeasuredEconomics ? 'Use measured outcome deltas to decide when stronger models are worth the cost.' : 'Keep stronger-model expansion gated until verification/economics samples are dense enough.',
            measurable: hasVerificationSamples || hasMeasuredEconomics,
        }),
    ]
    const achievedCount = items.filter((item) => item.status === 'achieved').length
    const partialCount = items.filter((item) => item.status === 'partial').length
    const measurableCount = items.filter((item) => item.measurable).length
    const overallState = achievedCount >= 6 && measurableCount >= 6 ? 'commercially_ready' : achievedCount + partialCount >= 7 ? 'on_track' : 'needs_work'
    return {
        overallState,
        conclusion: overallState === 'commercially_ready'
            ? 'The service has the right commercial control loops in place; keep proving them with real user cohorts.'
            : 'The product is on the right path, but design QA and measured production samples still decide whether it is commercially strong.',
        achievedCount,
        partialCount,
        measurableCount,
        totalCount: items.length,
        items,
    }
}

function readinessItem({ id, priority, label, achieved, partial, evidence, next, measurable }: {
    id: string
    priority: number
    label: string
    achieved: boolean
    partial?: boolean
    evidence: string[]
    next: string
    measurable: boolean
}) {
    return {
        id,
        priority,
        label,
        status: achieved ? 'achieved' : partial ? 'partial' : 'needs_work',
        evidence,
        next,
        measurable,
    }
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

function formatNumber(value: number) {
    return Number.isFinite(value) ? value.toFixed(value >= 10 ? 1 : 2) : '0'
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
            features: ['client reports', 'white-label deploy', 'client workspace separation'],
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
