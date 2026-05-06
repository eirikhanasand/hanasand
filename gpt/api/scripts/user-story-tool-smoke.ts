import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type ToolResult = {
    exitCode?: number
    targetDir?: string
    absolutePath?: string
    build?: { exitCode: number | null, timedOut?: boolean }
    compose?: { exitCode: number | null, timedOut?: boolean }
    [key: string]: unknown
}

type CaseResult = {
    id: string
    title: string
    tool: string
    ok: boolean
    elapsedMs: number
    result: ToolResult
    checks: Record<string, boolean>
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(apiDir, '..', '..')
const smokeRoot = path.join(repoRoot, 'sandbox', 'user-story-tool-smoke')

process.env.API ||= 'https://api.hanasand.com/api'
process.env.HANASAND_REPO_ROOT = smokeRoot
process.env.HANASAND_DISABLE_SANDBOX_EXEC ||= '1'
process.env.HANASAND_COMMAND_TIMEOUT_MS ||= String(10 * 60 * 1000)

function rel(name: string) {
    return `stories/${name}`
}

async function exists(filePath: string) {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}

async function run(command: string, cwd: string, timeoutMs: number) {
    const startedAt = Date.now()
    return await new Promise<{ exitCode: number | null, stdout: string, stderr: string, timedOut: boolean, ms: number }>((resolve) => {
        const child = spawn('/bin/sh', ['-lc', command], {
            cwd,
            env: process.env,
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
        child.on('close', (exitCode) => {
            clearTimeout(timer)
            resolve({
                exitCode,
                stdout: stdout.slice(-6000),
                stderr: stderr.slice(-6000),
                timedOut,
                ms: Date.now() - startedAt,
            })
        })
        child.on('error', (error) => {
            clearTimeout(timer)
            resolve({
                exitCode: 1,
                stdout,
                stderr: String(error),
                timedOut,
                ms: Date.now() - startedAt,
            })
        })
    })
}

async function verifyProject(absolutePath: string) {
    const [packageJson, dockerfile, composeFile, envExample] = await Promise.all([
        exists(path.join(absolutePath, 'package.json')),
        exists(path.join(absolutePath, 'Dockerfile')),
        exists(path.join(absolutePath, 'docker-compose.yml')),
        exists(path.join(absolutePath, '.env.example')),
    ])
    const build = packageJson ? await run('npm run build', absolutePath, 10 * 60 * 1000) : null
    const compose = composeFile ? await run('docker compose config', absolutePath, 2 * 60 * 1000) : null

    return {
        checks: {
            packageJson,
            dockerfile,
            composeFile,
            envExample,
            build: build?.exitCode === 0,
            compose: compose?.exitCode === 0,
        },
        build,
        compose,
    }
}

async function main() {
    await fs.rm(smokeRoot, { recursive: true, force: true })
    await fs.mkdir(smokeRoot, { recursive: true })

    const [
        { default: scaffoldNextjsDockerApp },
        { default: scaffoldFastifyPostgresApp },
        { default: scaffoldFastifyWorkerRedisApp },
    ] = await Promise.all([
        import('../src/utils/tools/scaffoldNextjsDockerApp.ts'),
        import('../src/utils/tools/scaffoldFastifyPostgresApp.ts'),
        import('../src/utils/tools/scaffoldFastifyWorkerRedisApp.ts'),
    ])

    const cases = [
        {
            id: 'fixed-price-client-portal',
            title: 'Fixed price client portal',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('fixed-price-client-portal'),
                appName: 'Northstar Studio Portal',
                productType: 'client portal',
                productBrief: 'Northstar Studio Portal helps freelance studios manage client projects, pricing, testimonials, delivery boards, and launch metrics from one portable self-hosted dashboard.',
            }),
        },
        {
            id: 'launch-waitlist-admin',
            title: 'Launch waitlist admin',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('launch-waitlist-admin'),
                appName: 'SignalDesk Launch API',
            }),
        },
        {
            id: 'background-jobs-and-queue',
            title: 'Background jobs and queue',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('background-jobs-and-queue'),
                appName: 'TaskForge Queue',
            }),
        },
        {
            id: 'vercel-to-vps-migration',
            title: 'Vercel to VPS migration',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('vercel-to-vps-migration'),
                appName: 'Harbor Metrics',
                productType: 'portable analytics dashboard',
                productBrief: 'Harbor Metrics is a provider-neutral analytics dashboard designed to migrate from hosted frontend deployment to a VPS with standalone Next.js and Docker Compose.',
            }),
        },
        {
            id: 'observable-self-hosted-stack',
            title: 'Observable self-hosted stack',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('observable-self-hosted-stack'),
                appName: 'PulseRail Ops',
            }),
        },
    ]

    const results: CaseResult[] = []

    for (const scenario of cases) {
        const startedAt = Date.now()
        const toolResult = await scenario.run() as ToolResult
        const absolutePath = path.resolve(smokeRoot, toolResult.targetDir || rel(scenario.id))
        const verification = await verifyProject(absolutePath)
        const checks = {
            ...verification.checks,
            toolSucceeded: toolResult.exitCode === 0,
        }
        results.push({
            id: scenario.id,
            title: scenario.title,
            tool: scenario.tool,
            ok: Object.values(checks).every(Boolean),
            elapsedMs: Date.now() - startedAt,
            result: {
                ...toolResult,
                build: verification.build ? {
                    exitCode: verification.build.exitCode,
                    timedOut: verification.build.timedOut,
                } : undefined,
                compose: verification.compose ? {
                    exitCode: verification.compose.exitCode,
                    timedOut: verification.compose.timedOut,
                } : undefined,
            },
            checks,
        })
    }

    const report = {
        ok: results.every((result) => result.ok),
        createdAt: new Date().toISOString(),
        smokeRoot,
        results,
    }

    const outputDir = path.join(apiDir, 'runtime', 'user-story-tool-smoke')
    await fs.mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, `${Date.now()}.json`)
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ outputPath, ok: report.ok, results: results.map(({ id, ok, elapsedMs, checks }) => ({ id, ok, elapsedMs, checks })) }, null, 2))

    if (!report.ok) {
        process.exit(1)
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
