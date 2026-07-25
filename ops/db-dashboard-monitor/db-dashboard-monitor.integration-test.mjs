import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { once } from 'node:events'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = await mkdtemp(join(tmpdir(), 'hanasand-db-monitor-'))
const scriptDir = dirname(fileURLToPath(import.meta.url))

try {
    const backupStatus = join(root, 'LATEST-STATUS')
    const backupState = join(root, 'backup.json')
    const dashboardState = join(root, 'dashboard.json')
    const requestsPath = join(root, 'status-requests.jsonl')
    const fetchHook = join(root, 'fetch-hook.mjs')
    await writeFile(backupStatus, [
        'format=hanasand.threat_intel_backup_status.v2',
        'status=failed',
        'exit_code=1',
        'phase=backup',
        'reason=command_failed',
        `finished_at=${new Date().toISOString()}`,
        'archive=/tmp/failed-backup',
        '',
    ].join('\n'))
    await writeFile(fetchHook, `
        import { appendFile } from 'node:fs/promises'
        globalThis.fetch = async (_url, options) => {
            await appendFile(process.env.HANASAND_TEST_STATUS_REQUESTS, options.body + '\\n')
            return new Response('{"ok":true}', { status: 201 })
        }
    `)

    const child = spawn(process.execPath, ['db-dashboard-monitor.mjs'], {
        cwd: scriptDir,
        env: {
            ...process.env,
            NODE_OPTIONS: `--import=${pathToFileURL(fetchHook).href}`,
            HANASAND_DB_MONITOR_USER: '',
            HANASAND_DB_MONITOR_PASSWORD: '',
            HANASAND_DB_MONITOR_STATE: dashboardState,
            HANASAND_TI_BACKUP_STATUS: backupStatus,
            HANASAND_TI_BACKUP_MONITOR_STATE: backupState,
            HANASAND_STATUS_INGEST_BASE_URL: 'https://status.test',
            HANASAND_STATUS_INGEST_TOKEN: 'test-token',
            HANASAND_TEST_STATUS_REQUESTS: requestsPath,
            HANASAND_DB_MONITOR_FAILURE_THRESHOLD: '1',
            HANASAND_DB_MONITOR_TIMEOUT_MS: '1000',
            DISCORD_WEBHOOK_URL: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk })
    const [exitCode] = await once(child, 'exit')
    assert.equal(exitCode, 2, stderr)
    const requests = (await readFile(requestsPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(
        requests.map(({ service, check_name, status }) => ({ service, check_name, status })),
        [
            { service: 'threat-intelligence', check_name: 'Backup continuity', status: 'down' },
            { service: 'database', check_name: 'Database dashboard', status: 'down' },
        ],
    )
    assert.equal(JSON.parse(await readFile(backupState, 'utf8')).reason, 'ti_backup_failed')
    assert.equal(JSON.parse(await readFile(dashboardState, 'utf8')).reason, 'missing_credentials')
    console.log('Database dashboard monitor integration test passed.')
} finally {
    await rm(root, { recursive: true, force: true })
}
