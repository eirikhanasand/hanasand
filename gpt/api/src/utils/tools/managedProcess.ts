import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { openSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import config from '#constants'

const SANDBOX_EXECUTABLE = process.env.HANASAND_SANDBOX_EXEC || 'sandbox-exec'
const SANDBOX_APPLY_ERROR = 'sandbox-exec: sandbox_apply: Operation not permitted'
let sandboxUsable: boolean | null = null

type StartManagedProcessArgs = {
    command: string
    cwd?: string
    name?: string
}

type InspectManagedProcessArgs = {
    id: string
    tailBytes?: number
}

type StopManagedProcessArgs = {
    id: string
}

type ManagedProcessRecord = {
    id: string
    name: string
    command: string
    cwd: string
    pid: number
    startedAt: string
    tempDir: string
    profilePath: string
    logPath: string
}

const processes = new Map<string, ManagedProcessRecord>()

async function resolveCwd(cwd?: string) {
    if (!cwd?.trim()) {
        return config.repo_root
    }

    const candidate = path.isAbsolute(cwd) ? cwd : path.resolve(config.repo_root, cwd)
    try {
        await access(candidate)
        return candidate
    } catch {
        return config.repo_root
    }
}

async function hasSandboxExecutable() {
    if (process.env.HANASAND_DISABLE_SANDBOX_EXEC === '1') {
        return false
    }

    if (!SANDBOX_EXECUTABLE.trim()) {
        return false
    }

    try {
        if (path.isAbsolute(SANDBOX_EXECUTABLE)) {
            await access(SANDBOX_EXECUTABLE)
            return true
        }

        const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
        for (const entry of pathEntries) {
            try {
                await access(path.join(entry, SANDBOX_EXECUTABLE))
                return true
            } catch {
                continue
            }
        }
    } catch {
        return false
    }

    return false
}

async function canUseSandbox(tempDir: string, profilePath: string) {
    if (sandboxUsable !== null) {
        return sandboxUsable
    }

    if (!(await hasSandboxExecutable())) {
        sandboxUsable = false
        return sandboxUsable
    }

    sandboxUsable = await new Promise<boolean>((resolve) => {
        const probe = spawn(SANDBOX_EXECUTABLE, ['-f', profilePath, '/bin/zsh', '-lc', 'exit 0'], {
            cwd: config.repo_root,
            env: {
                ...process.env,
                HOME: tempDir,
                TMPDIR: tempDir,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stderr = ''
        probe.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        probe.on('error', () => resolve(false))
        probe.on('close', (code) => {
            if (code === 0) {
                resolve(true)
                return
            }

            resolve(!stderr.includes(SANDBOX_APPLY_ERROR))
        })
    })

    return sandboxUsable
}

function literalPath(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildSandboxProfile(tempDir: string) {
    const allowedReadPaths = [
        config.repo_root,
        process.execPath,
        path.dirname(process.execPath),
        os.tmpdir(),
        '/System',
        '/Library',
        '/Applications',
        '/usr',
        '/bin',
        '/sbin',
        '/dev',
        '/opt',
        '/private',
        '/private/etc',
        '/private/var/db',
    ]

    const allowedWritePaths = [
        config.repo_root,
        tempDir,
        os.tmpdir(),
    ]

    const readRules = allowedReadPaths.map((allowedPath) => {
        return `(allow file-read* (subpath "${literalPath(allowedPath)}"))`
    }).join('\n')

    const writeRules = allowedWritePaths.map((allowedPath) => {
        return `(allow file-write* (subpath "${literalPath(allowedPath)}"))`
    }).join('\n')

    return [
        '(version 1)',
        '(deny default)',
        '(import "system.sb")',
        '(allow process-exec)',
        '(allow process-fork)',
        '(allow signal (target self))',
        '(allow sysctl-read)',
        '(allow mach-lookup)',
        '(allow network-inbound)',
        '(allow network-outbound)',
        '(allow file-read-metadata)',
        readRules,
        writeRules,
    ].join('\n')
}

function isProcessAlive(pid: number) {
    try {
        process.kill(pid, 0)
        return true
    } catch {
        return false
    }
}

async function cleanupRecord(record: ManagedProcessRecord) {
    processes.delete(record.id)
    await rm(record.tempDir, { recursive: true, force: true }).catch(() => undefined)
}

export async function startManagedProcess(args: StartManagedProcessArgs) {
    const cwd = await resolveCwd(args.cwd)
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-process-'))
    const profilePath = path.join(tempDir, 'sandbox.sb')
    const logPath = path.join(tempDir, 'process.log')
    const startedAt = new Date().toISOString()
    const id = crypto.randomUUID()

    await mkdir(tempDir, { recursive: true })
    await writeFile(profilePath, buildSandboxProfile(tempDir), 'utf8')
    await writeFile(logPath, '', 'utf8')

    const fd = openSync(logPath, 'a')
    const npmCacheDir = path.join(config.repo_root, '.hanasand', 'npm-cache')
    await mkdir(npmCacheDir, { recursive: true })
    const sandboxEnabled = await canUseSandbox(tempDir, profilePath)
    const command = sandboxEnabled
        ? [SANDBOX_EXECUTABLE, '-f', profilePath, '/bin/zsh', '-lc', args.command]
        : ['/bin/zsh', '-lc', args.command]

    const child = spawn(command[0], command.slice(1), {
        cwd,
        detached: true,
        env: {
            ...process.env,
            HOME: tempDir,
            TMPDIR: tempDir,
            npm_config_cache: npmCacheDir,
            npm_config_userconfig: path.join(tempDir, '.npmrc'),
            npm_config_prefix: path.join(tempDir, 'npm-prefix'),
        },
        stdio: ['ignore', fd, fd],
    })
    child.unref()

    const record: ManagedProcessRecord = {
        id,
        name: args.name?.trim() || `process-${id.slice(0, 8)}`,
        command: args.command,
        cwd,
        pid: child.pid ?? -1,
        startedAt,
        tempDir,
        profilePath,
        logPath,
    }
    processes.set(id, record)

    return {
        id: record.id,
        name: record.name,
        command: record.command,
        cwd: record.cwd,
        pid: record.pid,
        startedAt: record.startedAt,
        logPath: record.logPath,
        alive: record.pid > 0 ? isProcessAlive(record.pid) : false,
    }
}

export async function inspectManagedProcess(args: InspectManagedProcessArgs) {
    const record = processes.get(args.id)
    if (!record) {
        throw new Error(`Unknown process id: ${args.id}`)
    }

    const log = await readFile(record.logPath, 'utf8').catch(() => '')
    const tailBytes = Math.max(256, Math.min(args.tailBytes ?? 12000, 64000))
    const tail = log.length > tailBytes ? log.slice(-tailBytes) : log
    const alive = record.pid > 0 ? isProcessAlive(record.pid) : false

    return {
        id: record.id,
        name: record.name,
        command: record.command,
        cwd: record.cwd,
        pid: record.pid,
        startedAt: record.startedAt,
        alive,
        logTail: tail,
    }
}

export async function stopManagedProcess(args: StopManagedProcessArgs) {
    const record = processes.get(args.id)
    if (!record) {
        return { id: args.id, stopped: false, reason: 'unknown process id' }
    }

    let stopped = false
    if (record.pid > 0 && isProcessAlive(record.pid)) {
        try {
            process.kill(-record.pid, 'SIGTERM')
            stopped = true
        } catch {
            try {
                process.kill(record.pid, 'SIGTERM')
                stopped = true
            } catch {
                stopped = false
            }
        }
    }

    await cleanupRecord(record)
    return {
        id: args.id,
        stopped,
    }
}

export async function waitForHttp(args: {
    url: string
    timeoutMs?: number
    expectText?: string
}) {
    const timeoutMs = Math.max(1000, Math.min(args.timeoutMs ?? 120000, 10 * 60 * 1000))
    const startedAt = Date.now()
    let lastError = ''
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(args.url)
            const text = await response.text()
            if (!response.ok) {
                lastError = `HTTP ${response.status}`
            } else if (args.expectText && !text.includes(args.expectText)) {
                lastError = `Expected text not found: ${args.expectText}`
            } else {
                return {
                    url: args.url,
                    ok: true,
                    status: response.status,
                    excerpt: text.slice(0, 4000),
                }
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error)
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return {
        url: args.url,
        ok: false,
        status: 0,
        error: lastError || 'Timed out waiting for HTTP service.',
    }
}
