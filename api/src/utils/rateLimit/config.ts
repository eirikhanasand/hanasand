import run from '#db'

const SETTINGS_ID = 'global'
const CACHE_TTL_MS = 5000
export const RATE_LIMIT_BUCKET_CLEANUP_BATCH = 100
export const RATE_LIMIT_BUCKET_RETENTION_MS = 2 * 24 * 60 * 60 * 1000
const routeCatalog = new Map<string, RateLimitRoute>()

const DEFAULT_SETTINGS: Omit<RateLimitSettings, 'updatedAt' | 'updatedBy'> = {
    enabled: true,
    defaults: {
        anonymous: {
            windowMs: 60_000,
            maxRequests: 90,
        },
        authenticated: {
            windowMs: 60_000,
            maxRequests: 1_800,
        },
        internal: {
            windowMs: 60_000,
            maxRequests: 6_000,
        },
    },
    overrides: [],
}

let cachedSettings: RateLimitSettings | null = null
let cachedAt = 0

type RateLimitSettingsValidationResult = {
    valid: boolean
    settings: RateLimitSettings
    error: string | null
}

export async function consumeSharedRateLimitBucket(
    { key, rule }: { key: string, rule: RateLimitRule },
    query: typeof run = run,
) {
    const result = await query(`
        WITH expired AS (
            SELECT bucket_key
            FROM api_rate_limit_buckets
            WHERE updated_at < NOW() - ($4 * INTERVAL '1 millisecond')
              AND bucket_key <> $1
            ORDER BY updated_at
            LIMIT $5
        ),
        cleaned AS (
            DELETE FROM api_rate_limit_buckets bucket
            USING expired
            WHERE bucket.bucket_key = expired.bucket_key
              AND bucket.updated_at < NOW() - ($4 * INTERVAL '1 millisecond')
            RETURNING 1
        ),
        consumed AS (
            INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
            VALUES (
                $1,
                to_timestamp(floor(extract(epoch FROM NOW()) * 1000 / $2) * $2 / 1000),
                1,
                NOW()
            )
            ON CONFLICT (bucket_key) DO UPDATE SET
                window_started_at = EXCLUDED.window_started_at,
                request_count = CASE
                    WHEN api_rate_limit_buckets.window_started_at = EXCLUDED.window_started_at
                        THEN LEAST(api_rate_limit_buckets.request_count + 1, $3 + 1)
                    ELSE 1
                END,
                updated_at = NOW()
            RETURNING
                request_count,
                window_started_at + ($2 * INTERVAL '1 millisecond') AS reset_at,
                GREATEST(
                    EXTRACT(EPOCH FROM (window_started_at + ($2 * INTERVAL '1 millisecond') - NOW())) * 1000,
                    0
                ) AS retry_after_ms
        )
        SELECT consumed.*, (SELECT COUNT(*)::int FROM cleaned) AS cleanup_count
        FROM consumed
    `, [key, rule.windowMs, rule.maxRequests, RATE_LIMIT_BUCKET_RETENTION_MS, RATE_LIMIT_BUCKET_CLEANUP_BATCH])
    const count = Number(result.rows[0]?.request_count)
    const resetAt = new Date(result.rows[0]?.reset_at).getTime()
    const retryAfterMs = Number(result.rows[0]?.retry_after_ms)
    const allowed = Number.isFinite(count) && count <= rule.maxRequests
    return {
        allowed,
        remaining: allowed ? Math.max(rule.maxRequests - count, 0) : 0,
        resetAt,
        retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
        cleanupCount: Number(result.rows[0]?.cleanup_count) || 0,
    }
}

export async function resetSharedRateLimitBuckets(prefix: string, query: typeof run = run) {
    const result = await query(`
        DELETE FROM api_rate_limit_buckets
        WHERE LEFT(bucket_key, LENGTH($1)) = $1
    `, [prefix])
    return result.rowCount ?? 0
}

export async function getRateLimitSettings({ fresh = false }: { fresh?: boolean } = {}): Promise<RateLimitSettings> {
    if (!fresh && cachedSettings && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedSettings
    }

    const result = await run(`
        SELECT config_json, updated_at, updated_by
        FROM api_rate_limit_settings
        WHERE id = $1
        LIMIT 1
    `, [SETTINGS_ID])

    const row = result.rows[0] as {
        config_json?: unknown
        updated_at?: string | null
        updated_by?: string | null
    } | undefined

    const normalized = normalizeSettings(row?.config_json, {
        updatedAt: row?.updated_at || null,
        updatedBy: row?.updated_by || null,
    })

    cachedSettings = normalized
    cachedAt = Date.now()
    return normalized
}

export async function saveRateLimitSettings(input: unknown, updatedBy: string): Promise<RateLimitSettings> {
    const normalized = normalizeSettings(input, {
        updatedAt: null,
        updatedBy,
    })

    const result = await run(`
        INSERT INTO api_rate_limit_settings (id, config_json, updated_by, updated_at)
        VALUES ($1, $2::jsonb, $3, NOW())
        ON CONFLICT (id) DO UPDATE SET
            config_json = EXCLUDED.config_json,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        RETURNING updated_at, updated_by
    `, [SETTINGS_ID, JSON.stringify(stripRateLimitMeta(normalized)), updatedBy])

    const saved = {
        ...normalized,
        updatedAt: result.rows[0]?.updated_at || new Date().toISOString(),
        updatedBy: result.rows[0]?.updated_by || updatedBy,
    }

    cachedSettings = saved
    cachedAt = Date.now()
    return saved
}

