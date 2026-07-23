import assert from 'node:assert/strict'
import Fastify from 'fastify'
import pg from 'pg'
import type { FastifyRequest } from 'fastify'
import publicTiApi from '../src/handlers/ti/publicApi.ts'
import deleteSelf from '../src/handlers/user/deleteSelf.ts'
import {
    deleteOrganizationMember,
    patchOrganizationMemberRole,
    postOrganizationApiKey,
    postOrganizationOwnershipTransfer,
    putOrganizationSettings,
} from '../src/handlers/organizations.ts'
import rateLimitPlugin, { resolveRateLimitActor } from '../src/plugins/rateLimit.ts'
import {
    createApiKey,
    organizationPublicApiScopes,
    revokeOrganizationApiKey,
    validateApiKey,
} from '../src/utils/auth/apiKeys.ts'
import purgeDeletedAccounts from '../src/utils/auth/purgeDeletedAccounts.ts'
import { queryOnce } from '../src/utils/db.ts'
import {
    consumeSharedRateLimitBucket,
    RATE_LIMIT_BUCKET_CLEANUP_BATCH,
} from '../src/utils/rateLimit/config.ts'

assert.equal(process.env.DB, 'hanasand_commercial_api_test', 'Refusing to run outside the disposable commercial API test database.')

await queryOnce('DROP SCHEMA public CASCADE')
await queryOnce('CREATE SCHEMA public')
await queryOnce(`
    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        reserved BOOLEAN NOT NULL DEFAULT FALSE,
        deletion_requested_at TIMESTAMPTZ,
        deletion_scheduled_at TIMESTAMPTZ,
        deletion_restore_token_hash TEXT
    );
    CREATE TABLE tokens (
        token_id BIGSERIAL PRIMARY KEY,
        id TEXT NOT NULL,
        token TEXT NOT NULL DEFAULT '',
        ip TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        revoked_by TEXT
    );
    CREATE TABLE login_events (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL
    );
    CREATE TABLE attempts (
        id TEXT PRIMARY KEY,
        attempts INT NOT NULL DEFAULT 0,
        ip TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE api_rate_limit_settings (
        id TEXT PRIMARY KEY,
        config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE api_rate_limit_buckets (
        bucket_key TEXT PRIMARY KEY,
        window_started_at TIMESTAMPTZ NOT NULL,
        request_count INT NOT NULL CHECK (request_count >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_api_rate_limit_buckets_updated_at ON api_rate_limit_buckets(updated_at);
    CREATE TABLE roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority INT NOT NULL DEFAULT 1000
    );
    CREATE TABLE user_roles (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
    );
    CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
        default_webhook_policy TEXT NOT NULL DEFAULT 'active_destinations',
        alert_visibility_policy TEXT NOT NULL DEFAULT 'members',
        retention_days INT NOT NULL DEFAULT 365,
        audit_safe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE organization_members (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
        invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        removed_at TIMESTAMPTZ,
        PRIMARY KEY (organization_id, user_id)
    );
    CREATE TABLE organization_invites (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
        accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        accepted_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        UNIQUE (organization_id, email)
    );
    CREATE TABLE organization_watchlist_items (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active',
        archived_at TIMESTAMPTZ
    );
    CREATE TABLE service_logs (
        id BIGSERIAL PRIMARY KEY,
        service TEXT NOT NULL,
        host TEXT NOT NULL DEFAULT 'local',
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE api_keys (
        id TEXT PRIMARY KEY,
        owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'custom',
        description TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        key_prefix TEXT NOT NULL UNIQUE,
        secret_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX api_keys_one_active_org
        ON api_keys(organization_id)
        WHERE organization_id IS NOT NULL AND enabled IS TRUE;
    CREATE TABLE api_key_scopes (
        id TEXT PRIMARY KEY,
        api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        route TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        per_second INT,
        per_minute INT,
        per_hour INT,
        per_day INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
`)

async function migrateOrganizationCreatorAttribution() {
    await queryOnce('ALTER TABLE organizations ALTER COLUMN created_by DROP NOT NULL')
    await queryOnce('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_created_by_fkey')
    await queryOnce('ALTER TABLE organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL')
}

