import type { FastifyRequest } from 'fastify'
import config from '#constants'

export default function hasInternalToken(req: FastifyRequest) {
    const authHeader = req.headers['authorization']
    if (!authHeader || Array.isArray(authHeader)) {
        return false
    }

    const rawToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : authHeader

    try {
        return decodeURIComponent(rawToken) === config.vm_api_token
    } catch {
        return rawToken === config.vm_api_token
    }
}
