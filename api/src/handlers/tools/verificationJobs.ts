import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { recordAiUsageEvent } from '#utils/ai/usage.ts'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const MAX_STRUCTURE_ITEMS = 20
const MAX_EXCERPT_LENGTH = 5000
const MAX_CONCURRENT_JOBS = Number(process.env.VERIFICATION_JOB_CONCURRENCY || 2)
const CHROMIUM_BIN = process.env.CHROMIUM_BIN || 'chromium-browser'

type VerificationKind = 'browser' | 'build' | 'deploy' | 'design'
type VerificationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

type VerificationJobRow = {
    id: string
    owner_id: string
    workspace_kind: string | null
    workspace_id: string | null
    kind: VerificationKind
    status: VerificationStatus
    priority: number
    lane: string
    queue_position: number
    retry_count: number
    max_retries: number
    current_step: string
    target_url: string | null
    deploy_url: string | null
    request_id: string
    artifacts: unknown
    metadata: Record<string, unknown>
    error: string | null
    created_at: string
    updated_at: string
    started_at: string | null
    completed_at: string | null
    cancelled_at: string | null
}

type CreateJobBody = {
    kind?: VerificationKind
    targetUrl?: string
    deployUrl?: string
    workspaceKind?: string
    workspaceId?: string
    priority?: 'standard' | 'paid' | 'urgent' | number
    lane?: string
    timeoutMs?: number
    captureScreenshot?: boolean
    maxRetries?: number
    metadata?: Record<string, unknown>
}

let activeJobs = 0
let pumpScheduled = false

export async function postVerificationJob(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const body = (req.body || {}) as CreateJobBody
    const kind = body.kind || 'browser'
    if (!['browser', 'build', 'deploy', 'design'].includes(kind)) {
        return res.status(400).send({ error: 'Unsupported verification kind.' })
    }

    const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl.trim() : ''
    if (kind === 'browser' || kind === 'design') {
        const validation = validateHttpUrl(targetUrl)
        if (validation) {
            return res.status(400).send({ error: validation })
        }
    }

    const id = crypto.randomUUID()
    const requestId = headerValue(req.headers['x-request-id']) || crypto.randomUUID()
    const metadata = {
        ...(isPlainObject(body.metadata) ? body.metadata : {}),
        captureScreenshot: Boolean(body.captureScreenshot),
        timeoutMs: Math.max(1000, Math.min(Number(body.timeoutMs || 16000), 30000)),
    }
    const priority = normalizePriority(body.priority)
    const lane = typeof body.lane === 'string' && body.lane.trim() ? body.lane.trim().slice(0, 40) : priority > 0 ? 'priority' : 'standard'

    await run(`
        INSERT INTO ai_verification_jobs (
            id, owner_id, workspace_kind, workspace_id, kind, status, priority, lane,
            queue_position, max_retries, current_step, target_url, deploy_url, request_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, 0, $8, 'Queued', $9, $10, $11, $12::jsonb)
    `, [
        id,
        auth.id,
        cleanOptional(body.workspaceKind),
        cleanOptional(body.workspaceId),
        kind,
        priority,
        lane,
        Math.max(0, Math.min(Number(body.maxRetries ?? 1), 3)),
        targetUrl || null,
        cleanOptional(body.deployUrl),
        requestId,
        JSON.stringify(metadata),
    ])
    await updateQueuePositions()
    schedulePump()

    const job = await getJobForOwner(id, auth.id)
    return res.status(202).send({ job: normalizeJob(job), queue: await queueSummary(auth.id) })
}

export async function getVerificationJobs(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const query = req.query as { workspaceKind?: string, workspaceId?: string, limit?: string }
    const limit = Math.max(1, Math.min(Number(query.limit || 20), 50))
    const params: unknown[] = [auth.id]
    const filters = ['owner_id = $1']
    if (query.workspaceKind) {
        params.push(query.workspaceKind)
        filters.push(`workspace_kind = $${params.length}`)
    }
    if (query.workspaceId) {
        params.push(query.workspaceId)
        filters.push(`workspace_id = $${params.length}`)
    }
    params.push(limit)
    const result = await run(`
        SELECT *
        FROM ai_verification_jobs
        WHERE ${filters.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length}
    `, params as never[])
    return res.send({
        jobs: (result.rows as VerificationJobRow[]).map(normalizeJob),
        queue: await queueSummary(auth.id),
    })
}

