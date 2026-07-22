import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import { matchApiKeyScope, validateApiKey } from '#utils/auth/apiKeys.ts'
import { validateSession } from '#utils/auth/session.ts'
import { getRateLimitSettings, registerRateLimitRoute } from '#utils/rateLimit/config.ts'
import hasInternalToken from '#utils/auth/internalToken.ts'

type Bucket = {
    count: number
    resetAt: number
}

type RateLimitActor = {
    scope: RateLimitScope
    identifier: string
    apiKey?: Awaited<ReturnType<typeof validateApiKey>>
    invalidApiKey?: boolean
    invalidSession?: boolean
}

const buckets = new Map<string, Bucket>()

export function resetApiKeyRateLimitBuckets(apiKeyId: string) {
    let resetCount = 0
    const prefix = `api_key:${apiKeyId}:`
    for (const key of buckets.keys()) {
        if (key.startsWith(prefix)) {
            buckets.delete(key)
            resetCount += 1
        }
    }
    return resetCount
}

export default fp(async function rateLimitPlugin(fastify: FastifyInstance) {
    fastify.addHook('onRoute', (routeOptions: RouteOptions) => {
        const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method]
        for (const method of methods) {
            registerRateLimitRoute({
                method: String(method),
                route: routeOptions.url,
            })
        }
    })

    fastify.addHook('preHandler', async (req: FastifyRequest, res: FastifyReply) => {
        const path = normalizeRequestPath(req)
        if (req.headers.upgrade?.toLowerCase() === 'websocket' || isInfrastructureWebSocketPath(path) || isBrowserStreamPath(path)) {
            return
        }

        if (!path.startsWith('/api')) {
            return
        }

        if (isTrustedStatusIngest(req, path)) {
            return
        }

        const actor = await resolveRateLimitActor(req)
        if (actor.invalidApiKey) {
            return sendBoundaryError(req, res, 401, 'invalid_api_key', 'The presented API key is invalid, disabled, or expired.')
        }
        if (actor.invalidSession) {
            return sendBoundaryError(req, res, 401, 'invalid_session', 'The presented session is invalid or expired.')
        }
        let apiKeyScope: ReturnType<typeof matchApiKeyScope> = null
        if (actor.apiKey) {
            ;(req as FastifyRequest & { apiKeyAuth?: typeof actor.apiKey }).apiKeyAuth = actor.apiKey
            apiKeyScope = matchApiKeyScope(actor.apiKey.apiKey.scopes, req.method, path)
            if (!apiKeyScope) {
                return sendBoundaryError(req, res, 403, 'scope_forbidden', 'API key is not allowed to access this endpoint.')
            }

        }

        const settings = await getRateLimitSettings()
        if (!settings.enabled) {
            return
        }

        if (actor.apiKey && apiKeyScope) {
            const periodChecks = consumeApiKeyScopeBudgets({
                apiKeyId: actor.apiKey.apiKey.id,
                method: req.method,
                route: path,
                limits: apiKeyScope.limits,
            })

            applyApiKeyLimitHeaders(res, periodChecks)
            const rejected = periodChecks.find((check) => !check.allowed)
            if (rejected) {
                res.header('retry-after', String(Math.max(Math.ceil(rejected.retryAfterMs / 1000), 1)))
                return sendBoundaryError(req, res, 429, 'rate_limit_exceeded', 'API key rate limit exceeded.')
            }
        }

        const scopeRule = settings.defaults[actor.scope]
        const routeRule = resolveRouteRule(settings, req.method, path, actor.scope)

        const globalCheck = consumeBucket({
            key: `${actor.scope}:${actor.identifier}:global`,
            rule: scopeRule,
        })

        applyRateLimitHeaders(res, globalCheck, scopeRule, actor.scope, 'global')

        if (!globalCheck.allowed) {
            return sendRateLimitExceeded(req, res, globalCheck, actor.scope, 'global')
        }

        const routeCheck = consumeBucket({
            key: `${actor.scope}:${actor.identifier}:${req.method}:${path}`,
            rule: routeRule,
        })

        applyRateLimitHeaders(res, routeCheck, routeRule, actor.scope, path)

        if (!routeCheck.allowed) {
            return sendRateLimitExceeded(req, res, routeCheck, actor.scope, path)
        }
    })
})

