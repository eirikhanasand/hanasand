import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export default async function httpRequestTool(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { method = 'GET', url, headers = {}, body } = req.body as {
        method?: string
        url?: string
        headers?: Record<string, string>
        body?: string
    } ?? {}

    if (!url) {
        return res.status(400).send({ error: 'Missing url.' })
    }

    const normalizedMethod = method.toUpperCase()
    if (!ALLOWED_METHODS.has(normalizedMethod)) {
        return res.status(400).send({ error: 'Unsupported HTTP method.' })
    }

    const target = new URL(url)
    if (!['http:', 'https:'].includes(target.protocol)) {
        return res.status(400).send({ error: 'Only http and https requests are supported.' })
    }

    const started = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const normalizedHeaders = normalizeRequestHeaders(headers)

    try {
        const response = await fetch(target, {
            method: normalizedMethod,
            headers: normalizedHeaders.headers,
            body: ['GET', 'HEAD'].includes(normalizedMethod) ? undefined : body,
            signal: controller.signal,
        })
        const text = await response.text()
        const responseHeaders = Object.fromEntries(response.headers.entries())

        return res.send({
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            elapsed_ms: Math.round(performance.now() - started),
            headers: responseHeaders,
            body: text,
            warnings: normalizedHeaders.warnings,
        })
    } catch (error) {
        return res.status(502).send({
            error: error instanceof Error ? error.message : String(error),
            elapsed_ms: Math.round(performance.now() - started),
            warnings: normalizedHeaders.warnings,
        })
    } finally {
        clearTimeout(timeout)
    }
}

function normalizeRequestHeaders(headers: Record<string, string>) {
    const normalized: Record<string, string> = {}
    const warnings: string[] = []

    for (const [rawKey, rawValue] of Object.entries(headers || {})) {
        const key = rawKey.trim()
        const value = String(rawValue ?? '').trim()
        if (!key || !value) {
            continue
        }

        if (!HEADER_NAME_PATTERN.test(key)) {
            warnings.push(`Skipped invalid header name: ${key}`)
            continue
        }

        if (!isValidHeaderValue(value)) {
            warnings.push(`Skipped invalid header value for ${key}.`)
            continue
        }

        normalized[key] = value
    }

    return { headers: normalized, warnings }
}

function isValidHeaderValue(value: string) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if (code === 9) {
            continue
        }
        if (code < 32 || code > 126 || code === 127) {
            return false
        }
    }

    return true
}