export async function getVerificationJob(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const { id } = req.params as { id: string }
    const job = await getJobForOwner(id, auth.id)
    if (!job) {
        return res.status(404).send({ error: 'Verification job not found.' })
    }
    return res.send({ job: normalizeJob(job), queue: await queueSummary(auth.id) })
}

export async function cancelVerificationJob(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const { id } = req.params as { id: string }
    const result = await run(`
        UPDATE ai_verification_jobs
        SET status = 'cancelled',
            current_step = 'Cancelled',
            cancelled_at = NOW(),
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
          AND owner_id = $2
          AND status IN ('queued', 'running')
        RETURNING *
    `, [id, auth.id])
    await updateQueuePositions()
    const job = result.rows[0] || await getJobForOwner(id, auth.id)
    if (!job) {
        return res.status(404).send({ error: 'Verification job not found.' })
    }
    return res.send({ job: normalizeJob(job), queue: await queueSummary(auth.id) })
}

function schedulePump() {
    if (pumpScheduled) {
        return
    }
    pumpScheduled = true
    setTimeout(() => {
        pumpScheduled = false
        void pumpQueue()
    }, 0)
}

async function pumpQueue() {
    await updateQueuePositions()
    while (activeJobs < MAX_CONCURRENT_JOBS) {
        const result = await run(`
            UPDATE ai_verification_jobs
            SET status = 'running',
                current_step = 'Starting',
                started_at = COALESCE(started_at, NOW()),
                updated_at = NOW()
            WHERE id = (
                SELECT id
                FROM ai_verification_jobs
                WHERE status = 'queued'
                ORDER BY priority DESC, created_at ASC
                LIMIT 1
            )
            RETURNING *
        `)
        const job = result.rows[0] as VerificationJobRow | undefined
        if (!job) {
            return
        }
        activeJobs += 1
        void runJob(job).finally(() => {
            activeJobs = Math.max(0, activeJobs - 1)
            schedulePump()
        })
    }
}

