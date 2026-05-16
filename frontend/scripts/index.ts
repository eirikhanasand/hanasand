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
        id: 'upload-limit',
        title: 'Upload proxy limit contract',
        command: [bun, 'scripts/check-upload-proxy-limit.mjs'],
    },
    {
        id: 'ai-hooks',
        title: 'AI hook startup contract',
        command: [bun, 'scripts/check-ai-hooks.mjs'],
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
