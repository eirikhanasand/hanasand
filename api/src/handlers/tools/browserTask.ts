import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

const MAX_EXCERPT_LENGTH = 5000

export default async function browserTaskTool(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { url, timeoutMs = 12000 } = req.body as {
        url?: string
        timeoutMs?: number
        captureScreenshot?: boolean
    } ?? {}

    if (!url) {
        return res.status(400).send({ error: 'Missing url.' })
    }

    let target: URL
    try {
        target = new URL(url)
    } catch {
        return res.status(400).send({ error: 'Invalid url.' })
    }

    if (!['http:', 'https:'].includes(target.protocol)) {
        return res.status(400).send({ error: 'Only http and https browser tasks are supported.' })
    }

    const started = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Math.min(timeoutMs, 30000)))

    try {
        const response = await fetch(target, {
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
                'User-Agent': 'HanasandAI-BrowserTask/1.0',
            },
            signal: controller.signal,
        })
        const text = await response.text()
        const title = extractTitle(text)
        const textExcerpt = extractTextExcerpt(text)
        const warnings = [
            'Fetched browser target without executing client-side JavaScript.',
            'Screenshot capture is not available in this lightweight server task yet.',
        ]

        return res.status(response.ok ? 200 : 502).send({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            elapsed_ms: Math.round(performance.now() - started),
            url: response.url || target.toString(),
            title,
            textExcerpt,
            screenshotPath: null,
            consoleMessages: warnings,
            pageErrors: response.ok ? [] : [`HTTP ${response.status} ${response.statusText}`],
        })
    } catch (error) {
        return res.status(502).send({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            elapsed_ms: Math.round(performance.now() - started),
            url: target.toString(),
            title: null,
            textExcerpt: '',
            screenshotPath: null,
            consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
            pageErrors: [error instanceof Error ? error.message : String(error)],
        })
    } finally {
        clearTimeout(timeout)
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

function decodeHtml(value: string) {
    return value
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
}