await migrateOrganizationCreatorAttribution()
await migrateOrganizationCreatorAttribution()

await queryOnce(`
    INSERT INTO users (id, name, password, avatar)
    VALUES
        ('commercial-creator', 'Commercial Creator', 'test', ''),
        ('commercial-admin', 'Commercial Admin', 'test', '')
`)
await queryOnce(`
    INSERT INTO tokens (id, token, ip, user_agent)
    VALUES ('commercial-creator', 'commercial-session-token', '127.0.0.1', 'Commercial smoke')
`)
await queryOnce(`
    INSERT INTO organizations (id, name, slug, created_by)
    VALUES ('commercial-org', 'Commercial Organization', 'commercial-organization', 'commercial-creator')
`)
await queryOnce(`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES
        ('commercial-org', 'commercial-creator', 'owner'),
        ('commercial-org', 'commercial-admin', 'admin')
`)

const organizationKey = await createApiKey({
    ownerId: 'commercial-creator',
    organizationId: 'commercial-org',
    name: 'Commercial API',
    tier: 'starter',
    expiresAt: '2027-01-01T00:00:00.000Z',
    scopes: organizationPublicApiScopes(),
})
const legacyUnboundKey = await createApiKey({
    ownerId: 'commercial-creator',
    name: 'Legacy unbound API key',
    tier: 'custom',
    expiresAt: '2027-01-01T00:00:00.000Z',
    scopes: [organizationPublicApiScopes()[2]],
})
assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')
assert.equal((await validateApiKey(legacyUnboundKey.secret))?.ownerId, 'commercial-creator')

await queryOnce(`
    INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
    SELECT 'expired:' || value, NOW() - INTERVAL '3 days', 1, NOW() - INTERVAL '3 days'
    FROM generate_series(1, 150) value
`)
await queryOnce(`
    INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
    VALUES ('fresh:must-survive', NOW(), 1, NOW())
`)
const firstCleanup = await consumeSharedRateLimitBucket({
    key: 'cleanup:probe',
    rule: { windowMs: 60_000, maxRequests: 10 },
})
assert.equal(firstCleanup.cleanupCount, RATE_LIMIT_BUCKET_CLEANUP_BATCH)
assert.equal(Number((await queryOnce('SELECT COUNT(*) count FROM api_rate_limit_buckets WHERE bucket_key LIKE \'expired:%\'')).rows[0].count), 50)
const secondCleanup = await consumeSharedRateLimitBucket({
    key: 'cleanup:probe',
    rule: { windowMs: 60_000, maxRequests: 10 },
})
assert.equal(secondCleanup.cleanupCount, 50)
assert.equal(Number((await queryOnce('SELECT COUNT(*) count FROM api_rate_limit_buckets WHERE bucket_key LIKE \'expired:%\'')).rows[0].count), 0)
assert.equal(Number((await queryOnce('SELECT COUNT(*) count FROM api_rate_limit_buckets WHERE bucket_key = \'fresh:must-survive\'')).rows[0].count), 1)
assert.match((await queryOnce(`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_api_rate_limit_buckets_updated_at'
`)).rows[0].indexdef, /updated_at/)

let app = await commercialApp()
const batchPayload = { queries: ['APT29'] }
const sessionBatch = await app.inject({
    method: 'POST',
    url: '/api/v1/ti/search/batch',
    headers: { authorization: 'Bearer commercial-session-token', id: 'commercial-creator' },
    payload: batchPayload,
})
const apiKeyBatch = await app.inject({
    method: 'POST',
    url: '/api/v1/ti/search/batch',
    headers: { 'x-api-key': organizationKey.secret },
    payload: batchPayload,
})
for (const response of [sessionBatch, apiKeyBatch]) {
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['x-api-key-rate-limit-minute'], '12')
    assert.equal(response.headers['x-api-key-rate-limit-minute-remaining'], '11')
    assert.ok(response.headers['x-request-id'])
}

