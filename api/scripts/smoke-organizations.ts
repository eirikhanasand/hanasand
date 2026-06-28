import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
    normalizeInviteInput,
    normalizeOrganizationInput,
    normalizeWatchlistInput,
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

assert.throws(() => normalizeInviteInput({ email: 'not-an-email' }), /Invalid invite email/)
assert.throws(() => normalizeInviteInput({ emails: Array.from({ length: 26 }, (_, index) => `user${index}@example.com`) }), /25 users/)
assert.throws(() => normalizeInviteInput({ email: 'user@example.com', expiresAt: 'yesterdayish' }), /valid date/)
assert.throws(() => normalizeInviteInput({ email: 'user@example.com', expiresAt: '2020-01-01T00:00:00.000Z' }), /future/)

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

assert.equal(roleCanManageOrganization('owner'), true)
assert.equal(roleCanManageOrganization('admin'), true)
assert.equal(roleCanManageOrganization('member'), false)
assert.equal(roleCanWriteWatchlist('member'), true)
assert.equal(roleCanWriteWatchlist(undefined), false)

const routes = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8')
assert.match(routes, /fastify\.post\('\/organizations'/)
assert.match(routes, /fastify\.post\('\/organizations\/:id\/invites'/)
assert.match(routes, /fastify\.post\('\/organizations\/invites\/:inviteId\/accept'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/members'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/watchlists'/)
assert.match(routes, /fastify\.post\('\/organizations\/:id\/watchlists'/)

const ensureSchema = await readFile(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
assert.match(ensureSchema, /CREATE TABLE IF NOT EXISTS organizations/)
assert.match(ensureSchema, /CREATE TABLE IF NOT EXISTS organization_members/)
assert.match(ensureSchema, /CREATE TABLE IF NOT EXISTS organization_invites/)
assert.match(ensureSchema, /expires_at TIMESTAMPTZ/)
assert.match(ensureSchema, /CREATE TABLE IF NOT EXISTS organization_watchlist_items/)
assert.match(ensureSchema, /organization_id TEXT NOT NULL REFERENCES organizations\(id\)/)

console.log('Organization membership, invite, and shared watchlist contract smoke passed.')
