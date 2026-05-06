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
    storyPath: string
    ok: boolean
    elapsedMs: number
    result: ToolResult
    checks: Record<string, boolean>
}

type ScenarioKind = 'next' | 'postgres' | 'redis'

type Scenario = {
    id: string
    title: string
    storyPath: string
    kind: ScenarioKind
    tool: string
    run: () => Promise<unknown>
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

async function fileIncludes(filePath: string, patterns: RegExp[]) {
    const content = await fs.readFile(filePath, 'utf8').catch(() => '')
    return patterns.every((pattern) => pattern.test(content))
}

async function verifyProject(absolutePath: string, kind: ScenarioKind) {
    const [packageJson, dockerfile, composeFile, envExample, readme] = await Promise.all([
        exists(path.join(absolutePath, 'package.json')),
        exists(path.join(absolutePath, 'Dockerfile')),
        exists(path.join(absolutePath, 'docker-compose.yml')),
        exists(path.join(absolutePath, '.env.example')),
        exists(path.join(absolutePath, 'README.md')),
    ])
    const build = packageJson ? await run('npm run build', absolutePath, 10 * 60 * 1000) : null
    const compose = composeFile ? await run('docker compose config', absolutePath, 2 * 60 * 1000) : null
    const readmeOps = await fileIncludes(path.join(absolutePath, 'README.md'), [/rollback/i, /metrics/i, /docker compose/i])

    const kindChecks: Record<string, boolean> = {}
    if (kind === 'next') {
        kindChecks.standaloneNext = await fileIncludes(path.join(absolutePath, 'next.config.ts'), [/output:\s*["']standalone["']/])
        kindChecks.appPage = await exists(path.join(absolutePath, 'src/app/page.tsx'))
        kindChecks.readmeEnv = await fileIncludes(path.join(absolutePath, 'README.md'), [/\.env\.example/, /HOST_PORT/])
    } else if (kind === 'postgres') {
        kindChecks.migrationScript = await exists(path.join(absolutePath, 'src/scripts/migrate.ts'))
        kindChecks.healthRoutes = await fileIncludes(path.join(absolutePath, 'src/routes/health.ts'), [/\/health/, /\/ready/])
        kindChecks.postgresCompose = await fileIncludes(path.join(absolutePath, 'docker-compose.yml'), [/postgres:16-alpine/, /service_healthy/])
    } else {
        kindChecks.workerEntrypoint = await exists(path.join(absolutePath, 'src/worker.ts'))
        kindChecks.queueRoutes = await fileIncludes(path.join(absolutePath, 'src/routes/jobs.ts'), [/\/api\/jobs/, /\/api\/worker-status/])
        kindChecks.redisCompose = await fileIncludes(path.join(absolutePath, 'docker-compose.yml'), [/redis:7-alpine/, /worker:/])
    }

    return {
        checks: {
            packageJson,
            dockerfile,
            composeFile,
            envExample,
            readme,
            readmeOps,
            build: build?.exitCode === 0,
            compose: compose?.exitCode === 0,
            ...kindChecks,
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

    const cases: Scenario[] = [
        {
            id: 'fixed-price-client-portal',
            title: 'Fixed price client portal',
            storyPath: 'agents/training-scenarios/user_stories/01-fixed-price-client-portal.md',
            kind: 'next',
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
            storyPath: 'agents/training-scenarios/user_stories/02-launch-waitlist-admin.md',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('launch-waitlist-admin'),
                appName: 'SignalDesk Launch API',
            }),
        },
        {
            id: 'background-jobs-and-queue',
            title: 'Background jobs and queue',
            storyPath: 'agents/training-scenarios/user_stories/03-background-jobs-and-queue.md',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('background-jobs-and-queue'),
                appName: 'TaskForge Queue',
            }),
        },
        {
            id: 'vercel-to-vps-migration',
            title: 'Vercel to VPS migration',
            storyPath: 'agents/training-scenarios/user_stories/04-vercel-to-vps-migration.md',
            kind: 'next',
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
            storyPath: 'agents/training-scenarios/user_stories/05-observable-self-hosted-stack.md',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('observable-self-hosted-stack'),
                appName: 'PulseRail Ops',
            }),
        },
        {
            id: 'webhook-ingestion-ledger',
            title: 'Webhook ingestion ledger',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#06-webhook-ingestion-ledger',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('webhook-ingestion-ledger'),
                appName: 'HookLedger API',
            }),
        },
        {
            id: 'invoice-export-worker',
            title: 'Invoice export worker',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#07-invoice-export-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('invoice-export-worker'),
                appName: 'LedgerLift Exports',
            }),
        },
        {
            id: 'multi-tenant-agency-dashboard',
            title: 'Multi-tenant agency dashboard',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#08-multi-tenant-agency-dashboard',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('multi-tenant-agency-dashboard'),
                appName: 'TenantScope',
                productType: 'multi-tenant agency dashboard',
                productBrief: 'TenantScope helps agencies monitor client workspaces, launches, usage, pricing risk, and delivery quality from a portable Dockerized Next.js dashboard.',
            }),
        },
        {
            id: 'booking-reservation-api',
            title: 'Booking reservation API',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#09-booking-reservation-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('booking-reservation-api'),
                appName: 'SlotHarbor API',
            }),
        },
        {
            id: 'image-processing-queue',
            title: 'Image processing queue',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#10-image-processing-queue',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('image-processing-queue'),
                appName: 'PixelForge Queue',
            }),
        },
        {
            id: 'uptime-status-page',
            title: 'Uptime status page',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#11-uptime-status-page',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('uptime-status-page'),
                appName: 'BeaconStatus',
                productType: 'public uptime status page',
                productBrief: 'BeaconStatus gives small SaaS teams a public status page with incident summaries, uptime metrics, customer messaging, and Dockerized self-hosting.',
            }),
        },
        {
            id: 'compliance-audit-api',
            title: 'Compliance audit API',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#12-compliance-audit-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('compliance-audit-api'),
                appName: 'AuditTrail API',
            }),
        },
        {
            id: 'newsletter-dispatch-queue',
            title: 'Newsletter dispatch queue',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#13-newsletter-dispatch-queue',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('newsletter-dispatch-queue'),
                appName: 'LetterRun Queue',
            }),
        },
        {
            id: 'ecommerce-launch-dashboard',
            title: 'Ecommerce launch dashboard',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#14-ecommerce-launch-dashboard',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('ecommerce-launch-dashboard'),
                appName: 'CartLift Launch',
                productType: 'ecommerce launch dashboard',
                productBrief: 'CartLift Launch helps stores coordinate launches, conversion metrics, pricing, testimonials, readiness gates, and campaign tasks in a portable dashboard.',
            }),
        },
        {
            id: 'feature-flag-config-api',
            title: 'Feature flag config API',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#15-feature-flag-config-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('feature-flag-config-api'),
                appName: 'FlagFoundry API',
            }),
        },
        {
            id: 'csv-import-worker',
            title: 'CSV import worker',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#16-csv-import-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('csv-import-worker'),
                appName: 'ImportPilot Queue',
            }),
        },
        {
            id: 'developer-docs-portal',
            title: 'Developer docs portal',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#17-developer-docs-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('developer-docs-portal'),
                appName: 'DocHarbor',
                productType: 'developer documentation portal',
                productBrief: 'DocHarbor is a self-hosted documentation portal with onboarding metrics, pricing tiers, launch checklists, examples, and Dockerized deployment.',
            }),
        },
        {
            id: 'customer-feedback-api',
            title: 'Customer feedback API',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#18-customer-feedback-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('customer-feedback-api'),
                appName: 'VoiceBoard API',
            }),
        },
        {
            id: 'media-transcoding-queue',
            title: 'Media transcoding queue',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#19-media-transcoding-queue',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('media-transcoding-queue'),
                appName: 'ClipSmith Queue',
            }),
        },
        {
            id: 'incident-response-command-center',
            title: 'Incident response command center',
            storyPath: 'agents/training-scenarios/user_stories/20-advanced-user-stories.md#20-incident-response-command-center',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('incident-response-command-center'),
                appName: 'Fireline Command',
                productType: 'incident response command center',
                productBrief: 'Fireline Command helps operators coordinate incidents, customer updates, metrics, pricing impact, readiness tasks, and deployment confidence from one self-hosted UI.',
            }),
        },
    ]

    const results: CaseResult[] = []

    for (const scenario of cases) {
        const startedAt = Date.now()
        const toolResult = await scenario.run() as ToolResult
        const absolutePath = path.resolve(smokeRoot, toolResult.targetDir || rel(scenario.id))
        const verification = await verifyProject(absolutePath, scenario.kind)
        const checks = {
            ...verification.checks,
            toolSucceeded: toolResult.exitCode === 0,
        }
        results.push({
            id: scenario.id,
            title: scenario.title,
            tool: scenario.tool,
            storyPath: scenario.storyPath,
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
    console.log(JSON.stringify({ outputPath, ok: report.ok, results: results.map(({ id, ok, elapsedMs, storyPath, checks }) => ({ id, ok, elapsedMs, storyPath, checks })) }, null, 2))

    if (!report.ok) {
        process.exit(1)
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