const sessionMinuteBucket = 'user:commercial-creator:endpoint:POST:/api/v1/ti/search/batch:minute'
const apiKeyMinuteBucket = `api_key:${organizationKey.apiKey.id}:endpoint:POST:/api/v1/ti/search/batch:minute`
assert.equal((await queryOnce(`
    UPDATE api_rate_limit_buckets
    SET request_count = 11
    WHERE bucket_key = ANY($1::text[])
`, [[sessionMinuteBucket, apiKeyMinuteBucket]])).rowCount, 2)
await queryOnce(`
    UPDATE api_rate_limit_buckets
    SET window_started_at = NOW() - INTERVAL '2 seconds'
    WHERE bucket_key IN (
        'user:commercial-creator:endpoint:POST:/api/v1/ti/search/batch:second',
        $1
    )
`, [`api_key:${organizationKey.apiKey.id}:endpoint:POST:/api/v1/ti/search/batch:second`])
await app.close()
app = await commercialApp()

const restartedConcurrentBatches = await Promise.all([
    Promise.all(Array.from({ length: 2 }, () => app.inject({
        method: 'POST',
        url: '/api/v1/ti/search/batch',
        headers: { authorization: 'Bearer commercial-session-token', id: 'commercial-creator' },
        payload: batchPayload,
    }))),
    Promise.all(Array.from({ length: 2 }, () => app.inject({
        method: 'POST',
        url: '/api/v1/ti/search/batch',
        headers: { 'x-api-key': organizationKey.secret },
        payload: batchPayload,
    }))),
])
for (const responses of restartedConcurrentBatches) {
    assert.deepEqual(responses.map(response => response.statusCode).sort(), [200, 429])
    const rejected = responses.find(response => response.statusCode === 429)!
    assert.equal(rejected.json().error.code, 'rate_limit_exceeded')
    assert.equal(rejected.headers['x-api-key-rate-limit-minute'], '12')
    assert.equal(rejected.headers['x-api-key-rate-limit-minute-remaining'], '0')
    const resetAt = Date.parse(String(rejected.headers['x-api-key-rate-limit-minute-reset']))
    const expectedRetry = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1)
    assert.ok(Math.abs(Number(rejected.headers['retry-after']) - expectedRetry) <= 1)
    assert.ok(Number(rejected.headers['retry-after']) > 1, 'the blocking minute window, not the one-second burst window, determines Retry-After')
    assert.ok(rejected.headers['x-request-id'])
}

await queryOnce(`
    INSERT INTO users (id, name, password, avatar)
    VALUES
        ('stale-key-owner', 'Stale Key Owner', 'test', ''),
        ('stale-key-admin', 'Stale Key Admin', 'test', ''),
        ('stale-transfer-owner', 'Stale Transfer Owner', 'test', ''),
        ('stale-transfer-target', 'Stale Transfer Target', 'test', '')
`)
await queryOnce(`
    INSERT INTO tokens (id, token, ip, user_agent)
    VALUES
        ('stale-key-admin', 'stale-key-admin-token', '127.0.0.1', 'Commercial smoke'),
        ('stale-transfer-owner', 'stale-transfer-owner-token', '127.0.0.1', 'Commercial smoke')
`)
await queryOnce(`
    INSERT INTO organizations (id, name, slug, created_by)
    VALUES
        ('stale-key-org', 'Stale Key Organization', 'stale-key-organization', 'stale-key-owner'),
        ('stale-transfer-org', 'Stale Transfer Organization', 'stale-transfer-organization', 'stale-transfer-owner')
`)
await queryOnce(`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES
        ('stale-key-org', 'stale-key-owner', 'owner'),
        ('stale-key-org', 'stale-key-admin', 'admin'),
        ('stale-transfer-org', 'stale-transfer-owner', 'owner'),
        ('stale-transfer-org', 'stale-transfer-target', 'admin')
`)

const staleKeyCreation = await raceAfterOrganizationSnapshot('stale-key-org', () => app.inject({
    method: 'POST',
    url: '/api/organizations/stale-key-org/api-keys',
    headers: { authorization: 'Bearer stale-key-admin-token', id: 'stale-key-admin' },
    payload: { name: 'Stale admin key' },
}), client => client.query(`
    UPDATE organization_members
    SET role = 'member'
    WHERE organization_id = 'stale-key-org'
      AND user_id = 'stale-key-admin'
`))
assert.equal(staleKeyCreation.statusCode, 403, staleKeyCreation.body)
assert.equal(staleKeyCreation.json().error.code, 'organization_role_forbidden')
assert.equal(Number((await queryOnce('SELECT COUNT(*) count FROM api_keys WHERE organization_id = \'stale-key-org\'')).rows[0].count), 0)

