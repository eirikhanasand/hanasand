const NEXTJS_DEFAULTS = {
    port: 3000,
    healthPath: '/',
}

const FASTIFY_DEFAULTS = {
    port: 3001,
    healthPath: '/ready',
}

export type DeployDefaults = {
    port: number
    healthPath: string
    inferred: boolean
    reason: string
}

export function inferDeployDefaults(stackType: AIStackType, input?: { port?: unknown, healthPath?: unknown }): DeployDefaults {
    const stackDefaults = getStackDefaults(stackType)
    const rawPort = typeof input?.port === 'number' || typeof input?.port === 'string'
        ? Number(input?.port)
        : Number.NaN
    const requestedHealthPath = typeof input?.healthPath === 'string' ? input.healthPath.trim() : ''
    const port = Number.isFinite(rawPort) && rawPort > 0 ? Math.trunc(rawPort) : stackDefaults.port
    const healthPath = normalizeHealthPath(requestedHealthPath || stackDefaults.healthPath)
    const inferredPort = !Number.isFinite(rawPort) || rawPort <= 0
    const inferredPath = requestedHealthPath.length === 0

    return {
        port,
        healthPath,
        inferred: inferredPort || inferredPath,
        reason: inferredPort || inferredPath
            ? `Using ${stackType === 'unknown' ? 'fallback' : stackType.replaceAll('_', ' ')} deploy defaults (${port}${healthPath}).`
            : 'Using explicit deploy port and health path.',
    }
}

export function parseHealthcheckUrlDefaults(healthcheckUrl: string | null | undefined, stackType: AIStackType): DeployDefaults {
    if (typeof healthcheckUrl === 'string' && healthcheckUrl.trim().length > 0) {
        try {
            const target = new URL(healthcheckUrl)
            return {
                port: Number(target.port || getStackDefaults(stackType).port),
                healthPath: normalizeHealthPath(target.pathname || '/'),
                inferred: false,
                reason: `Reusing release healthcheck target ${target.port || getStackDefaults(stackType).port}${target.pathname || '/'} for restore.`,
            }
        } catch {
            return inferDeployDefaults(stackType)
        }
    }

    return inferDeployDefaults(stackType)
}

function getStackDefaults(stackType: AIStackType) {
    switch (stackType) {
        case 'fastify_postgres':
        case 'fastify_worker_redis':
            return FASTIFY_DEFAULTS
        case 'nextjs_docker':
            return NEXTJS_DEFAULTS
        default:
            return NEXTJS_DEFAULTS
    }
}

function normalizeHealthPath(path: string) {
    const trimmed = path.trim()
    if (!trimmed) {
        return '/'
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
