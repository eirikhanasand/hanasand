import { recordProxyRequest } from './proxyRequest.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { verifiedClientIp } from '#utils/http/publicBoundary.ts'
import { inspectAccess } from '#utils/events/analyzeAccess.ts'
import { customRetentionAction, loadLogRetentionRules } from '#utils/events/customRetention.ts'
import { normalizeLogEvent } from '#utils/events/logEvent.ts'
import { analyzeAccess } from '#utils/events/analyzeLog.ts'
import { redactLogText, redactLogValue } from '#utils/logs/redact.ts'
import { analyzeIngestAccess } from '#utils/events/analyzeIngestAccess.ts'

const ignoredPathPrefixes = [
    '/api/traffic',
    '/api/status',
    '/api/logs/realtime',
]

export default async function recordTraffic(req: FastifyRequest, res: FastifyReply, persist = true) {
    const path = normalizePath(req.url)
    const access = { key: `http-api:${req.id}`, ip: verifiedClientIp(req), timestamp: new Date().toISOString(),
        path, method: req.method, status: res.statusCode, inspection: inspectAccess(req) }
    const userAgent = readHeader(req.headers['user-agent'])
    if (persist && path === '/api/logs/ingest') {
        try {
            const decision = await analyzeIngestAccess(access, req.hostname, userAgent)
            if (decision.drop) return
        } catch (error) {
            req.log.warn({ error }, 'Log-ingest access analysis failed; retaining request')
        }
    }
    let proxyRecorded = false
    try {
        if (persist) proxyRecorded = await recordProxyRequest(req, res)
    } catch (error) {
        req.log.warn({ error }, 'Proxy request logging failed; checking retention before fallback')
    }
    let retentionAction: ReturnType<typeof customRetentionAction>
    if (persist) {
        try {
            retentionAction = customRetentionAction(normalizeLogEvent({ id: access.key, created_at: access.timestamp,
                service: 'http-traffic', host: req.hostname, level: res.statusCode >= 400 ? 'error' : 'info', message: `${req.method} ${path} → ${res.statusCode}`,
                metadata: { access, category: 'http', action: 'request', outcome: res.statusCode >= 400 ? 'failure' : 'success', path, method: req.method, status_code: res.statusCode, source: { ip: access.ip } },
            }), await loadLogRetentionRules(null))
        } catch (error) {
            // A failed rule lookup cannot be treated as permission to store a Drop match.
            req.log.warn({ error }, 'Access retention check failed; not persisting request')
            return
        }
        if (retentionAction === 'drop') return
    }
    try {
        if (!proxyRecorded && persist && retentionAction !== 'keep' && await analyzeAccess(access)) return
    } catch (error) {
        // Access analysis is separate from custom retention; keep evidence when only analysis fails.
        req.log.warn({ error }, 'Access analysis failed; retaining request')
    }
    if (!proxyRecorded) req.log.info({ access, req: { method: req.method, url: redactLogText(req.url), remoteAddress: req.ip,
        ...(!access.inspection.headersSafe ? { headers: redactLogValue(req.headers) } : {}) } }, 'http_access')
    if (!persist || ignoredPathPrefixes.some(prefix => path.startsWith(prefix))) {
        return
    }

    const domain = normalizeDomain(readHeader(req.headers['x-forwarded-host']) || readHeader(req.headers.host))
    const referer = readHeader(req.headers.referer || req.headers.referrer)
    const ip = verifiedClientIp(req)
    const countryIso = normalizeCountryIso(
        readHeader(req.headers['cf-ipcountry'])
        || readHeader(req.headers['x-vercel-ip-country'])
        || readHeader(req.headers['cloudfront-viewer-country'])
        || readHeader(req.headers['fly-client-ip-country'])
        || readHeader(req.headers['x-appengine-country'])
        || readHeader(req.headers['x-country-code'])
    )
    const elapsed = Math.max(0, Math.round(Number(res.elapsedTime || 0)))

    await run(`
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
