import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type TestTask = {
    id: string
    title: string
    command: string[]
    env?: Record<string, string>
    requires?: 'server' | 'database' | 'network' | 'playwright'
    guardProductionSmoke?: boolean
    inlineModule?: string
}

const bun = process.execPath
const scriptDir = path.dirname(fileURLToPath(import.meta.url))

const coreTasks: TestTask[] = [
    scriptTask('notes-unit', 'Notes unit contract', 'smoke-notes.ts'),
    scriptTask('roles-unit', 'Role permission contract', 'smoke-role-permissions.ts'),
    scriptTask('user-delete-unit', 'User delete contract', 'smoke-user-delete-contract.ts'),
    scriptTask('ai-stack-contracts', 'AI stack detection contract', 'smoke-ai-stack-contracts.ts'),
    scriptTask('ai-metrics-readiness', 'AI metrics readiness contract', 'smoke-ai-metrics-readiness.ts'),
    scriptTask('ai-deploy-defaults', 'AI deploy defaults contract', 'smoke-ai-deploy-defaults.ts'),
    scriptTask('ai-action-policy', 'AI action policy contract', 'smoke-ai-action-policy.ts'),
    scriptTask('ai-repo-credentials', 'AI repository credential encryption contract', 'smoke-ai-repo-credentials.ts'),
    scriptTask('alert-automations', 'Alert automation contract', 'smoke-alert-automations.ts'),
    scriptTask('app-update', 'Desktop app update contract', 'smoke-app-update.ts'),
    scriptTask('mail-overview-timeout', 'Mail overview timeout contract', 'smoke-mail-overview-timeout.ts'),
    scriptTask('pwned-check', 'Pwned password dataset contract', 'smoke-pwned-check.ts'),
    scriptTask('db-overview', 'Database overview contract', 'smoke-db-overview.ts'),
    scriptTask('traffic-live', 'Traffic live stream contract', 'smoke-traffic-live.ts'),
    scriptTask('scheduled-job-registry', 'Scheduled job registry guardrail', 'check-scheduled-job-registry.ts'),
    scriptTask('scheduled-job-registry-smoke', 'Scheduled job registry smoke', 'smoke-scheduled-job-registry.ts'),
    scriptTask('vulnerability-scanner', 'Vulnerability scanner registry contract', 'smoke-vulnerability-scanner.ts'),
    scriptTask('git-import-parser', 'Git import parser contract', 'smoke-git-import-parser.ts'),
    scriptTask('ai-runtime-contract', 'AI runtime contract', 'validate-ai-runtime-contract.ts'),
    scriptTask('lxd-lifecycle', 'LXD lifecycle contract', 'test-lxd-lifecycle.ts'),
    scriptTask('browser-sandbox-profiles', 'Browser sandbox profile persistence contract', 'smoke-browser-sandbox-profiles.ts'),
    scriptTask('browser-sandbox-analysis', 'Browser sandbox analysis contract', 'smoke-browser-sandbox-analysis.ts'),
    scriptTask('browser-session-worker', 'Browser per-session worker isolation contract', 'smoke-browser-session-worker-contract.ts'),
    scriptTask('browser-egress-firewall', 'Browser egress firewall contract', 'smoke-browser-egress-firewall-contract.ts'),
    {
        ...scriptTask('browser-sandbox-broker', 'Browser sandbox broker runtime contract', 'smoke-browser-sandbox-broker.ts'),
        requires: 'playwright',
    },
]

