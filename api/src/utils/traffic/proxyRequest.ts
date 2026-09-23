import type { FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'node:crypto'
import { withTransaction } from '#db'
import recordLog from '#utils/logs/recordLog.ts'
import { inspectAccess, ordinaryAccessPath } from '#utils/mill/analyzeAccess.ts'
import { proxyConnection, proxyHeader } from '#utils/mill/analyzeProxy.ts'
import { verifiedClientIp } from '#utils/http/publicBoundary.ts'
import { redactLogText, redactLogValue } from '#utils/logs/redact.ts'

// HAProxy overwrites the header. It is accepted only over the local proxy socket;
// the connection UUID must independently appear in its authenticated collector log.
export async function recordProxyRequest(req: FastifyRequest, res: FastifyReply): Promise<boolean> {
    if (!['127.0.0.1', '::ffff:127.0.0.1', '::1'].includes(req.raw.socket.remoteAddress || '')) return false
    const connection = proxyConnection(req.headers[proxyHeader])
    // Protected requests keep their established logging/privacy path. They can
    // never justify filtering a connection notice.
    if (!connection || !ordinaryAccessPath(req.url)) return false
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([key]) => key !== proxyHeader))
    const access = { key: `http-api:${req.id}`, ip: verifiedClientIp(req), timestamp: new Date().toISOString(),
        path: req.url, method: req.method, status: res.statusCode, inspection: inspectAccess({ url: req.url, headers, body: req.body }) }
    // Keep the complete request envelope, including unsafe headers after normal redaction.
    // Each request has its own identity; keep-alive must never collapse later requests.
    return withTransaction(async query => {
        const id = await recordLog({ service: 'hanasand-api', host: 'inspur', level: res.statusCode >= 400 ? 'error' : 'info',
            message: 'proxy_request_completed', sourceEventId: createHash('sha256').update(`proxy-request:${connection.id}:${req.id}`).digest('hex'), timestamp: access.timestamp,
            metadata: { category: 'proxy_request', proxy: connection, access,
                producer: { hostname: process.env.HOSTNAME || 'unknown', pid: process.pid, release: process.env.HANASAND_RELEASE_COMMIT || 'unknown' }, path: redactLogText(req.url), method: req.method,
                status_code: res.statusCode, source: { ip: access.ip }, request: { method: req.method, url: redactLogText(req.url),
                    ...(!access.inspection.headersSafe ? { headers: redactLogValue(headers) } : {}) } } }, query)
        if (!id) return false
        // First completed request wins. A suspicious first request cannot be replaced
        // by a later benign request to make a connection eligible for filtering.
        await query(`INSERT INTO log_proxy_requests(connection_id,service_log_id,connection,access)
            VALUES($1,$2,$3::jsonb,$4::jsonb) ON CONFLICT DO NOTHING`, [connection.id, id, JSON.stringify(connection), JSON.stringify(redactLogValue(access))])
        return true
    })
}
