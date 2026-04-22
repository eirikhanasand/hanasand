import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import config from '#constants'

type BrowserTaskArgs = {
    url: string
    actions?: Array<Record<string, string | number | boolean | undefined>>
    goal?: string
    timeoutMs?: number
    captureScreenshot?: boolean
}

type BrowserTaskResult = {
    ok: boolean
    url: string
    title: string
    textExcerpt: string
    screenshotPath: string | null
    screenshotDataUrl?: string | null
    consoleMessages: string[]
    pageErrors: string[]
}

export default async function browserTask(args: BrowserTaskArgs): Promise<BrowserTaskResult> {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-browser-task-'))
    const artifactDir = path.join(config.repo_root, '.hanasand', 'browser-artifacts')
    const scriptPath = path.join(config.repo_root, 'frontend', 'scripts', 'ai-browser-task.mjs')

    try {
        await mkdir(artifactDir, { recursive: true })

        return await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [scriptPath], {
                cwd: path.join(config.repo_root, 'frontend'),
                env: {
                    ...process.env,
                    TMPDIR: tempDir,
                    HANASAND_BROWSER_ARTIFACT_DIR: artifactDir,
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

            child.on('error', (error) => reject(error))
            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(stderr.trim() || `browser task exited with code ${code}`))
                    return
                }

                try {
                    const parsed = JSON.parse(stdout.trim()) as BrowserTaskResult
                    if (parsed.screenshotPath) {
                        readFile(parsed.screenshotPath)
                            .then((buffer) => {
                                resolve({
                                    ...parsed,
                                    screenshotDataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
                                })
                            })
                            .catch(() => resolve(parsed))
                        return
                    }

                    resolve(parsed)
                } catch (error) {
                    reject(new Error(`Unable to parse browser task output: ${String(error)}\n${stdout}`))
                }
            })

            child.stdin.write(JSON.stringify(args))
            child.stdin.end()
        })
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
}