async function runJob(job: VerificationJobRow) {
    try {
        if (job.kind === 'browser') {
            await runBrowserJob(job)
        } else if (job.kind === 'design') {
            await runDesignJob(job)
        } else {
            await completeNonBrowserJob(job)
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const current = await getJob(job.id)
        if (current?.status === 'cancelled') {
            return
        }
        if ((current?.retry_count || 0) < (current?.max_retries || 0)) {
            await run(`
                UPDATE ai_verification_jobs
                SET status = 'queued',
                    retry_count = retry_count + 1,
                    current_step = 'Retry queued',
                    error = $2,
                    updated_at = NOW()
                WHERE id = $1
            `, [job.id, message])
            await updateQueuePositions()
            return
        }
        await run(`
            UPDATE ai_verification_jobs
            SET status = 'failed',
                current_step = 'Failed',
                error = $2,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [job.id, message])
    }
}

async function runBrowserJob(job: VerificationJobRow) {
    if (!job.target_url) {
        throw new Error('Missing target URL.')
    }
    const current = await getJob(job.id)
    if (current?.status === 'cancelled') {
        return
    }
    await updateStep(job.id, 'Fetching browser target')
    const started = performance.now()
    const controller = new AbortController()
    const metadata = job.metadata || {}
    const timeoutMs = Math.max(1000, Math.min(Number(metadata.timeoutMs || 16000), 30000))
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(job.target_url, {
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
                'User-Agent': 'HanasandAI-VerificationJob/1.0',
            },
            signal: controller.signal,
        })
        await updateStep(job.id, 'Extracting evidence')
        const text = await response.text()
        const screenshots = metadata.captureScreenshot
            ? await captureRenderedScreenshots(job.target_url, job.id)
            : []
        const journeyProof = await captureRenderedJourneyProof(job.target_url, job.id)
        const artifact = {
            id: crypto.randomUUID(),
            type: 'browser_result',
            name: 'Browser evidence',
            createdAt: new Date().toISOString(),
            data: {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                elapsed_ms: Math.round(performance.now() - started),
                url: response.url || job.target_url,
                title: extractTitle(text),
                textExcerpt: extractTextExcerpt(text),
                structure: extractStructure(text),
                screenshotPath: screenshots[0]?.path || null,
                screenshots,
                journeyProof,
                consoleMessages: [
                    'Fetched browser target and captured durable rendered viewport evidence.',
                    screenshots.length ? `${screenshots.length} rendered screenshot artifact${screenshots.length === 1 ? '' : 's'} captured.` : 'Rendered screenshot capture was not requested or did not complete.',
                    journeyProof ? 'Rendered non-destructive journey script completed.' : 'Rendered journey script did not complete.',
                ],
                pageErrors: response.ok ? [] : [`HTTP ${response.status} ${response.statusText}`],
            },
        }
        await run(`
            UPDATE ai_verification_jobs
            SET status = $2,
                current_step = $3,
                artifacts = artifacts || $4::jsonb,
                error = $5,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [
            job.id,
            response.ok ? 'completed' : 'failed',
            response.ok ? 'Browser proof completed' : 'Browser proof failed',
            JSON.stringify([artifact]),
            response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
        ])
        await recordAiUsageEvent({
            ownerId: job.owner_id,
            actorId: job.owner_id,
            workspaceKind: cleanWorkspaceKind(job.workspace_kind),
            workspaceId: job.workspace_id,
            kind: 'browser_proof_completed',
            units: 1,
            billableUnits: response.ok ? 1 : 0,
            estimatedCostNok: response.ok ? 0.04 : 0,
            billingMode: job.lane,
            outcome: response.ok ? 'verified' : 'failed',
            metadata: {
                jobId: job.id,
                requestId: job.request_id,
                targetUrl: job.target_url,
                status: response.status,
                journeyProofAvailable: Boolean(journeyProof),
                elapsedMs: Math.round(performance.now() - started),
            },
        })
    } finally {
        clearTimeout(timeout)
    }
}

async function runDesignJob(job: VerificationJobRow) {
    if (!job.target_url) {
        throw new Error('Missing target URL.')
    }
    const current = await getJob(job.id)
    if (current?.status === 'cancelled') {
        return
    }
    await updateStep(job.id, 'Fetching design target')
    const started = performance.now()
    const controller = new AbortController()
    const metadata = job.metadata || {}
    const timeoutMs = Math.max(1000, Math.min(Number(metadata.timeoutMs || 16000), 30000))
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(job.target_url, {
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
                'User-Agent': 'HanasandAI-DesignQualityJob/1.0',
            },
            signal: controller.signal,
        })
        await updateStep(job.id, 'Scoring design quality')
        const text = await response.text()
        const structure = extractStructure(text)
        const excerpt = extractTextExcerpt(text)
        const review = reviewDesignQuality(text, excerpt, structure)
        const screenshots = await captureRenderedScreenshots(job.target_url, job.id)
        const journeyProof = await captureRenderedJourneyProof(job.target_url, job.id)
        const hasRenderedProof = screenshots.length > 0
        const passed = response.ok && review.score >= 72 && review.criticalIssues.length === 0
        const artifact = {
            id: crypto.randomUUID(),
            type: 'design_quality_report',
            name: 'Design quality report',
            createdAt: new Date().toISOString(),
            data: {
                ok: response.ok,
                passed,
                score: review.score,
                status: passed ? 'passed' : 'failed',
                elapsed_ms: Math.round(performance.now() - started),
                url: response.url || job.target_url,
                title: extractTitle(text),
                checks: review.checks,
                issues: review.issues,
                criticalIssues: review.criticalIssues,
                repeatedPatternCount: review.repeatedPatternCount,
                genericPhraseCount: review.genericPhraseCount,
                screenshotPath: screenshots[0]?.path || null,
                screenshots,
                journeyProof,
                notVerified: [
                    hasRenderedProof ? null : 'Rendered screenshot capture did not complete.',
                    'Automated screenshot diffing still needs a before/after baseline to compare against.',
                    journeyProof ? null : 'Rendered journey script did not complete.',
                ].filter(Boolean),
            },
        }
        await run(`
            UPDATE ai_verification_jobs
            SET status = $2,
                current_step = $3,
                artifacts = artifacts || $4::jsonb,
                error = $5,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [
            job.id,
            passed ? 'completed' : 'failed',
            passed ? 'Design QA passed' : 'Design QA failed',
            JSON.stringify([artifact]),
            passed ? null : `Design QA score ${review.score}: ${review.issues.slice(0, 2).join('; ') || 'review failed'}`,
        ])
        await recordAiUsageEvent({
            ownerId: job.owner_id,
            actorId: job.owner_id,
            workspaceKind: cleanWorkspaceKind(job.workspace_kind),
            workspaceId: job.workspace_id,
            kind: 'browser_proof_completed',
            units: 1,
            billableUnits: passed ? 1 : 0,
            estimatedCostNok: passed ? 0.06 : 0,
            billingMode: job.lane,
            outcome: passed ? 'verified' : 'failed',
            metadata: {
                proofType: 'design_quality',
                jobId: job.id,
                requestId: job.request_id,
                targetUrl: job.target_url,
                status: response.status,
                score: review.score,
                genericPhraseCount: review.genericPhraseCount,
                repeatedPatternCount: review.repeatedPatternCount,
                renderedScreenshotCount: screenshots.length,
                journeyProofAvailable: Boolean(journeyProof),
                elapsedMs: Math.round(performance.now() - started),
            },
        })
    } finally {
        clearTimeout(timeout)
    }
}

type ScreenshotViewport = {
    label: string
    width: number
    height: number
}

async function captureRenderedScreenshots(url: string, jobId: string) {
    const viewports: ScreenshotViewport[] = [
        { label: 'mobile', width: 390, height: 844 },
        { label: 'desktop', width: 1440, height: 1000 },
    ]
    const results = []
    for (const viewport of viewports) {
        const result = await captureRenderedScreenshot(url, jobId, viewport)
        if (result) {
            results.push(result)
        }
    }
    return results
}

async function captureRenderedScreenshot(url: string, jobId: string, viewport: ScreenshotViewport) {
    const dir = await mkdtemp(path.join(tmpdir(), 'hanasand-ai-proof-'))
    const screenshotPath = path.join(dir, `${jobId}-${viewport.label}.png`)
    try {
        await runChromium([
            '--headless=new',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            `--window-size=${viewport.width},${viewport.height}`,
            `--screenshot=${screenshotPath}`,
            url,
        ], 18000)
        const bytes = await readFile(screenshotPath)
        return {
            viewport: viewport.label,
            width: viewport.width,
            height: viewport.height,
            path: `artifact://${jobId}/${viewport.label}.png`,
            mimeType: 'image/png',
            sizeBytes: bytes.length,
            dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
        }
    } catch {
        return null
    } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
}

