#!/usr/bin/env bun
/** Deploy an already-built OVH service, retaining runtime settings and rollback. */
import { execFileSync, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'

const PORTS = { frontend: 19300, api: 19080, auth: 19090 } as const
type Kind = keyof typeof PORTS
const run = (args: string[], env: NodeJS.ProcessEnv = process.env, ignore = false) => {
    const result = spawnSync(args[0], args.slice(1), { env, encoding: 'utf8', stdio: ignore ? 'ignore' : 'pipe' })
    if (result.status !== 0) throw new Error(result.stderr || `${args[0]} failed`)
    return result.stdout || ''
}
const inspect = (name: string) => JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]

export function settingsFor(kind: Kind, old: any, release: string) {
    const port = PORTS[kind]
    const settings = Object.fromEntries(old.Config.Env.map((value: string) => value.split(/=(.*)/s).slice(0, 2))) as Record<string, string>
    if (old.HostConfig.NetworkMode !== 'host' || settings.PORT !== String(port) || !old.State.Running)
        throw new Error(`Expected the running OVH ${kind} on host-network port ${port}.`)
    delete settings.COMPACT_PWNED_RANGE_API
    Object.assign(settings, { PWNED_LOOKUP_API: 'https://api.hanasand.com/api/pwned', HANASAND_RELEASE_COMMIT: release,
        HOSTNAME: '127.0.0.1', RECOVERY_SITE: 'ovhcloud' })
    if (kind === 'frontend') Object.assign(settings, { RECOVERY_STATUS_URL: settings.RECOVERY_STATUS_URL || 'http://127.0.0.1:19901/status',
        RECOVERY_STATE_FILE: settings.RECOVERY_STATE_FILE || '/recovery/state.json' })
    if (kind === 'api') Object.assign(settings, { AI_HEALTH_WORKER_BASE: 'http://127.0.0.1:28080', API_HTTP_ONLY: '1' })
    return settings
}

export function dockerRunArgs(kind: Kind, name: string, port: number, release: string, old: any, settings: Record<string, string>) {
    const args = ['docker', 'run', '-d', '--name', name, '--network', 'host', '--restart', old.HostConfig.RestartPolicy.Name,
        '--memory', String(old.HostConfig.Memory), '--cpus', String(old.HostConfig.NanoCpus / 1e9)]
    for (const mount of old.Mounts) {
        if (!['bind', 'volume'].includes(mount.Type)) throw new Error('Unexpected mount type; refusing to omit it.')
        const source = mount.Type === 'volume' ? mount.Name : mount.Source
        args.push('-v', `${source}:${mount.Destination}${mount.RW ? '' : ':ro'}`)
    }
    for (const alias of old.HostConfig.ExtraHosts || []) args.push('--add-host', alias)
    for (const key of Object.keys(settings)) args.push('-e', key)
    const entry = { frontend: 'server.js', api: 'src/index.ts', auth: 'src/authServer.ts' }[kind]
    args.push('--entrypoint', 'bun', `hanasand-recovery-${kind}:${release}`, entry)
    return { args, env: { ...process.env, ...settings, PORT: String(port) } }
}

export async function check(kind: Kind, port: number, name: string, release: string, request = fetch, wait = delay) {
    const base = `http://127.0.0.1:${port}`
    let ready = false
    for (let i = 0; i < 20; i++) {
        try {
            const response = await request(base + (kind === 'frontend' ? '/api/recovery/ready' : kind === 'api' ? '/health' : '/ready'), { signal: AbortSignal.timeout(5000) })
            const status = await response.json() as any
            if (response.ok && status.ok && status.release === release) { ready = true; break }
        } catch { /* Wait for the staged service to become ready. */ }
        await wait(1000)
    }
    if (!ready) throw new Error('Service readiness check failed.')
    if (kind !== 'frontend') {
        const output = execFileSync('docker', ['exec', name, 'bun', '-e', 'import check from "./src/utils/pwned/checkPwned.ts"; console.log(JSON.stringify(await check("superman123")))'], { encoding: 'utf8' })
        const result = JSON.parse(output)
        if (result.ok !== false || result.source !== 'compact-index' || !Number.isInteger(result.count) || result.count <= 0)
            throw new Error('Compact password validation failed.')
        return
    }
    const response = await request(base + '/api/pwned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: 'B79CF' }), signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error(`Compact password lookup returned HTTP ${response.status}.`)
    const header = new Uint8Array(await response.arrayBuffer()).slice(0, 12)
    if (response.headers.get('Content-Type') !== 'application/vnd.hanasand.pwned-prefix' ||
        Buffer.from(header.slice(0, 8)).toString() !== 'PWNPRF02' || Buffer.from(header.slice(8)).readUInt32LE(0) !== 2)
        throw new Error('Expected both compact indexes through the HTTPS API.')
}

export async function deploy(kind: Kind, release: string) {
    if (!/^[0-9a-f]{40}$/.test(release)) throw new Error('Pass the full image release commit.')
    const servingPort = PORTS[kind]
    const candidatePort = servingPort + (kind === 'api' ? 2 : 1)
    const name = `hanasand-${kind}`
    const old = inspect(name)
    const settings = settingsFor(kind, old, release)
    const image = `hanasand-recovery-${kind}:${release}`
    run(['docker', 'image', 'inspect', image], process.env, true)
    const candidate = `${name}-candidate-${release.slice(0, 12)}`
    const previous = `${name}-before-${release.slice(0, 12)}`
    for (const target of [candidate, previous]) {
        if (spawnSync('docker', ['inspect', target], { stdio: 'ignore' }).status === 0) throw new Error(`${target} already exists; inspect before retrying.`)
    }
    const server = createServer()
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(candidatePort, '127.0.0.1', resolve) })
    await new Promise<void>(resolve => server.close(() => resolve()))
    const launch = (target: string, port: number) => {
        const { args, env } = dockerRunArgs(kind, target, port, release, old, settings)
        run(args, env, true)
    }
    try { launch(candidate, candidatePort); await check(kind, candidatePort, candidate, release) }
    finally { spawnSync('docker', ['rm', '-f', candidate], { stdio: 'ignore' }) }
    run(['docker', 'stop', name])
    try { run(['docker', 'rename', name, previous]) }
    catch (error) { run(['docker', 'start', name]); throw error }
    try {
        launch(name, servingPort)
        await check(kind, servingPort, name, release)
    } catch (error) {
        spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
        run(['docker', 'rename', previous, name])
        run(['docker', 'start', name])
        throw error
    }
    console.log(`OVH ${kind} deployed and compact lookup verified: ${release}`)
}

if (import.meta.main) {
    const [kind, release] = Bun.argv.slice(2)
    if (!Object.hasOwn(PORTS, kind)) throw new Error('Choose frontend, api or auth.')
    if (process.env.HANASAND_OVH_DEPLOY_LOCKED !== '1') {
        const child = spawnSync('flock', ['-n', '/tmp/hanasand-frontend-deploy.lock', process.execPath, import.meta.path, kind, release || ''],
            { stdio: 'inherit', env: { ...process.env, HANASAND_OVH_DEPLOY_LOCKED: '1' } })
        process.exit(child.status ?? 1)
    }
    await deploy(kind as Kind, release || '')
}
