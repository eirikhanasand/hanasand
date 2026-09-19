import { spawn } from 'node:child_process'

type TestTask = {
    id: string
    title: string
    command: string[]
    env?: Record<string, string>
    requires?: 'server' | 'playwright'
}

const bun = process.execPath

const tasks: TestTask[] = [
    { id: 'logs-catchup', title: 'Log catch-up measurements and progress states', command: [bun, 'test', 'tests/log-catchup-progress.test.tsx'] },
    { id: 'support-proxy', title: 'Anonymous support session and origin protection', command: [bun, 'test', 'tests/support-proxy.test.ts'] },
    { id: 'support-ui', title: 'AI support, human handoff and internal queue layout', command: [bun, 'x', 'playwright', 'test', 'tests/support-ai.spec.ts', 'tests/support-layout.spec.ts', '--workers=2'], requires: 'playwright' },
    { id: 'vm-console-start', title: 'Console startup and permission failures', command: [bun, 'test', 'tests/vm-console-start.test.ts'] },
    { id: 'logs-ui', title: 'Log severity, search, inline evidence and realtime reader', command: [bun, 'x', 'playwright', 'test', 'tests/realtime-logs.spec.ts', 'tests/logs-ux-triage.spec.ts', '--workers=1'], env: { PLAYWRIGHT_MANAGED_SERVERS: '0' }, requires: 'playwright' },
    { id: 'logs-pages', title: 'Logs routes on desktop/mobile in light/dark mode', command: [bun, 'scripts/check-dashboard-logs-ui.mjs'], requires: 'playwright' },
    { id: 'role-management', title: 'Role priority and icon editor', command: [bun, 'scripts/check-role-management.mjs'], requires: 'playwright' },
    { id: 'helpdesk-render', title: 'Helpdesk audit rendering and focus filters', command: [bun, 'tests/helpdesk-render.test.tsx'] },
    { id: 'share-statistics', title: 'Share line counts and empty statistics', command: [bun, 'test', 'tests/share-statistics.test.tsx'] },
    { id: 'content-pages', title: 'Article dates and thoughts copy', command: [bun, 'tests/content-pages.test.tsx'] },
    { id: 'workspace-organization-browser', title: 'Global organization switcher and shared links', command: [bun, 'scripts/check-workspace-organization.mjs'], requires: 'playwright' },
    { id: 'workspace-organization', title: 'Shared organization scope and cookie authorization', command: [bun, 'test', 'tests/workspace-organization.test.ts'] },
    { id: 'incident-updates', title: 'Meaningful incident timeline updates', command: [bun, 'test', 'scripts/check-incident-updates.test.mjs'] },
    { id: 'dashboard-overview-server', title: 'Dashboard monitoring server rendering', command: [bun, 'test', 'tests/dashboard-overview-server.test.ts'] },
    { id: 'service-account-boundary', title: 'Scoped service account browser access', command: [bun, 'tests/service-account-boundary.test.ts'] },
    { id: 'numbered-pagination', title: 'Numbered page navigation', command: [bun, 'test', 'tests/numbered-pagination.test.tsx'] },
    { id: 'source-status', title: 'Source activation authorization and persistence contract', command: [bun, 'test', 'tests/ti-source-status.test.mjs'] },
    { id: 'source-activation', title: 'Source activation controls', command: [bun, 'scripts/check-source-activation.mjs'], requires: 'playwright' },
    { id: 'traffic-locations', title: 'Recorded traffic locations', command: [bun, 'tests/traffic-locations.test.ts'] },
    { id: 'traffic-stream-proxy', title: 'Traffic live stream proxy', command: [bun, 'tests/traffic-stream-proxy.test.ts'] },
    { id: 'traffic-streaming', title: 'Traffic independent loading', command: [bun, 'tests/traffic-streaming.test.tsx'] },
    { id: 'browser-workspace', title: 'Browser workspace interaction and layout', command: [bun, 'scripts/check-browser-workspace.mjs'], requires: 'playwright' },
    { id: 'session-revoke', title: 'Session revoke interactions', command: [bun, 'scripts/check-session-revoke.mjs'], requires: 'playwright' },
    { id: 'session-requests', title: 'Session revocation requests', command: [bun, 'scripts/check-session-requests.ts'] },
    { id: 'session-details', title: 'Login session device and forwarding details', command: [bun, 'scripts/check-session-details.ts'] },
    { id: 'social-proxy', title: 'Google and Apple callback boundaries', command: [bun, 'scripts/check-social-proxy.ts'] },
    { id: 'health-check-sorting', title: 'Health check column sorting', command: [bun, 'test', 'tests/health-check-sorting.test.ts'] },
    { id: 'vm-member-access', title: 'Member VM creation and host telemetry permissions', command: [bun, 'scripts/check-vm-member-access.mjs'], requires: 'playwright' },
    { id: 'password-policy', title: 'Password requirements', command: [bun, 'test', 'tests/password-policy.test.ts'] },
    { id: 'timetable', title: 'Dated timetable activity totals and persistence', command: [bun, 'test', 'tests/timetable.test.ts'] },
    { id: 'code-access', title: 'Code access sessions and login limits', command: [bun, 'test', 'tests/code-access.test.ts'] },
    { id: 'thesis-workspace', title: 'Thesis table text, formulas and persistence', command: [bun, 'test', 'tests/workspace.test.ts'] },
    { id: 'table-navigation', title: 'Temporary table edges and formula preservation', command: [bun, 'test', 'tests/table-navigation.test.ts'] },
    { id: 'code-inventory', title: 'Source inventory and dependency hashes', command: [bun, 'test', 'tests/code-inventory.test.mjs'] },
    { id: 'code-review-state', title: 'Code review status and sheet settings', command: [bun, 'test', 'tests/code-review-state.test.ts'] },
    { id: 'api-response-examples', title: 'API fictional response examples and OpenAPI navigation', command: [bun, 'tests/api-response-examples.test.tsx'] },
    { id: 'organization-initial-render', title: 'Organization layout before hydration', command: [bun, 'tests/organization-initial-render.test.tsx'] },
    { id: 'organization-pages', title: 'Organization and account pages', command: [bun, 'scripts/check-organization-pages.mjs'], requires: 'playwright' },
    { id: 'dashboard-streaming', title: 'Dashboard independent status streaming', command: [bun, 'tests/dashboard-streaming.test.tsx'] },
    { id: 'recovery-boundary', title: 'Recovery request boundaries', command: [bun, 'tests/recovery-boundary.test.ts'] },
    { id: 'resilience-ui', title: 'Recovery status and failback UI', command: [bun, 'scripts/check-resilience-ui.mjs'], requires: 'playwright' },
    {
        id: 'automation-ssr',
        title: 'Automation server rendering and hydration',
        command: [bun, 'scripts/check-automation-ssr.mjs'],
        requires: 'playwright',
    },
    {
        id: 'auth-validation-resilience',
        title: 'Authentication failure and recovery',
        command: [bun, 'tests/auth-validation-resilience.test.ts'],
    },
    {
        id: 'auth-recovery-browser',
        title: 'Authentication recovery in browser',
        command: [bun, 'scripts/check-auth-recovery.mjs'],
        requires: 'playwright',
    },
    {
        id: 'automation-routes',
        title: 'Automation route regression',
        command: [bun, 'scripts/check-automation-routes.mjs'],
    },
    {
        id: 'dashboard-navigation',
        title: 'Dashboard navigation interactions',
        command: [bun, 'scripts/check-dashboard-navigation.mjs'],
        requires: 'playwright',
    },
    {
        id: 'dashboard-sidebar-shell',
        title: 'Dashboard sidebar shell contract',
        command: [bun, 'scripts/check-dashboard-sidebar-shell.mjs'],
    },
    {
        id: 'status-traffic',
        title: 'Status traffic contract',
        command: [bun, 'scripts/check-status-traffic.mjs'],
    },
    {
        id: 'article-fallback',
        title: 'Article fallback contract',
        command: [bun, 'scripts/check-article-fallback.mjs'],
    },
    {
        id: 'customer-operational-copy',
        title: 'Customer operational copy guard',
        command: [bun, 'scripts/check-customer-operational-copy.mjs'],
    },
    {
        id: 'upload-limit',
        title: 'Upload proxy limit contract',
        command: [bun, 'scripts/check-upload-proxy-limit.mjs'],
    },
    {
        id: 'database-dashboard-render',
        title: 'Database dashboard render contract',
        command: [bun, 'scripts/check-database-dashboard-render.ts'],
    },
    {
        id: 'pwned-proxy-route',
        title: 'Pwned proxy route contract',
        command: [bun, 'scripts/check-pwned-proxy-route.ts'],
    },
    {
        id: 'pwned-result-presentation',
        title: 'Pwned result presentation contract',
        command: [bun, 'scripts/check-pwned-result-presentation.ts'],
    },
    {
        id: 'ai-hooks',
        title: 'AI hook startup contract',
        command: [bun, 'scripts/check-ai-hooks.mjs'],
    },
    {
        id: 'backup-operations',
        title: 'Backup operations page contract',
        command: [bun, 'scripts/check-backup-operations.ts'],
    },
    {
        id: 'vulnerability-dashboard',
        title: 'Vulnerability dashboard contract',
        command: [bun, 'scripts/check-vulnerability-dashboard.ts'],
    },
    {
        id: 'service-check-ti-landing',
        title: 'Service check and TI landing UX contract',
        command: [bun, 'scripts/check-service-check-ti-landing.mjs'],
    },
    {
        id: 'shared-exposure-activity',
        title: 'Shared exposure activity',
        command: [bun, 'scripts/check-shared-exposure-activity.ts'],
    },
    {
        id: 'ti-actor-intelligence',
        title: 'TI actor intelligence shaping',
        command: [bun, 'scripts/check-ti-actor-intelligence.ts'],
    },
    {
        id: 'ti-varnish-freshness',
        title: 'TI public cache freshness',
        command: [bun, 'scripts/check-ti-varnish-freshness.mjs'],
    },
    {
        id: 'dwm-analyst-brief',
        title: 'DWM analyst brief',
        command: [bun, 'scripts/check-dwm-analyst-brief.mjs'],
    },
    {
        id: 'organization-customer-boundaries',
        title: 'Organization customer boundaries',
        command: [bun, 'test', 'tests/organization-customer-boundaries.test.mjs'],
    },
    {
        id: 'browser-report-evidence',
        title: 'Browser report evidence contract',
        command: [bun, 'scripts/check-browser-report-evidence.mjs'],
    },
    {
        id: 'public-archive',
        title: 'Public archive route smoke',
        command: [bun, 'scripts/check-public-archive.mjs'],
        requires: 'server',
    },
    {
        id: 'e2e',
        title: 'Playwright full smoke',
        command: [bun, 'scripts/run-playwright-status.mjs'],
        requires: 'playwright',
    },
    {
        id: 'e2e-auth',
        title: 'Playwright auth smoke',
        command: [bun, 'scripts/run-playwright-status.mjs', 'tests/auth.spec.ts'],
        requires: 'playwright',
    },
    {
        id: 'e2e-mail',
        title: 'Playwright mail smoke',
        command: [bun, 'scripts/run-playwright-status.mjs', 'tests/mail.spec.ts'],
        env: { PLAYWRIGHT_STATUS_CHECK_NAME: 'Playwright mail workspace' },
        requires: 'playwright',
    },
    {
        id: 'e2e-ai',
        title: 'Playwright AI smoke',
        command: [bun, 'scripts/run-playwright-status.mjs', 'tests/ai-workspace.spec.ts'],
        env: { PLAYWRIGHT_STATUS_CHECK_NAME: 'Playwright AI workspace' },
        requires: 'playwright',
    },
]