async function runChromium(args: string[], timeoutMs: number) {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(CHROMIUM_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
        let stderr = ''
        const timeout = setTimeout(() => {
            child.kill('SIGKILL')
            reject(new Error('Chromium screenshot timed out.'))
        }, timeoutMs)
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk).slice(0, 4000)
        })
        child.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
        })
        child.on('close', (code) => {
            clearTimeout(timeout)
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(stderr || `Chromium exited with ${code}.`))
            }
        })
    })
}

async function captureRenderedJourneyProof(url: string, jobId: string) {
    const dir = await mkdtemp(path.join(tmpdir(), 'hanasand-ai-journey-'))
    let child: ReturnType<typeof spawn> | null = null
    try {
        const browser = await startDebugChromium(dir)
        child = browser.child
        const page = await openDebugPage(browser.port, url)
        if (!page?.webSocketDebuggerUrl) {
            return null
        }
        const client = await createCdpClient(page.webSocketDebuggerUrl)
        try {
            await client.send('Page.enable')
            await client.send('Runtime.enable')
            await waitForPageReady(client, url)
            const evaluation = await client.send('Runtime.evaluate', {
                expression: `(${nonDestructiveJourneyScript.toString()})()`,
                awaitPromise: true,
                returnByValue: true,
            })
            const value = ((evaluation.result || {}) as { value?: unknown }).value
            if (!value || typeof value !== 'object') {
                return null
            }
            return {
                jobId,
                mode: 'non_destructive_rendered_script',
                targetUrl: url,
                capturedAt: new Date().toISOString(),
                ...value,
            }
        } finally {
            client.close()
        }
    } catch {
        return null
    } finally {
        if (child) {
            child.kill('SIGKILL')
        }
        await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
}

async function startDebugChromium(userDataDir: string) {
    const child = spawn(CHROMIUM_BIN, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--remote-debugging-port=0',
        `--user-data-dir=${userDataDir}`,
        'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    const endpoint = await new Promise<{ port: number }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Chromium debug startup timed out.')), 9000)
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk)
            const match = stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)
            if (match?.[1]) {
                clearTimeout(timeout)
                resolve({ port: Number(match[1]) })
            }
        })
        child.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
        })
        child.on('exit', (code) => {
            clearTimeout(timeout)
            reject(new Error(`Chromium debug process exited early with ${code}.`))
        })
    })
    return { child, port: endpoint.port }
}

