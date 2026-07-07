import run from '#db'
import { spawn } from 'child_process'
import broadcast from '#utils/ws/broadcast.ts'
import { testClients } from '#ws'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const currentFile = fileURLToPath(import.meta.url)
const handlersDir = path.dirname(currentFile)
const apiSrcDir = path.resolve(handlersDir, '..', '..')
const k6ScriptPath = path.join(apiSrcDir, 'utils', 'test', 'test.ts')

const defaultStages = [
    { 'duration': '5s', 'target': 1 },
    { 'duration': '10s', 'target': 5 },
    { 'duration': '15s', 'target': 15 },
    { 'duration': '15s', 'target': 30 },
    { 'duration': '10s', 'target': 15 },
    { 'duration': '10s', 'target': 5 },
    { 'duration': '5s', 'target': 1 }
]

let queueRunning = false

export async function enqueueLoadTestRun(id: string, rerun = false) {
    await run(
        `UPDATE load_tests
         SET status = 'queued',
             queue_position = COALESCE((SELECT MAX(queue_position) + 1 FROM load_tests WHERE status = 'queued'), 1),
             logs = CASE WHEN $2 THEN '{}'::text[] ELSE logs END,
             errors = CASE WHEN $2 THEN '{}'::text[] ELSE errors END,
             exit_code = CASE WHEN $2 THEN NULL ELSE exit_code END,
             finished_at = CASE WHEN $2 THEN NULL ELSE finished_at END,
             duration = CASE WHEN $2 THEN NULL ELSE duration END,
             summary = CASE WHEN $2 THEN '{}'::jsonb ELSE summary END
         WHERE id = $1
           AND ($2 OR status <> 'running')`,
        [id, rerun]
    )
    pumpLoadTestQueue().catch((error) => console.error(`Failed to pump load-test queue: ${error}`))
}

export function startLoadTestQueue() {
    pumpLoadTestQueue().catch((error) => console.error(`Failed to start load-test queue: ${error}`))
}

async function pumpLoadTestQueue() {
    if (queueRunning) return
    queueRunning = true
    try {
        while (true) {
            await refreshLoadTestQueuePositions()
            const next = await run(
                `SELECT id
                 FROM load_tests
                 WHERE status = 'queued'
                 ORDER BY queue_position ASC, created_at ASC
                 LIMIT 1`
            )
            const id = next.rows[0]?.id
            if (!id) return
            await followTest(id, true)
        }
    } finally {
        queueRunning = false
    }
}

async function refreshLoadTestQueuePositions() {
    await run(`
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position ASC, created_at ASC) AS position
            FROM load_tests
            WHERE status = 'queued'
        )
        UPDATE load_tests tests
        SET queue_position = ranked.position
        FROM ranked
        WHERE tests.id = ranked.id
          AND tests.queue_position <> ranked.position
    `)
    await run('UPDATE load_tests SET queue_position = 0 WHERE status <> \'queued\' AND queue_position <> 0')
}

