import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import config from '#constants'

type SearchWebArgs = {
    query: string
    limit?: number
    visitTopResults?: number
}

type SearchWebRunnerResult = {
    query: string
    searchedUrl: string
    results: Array<{
        title: string
        link: string
        snippet: string
    }>
    pages: Array<{
        title: string
        url: string
        excerpt: string
    }>
    markdown: string
}

function literalPath(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildSandboxProfile(tempDir: string) {
    const allowedReadPaths = [
        config.gpt_dir,
        process.execPath,
        path.dirname(process.execPath),
        os.tmpdir(),
        path.join(os.homedir(), '.cache', 'puppeteer'),
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

    const readRules = allowedReadPaths.map((allowedPath) => {
        return `(allow file-read* (subpath "${literalPath(allowedPath)}"))`
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
        `(allow file-read* (subpath "${literalPath(tempDir)}"))`,
        `(allow file-write* (subpath "${literalPath(tempDir)}"))`,
    ].join('\n')
}

function runSearchProcess(
    payload: SearchWebArgs,
    tempDir: string,
    profilePath: string,
    browserProfileDir: string,
): Promise<SearchWebRunnerResult> {
    const entryFile = path.join(config.modules_dir, 'src', 'cli', 'search.ts')
    const puppeteerCacheDir = path.join(os.homedir(), '.cache', 'puppeteer')

    return new Promise((resolve, reject) => {
        const child = spawn('/usr/bin/sandbox-exec', [
            '-f',
            profilePath,
            process.execPath,
            entryFile,
        ], {
            cwd: tempDir,
            env: {
                ...process.env,
                HOME: tempDir,
                TMPDIR: tempDir,
                PUPPETEER_CACHE_DIR: puppeteerCacheDir,
                HANASAND_BROWSER_PROFILE_DIR: browserProfileDir,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })

        child.on('error', (error) => {
            reject(error)
        })

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `search process exited with code ${code}`))
                return
            }

            try {
                resolve(JSON.parse(stdout.trim()) as SearchWebRunnerResult)
            } catch (error) {
                reject(new Error(`Unable to parse search output: ${String(error)}\n${stdout}`))
            }
        })

        child.stdin.write(JSON.stringify(payload))
        child.stdin.end()
    })
}

export default async function searchWeb(args: SearchWebArgs) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-web-search-'))
    const profilePath = path.join(tempDir, 'sandbox.sb')
    const browserProfileDir = path.join(tempDir, 'browser-profile')

    try {
        const profile = buildSandboxProfile(tempDir)
        await mkdir(browserProfileDir, { recursive: true })
        await writeFile(profilePath, profile, 'utf8')
        return await runSearchProcess(args, tempDir, profilePath, browserProfileDir)
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
}
