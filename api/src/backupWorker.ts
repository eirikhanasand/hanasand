import { createServer } from 'node:http'
import { chmod, mkdir, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import pg from 'pg'
import config from './constants.ts'
import * as backups from './utils/db/backups.ts'
import { runTrackedBackgroundJob } from './utils/backgroundJobRuntime.ts'

process.env.DB_BACKUP_WORKER = '1'
const socket = process.env.DB_BACKUP_WORKER_SOCKET
if (!socket) throw new Error('DB_BACKUP_WORKER_SOCKET is required')

// Only one owner may initialize the audit ledger or remove stale operation locks.
// The separate container outlives API deployments and client disconnects.
const owner = new pg.Client({ host: config.DB_HOST, port: Number(config.DB_PORT) || 5432,
    user: config.DB_USER || 'hanasand', password: config.DB_PASSWORD, database: config.DB || 'hanasand', keepAlive: true })
// Losing this session loses ownership: stop before another worker can take over.
owner.on('error', () => { console.error('Backup worker lost its ownership connection'); process.exit(1) })
await owner.connect()
const acquired = await owner.query('SELECT pg_try_advisory_lock(hashtextextended(\'hanasand.database-backup-worker\', 0)) AS acquired')
if (!acquired.rows[0].acquired) throw new Error('Another backup worker is already running')
{
    await mkdir(dirname(socket), { recursive: true, mode: 0o700 })
    await backups.listDatabaseBackupFiles()
    await unlink(socket).catch(error => { if (error.code !== 'ENOENT') throw error })
    const server = createServer(async (req, res) => {
        try {
            if (req.method !== 'POST' || req.url !== '/') throw Object.assign(new Error('Not found'), { statusCode: 404 })
            let body = ''
            for await (const chunk of req) {
                body += chunk
                if (body.length > 16384) throw Object.assign(new Error('Request too large'), { statusCode: 413 })
            }
            const { method, args } = JSON.parse(body)
            if (!Array.isArray(args)) throw Object.assign(new Error('Invalid request'), { statusCode: 400 })
            let value
            switch (method) {
                case 'status': value = await backups.collectDatabaseBackupServices(); break
                case 'files': value = await backups.listDatabaseBackupFiles(...args as [string?, string?]); break
                case 'create': value = await backups.createDatabaseBackup(args[0]); break
                case 'verify': value = await backups.verifyDatabaseBackupFile(args[0], args[1]); break
                case 'restore': value = await backups.restoreDatabaseBackupFile(args[0]); break
                case 'pause':
                    if (typeof args[0] !== 'boolean') throw Object.assign(new Error('Invalid pause value'), { statusCode: 400 })
                    value = await backups.setDatabaseBackupSchedulePaused(args[0]); break
                case 'due': value = await backups.runDueDatabaseBackup(new Date(args[0])); break
                default: throw Object.assign(new Error('Unknown backup action'), { statusCode: 400 })
            }
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ value }))
        } catch (error) {
            const failure = error as { statusCode?: number, message?: string }
            res.writeHead(failure.statusCode || 500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: failure.message || 'Backup operation failed.' }))
        }
    })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve) })
    await chmod(socket, 0o600)
    let running = false
    const tick = async () => {
        if (running) return
        running = true
        try {
            await runTrackedBackgroundJob(backups.DATABASE_BACKUP_JOB_ID, () => backups.runDueDatabaseBackup())
        } catch (error) {
            if ((error as { statusCode?: number }).statusCode !== 409) console.error('Database backup failed:', error)
        } finally { running = false }
    }
    setInterval(() => { void tick() }, 60_000)
    void tick()
    console.log('Database backup worker ready')
    await new Promise(() => {})
}
