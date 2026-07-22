import type { FastifyRequest } from 'fastify'

const DEFAULT_API_ORIGINS = [
    'https://hanasand.com',
    'https://www.hanasand.com',
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']),
]

export const TRUSTED_API_PROXIES = ['127.0.0.1', '::1']

export function verifiedClientIp(request: Pick<FastifyRequest, 'ip'>) {
    return request.ip || 'unknown'
}

export function isAllowedApiOrigin(origin?: string, configured = process.env.API_CORS_ALLOWED_ORIGINS) {
    if (!origin) return true
    const allowed = new Set([
        ...DEFAULT_API_ORIGINS,
        ...(configured ?? '').split(',').map(value => value.trim()).filter(Boolean),
    ])
    return allowed.has(origin)
}