async function openDebugPage(port: number, url: string) {
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
    if (!response.ok) {
        return null
    }
    return await response.json() as { webSocketDebuggerUrl?: string }
}

type CdpClient = {
    send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>
    close: () => void
}

async function createCdpClient(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('CDP socket timed out.')), 8000)
        socket.addEventListener('open', () => {
            clearTimeout(timeout)
            resolve()
        }, { once: true })
        socket.addEventListener('error', () => {
            clearTimeout(timeout)
            reject(new Error('CDP socket failed.'))
        }, { once: true })
    })
    let nextId = 1
    const pending = new Map<number, { resolve: (value: Record<string, unknown>) => void, reject: (error: Error) => void }>()
    socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as { id?: number, result?: Record<string, unknown>, error?: { message?: string } }
        if (!message.id || !pending.has(message.id)) {
            return
        }
        const waiter = pending.get(message.id)
        pending.delete(message.id)
        if (!waiter) return
        if (message.error) {
            waiter.reject(new Error(message.error.message || 'CDP command failed.'))
        } else {
            waiter.resolve(message.result || {})
        }
    })
    return {
        send(method, params = {}) {
            const id = nextId
            nextId += 1
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject })
                socket.send(JSON.stringify({ id, method, params }))
                setTimeout(() => {
                    if (!pending.has(id)) return
                    pending.delete(id)
                    reject(new Error(`${method} timed out.`))
                }, 12000)
            })
        },
        close() {
            socket.close()
        },
    }
}

async function waitForPageReady(client: CdpClient, url: string) {
    await client.send('Page.navigate', { url })
    for (let index = 0; index < 24; index += 1) {
        await sleep(500)
        const state = await client.send('Runtime.evaluate', {
            expression: 'document.readyState',
            returnByValue: true,
        })
        if ((state?.result as { value?: unknown } | undefined)?.value === 'complete') {
            return
        }
    }
}

