import { createHash, randomBytes, randomUUID } from 'crypto'
import run from '#db'

export const API_KEY_TIER_ORDER: ApiKeyTierPreset[] = ['starter', 'growth', 'business', 'internal', 'custom']

const API_KEY_TIER_PRESETS: Record<ApiKeyTierPreset, ApiKeyTierDefinition> = {
    starter: {
        id: 'starter',
        label: 'Starter',
        description: 'Low-volume external integrations.',
        defaultLimits: {
            perSecond: 2,
            perMinute: 60,
            perHour: 1_000,
            perDay: 10_000,
        },
    },
    growth: {
        id: 'growth',
        label: 'Growth',
        description: 'Steady third-party traffic with moderate burst room.',
        defaultLimits: {
            perSecond: 8,
            perMinute: 240,
            perHour: 6_000,
            perDay: 60_000,
        },
    },
    business: {
        id: 'business',
        label: 'Business',
        description: 'Higher-throughput production integrations.',
        defaultLimits: {
            perSecond: 20,
            perMinute: 600,
            perHour: 24_000,
            perDay: 250_000,
        },
    },
    internal: {
        id: 'internal',
        label: 'Internal',
        description: 'Trusted internal automations and operations.',
        defaultLimits: {
            perSecond: 60,
            perMinute: 3_000,
            perHour: 120_000,
            perDay: 1_000_000,
        },
    },
    custom: {
        id: 'custom',
        label: 'Custom',
        description: 'Manually tuned per-endpoint limits.',
        defaultLimits: {
            perSecond: 5,
            perMinute: 60,
            perHour: 1_000,
            perDay: 10_000,
        },
    },
}

type ApiKeyRow = {
    id: string
    owner_id: string
    name: string
    tier: string
    description: string | null
    enabled: boolean
    key_prefix: string
    secret_hash: string
    expires_at: string | null
    last_used_at: string | null
    created_at: string
    updated_at: string
}

type ApiKeyScopeRow = {
    id: string
    api_key_id: string
    method: string
    route: string
    enabled: boolean
    per_second: number | null
    per_minute: number | null
    per_hour: number | null
    per_day: number | null
}

type ApiKeyRoleRow = {
    id: string
    name: string
    description: string
    priority: number
}

export async function listApiKeys() {
    const keysResult = await run(`
        SELECT id, owner_id, name, tier, description, enabled, key_prefix, expires_at, last_used_at, created_at, updated_at
        FROM api_keys
        ORDER BY created_at DESC
    `)
    const scopeResult = await run(`
        SELECT id, api_key_id, method, route, enabled, per_second, per_minute, per_hour, per_day
        FROM api_key_scopes
        ORDER BY method ASC, route ASC, created_at ASC
    `)

    const scopesByKey = new Map<string, ApiKeyScopeRule[]>()
    for (const row of scopeResult.rows as ApiKeyScopeRow[]) {
        const scope = toApiKeyScopeRule(row)
        const list = scopesByKey.get(row.api_key_id) || []
        list.push(scope)
        scopesByKey.set(row.api_key_id, list)
    }

    return (keysResult.rows as ApiKeyRow[]).map((row) => toApiKeySummary(row, scopesByKey.get(row.id) || []))
}

export function listApiKeyTierPresets() {
    return API_KEY_TIER_ORDER.map((id) => API_KEY_TIER_PRESETS[id])
}

export function normalizeApiKeyTier(value: unknown): ApiKeyTierPreset {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return API_KEY_TIER_ORDER.find((tier) => tier === normalized) || 'custom'
}

export function validateApiKeyScopes(scopes: unknown) {
    const normalizedScopes = normalizeScopeInputs(scopes)
    if (!normalizedScopes.length) {
        return {
            valid: false,
            scopes: [] as ApiKeyScopeRule[],
            error: 'At least one API key scope is required.',
        }
    }

    const seen = new Set<string>()
    for (const scope of normalizedScopes) {
        const key = `${scope.method}:${scope.route}`
        if (seen.has(key)) {
            return {
                valid: false,
                scopes: normalizedScopes,
                error: `Duplicate API key scope for ${scope.method} ${scope.route}.`,
            }
        }
        seen.add(key)
    }

    return {
        valid: true,
        scopes: normalizedScopes,
        error: null,
    }
}

