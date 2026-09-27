#!/usr/bin/env node
/** Deploy the independent backup worker without restarting API services. */
import { execFileSync, spawnSync } from 'node:child_process'

const release = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(release || '')) throw new Error('Pass the full built release commit.')
const image = `hanasand-recovery-api:${release}`
const inspect = name => JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]
const source = inspect('hanasand_api')
const original = Object.fromEntries(source.Config.Env.map(item => {
    const separator = item.indexOf('=')
    return [item.slice(0, separator), item.slice(separator + 1)]
}))
const settings = Object.fromEntries(Object.entries(original).filter(([key]) => ['DB', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD'].includes(key) || key.startsWith('DB_BACKUP_')))
Object.assign(settings, { NODE_ENV: 'production', DB_BACKUP_WORKER: '1', DB_BACKUP_WORKER_SOCKET: '/var/lib/hanasand/backups/database/.worker.sock', HANASAND_RELEASE_COMMIT: release })
const mount = source.Mounts.find(item => item.Destination === '/var/lib/hanasand')
if (!mount) throw new Error('API database-backup volume is unavailable')
const network = Object.keys(source.NetworkSettings.Networks).find(name => name.endsWith('hanasandnet'))
if (!network) throw new Error('API network is unavailable')
const name = 'hanasand_database_backup'
execFileSync('docker', ['image', 'inspect', image], { stdio: 'ignore' })
if (spawnSync('docker', ['inspect', name], { stdio: 'ignore' }).status === 0) {
    const state = JSON.parse(execFileSync('docker', ['exec', name, 'cat', '/var/lib/hanasand/backups/database/.backup-state.json'], { encoding: 'utf8' }))
    if (state.operations.some(item => item.status === 'running')) throw new Error('A backup operation is running; leave this worker in place until it finishes.')
    execFileSync('docker', ['stop', name], { stdio: 'ignore' })
    execFileSync('docker', ['rm', name], { stdio: 'ignore' })
}
const command = ['run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', network, '--cpus', '0.5', '--memory', '512m', '--blkio-weight', '100',
    '-v', `${mount.Name || mount.Source}:/var/lib/hanasand`]
for (const key of Object.keys(settings)) command.push('-e', key)
command.push('--entrypoint', 'bun', image, 'src/backupWorker.ts')
execFileSync('docker', command, { env: { ...process.env, ...settings }, stdio: 'inherit' })