function isInfrastructureWebSocketPath(path: string) {
    return path.startsWith('/api/client/ws/')
}

function isBrowserStreamPath(path: string) {
    return path.startsWith('/api/browser-stream/')
}

function isTrustedStatusIngest(req: FastifyRequest, path: string) {
    return req.method.toUpperCase() === 'POST'
        && path === '/api/status/ingest'
        && hasInternalToken(req)
}

function resolveRouteRule(settings: RateLimitSettings, method: string, route: string, scope: RateLimitScope) {
    const override = settings.overrides.find((entry) =>
        entry.enabled
        && entry.scope === scope
        && entry.method === method.toUpperCase()
        && entry.route === route
    )

    if (override) {
        return {
            windowMs: override.windowMs,
            maxRequests: override.maxRequests,
        }
    }

    return settings.defaults[scope]
}

export async function resolveRateLimitActor(
    req: FastifyRequest,
    validate: typeof validateApiKey = validateApiKey,
    validateUserSession: typeof validateSession = validateSession,
): Promise<RateLimitActor> {
    const ip = getClientIp(req)

    const apiKeySecret = extractPresentedApiKey(req)
    if (apiKeySecret) {
        const apiKey = await validate(apiKeySecret).catch(() => null)
        if (apiKey) {
            return {
                scope: apiKey.apiKey.tier === 'internal' && apiKey.roles.some((role) => isInternalRole(role.id, role.name)) ? 'internal' : 'authenticated',
                identifier: `api_key:${apiKey.apiKey.id}`,
                apiKey,
            }
        }
        return { scope: 'anonymous', identifier: `ip:${ip}`, invalidApiKey: true }
    }

    const authHeader = req.headers.authorization
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        const headerId = Array.isArray(req.headers.id) ? req.headers.id[0] : req.headers.id
        const session = await validateUserSession({
            id: typeof headerId === 'string' ? headerId : undefined,
            token,
        }).catch(() => null)

        if (session) {
            ;(req as FastifyRequest & { rateLimitSession?: typeof session }).rateLimitSession = session

            return {
                scope: session.roles.some((role) => isInternalRole(role.id, role.name)) ? 'internal' : 'authenticated',
                identifier: `user:${session.user.id}`,
            }
        }

        return { scope: 'anonymous', identifier: `ip:${ip}`, invalidSession: true }
    }

    return {
        scope: 'anonymous',
        identifier: `ip:${ip}`,
    }
}

function isInternalRole(roleId: string, roleName: string) {
    const normalizedId = roleId.toLowerCase()
    const normalizedName = roleName.toLowerCase()
    return ['admin', 'administrator', 'system_admin'].includes(normalizedId)
        || ['admin', 'administrator', 'system administrator'].includes(normalizedName)
}

export function getClientIp(req: Pick<FastifyRequest, 'ip'>) {
    return req.ip || 'unknown'
}

function normalizeRequestPath(req: FastifyRequest) {
    const routePath = req.routeOptions?.url
    if (typeof routePath === 'string' && routePath.startsWith('/')) {
        return routePath
    }

    return req.url.split('?')[0] || '/'
}

function extractPresentedApiKey(req: FastifyRequest) {
    const xApiKey = req.headers['x-api-key']
    if (typeof xApiKey === 'string' && xApiKey.length) {
        return xApiKey
    }

    const authHeader = req.headers.authorization
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        if (token?.startsWith('hsk_')) {
            return token
        }
    }

    return ''
}

