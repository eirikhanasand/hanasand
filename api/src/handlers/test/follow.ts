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
             logs = $2,
             errors = $3,
             exit_code = NULL,
             finished_at = NULL,
             duration = NULL,
             summary = '{}'::jsonb
         WHERE id = $4`,
        ['running', [], [], id]
    )

    const k6 = spawn('k6', [
        'run',
        '--summary-export', summaryPath,
        '--env', `URL=${test.url}`,
        '--env', `TIMEOUT=${test.timeout}`,
        '--env', `STAGES=${JSON.stringify(stages)}`,
        k6ScriptPath
    ], {
        cwd: apiSrcDir,
    })

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
    })
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