export default async function followTest(id: string, rerun?: boolean) {
    const result = await run('SELECT * FROM load_tests WHERE id = $1', [id])
    const test: Test = result.rows[0]
    if (!test || test.status === 'running' || (test.status === 'done' && !rerun)) {
        return
    }

    const start = new Date()
    const stages = test.stages.default ? defaultStages : test.stages
    const runResult = await run(
        'INSERT INTO load_test_runs (test_id, run_number, url, status, started_at) VALUES ($1, COALESCE((SELECT MAX(run_number) + 1 FROM load_test_runs WHERE test_id = $1), 1), $2, $3, $4) RETURNING id, run_number',
        [id, test.url, 'running', start]
    )
    const runId = runResult.rows[0]?.id
    const summaryPath = path.join(tmpdir(), `hanasand-k6-${id}-${runId || Date.now()}.json`)

    await run(
        `UPDATE load_tests
         SET status = $1,
             queue_position = 0,
             started_at = $2,
             logs = $3,
             errors = $4,
             exit_code = NULL,
             finished_at = NULL,
             duration = NULL,
             summary = '{}'::jsonb
         WHERE id = $5`,
        ['running', start, [], [], id]
    )
    await refreshLoadTestQueuePositions()

    const k6 = spawn('k6', [
        'run',
        '--summary-export', summaryPath,
        '--env', `URL=${test.url}`,
        '--env', `TIMEOUT=${timeoutSeconds(test.timeout)}`,
        '--env', `STAGES=${JSON.stringify(normalizeStages(stages))}`,
        k6ScriptPath
    ], {
        cwd: apiSrcDir,
    })

    await new Promise<void>((resolve) => {
        k6.stdout.on('data', async (data) => {
            const message = data.toString()
            broadcast({ data: { type: 'log', message }, id, clients: testClients })
            await run('UPDATE load_tests SET logs = array_append(logs, $1) WHERE id = $2', [message, id])
        })

        k6.stderr.on('data', async (data) => {
            const message = data.toString()
            broadcast({ data: { type: 'error', message }, id, clients: testClients })
            await run('UPDATE load_tests SET errors = array_append(errors, $1) WHERE id = $2', [message, id])
        })

        k6.on('error', async (error) => {
            const message = String(error)
            await run('UPDATE load_tests SET status = $1, errors = array_append(errors, $2), finished_at = $3 WHERE id = $4', ['failed', message, new Date(), id])
            if (runId) await run('UPDATE load_test_runs SET status = $1, finished_at = $2, summary = $3::jsonb WHERE id = $4', ['failed', new Date(), JSON.stringify({ error: message }), runId])
            broadcast({ data: { type: 'error', message }, id, clients: testClients })
            resolve()
        })

        k6.on('close', async (code) => {
            const finished = new Date()
            const durationMs = finished.getTime() - start.getTime()
            const summary = await readK6Summary(summaryPath)
            await run(
                `UPDATE load_tests 
                SET status = $1, exit_code = $2, finished_at = $3, duration = $4, summary = $5::jsonb
                WHERE id = $6`,
                ['done', code, finished, `${durationMs} milliseconds`, JSON.stringify(summary), id]
            )
            if (runId) {
                await run(
                    `UPDATE load_test_runs
                     SET status = $1, exit_code = $2, finished_at = $3, duration_ms = $4, summary = $5::jsonb
                     WHERE id = $6`,
                    ['done', code, finished, durationMs, JSON.stringify(summary), runId]
                )
            }

            broadcast({ data: { type: 'done', code, summary, durationMs }, id, clients: testClients })
            resolve()
        })
    })
}

function timeoutSeconds(timeout: unknown) {
    const value = Number(timeout) || 30
    return value > 1000 ? Math.ceil(value / 1000) : value
}

function normalizeStages(stages: unknown) {
    return Array.isArray(stages) && stages.length ? stages : defaultStages
}

async function readK6Summary(summaryPath: string) {
    try {
        const content = await readFile(summaryPath, 'utf8')
        await unlink(summaryPath).catch(() => undefined)
        const payload = JSON.parse(content)
        const duration = metricValues(payload.metrics?.http_req_duration)
        const failed = metricValues(payload.metrics?.http_req_failed)
        const requests = metricValues(payload.metrics?.http_reqs)
        const checks = metricValues(payload.metrics?.checks)

        return {
            requests: requests.count || 0,
            checks: checks.passes || 0,
            failures: checks.fails || 0,
            failureRate: failed.rate ?? failed.value ?? 0,
            duration: {
                avg: duration.avg || 0,
                med: duration.med || 0,
                p90: duration['p(90)'] || 0,
                p95: duration['p(95)'] || 0,
                max: duration.max || 0,
            },
        }
    } catch {
        return {}
    }
}

function metricValues(metric: Record<string, number> & { values?: Record<string, number> } | undefined) {
    return metric?.values || metric || {}
}