function consumeBucket({
    key,
    rule,
}: {
    key: string
    rule: RateLimitRule
}) {
    const now = Date.now()
    const existing = buckets.get(key)
    const bucket = existing && existing.resetAt > now
        ? existing
        : {
            count: 0,
            resetAt: now + rule.windowMs,
        }

    if (bucket.count >= rule.maxRequests) {
        buckets.set(key, bucket)
        return {
            allowed: false,
            remaining: 0,
            resetAt: bucket.resetAt,
            retryAfterMs: bucket.resetAt - now,
        }
    }

    bucket.count += 1
    buckets.set(key, bucket)

    return {
        allowed: true,
        remaining: Math.max(rule.maxRequests - bucket.count, 0),
        resetAt: bucket.resetAt,
        retryAfterMs: Math.max(bucket.resetAt - now, 0),
    }
}

function consumeApiKeyScopeBudgets({
    apiKeyId,
    method,
    route,
    limits,
}: {
    apiKeyId: string
    method: string
    route: string
    limits: ApiKeyPeriodLimits
}) {
    const checks: Array<{
        period: 'second' | 'minute' | 'hour' | 'day'
        limit: number
        allowed: boolean
        remaining: number
        resetAt: number
        retryAfterMs: number
    }> = []

    const periodRules = [
        { period: 'second' as const, windowMs: 1_000, maxRequests: limits.perSecond },
        { period: 'minute' as const, windowMs: 60_000, maxRequests: limits.perMinute },
        { period: 'hour' as const, windowMs: 3_600_000, maxRequests: limits.perHour },
        { period: 'day' as const, windowMs: 86_400_000, maxRequests: limits.perDay },
    ]

    for (const periodRule of periodRules) {
        if (!periodRule.maxRequests || periodRule.maxRequests <= 0) {
            continue
        }

        checks.push({
            period: periodRule.period,
            limit: periodRule.maxRequests,
            ...consumeBucket({
                key: `api_key:${apiKeyId}:${method}:${route}:${periodRule.period}`,
                rule: {
                    windowMs: periodRule.windowMs,
                    maxRequests: periodRule.maxRequests,
                },
            }),
        })
    }

    return checks
}

function applyRateLimitHeaders(
    res: FastifyReply,
    state: { remaining: number, resetAt: number },
    rule: RateLimitRule,
    scope: RateLimitScope,
    target: string,
) {
    res.header('x-rate-limit-limit', String(rule.maxRequests))
    res.header('x-rate-limit-remaining', String(state.remaining))
    res.header('x-rate-limit-reset', new Date(state.resetAt).toISOString())
    res.header('x-rate-limit-scope', scope)
    res.header('x-rate-limit-target', target)
}

function sendRateLimitExceeded(
    req: FastifyRequest,
    res: FastifyReply,
    state: { retryAfterMs: number, resetAt: number },
    scope: RateLimitScope,
    target: string,
) {
    res.header('retry-after', String(Math.max(Math.ceil(state.retryAfterMs / 1000), 1)))
    if (normalizeRequestPath(req).startsWith('/api/v1')) return sendBoundaryError(req, res, 429, 'rate_limit_exceeded', 'Rate limit exceeded.')
    return res.status(429).send({
        error: 'Rate limit exceeded.',
        scope,
        target,
        retryAfterMs: state.retryAfterMs,
        resetAt: new Date(state.resetAt).toISOString(),
    })
}

function sendBoundaryError(req: FastifyRequest, res: FastifyReply, status: number, code: string, message: string) {
    if (normalizeRequestPath(req).startsWith('/api/v1')) {
        res.header('cache-control', 'no-store, max-age=0')
        res.header('x-request-id', req.id)
        return res.status(status).send({ error: { code, message, requestId: req.id } })
    }
    return res.status(status).send({ error: code, message })
}

function applyApiKeyLimitHeaders(
    res: FastifyReply,
    checks: Array<{
        period: 'second' | 'minute' | 'hour' | 'day'
        limit: number
        remaining: number
        resetAt: number
    }>
) {
    for (const check of checks) {
        res.header(`x-api-key-rate-limit-${check.period}`, String(check.limit))
        res.header(`x-api-key-rate-limit-${check.period}-remaining`, String(check.remaining))
        res.header(`x-api-key-rate-limit-${check.period}-reset`, new Date(check.resetAt).toISOString())
    }
}
