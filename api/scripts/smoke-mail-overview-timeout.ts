import assert from 'node:assert/strict'
import { degradedMailOverview, withDeadline } from '../src/handlers/mail/getOverview.ts'

const startedAt = Date.now()
const fallback = await withDeadline(new Promise<string>(() => undefined), 20, 'fallback')
assert.equal(fallback, 'fallback')
assert.ok(Date.now() - startedAt < 500)

const overview = degradedMailOverview({
    id: 'operator',
    targetUser: 'operator',
    address: 'operator@hanasand.com',
    canAccessAnyMailbox: false,
    accessibleAccounts: [{ id: 'operator', name: 'Operator', address: 'operator@hanasand.com' }],
    recentRecipients: [],
    health: null,
    detail: 'Mailbox service did not respond within the route budget.',
})

assert.equal(overview.actor.id, 'operator')
assert.equal(overview.mailboxUser, 'operator')
assert.equal(overview.mailboxes.length, 0)
assert.equal(overview.messages.length, 0)
assert.equal(overview.health.status, 'warning')
assert.equal(overview.health.checks[0].id, 'mail-overview-timeout')
assert.match(overview.health.checks[0].detail, /route budget/)

console.log(JSON.stringify({ ok: true, checked: ['mail_overview_deadline', 'degraded_mail_overview'] }, null, 2))
