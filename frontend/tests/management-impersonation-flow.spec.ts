import { expect, test, type Browser, type Page } from '@playwright/test'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
let appRoot = root

type ImpersonationRequest = {
    target_id?: string
    reason?: string
    durationMinutes?: number
    scope?: string[]
    supportSessionId?: string
}

let apiServer: http.Server | null = null
let apiBase = ''
let appBase = ''
let nextProcess: ChildProcessWithoutNullStreams | null = null
let nextOutput = ''
let impersonationRequests: ImpersonationRequest[] = []
let failNextImpersonation = false

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

test.beforeAll(async () => {
    apiServer = await startMockApi()
    const apiAddress = apiServer.address()
    if (!apiAddress || typeof apiAddress === 'string') throw new Error('Mock API did not bind to a TCP port.')
    apiBase = `http://127.0.0.1:${apiAddress.port}/api`

    const appPort = await openPort()
    appBase = `http://127.0.0.1:${appPort}`
    appRoot = prepareIsolatedNextRoot()
    nextProcess = spawn(process.execPath, [
        path.join(appRoot, 'node_modules/next/dist/bin/next'),
        'dev',
        '--webpack',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(appPort),
    ], {
        cwd: appRoot,
        env: {
            ...process.env,
            FRONTEND_INTERNAL_API: apiBase,
            NEXT_PUBLIC_API: apiBase,
            PORT: String(appPort),
        },
    })
    nextProcess.stdout.on('data', (chunk) => { nextOutput += String(chunk) })
    nextProcess.stderr.on('data', (chunk) => { nextOutput += String(chunk) })

    await waitForHttp(`${appBase}/login`, 90_000)
})

test.afterAll(async () => {
    if (nextProcess && nextProcess.exitCode === null) {
        nextProcess.kill()
        await Promise.race([
            new Promise<void>((resolve) => nextProcess?.once('exit', () => resolve())),
            new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
        ])
    }
    if (apiServer) {
        await new Promise<void>((resolve) => apiServer?.close(() => resolve()))
    }
    if (appRoot !== root) {
        try {
            rmSync(appRoot, { force: true, recursive: true })
        } catch {
            // Next can briefly hold compiled files after SIGTERM; stale temp roots are removed before the next run.
        }
    }
})

test.beforeEach(() => {
    impersonationRequests = []
    failNextImpersonation = false
})

test('opens reason prompt, blocks short reasons, and sends valid reason payload', async ({ browser }) => {
    const { context, page } = await openManagementPage(browser)
    try {
        const prompt = await openImpersonationPrompt(page)
        await expect(prompt.getByLabel('Reason for impersonating Target User')).toBeVisible()

        await prompt.getByRole('button', { name: 'Start session' }).click()
        await expect(prompt.getByText('Enter at least 10 characters')).toBeVisible()
        expect(impersonationRequests).toHaveLength(0)

        await prompt.getByPlaceholder('Describe the support case or audit reason').fill('Support case 1234 investigation')
        await prompt.getByRole('button', { name: 'Start session' }).click()

        await expect.poll(() => impersonationRequests.length).toBe(1)
        expect(impersonationRequests[0]).toMatchObject({
            target_id: 'target-user',
            reason: 'Support case 1234 investigation',
            durationMinutes: 30,
            scope: ['read_profile', 'read_org'],
        })
        await expect(prompt).toBeHidden()
        await expect(page.getByText('Impersonation reason must be at least 10 characters.')).toHaveCount(0)
    } finally {
        await context.close()
    }
})

test('shows backend errors without losing target or reason context', async ({ browser }) => {
    failNextImpersonation = true
    const { context, page } = await openManagementPage(browser)
    try {
        const prompt = await openImpersonationPrompt(page)
        const reasonInput = prompt.getByPlaceholder('Describe the support case or audit reason')
        await reasonInput.fill('Support case API failure')
        await prompt.getByRole('button', { name: 'Start session' }).click()

        await expect.poll(() => impersonationRequests.length).toBe(1)
        await expect(prompt).toBeVisible()
        await expect(prompt.getByText('Mock backend refused impersonation for audit review.')).toBeVisible()
        await expect(reasonInput).toHaveValue('Support case API failure')
        await expect(prompt.getByText('Reason for impersonating Target User')).toBeVisible()
    } finally {
        await context.close()
    }
})

async function openManagementPage(browser: Browser) {
    const context = await browser.newContext({ baseURL: appBase })
    await context.addCookies([
        { name: 'id', value: 'admin-user', url: appBase, expires: cookieExpiry(), sameSite: 'Lax' },
        { name: 'name', value: encodeURIComponent('Admin User'), url: appBase, expires: cookieExpiry(), sameSite: 'Lax' },
        { name: 'access_token', value: 'admin-token', url: appBase, expires: cookieExpiry(), sameSite: 'Lax' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify([{ id: 'administrator' }, { id: 'user_admin' }])), url: appBase, expires: cookieExpiry(), sameSite: 'Lax' },
    ])
    const page = await context.newPage()
    await page.goto('/dashboard/management', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'User management', exact: true })).toBeVisible()
    await expect(page.getByText('Target User')).toBeVisible()
    return { context, page }
}

