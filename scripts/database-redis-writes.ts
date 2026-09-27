#!/usr/bin/env bun
/** Observe Redis write notifications without reading or retaining values. */
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { readFile, rename, writeFile } from 'node:fs/promises'

function command(args) {
    return execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function engineFor(item) {
    const image = item.Config.Image.split('/').at(-1).split(':')[0]
    return image === 'redis' ? 'Redis' : null
}

async function atomicWrite(path, value) {
    const temporary = path.replace(/\.[^.]+$/, '.tmp')
    await writeFile(temporary, JSON.stringify(value), { mode: 0o644 })
    await rename(temporary, path)
}

export async function run({ destination = '/var/lib/hanasand/metrics/database-redis-writes.json', runCommand = command, now = Date.now } = {}) {
    let writes = {}
    try { writes = JSON.parse(await readFile(destination, 'utf8')) }
    catch { /* A missing or corrupt prior sample starts a fresh metadata map. */ }

    const processes = new Map()
    let discovered = 0
    let flushed = 0
    const discover = async () => {
        const ids = runCommand(['docker', 'ps', '-q']).split(/\r?\n/).filter(Boolean)
        const items = ids.length ? JSON.parse(runCommand(['docker', 'inspect', ...ids])) : []
        for (const item of items) {
            if (engineFor(item) !== 'Redis') continue
            const name = item.Name.replace(/^\/+/, '')
            if (processes.has(name)) continue
            const current = JSON.parse(runCommand(['docker', 'exec', item.Id, 'redis-cli', '--json', 'CONFIG', 'GET', 'notify-keyspace-events']))
            const flags = typeof current === 'object' && !Array.isArray(current) ? current['notify-keyspace-events'] || '' : current[1]
            runCommand(['docker', 'exec', item.Id, 'redis-cli', 'CONFIG', 'SET', 'notify-keyspace-events', [...new Set(flags + 'EA')].sort().join('')])
            const child = spawn('docker', ['exec', item.Id, 'redis-cli', '--json', 'PSUBSCRIBE', '__keyevent@*__:*'], { stdio: ['ignore', 'pipe', 'ignore'] })
            let buffer = ''
            child.stdout.setEncoding('utf8')
            child.stdout.on('data', chunk => {
                buffer += chunk
                let newline
                while ((newline = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, newline).trim()
                    buffer = buffer.slice(newline + 1)
                    if (!line) continue
                    try {
                        const event = JSON.parse(line)
                        if (!Array.isArray(event) || event.length !== 4 || event[0] !== 'pmessage') continue
                        const database = 'db' + event[2].split('@', 2)[1].split('__:', 1)[0]
                        writes[JSON.stringify([name, database, event[3]])] = now() / 1000
                    } catch { /* Ignore subscription acknowledgements and malformed lines. */ }
                }
            })
            child.on('exit', () => processes.delete(name))
            processes.set(name, child)
        }
    }

    try {
        while (true) {
            const seconds = now() / 1000
            if (seconds - discovered > 30) {
                discovered = seconds
                try { await discover() } catch { /* A failed scan retries on the next interval. */ }
            }
            if (seconds - flushed >= 5) {
                writes = Object.fromEntries(Object.entries(writes)
                    .filter(([, at]) => seconds - at < 7 * 86400)
                    .sort((left, right) => left[1] - right[1]).slice(-100000))
                await atomicWrite(destination, writes)
                flushed = seconds
            }
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    } finally {
        for (const child of processes.values()) child.kill('SIGTERM')
    }
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/database-redis-writes.ts') || process.argv[1]?.endsWith('/database-redis-writes.ts')) {
    await run()
}
