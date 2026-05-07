import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
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

export async function getAiEconomics(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const days = clampDays(Number((req.query as { days?: string })?.days) || 30)
    const since = `${days} days`
    const [summaryResult, trendResult, recentResult, cacheResult] = await Promise.all([
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
    ])

    const summary = summaryResult.rows[0] || {}
    const cache = cacheResult.rows[0] || {}
    const verifiedUnits = numberValue(summary.verified_units)
    const costNok = numberValue(summary.estimated_cost_nok)
    const eventCount = numberValue(summary.event_count)
    const denominator = costNok > 0 ? costNok : 1

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
        { id: 'starter', label: 'Starter', outcomeAllowance: 25, queuePriority: 'standard', concurrency: 1 },
        { id: 'studio', label: 'Studio', outcomeAllowance: 120, queuePriority: 'verified', concurrency: 3 },
        { id: 'business', label: 'Business', outcomeAllowance: 500, queuePriority: 'priority', concurrency: 8 },
    ]
}
