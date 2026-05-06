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
    maxElapsedMs?: number
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
const casePattern = process.env.HANASAND_USER_STORY_CASE_PATTERN
    ? new RegExp(process.env.HANASAND_USER_STORY_CASE_PATTERN, 'i')
    : null

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
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        let timedOut = false
        const timer = setTimeout(() => {
            timedOut = true
            const pid = child.pid
            if (pid) {
                try {
                    process.kill(-pid, 'SIGTERM')
                    setTimeout(() => {
                        try {
                            process.kill(-pid, 'SIGKILL')
                        } catch {
                            // The process group exited after SIGTERM.
                        }
                    }, 5000).unref()
                } catch {
                    child.kill('SIGTERM')
                }
            } else {
                child.kill('SIGTERM')
            }
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

type CommandResult = Awaited<ReturnType<typeof run>>

async function fileIncludes(filePath: string, patterns: RegExp[]) {
    const content = await fs.readFile(filePath, 'utf8').catch(() => '')
    return patterns.every((pattern) => pattern.test(content))
}

async function wordCount(filePath: string) {
    const content = await fs.readFile(filePath, 'utf8').catch(() => '')
    return content.trim().split(/\s+/).filter(Boolean).length
}

function elapsedBudget(kind: ScenarioKind) {
    if (kind === 'next') {
        return 75 * 1000
    }
    if (kind === 'postgres') {
        return 8 * 1000
    }
    return 10 * 1000
}

async function verifyProject(absolutePath: string, kind: ScenarioKind, buildAlreadyPassed: boolean) {
    const [packageJson, dockerfile, composeFile, envExample, readme] = await Promise.all([
        exists(path.join(absolutePath, 'package.json')),
        exists(path.join(absolutePath, 'Dockerfile')),
        exists(path.join(absolutePath, 'docker-compose.yml')),
        exists(path.join(absolutePath, '.env.example')),
        exists(path.join(absolutePath, 'README.md')),
    ])
    const build: Pick<CommandResult, 'exitCode' | 'timedOut'> | null = packageJson
        ? buildAlreadyPassed
            ? { exitCode: 0, timedOut: false }
            : await run('npm run build', absolutePath, 10 * 60 * 1000)
        : null
    const compose = composeFile ? await run('docker compose config', absolutePath, 2 * 60 * 1000) : null
    const readmeOps = await fileIncludes(path.join(absolutePath, 'README.md'), [/rollback/i, /metrics/i, /docker compose/i])
    const readmeWords = await wordCount(path.join(absolutePath, 'README.md'))

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
            readmeConcise: readmeWords > 40 && readmeWords <= 320,
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
        {
            id: 'designer-portfolio-booking-site',
            title: 'Designer portfolio booking site',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#21-designer-portfolio-booking-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('designer-portfolio-booking-site'),
                appName: 'StudioLuma Portfolio',
                productType: 'designer portfolio and booking dashboard',
                productBrief: 'StudioLuma Portfolio helps a visual designer present case studies, availability, pricing, testimonials, launch tasks, and client inquiry readiness in a self-hosted Next.js site.',
            }),
        },
        {
            id: 'newbie-local-business-site',
            title: 'Newbie local business site',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#22-newbie-local-business-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('newbie-local-business-site'),
                appName: 'CornerBakery Launch',
                productType: 'local business website',
                productBrief: 'CornerBakery Launch gives a nontechnical owner a polished website with opening hours, offers, pricing, testimonials, launch checklist, and Docker instructions that are short enough to follow.',
            }),
        },
        {
            id: 'enterprise-procurement-portal',
            title: 'Enterprise procurement portal',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#23-enterprise-procurement-portal',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('enterprise-procurement-portal'),
                appName: 'ProcureDesk API',
            }),
        },
        {
            id: 'corporate-approval-queue',
            title: 'Corporate approval queue',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#24-corporate-approval-queue',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('corporate-approval-queue'),
                appName: 'ApprovalFlow Queue',
            }),
        },
        {
            id: 'nonprofit-donor-dashboard',
            title: 'Nonprofit donor dashboard',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#25-nonprofit-donor-dashboard',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('nonprofit-donor-dashboard'),
                appName: 'DonorPulse',
                productType: 'nonprofit donor dashboard',
                productBrief: 'DonorPulse helps a small nonprofit show campaign progress, donor impact metrics, pricing-equivalent sponsorship tiers, testimonials, and volunteer launch tasks from a portable site.',
            }),
        },
        {
            id: 'healthcare-intake-api',
            title: 'Healthcare intake API',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#26-healthcare-intake-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('healthcare-intake-api'),
                appName: 'CareIntake API',
            }),
        },
        {
            id: 'education-assignment-worker',
            title: 'Education assignment worker',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#27-education-assignment-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('education-assignment-worker'),
                appName: 'ClassQueue Worker',
            }),
        },
        {
            id: 'real-estate-listing-site',
            title: 'Real estate listing site',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#28-real-estate-listing-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('real-estate-listing-site'),
                appName: 'OpenHouse North',
                productType: 'real estate listing dashboard',
                productBrief: 'OpenHouse North lets a small brokerage present listings, viewing readiness, lead metrics, pricing, testimonials, and launch tasks without relying on a hosted frontend platform.',
            }),
        },
        {
            id: 'fleet-maintenance-api',
            title: 'Fleet maintenance API',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#29-fleet-maintenance-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('fleet-maintenance-api'),
                appName: 'FleetLedger API',
            }),
        },
        {
            id: 'legal-document-worker',
            title: 'Legal document worker',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#30-legal-document-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('legal-document-worker'),
                appName: 'ClauseRun Queue',
            }),
        },
        {
            id: 'founder-investor-update-site',
            title: 'Founder investor update site',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#31-founder-investor-update-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('founder-investor-update-site'),
                appName: 'RunwayBrief',
                productType: 'investor update dashboard',
                productBrief: 'RunwayBrief helps founders show traction, runway, pricing, customer proof, delivery tasks, and launch risks in a concise self-hosted investor update.',
            }),
        },
        {
            id: 'municipal-service-api',
            title: 'Municipal service API',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#32-municipal-service-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('municipal-service-api'),
                appName: 'CivicDesk API',
            }),
        },
        {
            id: 'retail-inventory-worker',
            title: 'Retail inventory worker',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#33-retail-inventory-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('retail-inventory-worker'),
                appName: 'StockSweep Queue',
            }),
        },
        {
            id: 'restaurant-reservation-site',
            title: 'Restaurant reservation site',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#34-restaurant-reservation-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('restaurant-reservation-site'),
                appName: 'TableNorth',
                productType: 'restaurant reservation website',
                productBrief: 'TableNorth helps a restaurant present availability, menu pricing, service metrics, testimonials, and opening launch tasks in a polished Dockerized site.',
            }),
        },
        {
            id: 'security-report-api',
            title: 'Security report API',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#35-security-report-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('security-report-api'),
                appName: 'RiskRegister API',
            }),
        },
        {
            id: 'support-ticket-triage-worker',
            title: 'Support ticket triage worker',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#36-support-ticket-triage-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('support-ticket-triage-worker'),
                appName: 'TriageFlow Queue',
            }),
        },
        {
            id: 'artist-shop-launch-site',
            title: 'Artist shop launch site',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#37-artist-shop-launch-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('artist-shop-launch-site'),
                appName: 'EditionDrop',
                productType: 'artist shop launch site',
                productBrief: 'EditionDrop helps an artist launch limited editions with inventory metrics, pricing, collector proof, campaign tasks, and a portable Docker deployment.',
            }),
        },
        {
            id: 'manufacturing-quality-api',
            title: 'Manufacturing quality API',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#38-manufacturing-quality-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('manufacturing-quality-api'),
                appName: 'QualityLine API',
            }),
        },
        {
            id: 'finance-reconciliation-worker',
            title: 'Finance reconciliation worker',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#39-finance-reconciliation-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('finance-reconciliation-worker'),
                appName: 'ReconcileRun Queue',
            }),
        },
        {
            id: 'corporate-knowledge-base-site',
            title: 'Corporate knowledge base site',
            storyPath: 'agents/training-scenarios/user_stories/21-40-advanced-user-stories.md#40-corporate-knowledge-base-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('corporate-knowledge-base-site'),
                appName: 'AtlasDesk',
                productType: 'corporate knowledge base',
                productBrief: 'AtlasDesk helps a corporation publish internal docs, onboarding metrics, readiness tasks, pricing impact, testimonials, and deployment guidance in a controlled self-hosted portal.',
            }),
        },
        {
            id: 'ux-audit-landing-site',
            title: 'UX audit landing site',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#41-ux-audit-landing-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('ux-audit-landing-site'),
                appName: 'FlowAudit Studio',
                productType: 'UX audit landing site',
                productBrief: 'FlowAudit Studio helps a senior designer sell UX audits with proof, package pricing, project metrics, testimonial trust, and a compact Docker deployment path.',
            }),
        },
        {
            id: 'first-time-saas-admin',
            title: 'First-time SaaS admin',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#42-first-time-saas-admin',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('first-time-saas-admin'),
                appName: 'LaunchRoom Admin',
                productType: 'beginner SaaS admin dashboard',
                productBrief: 'LaunchRoom Admin gives a first-time founder a clear SaaS control panel with signups, pricing, testimonials, launch tasks, and concise self-hosting instructions.',
            }),
        },
        {
            id: 'enterprise-risk-register-api',
            title: 'Enterprise risk register API',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#43-enterprise-risk-register-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('enterprise-risk-register-api'),
                appName: 'EnterpriseRisk API',
            }),
        },
        {
            id: 'enterprise-contract-review-worker',
            title: 'Enterprise contract review worker',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#44-enterprise-contract-review-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('enterprise-contract-review-worker'),
                appName: 'ContractQueue Worker',
            }),
        },
        {
            id: 'agency-white-label-portal',
            title: 'Agency white-label portal',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#45-agency-white-label-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('agency-white-label-portal'),
                appName: 'BrandDock Portal',
                productType: 'white-label agency portal',
                productBrief: 'BrandDock Portal lets an agency ship a white-label client dashboard with metrics, pricing, delivery tasks, testimonials, and fast Docker portability.',
            }),
        },
        {
            id: 'solo-consultant-crm-api',
            title: 'Solo consultant CRM API',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#46-solo-consultant-crm-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('solo-consultant-crm-api'),
                appName: 'ClientTrail API',
            }),
        },
        {
            id: 'podcast-publishing-worker',
            title: 'Podcast publishing worker',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#47-podcast-publishing-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('podcast-publishing-worker'),
                appName: 'CastQueue Worker',
            }),
        },
        {
            id: 'hotel-event-booking-site',
            title: 'Hotel event booking site',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#48-hotel-event-booking-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('hotel-event-booking-site'),
                appName: 'VenueNorth Events',
                productType: 'hotel event booking site',
                productBrief: 'VenueNorth Events helps a hotel sell event spaces with package pricing, inquiry metrics, testimonials, launch readiness, and a concise portable deploy path.',
            }),
        },
        {
            id: 'insurance-claims-api',
            title: 'Insurance claims API',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#49-insurance-claims-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('insurance-claims-api'),
                appName: 'ClaimDesk API',
            }),
        },
        {
            id: 'insurance-claims-worker',
            title: 'Insurance claims worker',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#50-insurance-claims-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('insurance-claims-worker'),
                appName: 'ClaimQueue Worker',
            }),
        },
        {
            id: 'open-source-sponsor-site',
            title: 'Open-source sponsor site',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#51-open-source-sponsor-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('open-source-sponsor-site'),
                appName: 'SponsorForge',
                productType: 'open-source sponsor site',
                productBrief: 'SponsorForge helps maintainers present roadmap metrics, sponsor tiers, testimonials, release tasks, and cheap self-hosted deployment in one focused site.',
            }),
        },
        {
            id: 'hr-onboarding-api',
            title: 'HR onboarding API',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#52-hr-onboarding-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('hr-onboarding-api'),
                appName: 'OnboardLedger API',
            }),
        },
        {
            id: 'hr-onboarding-worker',
            title: 'HR onboarding worker',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#53-hr-onboarding-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('hr-onboarding-worker'),
                appName: 'OnboardQueue Worker',
            }),
        },
        {
            id: 'sports-club-membership-site',
            title: 'Sports club membership site',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#54-sports-club-membership-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('sports-club-membership-site'),
                appName: 'ClubPulse',
                productType: 'sports club membership site',
                productBrief: 'ClubPulse helps a sports club present membership tiers, activity metrics, testimonials, launch tasks, and self-hosted deployment without platform lock-in.',
            }),
        },
        {
            id: 'lab-sample-tracking-api',
            title: 'Lab sample tracking API',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#55-lab-sample-tracking-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('lab-sample-tracking-api'),
                appName: 'SampleTrack API',
            }),
        },
        {
            id: 'lab-result-processing-worker',
            title: 'Lab result processing worker',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#56-lab-result-processing-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('lab-result-processing-worker'),
                appName: 'ResultQueue Worker',
            }),
        },
        {
            id: 'conference-call-for-papers-site',
            title: 'Conference call for papers site',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#57-conference-call-for-papers-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('conference-call-for-papers-site'),
                appName: 'PaperCall North',
                productType: 'conference CFP site',
                productBrief: 'PaperCall North helps organizers publish tracks, submission metrics, sponsor pricing, testimonials, readiness tasks, and Docker deployment notes.',
            }),
        },
        {
            id: 'warehouse-receiving-api',
            title: 'Warehouse receiving API',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#58-warehouse-receiving-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('warehouse-receiving-api'),
                appName: 'DockLedger API',
            }),
        },
        {
            id: 'warehouse-label-worker',
            title: 'Warehouse label worker',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#59-warehouse-label-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('warehouse-label-worker'),
                appName: 'LabelQueue Worker',
            }),
        },
        {
            id: 'board-report-portal',
            title: 'Board report portal',
            storyPath: 'agents/training-scenarios/user_stories/41-60-advanced-user-stories.md#60-board-report-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('board-report-portal'),
                appName: 'BoardBrief Portal',
                productType: 'board report portal',
                productBrief: 'BoardBrief Portal helps executives publish concise board metrics, risk notes, pricing impact, testimonials, readiness tasks, and auditable Docker deployment.',
            }),
        },
        {
            id: 'design-system-preview-site',
            title: 'Design system preview site',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#61-design-system-preview-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('design-system-preview-site'),
                appName: 'PatternRoom',
                productType: 'design system preview site',
                productBrief: 'PatternRoom helps a product designer present components, usage metrics, package tiers, testimonials, release tasks, and self-hosted deployment without bloated docs.',
            }),
        },
        {
            id: 'newbie-course-sales-site',
            title: 'Newbie course sales site',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#62-newbie-course-sales-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('newbie-course-sales-site'),
                appName: 'CourseNest Launch',
                productType: 'course sales site',
                productBrief: 'CourseNest Launch helps a first-time creator sell a course with learning metrics, pricing, testimonials, launch checklist, and short Docker deployment steps.',
            }),
        },
        {
            id: 'enterprise-change-request-api',
            title: 'Enterprise change request API',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#63-enterprise-change-request-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('enterprise-change-request-api'),
                appName: 'ChangeDesk API',
            }),
        },
        {
            id: 'enterprise-change-approval-worker',
            title: 'Enterprise change approval worker',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#64-enterprise-change-approval-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('enterprise-change-approval-worker'),
                appName: 'ChangeQueue Worker',
            }),
        },
        {
            id: 'boutique-fitness-membership-site',
            title: 'Boutique fitness membership site',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#65-boutique-fitness-membership-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('boutique-fitness-membership-site'),
                appName: 'PulseStudio Membership',
                productType: 'fitness membership site',
                productBrief: 'PulseStudio Membership helps a fitness studio present classes, membership pricing, usage metrics, testimonials, onboarding tasks, and portable hosting.',
            }),
        },
        {
            id: 'compliance-training-api',
            title: 'Compliance training API',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#66-compliance-training-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('compliance-training-api'),
                appName: 'TrainingLedger API',
            }),
        },
        {
            id: 'compliance-certificate-worker',
            title: 'Compliance certificate worker',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#67-compliance-certificate-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('compliance-certificate-worker'),
                appName: 'CertificateQueue Worker',
            }),
        },
        {
            id: 'architect-project-showcase-site',
            title: 'Architect project showcase site',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#68-architect-project-showcase-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('architect-project-showcase-site'),
                appName: 'FormaWorks Showcase',
                productType: 'architect project showcase',
                productBrief: 'FormaWorks Showcase helps an architect present projects, inquiry metrics, service pricing, testimonials, delivery tasks, and concise Docker deployment.',
            }),
        },
        {
            id: 'restaurant-supplier-api',
            title: 'Restaurant supplier API',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#69-restaurant-supplier-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('restaurant-supplier-api'),
                appName: 'SupplierDesk API',
            }),
        },
        {
            id: 'restaurant-order-sync-worker',
            title: 'Restaurant order sync worker',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#70-restaurant-order-sync-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('restaurant-order-sync-worker'),
                appName: 'OrderSync Queue',
            }),
        },
        {
            id: 'enterprise-data-room-site',
            title: 'Enterprise data room site',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#71-enterprise-data-room-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('enterprise-data-room-site'),
                appName: 'VaultBrief',
                productType: 'enterprise data room portal',
                productBrief: 'VaultBrief helps corporate teams summarize due diligence materials, access metrics, pricing impact, testimonial proof, readiness tasks, and controlled deployment.',
            }),
        },
        {
            id: 'iot-device-registry-api',
            title: 'IoT device registry API',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#72-iot-device-registry-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('iot-device-registry-api'),
                appName: 'DeviceLedger API',
            }),
        },
        {
            id: 'iot-telemetry-worker',
            title: 'IoT telemetry worker',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#73-iot-telemetry-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('iot-telemetry-worker'),
                appName: 'TelemetryQueue Worker',
            }),
        },
        {
            id: 'freelancer-client-handoff-site',
            title: 'Freelancer client handoff site',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#74-freelancer-client-handoff-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('freelancer-client-handoff-site'),
                appName: 'HandoffKit',
                productType: 'client handoff site',
                productBrief: 'HandoffKit helps freelancers deliver project assets, launch metrics, pricing scope, testimonials, handoff tasks, and portable deployment notes.',
            }),
        },
        {
            id: 'property-maintenance-api',
            title: 'Property maintenance API',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#75-property-maintenance-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('property-maintenance-api'),
                appName: 'PropertyDesk API',
            }),
        },
        {
            id: 'property-maintenance-worker',
            title: 'Property maintenance worker',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#76-property-maintenance-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('property-maintenance-worker'),
                appName: 'MaintenanceQueue Worker',
            }),
        },
        {
            id: 'premium-product-waitlist-site',
            title: 'Premium product waitlist site',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#77-premium-product-waitlist-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('premium-product-waitlist-site'),
                appName: 'VelvetWaitlist',
                productType: 'premium product waitlist',
                productBrief: 'VelvetWaitlist helps a product team launch a premium waitlist with demand metrics, pricing tiers, testimonials, launch tasks, and self-hosted deployment.',
            }),
        },
        {
            id: 'ngo-field-report-api',
            title: 'NGO field report API',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#78-ngo-field-report-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('ngo-field-report-api'),
                appName: 'FieldReport API',
            }),
        },
        {
            id: 'ngo-field-upload-worker',
            title: 'NGO field upload worker',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#79-ngo-field-upload-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('ngo-field-upload-worker'),
                appName: 'FieldUpload Queue',
            }),
        },
        {
            id: 'corporate-ai-policy-site',
            title: 'Corporate AI policy site',
            storyPath: 'agents/training-scenarios/user_stories/61-80-advanced-user-stories.md#80-corporate-ai-policy-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('corporate-ai-policy-site'),
                appName: 'PolicyAtlas AI',
                productType: 'corporate AI policy portal',
                productBrief: 'PolicyAtlas AI helps a corporation publish AI policy guidance, adoption metrics, pricing impact, testimonials, readiness tasks, and controlled deployment notes.',
            }),
        },
        {
            id: 'designer-asset-approval-site',
            title: 'Designer asset approval site',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#81-designer-asset-approval-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('designer-asset-approval-site'),
                appName: 'ProofDeck',
                productType: 'creative asset approval portal',
                productBrief: 'ProofDeck helps design teams present campaign assets, approval metrics, package tiers, stakeholder quotes, review tasks, and concise self-hosted deployment notes.',
            }),
        },
        {
            id: 'agency-retainer-api',
            title: 'Agency retainer API',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#82-agency-retainer-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('agency-retainer-api'),
                appName: 'RetainerLedger API',
            }),
        },
        {
            id: 'agency-report-worker',
            title: 'Agency report worker',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#83-agency-report-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('agency-report-worker'),
                appName: 'ReportQueue Worker',
            }),
        },
        {
            id: 'newbie-service-directory-site',
            title: 'Newbie service directory site',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#84-newbie-service-directory-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('newbie-service-directory-site'),
                appName: 'LocalList Starter',
                productType: 'local service directory',
                productBrief: 'LocalList Starter helps a nontechnical founder publish service categories, lead metrics, pricing cards, testimonials, onboarding tasks, and short Docker deployment notes.',
            }),
        },
        {
            id: 'clinic-referral-api',
            title: 'Clinic referral API',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#85-clinic-referral-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('clinic-referral-api'),
                appName: 'ReferralDesk API',
            }),
        },
        {
            id: 'clinic-reminder-worker',
            title: 'Clinic reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#86-clinic-reminder-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('clinic-reminder-worker'),
                appName: 'CareReminder Queue',
            }),
        },
        {
            id: 'enterprise-risk-briefing-site',
            title: 'Enterprise risk briefing site',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#87-enterprise-risk-briefing-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('enterprise-risk-briefing-site'),
                appName: 'RiskBrief HQ',
                productType: 'executive risk briefing portal',
                productBrief: 'RiskBrief HQ helps executives scan risk categories, mitigation metrics, investment tiers, board quotes, readiness tasks, and controlled deployment notes.',
            }),
        },
        {
            id: 'fintech-dispute-api',
            title: 'Fintech dispute API',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#88-fintech-dispute-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('fintech-dispute-api'),
                appName: 'DisputeLedger API',
            }),
        },
        {
            id: 'fintech-reconciliation-worker',
            title: 'Fintech reconciliation worker',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#89-fintech-reconciliation-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('fintech-reconciliation-worker'),
                appName: 'ReconcileQueue Worker',
            }),
        },
        {
            id: 'municipal-permit-site',
            title: 'Municipal permit site',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#90-municipal-permit-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('municipal-permit-site'),
                appName: 'PermitPath',
                productType: 'municipal permit guidance site',
                productBrief: 'PermitPath helps residents understand permit categories, service metrics, pricing impact, citizen quotes, application tasks, and self-hosted deployment.',
            }),
        },
        {
            id: 'municipal-casework-api',
            title: 'Municipal casework API',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#91-municipal-casework-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('municipal-casework-api'),
                appName: 'CaseworkLedger API',
            }),
        },
        {
            id: 'municipal-notification-worker',
            title: 'Municipal notification worker',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#92-municipal-notification-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('municipal-notification-worker'),
                appName: 'NoticeQueue Worker',
            }),
        },
        {
            id: 'b2b-security-comparison-site',
            title: 'B2B security comparison site',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#93-b2b-security-comparison-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('b2b-security-comparison-site'),
                appName: 'SecureCompare',
                productType: 'B2B security comparison site',
                productBrief: 'SecureCompare helps a vendor compare security controls, trust metrics, plan tiers, customer quotes, procurement tasks, and Docker deployment notes.',
            }),
        },
        {
            id: 'security-questionnaire-api',
            title: 'Security questionnaire API',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#94-security-questionnaire-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('security-questionnaire-api'),
                appName: 'QuestionnaireVault API',
            }),
        },
        {
            id: 'security-evidence-worker',
            title: 'Security evidence worker',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#95-security-evidence-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('security-evidence-worker'),
                appName: 'EvidenceQueue Worker',
            }),
        },
        {
            id: 'creator-membership-site',
            title: 'Creator membership site',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#96-creator-membership-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('creator-membership-site'),
                appName: 'MemberForge',
                productType: 'creator membership site',
                productBrief: 'MemberForge helps creators show member benefits, revenue metrics, pricing levels, subscriber quotes, launch tasks, and beginner-safe deployment notes.',
            }),
        },
        {
            id: 'manufacturer-quality-api',
            title: 'Manufacturer quality API',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#97-manufacturer-quality-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('manufacturer-quality-api'),
                appName: 'QualityLedger API',
            }),
        },
        {
            id: 'manufacturer-inspection-worker',
            title: 'Manufacturer inspection worker',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#98-manufacturer-inspection-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('manufacturer-inspection-worker'),
                appName: 'InspectionQueue Worker',
            }),
        },
        {
            id: 'research-lab-grant-site',
            title: 'Research lab grant site',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#99-research-lab-grant-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('research-lab-grant-site'),
                appName: 'GrantSignal Lab',
                productType: 'research grant showcase',
                productBrief: 'GrantSignal Lab helps a research team present funding themes, impact metrics, sponsor tiers, collaborator quotes, submission tasks, and deployment notes.',
            }),
        },
        {
            id: 'logistics-customs-api',
            title: 'Logistics customs API',
            storyPath: 'agents/training-scenarios/user_stories/81-100-advanced-user-stories.md#100-logistics-customs-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('logistics-customs-api'),
                appName: 'CustomsDesk API',
            }),
        },
        {
            id: 'designer-campaign-microsite',
            title: 'Designer campaign microsite',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#101-designer-campaign-microsite',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('designer-campaign-microsite'),
                appName: 'LaunchCanvas',
                productType: 'campaign microsite',
                productBrief: 'LaunchCanvas helps campaign designers present creative sections, launch metrics, package tiers, stakeholder quotes, task status, and concise self-hosted deployment notes.',
            }),
        },
        {
            id: 'newbie-appointment-api',
            title: 'Newbie appointment API',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#102-newbie-appointment-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('newbie-appointment-api'),
                appName: 'AppointmentLedger API',
            }),
        },
        {
            id: 'newbie-reminder-worker',
            title: 'Newbie reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#103-newbie-reminder-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('newbie-reminder-worker'),
                appName: 'ReminderRun Queue',
            }),
        },
        {
            id: 'corporate-vendor-portal',
            title: 'Corporate vendor portal',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#104-corporate-vendor-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('corporate-vendor-portal'),
                appName: 'VendorGate',
                productType: 'vendor onboarding portal',
                productBrief: 'VendorGate helps procurement teams manage vendor risk categories, review metrics, package tiers, buyer quotes, readiness tasks, and controlled Docker deployment notes.',
            }),
        },
        {
            id: 'corporate-vendor-api',
            title: 'Corporate vendor API',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#105-corporate-vendor-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('corporate-vendor-api'),
                appName: 'VendorLedger API',
            }),
        },
        {
            id: 'corporate-vendor-worker',
            title: 'Corporate vendor worker',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#106-corporate-vendor-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('corporate-vendor-worker'),
                appName: 'VendorReview Queue',
            }),
        },
        {
            id: 'designer-case-study-portal',
            title: 'Designer case study portal',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#107-designer-case-study-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('designer-case-study-portal'),
                appName: 'ImpactFrames',
                productType: 'case study portal',
                productBrief: 'ImpactFrames helps product designers present case studies, outcome metrics, service tiers, client quotes, handoff tasks, and portable deployment notes.',
            }),
        },
        {
            id: 'startup-usage-api',
            title: 'Startup usage API',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#108-startup-usage-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('startup-usage-api'),
                appName: 'UsageLedger API',
            }),
        },
        {
            id: 'startup-billing-worker',
            title: 'Startup billing worker',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#109-startup-billing-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('startup-billing-worker'),
                appName: 'BillingQueue Worker',
            }),
        },
        {
            id: 'municipality-service-portal',
            title: 'Municipality service portal',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#110-municipality-service-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('municipality-service-portal'),
                appName: 'CivicSignal',
                productType: 'municipal service portal',
                productBrief: 'CivicSignal helps residents navigate service categories, response metrics, cost tiers, resident quotes, application tasks, and self-hosted deployment.',
            }),
        },
        {
            id: 'municipality-request-api',
            title: 'Municipality request API',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#111-municipality-request-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('municipality-request-api'),
                appName: 'RequestLedger API',
            }),
        },
        {
            id: 'municipality-dispatch-worker',
            title: 'Municipality dispatch worker',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#112-municipality-dispatch-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('municipality-dispatch-worker'),
                appName: 'DispatchQueue Worker',
            }),
        },
        {
            id: 'security-trust-center-site',
            title: 'Security trust center site',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#113-security-trust-center-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('security-trust-center-site'),
                appName: 'TrustSignal Center',
                productType: 'security trust center',
                productBrief: 'TrustSignal Center helps B2B buyers inspect control groups, assurance metrics, plan tiers, customer quotes, evidence tasks, and controlled Docker deployment.',
            }),
        },
        {
            id: 'security-exception-api',
            title: 'Security exception API',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#114-security-exception-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('security-exception-api'),
                appName: 'ExceptionLedger API',
            }),
        },
        {
            id: 'security-exception-worker',
            title: 'Security exception worker',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#115-security-exception-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('security-exception-worker'),
                appName: 'ExceptionQueue Worker',
            }),
        },
        {
            id: 'creator-launch-hub',
            title: 'Creator launch hub',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#116-creator-launch-hub',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('creator-launch-hub'),
                appName: 'LaunchHearth',
                productType: 'creator launch hub',
                productBrief: 'LaunchHearth helps creators sell offers with revenue metrics, pricing levels, audience quotes, launch tasks, and beginner-safe self-hosted deployment.',
            }),
        },
        {
            id: 'manufacturer-work-order-api',
            title: 'Manufacturer work order API',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#117-manufacturer-work-order-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('manufacturer-work-order-api'),
                appName: 'WorkOrderLedger API',
            }),
        },
        {
            id: 'manufacturer-work-order-worker',
            title: 'Manufacturer work order worker',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#118-manufacturer-work-order-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('manufacturer-work-order-worker'),
                appName: 'WorkOrderQueue Worker',
            }),
        },
        {
            id: 'research-review-site',
            title: 'Research review site',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#119-research-review-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('research-review-site'),
                appName: 'ReviewSignal Lab',
                productType: 'research review portal',
                productBrief: 'ReviewSignal Lab helps research teams present themes, impact metrics, sponsor tiers, reviewer quotes, submission tasks, and self-hosted deployment notes.',
            }),
        },
        {
            id: 'logistics-routing-api',
            title: 'Logistics routing API',
            storyPath: 'agents/training-scenarios/user_stories/101-120-advanced-user-stories.md#120-logistics-routing-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('logistics-routing-api'),
                appName: 'RouteLedger API',
            }),
        },
        {
            id: 'designer-handoff-portal',
            title: 'Designer handoff portal',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#121-designer-handoff-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('designer-handoff-portal'),
                appName: 'HandoffNorth',
                productType: 'design handoff portal',
                productBrief: 'HandoffNorth helps design systems teams publish component groups, release metrics, service tiers, stakeholder quotes, implementation tasks, and concise self-hosted deployment notes.',
            }),
        },
        {
            id: 'beginner-trades-website',
            title: 'Beginner trades website',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#122-beginner-trades-website',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('beginner-trades-website'),
                appName: 'VoltLocal',
                productType: 'local trades website',
                productBrief: 'VoltLocal helps an electrician show services, response metrics, simple pricing bands, customer quotes, launch tasks, and beginner-safe Docker deployment notes.',
            }),
        },
        {
            id: 'enterprise-access-request-api',
            title: 'Enterprise access request API',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#123-enterprise-access-request-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('enterprise-access-request-api'),
                appName: 'AccessLedger API',
            }),
        },
        {
            id: 'enterprise-provisioning-worker',
            title: 'Enterprise provisioning worker',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#124-enterprise-provisioning-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('enterprise-provisioning-worker'),
                appName: 'ProvisionQueue Worker',
            }),
        },
        {
            id: 'compliance-evidence-room',
            title: 'Compliance evidence room',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#125-compliance-evidence-room',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('compliance-evidence-room'),
                appName: 'EvidenceRoom',
                productType: 'compliance evidence portal',
                productBrief: 'EvidenceRoom helps compliance teams present control families, audit metrics, assurance tiers, reviewer quotes, evidence tasks, and controlled self-hosted deployment.',
            }),
        },
        {
            id: 'compliance-finding-api',
            title: 'Compliance finding API',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#126-compliance-finding-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('compliance-finding-api'),
                appName: 'FindingLedger API',
            }),
        },
        {
            id: 'compliance-remediation-worker',
            title: 'Compliance remediation worker',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#127-compliance-remediation-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('compliance-remediation-worker'),
                appName: 'RemediateQueue Worker',
            }),
        },
        {
            id: 'marketplace-seller-console',
            title: 'Marketplace seller console',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#128-marketplace-seller-console',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('marketplace-seller-console'),
                appName: 'SellerSignal',
                productType: 'marketplace seller console',
                productBrief: 'SellerSignal helps marketplace sellers track listings, payout metrics, pricing plans, seller proof, onboarding tasks, and portable Docker deployment.',
            }),
        },
        {
            id: 'marketplace-order-api',
            title: 'Marketplace order API',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#129-marketplace-order-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('marketplace-order-api'),
                appName: 'OrderLedger API',
            }),
        },
        {
            id: 'marketplace-fulfillment-worker',
            title: 'Marketplace fulfillment worker',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#130-marketplace-fulfillment-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('marketplace-fulfillment-worker'),
                appName: 'FulfillQueue Worker',
            }),
        },
        {
            id: 'hospital-staffing-board',
            title: 'Hospital staffing board',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#131-hospital-staffing-board',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('hospital-staffing-board'),
                appName: 'ShiftSignal',
                productType: 'hospital staffing board',
                productBrief: 'ShiftSignal helps hospital operations teams inspect unit coverage, staffing metrics, escalation tiers, coordinator quotes, task status, and controlled deployment notes.',
            }),
        },
        {
            id: 'hospital-credential-api',
            title: 'Hospital credential API',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#132-hospital-credential-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('hospital-credential-api'),
                appName: 'CredentialLedger API',
            }),
        },
        {
            id: 'hospital-credential-worker',
            title: 'Hospital credential worker',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#133-hospital-credential-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('hospital-credential-worker'),
                appName: 'CredentialQueue Worker',
            }),
        },
        {
            id: 'school-enrollment-portal',
            title: 'School enrollment portal',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#134-school-enrollment-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('school-enrollment-portal'),
                appName: 'EnrollNorth',
                productType: 'school enrollment portal',
                productBrief: 'EnrollNorth helps schools guide families through programs, application metrics, fee tiers, parent quotes, document tasks, and beginner-safe deployment notes.',
            }),
        },
        {
            id: 'school-enrollment-api',
            title: 'School enrollment API',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#135-school-enrollment-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('school-enrollment-api'),
                appName: 'EnrollmentLedger API',
            }),
        },
        {
            id: 'school-notification-worker',
            title: 'School notification worker',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#136-school-notification-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('school-notification-worker'),
                appName: 'EnrollmentQueue Worker',
            }),
        },
        {
            id: 'data-team-quality-dashboard',
            title: 'Data team quality dashboard',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#137-data-team-quality-dashboard',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('data-team-quality-dashboard'),
                appName: 'FreshnessBoard',
                productType: 'data quality dashboard',
                productBrief: 'FreshnessBoard helps analytics engineers monitor pipeline freshness, quality metrics, support tiers, stakeholder quotes, incident tasks, and self-hosted deployment.',
            }),
        },
        {
            id: 'data-contract-api',
            title: 'Data contract API',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#138-data-contract-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('data-contract-api'),
                appName: 'ContractLedger API',
            }),
        },
        {
            id: 'data-sync-worker',
            title: 'Data sync worker',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#139-data-sync-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('data-sync-worker'),
                appName: 'SyncQueue Worker',
            }),
        },
        {
            id: 'executive-board-pack-site',
            title: 'Executive board pack site',
            storyPath: 'agents/training-scenarios/user_stories/121-140-advanced-user-stories.md#140-executive-board-pack-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('executive-board-pack-site'),
                appName: 'BoardSignal',
                productType: 'executive board pack site',
                productBrief: 'BoardSignal helps strategy teams present decisions, KPI metrics, investment tiers, stakeholder quotes, action tasks, and sober self-hosted deployment notes.',
            }),
        },
        {
            id: 'brand-campaign-control-room',
            title: 'Brand campaign control room',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#141-brand-campaign-control-room',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('brand-campaign-control-room'),
                appName: 'CampaignSignal',
                productType: 'brand campaign control room',
                productBrief: 'CampaignSignal helps brand teams inspect launch assets, campaign metrics, package tiers, stakeholder quotes, owner tasks, and concise self-hosted deployment notes.',
            }),
        },
        {
            id: 'beginner-photographer-site',
            title: 'Beginner photographer site',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#142-beginner-photographer-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('beginner-photographer-site'),
                appName: 'FrameLocal',
                productType: 'photography booking site',
                productBrief: 'FrameLocal helps a new photographer present services, booking metrics, pricing bands, client quotes, launch tasks, and beginner-safe Docker deployment.',
            }),
        },
        {
            id: 'corporate-policy-exception-api',
            title: 'Corporate policy exception API',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#143-corporate-policy-exception-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('corporate-policy-exception-api'),
                appName: 'PolicyException API',
            }),
        },
        {
            id: 'corporate-policy-review-worker',
            title: 'Corporate policy review worker',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#144-corporate-policy-review-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('corporate-policy-review-worker'),
                appName: 'PolicyReview Queue',
            }),
        },
        {
            id: 'construction-bid-portal',
            title: 'Construction bid portal',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#145-construction-bid-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('construction-bid-portal'),
                appName: 'BidNorth',
                productType: 'construction bid portal',
                productBrief: 'BidNorth helps construction teams manage trade sections, bid metrics, package tiers, contractor quotes, submission tasks, and portable deployment.',
            }),
        },
        {
            id: 'construction-bid-api',
            title: 'Construction bid API',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#146-construction-bid-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('construction-bid-api'),
                appName: 'BidLedger API',
            }),
        },
        {
            id: 'construction-notification-worker',
            title: 'Construction notification worker',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#147-construction-notification-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('construction-notification-worker'),
                appName: 'SiteNotify Queue',
            }),
        },
        {
            id: 'legal-matter-dashboard',
            title: 'Legal matter dashboard',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#148-legal-matter-dashboard',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('legal-matter-dashboard'),
                appName: 'MatterSignal',
                productType: 'legal matter dashboard',
                productBrief: 'MatterSignal helps law firms track matter sections, deadline metrics, retainer tiers, client quotes, review tasks, and controlled self-hosted deployment.',
            }),
        },
        {
            id: 'legal-intake-api',
            title: 'Legal intake API',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#149-legal-intake-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('legal-intake-api'),
                appName: 'IntakeLedger API',
            }),
        },
        {
            id: 'legal-deadline-worker',
            title: 'Legal deadline worker',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#150-legal-deadline-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('legal-deadline-worker'),
                appName: 'DeadlineQueue Worker',
            }),
        },
        {
            id: 'climate-grant-portal',
            title: 'Climate grant portal',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#151-climate-grant-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('climate-grant-portal'),
                appName: 'GrantSignal',
                productType: 'climate grant portal',
                productBrief: 'GrantSignal helps nonprofits present funding sections, impact metrics, sponsor tiers, applicant quotes, submission tasks, and self-hosted deployment notes.',
            }),
        },
        {
            id: 'climate-grant-api',
            title: 'Climate grant API',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#152-climate-grant-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('climate-grant-api'),
                appName: 'GrantLedger API',
            }),
        },
        {
            id: 'climate-review-worker',
            title: 'Climate review worker',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#153-climate-review-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('climate-review-worker'),
                appName: 'GrantReview Queue',
            }),
        },
        {
            id: 'logistics-yard-board',
            title: 'Logistics yard board',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#154-logistics-yard-board',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('logistics-yard-board'),
                appName: 'YardSignal',
                productType: 'logistics yard board',
                productBrief: 'YardSignal helps warehouse dispatchers inspect dock sections, throughput metrics, escalation tiers, dispatcher quotes, action tasks, and deployment notes.',
            }),
        },
        {
            id: 'logistics-yard-api',
            title: 'Logistics yard API',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#155-logistics-yard-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('logistics-yard-api'),
                appName: 'YardLedger API',
            }),
        },
        {
            id: 'logistics-alert-worker',
            title: 'Logistics alert worker',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#156-logistics-alert-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('logistics-alert-worker'),
                appName: 'YardAlert Queue',
            }),
        },
        {
            id: 'product-research-repository',
            title: 'Product research repository',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#157-product-research-repository',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('product-research-repository'),
                appName: 'InsightSignal',
                productType: 'product research repository',
                productBrief: 'InsightSignal helps product teams organize study sections, evidence metrics, access tiers, researcher quotes, synthesis tasks, and deployment notes.',
            }),
        },
        {
            id: 'product-research-api',
            title: 'Product research API',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#158-product-research-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('product-research-api'),
                appName: 'InsightLedger API',
            }),
        },
        {
            id: 'product-research-worker',
            title: 'Product research worker',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#159-product-research-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('product-research-worker'),
                appName: 'InsightQueue Worker',
            }),
        },
        {
            id: 'investor-data-room',
            title: 'Investor data room',
            storyPath: 'agents/training-scenarios/user_stories/141-160-advanced-user-stories.md#160-investor-data-room',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('investor-data-room'),
                appName: 'DataRoomSignal',
                productType: 'investor data room',
                productBrief: 'DataRoomSignal helps CFOs present document sections, KPI metrics, access tiers, investor quotes, diligence tasks, and concise self-hosted deployment notes.',
            }),
        },
        {
            id: 'design-qa-portal',
            title: 'Design QA portal',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#161-design-qa-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('design-qa-portal'),
                appName: 'DesignQASignal',
                productType: 'design QA portal',
                productBrief: 'DesignQASignal helps design QA teams present review findings, defect metrics, service tiers, stakeholder quotes, handoff tasks, and deployment notes.',
            }),
        },
        {
            id: 'beginner-cleaning-service-site',
            title: 'Beginner cleaning service site',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#162-beginner-cleaning-service-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('beginner-cleaning-service-site'),
                appName: 'CleanLocal',
                productType: 'cleaning service website',
                productBrief: 'CleanLocal helps a new cleaning business present services, response metrics, pricing packages, customer quotes, launch tasks, and beginner-safe deployment notes.',
            }),
        },
        {
            id: 'enterprise-asset-inventory-api',
            title: 'Enterprise asset inventory API',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#163-enterprise-asset-inventory-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('enterprise-asset-inventory-api'),
                appName: 'AssetLedger API',
            }),
        },
        {
            id: 'enterprise-asset-audit-worker',
            title: 'Enterprise asset audit worker',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#164-enterprise-asset-audit-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('enterprise-asset-audit-worker'),
                appName: 'AssetAudit Queue',
            }),
        },
        {
            id: 'retail-returns-portal',
            title: 'Retail returns portal',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#165-retail-returns-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('retail-returns-portal'),
                appName: 'ReturnSignal',
                productType: 'retail returns portal',
                productBrief: 'ReturnSignal helps support teams manage return sections, resolution metrics, policy tiers, customer quotes, processing tasks, and deployment notes.',
            }),
        },
        {
            id: 'retail-returns-api',
            title: 'Retail returns API',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#166-retail-returns-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('retail-returns-api'),
                appName: 'ReturnLedger API',
            }),
        },
        {
            id: 'retail-refund-worker',
            title: 'Retail refund worker',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#167-retail-refund-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('retail-refund-worker'),
                appName: 'RefundQueue Worker',
            }),
        },
        {
            id: 'museum-exhibit-site',
            title: 'Museum exhibit site',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#168-museum-exhibit-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('museum-exhibit-site'),
                appName: 'ExhibitSignal',
                productType: 'museum exhibit site',
                productBrief: 'ExhibitSignal helps museums present exhibit sections, visitor metrics, ticket tiers, curator quotes, accessibility tasks, and deployment notes.',
            }),
        },
        {
            id: 'museum-collection-api',
            title: 'Museum collection API',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#169-museum-collection-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('museum-collection-api'),
                appName: 'CollectionLedger API',
            }),
        },
        {
            id: 'museum-digitization-worker',
            title: 'Museum digitization worker',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#170-museum-digitization-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('museum-digitization-worker'),
                appName: 'DigitizeQueue Worker',
            }),
        },
        {
            id: 'security-incident-portal',
            title: 'Security incident portal',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#171-security-incident-portal',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('security-incident-portal'),
                appName: 'IncidentSignal',
                productType: 'security incident portal',
                productBrief: 'IncidentSignal helps security teams present incident sections, response metrics, severity tiers, stakeholder quotes, action tasks, and controlled deployment notes.',
            }),
        },
        {
            id: 'security-incident-api',
            title: 'Security incident API',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#172-security-incident-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('security-incident-api'),
                appName: 'IncidentLedger API',
            }),
        },
        {
            id: 'security-notification-worker',
            title: 'Security notification worker',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#173-security-notification-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('security-notification-worker'),
                appName: 'IncidentNotify Queue',
            }),
        },
        {
            id: 'agency-client-health-board',
            title: 'Agency client health board',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#174-agency-client-health-board',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('agency-client-health-board'),
                appName: 'ClientHealthSignal',
                productType: 'agency client health board',
                productBrief: 'ClientHealthSignal helps agencies inspect client sections, health metrics, retainer tiers, client quotes, action tasks, and deployment notes.',
            }),
        },
        {
            id: 'agency-client-api',
            title: 'Agency client API',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#175-agency-client-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('agency-client-api'),
                appName: 'ClientHealthLedger API',
            }),
        },
        {
            id: 'agency-client-report-worker',
            title: 'Agency client report worker',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#176-agency-report-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('agency-client-report-worker'),
                appName: 'ClientReport Queue',
            }),
        },
        {
            id: 'farmer-csa-membership-site',
            title: 'Farmer CSA membership site',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#177-farmer-csa-membership-site',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('farmer-csa-membership-site'),
                appName: 'HarvestSignal',
                productType: 'CSA membership site',
                productBrief: 'HarvestSignal helps small farms present share sections, harvest metrics, membership tiers, member quotes, pickup tasks, and beginner-safe deployment notes.',
            }),
        },
        {
            id: 'farm-subscription-api',
            title: 'Farm subscription API',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#178-farm-subscription-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('farm-subscription-api'),
                appName: 'HarvestLedger API',
            }),
        },
        {
            id: 'farm-reminder-worker',
            title: 'Farm reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#179-farm-reminder-worker',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('farm-reminder-worker'),
                appName: 'HarvestQueue Worker',
            }),
        },
        {
            id: 'executive-decision-log',
            title: 'Executive decision log',
            storyPath: 'agents/training-scenarios/user_stories/161-180-advanced-user-stories.md#180-executive-decision-log',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('executive-decision-log'),
                appName: 'DecisionSignal',
                productType: 'executive decision log',
                productBrief: 'DecisionSignal helps chiefs of staff present decision sections, follow-up metrics, governance tiers, stakeholder quotes, action tasks, and deployment notes.',
            }),
        },
        {
            id: 'agency-less-embarrassing-site',
            title: 'Agency less embarrassing site',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#181-make-my-agency-site-less-embarrassing',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('agency-less-embarrassing-site'),
                appName: 'Small Proof Studio',
                productType: 'small agency site',
                productBrief: 'Small Proof Studio turns a vague founder request into a concise agency site for brand work, Webflow cleanup, launch help, proof, service packages, and a non-cringey contact path.',
            }),
        },
        {
            id: 'messy-orders-api',
            title: 'Messy orders API',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#182-orders-are-everywhere',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('messy-orders-api'),
                appName: 'OrderTriage API',
            }),
        },
        {
            id: 'forgotten-email-worker',
            title: 'Forgotten email worker',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#183-email-keeps-getting-lost',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('forgotten-email-worker'),
                appName: 'LaunchMail Queue',
            }),
        },
        {
            id: 'board-pack-command-center',
            title: 'Board pack command center',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#184-the-ceo-wants-a-board-pack-thing',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('board-pack-command-center'),
                appName: 'BoardBrief',
                productType: 'executive board pack dashboard',
                productBrief: 'BoardBrief gives executives a restrained board-ready surface for initiatives, blockers, decisions, owner asks, timeline risk, and status metrics without startup-style fluff.',
            }),
        },
        {
            id: 'finance-csv-reconciliation-api',
            title: 'Finance CSV reconciliation API',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#185-finance-csv-mess',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('finance-csv-reconciliation-api'),
                appName: 'LedgerMatch API',
            }),
        },
        {
            id: 'idempotent-import-worker',
            title: 'Idempotent import worker',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#186-the-import-job-duplicates-stuff',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('idempotent-import-worker'),
                appName: 'ImportGuard Worker',
            }),
        },
        {
            id: 'artist-print-drop-page',
            title: 'Artist print drop page',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#187-artist-drop-page-but-not-cringe',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('artist-print-drop-page'),
                appName: 'EditionWindow',
                productType: 'artist print drop page',
                productBrief: 'EditionWindow presents a premium but plainspoken print release with edition details, launch timing, shipping notes, proof, FAQ, and purchase intent without luxury nonsense.',
            }),
        },
        {
            id: 'clinic-intake-api',
            title: 'Clinic intake API',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#188-clinic-intake-maybe-hipaa-later',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('clinic-intake-api'),
                appName: 'CareIntake API',
            }),
        },
        {
            id: 'appointment-reminder-worker',
            title: 'Appointment reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#189-patients-forget-appointments',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('appointment-reminder-worker'),
                appName: 'CareReminder Queue',
            }),
        },
        {
            id: 'plain-permit-service-page',
            title: 'Plain permit service page',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#190-nobody-reads-the-permit-page',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('plain-permit-service-page'),
                appName: 'PermitPlain',
                productType: 'municipal permit service page',
                productBrief: 'PermitPlain turns a confusing municipal permit page into plain-language permit types, timelines, fees, document checklists, office hours, status actions, and accessible FAQ.',
            }),
        },
        {
            id: 'permit-status-api',
            title: 'Permit status API',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#191-permit-status-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('permit-status-api'),
                appName: 'PermitLedger API',
            }),
        },
        {
            id: 'permit-notification-worker',
            title: 'Permit notification worker',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#192-tell-people-when-their-permit-changes',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('permit-notification-worker'),
                appName: 'PermitNotice Worker',
            }),
        },
        {
            id: 'family-chores-first-version',
            title: 'Family chores first version',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#193-i-need-a-chores-app-i-think',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('family-chores-first-version'),
                appName: 'ChoreKind',
                productType: 'family chores dashboard',
                productBrief: 'ChoreKind is a beginner-friendly household dashboard for chores, assignments, allowance progress, reminders, empty states, and simple setup for a non-technical family.',
            }),
        },
        {
            id: 'tenant-maintenance-api',
            title: 'Tenant maintenance API',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#194-maintenance-requests-are-in-texts',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('tenant-maintenance-api'),
                appName: 'RepairLedger API',
            }),
        },
        {
            id: 'repair-dispatch-worker',
            title: 'Repair dispatch worker',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#195-dispatch-the-repair-jobs',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('repair-dispatch-worker'),
                appName: 'RepairDispatch Worker',
            }),
        },
        {
            id: 'policy-portal-first-screen',
            title: 'Policy portal first screen',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#196-policy-portal-that-people-might-actually-use',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('policy-portal-first-screen'),
                appName: 'PolicySignal',
                productType: 'internal policy portal',
                productBrief: 'PolicySignal gives employees a restrained internal portal for policy categories, recent changes, owners, acknowledgements, question paths, and searchable structure.',
            }),
        },
        {
            id: 'legal-hold-tracker-api',
            title: 'Legal hold tracker API',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#197-legal-hold-tracker',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('legal-hold-tracker-api'),
                appName: 'HoldLedger API',
            }),
        },
        {
            id: 'legal-export-worker',
            title: 'Legal export worker',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#198-exports-cannot-fail-silently',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('legal-export-worker'),
                appName: 'ExportProof Worker',
            }),
        },
        {
            id: 'ugly-spreadsheet-crm',
            title: 'Ugly spreadsheet CRM',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#199-ugly-spreadsheet-crm',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('ugly-spreadsheet-crm'),
                appName: 'FollowUpTiny',
                productType: 'simple freelancer CRM',
                productBrief: 'FollowUpTiny turns an ugly lead spreadsheet into a low-friction freelancer CRM with leads, next follow-up, deal stage, notes, metrics, empty states, and import/export cues.',
            }),
        },
        {
            id: 'small-crm-api',
            title: 'Small CRM API',
            storyPath: 'agents/training-scenarios/user_stories/181-200-ambiguous-production-user-stories.md#200-turn-that-crm-into-an-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('small-crm-api'),
                appName: 'FollowUpLedger API',
            }),
        },
        {
            id: 'plumber-lead-site',
            title: 'Plumber lead site',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#381-make-the-old-site-stop-costing-me-leads',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 55 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('plumber-lead-site'),
                appName: 'ClearPipe Service',
                productType: 'trades lead generation site',
                productBrief: 'ClearPipe Service turns a vague plumber site rescue into a practical service page with emergency/planned work separation, service area, trust proof, contact path, and no fake booking.',
            }),
        },
        {
            id: 'small-service-leads-api',
            title: 'Small service leads API',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#382-the-leads-are-in-four-places',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('small-service-leads-api'),
                appName: 'LeadDesk API',
            }),
        },
        {
            id: 'callback-reminder-worker',
            title: 'Callback reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#383-call-people-back-without-forgetting',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 7 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('callback-reminder-worker'),
                appName: 'CallbackQueue Worker',
            }),
        },
        {
            id: 'warehouse-demo-page',
            title: 'Warehouse demo page',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#384-our-demo-is-tomorrow-and-the-page-is-embarrassing',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 55 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('warehouse-demo-page'),
                appName: 'DockSignal',
                productType: 'warehouse software demo page',
                productBrief: 'DockSignal is a sharp operational demo page for warehouse software with receiving, exceptions, queue visibility, blocker metrics, role proof, and a realistic demo CTA.',
            }),
        },
        {
            id: 'warehouse-receiving-api-381',
            title: 'Warehouse receiving API',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#385-the-ops-team-wants-a-receiving-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('warehouse-receiving-api-381'),
                appName: 'ReceivingLedger API',
            }),
        },
        {
            id: 'safe-label-worker',
            title: 'Safe label worker',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#386-labels-print-twice-and-nobody-knows-why',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 7 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('safe-label-worker'),
                appName: 'LabelGuard Worker',
            }),
        },
        {
            id: 'readable-policy-page',
            title: 'Readable policy page',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#387-a-serious-policy-page-for-people-who-hate-policy-pages',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 55 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('readable-policy-page'),
                appName: 'PolicyPlain',
                productType: 'readable internal policy portal',
                productBrief: 'PolicyPlain makes remote work policy readable with categories, recent changes, owner contacts, acknowledgements, employee questions, and a restrained internal interface.',
            }),
        },
        {
            id: 'policy-exception-api-381',
            title: 'Policy exception API',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#388-track-exceptions-before-audit-week',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('policy-exception-api-381'),
                appName: 'ExceptionLedger API',
            }),
        },
        {
            id: 'exception-expiry-worker',
            title: 'Exception expiry worker',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#389-nudge-owners-before-exceptions-expire',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 7 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('exception-expiry-worker'),
                appName: 'ExceptionNudge Worker',
            }),
        },
        {
            id: 'calm-gallery-site',
            title: 'Calm gallery site',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#390-a-gallery-page-that-does-not-feel-like-a-template',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 55 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('calm-gallery-site'),
                appName: 'QuietRoom Gallery',
                productType: 'artist show gallery site',
                productBrief: 'QuietRoom Gallery is a calm artist show site with artwork availability, show details, inquiry path, visit/shipping notes, proof, and no fake checkout.',
            }),
        },
        {
            id: 'artwork-inventory-api',
            title: 'Artwork inventory API',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#391-artwork-inventory-without-the-spreadsheet-panic',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('artwork-inventory-api'),
                appName: 'ArtworkLedger API',
            }),
        },
        {
            id: 'collector-followup-worker',
            title: 'Collector followup worker',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#392-follow-up-with-collectors-later',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 7 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('collector-followup-worker'),
                appName: 'CollectorFollowup Worker',
            }),
        },
        {
            id: 'cfo-one-screen-dashboard',
            title: 'CFO one screen dashboard',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#393-the-cfo-wants-one-screen-not-a-bi-project',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 55 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('cfo-one-screen-dashboard'),
                appName: 'CashBrief',
                productType: 'finance executive dashboard',
                productBrief: 'CashBrief gives a CFO one board-safe screen for cash, overdue invoices, risks, owners, weekly changes, and review tasks without pretending to connect live bank feeds.',
            }),
        },
        {
            id: 'invoice-exceptions-api',
            title: 'Invoice exceptions API',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#394-invoice-exceptions-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('invoice-exceptions-api'),
                appName: 'InvoiceException API',
            }),
        },
        {
            id: 'safe-invoice-export-worker',
            title: 'Safe invoice export worker',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#395-retry-invoice-exports-safely',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 7 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('safe-invoice-export-worker'),
                appName: 'InvoiceExportGuard Worker',
            }),
        },
        {
            id: 'warm-clinic-site',
            title: 'Warm clinic site',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#396-a-local-clinic-site-that-does-not-sound-like-a-hospital-chain',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 55 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('warm-clinic-site'),
                appName: 'HarborCare Local',
                productType: 'local clinic website',
                productBrief: 'HarborCare Local is a warmer clinic site with services, hours, preparation notes, urgent-care caveats, contact path, accessibility, and no fake medical promises.',
            }),
        },
        {
            id: 'clinic-intake-tracker-api',
            title: 'Clinic intake tracker API',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#397-clinic-intake-tracker',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('clinic-intake-tracker-api'),
                appName: 'IntakeTracker API',
            }),
        },
        {
            id: 'missing-doc-reminder-worker',
            title: 'Missing document reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#398-remind-staff-about-missing-documents',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 7 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('missing-doc-reminder-worker'),
                appName: 'DocumentNudge Worker',
            }),
        },
        {
            id: 'tiny-internal-tool',
            title: 'Tiny internal tool',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#399-a-tiny-internal-tool-for-a-boss-who-says-just-make-it-work',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 55 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('tiny-internal-tool'),
                appName: 'WorkTiny',
                productType: 'small internal work dashboard',
                productBrief: 'WorkTiny gives a small company one useful internal screen for tasks, blockers, owners, shipped work, simple auth seams, and deployment notes without overbuilding.',
            }),
        },
        {
            id: 'internal-work-api',
            title: 'Internal work API',
            storyPath: 'agents/training-scenarios/user_stories/381-400-real-world-ambiguity-user-stories.md#400-turn-that-internal-tool-into-an-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('internal-work-api'),
                appName: 'WorkTiny API',
            }),
        },
        {
            id: 'restaurant-menu-site',
            title: 'Restaurant menu site',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#401-the-menu-has-become-a-liability',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('restaurant-menu-site'),
                appName: 'TablePlain',
                productType: 'restaurant menu and trust site',
                productBrief: 'TablePlain turns a risky restaurant menu site into a practical page with menu sections, allergen cues, hours, location, update notes, and honest contact paths.',
            }),
        },
        {
            id: 'restaurant-bookings-api',
            title: 'Restaurant bookings API',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#402-bookings-are-just-text-messages-right-now',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('restaurant-bookings-api'),
                appName: 'BookingLedger API',
            }),
        },
        {
            id: 'table-confirmation-worker',
            title: 'Table confirmation worker',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#403-stop-double-confirming-tables',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('table-confirmation-worker'),
                appName: 'TableConfirm Worker',
            }),
        },
        {
            id: 'charity-trust-site',
            title: 'Charity trust site',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#404-the-charity-looks-like-it-closed',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('charity-trust-site'),
                appName: 'OpenHands Local',
                productType: 'nonprofit trust and volunteer site',
                productBrief: 'OpenHands Local helps a small nonprofit look alive and credible with mission, programs, donor trust proof, volunteer next steps, reporting cues, and no fake donation processor.',
            }),
        },
        {
            id: 'grant-reporting-api',
            title: 'Grant reporting API',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#405-grant-reporting-is-a-spreadsheet-fight',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('grant-reporting-api'),
                appName: 'GrantLedger API',
            }),
        },
        {
            id: 'grant-report-reminder-worker',
            title: 'Grant report reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#406-reports-are-due-before-anyone-remembers',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('grant-report-reminder-worker'),
                appName: 'GrantNudge Worker',
            }),
        },
        {
            id: 'lab-equipment-site',
            title: 'Lab equipment site',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#407-the-lab-equipment-page-is-a-pdf-graveyard',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('lab-equipment-site'),
                appName: 'LabBench Directory',
                productType: 'university lab equipment directory',
                productBrief: 'LabBench Directory replaces scattered lab PDFs with equipment categories, owner contacts, safety notes, availability caveats, request paths, and a readable academic tone.',
            }),
        },
        {
            id: 'equipment-requests-api',
            title: 'Equipment requests API',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#408-shared-equipment-requests-need-order',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('equipment-requests-api'),
                appName: 'EquipmentRequest API',
            }),
        },
        {
            id: 'calibration-reminder-worker',
            title: 'Calibration reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#409-calibration-reminders-keep-slipping',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('calibration-reminder-worker'),
                appName: 'CalibrationNudge Worker',
            }),
        },
        {
            id: 'legal-intake-site',
            title: 'Legal intake site',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#410-legal-intake-without-looking-sketchy',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('legal-intake-site'),
                appName: 'ClearCase Intake',
                productType: 'solo lawyer intake site',
                productBrief: 'ClearCase Intake is a restrained legal intake site with practice areas, disclaimer language, conflict-check caveats, consultation path, and trust proof without outcome promises.',
            }),
        },
        {
            id: 'case-intake-api',
            title: 'Case intake API',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#411-case-intake-is-in-email',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('case-intake-api'),
                appName: 'CaseIntake API',
            }),
        },
        {
            id: 'legal-deadline-worker-401',
            title: 'Legal deadline worker',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#412-deadlines-cannot-disappear',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('legal-deadline-worker-401'),
                appName: 'DeadlineGuard Worker',
            }),
        },
        {
            id: 'construction-bid-dashboard',
            title: 'Construction bid dashboard',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#413-bids-are-getting-lost',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('construction-bid-dashboard'),
                appName: 'BidBrief',
                productType: 'construction bid pipeline dashboard',
                productBrief: 'BidBrief gives estimators a compact bid pipeline with stages, due dates, risk flags, owners, action cues, and construction-specific status language without ERP sprawl.',
            }),
        },
        {
            id: 'rfq-source-api',
            title: 'RFQ source API',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#414-rfqs-need-a-source-of-truth',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('rfq-source-api'),
                appName: 'RFQLedger API',
            }),
        },
        {
            id: 'bid-reminder-worker',
            title: 'Bid reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#415-bid-reminders-should-not-create-panic',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('bid-reminder-worker'),
                appName: 'BidNudge Worker',
            }),
        },
        {
            id: 'municipal-permit-site-401',
            title: 'Municipal permit site',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#416-residents-cannot-find-the-right-form',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('municipal-permit-site-401'),
                appName: 'PermitPlain',
                productType: 'municipal permit service page',
                productBrief: 'PermitPlain helps residents choose the right permit with categories, eligibility cues, process steps, document checklist, escalation path, and plain accessible language.',
            }),
        },
        {
            id: 'permit-status-api-401',
            title: 'Permit status API',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#417-permits-need-status',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('permit-status-api-401'),
                appName: 'PermitStatus API',
            }),
        },
        {
            id: 'inspection-window-worker',
            title: 'Inspection window worker',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#418-inspection-windows-keep-moving',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('inspection-window-worker'),
                appName: 'InspectionNudge Worker',
            }),
        },
        {
            id: 'seller-admin-site',
            title: 'Seller admin site',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#419-sellers-need-a-real-admin-not-a-pretty-storefront',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('seller-admin-site'),
                appName: 'SellerOps Board',
                productType: 'marketplace seller operations admin',
                productBrief: 'SellerOps Board gives marketplace sellers listings, order issues, payout status, action queues, empty states, and operational metrics instead of a customer storefront.',
            }),
        },
        {
            id: 'seller-records-api',
            title: 'Seller records API',
            storyPath: 'agents/training-scenarios/user_stories/401-420-real-world-pressure-user-stories.md#420-seller-records-need-an-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('seller-records-api'),
                appName: 'SellerLedger API',
            }),
        },
        {
            id: 'camp-parent-info-site',
            title: 'Camp parent info site',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#421-parents-keep-calling-about-the-same-camp-questions',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('camp-parent-info-site'),
                appName: 'CampClear',
                productType: 'summer camp parent information site',
                productBrief: 'CampClear gives parents dates, age groups, packing lists, pricing caveats, safety cues, FAQs, and a contact path without pretending to run registration or payment.',
            }),
        },
        {
            id: 'camp-registration-api',
            title: 'Camp registration API',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#422-camp-registrations-are-in-inbox-chaos',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('camp-registration-api'),
                appName: 'CampRoster API',
            }),
        },
        {
            id: 'camp-form-nudge-worker',
            title: 'Camp form nudge worker',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#423-missing-forms-need-gentle-nudges',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('camp-form-nudge-worker'),
                appName: 'CampFormNudge Worker',
            }),
        },
        {
            id: 'repair-shop-site',
            title: 'Repair shop site',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#424-the-repair-shop-looks-closed-online',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('repair-shop-site'),
                appName: 'BenchReady Repair',
                productType: 'local repair shop service site',
                productBrief: 'BenchReady Repair explains bikes, scooters, e-bikes, intake prep, service limits, hours, location, and contact paths with plain practical copy and no fake booking.',
            }),
        },
        {
            id: 'repair-ticket-api',
            title: 'Repair ticket API',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#425-repair-tickets-need-status',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('repair-ticket-api'),
                appName: 'RepairTicket API',
            }),
        },
        {
            id: 'repair-status-worker',
            title: 'Repair status worker',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#426-customers-keep-asking-if-it-is-ready',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('repair-status-worker'),
                appName: 'RepairNudge Worker',
            }),
        },
        {
            id: 'onboarding-training-site',
            title: 'Onboarding training site',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#427-our-training-page-scares-new-employees',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('onboarding-training-site'),
                appName: 'FirstWeek Map',
                productType: 'internal onboarding training site',
                productBrief: 'FirstWeek Map makes onboarding practical with role paths, week-one tasks, owners, systems, completion cues, and calm internal-tool layout instead of HR inspiration copy.',
            }),
        },
        {
            id: 'onboarding-task-api',
            title: 'Onboarding task API',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#428-onboarding-tasks-need-an-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('onboarding-task-api'),
                appName: 'OnboardingTask API',
            }),
        },
        {
            id: 'onboarding-owner-nudge-worker',
            title: 'Onboarding owner nudge worker',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#429-nudge-owners-before-new-hires-get-stuck',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('onboarding-owner-nudge-worker'),
                appName: 'OwnerNudge Worker',
            }),
        },
        {
            id: 'photographer-inquiry-site',
            title: 'Photographer inquiry site',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#430-a-photographer-needs-a-site-by-tonight',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('photographer-inquiry-site'),
                appName: 'StillHour Studio',
                productType: 'photographer inquiry and services site',
                productBrief: 'StillHour Studio presents weddings, portraits, pricing starting points, availability cues, inquiry path, proof, and restrained image placeholders without cheesy booking theater.',
            }),
        },
        {
            id: 'photo-inquiry-api',
            title: 'Photo inquiry API',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#431-photo-inquiries-need-sorting',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('photo-inquiry-api'),
                appName: 'PhotoInquiry API',
            }),
        },
        {
            id: 'photo-followup-worker',
            title: 'Photo followup worker',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#432-follow-up-without-sounding-desperate',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('photo-followup-worker'),
                appName: 'PhotoFollowup Worker',
            }),
        },
        {
            id: 'hoa-notice-site',
            title: 'HOA notice site',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#433-the-hoa-website-starts-fights',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('hoa-notice-site'),
                appName: 'BoardPlain HOA',
                productType: 'HOA rules and notices site',
                productBrief: 'BoardPlain HOA keeps rules, notices, meeting dates, board contacts, maintenance request paths, and recent changes boring, clear, and low-drama.',
            }),
        },
        {
            id: 'hoa-request-api',
            title: 'HOA request API',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#434-hoa-requests-need-tracking',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('hoa-request-api'),
                appName: 'HOARequest API',
            }),
        },
        {
            id: 'hoa-meeting-reminder-worker',
            title: 'HOA meeting reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#435-meeting-reminders-should-not-spam-everyone',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('hoa-meeting-reminder-worker'),
                appName: 'HOAMeetingNudge Worker',
            }),
        },
        {
            id: 'b2b-api-trust-site',
            title: 'B2B API trust site',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#436-a-b2b-integration-page-that-engineers-trust',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('b2b-api-trust-site'),
                appName: 'EndpointProof',
                productType: 'B2B API evaluation site',
                productBrief: 'EndpointProof helps engineers evaluate an API with auth overview, rate limits, webhook cues, support paths, checklist, and technical trust signals without vague SaaS fluff.',
            }),
        },
        {
            id: 'api-key-governance-api',
            title: 'API key governance API',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#437-api-keys-need-basic-governance',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('api-key-governance-api'),
                appName: 'APIKeyLedger API',
            }),
        },
        {
            id: 'webhook-retry-worker',
            title: 'Webhook retry worker',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#438-webhook-retries-are-invisible',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('webhook-retry-worker'),
                appName: 'WebhookRetry Worker',
            }),
        },
        {
            id: 'board-risk-dashboard',
            title: 'Board risk dashboard',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#439-the-board-wants-a-risk-register-not-a-bi-project',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('board-risk-dashboard'),
                appName: 'RiskBrief',
                productType: 'board risk register dashboard',
                productBrief: 'RiskBrief gives leaders one screen for top risks, severity, owners, due dates, mitigation, weekly changes, and actions without becoming a BI project.',
            }),
        },
        {
            id: 'risk-register-api',
            title: 'Risk register API',
            storyPath: 'agents/training-scenarios/user_stories/421-440-real-world-friction-user-stories.md#440-risk-items-need-an-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('risk-register-api'),
                appName: 'RiskRegister API',
            }),
        },
        {
            id: 'vet-clinic-clarity-site',
            title: 'Vet clinic clarity site',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#461-the-vet-clinic-site-makes-people-call-for-everything',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('vet-clinic-clarity-site'),
                appName: 'PawPlain Clinic',
                productType: 'veterinary clinic information site',
                productBrief: 'PawPlain Clinic gives pet owners hours, services, urgent-care caveats, preparation notes, records request paths, and warm contact cues without fake booking or medical promises.',
            }),
        },
        {
            id: 'pet-record-request-api',
            title: 'Pet record request API',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#462-pet-records-are-in-email-threads',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('pet-record-request-api'),
                appName: 'PetRecords API',
            }),
        },
        {
            id: 'pet-record-followup-worker',
            title: 'Pet record followup worker',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#463-records-followups-need-not-vanish',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('pet-record-followup-worker'),
                appName: 'PetRecordNudge Worker',
            }),
        },
        {
            id: 'library-events-site',
            title: 'Library events site',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#464-a-library-needs-a-practical-events-page',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('library-events-site'),
                appName: 'ShelfEvents',
                productType: 'library events information site',
                productBrief: 'ShelfEvents organizes library programs by audience, date, room, accessibility notes, signup caveats, and contact paths without fake ticketing.',
            }),
        },
        {
            id: 'library-room-request-api',
            title: 'Library room request API',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#465-room-bookings-need-basic-order',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('library-room-request-api'),
                appName: 'RoomRequest API',
            }),
        },
        {
            id: 'library-setup-reminder-worker',
            title: 'Library setup reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#466-equipment-reminders-should-be-quiet',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('library-setup-reminder-worker'),
                appName: 'SetupNudge Worker',
            }),
        },
        {
            id: 'dental-plan-site',
            title: 'Dental plan site',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#467-the-dental-plan-page-is-too-confusing',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('dental-plan-site'),
                appName: 'SmilePlan Plain',
                productType: 'dental membership plan explainer',
                productBrief: 'SmilePlan Plain explains included care, exclusions, pricing caveats, FAQs, and contact paths with compliance-friendly copy and no fake enrollment payment.',
            }),
        },
        {
            id: 'dental-plan-inquiry-api',
            title: 'Dental plan inquiry API',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#468-plan-questions-need-tracking',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('dental-plan-inquiry-api'),
                appName: 'PlanInquiry API',
            }),
        },
        {
            id: 'dental-plan-followup-worker',
            title: 'Dental plan followup worker',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#469-plan-followups-should-be-safe',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('dental-plan-followup-worker'),
                appName: 'PlanFollowup Worker',
            }),
        },
        {
            id: 'manufacturer-capability-site',
            title: 'Manufacturer capability site',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#470-a-small-manufacturer-needs-a-capability-page',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('manufacturer-capability-site'),
                appName: 'ForgeSpec',
                productType: 'small manufacturer capability site',
                productBrief: 'ForgeSpec presents capabilities, materials, tolerances, lead-time caveats, quote paths, proof, and practical B2B language without industrial buzzwords.',
            }),
        },
        {
            id: 'manufacturing-quote-api',
            title: 'Manufacturing quote API',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#471-quotes-need-a-source-of-truth',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('manufacturing-quote-api'),
                appName: 'QuoteSpec API',
            }),
        },
        {
            id: 'quote-due-worker',
            title: 'Quote due worker',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#472-quote-owners-forget-due-dates',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('quote-due-worker'),
                appName: 'QuoteNudge Worker',
            }),
        },
        {
            id: 'museum-exhibit-site-461',
            title: 'Museum exhibit site',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#473-a-museum-exhibit-page-needs-context',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('museum-exhibit-site-461'),
                appName: 'ExhibitPlain',
                productType: 'museum exhibit information site',
                productBrief: 'ExhibitPlain gives visitors dates, themes, highlights, accessibility, ticket caveats, visit information, and refined clear context without fake ticket checkout.',
            }),
        },
        {
            id: 'museum-loan-request-api',
            title: 'Museum loan request API',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#474-loan-requests-need-tracking',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('museum-loan-request-api'),
                appName: 'LoanRequest API',
            }),
        },
        {
            id: 'museum-loan-deadline-worker',
            title: 'Museum loan deadline worker',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#475-loan-deadlines-cannot-slip',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('museum-loan-deadline-worker'),
                appName: 'LoanNudge Worker',
            }),
        },
        {
            id: 'msp-service-site',
            title: 'MSP service site',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#476-an-msp-needs-a-service-page-that-is-not-terrible',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('msp-service-site'),
                appName: 'OpsHarbor IT',
                productType: 'managed IT service site',
                productBrief: 'OpsHarbor IT explains managed IT services, response-time caveats, onboarding, security basics, audit requests, and proof without overpromising cyber outcomes.',
            }),
        },
        {
            id: 'msp-ticket-api',
            title: 'MSP ticket API',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#477-client-tickets-need-a-lightweight-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('msp-ticket-api'),
                appName: 'MSPTicket API',
            }),
        },
        {
            id: 'msp-sla-worker',
            title: 'MSP SLA worker',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#478-sla-breaches-need-visibility',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('msp-sla-worker'),
                appName: 'SLANudge Worker',
            }),
        },
        {
            id: 'investor-update-site',
            title: 'Investor update site',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#479-a-founder-needs-a-clean-investor-update-page',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('investor-update-site'),
                appName: 'UpdateBrief',
                productType: 'investor update page',
                productBrief: 'UpdateBrief presents monthly metrics, wins, risks, asks, runway caveats, and owner notes in a restrained private-ish page without pretending to provide auth.',
            }),
        },
        {
            id: 'investor-update-api',
            title: 'Investor update API',
            storyPath: 'agents/training-scenarios/user_stories/461-480-real-world-constraint-user-stories.md#480-investor-updates-need-an-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('investor-update-api'),
                appName: 'InvestorUpdate API',
            }),
        },
        {
            id: 'funeral-first-steps-site',
            title: 'Funeral first steps site',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#501-the-funeral-home-site-feels-like-a-sales-funnel',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('funeral-first-steps-site'),
                appName: 'QuietSteps',
                productType: 'funeral home first steps site',
                productBrief: 'QuietSteps gives families first steps, service options, price caveats, document checklists, contact paths, and respectful accessibility-minded copy without sales pressure.',
            }),
        },
        {
            id: 'arrangement-request-api',
            title: 'Arrangement request API',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#502-arrangements-are-tracked-on-paper',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('arrangement-request-api'),
                appName: 'ArrangementRequest API',
            }),
        },
        {
            id: 'arrangement-document-worker',
            title: 'Arrangement document worker',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#503-document-followups-must-be-gentle',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('arrangement-document-worker'),
                appName: 'ArrangementNudge Worker',
            }),
        },
        {
            id: 'yoga-studio-practical-site',
            title: 'Yoga studio practical site',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#504-the-yoga-studio-page-is-pretty-but-useless',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('yoga-studio-practical-site'),
                appName: 'MatPlain Studio',
                productType: 'yoga studio class information site',
                productBrief: 'MatPlain Studio shows class levels, schedule cues, what to bring, pricing caveats, beginner paths, teacher contacts, and calm concrete copy without fake booking.',
            }),
        },
        {
            id: 'class-interest-api',
            title: 'Class interest API',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#505-class-interest-needs-sorting',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('class-interest-api'),
                appName: 'ClassInterest API',
            }),
        },
        {
            id: 'studio-waitlist-worker',
            title: 'Studio waitlist worker',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#506-waitlist-nudges-should-not-be-weird',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('studio-waitlist-worker'),
                appName: 'StudioWaitlist Worker',
            }),
        },
        {
            id: 'farm-stand-weekend-site',
            title: 'Farm stand weekend site',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#507-a-farm-stand-needs-a-site-before-weekend',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('farm-stand-weekend-site'),
                appName: 'FieldBox Stand',
                productType: 'farm stand availability site',
                productBrief: 'FieldBox Stand gives local shoppers produce availability, hours, parking, seasonal notes, box reservation caveats, and contact paths without fake ecommerce.',
            }),
        },
        {
            id: 'produce-reservation-api',
            title: 'Produce reservation API',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#508-produce-reservations-need-tracking',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('produce-reservation-api'),
                appName: 'ProduceReservation API',
            }),
        },
        {
            id: 'pickup-window-worker',
            title: 'Pickup window worker',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#509-pickup-reminders-should-be-safe',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('pickup-window-worker'),
                appName: 'PickupNudge Worker',
            }),
        },
        {
            id: 'security-consulting-site',
            title: 'Security consulting site',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#510-a-security-consultant-needs-a-serious-services-page',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('security-consulting-site'),
                appName: 'ScopeShield',
                productType: 'security consulting services site',
                productBrief: 'ScopeShield explains assessments, deliverables, timelines, exclusions, scoped-call paths, and proof without fear marketing or exaggerated security claims.',
            }),
        },
        {
            id: 'assessment-request-api',
            title: 'Assessment request API',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#511-assessment-requests-need-an-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('assessment-request-api'),
                appName: 'AssessmentRequest API',
            }),
        },
        {
            id: 'scoped-call-followup-worker',
            title: 'Scoped call followup worker',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#512-follow-up-on-scoped-calls',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('scoped-call-followup-worker'),
                appName: 'ScopedCallNudge Worker',
            }),
        },
        {
            id: 'daycare-parent-info-site',
            title: 'Daycare parent info site',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#513-a-daycare-needs-calm-parent-info',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('daycare-parent-info-site'),
                appName: 'LittleHarbor Care',
                productType: 'daycare parent information site',
                productBrief: 'LittleHarbor Care explains age groups, daily rhythm, meals, pickup rules, cost caveats, openings inquiry paths, and trust cues without fake enrollment.',
            }),
        },
        {
            id: 'daycare-waitlist-api',
            title: 'Daycare waitlist API',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#514-openings-need-a-waitlist-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('daycare-waitlist-api'),
                appName: 'DaycareWaitlist API',
            }),
        },
        {
            id: 'daycare-waitlist-worker',
            title: 'Daycare waitlist worker',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#515-waitlist-followups-need-boundaries',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('daycare-waitlist-worker'),
                appName: 'DaycareWaitlistNudge Worker',
            }),
        },
        {
            id: 'theatre-show-site',
            title: 'Theatre show site',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#516-a-local-theatre-needs-a-show-page',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('theatre-show-site'),
                appName: 'StagePlain',
                productType: 'local theatre show page',
                productBrief: 'StagePlain shows dates, venue, accessibility, cast notes, ticket caveats, contact paths, sponsor and volunteer cues with lively but uncluttered design.',
            }),
        },
        {
            id: 'volunteer-shift-api',
            title: 'Volunteer shift API',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#517-volunteer-shifts-need-tracking',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('volunteer-shift-api'),
                appName: 'VolunteerShift API',
            }),
        },
        {
            id: 'shift-reminder-worker',
            title: 'Shift reminder worker',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#518-shift-reminders-should-not-spam',
            kind: 'redis',
            tool: 'scaffoldFastifyWorkerRedisApp',
            maxElapsedMs: 6 * 1000,
            run: () => scaffoldFastifyWorkerRedisApp({
                targetDir: rel('shift-reminder-worker'),
                appName: 'ShiftNudge Worker',
            }),
        },
        {
            id: 'tiny-saas-changelog-site',
            title: 'Tiny SaaS changelog site',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#519-a-tiny-saas-needs-a-changelog-people-read',
            kind: 'next',
            tool: 'scaffoldNextjsDockerApp',
            maxElapsedMs: 50 * 1000,
            run: () => scaffoldNextjsDockerApp({
                targetDir: rel('tiny-saas-changelog-site'),
                appName: 'ChangeTiny',
                productType: 'product changelog page',
                productBrief: 'ChangeTiny presents releases, fixes, known issues, upcoming work, filters, and concise product language without becoming a marketing blog.',
            }),
        },
        {
            id: 'changelog-item-api',
            title: 'Changelog item API',
            storyPath: 'agents/training-scenarios/user_stories/501-520-real-world-compression-user-stories.md#520-changelog-items-need-an-api',
            kind: 'postgres',
            tool: 'scaffoldFastifyPostgresApp',
            maxElapsedMs: 5 * 1000,
            run: () => scaffoldFastifyPostgresApp({
                targetDir: rel('changelog-item-api'),
                appName: 'ChangelogItem API',
            }),
        },
    ]

    const selectedCases = casePattern
        ? cases.filter((scenario) => casePattern.test(scenario.id) || casePattern.test(scenario.storyPath) || casePattern.test(scenario.title))
        : cases
    if (casePattern && selectedCases.length === 0) {
        throw new Error(`No user story smoke cases matched ${casePattern}`)
    }

    const results: CaseResult[] = []

    for (const scenario of selectedCases) {
        const startedAt = Date.now()
        const toolResult = await scenario.run() as ToolResult
        const absolutePath = path.resolve(smokeRoot, toolResult.targetDir || rel(scenario.id))
        const verification = await verifyProject(absolutePath, scenario.kind, toolResult.exitCode === 0)
        const elapsedMs = Date.now() - startedAt
        const checks = {
            ...verification.checks,
            elapsedWithinBudget: elapsedMs <= (scenario.maxElapsedMs || elapsedBudget(scenario.kind)),
            toolSucceeded: toolResult.exitCode === 0,
        }
        results.push({
            id: scenario.id,
            title: scenario.title,
            tool: scenario.tool,
            storyPath: scenario.storyPath,
            ok: Object.values(checks).every(Boolean),
            elapsedMs,
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
        selectedCasePattern: casePattern?.source || null,
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
