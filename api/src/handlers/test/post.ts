import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHash } from 'node:crypto'
import { enqueueLoadTestRun } from './follow.ts'
import { verifiedClientIp } from '#utils/http/publicBoundary.ts'

const freeLoadTestLimit = 5
const defaultStages: Stage[] = [{ duration: '30s', target: 1 }]

type BodyProps = {
    url: string
    timeout?: number
    stages?: Stage[]
}

type Stage = {
    duration: string
    target: number
}

export default async function postTest(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const { url, timeout, stages } = (req.body as BodyProps) ?? {}
    const ownerId = req.headers.id as string | undefined
    if (!url) {
        return res.status(400).send({ error: 'No url provided.' })
    }
    const targetUrl = normalizeUrl(url)
    if (!targetUrl) {
        return res.status(400).send({ error: 'Only http and https urls can be tested.' })
    }
    const safeStages = normalizeStages(stages)
    const safeTimeout = normalizeTimeout(timeout)

    const quota = await getLoadTestQuota(req, ownerId)
    if (quota.remaining <= 0) {
        return res.status(402).send({
            error: 'The free load-testing allowance has been used. Choose a plan to keep running checks.',
            quota,
        })
    }

    const fields: string[] = ['url', 'quota_identity', 'quota_plan']
    const values: (string | number | null | boolean | string[] | Date)[] = [targetUrl, quota.identity, quota.plan]
    const placeholders: string[] = values.map((_, index) => `$${index + 1}`)

    if (ownerId) {
        fields.push('owner_id')
        values.push(ownerId)
        placeholders.push(`$${values.length}`)
    }

    fields.push('timeout')
    values.push(safeTimeout)
    placeholders.push(`$${values.length}`)

    fields.push('stages')
    values.push(JSON.stringify(safeStages))
    placeholders.push(`$${values.length}`)

    fields.push('status')
    values.push('queued')
    placeholders.push(`$${values.length}`)

    const sql = `
        INSERT INTO load_tests (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *;
    `

    const result = await run(sql, values)
    const test = result.rows[0]
    await enqueueLoadTestRun(test.id)
    const queued = await run('SELECT * FROM load_tests WHERE id = $1', [test.id])
    return res.send({
        ...queued.rows[0],
        quota: {
            ...quota,
            used: quota.used + 1,
            remaining: Math.max(0, quota.remaining - 1),
        },
    })
}

function normalizeUrl(url: string) {
    try {
        const parsed = new URL(url.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null
        }
        parsed.hash = ''
        return parsed.toString()
    } catch {
        return null
    }
}

export function normalizeTimeout(value: unknown) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return 30
    const seconds = numeric > 1000 ? Math.ceil(numeric / 1000) : numeric
    return Math.min(Math.max(Math.round(seconds), 1), 120)
}

export function normalizeStages(value: unknown) {
    if (!Array.isArray(value)) return defaultStages
    const stages = value
        .map((stage) => ({
            duration: typeof stage?.duration === 'string' && /^\d+[smh]$/.test(stage.duration.trim()) ? stage.duration.trim() : '',
            target: Number(stage?.target),
        }))
        .filter((stage) => stage.duration && Number.isInteger(stage.target) && stage.target >= 0 && stage.target <= 100)
    return stages.length ? stages.slice(0, 8) : defaultStages
}

async function getLoadTestQuota(req: FastifyRequest, ownerId: string | undefined) {
    const plan = ownerId ? await loadOwnerPlan(ownerId) : 'free'
    const limit = limitForPlan(plan)
    const periodStart = plan === 'free' ? null : currentMonthStart()
    const identity = ownerId
        ? `user:${ownerId}`
        : `anon:${hashIdentity([
            headerValue(req.headers['x-load-test-client-id']),
            verifiedClientIp(req),
            headerValue(req.headers['user-agent']),
        ].join('|'))}`

    const usedResult = periodStart
        ? await run(
            'SELECT COUNT(*)::int AS used FROM load_tests WHERE quota_identity = $1 AND created_at >= $2',
            [identity, periodStart]
        )
        : await run(
            'SELECT COUNT(*)::int AS used FROM load_tests WHERE quota_identity = $1',
            [identity]
        )
    const used = Number(usedResult.rows[0]?.used || 0)
    return {
        identity,
        plan,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        resetsAt: plan === 'free' ? null : nextMonthStart().toISOString(),
    }
}

async function loadOwnerPlan(ownerId: string) {
    const result = await run(
        'SELECT plan FROM load_test_subscriptions WHERE owner_id = $1 AND active = TRUE LIMIT 1',
        [ownerId]
    )
    return normalizePlan(result.rows[0]?.plan)
}

function normalizePlan(value: unknown) {
    if (value === 'starter' || value === 'team' || value === 'volume') {
        return value
    }
    return 'free'
}

function limitForPlan(plan: string) {
    if (plan === 'starter') return 50
    if (plan === 'team') return 500
    if (plan === 'volume') return 5000
    return freeLoadTestLimit
}

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || ''
}

function hashIdentity(value: string) {
    return createHash('sha256').update(value || 'anonymous').digest('hex').slice(0, 32)
}

function currentMonthStart() {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function nextMonthStart() {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}