await queryOnce(`
    UPDATE organization_members
    SET role = 'admin'
    WHERE organization_id = 'stale-key-org'
      AND user_id = 'stale-key-admin'
`)
await queryOnce('UPDATE organizations SET status = \'archived\' WHERE id = \'stale-key-org\'')
const staleReactivation = await raceAfterOrganizationSnapshot('stale-key-org', () => app.inject({
    method: 'PUT',
    url: '/api/organizations/stale-key-org/settings',
    headers: { authorization: 'Bearer stale-key-admin-token', id: 'stale-key-admin' },
    payload: { lifecycleStatus: 'active' },
}), client => client.query(`
    UPDATE organization_members
    SET role = 'member'
    WHERE organization_id = 'stale-key-org'
      AND user_id = 'stale-key-admin'
`))
assert.equal(staleReactivation.statusCode, 403, staleReactivation.body)
assert.equal((await queryOnce('SELECT status FROM organizations WHERE id = \'stale-key-org\'')).rows[0].status, 'archived')

const staleTransfer = await raceAfterOrganizationSnapshot('stale-transfer-org', () => app.inject({
    method: 'POST',
    url: '/api/organizations/stale-transfer-org/ownership-transfer',
    headers: { authorization: 'Bearer stale-transfer-owner-token', id: 'stale-transfer-owner' },
    payload: { targetUserId: 'stale-transfer-target', reason: 'Concurrent stale-owner proof.' },
}), client => client.query(`
    UPDATE organization_members
    SET role = 'admin'
    WHERE organization_id = 'stale-transfer-org'
      AND user_id = 'stale-transfer-owner'
`))
assert.equal(staleTransfer.statusCode, 403, staleTransfer.body)
assert.deepEqual((await queryOnce(`
    SELECT user_id, role
    FROM organization_members
    WHERE organization_id = 'stale-transfer-org'
    ORDER BY user_id
`)).rows, [
    { user_id: 'stale-transfer-owner', role: 'admin' },
    { user_id: 'stale-transfer-target', role: 'admin' },
])

await insertConcurrentOwnerFixture('concurrent-demotion')
const concurrentDemotions = await Promise.all(['a', 'b'].map(owner => app.inject({
    method: 'PATCH',
    url: `/api/organizations/concurrent-demotion-org/members/concurrent-demotion-owner-${owner}/role`,
    headers: {
        authorization: `Bearer concurrent-demotion-owner-${owner}-token`,
        id: `concurrent-demotion-owner-${owner}`,
    },
    payload: { role: 'admin', reason: 'Concurrent owner demotion proof.' },
})))
assert.deepEqual(concurrentDemotions.map(response => response.statusCode).sort(), [200, 409])
await assertOneViableOwner('concurrent-demotion-org')

await insertConcurrentOwnerFixture('concurrent-removal')
const concurrentRemovals = await Promise.all(['a', 'b'].map(owner => app.inject({
    method: 'DELETE',
    url: `/api/organizations/concurrent-removal-org/members/concurrent-removal-owner-${owner}`,
    headers: {
        authorization: `Bearer concurrent-removal-owner-${owner}-token`,
        id: `concurrent-removal-owner-${owner}`,
    },
})))
assert.deepEqual(concurrentRemovals.map(response => response.statusCode).sort(), [200, 409])
await assertOneViableOwner('concurrent-removal-org')

await insertConcurrentOwnerFixture('delete-remove')
const deleteSelfVsRemoval = await Promise.all([
    app.inject({
        method: 'DELETE',
        url: '/user/self',
        headers: {
            authorization: 'Bearer delete-remove-owner-a-token',
            id: 'delete-remove-owner-a',
        },
    }),
    app.inject({
        method: 'DELETE',
        url: '/api/organizations/delete-remove-org/members/delete-remove-owner-b',
        headers: {
            authorization: 'Bearer delete-remove-owner-a-token',
            id: 'delete-remove-owner-a',
        },
    }),
])
assert.equal(deleteSelfVsRemoval.filter(response => response.statusCode === 200).length, 1)
assert.equal(deleteSelfVsRemoval.filter(response => response.statusCode !== 200).length, 1)
await assertOneViableOwner('delete-remove-org')

