import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

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

    try {
        const response = await fetch(target, {
            method: normalizedMethod,
            headers,
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
        })
    } catch (error) {
        return res.status(502).send({
            error: error instanceof Error ? error.message : String(error),
            elapsed_ms: Math.round(performance.now() - started),
        })
    } finally {
        clearTimeout(timeout)
    }
}
