import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import config from '#constants'

const SANDBOX_EXECUTABLE = process.env.HANASAND_SANDBOX_EXEC || 'sandbox-exec'

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
    profilePath: string,
    npmCacheDir: string,
): Promise<RunCommandResult> {
    return await new Promise((resolve, reject) => {
        const child = spawn(SANDBOX_EXECUTABLE, [
            '-f',
            profilePath,
            '/bin/zsh',
            '-lc',
            payload.command,
        ], {
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

export default async function runCommand(args: RunCommandArgs): Promise<RunCommandResult> {
    const cwd = await resolveCwd(args.cwd)
    const timeoutMs = Math.max(1000, Math.min(args.timeoutMs ?? config.command_timeout_ms, 10 * 60 * 1000))
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-command-'))
    const profilePath = path.join(tempDir, 'sandbox.sb')
    const npmCacheDir = path.join(config.repo_root, '.hanasand', 'npm-cache')

    try {
        await mkdir(npmCacheDir, { recursive: true })
        await writeFile(profilePath, buildSandboxProfile(tempDir), 'utf8')
        return await runCommandProcess(args, cwd, timeoutMs, tempDir, profilePath, npmCacheDir)
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
}
