#!/usr/bin/env bun
/** Isolate interactive recovery traffic from the existing replication tunnel. */
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

export const GROUPS: Record<string, string[]> = {
    ai: ['-R', '127.0.0.1:28080:127.0.0.1:8080'], replication: ['-R', '127.0.0.1:18503:127.0.0.1:8503'],
    database: ['-R', '127.0.0.1:28503:127.0.0.1:8503', '-R', '127.0.0.1:28502:127.0.0.1:18502', '-L', '127.0.0.1:28506:127.0.0.1:18506'],
    intelligence: ['-R', '127.0.0.1:28097:127.0.0.1:18097', '-L', '127.0.0.1:29097:127.0.0.1:19097'],
    web: ['-L', '127.0.0.1:29300:127.0.0.1:19300', '-L', '127.0.0.1:29080:127.0.0.1:19080', '-L', '127.0.0.1:29090:127.0.0.1:19090'],
    support: ['-L', '127.0.0.1:29181:127.0.0.1:19181'], monitor: ['-R', '127.0.0.1:29911:127.0.0.1:19901', '-L', '127.0.0.1:29911:127.0.0.1:19901'],
}
const run = (args: string[], capture = false) => {
    const result = spawnSync(args[0], args.slice(1), { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
    if (result.status !== 0) throw new Error(result.stderr || `${args[0]} failed`)
    return result.stdout || ''
}

export function migrate(config: any) {
    const result = structuredClone(config)
    const ports: Record<number, number> = result.site === 'inspur'
        ? { 19300: 29300, 19080: 29080, 19090: 29090, 19097: 29097, 18506: 28506 }
        : { 18097: 28097, 18503: 28503, 18502: 28502 }
    for (const service of result.services) for (const instance of service.instances) {
        if (instance.site === result.site) continue
        for (const field of ['address', 'health']) if (instance[field])
            for (const [oldPort, newPort] of Object.entries(ports)) instance[field] = instance[field].replaceAll(`127.0.0.1:${oldPort}`, `127.0.0.1:${newPort}`)
    }
    if (result.peerStatusUrl) result.peerStatusUrl = result.peerStatusUrl.replace(':19911/', ':29911/')
    return result
}

export function authorize(file = path.join(homedir(), '.ssh/authorized_keys')) {
    const original = readFileSync(file, 'utf8')
    const lines = original.split(/(?<=\n)/)
    const matching = lines.map((line, i) => line.includes('permitlisten="127.0.0.1:18503"') ? i : -1).filter(i => i >= 0)
    if (matching.length !== 1) throw new Error('Expected exactly one existing restricted replication tunnel key')
    const index = matching[0]
    if (!['restrict,', 'port-forwarding,', 'command="false"'].every(option => lines[index].includes(option))) throw new Error('Existing tunnel key restrictions do not match the expected policy')
    for (const port of [28503, 28502, 28097, 29911, 28080]) {
        const permission = `permitlisten="127.0.0.1:${port}"`
        if (!lines[index].includes(permission)) lines[index] = permission + ',' + lines[index]
    }
    const open = 'permitopen="127.0.0.1:19181"'
    if (!lines[index].includes(open)) lines[index] = open + ',' + lines[index]
    if (lines.join('') === original) return
    const backup = `${file}.before-isolated-tunnels`
    if (!existsSync(backup)) { writeFileSync(backup, original, { mode: 0o600 }); chmodSync(backup, 0o600) }
    const temporary = `${file}.isolated.tmp`
    writeFileSync(temporary, lines.join(''), { mode: 0o600 }); chmodSync(temporary, 0o600); renameSync(temporary, file)
}

export function configure(root: string) {
    const file = path.join(root, 'config.json'), original = readFileSync(file, 'utf8'), config = migrate(JSON.parse(original))
    const backup = path.join(root, 'config.before-isolated-tunnels.json')
    if (!existsSync(backup)) { writeFileSync(backup, original, { mode: 0o600 }); chmodSync(backup, 0o600) }
    const temporary = path.join(root, 'config.isolated.tmp')
    writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 }); chmodSync(temporary, 0o600); renameSync(temporary, file)
}

function start(image: string, selected?: string) {
    run(['docker', 'image', 'inspect', image])
    const groups = selected ? { [selected]: GROUPS[selected] } : GROUPS
    for (const [group, forwards] of Object.entries(groups)) {
        const name = `hanasand-tunnel-${group}`
        const existing = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', name], { encoding: 'utf8' })
        if (existing.status === 0) { if (existing.stdout.trim() !== 'true') throw new Error(`${name} exists but is stopped; inspect before replacing it`); continue }
        if (group === 'replication') {
            const legacy = spawnSync('docker', ['inspect', '-f', '{{json .Config.Cmd}}', 'hanasand-tunnel'], { encoding: 'utf8' })
            if (legacy.status === 0 && JSON.parse(legacy.stdout).includes(GROUPS.replication[1])) { console.log('Replication still uses the legacy tunnel. Finish any backup before split-replication.'); continue }
        }
        run(['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', 'host', '--memory', '128m', '--cpus', group === 'replication' ? '2' : '.5',
            '-v', '/home/hanasand/hanasand/ops/secrets/private/reverse-tunnel-key:/run/key:ro', '-v', '/home/hanasand/hanasand/ops/secrets/private/ovh-known-hosts:/run/known_hosts:ro',
            '--entrypoint', 'ssh', image, '-NT', ...(group === 'replication' ? ['-C'] : []), '-i', '/run/key', '-o', 'UserKnownHostsFile=/run/known_hosts', '-o', 'StrictHostKeyChecking=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', ...forwards, 'ubuntu@192.99.32.185'])
    }
}