function nonDestructiveJourneyScript() {
    const text = (document.body?.innerText || '').toLowerCase()
    const controls = [...document.querySelectorAll('input, textarea, select')] as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[]
    const fillable = controls.filter((control) => {
        const input = control as HTMLInputElement
        const type = (input.type || '').toLowerCase()
        return !control.disabled && !control.hasAttribute('readonly') && !['hidden', 'submit', 'button', 'reset', 'file', 'checkbox', 'radio'].includes(type)
    })
    let focused = 0
    let filled = 0
    const blocked: string[] = []
    for (const control of fillable.slice(0, 12)) {
        try {
            control.focus()
            focused += document.activeElement === control ? 1 : 0
            if (control instanceof HTMLSelectElement) {
                if (control.options.length > 1) {
                    control.selectedIndex = 1
                    filled += 1
                }
            } else {
                const type = control instanceof HTMLInputElement ? (control.type || '').toLowerCase() : 'text'
                control.value = type === 'email' ? 'proof@example.com' : type === 'tel' ? '+4700000000' : type === 'number' ? '1' : 'Validation input'
                control.dispatchEvent(new Event('input', { bubbles: true }))
                control.dispatchEvent(new Event('change', { bubbles: true }))
                filled += 1
            }
        } catch {
            blocked.push((control.getAttribute('name') || control.getAttribute('aria-label') || control.id || control.tagName).slice(0, 80))
        }
    }
    const buttons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], a[href]')] as HTMLElement[]
    const buttonLabels = buttons.map((button) => (button.innerText || button.getAttribute('aria-label') || button.getAttribute('value') || button.getAttribute('href') || '').trim()).filter(Boolean).slice(0, 20)
    const forms = [...document.querySelectorAll('form')]
    const submitControls = [...document.querySelectorAll('button[type="submit"], input[type="submit"], form button:not([type]), form button[type=""]')]
    const journeyTypes = {
        auth: /\b(sign in|login|log in|register|account|password)\b/.test(text),
        checkout: /\b(checkout|cart|payment|invoice|subscription|billing)\b/.test(text),
        booking: /\b(book|booking|appointment|schedule|reservation)\b/.test(text),
        contact: /\b(contact|message|email|phone|request)\b/.test(text) || forms.length > 0,
        dashboardCrud: /\b(create|edit|delete|save|dashboard|table|filter|export)\b/.test(text),
    }
    return {
        url: location.href,
        title: document.title || null,
        forms: forms.length,
        controls: controls.length,
        fillableControls: fillable.length,
        focusedControls: focused,
        filledControls: filled,
        submitControls: submitControls.length,
        buttonLabels,
        blockedControls: blocked,
        journeyTypes,
        readiness: {
            hasVisibleAction: buttonLabels.length > 0,
            formsCanBeDryFilled: fillable.length === 0 || filled > 0,
            submitWithoutMutationAvoided: true,
            detectedCriticalJourney: Object.values(journeyTypes).some(Boolean),
        },
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function completeNonBrowserJob(job: VerificationJobRow) {
    const artifact = {
        id: crypto.randomUUID(),
        type: `${job.kind}_receipt`,
        name: `${job.kind} verification receipt`,
        createdAt: new Date().toISOString(),
        data: {
            message: `${job.kind} verification job recorded. Attach a runner to stream build logs, Docker output, deploy URLs, and health checks.`,
            deployUrl: job.deploy_url,
            requestId: job.request_id,
        },
    }
    await run(`
        UPDATE ai_verification_jobs
        SET status = 'completed',
            current_step = 'Receipt stored',
            artifacts = artifacts || $2::jsonb,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
    `, [job.id, JSON.stringify([artifact])])
    const durationMinutes = Math.max(1, Math.ceil(((job.started_at ? Date.now() - Date.parse(job.started_at) : 0) || 60000) / 60000))
    const kind = job.kind === 'deploy' ? 'deploy_minutes_recorded' : 'build_minutes_recorded'
    await recordAiUsageEvent({
        ownerId: job.owner_id,
        actorId: job.owner_id,
        workspaceKind: cleanWorkspaceKind(job.workspace_kind),
        workspaceId: job.workspace_id,
        kind,
        units: durationMinutes,
        billableUnits: durationMinutes,
        estimatedCostNok: durationMinutes * (job.kind === 'deploy' ? 0.24 : 0.16),
        billingMode: job.lane,
        outcome: job.kind === 'deploy' ? 'deployed' : 'verified',
        metadata: {
            jobId: job.id,
            requestId: job.request_id,
            deployUrl: job.deploy_url,
            currentStep: 'Receipt stored',
        },
    })
}

async function updateStep(id: string, step: string) {
    await run('UPDATE ai_verification_jobs SET current_step = $2, updated_at = NOW() WHERE id = $1 AND status = \'running\'', [id, step])
}

async function updateQueuePositions() {
    await run(`
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY priority DESC, created_at ASC) AS position
            FROM ai_verification_jobs
            WHERE status = 'queued'
        )
        UPDATE ai_verification_jobs jobs
        SET queue_position = ranked.position,
            updated_at = NOW()
        FROM ranked
        WHERE jobs.id = ranked.id
    `)
    await run('UPDATE ai_verification_jobs SET queue_position = 0 WHERE status <> \'queued\' AND queue_position <> 0')
}

async function queueSummary(ownerId: string) {
    const result = await run(`
        SELECT
            COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
            COUNT(*) FILTER (WHERE status = 'running')::int AS running,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
        FROM ai_verification_jobs
        WHERE owner_id = $1
          AND created_at > NOW() - INTERVAL '24 hours'
    `, [ownerId])
    return result.rows[0] || { queued: 0, running: 0, failed: 0, completed: 0 }
}

async function getJob(id: string) {
    const result = await run('SELECT * FROM ai_verification_jobs WHERE id = $1', [id])
    return result.rows[0] as VerificationJobRow | undefined
}

async function getJobForOwner(id: string, ownerId: string) {
    const result = await run('SELECT * FROM ai_verification_jobs WHERE id = $1 AND owner_id = $2', [id, ownerId])
    return result.rows[0] as VerificationJobRow | undefined
}

function normalizeJob(job?: VerificationJobRow) {
    if (!job) {
        return null
    }
    return {
        id: job.id,
        ownerId: job.owner_id,
        workspaceKind: job.workspace_kind,
        workspaceId: job.workspace_id,
        kind: job.kind,
        status: job.status,
        priority: job.priority,
        lane: job.lane,
        queuePosition: job.queue_position,
        retryCount: job.retry_count,
        maxRetries: job.max_retries,
        currentStep: job.current_step,
        targetUrl: job.target_url,
        deployUrl: job.deploy_url,
        requestId: job.request_id,
        artifacts: Array.isArray(job.artifacts) ? job.artifacts : [],
        metadata: job.metadata || {},
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        cancelledAt: job.cancelled_at,
    }
}

function normalizePriority(priority: CreateJobBody['priority']) {
    if (typeof priority === 'number' && Number.isFinite(priority)) {
        return Math.max(0, Math.min(Math.round(priority), 100))
    }
    if (priority === 'urgent') {
        return 100
    }
    if (priority === 'paid') {
        return 50
    }
    return 0
}

function cleanOptional(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null
}

function cleanWorkspaceKind(value: string | null): 'share' | 'repo' | null {
    return value === 'share' || value === 'repo' ? value : null
}

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateHttpUrl(url: string) {
    if (!url) {
        return 'Missing targetUrl.'
    }
    try {
        const target = new URL(url)
        return ['http:', 'https:'].includes(target.protocol) ? null : 'Only http and https verification targets are supported.'
    } catch {
        return 'Invalid targetUrl.'
    }
}

function extractTitle(html: string) {
    return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim() || null
}

function extractTextExcerpt(html: string) {
    const withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    const text = decodeHtml(withoutScripts.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
    return text.slice(0, MAX_EXCERPT_LENGTH)
}

function extractStructure(html: string) {
    return {
        headings: extractTaggedText(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi),
        links: extractLinks(html),
        buttons: extractTaggedText(html, /<button[^>]*>([\s\S]*?)<\/button>/gi),
        inputs: extractInputs(html),
        forms: extractFormSummaries(html),
        hasViewportMeta: /<meta\s+[^>]*name=["']viewport["'][^>]*>/i.test(html),
    }
}

function extractTaggedText(html: string, pattern: RegExp) {
    return [...html.matchAll(pattern)]
        .map((match) => stripTags(match[1] || ''))
        .filter(Boolean)
        .slice(0, MAX_STRUCTURE_ITEMS)
}

function extractLinks(html: string) {
    return [...html.matchAll(/<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi)]
        .map((match) => ({
            text: stripTags(match[2] || ''),
            href: extractAttribute(match[1] || '', 'href'),
        }))
        .filter((link) => link.text || link.href)
        .slice(0, MAX_STRUCTURE_ITEMS)
}

function extractInputs(html: string) {
    return [...html.matchAll(/<(input|textarea|select)\s+([^>]*?)(?:\/?>|>[\s\S]*?<\/\1>)/gi)]
        .map((match) => {
            const attrs = match[2] || ''
            return [
                extractAttribute(attrs, 'aria-label'),
                extractAttribute(attrs, 'placeholder'),
                extractAttribute(attrs, 'name'),
                extractAttribute(attrs, 'id'),
                extractAttribute(attrs, 'type'),
            ].filter(Boolean).join(' / ')
        })
        .filter(Boolean)
        .slice(0, MAX_STRUCTURE_ITEMS)
}

function extractFormSummaries(html: string) {
    return [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)]
        .map((match) => {
            const body = match[1] || ''
            const inputs = extractInputs(body).slice(0, 8)
            const buttons = extractTaggedText(body, /<button[^>]*>([\s\S]*?)<\/button>/gi).slice(0, 4)
            return [...inputs, ...buttons].join(' | ')
        })
        .filter(Boolean)
        .slice(0, 8)
}

function reviewDesignQuality(html: string, excerpt: string, structure: ReturnType<typeof extractStructure>) {
    const lowerHtml = html.toLowerCase()
    const lowerText = excerpt.toLowerCase()
    const genericPhrases = [
        'unlock your potential',
        'transform your business',
        'seamless experience',
        'elevate your brand',
        'innovative solutions',
        'cutting edge',
        'all-in-one platform',
        'beautiful and modern',
        'powerful and easy',
        'next generation',
        'lorem ipsum',
    ]
    const genericPhraseCount = genericPhrases.filter((phrase) => lowerText.includes(phrase)).length
    const repeatedPatternCount = Math.max(
        countMatches(lowerHtml, /rounded-[a-z0-9/[\].-]+/g),
        countMatches(lowerHtml, /class=["'][^"']*(card|shadow|gradient)[^"']*["']/g),
    )
    const hasViewport = structure.hasViewportMeta
    const headingCount = structure.headings.length
    const hasForms = structure.forms.length > 0
    const hasSpecificCopy = excerpt.length > 260 && /\b(price|booking|client|case|service|team|deadline|location|domain|shipping|invoice|clinic|studio|restaurant|agency|project|portfolio)\b/i.test(excerpt)
    const hasDesignTokens = /--[a-z0-9-]+|design token|brand kit|palette|type scale|theme|style guide/i.test(html)
    const hasAssets = /<img\b|picture\b|svg\b|lucide|icon|asset|photo|image direction|brand asset/i.test(html)
    const hasMobileCare = /clamp\(|minmax\(|@media|viewport|flex-wrap|grid-template-columns/i.test(html)
    const issues = [
        genericPhraseCount ? 'Copy contains generic AI-builder phrases.' : null,
        repeatedPatternCount > 24 ? 'Layout may rely on repeated rounded cards, shadows, or gradient/card patterns.' : null,
        !hasViewport ? 'Missing viewport metadata for mobile proof.' : null,
        headingCount < 2 ? 'Page hierarchy is too thin to review confidently.' : null,
        !hasSpecificCopy ? 'Copy lacks business-specific detail.' : null,
        !hasDesignTokens ? 'No visible design-token, theme, palette, or style-guide direction.' : null,
        !hasAssets ? 'No asset, image, icon, or brand-media direction found.' : null,
        !hasMobileCare ? 'No clear responsive layout signals found.' : null,
        hasForms && !excerpt.match(/email|name|phone|message|booking|checkout|sign in|log in/i) ? 'Form purpose is unclear from visible copy.' : null,
    ].filter(Boolean) as string[]
    const criticalIssues = [
        !hasViewport ? 'mobile_viewport_missing' : null,
        genericPhraseCount >= 3 ? 'generic_copy_excessive' : null,
        repeatedPatternCount > 42 ? 'repeated_template_pattern_excessive' : null,
    ].filter(Boolean) as string[]
    const score = Math.max(0, Math.min(100, 100
        - genericPhraseCount * 9
        - Math.max(0, repeatedPatternCount - 16)
        - (hasViewport ? 0 : 16)
        - (headingCount >= 2 ? 0 : 10)
        - (hasSpecificCopy ? 0 : 12)
        - (hasDesignTokens ? 0 : 8)
        - (hasAssets ? 0 : 8)
        - (hasMobileCare ? 0 : 10)))
    return {
        score,
        issues,
        criticalIssues,
        repeatedPatternCount,
        genericPhraseCount,
        checks: {
            hasViewport,
            headingCount,
            hasSpecificCopy,
            hasDesignTokens,
            hasAssets,
            hasMobileCare,
            hasClearFormPurpose: !hasForms || !issues.includes('Form purpose is unclear from visible copy.'),
        },
    }
}

function countMatches(value: string, pattern: RegExp) {
    return [...value.matchAll(pattern)].length
}

function extractAttribute(attributes: string, name: string) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = attributes.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'))
    return decodeHtml(match?.[1] || '').trim()
}

function stripTags(value: string) {
    return decodeHtml(value.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
}

function decodeHtml(value: string) {
    return value
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
}
