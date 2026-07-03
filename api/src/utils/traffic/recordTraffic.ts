import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

const ignoredPathPrefixes = [
    '/api/traffic',
    '/api/status',
    '/api/logs/realtime',
]

export default function recordTraffic(req: FastifyRequest, res: FastifyReply) {
    const path = normalizePath(req.url)
    if (ignoredPathPrefixes.some(prefix => path.startsWith(prefix))) {
        return
    }

    const domain = normalizeDomain(readHeader(req.headers['x-forwarded-host']) || readHeader(req.headers.host))
    const userAgent = readHeader(req.headers['user-agent'])
    const referer = readHeader(req.headers.referer || req.headers.referrer)
    const ip = readHeader(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.ip || ''
    const countryIso = normalizeCountryIso(
        readHeader(req.headers['cf-ipcountry'])
        || readHeader(req.headers['x-vercel-ip-country'])
        || readHeader(req.headers['cloudfront-viewer-country'])
        || readHeader(req.headers['fly-client-ip-country'])
        || readHeader(req.headers['x-appengine-country'])
        || readHeader(req.headers['x-country-code'])
    )
    const elapsed = Math.max(0, Math.round(Number(res.elapsedTime || 0)))

    void run(`
        INSERT INTO traffic_events (domain, path, method, status, ip, country_iso, user_agent, referer, request_time_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
        domain,
        path,
        req.method,
        Number(res.statusCode || 0),
        ip.slice(0, 200),
        countryIso,
        userAgent.slice(0, 1000),
        referer.slice(0, 1000),
        elapsed,
    ]).catch(error => {
        req.log.warn({ error }, 'Failed to persist traffic event')
    })
}

function normalizePath(url: string) {
    try {
        return new URL(url, 'http://hanasand.local').pathname || '/'
    } catch {
        return url.split('?')[0] || '/'
    }
}

function normalizeDomain(value: string) {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return 'unknown'
    const withoutPort = trimmed.split(',')[0]?.trim().replace(/:\d+$/, '') || ''
    return withoutPort || 'unknown'
}

function normalizeCountryIso(value: string) {
    const iso = value.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(iso) || iso === 'XX' || iso === 'T1') {
        return ''
    }

    return iso
}

function readHeader(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value.join(', ')
    }

    return value || ''
}
