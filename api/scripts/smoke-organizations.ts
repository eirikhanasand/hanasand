import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
    normalizeInviteInput,
    normalizeOrganizationInput,
    normalizeOrganizationSettingsInput,
    normalizeWatchlistInput,
    buildOrganizationBridgeContext,
    buildOrganizationDwmAlertReference,
    roleCanManageOrganization,
    roleCanWriteWatchlist,
} from '../src/utils/organizations.ts'

assert.deepEqual(normalizeOrganizationInput({ name: ' Acme Security AS ' }), {
    name: 'Acme Security AS',
    slug: 'acme-security-as',
})

const tenInvites = normalizeInviteInput({
    emails: Array.from({ length: 10 }, (_, index) => `User${index + 1}@Example.COM`),
    role: 'member',
})
assert.equal(tenInvites.emails.length, 10)
assert.equal(tenInvites.emails[0], 'user1@example.com')
assert.equal(tenInvites.role, 'member')
assert.ok(Date.parse(tenInvites.expiresAt) > Date.now())

const viewerInvite = normalizeInviteInput({ email: 'viewer@example.com', role: 'viewer' })
assert.equal(viewerInvite.role, 'viewer')

assert.throws(() => normalizeInviteInput({ email: 'not-an-email' }), /Invalid invite email/)
assert.throws(() => normalizeInviteInput({ emails: Array.from({ length: 26 }, (_, index) => `user${index}@example.com`) }), /25 users/)
assert.throws(() => normalizeInviteInput({ email: 'owner@example.com', role: 'owner' }), /admin, member, or viewer/)
assert.throws(() => normalizeInviteInput({ email: 'user@example.com', expiresAt: 'yesterdayish' }), /valid date/)
assert.throws(() => normalizeInviteInput({ email: 'user@example.com', expiresAt: '2020-01-01T00:00:00.000Z' }), /future/)

assert.deepEqual(normalizeOrganizationSettingsInput({
    name: ' Smoke Org Settings ',
    slug: 'Smoke Org Settings!',
    defaultWebhookPolicy: 'manual_selection',
    alertVisibilityPolicy: 'admins',
    retentionDays: 180,
    auditSafeMetadata: { region: 'EU', customerTier: 'managed' },
}), {
    name: 'Smoke Org Settings',
    slug: 'smoke-org-settings',
    defaultWebhookPolicy: 'manual_selection',
    alertVisibilityPolicy: 'admins',
    retentionDays: 180,
    auditSafeMetadata: { region: 'EU', customerTier: 'managed' },
})
assert.throws(() => normalizeOrganizationSettingsInput({ defaultWebhookPolicy: 'send_everywhere' }), /Default webhook policy/)
assert.throws(() => normalizeOrganizationSettingsInput({ alertVisibilityPolicy: 'public' }), /Alert visibility policy/)
assert.throws(() => normalizeOrganizationSettingsInput({ retentionDays: 10 }), /Retention days/)
assert.throws(() => normalizeOrganizationSettingsInput({ auditSafeMetadata: { callback: 'https://hooks.example.test/secret' } }), /emails, URLs, or secrets/)

assert.deepEqual(normalizeWatchlistInput({ kind: 'domain', value: 'https://WWW.Example.COM/login', notes: ' Supplier portal ' }), {
    kind: 'domain',
    value: 'example.com',
    notes: 'Supplier portal',
})
assert.deepEqual(normalizeWatchlistInput({ kind: 'company', value: ' Example Holdings ' }), {
    kind: 'company',
    value: 'Example Holdings',
    notes: '',
})
assert.throws(() => normalizeWatchlistInput({ kind: 'user', value: 'local only' }), /company, domain, or vendor/)

