import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import config from '#constants'

const SANDBOX_EXECUTABLE = process.env.HANASAND_SANDBOX_EXEC || 'sandbox-exec'
const SANDBOX_APPLY_ERROR = 'sandbox-exec: sandbox_apply: Operation not permitted'
const configuredShell = process.env.HANASAND_COMMAND_SHELL
const SHELL_PATH = configuredShell && existsSync(configuredShell)
    ? configuredShell
    : existsSync('/bin/zsh') ? '/bin/zsh' : existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh'

type RunCommandArgs = {
    command: string
    cwd?: string
    timeoutMs?: number
}

type RunCommandResult = {
    command: string
    cwd: string
    exitCode: number | null
    stdout: string
    stderr: string
    timedOut: boolean
}

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
        '(allow network-outbound)',
        '(allow file-read-metadata)',
        readRules,
        writeRules,
    ].join('\n')
}

async function runCommandProcess(
    payload: RunCommandArgs,
    cwd: string,
    timeoutMs: number,
    tempDir: string,
    profilePath: string | null,
    npmCacheDir: string,
    useSandbox: boolean,
): Promise<RunCommandResult> {
    return await new Promise((resolve, reject) => {
        const command = useSandbox
            ? [SANDBOX_EXECUTABLE, '-f', profilePath || '', SHELL_PATH, '-lc', payload.command]
            : [SHELL_PATH, '-lc', payload.command]

        const child = spawn(command[0], command.slice(1), {
            cwd,
            env: {
                ...process.env,
                HOME: tempDir,
                TMPDIR: tempDir,
                npm_config_cache: npmCacheDir,
                npm_config_userconfig: path.join(tempDir, '.npmrc'),
                npm_config_prefix: path.join(tempDir, 'npm-prefix'),
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''
        let timedOut = false

        const timer = setTimeout(() => {
            timedOut = true
            child.kill('SIGTERM')
        }, timeoutMs)

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })

        child.on('error', (error) => {
            clearTimeout(timer)
            reject(error)
        })

        child.on('close', (code) => {
            clearTimeout(timer)
            resolve({
                command: payload.command,
                cwd,
                exitCode: code,
                stdout: stdout.slice(0, 24000),
                stderr: stderr.slice(0, 12000),
                timedOut,
            })
        })
    })
}

function shouldBypassSandbox(result: RunCommandResult) {
    return result.exitCode === 71 && result.stderr.includes(SANDBOX_APPLY_ERROR)
}

async function hasSandboxExecutable() {
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

export default async function runCommand(args: RunCommandArgs): Promise<RunCommandResult> {
    const cwd = await resolveCwd(args.cwd)
    const timeoutMs = Math.max(1000, Math.min(args.timeoutMs ?? config.command_timeout_ms, 10 * 60 * 1000))
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-command-'))
    const profilePath = path.join(tempDir, 'sandbox.sb')
    const npmCacheDir = path.join(config.repo_root, '.hanasand', 'npm-cache')

    try {
        await mkdir(npmCacheDir, { recursive: true })
        const sandboxAvailable = process.env.HANASAND_DISABLE_SANDBOX_EXEC === '1'
            ? false
            : await hasSandboxExecutable()
        if (sandboxAvailable) {
            await writeFile(profilePath, buildSandboxProfile(tempDir), 'utf8')
            const sandboxed = await runCommandProcess(args, cwd, timeoutMs, tempDir, profilePath, npmCacheDir, true)
            if (!shouldBypassSandbox(sandboxed)) {
                return sandboxed
            }
        }

        return await runCommandProcess(args, cwd, timeoutMs, tempDir, null, npmCacheDir, false)
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
}