export function validateApiKeyFields(input: {
    ownerId?: unknown
    name?: unknown
    tier?: unknown
    description?: unknown
    expiresAt?: unknown
}) {
    const missing = [
        [input.ownerId, 'ownerId'],
        [input.name, 'name'],
        [input.tier, 'tier'],
        [input.expiresAt, 'expiresAt'],
        [input.description, 'description'],
    ].find(([value]) => typeof value !== 'string' || !value.trim())
    if (missing) return { valid: false, error: `Missing required API key field: ${missing[1]}.` }

    if (Number.isNaN(Date.parse(String(input.expiresAt)))) {
        return { valid: false, error: 'expiresAt must be a valid date.' }
    }

    return { valid: true, error: null }
}

export async function createApiKey(input: {
    ownerId: string
    name: string
    tier: ApiKeyTierPreset | string
    description?: string | null
    enabled?: boolean
    expiresAt?: string | null
    scopes?: ApiKeyScopeRule[]
}): Promise<ApiKeyCreateResult> {
    const id = randomUUID()
    const secret = buildApiKeySecret()
    const keyPrefix = extractApiKeyPrefix(secret)
    const hash = hashApiKeySecret(secret)

    const result = await run(`
        INSERT INTO api_keys (
            id, owner_id, name, tier, description, enabled, key_prefix, secret_hash, expires_at, last_used_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, NULL, NOW(), NOW())
        RETURNING id, owner_id, name, tier, description, enabled, key_prefix, secret_hash, expires_at, last_used_at, created_at, updated_at
    `, [
        id,
        input.ownerId,
        input.name.trim(),
        normalizeApiKeyTier(input.tier),
        input.description?.trim() || null,
        input.enabled !== false,
        keyPrefix,
        hash,
        input.expiresAt || null,
    ])

    await replaceApiKeyScopes(id, normalizeScopeInputs(input.scopes))
    const scopes = await getApiKeyScopes(id)

    return {
        apiKey: toApiKeySummary(result.rows[0] as ApiKeyRow, scopes),
        secret,
    }
}

export async function updateApiKey(id: string, input: {
    ownerId: string
    name: string
    tier: ApiKeyTierPreset | string
    description?: string | null
    enabled?: boolean
    expiresAt?: string | null
    scopes?: ApiKeyScopeRule[]
}) {
    const result = await run(`
        UPDATE api_keys
        SET owner_id = $2,
            name = $3,
            tier = $4,
            description = $5,
            enabled = $6,
            expires_at = $7::timestamptz,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, owner_id, name, tier, description, enabled, key_prefix, secret_hash, expires_at, last_used_at, created_at, updated_at
    `, [
        id,
        input.ownerId,
        input.name.trim(),
        normalizeApiKeyTier(input.tier),
        input.description?.trim() || null,
        input.enabled !== false,
        input.expiresAt || null,
    ])

    if (!result.rows.length) {
        return null
    }

    await replaceApiKeyScopes(id, normalizeScopeInputs(input.scopes))
    const scopes = await getApiKeyScopes(id)
    return toApiKeySummary(result.rows[0] as ApiKeyRow, scopes)
}

export async function deleteApiKey(id: string) {
    const result = await run('DELETE FROM api_keys WHERE id = $1', [id])
    return (result.rowCount || 0) > 0
}

export async function validateApiKey(secret: string) {
    const prefix = extractApiKeyPrefix(secret)
    if (!prefix) {
        return null
    }

    const result = await run(`
        SELECT id, owner_id, name, tier, description, enabled, key_prefix, secret_hash, expires_at, last_used_at, created_at, updated_at
        FROM api_keys
        WHERE key_prefix = $1
          AND enabled IS TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
    `, [prefix])

    const apiKey = result.rows[0] as ApiKeyRow | undefined
    if (!apiKey) {
        return null
    }

    if (hashApiKeySecret(secret) !== apiKey.secret_hash) {
        return null
    }

    const scopes = await getApiKeyScopes(apiKey.id)
    const rolesResult = await run(`
        SELECT r.id, r.name, r.description, r.priority
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
        ORDER BY r.priority ASC, r.id ASC
    `, [apiKey.owner_id])

    await run(`
        UPDATE api_keys
        SET last_used_at = NOW(),
            updated_at = updated_at
        WHERE id = $1
    `, [apiKey.id]).catch(() => {})

    return {
        apiKey: toApiKeySummary(apiKey, scopes),
        ownerId: apiKey.owner_id,
        roles: rolesResult.rows as ApiKeyRoleRow[],
    }
}

