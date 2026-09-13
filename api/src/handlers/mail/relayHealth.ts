import type { FastifyReply, FastifyRequest } from 'fastify'

const endpoints = {
    inspur: 'http://mail-relay-inspur:8080/health',
    ovh: 'http://mail-relay-inspur:8081/health',
} as const

// Like /ready, this exposes service readiness only, never messages or credentials.
export default async function relayHealth(req: FastifyRequest<{ Params: { site: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const site = req.params.site
    if (site !== 'inspur' && site !== 'ovh') return res.status(404).send({ error: 'Unknown mail relay.' })
    try {
        const response = await fetch(endpoints[site], { signal: AbortSignal.timeout(2500), redirect: 'error' })
        const body = await response.json() as { service?: unknown, checkedAt?: unknown, ok?: unknown, checks?: Record<string, unknown> }
        const age = typeof body.checkedAt === 'string' ? Date.now() - Date.parse(body.checkedAt) : NaN
        const valid = body.service === `mail-relay-${site}` && Number.isFinite(age) && age >= -5000 && age <= 90_000
        const keys = site === 'inspur' ? ['smtpAuthentication', 'queueHealthy', 'relayAuthentication', 'tunnel'] : ['smtpAuthentication', 'queueHealthy', 'outboundDeliveryConnection']
        const checks = Object.fromEntries(keys.map(key => [key, body.checks?.[key] === true]))
        const ok = valid && response.ok && body.ok === true && Object.values(checks).every(Boolean)
        return res.status(ok ? 200 : 503).send({ service: `mail-relay-${site}`, ok, checkedAt: valid ? body.checkedAt : null, checks,
            summary: ok ? 'Mail relay is ready.' : 'Mail relay needs attention.' })
    } catch {
        return res.status(503).send({ service: `mail-relay-${site}`, ok: false, checkedAt: null, summary: 'Mail relay health is unavailable.' })
    }
}