const alertReference = buildOrganizationDwmAlertReference(
    {
        id: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        default_webhook_policy: 'manual_selection',
        alert_visibility_policy: 'admins',
        member_count: 8,
        pending_invite_count: 2,
        shared_watchlist_count: 1,
    },
    {
        id: 'watch_domain_acme',
        organization_id: 'org_acme',
        kind: 'domain',
        value: 'acme.example',
        notes: '',
        created_by: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
)
assert.equal(alertReference.organizationId, 'org_acme')
assert.equal(alertReference.tenantId, 'org_acme')
assert.equal(alertReference.watchlistItemId, 'watch_domain_acme')
assert.equal(alertReference.watchlist.id, 'watch_domain_acme')
assert.equal(alertReference.alert.watchlistItemId, 'watch_domain_acme')
assert.equal(alertReference.alert.route, 'organization_watchlist')
assert.equal(alertReference.alert.defaultWebhookPolicy, 'manual_selection')
assert.equal(alertReference.alert.alertVisibilityPolicy, 'admins')
assert.equal(alertReference.alert.memberCount, 8)
assert.equal(alertReference.alert.pendingInviteCount, 2)
assert.equal(alertReference.alert.sharedWatchlistCount, 1)
assert.equal(alertReference.alert.readinessStatus, 'ready')
assert.equal(alertReference.webhookContract.defaultWebhookPolicy, 'manual_selection')
assert.match(alertReference.alert.casePath, /organizationId=org_acme/)
assert.match(alertReference.alert.dedupeKey, /org:org_acme:watchlist:watch_domain_acme/)

assert.deepEqual(buildOrganizationBridgeContext({
    id: 'org_empty',
    name: 'Empty Org',
    slug: 'empty-org',
    member_count: 1,
    pending_invite_count: 0,
    shared_watchlist_count: 0,
}), {
    id: 'org_empty',
    name: 'Empty Org',
    slug: 'empty-org',
    defaultWebhookPolicy: 'active_destinations',
    alertVisibilityPolicy: 'members',
    memberCount: 1,
    pendingInviteCount: 0,
    sharedWatchlistCount: 0,
    readinessStatus: 'needs_watchlist',
})

assert.equal(roleCanManageOrganization('owner'), true)
assert.equal(roleCanManageOrganization('admin'), true)
assert.equal(roleCanManageOrganization('member'), false)
assert.equal(roleCanWriteWatchlist('member'), true)
assert.equal(roleCanWriteWatchlist('viewer'), false)
assert.equal(roleCanWriteWatchlist(undefined), false)

const routes = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8')
assert.match(routes, /fastify\.post\('\/organizations'/)
assert.match(routes, /fastify\.post\('\/organizations\/:id\/invites'/)
assert.match(routes, /fastify\.post\('\/organizations\/invites\/:inviteId\/accept'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/members'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/settings'/)
assert.match(routes, /fastify\.put\('\/organizations\/:id\/settings'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/alert-readiness'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/watchlists'/)
assert.match(routes, /fastify\.post\('\/organizations\/:id\/watchlists'/)
assert.match(routes, /fastify\.delete\('\/organizations\/:organizationId\/watchlists\/:itemId'/)

const ensureSchema = await readFile(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
assert.match(ensureSchema, /CREATE TABLE IF NOT EXISTS organizations/)
assert.match(ensureSchema, /default_webhook_policy TEXT NOT NULL DEFAULT 'active_destinations'/)
assert.match(ensureSchema, /alert_visibility_policy TEXT NOT NULL DEFAULT 'members'/)
assert.match(ensureSchema, /retention_days INT NOT NULL DEFAULT 365/)
assert.match(ensureSchema, /audit_safe_metadata JSONB NOT NULL DEFAULT '\{\}'::jsonb/)
assert.match(ensureSchema, /CREATE TABLE IF NOT EXISTS organization_members/)
assert.match(ensureSchema, /CREATE TABLE IF NOT EXISTS organization_invites/)
assert.match(ensureSchema, /role IN \('owner', 'admin', 'member', 'viewer'\)/)
assert.match(ensureSchema, /role IN \('admin', 'member', 'viewer'\)/)
assert.match(ensureSchema, /expires_at TIMESTAMPTZ/)
assert.match(ensureSchema, /CREATE TABLE IF NOT EXISTS organization_watchlist_items/)
assert.match(ensureSchema, /organization_id TEXT NOT NULL REFERENCES organizations\(id\)/)

console.log('Organization membership, invite, and shared watchlist contract smoke passed.')
