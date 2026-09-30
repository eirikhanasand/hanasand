import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'

export const hostConsoleNames = ['hanasand', 'inspur'] as const
export type HostConsoleName = typeof hostConsoleNames[number]

const supportedKeyTypes = new Set([
    'ssh-ed25519',
    'ssh-rsa',
    'ecdsa-sha2-nistp256',
    'ecdsa-sha2-nistp384',
    'ecdsa-sha2-nistp521',
    'sk-ssh-ed25519@openssh.com',
    'sk-ecdsa-sha2-nistp256@openssh.com',
])

const managedKeysScript = [
    'import os, pathlib, sys, tempfile',
    'path = pathlib.Path.home() / ".ssh" / "authorized_keys"',
    'start = "# BEGIN Hanasand managed SSH keys"',
    'end = "# END Hanasand managed SSH keys"',
    'keys = [line.strip() for line in sys.stdin.read().splitlines() if line.strip()]',
    'if any("\\n" in key or "\\r" in key for key in keys): raise SystemExit("Invalid key line")',
    'path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)',
    'os.chmod(path.parent, 0o700)',
    'current = path.read_text() if path.exists() else ""',
    'if current.count(start) != current.count(end) or current.count(start) > 1: raise SystemExit("Managed key block is invalid")',
    'if start in current:',
    '    before = current[:current.index(start)]',
    '    end_at = current.index(end, current.index(start)) + len(end)',
    '    after = current[end_at:]',
    '    current = before + after',
    'elif end in current: raise SystemExit("Managed key block is invalid")',
    'if keys:',
    '    prefix = current.rstrip("\\n")',
    '    if prefix: prefix += "\\n\\n"',
    '    current = prefix + start + "\\n" + "\\n".join(keys) + "\\n" + end + "\\n"',
    'fd, temporary = tempfile.mkstemp(prefix=".authorized_keys.", dir=str(path.parent))',
    'try:',
    '    os.fchmod(fd, 0o600)',
    '    with os.fdopen(fd, "w") as output: output.write(current)',
    '    os.replace(temporary, path)',
    '    os.chmod(path, 0o600)',
    'finally:',
    '    if os.path.exists(temporary): os.unlink(temporary)',
].join('\n')

type HostTarget = { name: HostConsoleName, host: string, port: number, username: 'hanasand' }

function targetFor(name: HostConsoleName): HostTarget {
    const prefix = name.toUpperCase()
    const host = process.env['HOST_CONSOLE_' + prefix + '_HOST'] || (name === 'hanasand' ? 'host.docker.internal' : '128.39.142.218')
    const port = Number(process.env['HOST_CONSOLE_' + prefix + '_PORT'] || (name === 'hanasand' ? 22 : 222))
    if (!/^[A-Za-z0-9.-]{1,253}$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Host SSH settings are invalid.')
    }
    return { name, host, port, username: 'hanasand' }
}

function keyPath() {
    return process.env.HOST_CONSOLE_SSH_KEY_PATH || '/run/secrets/host-console'
}

function knownHostsPath() {
    return process.env.HOST_CONSOLE_KNOWN_HOSTS_PATH || '/run/secrets/host-console-known-hosts'
}

async function verifySshFiles() {
    const [privateKey, knownHosts] = await Promise.all([
        stat(keyPath()).catch(() => null),
        stat(knownHostsPath()).catch(() => null),
    ])
    if (!privateKey?.isFile() || (privateKey.mode & 0o077) !== 0 || !knownHosts?.isFile()) {
        throw new Error('Host console SSH credentials are not configured.')
    }
}

function sshArguments(target: HostTarget, allocateTerminal: boolean) {
    return [
        '-i', keyPath(),
        '-o', 'IdentitiesOnly=yes',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UserKnownHostsFile=' + knownHostsPath(),
        '-o', 'ConnectTimeout=8',
        '-o', 'ServerAliveInterval=15',
        '-o', 'ServerAliveCountMax=2',
        '-o', 'LogLevel=ERROR',
        allocateTerminal ? '-tt' : '-T',
        '-p', String(target.port),
        target.username + '@' + target.host,
    ]
}