export function validateRateLimitSettingsInput(
    input: unknown,
    meta: { updatedAt?: string | null, updatedBy?: string | null } = {}
): RateLimitSettingsValidationResult {
    const settings = normalizeSettings(input, {
        updatedAt: meta.updatedAt || null,
        updatedBy: meta.updatedBy || null,
    })

    const seen = new Set<string>()
    for (const override of settings.overrides) {
        if (!override.route.startsWith('/api')) {
            return {
                valid: false,
                settings,
                error: `Override route must stay inside the API namespace: ${override.method} ${override.route}.`,
            }
        }

        const key = `${override.scope}:${override.method}:${override.route}`
        if (seen.has(key)) {
            return {
                valid: false,
                settings,
                error: `Duplicate override detected for ${override.scope} ${override.method} ${override.route}.`,
            }
        }

        seen.add(key)
    }

    return {
        valid: true,
        settings,
        error: null,
    }
}

export function registerRateLimitRoute(route: RateLimitRoute) {
    const method = normalizeMethod(route.method)
    const normalizedRoute = normalizeRoute(route.route)
    if (!method || !normalizedRoute.startsWith('/api')) {
        return
    }

    routeCatalog.set(`${method} ${normalizedRoute}`, {
        method,
        route: normalizedRoute,
    })
}

export function listRateLimitRoutes(): RateLimitRoute[] {
    return Array.from(routeCatalog.values()).sort((left, right) => {
        if (left.route === right.route) {
            return left.method.localeCompare(right.method)
        }

        return left.route.localeCompare(right.route)
    })
}

function stripRateLimitMeta(settings: RateLimitSettings) {
    return {
        enabled: settings.enabled,
        defaults: settings.defaults,
        overrides: settings.overrides,
    }
}

function normalizeSettings(
    input: unknown,
    meta: { updatedAt: string | null, updatedBy: string | null },
): RateLimitSettings {
    const raw = input && typeof input === 'object' ? input as Partial<RateLimitSettings> : {}
    const defaults = raw.defaults && typeof raw.defaults === 'object'
        ? raw.defaults as Partial<Record<RateLimitScope, RateLimitRule>>
        : {}

    return {
        enabled: raw.enabled !== false,
        defaults: {
            anonymous: normalizeRule(defaults.anonymous, DEFAULT_SETTINGS.defaults.anonymous),
            authenticated: normalizeRule(defaults.authenticated, DEFAULT_SETTINGS.defaults.authenticated),
            internal: normalizeRule(defaults.internal, DEFAULT_SETTINGS.defaults.internal),
        },
        overrides: Array.isArray(raw.overrides)
            ? raw.overrides.map((override, index) => normalizeOverride(override, index)).filter(Boolean) as RateLimitOverride[]
            : [],
        updatedAt: meta.updatedAt,
        updatedBy: meta.updatedBy,
    }
}

function normalizeOverride(input: unknown, index: number): RateLimitOverride | null {
    if (!input || typeof input !== 'object') {
        return null
    }

    const raw = input as Partial<RateLimitOverride>
    const method = normalizeMethod(raw.method)
    const route = normalizeRoute(raw.route)
    const scope = normalizeScope(raw.scope)

    if (!method || !route) {
        return null
    }

    return {
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `override_${index}_${method}_${route}_${scope}`,
        enabled: raw.enabled !== false,
        method,
        route,
        scope,
        windowMs: clampWindowMs(raw.windowMs),
        maxRequests: clampMaxRequests(raw.maxRequests),
    }
}

function normalizeRule(input: unknown, fallback: RateLimitRule): RateLimitRule {
    if (!input || typeof input !== 'object') {
        return fallback
    }

    const raw = input as Partial<RateLimitRule>
    return {
        windowMs: clampWindowMs(raw.windowMs ?? fallback.windowMs),
        maxRequests: clampMaxRequests(raw.maxRequests ?? fallback.maxRequests),
    }
}

function normalizeScope(value: unknown): RateLimitScope {
    return value === 'authenticated' || value === 'internal' ? value : 'anonymous'
}

function normalizeMethod(value: unknown) {
    if (typeof value !== 'string') {
        return ''
    }

    const method = value.trim().toUpperCase()
    return method
}

function normalizeRoute(value: unknown) {
    if (typeof value !== 'string') {
        return ''
    }

    const route = value.trim()
    if (!route) {
        return ''
    }

    return route.startsWith('/') ? route : `/${route}`
}

function clampWindowMs(value: unknown) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return 60_000
    }

    return Math.min(Math.max(Math.round(number), 1_000), 86_400_000)
}

function clampMaxRequests(value: unknown) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return 60
    }

    return Math.min(Math.max(Math.round(number), 1), 1_000_000)
}
