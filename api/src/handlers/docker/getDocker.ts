import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { isRuntimeLogSourceAvailable } from '#utils/docker/engine.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default async function getDocker(this: FastifyInstance, req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const cached = JSON.parse(this.docker.toString())
        const payload = cached?.data ?? cached

        if (cached?.status && cached.status >= 400) {
            return res.status(cached.status).send(payload)
        }

        const cachedContainers = normalizeCachedContainers(payload)
        if (cachedContainers.length) {
            return res.type('application/json').send({
                ...payload,
                containers: cachedContainers,
                source: 'cached_docker_engine',
                docker_socket_available: true,
            })
        }

        return res.type('application/json').send({
            containers: [],
            source: 'unavailable',
            docker_socket_available: isRuntimeLogSourceAvailable(),
            unavailable_reason: 'Docker telemetry cache is warming up.',
            generated_at: new Date().toISOString(),
        })
    } catch (error: any) {
        console.error('Error calling docker endpoint:', error)
        return res.status(500).send({ error: error.message })
    }
}

function normalizeCachedContainers(payload: unknown) {
    if (Array.isArray(payload)) return payload
    if (payload && typeof payload === 'object') {
        const value = payload as { data?: unknown, containers?: unknown }
        if (Array.isArray(value.containers)) return value.containers
        if (Array.isArray(value.data)) return value.data
    }
    return []
}
