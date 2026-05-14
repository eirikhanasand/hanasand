import type { FastifyReply, FastifyRequest } from 'fastify'

type TrafficMetric = 'path' | 'ip' | 'user_agent' | 'domain'

const emptyMetrics = {
    total_requests: 0,
    avg_request_time: 0,
    error_rate: 0,
    top_methods: [],
    top_status_codes: [],
    top_domains: [],
    top_os: [],
    top_browsers: [],
    requests_over_time: [],
    top_error_paths: [],
    top_slow_paths: [],
    top_paths: [],
}

export function getLegacyTrafficSummary(req: FastifyRequest, res: FastifyReply) {
    const metric = readQueryString(req, 'metric') || 'path'
    if (!isTrafficMetric(metric)) {
        return res.status(400).send({
            error: 'Unsupported traffic summary metric.',
            allowed: ['path', 'ip', 'user_agent', 'domain'],
        })
    }

    return res.send([])
}

export function getLegacyTrafficRecent(_req: FastifyRequest, res: FastifyReply) {
    return res.send([])
}

export function getLegacyTrafficTps(_req: FastifyRequest, res: FastifyReply) {
    return res.send([])
}

export function getLegacyTrafficIps(_req: FastifyRequest, res: FastifyReply) {
    return res.send([])
}

export function getLegacyTrafficUserAgents(_req: FastifyRequest, res: FastifyReply) {
    return res.send([])
}

export function getLegacyTrafficDomains(_req: FastifyRequest, res: FastifyReply) {
    return res.send({ domains: [] })
}

export function getLegacyTrafficMetrics(_req: FastifyRequest, res: FastifyReply) {
    return res.send(emptyMetrics)
}

export function getLegacyTrafficRecords(_req: FastifyRequest, res: FastifyReply) {
    return res.send({ result: [], total: 0 })
}

export function getLegacyBlocklistOverview(_req: FastifyRequest, res: FastifyReply) {
    return res.send([])
}

function readQueryString(req: FastifyRequest, key: string) {
    const query = req.query as Record<string, string | string[] | undefined>
    const value = query[key]

    if (Array.isArray(value)) {
        return value[0]
    }

    return value
}

function isTrafficMetric(value: string): value is TrafficMetric {
    return value === 'path' || value === 'ip' || value === 'user_agent' || value === 'domain'
}