export function matchApiKeyScope(scopes: ApiKeyScopeRule[], method: string, route: string) {
    return scopes.find((scope) =>
        scope.enabled
        && scope.method === method.toUpperCase()
        && scope.route === route
    ) || null
}

function buildApiKeySecret() {
    const prefix = randomBytes(6).toString('hex')
    const suffix = randomBytes(24).toString('hex')
    return `hsk_${prefix}_${suffix}`
}

function extractApiKeyPrefix(secret: string) {
    if (!secret.startsWith('hsk_')) {
        return ''
    }

    const parts = secret.split('_')
    return parts[1] || ''
}

function hashApiKeySecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex')
}

async function replaceApiKeyScopes(apiKeyId: string, scopes: ApiKeyScopeRule[]) {
    await run('DELETE FROM api_key_scopes WHERE api_key_id = $1', [apiKeyId])

    for (const scope of scopes) {
        await run(`
            INSERT INTO api_key_scopes (
                id, api_key_id, method, route, enabled, per_second, per_minute, per_hour, per_day, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [
            randomUUID(),
            apiKeyId,
            scope.method.toUpperCase(),
            scope.route,
            scope.enabled !== false,
            normalizeLimit(scope.limits.perSecond),
            normalizeLimit(scope.limits.perMinute),
            normalizeLimit(scope.limits.perHour),
            normalizeLimit(scope.limits.perDay),
        ])
    }
}

function normalizeScopeInputs(scopes: unknown): ApiKeyScopeRule[] {
    if (!Array.isArray(scopes)) {
        return []
    }

    return scopes
        .map((scope, index) => normalizeScopeInput(scope, index))
        .filter((scope): scope is ApiKeyScopeRule => Boolean(scope))
}

function normalizeScopeInput(scope: unknown, index: number): ApiKeyScopeRule | null {
    if (!scope || typeof scope !== 'object') {
        return null
    }

    const raw = scope as Partial<ApiKeyScopeRule>
    const method = typeof raw.method === 'string' ? raw.method.trim().toUpperCase() : ''
    const route = typeof raw.route === 'string' ? raw.route.trim() : ''
    if (!method || !route) {
        return null
    }

    const limits = raw.limits && typeof raw.limits === 'object' ? raw.limits as Partial<ApiKeyPeriodLimits> : {}
    return {
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `scope_${index}_${method}_${route}`,
        enabled: raw.enabled !== false,
        method,
        route: route.startsWith('/') ? route : `/${route}`,
        limits: {
            perSecond: normalizeLimit(limits.perSecond),
            perMinute: normalizeLimit(limits.perMinute),
            perHour: normalizeLimit(limits.perHour),
            perDay: normalizeLimit(limits.perDay),
        },
    }
}

async function getApiKeyScopes(apiKeyId: string) {
    const result = await run(`
        SELECT id, api_key_id, method, route, enabled, per_second, per_minute, per_hour, per_day
        FROM api_key_scopes
        WHERE api_key_id = $1
        ORDER BY method ASC, route ASC, created_at ASC
    `, [apiKeyId])

    return (result.rows as ApiKeyScopeRow[]).map(toApiKeyScopeRule)
}

function toApiKeySummary(row: ApiKeyRow, scopes: ApiKeyScopeRule[]): ApiKeySummary {
    return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        tier: row.tier,
        description: row.description,
        enabled: row.enabled,
        keyPrefix: row.key_prefix,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        scopes,
    }
}

function toApiKeyScopeRule(row: ApiKeyScopeRow): ApiKeyScopeRule {
    return {
        id: row.id,
        enabled: row.enabled,
        method: row.method,
        route: row.route,
        limits: {
            perSecond: row.per_second,
            perMinute: row.per_minute,
            perHour: row.per_hour,
            perDay: row.per_day,
        },
    }
}

function normalizeLimit(value: number | null | undefined) {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) {
        return null
    }

    return Math.round(number)
}
