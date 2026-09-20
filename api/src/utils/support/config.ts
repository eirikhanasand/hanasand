import { timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'

export function supportServiceConfigured() { return Boolean(process.env.SUPPORT_SERVICE_BASE && process.env.SUPPORT_SERVICE_KEY) }
export function shouldProxySupport(path: string) {
    return supportServiceConfigured() && process.env.SUPPORT_INTERNAL_SERVICE !== '1' && supportRequestPath(path.split('?')[0])
}
export function hasSupportServiceKey(req: FastifyRequest) {
    const expected = process.env.SUPPORT_SERVICE_KEY
    const received = req.headers['x-support-service-key']
    return Boolean(expected && typeof received === 'string' && expected.length >= 32 && Buffer.byteLength(received) === Buffer.byteLength(expected)
        && timingSafeEqual(Buffer.from(received), Buffer.from(expected)))
}
export function supportRequestPath(path: string) {
    return /^\/api\/support\/(chat|tickets(?:\/[^/]+\/(?:messages|status|feedback))?)$/.test(path)
}