async function openImpersonationPrompt(page: Page) {
    const button = page.getByRole('button', { name: 'Impersonate target-user' })
    const prompt = page.getByRole('form', { name: 'Impersonation reason for target-user' })
    await expect(button).toBeVisible()
    await button.click()
    if (!await prompt.isVisible().catch(() => false)) {
        await page.waitForTimeout(250)
        await button.click()
    }
    await expect(prompt).toBeVisible()
    return prompt
}

function prepareIsolatedNextRoot() {
    const isolatedRoot = path.join(os.tmpdir(), 'hanasand-management-impersonation-flow')
    rmSync(isolatedRoot, { force: true, recursive: true })
    mkdirSync(isolatedRoot, { recursive: true })

    for (const name of ['package.json', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs']) {
        const source = path.join(root, name)
        if (existsSync(source)) copyFileSync(source, path.join(isolatedRoot, name))
    }

    for (const name of ['src', 'public']) {
        const source = path.join(root, name)
        if (existsSync(source)) {
            cpSync(source, path.join(isolatedRoot, name), { recursive: true })
        }
    }

    symlinkSync(path.join(root, 'node_modules'), path.join(isolatedRoot, 'node_modules'), 'dir')
    return isolatedRoot
}

function cookieExpiry() {
    return Math.floor(Date.now() / 1000) + 3600
}

function startMockApi() {
    const server = http.createServer(async (request, response) => {
        try {
            await handleMockApi(request, response)
        } catch (error) {
            response.writeHead(500, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Mock API failed.' }))
        }
    })

    return new Promise<http.Server>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server))
    })
}

async function handleMockApi(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url || '/', apiBase || 'http://127.0.0.1/api')
    const pathName = url.pathname

    if (request.method === 'GET' && pathName === '/api/roles') {
        sendJson(response, [{
            id: 'administrator',
            name: 'Administrator',
            description: 'Full admin',
            priority: 0,
            created_by: 'system',
            created_at: '2026-07-03T00:00:00.000Z',
            updated_at: '2026-07-03T00:00:00.000Z',
        }])
        return
    }

    if (request.method === 'GET' && pathName === '/api/users') {
        sendJson(response, [
            {
                id: 'admin-user',
                name: 'Admin User',
                avatar: '',
                active: true,
                highest_role_id: 'administrator',
                highest_role_name: 'Administrator',
                highest_role_priority: 0,
            },
            {
                id: 'target-user',
                name: 'Target User',
                avatar: '',
                active: true,
                highest_role_id: 'member',
                highest_role_name: 'Member',
                highest_role_priority: 20,
            },
        ])
        return
    }

    if (request.method === 'GET' && (pathName === '/api/articles' || pathName === '/api/thoughts')) {
        sendJson(response, [])
        return
    }

    if (request.method === 'POST' && pathName === '/api/impersonation/start') {
        const body = await readJson<ImpersonationRequest>(request)
        impersonationRequests.push(body)
        if (failNextImpersonation) {
            failNextImpersonation = false
            sendJson(response, { error: 'Mock backend refused impersonation for audit review.' }, 400)
            return
        }

        sendJson(response, {
            token: 'mock-impersonation-token',
            session: {
                id: 'mock-session',
                target: { id: body.target_id, name: 'Target User' },
                reason: body.reason,
                duration_minutes: body.durationMinutes,
                scope: body.scope,
                expires_at: '2026-07-03T01:00:00.000Z',
            },
        })
        return
    }

    sendJson(response, [])
}

function sendJson(response: ServerResponse, body: unknown, status = 200) {
    response.writeHead(status, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(body))
}

async function readJson<T>(request: IncomingMessage) {
    const chunks: Buffer[] = []
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T
}

function openPort() {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer()
        server.on('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            if (!address || typeof address === 'string') {
                reject(new Error('Unable to allocate TCP port.'))
                return
            }
            const port = address.port
            server.close(() => resolve(port))
        })
    })
}

async function waitForHttp(url: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs
    let lastError = ''
    while (Date.now() < deadline) {
        if (nextProcess?.exitCode !== null) {
            throw new Error(`Next dev server exited early.\n${nextOutput}`)
        }
        try {
            const response = await fetch(url)
            if (response.status < 500) return
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error)
        }
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error(`Timed out waiting for ${url}: ${lastError}\n${nextOutput}`)
}