function splitReplication(image?: string) {
    const name = 'hanasand-tunnel', replica = 'hanasand-tunnel-replication', saved = 'hanasand-tunnel-before-compression'
    const old = JSON.parse(run(['docker', 'inspect', name], true))[0]
    if (!old.Config.Cmd.includes(GROUPS.replication[1])) { if (run(['docker', 'inspect', '-f', '{{.State.Running}}', replica], true).trim() !== 'true') throw new Error('Separate replication tunnel is not running'); return }
    if (run(['docker', 'exec', 'hanasand_database', 'psql', '-U', 'hanasand', '-d', 'hanasand', '-Atc', "SELECT count(*) FROM pg_stat_replication WHERE state='backup'"], true).trim() !== '0') throw new Error('Finish the running database backup before splitting its tunnel')
    const command = old.Config.Cmd as string[], index = command.indexOf(GROUPS.replication[1])
    if (index < 1 || command[index - 1] !== '-R' || !old.State.Running || old.HostConfig.NetworkMode !== 'host' || JSON.stringify(old.Config.Entrypoint) !== '["ssh"]') throw new Error('Unexpected legacy tunnel configuration')
    const first = Math.min(...command.map((value, i) => ['-R', '-L'].includes(value) ? i : Infinity))
    const legacyCommand = [...command.slice(0, index - 1), ...command.slice(index + 1)]
    const replicaCommand = [...command.slice(0, first), '-C', '-R', GROUPS.replication[1], command.at(-1)!]
    const selectedImage = image || old.Image
    run(['docker', 'image', 'inspect', selectedImage])
    for (const target of [replica, saved]) if (spawnSync('docker', ['inspect', target], { stdio: 'ignore' }).status === 0) throw new Error(`${target} already exists; inspect it before continuing`)
    const env = Object.fromEntries(old.Config.Env.map((entry: string) => { const i = entry.indexOf('='); return [entry.slice(0, i), entry.slice(i + 1)] }))
    const launch = (target: string, cmd: string[]) => {
        const args = ['docker', 'run', '-d', '--name', target, '--restart', old.HostConfig.RestartPolicy.Name, '--network', 'host', '--memory', String(old.HostConfig.Memory), '--cpus', String(target === replica ? 2 : old.HostConfig.NanoCpus / 1e9)]
        for (const mount of old.Mounts) { if (mount.Type !== 'bind') throw new Error('Unexpected tunnel mount'); args.push('-v', `${mount.Source}:${mount.Destination}${mount.RW ? '' : ':ro'}`) }
        for (const key of Object.keys(env)) args.push('-e', key)
        const result = spawnSync(args[0], [...args.slice(1), '--entrypoint', 'ssh', selectedImage, ...cmd], { env: { ...process.env, ...env }, stdio: 'inherit' })
        if (result.status !== 0) throw new Error(`Could not launch ${target}`)
    }
    run(['docker', 'stop', name])
    try { run(['docker', 'rename', name, saved]) } catch (error) { run(['docker', 'start', name]); throw error }
    try {
        launch(name, legacyCommand); launch(replica, replicaCommand); Bun.sleepSync(3000)
        for (const target of [name, replica]) { const status = JSON.parse(run(['docker', 'inspect', target], true))[0]; if (!status.State.Running || status.RestartCount) throw new Error(`${target} did not stay running`) }
    } catch (error) {
        for (const target of [name, replica]) spawnSync('docker', ['rm', '-f', target], { stdio: 'ignore' })
        run(['docker', 'rename', saved, name]); run(['docker', 'start', name]); throw error
    }
    console.log('Replication uses the same port and key on a separate compressed connection. Verify replica catch-up.')
}

if (import.meta.main) {
    const [action, ...args] = Bun.argv.slice(2)
    if (action === 'authorize') authorize()
    else if (action === 'configure') { if (!args[0]) throw new Error('--root is required for configure'); configure(args[0]) }
    else if (action === 'start') { const i = args.indexOf('--image'), g = args.indexOf('--group'); if (i < 0) throw new Error('--image must identify the built tunnel image'); start(args[i + 1], g < 0 ? undefined : args[g + 1]) }
    else if (action === 'split-replication') { const i = args.indexOf('--image'); splitReplication(i < 0 ? undefined : args[i + 1]) }
    else throw new Error('Usage: isolated-tunnels.ts authorize|start --image IMAGE|configure --root ROOT|split-replication [--image IMAGE]')
}