const selected = parseOnly()
const includeServer = process.env.RUN_SERVER_TESTS === '1'
const includePlaywright = process.env.RUN_E2E === '1' || process.env.RUN_PLAYWRIGHT === '1'
const runnable = tasks.filter(task => selected.size ? selected.has(task.id) : shouldRunByDefault(task))

if (!runnable.length) {
    throw new Error(`No frontend test tasks selected. Known tasks: ${tasks.map(task => task.id).join(', ')}`)
}

for (const task of runnable) {
    if (task.requires === 'server' && !includeServer && !selected.has(task.id)) {
        continue
    }
    if (task.requires === 'playwright' && !includePlaywright && !selected.has(task.id)) {
        continue
    }

    await runTask(task)
}

function shouldRunByDefault(task: TestTask) {
    if (task.requires === 'server') return includeServer
    if (task.requires === 'playwright') return includePlaywright
    return true
}

function parseOnly() {
    const ids = new Set<string>()
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--only=')) {
            for (const id of arg.slice('--only='.length).split(',')) {
                if (id.trim()) ids.add(id.trim())
            }
        }
    }
    return ids
}

function runTask(task: TestTask) {
    return new Promise<void>((resolve, reject) => {
        console.log(`\n[frontend:test] ${task.title}`)
        const [command, ...args] = task.command
        const child = spawn(command, args, {
            cwd: process.cwd(),
            env: { ...process.env, ...(task.env || {}) },
            stdio: 'inherit',
        })

        child.on('error', reject)
        child.on('exit', (code) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`${task.id} failed with exit code ${code}`))
        })
    })
}