export function normalizeHostPublicKey(value: unknown) {
    if (typeof value !== 'string' || value.length > 16384 || /[\r\n]/.test(value)) return null
    const parts = value.trim().split(/\s+/)
    if (parts.length < 2 || !supportedKeyTypes.has(parts[0]) || !/^[A-Za-z0-9+/]+={0,2}$/.test(parts[1])) return null
    const blob = Buffer.from(parts[1], 'base64')
    if (!blob.length || blob.toString('base64').replace(/=+$/, '') !== parts[1].replace(/=+$/, '')) return null
    if (blob.length < 4) return null
    const typeLength = blob.readUInt32BE(0)
    if (typeLength > blob.length - 4 || blob.subarray(4, 4 + typeLength).toString() !== parts[0]) return null
    const comment = parts.slice(2).join(' ').trim()
    const publicKey = parts[0] + ' ' + parts[1] + (comment ? ' ' + comment : '')
    const fingerprint = 'SHA256:' + createHash('sha256').update(blob).digest('base64').replace(/=+$/, '')
    return { publicKey, fingerprint }
}

async function runSshCommand(target: HostTarget, command: string, input: string) {
    await verifySshFiles()
    return new Promise<void>((resolve, reject) => {
        const child = spawn(process.env.HOST_CONSOLE_SSH_BINARY || 'ssh', [...sshArguments(target, false), command], {
            stdio: ['pipe', 'ignore', 'pipe'],
        })
        let stderr = ''
        let settled = false
        const finish = (error?: Error) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            if (error) reject(error)
            else resolve()
        }
        const timeout = setTimeout(() => {
            child.kill('SIGTERM')
            finish(new Error('Host SSH update timed out for ' + target.name + '.'))
        }, 15000)
        child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000) })
        child.on('error', error => finish(error))
        child.on('close', code => finish(code === 0 ? undefined : new Error('Host SSH update failed for ' + target.name + ': ' + stderr.trim())))
        child.stdin.on('error', () => {})
        child.stdin.end(input)
    })
}

export async function applyManagedHostSshKeys(keys: string[]) {
    const encodedScript = Buffer.from(managedKeysScript).toString('base64')
    const command = "python3 -c \"import base64;exec(base64.b64decode('" + encodedScript + "'))\""
    const input = keys.length ? keys.join('\n') + '\n' : ''
    const results = await Promise.allSettled(hostConsoleNames.map(name => runSshCommand(targetFor(name), command, input)))
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
}

export async function startHostConsole(name: HostConsoleName, send: (message: object) => void, onEnd: () => void) {
    await verifySshFiles()
    const target = targetFor(name)
    const child = spawn(process.env.HOST_CONSOLE_SSH_BINARY || 'ssh', sshArguments(target, true), {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'xterm-256color' },
    })
    let ready = false
    let stopped = false
    let errorSent = false
    child.once('spawn', () => send({ type: 'status', message: 'Connecting to ' + name + '…' }))
    child.stdout.on('data', chunk => {
        if (!ready) {
            ready = true
            send({ type: 'ready', username: target.username })
        }
        send({ type: 'output', data: chunk.toString() })
    })
    const fail = (message: string) => {
        if (stopped || errorSent) return
        errorSent = true
        send({ type: 'error', message })
        onEnd()
    }
    child.on('error', () => fail('Unable to start the host console.'))
    child.on('close', code => {
        if (stopped) return
        if (!ready && code !== 0) fail('Unable to connect to ' + name + ' over SSH.')
        else {
            send({ type: 'closed' })
            onEnd()
        }
    })
    child.stderr.on('data', () => {})
    return {
        write(data: string) { if (!stopped && child.stdin.writable) child.stdin.write(data) },
        close() {
            stopped = true
            child.kill('SIGTERM')
        },
    }
}
