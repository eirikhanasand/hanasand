import { beforeEach, describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import {
    createApiKey,
    findEnabledOrganizationApiKey,
    listOrganizationApiKeys,
    organizationPublicApiScopes,
    revokeOrganizationApiKey,
    validateApiKey,
} from '../src/utils/auth/apiKeys.ts'
import { roleCanManageOrganization } from '../src/utils/organizations.ts'

type Row = Record<string, any>

let organizationStatus = 'active'
let organizationHasActiveOwner = true
let apiKeys: Row[] = []
let scopes: Row[] = []

beforeEach(() => {
    organizationStatus = 'active'
    organizationHasActiveOwner = true
    apiKeys = []
    scopes = []
})

describe('organization API key onboarding', () => {
    test('schema retains organizations and their keys when a creator account is removed', async () => {
        const [init, ensureSchema] = await Promise.all([
            readFile(new URL('../../db/init.sql', import.meta.url), 'utf8'),
            readFile(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8'),
        ])
        expect(init).toContain('created_by TEXT REFERENCES users(id) ON DELETE SET NULL')
        expect(ensureSchema).toContain('ALTER TABLE organizations ALTER COLUMN created_by DROP NOT NULL')
        expect(ensureSchema).toContain('FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL')
        expect(init).toContain('owner_id TEXT REFERENCES users(id) ON DELETE SET NULL')
        expect(ensureSchema).toContain('ALTER TABLE api_keys ALTER COLUMN owner_id DROP NOT NULL')
        expect(ensureSchema).toContain('FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL')
    })

    test('creates one fixed-scope organization key and enforces its full lifecycle', async () => {
        const created = await createApiKey({
            ownerId: 'customer-user',
            organizationId: 'org-a',
            name: 'Developer API',
            tier: 'starter',
            scopes: organizationPublicApiScopes(),
        }, fakeRun as any)
        expect(created.secret).toMatch(/^hsk_[a-f0-9]{12}_[a-f0-9]{48}$/)
        expect(created.apiKey).toMatchObject({ organizationId: 'org-a', name: 'Developer API', tier: 'starter', enabled: true })
        expect(created.apiKey.scopes).toHaveLength(12)
        expect(created.apiKey.scopes.find(scope => scope.route === '/api/v1/ti/search/batch')?.limits).toEqual({
            perSecond: 1,
            perMinute: 12,
            perHour: 120,
            perDay: 1_000,
        })
        expect(JSON.stringify(created.apiKey)).not.toContain(created.secret)
        expect(await findEnabledOrganizationApiKey('org-a', fakeRun as any)).toBe(created.apiKey.id)

        expect((await validateApiKey(created.secret, fakeRun as any))?.organizationId).toBe('org-a')
        organizationStatus = 'archived'
        expect(await validateApiKey(created.secret, fakeRun as any)).toBeNull()
        organizationStatus = 'active'
        expect((await validateApiKey(created.secret, fakeRun as any))?.organizationId).toBe('org-a')

        organizationHasActiveOwner = false
        expect(await validateApiKey(created.secret, fakeRun as any)).toBeNull()
        organizationHasActiveOwner = true
        apiKeys[0].owner_id = null
        const afterCreatorRemoval = await validateApiKey(created.secret, fakeRun as any)
        expect(afterCreatorRemoval?.ownerId).toBeNull()
        expect(afterCreatorRemoval?.organizationId).toBe('org-a')

        const listed = await listOrganizationApiKeys('org-a', fakeRun as any)
        expect(listed).toHaveLength(1)
        expect(JSON.stringify(listed)).not.toContain(created.secret)
        expect(await revokeOrganizationApiKey('org-b', created.apiKey.id, fakeRun as any)).toBeNull()
        expect((await revokeOrganizationApiKey('org-a', created.apiKey.id, fakeRun as any))?.enabled).toBe(false)
        expect(await validateApiKey(created.secret, fakeRun as any)).toBeNull()
    })

    test('limits organization key management to owners and administrators', () => {
        expect(roleCanManageOrganization('owner')).toBe(true)
        expect(roleCanManageOrganization('admin')).toBe(true)
        expect(roleCanManageOrganization('viewer')).toBe(false)
    })
})

async function fakeRun(sql: string, params: unknown[] = []) {
    const query = sql.replace(/\s+/g, ' ').trim()
    if (query.startsWith('SELECT id FROM api_keys') && query.includes('organization_id = $1')) {
        return { rows: apiKeys.filter(row => row.organization_id === params[0] && row.enabled).slice(0, 1).map(row => ({ id: row.id })) }
    }
    if (query.startsWith('INSERT INTO api_keys')) {
        const now = new Date().toISOString()
        const row = {
            id: params[0], owner_id: params[1], organization_id: params[2], name: params[3], tier: params[4],
            description: params[5], enabled: params[6], key_prefix: params[7], secret_hash: params[8],
            expires_at: params[9], last_used_at: null, created_at: now, updated_at: now,
        }
        apiKeys.push(row)
        return { rows: [row], rowCount: 1 }
    }
    if (query.startsWith('DELETE FROM api_keys WHERE id = $1')) {
        const before = apiKeys.length
        apiKeys = apiKeys.filter(row => row.id !== params[0])
        return { rows: [], rowCount: before - apiKeys.length }
    }
    if (query.startsWith('DELETE FROM api_key_scopes')) {
        scopes = scopes.filter(row => row.api_key_id !== params[0])
        return { rows: [], rowCount: 0 }
    }
    if (query.startsWith('INSERT INTO api_key_scopes')) {
        scopes.push({
            id: params[0], api_key_id: params[1], method: params[2], route: params[3], enabled: params[4],
            per_second: params[5], per_minute: params[6], per_hour: params[7], per_day: params[8],
        })
        return { rows: [], rowCount: 1 }
    }
    if (query.includes('FROM api_key_scopes') && query.includes('WHERE api_key_id = $1')) {
        return { rows: scopes.filter(row => row.api_key_id === params[0]) }
    }
    if (query.includes('FROM api_keys') && query.includes('WHERE organization_id = $1') && query.includes('ORDER BY created_at DESC')) {
        return { rows: apiKeys.filter(row => row.organization_id === params[0]) }
    }
    if (query.startsWith('UPDATE api_keys') && query.includes('organization_id = $2')) {
        const row = apiKeys.find(item => item.id === params[0] && item.organization_id === params[1] && item.enabled)
        if (!row) return { rows: [], rowCount: 0 }
        row.enabled = false
        row.updated_at = new Date().toISOString()
        return { rows: [row], rowCount: 1 }
    }
    if (query.includes('FROM api_keys k') && query.includes('WHERE k.key_prefix = $1')) {
        return {
            rows: apiKeys.filter(row =>
                row.key_prefix === params[0]
                && row.enabled
                && (row.organization_id
                    ? organizationStatus === 'active' && organizationHasActiveOwner
                    : Boolean(row.owner_id))
            ).slice(0, 1),
        }
    }
    if (query.includes('FROM roles r') && query.includes('JOIN user_roles')) return { rows: [] }
    if (query.startsWith('UPDATE api_keys') && query.includes('last_used_at = NOW()')) return { rows: [], rowCount: 1 }
    throw new Error(`Unhandled SQL in organization API key test: ${query}`)
}
