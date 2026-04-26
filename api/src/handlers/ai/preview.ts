import path from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

type PreviewRow = {
    id: string
    owner_id: string
    conversation_id: string
    vm_name: string
    access_policy: AIDeploymentAccessPolicy
    healthcheck_url: string | null
}

type ProxyPayload = {
    body?: string
    raw?: string
    status?: number
    headers?: Record<string, string>
    contentType?: string
    content_type?: string
}

const ALLOWED_METHODS = new Set(['GET', 'HEAD'])

export async function getAiPreview(req: FastifyRequest, res: FastifyReply) {
    const { id, '*': wildcard } = req.params as { id: string, '*': string | undefined }
    if (!id) {
        return res.status(400).send({ error: 'Missing preview id.' })
    }

    const { valid, id: userId } = await tokenWrapper(req, res)
    const { valid: isAdmin } = valid && userId
        ? await hasRole(req, res, 'system_admin')
        : { valid: false }

    const result = await run(`
        SELECT deployments.id, deployments.owner_id, deployments.conversation_id, deployments.vm_name,
               deployments.access_policy, deployments.healthcheck_url
        FROM ai_deployments AS deployments
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = deployments.conversation_id
         AND collaborators.user_id = $2
        WHERE deployments.id = $1
          AND (
            deployments.access_policy = 'public_preview'
            OR (
                $2 <> ''
                AND (
                    deployments.owner_id = $2
                    OR ($3 = TRUE)
                    OR (
                        deployments.access_policy = 'collaborators'
                        AND collaborators.user_id = $2
                    )
                )
            )
          )
        LIMIT 1
    `, [id, userId || '', isAdmin])

    const deployment = (result.rows as PreviewRow[])[0]
    if (!deployment) {
        return res.status(valid ? 404 : 401).send({ error: valid ? 'Preview not found.' : 'Unauthorized.' })
    }

    if (!deployment.healthcheck_url) {
        return res.status(409).send({ error: 'Preview is not reachable yet.' })
    }

    if (!ALLOWED_METHODS.has(req.method.toUpperCase())) {
        return res.status(405).send({ error: 'Only GET and HEAD preview requests are supported.' })
    }

    let target: URL
    try {
        target = new URL(deployment.healthcheck_url)
    } catch {
        return res.status(500).send({ error: 'Preview target is invalid.' })
    }

    const requestedPath = typeof wildcard === 'string' && wildcard.trim()
        ? `/${wildcard.replace(/^\/+/, '')}`
        : ''
    if (requestedPath) {
        const basePath = target.pathname.replace(/\/+$/, '')
        target.pathname = `${basePath}${requestedPath}`
    }

    const search = new URL(req.url, 'http://localhost').search
    target.search = search

    const proxied = await fetch(`${config.internal_api}/vm/${encodeURIComponent(deployment.vm_name)}/request`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
            'Content-Type': 'application/json',
            'User-Agent': 'hanasand_api',
        },
        body: JSON.stringify({
            method: req.method,
            url: target.toString(),
            headers: {
                Accept: String(req.headers.accept || '*/*'),
            },
            body: '',
        }),
    })

    const proxiedText = await proxied.text()
    const payload = parseProxyPayload(proxiedText)
    const status = Number(payload?.status || (proxied.ok ? 200 : proxied.status))
    const contentType = payload?.contentType || payload?.content_type || payload?.headers?.['content-type'] || inferContentType(target.pathname)
    const body = typeof payload?.body === 'string'
        ? payload.body
        : typeof payload?.raw === 'string'
            ? payload.raw
            : proxiedText

    res.status(status)
    res.header('Content-Type', contentType)
    res.header('Cache-Control', deployment.access_policy === 'public_preview' ? 'public, max-age=30' : 'private, no-store')
    res.header('X-Hanasand-Preview-Policy', deployment.access_policy)
    res.header('X-Robots-Tag', 'noindex, nofollow')

    if (req.method.toUpperCase() === 'HEAD') {
        return res.send()
    }

    return res.send(body)
}

function parseProxyPayload(text: string): ProxyPayload | null {
    if (!text) {
        return null
    }

    try {
        const parsed = JSON.parse(text) as unknown
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ProxyPayload : { raw: text }
    } catch {
        return { raw: text }
    }
}

function inferContentType(requestPath: string) {
    const ext = path.extname(requestPath).toLowerCase()
    switch (ext) {
        case '.css':
            return 'text/css; charset=utf-8'
        case '.js':
        case '.mjs':
            return 'application/javascript; charset=utf-8'
        case '.json':
            return 'application/json; charset=utf-8'
        case '.svg':
            return 'image/svg+xml'
        case '.txt':
            return 'text/plain; charset=utf-8'
        case '.map':
            return 'application/json; charset=utf-8'
        default:
            return 'text/html; charset=utf-8'
    }
}
