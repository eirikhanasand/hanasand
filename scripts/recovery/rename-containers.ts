#!/usr/bin/env node
/** Rename existing service containers and their operational references without restarting them. */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, chmodSync, unlinkSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ports = { api: [20802, 20803, 8082, 8083], frontend: [3200, 3300, 3000, 3100], auth: [8183, 8184, 8181, 8182] }
function pairName(kind, port) {
    const index = ports[kind]?.indexOf(Number(port)) ?? -1
    if (index < 0) throw new Error(`Unsupported ${kind} deployment port ${port}`)
    return `hanasand-${kind}-${index + 1}`
}
function simpleName(name) {
    if (!name.startsWith('hanasand-recovery-')) return name
    for (const [kind, values] of Object.entries(ports)) for (const port of values) {
        if (name === `hanasand-recovery-${kind}-${port}`) return pairName(kind, port)
    }
    const suffix = name.slice('hanasand-recovery-'.length)
    const fixed = { 'db-local': 'db-standby', monitor: 'health-monitor', 'proxy-0': 'proxy-1', 'proxy-1': 'proxy-2' }
    if (fixed[suffix]) return `hanasand-${fixed[suffix]}`
    if (['api', 'auth', 'frontend', 'db', 'ti', 'ti-local', 'tunnel', 'tunnel-monitor', 'tunnel-web', 'tunnel-intelligence', 'tunnel-database'].includes(suffix)) return `hanasand-${suffix}`
    return name
}
function rewrite(value) {
    if (typeof value === 'string') return simpleName(value)
    if (Array.isArray(value)) return value.map(rewrite)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]))
    return value
}
function dockerJson(args) { return JSON.parse(execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })) }
function run(args) { execFileSync('docker', args, { stdio: 'inherit' }) }
function save(pathname, value) { writeFileSync(pathname, value) }

async function main(root) {
    if (!root) throw new Error('Usage: rename-containers.ts SITE_ROOT')
    const ids = execFileSync('docker', ['ps', '-aq'], { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean)
    const containers = ids.length ? dockerJson(['inspect', ...ids]) : []
    const existing = new Set(containers.map(item => item.Name.replace(/^\/+/, '')))
    const plan = containers.map(item => [item, simpleName(item.Name.replace(/^\/+/, ''))]).filter(([item, target]) => target !== item.Name.replace(/^\/+/, ''))
    const targets = plan.map(([, target]) => target)
    if (new Set(targets).size !== targets.length || targets.some(name => existing.has(name))) throw new Error('Container name collision; nothing changed.')

    const originals = new Map()
    const renamed = []
    const remember = file => originals.set(file, existsSync(file) ? readFileSync(file, 'utf8') : null)
    try {
        const config = path.join(root, 'config.json')
        remember(config)
        const configStat = statSync(config)
        const replacement = rewrite(JSON.parse(originals.get(config)))
        const backup = `${config}.before-container-names`
        if (!existsSync(backup)) { writeFileSync(backup, originals.get(config), { flag: 'wx', mode: 0o600 }); chmodSync(backup, 0o600) }
        const temporary = config.replace(/\.json$/, '.names.tmp')
        writeFileSync(temporary, JSON.stringify(replacement, null, 2), { mode: configStat.mode & 0o777 })
        chmodSync(temporary, configStat.mode & 0o777)
        await import('node:fs/promises').then(fs => fs.rename(temporary, config))

        const entrypoint = process.env.HANASAND_TYPESCRIPT_ENTRYPOINT || fileURLToPath(import.meta.url)
        const source = path.dirname(entrypoint)
        for (const filename of ['container_names.ts', 'start-inspur-pair.ts', 'render_proxy.ts', 'deploy-pair.sh', 'start-routing.sh', 'start-tunnel.sh', 'isolated-tunnels.ts', 'configure.ts']) {
            const file = path.join(root, filename)
            if (!existsSync(file) && filename !== 'container_names.ts') continue
            remember(file)
            save(file, readFileSync(path.join(source, filename), 'utf8'))
        }
        const runner = path.join(root, 'run-typescript-node.sh')
        remember(runner)
        save(runner, readFileSync(path.resolve(source, '../run-typescript-node.sh'), 'utf8'))
        chmodSync(runner, 0o755)

        for (const [item, target] of plan) {
            const old = item.Name.replace(/^\/+/, '')
            run(['rename', item.Id, target])
            renamed.push([item.Id, old])
            const after = dockerJson(['inspect', item.Id])[0]
            if (after.Name !== `/${target}` || after.State.StartedAt !== item.State.StartedAt || after.State.Running !== item.State.Running) throw new Error(`Rename verification failed for ${old}`)
            console.log(`${old} -> ${target}`)
        }
    } catch (error) {
        for (const [id, old] of renamed.reverse()) run(['rename', id, old])
        for (const [file, content] of originals) {
            if (content === null) { if (existsSync(file)) unlinkSync(file) }
            else save(file, content)
        }
        throw error
    }
    console.log(`Verified ${plan.length} renames; no container was restarted.`)
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/rename-containers.ts') || process.argv[1]?.endsWith('/rename-containers.ts')) {
    const args = process.env.HANASAND_RENAME_LOCK_HELD === '1' ? process.argv.slice(2) : null
    if (args) await main(args[0])
    else {
        const entrypoint = process.env.HANASAND_TYPESCRIPT_ENTRYPOINT || fileURLToPath(import.meta.url)
        const runner = path.resolve(path.dirname(entrypoint), '../run-typescript-node.sh')
        const locked = spawnSync('flock', ['-x', '/tmp/hanasand-frontend-deploy.lock', runner, entrypoint, process.argv[2]], {
            env: { ...process.env, HANASAND_RENAME_LOCK_HELD: '1' }, stdio: 'inherit',
        })
        process.exit(locked.status ?? 1)
    }
}