const environmentTasks: TestTask[] = [
    guardedTask('rate-limits', 'Rate-limit API smoke', 'smoke-rate-limits.mjs', 'database'),
    guardedTask('notes', 'Notes API smoke', 'smoke-notes.mjs', 'database'),
    guardedTask('impersonation-production', 'Impersonation production contract', 'smoke-impersonation-production.ts', 'database'),
    guardedTask('impersonation-regression', 'Impersonation regression smoke', 'smoke-impersonation-regression.mjs', 'database'),
    guardedTask('vm-targets', 'VM target smoke', 'smoke-vm-agent-targets.mjs', 'database'),
    guardedTask('vm-request-bridge', 'VM request bridge smoke', 'smoke-vm-request-bridge.mjs', 'database'),
    guardedTask('ai-collaboration', 'AI collaboration smoke', 'smoke-ai-collaboration.mjs', 'database'),
    guardedTask('ai-ownership', 'AI ownership smoke', 'smoke-ai-ownership.mjs', 'database'),
    guardedTask('ai-quotas', 'AI quota smoke', 'smoke-ai-quotas.mjs', 'database'),
    guardedTask('ai-deployments', 'AI deployments smoke', 'smoke-ai-deployments.mjs', 'database'),
    guardedTask('automations', 'Automation smoke', 'smoke-automations.mjs', 'server'),
    guardedTask('git-import-complaints', 'Git import complaint e2e', 'e2e-git-import-complaints.ts', 'network'),
    {
        ...guardedTask('inspur-model-client', 'Inspur model client websocket smoke', 'smoke-inspur-model-client.mjs', 'network'),
        inlineModule: 'smoke-inspur-model-client.mjs',
    },
]

const storyTasks = await discoverStoryContractTasks()
const playwrightTasks = await discoverPlaywrightTasks()
const tasks = [...coreTasks, ...storyTasks, ...environmentTasks, ...playwrightTasks]
const selected = parseOnly()
const runnable = tasks.filter(task => selected.size ? selected.has(task.id) : shouldRunByDefault(task))

if (!runnable.length) {
    throw new Error(`No API test tasks selected. Known tasks: ${tasks.map(task => task.id).join(', ')}`)
}

for (const task of runnable) {
    await runTask(task)
}

function scriptTask(id: string, title: string, scriptName: string): TestTask {
    return {
        id,
        title,
        command: [bun, `scripts/${scriptName}`],
    }
}

function guardedTask(id: string, title: string, scriptName: string, requires: TestTask['requires']): TestTask {
    return {
        ...scriptTask(id, title, scriptName),
        requires,
        guardProductionSmoke: true,
    }
}

async function discoverStoryContractTasks() {
    const files = await readdir(scriptDir)
    return files
        .filter(file => file.startsWith('smoke-share-chat-') && file.endsWith('.ts'))
        .sort()
        .map(file => scriptTask(file.replace(/\.(mjs|ts)$/, ''), `Share chat story contract: ${file}`, file))
}

async function discoverPlaywrightTasks() {
    const files = await readdir(scriptDir)
    return files
        .filter(file => file.includes('playwright') && file.endsWith('.ts'))
        .sort()
        .map(file => ({
            ...scriptTask(file.replace(/\.ts$/, ''), `Playwright scenario: ${file}`, file),
            requires: 'playwright' as const,
        }))
}

function shouldRunByDefault(task: TestTask) {
    if (task.requires === 'database') return process.env.RUN_DB_TESTS === '1'
    if (task.requires === 'server') return process.env.RUN_SERVER_TESTS === '1'
    if (task.requires === 'network') return process.env.RUN_NETWORK_TESTS === '1'
    if (task.requires === 'playwright') return process.env.RUN_E2E === '1' || process.env.RUN_PLAYWRIGHT === '1'
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

async function runTask(task: TestTask) {
    console.log(`\n[api:test] ${task.title}`)
    await runCommand(task.guardProductionSmoke
        ? { ...task, id: `${task.id}:guard`, command: [bun, 'scripts/guard-production-smoke.mjs'] }
        : null)

    if (task.inlineModule) {
        await import(pathToFileURL(path.join(scriptDir, task.inlineModule)).href)
        return
    }

    await runCommand(task)
}

function runCommand(task: TestTask | null) {
    if (!task) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
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
