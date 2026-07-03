import type { FastifyReply, FastifyRequest } from 'fastify'
import recordLog from '#utils/logs/recordLog.ts'

const ignoredPrefixes = [
    '/api/logs',
    '/api/status',
    '/api/traffic',
    '/api/health',
]

export async function recordHttpErrorResponse(req: FastifyRequest, res: FastifyReply, payload: unknown) {
    const statusCode = Number(res.statusCode || 0)
    if (statusCode < 400 || ignoredPrefixes.some(prefix => req.url.startsWith(prefix))) {
        return
    }

    const body = parsePayload(payload)
    const errorCode = normalizeErrorCode(body)
    const message = normalizeMessage(body, `HTTP ${statusCode}`)
    const path = normalizePath(req.url)
    const level = statusCode >= 500 ? 'error' : 'warn'
    const requestId = readHeader(req.headers['x-request-id']) || req.id
    const userId = readHeader(req.headers.id)

    await recordLog({
        service: 'hanasand-api',
        level,
        message: `${req.method} ${path} failed with ${statusCode}${errorCode ? ` ${errorCode}` : ''}`,
        metadata: {
            category: 'http_response_error',
            surface: classifySurface(path),
            method: req.method,
            path,
            status_code: statusCode,
            error_code: errorCode,
            error_message: message,
            request_id: requestId,
            user_id: userId,
            ip: req.ip,
            user_agent: readHeader(req.headers['user-agent']).slice(0, 300),
            referer: readHeader(req.headers.referer || req.headers.referrer).slice(0, 500),
        },
    }).catch(error => req.log.warn({ error }, 'Failed to persist HTTP error response'))
}

function parsePayload(payload: unknown) {
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) {
        return null
    }

    const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload
    if (!text || text.length > 20_000) {
        return null
    }

    try {
        return JSON.parse(text) as Record<string, unknown>
    } catch {
        return null
    }
}

function normalizeErrorCode(body: Record<string, unknown> | null) {
    const raw = body?.code || body?.error || body?.reason
    if (typeof raw !== 'string') return ''
    return raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120)
}

function normalizeMessage(body: Record<string, unknown> | null, fallback: string) {
    const raw = body?.message || body?.error || body?.reason
    if (typeof raw !== 'string') return fallback
    return raw.trim().slice(0, 500) || fallback
}

function normalizePath(url: string) {
    try {
        return new URL(url, 'http://hanasand.local').pathname || '/'
    } catch {
        return url.split('?')[0] || '/'
    }
}

function classifySurface(path: string) {
    if (path.startsWith('/api/auth')) return 'auth'
    if (path.startsWith('/api/organizations')) return 'organizations'
    if (path.startsWith('/api/dwm')) return 'dwm'
    if (path.startsWith('/api/ti')) return 'threat_intel'
    if (path.startsWith('/api/logs')) return 'logs'
    if (path.startsWith('/api/traffic')) return 'traffic'
    if (path.startsWith('/api/db')) return 'database'
    if (path.startsWith('/api/ai')) return 'ai'
    if (path.startsWith('/api/vms')) return 'workspace_runtime'
    return 'api'
}

function readHeader(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value.join(', ')
    return value || ''
}
