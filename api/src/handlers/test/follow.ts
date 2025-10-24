import run from '#db'
import { spawn } from 'child_process'
import broadcast from '#utils/ws/broadcast.ts'
import { testClients } from '#ws'

const defaultStages = [
    { "duration": "5s", "target": 1 },
    { "duration": "10s", "target": 10 },
    { "duration": "10s", "target": 50 },
    { "duration": "10s", "target": 100 },
    { "duration": "10s", "target": 200 },
    { "duration": "10s", "target": 500 },
    { "duration": "10s", "target": 1000 },
    { "duration": "10s", "target": 500 },
    { "duration": "10s", "target": 200 },
    { "duration": "10s", "target": 100 },
    { "duration": "10s", "target": 50 },
    { "duration": "10s", "target": 10 },
    { "duration": "10s", "target": 1 }
]

export default async function followTest(id: string) {
    const result = await run('SELECT * FROM load_tests WHERE id = $1', [id])
    const test = result.rows[0]
    if (!test) {
        return
    }

    const start = new Date()
    const stages = test.stages.default ? defaultStages : test.stages

    await run('UPDATE load_tests SET status = $1 WHERE id = $2', ['running', id])

    const k6 = spawn('k6', [
        'run',
        '--env', `URL=${test.url}`,
        '--env', `TIMEOUT=${test.timeout}`,
        '--env', `STAGES=${JSON.stringify(stages)}`,
        'src/utils/test.ts'
    ])

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
        await run(
            `UPDATE load_tests 
            SET status = $1, exit_code = $2, finished_at = $3, duration = $4 
            WHERE id = $5`,
            ['done', code, finished, `${durationMs} milliseconds`, id]
        )

        broadcast({ data: { type: 'done', code }, id, clients: testClients })
    })
}