await queryOnce(`
    INSERT INTO users (id, name, password, avatar)
    VALUES
        ('concurrent-owner-a', 'Concurrent Owner A', 'test', ''),
        ('concurrent-owner-b', 'Concurrent Owner B', 'test', '')
`)
await queryOnce(`
    INSERT INTO tokens (id, token, ip, user_agent)
    VALUES
        ('concurrent-owner-a', 'concurrent-owner-a-token', '127.0.0.1', 'Commercial smoke'),
        ('concurrent-owner-b', 'concurrent-owner-b-token', '127.0.0.1', 'Commercial smoke')
`)
await queryOnce(`
    INSERT INTO organizations (id, name, slug, created_by)
    VALUES ('concurrent-org', 'Concurrent Organization', 'concurrent-organization', 'concurrent-owner-a')
`)
await queryOnce(`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES
        ('concurrent-org', 'concurrent-owner-a', 'owner'),
        ('concurrent-org', 'concurrent-owner-b', 'owner')
`)
const concurrentOrganizationKey = await createApiKey({
    ownerId: 'concurrent-owner-a',
    organizationId: 'concurrent-org',
    name: 'Concurrent lifecycle API',
    tier: 'starter',
    expiresAt: '2027-01-01T00:00:00.000Z',
    scopes: organizationPublicApiScopes(),
})
const concurrentDeletionResponses = await Promise.all(['a', 'b'].map(owner => app.inject({
    method: 'DELETE',
    url: '/user/self',
    headers: {
        authorization: `Bearer concurrent-owner-${owner}-token`,
        id: `concurrent-owner-${owner}`,
    },
})))
assert.deepEqual(concurrentDeletionResponses.map(response => response.statusCode).sort(), [200, 409])
assert.equal(Number((await queryOnce(`
    SELECT COUNT(*) count
    FROM users
    WHERE id IN ('concurrent-owner-a', 'concurrent-owner-b')
      AND deletion_scheduled_at IS NOT NULL
`)).rows[0].count), 1)
assert.equal(Number((await queryOnce(`
    SELECT COUNT(*) count
    FROM organization_members membership
    JOIN users owner ON owner.id = membership.user_id
    WHERE membership.organization_id = 'concurrent-org'
      AND membership.role = 'owner'
      AND membership.status = 'active'
      AND owner.active IS TRUE
      AND owner.deletion_scheduled_at IS NULL
`)).rows[0].count), 1)
assert.equal((await validateApiKey(concurrentOrganizationKey.secret))?.organizationId, 'concurrent-org')
const concurrentViableOwnerId = (await queryOnce(`
    SELECT id
    FROM users
    WHERE id IN ('concurrent-owner-a', 'concurrent-owner-b')
      AND deletion_scheduled_at IS NULL
`)).rows[0].id as string
await queryOnce('UPDATE users SET deletion_scheduled_at = NOW() + INTERVAL \'30 days\' WHERE id = $1', [concurrentViableOwnerId])
assert.equal(await validateApiKey(concurrentOrganizationKey.secret), null, 'a scheduled-for-deletion owner is not viable key authority')
await queryOnce('UPDATE users SET deletion_scheduled_at = NULL WHERE id = $1', [concurrentViableOwnerId])
assert.equal((await validateApiKey(concurrentOrganizationKey.secret))?.organizationId, 'concurrent-org')

const deleteRequest = {
    method: 'DELETE' as const,
    url: '/user/self',
    headers: {
        authorization: 'Bearer commercial-session-token',
        id: 'commercial-creator',
    },
}

