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
        const presented = decodeURIComponent(rawToken)
        return presented === config.vm_api_token || Boolean(process.env.VM_API_TOKEN_PREVIOUS && presented === process.env.VM_API_TOKEN_PREVIOUS)
    } catch {
        return rawToken === config.vm_api_token || Boolean(process.env.VM_API_TOKEN_PREVIOUS && rawToken === process.env.VM_API_TOKEN_PREVIOUS)
    }
}
