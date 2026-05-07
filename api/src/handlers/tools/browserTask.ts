import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { auditAgentAction, evaluateAgentActionPolicy } from '#utils/ai/actionPolicy.ts'

const MAX_EXCERPT_LENGTH = 5000
const MAX_STRUCTURE_ITEMS = 20

export default async function browserTaskTool(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: actorId } = await tokenWrapper(req, res)
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

    const policyDecision = await evaluateAgentActionPolicy({
        action: 'browser_task',
        actorId,
        method: 'GET',
        target: target.toString(),
        metadata: { host: target.hostname },
    })
    await auditAgentAction(req, {
        action: 'browser_task',
        actorId,
        method: 'GET',
        target: target.toString(),
        metadata: { host: target.hostname },
    }, policyDecision)
    if (policyDecision.status === 'blocked') {
        return res.status(403).send({ error: policyDecision.reason, decision: policyDecision })
    }
    if (policyDecision.status === 'checkpoint_required') {
        return res.status(409).send({ error: policyDecision.reason, decision: policyDecision })
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
        const structure = extractStructure(text)
        const quality = inspectPageQuality(text, structure, response.url || target.toString())
        const warnings = [
            'Fetched browser target without executing client-side JavaScript.',
            'Screenshot capture is not available in this lightweight server task yet.',
            'Build, JavaScript interactions, auth, checkout, booking, and dashboard CRUD need a full runner before they can be marked verified.',
        ]

        return res.status(response.ok ? 200 : 502).send({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            elapsed_ms: Math.round(performance.now() - started),
            url: response.url || target.toString(),
            title,
            textExcerpt,
            structure,
            quality,
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
            structure: emptyStructure(),
            quality: emptyQuality(),
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

function emptyStructure() {
    return {
        headings: [],
        links: [],
        buttons: [],
        inputs: [],
        forms: [],
        hasViewportMeta: false,
    }
}

function inspectPageQuality(html: string, structure: ReturnType<typeof extractStructure>, pageUrl: string) {
    const links = structure.links || []
    const parsedUrl = parseUrl(pageUrl)
    const anchors = new Set([...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]))
    const brokenLinks = links
        .filter((link) => {
            const href = (link.href || '').trim()
            if (!href || href === '#') return true
            if (href.startsWith('#')) return !anchors.has(href.slice(1))
            if (/^(mailto:|tel:|https?:\/\/|\/)/i.test(href)) return false
            if (parsedUrl && href.startsWith(`${parsedUrl.origin}/`)) return false
            return href.startsWith('javascript:')
        })
        .map((link) => [link.text || '<untitled link>', link.href || '<empty>'].join(' -> '))
        .slice(0, MAX_STRUCTURE_ITEMS)
    const controls = [...html.matchAll(/<(input|textarea|select)\s+([^>]*?)(?:\/?>|>[\s\S]*?<\/\1>)/gi)]
        .map((match) => ({
            tag: match[1],
            attrs: match[2] || '',
        }))
    const unlabeledControls = controls
        .filter((control) => !/type=["'](?:hidden|submit|button|checkbox|radio)["']/i.test(control.attrs))
        .filter((control) => {
            const id = extractAttribute(control.attrs, 'id')
            return !extractAttribute(control.attrs, 'aria-label')
                && !extractAttribute(control.attrs, 'aria-labelledby')
                && !(id && new RegExp(`<label[^>]+for=["']${escapeRegExp(id)}["']`, 'i').test(html))
                && !new RegExp(`<label\\b[^>]*>[\\s\\S]{0,240}<${control.tag}\\b`, 'i').test(html)
        })
        .map((control) => [extractAttribute(control.attrs, 'name'), extractAttribute(control.attrs, 'placeholder'), control.tag].filter(Boolean).join(' / '))
        .slice(0, MAX_STRUCTURE_ITEMS)
    const imagesWithoutAlt = [...html.matchAll(/<img\s+([^>]*?)>/gi)]
        .filter((match) => !/\salt\s*=/i.test(match[1] || ''))
        .map((match) => extractAttribute(match[1] || '', 'src') || '<inline image>')
        .slice(0, MAX_STRUCTURE_ITEMS)

    return {
        accessibilityBasics: {
            hasTitle: Boolean(extractTitle(html)),
            hasH1: /<h1\b/i.test(html),
            hasViewportMeta: structure.hasViewportMeta,
            unlabeledControls,
            imagesWithoutAlt,
        },
        brokenLinkBasics: {
            checked: links.length,
            issues: brokenLinks,
        },
        criticalJourneySignals: inferCriticalJourneySignals(html, structure),
        notVerified: [
            'Production build output',
            'JavaScript runtime errors',
            'Mobile rendered viewport',
            'Keyboard and screen-reader behavior',
            'Forms, checkout, auth, booking, dashboard CRUD side effects',
        ],
    }
}

function inferCriticalJourneySignals(html: string, structure: ReturnType<typeof extractStructure>) {
    const text = stripTags(html).toLowerCase()
    return {
        forms: (structure.forms || []).length,
        buttons: (structure.buttons || []).length,
        auth: /\b(login|sign in|signup|register|session|password|account)\b/.test(text),
        checkout: /\b(checkout|cart|payment|subscription|invoice|billing)\b/.test(text),
        booking: /\b(book|booking|reservation|appointment|calendar|availability)\b/.test(text),
        dashboardCrud: /\b(dashboard|create|edit|update|delete|archive|table|filter)\b/.test(text),
        liveDataClaim: /\b(live|real-time|realtime|synced|production data|connected to)\b/.test(text),
        sampleDataClaim: /\b(sample|demo|placeholder|mock|fake|stub)\b/.test(text),
    }
}

function emptyQuality() {
    return {
        accessibilityBasics: {
            hasTitle: false,
            hasH1: false,
            hasViewportMeta: false,
            unlabeledControls: [],
            imagesWithoutAlt: [],
        },
        brokenLinkBasics: {
            checked: 0,
            issues: [],
        },
        criticalJourneySignals: {
            forms: 0,
            buttons: 0,
            auth: false,
            checkout: false,
            booking: false,
            dashboardCrud: false,
            liveDataClaim: false,
            sampleDataClaim: false,
        },
        notVerified: [
            'Browser target did not load',
            'Production build output',
            'JavaScript runtime errors',
            'Mobile rendered viewport',
            'Critical journeys',
        ],
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

function parseUrl(value: string) {
    try {
        return new URL(value)
    } catch {
        return null
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