const soleOwnerDeletion = await app.inject(deleteRequest)
assert.equal(soleOwnerDeletion.statusCode, 409)
assert.equal(soleOwnerDeletion.json().code, 'organization_ownership_transfer_required')
assert.equal(soleOwnerDeletion.json().organization_id, 'commercial-org')
assert.equal(soleOwnerDeletion.json().active_api_key, true)
assert.equal((await queryOnce('SELECT deletion_scheduled_at FROM users WHERE id = $1', ['commercial-creator'])).rows[0].deletion_scheduled_at, null)
assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')

await queryOnce(`
    UPDATE organization_members
    SET role = CASE WHEN user_id = 'commercial-admin' THEN 'owner' ELSE 'admin' END
    WHERE organization_id = 'commercial-org'
      AND user_id IN ('commercial-creator', 'commercial-admin')
`)
const transferredDeletion = await app.inject(deleteRequest)
assert.equal(transferredDeletion.statusCode, 200)
assert.equal(transferredDeletion.json().pending_deletion, true)
assert.ok((await queryOnce('SELECT deletion_scheduled_at FROM users WHERE id = $1', ['commercial-creator'])).rows[0].deletion_scheduled_at)
assert.ok((await queryOnce('SELECT revoked_at FROM tokens WHERE id = $1', ['commercial-creator'])).rows[0].revoked_at)
assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')

await queryOnce('UPDATE users SET deletion_scheduled_at = NOW() - INTERVAL \'1 minute\' WHERE id = \'commercial-creator\'')
await purgeDeletedAccounts()
await queryOnce('CHECKPOINT')
await app.close()

const reopened = new pg.Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST,
    database: process.env.DB,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
})
await reopened.connect()
try {
    assert.equal(Number((await reopened.query('SELECT COUNT(*) count FROM users WHERE id = $1', ['commercial-creator'])).rows[0].count), 0)
    assert.deepEqual((await reopened.query('SELECT created_by, status FROM organizations WHERE id = $1', ['commercial-org'])).rows[0], {
        created_by: null,
        status: 'active',
    })
    assert.deepEqual((await reopened.query('SELECT user_id, role, status FROM organization_members WHERE organization_id = $1 ORDER BY user_id', ['commercial-org'])).rows, [
        { user_id: 'commercial-admin', role: 'owner', status: 'active' },
    ])
    assert.deepEqual((await reopened.query('SELECT owner_id, organization_id, enabled FROM api_keys WHERE id = $1', [organizationKey.apiKey.id])).rows[0], {
        owner_id: null,
        organization_id: 'commercial-org',
        enabled: true,
    })
    assert.equal(Number((await reopened.query('SELECT COUNT(*) count FROM api_keys WHERE id = $1', [legacyUnboundKey.apiKey.id])).rows[0].count), 0)
    assert.deepEqual((await reopened.query(`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organizations'
          AND column_name = 'created_by'
    `)).rows[0], { column_name: 'created_by', is_nullable: 'YES' })
    assert.equal((await reopened.query(`
        SELECT confdeltype
        FROM pg_constraint
        WHERE conname = 'organizations_created_by_fkey'
    `)).rows[0].confdeltype, 'n')

    assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')
    await reopened.query('UPDATE organization_members SET status = \'removed\' WHERE organization_id = \'commercial-org\' AND user_id = \'commercial-admin\'')
    assert.equal(await validateApiKey(organizationKey.secret), null, 'an organization key without an active owner must not authenticate')
    await reopened.query('UPDATE organization_members SET status = \'active\' WHERE organization_id = \'commercial-org\' AND user_id = \'commercial-admin\'')
    assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')
    await reopened.query('UPDATE organizations SET status = \'archived\' WHERE id = \'commercial-org\'')
    assert.equal(await validateApiKey(organizationKey.secret), null)
    await reopened.query('UPDATE organizations SET status = \'active\' WHERE id = \'commercial-org\'')
    assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')
} finally {
    await reopened.end()
}

assert.equal((await revokeOrganizationApiKey('commercial-org', organizationKey.apiKey.id))?.enabled, false)
assert.equal(await validateApiKey(organizationKey.secret), null)
assert.equal(await validateApiKey(legacyUnboundKey.secret), null)
const revokedActor = await resolveRateLimitActor({
    ip: '127.0.0.1',
    headers: { 'x-api-key': organizationKey.secret },
} as unknown as FastifyRequest)
assert.equal(revokedActor.invalidApiKey, true, 'revoked keys must reach the invalid_api_key boundary')

