import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import { matchApiKeyScope, organizationPublicApiScopes, validateApiKey } from '#utils/auth/apiKeys.ts'
import { validateSession } from '#utils/auth/session.ts'
import {
    consumeSharedRateLimitBucket,
    getRateLimitSettings,
    registerRateLimitRoute,
    resetSharedRateLimitBuckets,
} from '#utils/rateLimit/config.ts'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { verifiedClientIp } from '#utils/http/publicBoundary.ts'
import { withTransaction } from '#db'

type RateLimitActor = {
    scope: RateLimitScope
    identifier: string
    apiKey?: Awaited<ReturnType<typeof validateApiKey>>
    invalidApiKey?: boolean
    invalidSession?: boolean
}

const sessionBatchScope = organizationPublicApiScopes().find(scope =>
    scope.method === 'POST' && scope.route === '/api/v1/ti/search/batch'
)

export async function resetApiKeyRateLimitBuckets(apiKeyId: string) {
    return resetSharedRateLimitBuckets(`api_key:${apiKeyId}:`)
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

    fastify.addHook('preHandler', (req, res, done) => {
        void enforceRateLimit(req, res).then(proceed => {
            if (proceed) done()
        }, error => done(error as Error))
    })
})

async function enforceRateLimit(req: FastifyRequest, res: FastifyReply) {
    const path = normalizeRequestPath(req)
    if (
        req.headers.upgrade?.toLowerCase() === 'websocket'
        || isInfrastructureWebSocketPath(path)
        || isBrowserStreamPath(path)
        || !path.startsWith('/api')
        || isTrustedStatusIngest(req, path)
    ) return true

    const actor = await resolveRateLimitActor(req)
    if (actor.invalidApiKey) {
        sendBoundaryError(req, res, 401, 'invalid_api_key', 'The presented API key is invalid, disabled, or expired.')
        return false
    }
    if (actor.invalidSession) {
        sendBoundaryError(req, res, 401, 'invalid_session', 'The presented session is invalid or expired.')
        return false
    }
    let apiKeyScope: ReturnType<typeof matchApiKeyScope> = null
    if (actor.apiKey) {
        ;(req as FastifyRequest & { apiKeyAuth?: typeof actor.apiKey }).apiKeyAuth = actor.apiKey
        apiKeyScope = matchApiKeyScope(actor.apiKey.apiKey.scopes, req.method, path)
        if (!apiKeyScope) {
            sendBoundaryError(req, res, 403, 'scope_forbidden', 'API key is not allowed to access this endpoint.')
            return false
        }
    }

    const settings = await getRateLimitSettings()
    if (!settings.enabled) return true

    const periodLimits = credentialPeriodLimits({
        actorIdentifier: actor.identifier,
        apiKeyScope,
        method: req.method,
        route: path,
    })
    if (periodLimits) {
        const periodChecks = await consumeCredentialPeriodBudgets({
            actorIdentifier: actor.identifier,
            method: req.method,
            route: path,
            limits: periodLimits,
        })

        applyCredentialLimitHeaders(res, periodChecks)
        const rejected = periodChecks
            .filter((check) => !check.allowed)
            .sort((left, right) => right.retryAfterMs - left.retryAfterMs)[0]
        if (rejected) {
            res.header('retry-after', String(Math.max(Math.ceil(rejected.retryAfterMs / 1000), 1)))
            sendBoundaryError(req, res, 429, 'rate_limit_exceeded', 'Credential rate limit exceeded.')
            return false
        }
    }

    const scopeRule = settings.defaults[actor.scope]
    const routeRule = resolveRouteRule(settings, req.method, path, actor.scope)
    const globalCheck = await consumeSharedRateLimitBucket({
        key: `${actor.identifier}:global:${actor.scope}`,
        rule: scopeRule,
    })
    applyRateLimitHeaders(res, globalCheck, scopeRule, actor.scope, 'global')
    if (!globalCheck.allowed) {
        sendRateLimitExceeded(req, res, globalCheck, actor.scope, 'global')
        return false
    }

    const routeCheck = await consumeSharedRateLimitBucket({
        key: `${actor.identifier}:route:${actor.scope}:${req.method}:${path}`,
        rule: routeRule,
    })
    applyRateLimitHeaders(res, routeCheck, routeRule, actor.scope, path)
    if (!routeCheck.allowed) {
        sendRateLimitExceeded(req, res, routeCheck, actor.scope, path)
        return false
    }
    return true
}

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
    const ip = verifiedClientIp(req)

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

export function credentialPeriodLimits({
    actorIdentifier,
    apiKeyScope,
    method,
    route,
}: {
    actorIdentifier: string
    apiKeyScope: ReturnType<typeof matchApiKeyScope>
    method: string
    route: string
}) {
    if (apiKeyScope) return apiKeyScope.limits
    if (
        actorIdentifier.startsWith('user:')
        && method.toUpperCase() === 'POST'
        && route === '/api/v1/ti/search/batch'
    ) return sessionBatchScope?.limits ?? null
    return null
}

async function consumeCredentialPeriodBudgets({
    actorIdentifier,
    method,
    route,
    limits,
}: {
    actorIdentifier: string
    method: string
    route: string
    limits: ApiKeyPeriodLimits
}) {
    const periodRules = [
        { period: 'second' as const, windowMs: 1_000, maxRequests: limits.perSecond },
        { period: 'minute' as const, windowMs: 60_000, maxRequests: limits.perMinute },
        { period: 'hour' as const, windowMs: 3_600_000, maxRequests: limits.perHour },
        { period: 'day' as const, windowMs: 86_400_000, maxRequests: limits.perDay },
    ]

    return withTransaction(async query => {
        const checks = []
        for (const periodRule of periodRules) {
            if (!periodRule.maxRequests || periodRule.maxRequests <= 0) continue
            checks.push({
                period: periodRule.period,
                limit: periodRule.maxRequests,
                ...await consumeSharedRateLimitBucket({
                    key: `${actorIdentifier}:endpoint:${method}:${route}:${periodRule.period}`,
                    rule: {
                        windowMs: periodRule.windowMs,
                        maxRequests: periodRule.maxRequests,
                    },
                }, query),
            })
        }
        return checks
    })
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

function applyCredentialLimitHeaders(
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
