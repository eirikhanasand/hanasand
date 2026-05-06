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

async function wordCount(filePath: string) {
    const content = await fs.readFile(filePath, 'utf8').catch(() => '')
    return content.trim().split(/\s+/).filter(Boolean).length
}

function elapsedBudget(kind: ScenarioKind) {
    if (kind === 'next') {
        return 145 * 1000
    }
    if (kind === 'postgres') {
        return 22 * 1000
    }
    return 26 * 1000
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
    ]

    const results: CaseResult[] = []

    for (const scenario of cases) {
        const startedAt = Date.now()
        const toolResult = await scenario.run() as ToolResult
        const absolutePath = path.resolve(smokeRoot, toolResult.targetDir || rel(scenario.id))
        const verification = await verifyProject(absolutePath, scenario.kind)
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