console.log('Commercial API PostgreSQL lifecycle smoke passed.')

async function raceAfterOrganizationSnapshot<T>(
    organizationId: string,
    request: () => Promise<T>,
    mutate: (client: pg.Client) => Promise<unknown>,
) {
    const client = new pg.Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST,
        database: process.env.DB,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 5432,
    })
    await client.connect()
    let committed = false
    try {
        await client.query('BEGIN')
        await client.query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [organizationId])
        const pending = request()
        await waitForBlockedOrganizationTransaction()
        await mutate(client)
        await client.query('COMMIT')
        committed = true
        return await pending
    } finally {
        if (!committed) await client.query('ROLLBACK')
        await client.end()
    }
}

async function waitForBlockedOrganizationTransaction() {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const waiting = await queryOnce(`
            SELECT COUNT(*)::int AS waiting
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND wait_event_type = 'Lock'
              AND query ILIKE '%FROM organizations%FOR UPDATE%'
        `)
        if (Number(waiting.rows[0]?.waiting ?? 0) > 0) return
        await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error('Timed out waiting for the organization mutation to block on its transaction lock.')
}

async function insertConcurrentOwnerFixture(prefix: string) {
    await queryOnce(`
        INSERT INTO users (id, name, password, avatar)
        VALUES
            ($1, $2, 'test', ''),
            ($3, $4, 'test', '')
    `, [`${prefix}-owner-a`, `${prefix} Owner A`, `${prefix}-owner-b`, `${prefix} Owner B`])
    await queryOnce(`
        INSERT INTO tokens (id, token, ip, user_agent)
        VALUES
            ($1, $2, '127.0.0.1', 'Commercial smoke'),
            ($3, $4, '127.0.0.1', 'Commercial smoke')
    `, [
        `${prefix}-owner-a`,
        `${prefix}-owner-a-token`,
        `${prefix}-owner-b`,
        `${prefix}-owner-b-token`,
    ])
    await queryOnce(`
        INSERT INTO organizations (id, name, slug, created_by)
        VALUES ($1, $2, $3, $4)
    `, [`${prefix}-org`, `${prefix} Organization`, `${prefix}-organization`, `${prefix}-owner-a`])
    await queryOnce(`
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES
            ($1, $2, 'owner'),
            ($1, $3, 'owner')
    `, [`${prefix}-org`, `${prefix}-owner-a`, `${prefix}-owner-b`])
}

async function assertOneViableOwner(organizationId: string) {
    assert.equal(Number((await queryOnce(`
        SELECT COUNT(*) count
        FROM organization_members membership
        JOIN users owner
          ON owner.id = membership.user_id
         AND owner.active IS TRUE
         AND owner.deletion_scheduled_at IS NULL
        WHERE membership.organization_id = $1
          AND membership.role = 'owner'
          AND membership.status = 'active'
    `, [organizationId])).rows[0].count), 1)
}

async function commercialApp() {
    const instance = Fastify()
    await instance.register(rateLimitPlugin)
    await instance.register(publicTiApi, {
        prefix: '/api/v1',
        searchImpl: async ({ query }: { query: string }) => ({
            query,
            generatedAt: new Date().toISOString(),
            mode: 'scraper',
            status: 'ready',
            summary: `Public evidence for ${query}.`,
            confidence: 0.9,
            aliases: [],
            recentActivity: [],
            targets: [],
            ttps: [],
            datasets: [],
            sources: [],
            notes: [],
        }),
    })
    instance.delete('/user/self', deleteSelf)
    instance.post('/api/organizations/:id/api-keys', postOrganizationApiKey)
    instance.put('/api/organizations/:id/settings', putOrganizationSettings)
    instance.patch('/api/organizations/:id/members/:userId/role', patchOrganizationMemberRole)
    instance.delete('/api/organizations/:id/members/:userId', deleteOrganizationMember)
    instance.post('/api/organizations/:id/ownership-transfer', postOrganizationOwnershipTransfer)
    await instance.ready()
    return instance
}
