import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { mock } from 'bun:test'

type Row = Record<string, any>

const users = new Map<string, Row>([
    ['org_smoke_owner', { id: 'org_smoke_owner', name: 'Org Smoke Owner', avatar: '', email: 'owner@example.test', active: true }],
    ['org_smoke_admin', { id: 'org_smoke_admin', name: 'Org Smoke Admin', avatar: '', email: 'admin@example.test', active: true }],
    ['org_smoke_member', { id: 'org_smoke_member', name: 'Org Smoke Member', avatar: '', email: 'member@example.test', active: true }],
    ['org_smoke_viewer', { id: 'org_smoke_viewer', name: 'Org Smoke Viewer', avatar: '', email: 'viewer@example.test', active: true }],
    ['org_smoke_expired', { id: 'org_smoke_expired', name: 'Org Smoke Expired', avatar: '', email: 'expired@example.test', active: true }],
    ['org_smoke_deactivated', { id: 'org_smoke_deactivated', name: 'Org Smoke Deactivated', avatar: '', email: 'deactivated@example.test', active: false }],
    ['org_smoke_outsider', { id: 'org_smoke_outsider', name: 'Org Smoke Outsider', avatar: '', email: 'outsider@example.test', active: true }],
])
const tokens = new Map([
    ['owner-token', 'org_smoke_owner'],
    ['admin-token', 'org_smoke_admin'],
    ['member-token', 'org_smoke_member'],
    ['viewer-token', 'org_smoke_viewer'],
    ['expired-token', 'org_smoke_expired'],
    ['deactivated-token', 'org_smoke_deactivated'],
    ['outsider-token', 'org_smoke_outsider'],
])
const organizations = new Map<string, Row>()
const members = new Map<string, Row>()
const invites = new Map<string, Row>()
const watchlists = new Map<string, Row>()
const serviceLogs: Row[] = []

mock.module('#db', () => ({ default: fakeRun }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async (req: any) => {
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        const id = String(req.headers.id || '')
        if (!tokens.has(token) || tokens.get(token) !== id) {
            return { valid: false, id, error: 'Unauthorized.' }
        }
        return { valid: true, id }
    },
}))

const handlers = await import('../src/handlers/organizations.ts')
const app = Fastify({ logger: false })

app.get('/api/organizations', handlers.getOrganizations)
app.post('/api/organizations', handlers.postOrganization)
app.post('/api/organizations/invites/:inviteId/accept', handlers.postOrganizationInviteAccept)
app.get('/api/organizations/:id/invites', handlers.getOrganizationInvites)
app.post('/api/organizations/:id/invites', handlers.postOrganizationInvites)
app.get('/api/organizations/:id/members', handlers.getOrganizationMembers)
app.delete('/api/organizations/:id/members/:userId', handlers.deleteOrganizationMember)
app.post('/api/organizations/:id/ownership-transfer', handlers.postOrganizationOwnershipTransfer)
app.get('/api/organizations/:id/settings', handlers.getOrganizationSettings)
app.put('/api/organizations/:id/settings', handlers.putOrganizationSettings)
app.get('/api/organizations/:id/alert-readiness', handlers.getOrganizationAlertReadiness)
app.get('/api/organizations/:id/watchlists', handlers.getOrganizationWatchlists)
app.post('/api/organizations/:id/watchlists', handlers.postOrganizationWatchlist)
app.delete('/api/organizations/:organizationId/watchlists/:itemId', handlers.deleteOrganizationWatchlist)
app.get('/api/organizations/:id', handlers.getOrganization)

await app.ready()

const organizationResponse = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { name: 'Smoke Shared Watchlist' },
})
assert.equal(organizationResponse.statusCode, 201, organizationResponse.body)
const organization = parseBody(organizationResponse.body).organization
assert.equal(organization.role, 'owner')
assert.equal(organization.memberCount, 1)
assert.equal(organization.ownerCount, 1)
assert.equal(organization.settings.defaultWebhookPolicy, 'active_destinations')
assert.equal(organization.settings.alertVisibilityPolicy, 'members')
assert.equal(organization.settings.retentionDays, 365)

const ownerDefaultSettingsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(ownerDefaultSettingsResponse.statusCode, 200, ownerDefaultSettingsResponse.body)
const ownerDefaultSettings = parseBody(ownerDefaultSettingsResponse.body)
assert.equal(ownerDefaultSettings.permissions.canEdit, true)
assert.equal(ownerDefaultSettings.settings.defaultWebhookPolicy, 'active_destinations')

const inviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { email: 'member@example.test', role: 'member' },
})
assert.equal(inviteResponse.statusCode, 201, inviteResponse.body)
const invite = parseBody(inviteResponse.body).invites[0]
assert.equal(invite.status, 'pending')
assert.ok(Date.parse(invite.expiresAt) > Date.now())

const acceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${invite.id}/accept`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(acceptResponse.statusCode, 200, acceptResponse.body)
const accepted = parseBody(acceptResponse.body)
assert.equal(accepted.invite.status, 'accepted')
assert.equal(accepted.invite.acceptedBy, 'org_smoke_member')
assert.equal(accepted.invite.expiresAt, invite.expiresAt)
assert.equal(accepted.membership.userId, 'org_smoke_member')
assert.equal(accepted.membership.role, 'member')

const reusedInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${invite.id}/accept`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(reusedInviteResponse.statusCode, 404, reusedInviteResponse.body)

const pendingInvitesResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(pendingInvitesResponse.statusCode, 200, pendingInvitesResponse.body)
assert.deepEqual(parseBody(pendingInvitesResponse.body).invites, [])

const existingMemberInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { email: 'member@example.test', role: 'viewer', requestId: 'smoke-existing-member' },
})
assert.equal(existingMemberInviteResponse.statusCode, 201, existingMemberInviteResponse.body)
const existingMemberInviteWorkflow = parseBody(existingMemberInviteResponse.body).workflow
assert.equal(existingMemberInviteWorkflow.invitedCount, 0)
assert.equal(existingMemberInviteWorkflow.skippedCount, 1)
assert.equal(existingMemberInviteWorkflow.results[0].outcome, 'already_member')
assert.equal(existingMemberInviteWorkflow.results[0].memberRole, 'member')

const memberInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { email: 'blocked-by-member@example.test', role: 'member' },
})
assert.equal(memberInviteResponse.statusCode, 403, memberInviteResponse.body)

const adminInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { email: 'admin@example.test', role: 'admin' },
})
assert.equal(adminInviteResponse.statusCode, 201, adminInviteResponse.body)
const adminInvite = parseBody(adminInviteResponse.body).invites[0]

const adminAcceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${adminInvite.id}/accept`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(adminAcceptResponse.statusCode, 200, adminAcceptResponse.body)
assert.equal(parseBody(adminAcceptResponse.body).membership.role, 'admin')

const viewerInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { email: 'viewer@example.test', role: 'viewer' },
})
assert.equal(viewerInviteResponse.statusCode, 201, viewerInviteResponse.body)
const viewerInvite = parseBody(viewerInviteResponse.body).invites[0]
assert.equal(viewerInvite.role, 'viewer')

for (const [userId, token] of [['org_smoke_owner', 'owner-token'], ['org_smoke_admin', 'admin-token']] as const) {
    const pendingForManager = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/invites`,
        headers: authHeaders(userId, token),
    })
    assert.equal(pendingForManager.statusCode, 200, pendingForManager.body)
    assert.deepEqual(parseBody(pendingForManager.body).invites.map((pendingInvite: Row) => pendingInvite.id), [viewerInvite.id])
}

const viewerAcceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${viewerInvite.id}/accept`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(viewerAcceptResponse.statusCode, 200, viewerAcceptResponse.body)
assert.equal(parseBody(viewerAcceptResponse.body).membership.role, 'viewer')

const viewerInviteBlockedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    payload: { email: 'blocked-by-viewer@example.test', role: 'member' },
})
assert.equal(viewerInviteBlockedResponse.statusCode, 403, viewerInviteBlockedResponse.body)

const invalidSettingsResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { name: '', defaultWebhookPolicy: 'everything' },
})
assert.equal(invalidSettingsResponse.statusCode, 400, invalidSettingsResponse.body)

const memberSettingsUpdateResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { alertVisibilityPolicy: 'admins' },
})
assert.equal(memberSettingsUpdateResponse.statusCode, 403, memberSettingsUpdateResponse.body)

const viewerSettingsUpdateResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    payload: { defaultWebhookPolicy: 'disabled' },
})
assert.equal(viewerSettingsUpdateResponse.statusCode, 403, viewerSettingsUpdateResponse.body)

const adminSettingsResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: {
        name: 'Smoke Shared Operations',
        slug: 'shared-ops',
        defaultWebhookPolicy: 'manual_selection',
        alertVisibilityPolicy: 'admins',
        retentionDays: 180,
        auditSafeMetadata: { region: 'EU', plan: 'team' },
    },
})
assert.equal(adminSettingsResponse.statusCode, 200, adminSettingsResponse.body)
const adminSettings = parseBody(adminSettingsResponse.body)
assert.equal(adminSettings.organization.name, 'Smoke Shared Operations')
assert.equal(adminSettings.organization.slug, 'shared-ops')
assert.equal(adminSettings.settings.defaultWebhookPolicy, 'manual_selection')
assert.equal(adminSettings.settings.alertVisibilityPolicy, 'admins')
assert.equal(adminSettings.settings.retentionDays, 180)
assert.deepEqual(adminSettings.settings.auditSafeMetadata, { region: 'EU', plan: 'team' })
assert.equal(adminSettings.permissions.canEdit, true)

for (const [userId, token, canEdit] of [
    ['org_smoke_member', 'member-token', false],
    ['org_smoke_viewer', 'viewer-token', false],
] as const) {
    const readSettingsResponse = await app.inject({
        method: 'GET',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders(userId, token),
    })
    assert.equal(readSettingsResponse.statusCode, 200, readSettingsResponse.body)
    const readableSettings = parseBody(readSettingsResponse.body)
    assert.equal(readableSettings.settings.defaultWebhookPolicy, 'manual_selection')
    assert.equal(readableSettings.settings.alertVisibilityPolicy, 'admins')
    assert.equal(readableSettings.permissions.canEdit, canEdit)
}

const outsiderSettingsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(outsiderSettingsResponse.statusCode, 404, outsiderSettingsResponse.body)

const pendingOpsInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { email: 'pending-ops@example.test', role: 'viewer' },
})
assert.equal(pendingOpsInviteResponse.statusCode, 201, pendingOpsInviteResponse.body)

const bulkEmails = Array.from({ length: 10 }, (_, index) => `bulk-${index + 1}@example.test`)
const bulkInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: {
        emails: bulkEmails,
        role: 'member',
        requestId: 'smoke-bulk-10',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
})
assert.equal(bulkInviteResponse.statusCode, 201, bulkInviteResponse.body)
const bulkInviteWorkflow = parseBody(bulkInviteResponse.body).workflow
assert.equal(bulkInviteWorkflow.schemaVersion, 'organization.bulk_invite.v1')
assert.equal(bulkInviteWorkflow.requestId, 'smoke-bulk-10')
assert.equal(bulkInviteWorkflow.actorId, 'org_smoke_admin')
assert.equal(bulkInviteWorkflow.organizationId, organization.id)
assert.equal(bulkInviteWorkflow.recipientCount, 10)
assert.equal(bulkInviteWorkflow.invitedCount, 10)
assert.equal(bulkInviteWorkflow.skippedCount, 0)
assert.deepEqual(bulkInviteWorkflow.results.map((result: Row) => result.outcome), Array(10).fill('invited'))

const duplicateBulkInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { email: bulkEmails[0], role: 'viewer', request_id: 'smoke-duplicate-bulk' },
})
assert.equal(duplicateBulkInviteResponse.statusCode, 201, duplicateBulkInviteResponse.body)
const duplicateInviteWorkflow = parseBody(duplicateBulkInviteResponse.body).workflow
assert.equal(duplicateInviteWorkflow.duplicateInviteCount, 1)
assert.equal(duplicateInviteWorkflow.results[0].outcome, 'updated_pending_invite')
assert.equal(duplicateInviteWorkflow.results[0].email, bulkEmails[0])

const deactivatedInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { email: 'deactivated@example.test', role: 'member', requestId: 'smoke-deactivated-invite' },
})
assert.equal(deactivatedInviteResponse.statusCode, 201, deactivatedInviteResponse.body)
const deactivatedWorkflow = parseBody(deactivatedInviteResponse.body).workflow
assert.equal(deactivatedWorkflow.invitedCount, 0)
assert.equal(deactivatedWorkflow.skippedCount, 1)
assert.equal(deactivatedWorkflow.results[0].outcome, 'blocked_deactivated_user')

const expiredInvite = nowRow({
    id: 'expired-invite',
    organization_id: organization.id,
    email: 'expired@example.test',
    role: 'member',
    invited_by: 'org_smoke_owner',
    status: 'pending',
    accepted_at: null,
    accepted_by: null,
    expires_at: new Date(Date.now() - 60_000).toISOString(),
})
invites.set(expiredInvite.id, expiredInvite)
const expiredAcceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${expiredInvite.id}/accept`,
    headers: authHeaders('org_smoke_expired', 'expired-token'),
})
assert.equal(expiredAcceptResponse.statusCode, 404, expiredAcceptResponse.body)

const membersResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/members`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(membersResponse.statusCode, 200, membersResponse.body)
const memberships = parseBody(membersResponse.body).members
assert.deepEqual(
    memberships.map((member: Row) => member.userId).sort(),
    ['org_smoke_admin', 'org_smoke_member', 'org_smoke_owner', 'org_smoke_viewer'].sort()
)
assert.equal(memberships.find((member: Row) => member.userId === 'org_smoke_admin').role, 'admin')
assert.equal(memberships.find((member: Row) => member.userId === 'org_smoke_viewer').role, 'viewer')

const ownerWatchlistResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { kind: 'domain', value: 'https://www.acme-shared.example/login', notes: 'Customer domain' },
})
assert.equal(ownerWatchlistResponse.statusCode, 201, ownerWatchlistResponse.body)
const ownerWatchlistItem = parseBody(ownerWatchlistResponse.body).watchlistItem

const memberWatchlistResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(memberWatchlistResponse.statusCode, 200, memberWatchlistResponse.body)
const memberWatchlist = parseBody(memberWatchlistResponse.body).watchlistItems
assert.equal(memberWatchlist.length, 1)
assert.ok(memberWatchlist[0].id)
assert.equal(memberWatchlist[0].organizationId, organization.id)
assert.equal(memberWatchlist[0].value, 'acme-shared.example')

const viewerWatchlistResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(viewerWatchlistResponse.statusCode, 200, viewerWatchlistResponse.body)
assert.equal(parseBody(viewerWatchlistResponse.body).watchlistItems.length, 1)

const viewerAddsWatchlistResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    payload: { kind: 'company', value: 'Viewer Blocked Holdings' },
})
assert.equal(viewerAddsWatchlistResponse.statusCode, 403, viewerAddsWatchlistResponse.body)

const viewerArchiveWatchlistResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(viewerArchiveWatchlistResponse.statusCode, 403, viewerArchiveWatchlistResponse.body)

const memberAddsVendorResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { kind: 'vendor', value: 'Acme Payroll Vendor' },
})
assert.equal(memberAddsVendorResponse.statusCode, 201, memberAddsVendorResponse.body)

const ownerSeesBothResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(ownerSeesBothResponse.statusCode, 200, ownerSeesBothResponse.body)
assert.deepEqual(
    parseBody(ownerSeesBothResponse.body).watchlistItems.map((item: Row) => item.value).sort(),
    ['Acme Payroll Vendor', 'acme-shared.example'].sort()
)

const readinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(readinessResponse.statusCode, 200, readinessResponse.body)
const readiness = parseBody(readinessResponse.body).alertReadiness
assert.equal(readiness.organizationId, organization.id)
assert.equal(readiness.tenantId, organization.id)
assert.equal(readiness.defaultWebhookPolicy, 'manual_selection')
assert.equal(readiness.alertVisibilityPolicy, 'admins')
assert.equal(readiness.memberCount, 4)
assert.equal(readiness.activeMemberCount, 4)
assert.equal(readiness.ownerCount, 1)
assert.deepEqual(readiness.allowedViewerRoles, ['owner', 'admin'])
assert.equal(readiness.removedMemberDenialReason, 'member_removed')
assert.equal(readiness.deactivatedMemberDenialReason, 'member_deactivated')
assert.equal(readiness.pendingInviteCount, 11)
assert.equal(readiness.sharedWatchlistCount, 2)
assert.equal(readiness.readinessStatus, 'ready')
assert.equal(readiness.ready, true)
assert.equal(readiness.teamOnboardingReadiness.schemaVersion, 'organization.team_onboarding_readiness.v1')
assert.equal(readiness.teamOnboardingReadiness.targetMemberCount, 10)
assert.equal(readiness.teamOnboardingReadiness.activeMemberCount, 4)
assert.equal(readiness.teamOnboardingReadiness.pendingInviteCount, 11)
assert.equal(readiness.teamOnboardingReadiness.acceptedOrInvitedCount, 15)
assert.equal(readiness.teamOnboardingReadiness.sharedWatchlistCount, 2)
assert.equal(readiness.teamOnboardingReadiness.canSupportTenMemberSharedWatchlistRollout, true)
assert.deepEqual(readiness.teamOnboardingReadiness.blockedReasons, [])
assert.equal(readiness.generatedAlertReferences.length, 2)
const domainReference = readiness.generatedAlertReferences.find((reference: Row) => reference.matchedTerm.value === 'acme-shared.example')
assert.ok(domainReference)
assert.equal(domainReference.organizationId, organization.id)
assert.equal(domainReference.tenantId, organization.id)
assert.equal(domainReference.watchlistItemId, domainReference.watchlist.id)
assert.equal(domainReference.alert.organizationId, organization.id)
assert.equal(domainReference.alert.orgId, organization.id)
assert.equal(domainReference.alert.tenantId, organization.id)
assert.equal(domainReference.alert.watchlistItemId, domainReference.watchlistItemId)
assert.equal(domainReference.alert.watchlist.id, domainReference.watchlistItemId)
assert.equal(domainReference.alert.route, 'organization_watchlist')
assert.equal(domainReference.alert.defaultWebhookPolicy, 'manual_selection')
assert.equal(domainReference.alert.alertVisibilityPolicy, 'admins')
assert.equal(domainReference.alert.memberCount, 4)
assert.equal(domainReference.alert.activeMemberCount, 4)
assert.equal(domainReference.alert.ownerCount, 1)
assert.deepEqual(domainReference.alert.allowedViewerRoles, ['owner', 'admin'])
assert.equal(domainReference.alert.removedMemberDenialReason, 'member_removed')
assert.equal(domainReference.alert.deactivatedMemberDenialReason, 'member_deactivated')
assert.equal(domainReference.alert.pendingInviteCount, 11)
assert.equal(domainReference.alert.sharedWatchlistCount, 2)
assert.equal(domainReference.alert.readinessStatus, 'ready')
assert.equal(domainReference.webhookContract.orgId, organization.id)
assert.equal(domainReference.webhookContract.watchlistId, domainReference.watchlistItemId)
assert.equal(domainReference.webhookContract.defaultWebhookPolicy, 'manual_selection')
assert.equal(domainReference.webhookContract.alertVisibilityPolicy, 'admins')
assert.deepEqual(domainReference.webhookContract.allowedViewerRoles, ['owner', 'admin'])
assert.equal(domainReference.organization.defaultWebhookPolicy, 'manual_selection')
assert.equal(domainReference.organization.alertVisibilityPolicy, 'admins')
assert.deepEqual(domainReference.organization.allowedViewerRoles, ['owner', 'admin'])
assert.match(domainReference.alert.casePath, /watchlistItemId=/)
assert.match(domainReference.alert.dedupeKey, /org:/)
assert.deepEqual(domainReference.watchlist.terms, ['acme-shared.example'])

const viewerReadinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(viewerReadinessResponse.statusCode, 200, viewerReadinessResponse.body)
assert.equal(parseBody(viewerReadinessResponse.body).alertReadiness.watchlistItemCount, 2)

const memberRemoveViewerResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(memberRemoveViewerResponse.statusCode, 403, memberRemoveViewerResponse.body)

const adminRemoveOwnerResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/members/org_smoke_owner`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(adminRemoveOwnerResponse.statusCode, 403, adminRemoveOwnerResponse.body)

const viewerTransferResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/ownership-transfer`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    payload: { targetUserId: 'org_smoke_admin', reason: 'Viewer should not transfer ownership.' },
})
assert.equal(viewerTransferResponse.statusCode, 403, viewerTransferResponse.body)

const invalidTransferResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/ownership-transfer`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { targetUserId: 'org_smoke_admin' },
})
assert.equal(invalidTransferResponse.statusCode, 400, invalidTransferResponse.body)

const transferResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/ownership-transfer`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { targetUserId: 'org_smoke_admin', reason: 'Customer primary owner changed.' },
})
assert.equal(transferResponse.statusCode, 200, transferResponse.body)
const transfer = parseBody(transferResponse.body)
assert.equal(transfer.transfer.previousOwnerId, 'org_smoke_owner')
assert.equal(transfer.transfer.newOwnerId, 'org_smoke_admin')
assert.equal(transfer.member.role, 'owner')
assert.equal(transfer.organization.role, 'admin')
assert.equal(transfer.organization.ownerCount, 1)

const formerOwnerRemovesNewOwnerResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/members/org_smoke_admin`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(formerOwnerRemovesNewOwnerResponse.statusCode, 403, formerOwnerRemovesNewOwnerResponse.body)

const lastOwnerGuardResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/members/org_smoke_admin`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(lastOwnerGuardResponse.statusCode, 409, lastOwnerGuardResponse.body)

const removeViewerResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(removeViewerResponse.statusCode, 200, removeViewerResponse.body)
assert.equal(parseBody(removeViewerResponse.body).member.status, 'removed')

const removedViewerInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { email: 'viewer@example.test', role: 'viewer', requestId: 'smoke-removed-viewer' },
})
assert.equal(removedViewerInviteResponse.statusCode, 201, removedViewerInviteResponse.body)
const removedViewerInviteWorkflow = parseBody(removedViewerInviteResponse.body).workflow
assert.equal(removedViewerInviteWorkflow.invitedCount, 0)
assert.equal(removedViewerInviteWorkflow.skippedCount, 1)
assert.equal(removedViewerInviteWorkflow.results[0].outcome, 'blocked_removed_member')

const removedViewerWatchlistResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(removedViewerWatchlistResponse.statusCode, 404, removedViewerWatchlistResponse.body)

const removedViewerReadinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(removedViewerReadinessResponse.statusCode, 404, removedViewerReadinessResponse.body)

const outsiderResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(outsiderResponse.statusCode, 404, outsiderResponse.body)
const outsiderReadinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(outsiderReadinessResponse.statusCode, 404, outsiderReadinessResponse.body)
assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_upserted'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.role === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted' && log.metadata.role === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_settings_updated' && log.metadata.fields.includes('defaultWebhookPolicy')))
assert.ok(serviceLogs.some(log => log.message === 'organization_ownership_transferred' && log.metadata.targetUserId === 'org_smoke_admin'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer'))

await app.close()
console.log('Organization API smoke passed for role RBAC, invite lifecycle, shared watchlists, alert readiness, and outsider isolation.')

function authHeaders(userId: string, token: string) {
    return {
        authorization: `Bearer ${token}`,
        id: userId,
    }
}

function parseBody(body: string) {
    return JSON.parse(body) as Row
}

async function fakeRun(query: string, params: any[] = []) {
    const compact = query.replace(/\s+/g, ' ').trim()

    if (compact.startsWith('SELECT slug FROM organizations') || compact.startsWith('SELECT id, slug FROM organizations')) {
        const [slug, like] = params
        const prefix = String(like).replace(/%$/, '')
        return rows([...organizations.values()].filter(org => org.slug === slug || org.slug.startsWith(prefix)).map(org => ({ slug: org.slug })))
    }

    if (compact.startsWith('INSERT INTO service_logs')) {
        serviceLogs.push({ service: params[0], host: params[1], level: params[2], message: params[3], metadata: JSON.parse(params[4]) })
        return rows([])
    }

    if (compact.includes('WITH new_organization AS')) {
        const [id, name, slug, userId] = params
        const org = organizationRow({ id, name, slug, created_by: userId })
        organizations.set(id, org)
        members.set(memberKey(id, userId), nowRow({ organization_id: id, user_id: userId, role: 'owner', status: 'active', invited_by: userId, joined_at: iso() }))
        return rows([org])
    }

    if (compact.includes('FROM organizations o JOIN organization_members om')) {
        const [organizationId, userId] = params.length === 1 ? [undefined, params[0]] : params
        const activeMemberships = [...members.values()].filter(member => member.status === 'active')
        const scoped = activeMemberships.filter(member => member.user_id === userId
            && users.get(member.user_id)?.active !== false
            && (!organizationId || member.organization_id === organizationId))
        return rows(scoped.map(member => organizationSummary(member.organization_id, member.role)))
    }

    if (compact.startsWith('UPDATE organizations SET name')) {
        const [organizationId, name, slug, defaultWebhookPolicy, alertVisibilityPolicy, retentionDays, auditSafeMetadata] = params
        const existing = organizations.get(organizationId)
        if (!existing) return rows([])
        const updated = {
            ...existing,
            name: name ?? existing.name,
            slug: slug ?? existing.slug,
            default_webhook_policy: defaultWebhookPolicy ?? existing.default_webhook_policy,
            alert_visibility_policy: alertVisibilityPolicy ?? existing.alert_visibility_policy,
            retention_days: retentionDays ?? existing.retention_days,
            audit_safe_metadata: auditSafeMetadata ? JSON.parse(auditSafeMetadata) : existing.audit_safe_metadata,
            updated_at: iso(),
        }
        organizations.set(organizationId, updated)
        return rows([updated])
    }

    if (compact.startsWith('SELECT * FROM organization_invites WHERE organization_id')) {
        if (compact.includes('lower(email) = lower($2)')) {
            const [organizationId, email] = params
            const invite = [...invites.values()].find(row => row.organization_id === organizationId && row.email.toLowerCase() === String(email).toLowerCase())
            return rows(invite ? [invite] : [])
        }

        return rows([...invites.values()].filter(invite => invite.organization_id === params[0] && invite.status === 'pending' && Date.parse(invite.expires_at) > Date.now()))
    }

    if (compact.startsWith('INSERT INTO organization_invites')) {
        const [id, organizationId, email, role, invitedBy, expiresAt] = params
        const existing = [...invites.values()].find(invite => invite.organization_id === organizationId && invite.email === email)
        const invite = existing
            ? { ...existing, role, invited_by: invitedBy, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt, created_at: iso() }
            : nowRow({ id, organization_id: organizationId, email, role, invited_by: invitedBy, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt })
        invites.set(invite.id, invite)
        return rows([invite])
    }

    if (compact.includes('WITH accepted_invite AS')) {
        const [inviteId, userId] = params
        const invite = invites.get(inviteId)
        if (!invite || invite.status !== 'pending' || Date.parse(invite.expires_at) <= Date.now()) return rows([])
        const acceptedAt = iso()
        const acceptedInvite = { ...invite, status: 'accepted', accepted_by: userId, accepted_at: acceptedAt }
        invites.set(inviteId, acceptedInvite)
        const member = nowRow({
            organization_id: invite.organization_id,
            user_id: userId,
            role: nextRole(members.get(memberKey(invite.organization_id, userId))?.role, invite.role),
            status: 'active',
            invited_by: invite.invited_by,
            joined_at: acceptedAt,
        })
        members.set(memberKey(invite.organization_id, userId), member)
        return rows([{
            invite_id: acceptedInvite.id,
            organization_id: acceptedInvite.organization_id,
            email: acceptedInvite.email,
            invite_role: acceptedInvite.role,
            invited_by: acceptedInvite.invited_by,
            accepted_by: acceptedInvite.accepted_by,
            invite_status: acceptedInvite.status,
            invite_created_at: acceptedInvite.created_at,
            expires_at: acceptedInvite.expires_at,
            accepted_at: acceptedInvite.accepted_at,
            user_id: member.user_id,
            member_role: member.role,
            member_status: member.status,
            joined_at: member.joined_at,
            member_created_at: member.created_at,
        }])
    }

    if (compact.includes('FROM organization_members om JOIN users u') && compact.includes('AND om.user_id = $2')) {
        const member = members.get(memberKey(params[0], params[1]))
        return rows(member
            ? [{ ...member, name: users.get(member.user_id)?.name ?? member.user_id, avatar: users.get(member.user_id)?.avatar ?? '' }]
            : [])
    }

    if (compact.startsWith('SELECT u.id AS user_id, COALESCE(u.active, TRUE) AS user_active')) {
        const [organizationId, email] = params
        const user = [...users.values()].find(row => row.email?.toLowerCase() === String(email).toLowerCase())
        if (!user) return rows([])
        const member = members.get(memberKey(organizationId, user.id))
        return rows([{
            user_id: user.id,
            user_active: user.active !== false,
            member_role: member?.role ?? null,
            member_status: member?.status ?? null,
        }])
    }

    if (compact.includes('FROM organization_members om JOIN users u')) {
        return rows([...members.values()]
            .filter(member => member.organization_id === params[0] && member.status === 'active')
            .map(member => ({ ...member, name: users.get(member.user_id)?.name ?? member.user_id, avatar: users.get(member.user_id)?.avatar ?? '' })))
    }

    if (compact.startsWith('SELECT COUNT(*)::int AS owner_count FROM organization_members')) {
        return rows([{
            owner_count: [...members.values()].filter(member => member.organization_id === params[0] && member.status === 'active' && member.role === 'owner').length,
        }])
    }

    if (compact.startsWith('UPDATE organization_members SET status')) {
        const [organizationId, userId] = params
        const key = memberKey(organizationId, userId)
        const existing = members.get(key)
        if (!existing || existing.status !== 'active') return rows([])
        const removed = { ...existing, status: 'removed' }
        members.set(key, removed)
        return rows([{ ...removed, name: users.get(userId)?.name ?? userId, avatar: users.get(userId)?.avatar ?? '' }])
    }

    if (compact.includes('WITH promoted AS')) {
        const [organizationId, targetUserId, previousOwnerId] = params
        const targetKey = memberKey(organizationId, targetUserId)
        const previousOwnerKey = memberKey(organizationId, previousOwnerId)
        const target = members.get(targetKey)
        if (!target || target.status !== 'active') return rows([])
        const promoted = { ...target, role: 'owner' }
        members.set(targetKey, promoted)
        const previousOwner = members.get(previousOwnerKey)
        if (previousOwner?.status === 'active' && previousOwner.role === 'owner') {
            members.set(previousOwnerKey, { ...previousOwner, role: 'admin' })
        }
        return rows([{ ...promoted, name: users.get(targetUserId)?.name ?? targetUserId, avatar: users.get(targetUserId)?.avatar ?? '' }])
    }

    if (compact.startsWith('SELECT id FROM organization_watchlist_items')) {
        const [organizationId, kind, value] = params
        const existing = [...watchlists.values()].find(item => item.organization_id === organizationId && item.kind === kind && item.value.toLowerCase() === String(value).toLowerCase() && !item.archived_at)
        return rows(existing ? [{ id: existing.id }] : [])
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET value')) {
        const [id, organizationId, value, notes] = params
        const existing = watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId) return rows([])
        const updated = { ...existing, value, notes, updated_at: iso() }
        watchlists.set(id, updated)
        return rows([updated])
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET kind')) {
        const [id, organizationId, kind, value, notes] = params
        const existing = watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId || existing.archived_at) return rows([])
        const updated = { ...existing, kind, value, notes, updated_at: iso() }
        watchlists.set(id, updated)
        return rows([updated])
    }

    if (compact.startsWith('INSERT INTO organization_watchlist_items')) {
        const [id, organizationId, kind, value, notes, createdBy] = params
        const item = nowRow({ id, organization_id: organizationId, kind, value, notes, created_by: createdBy, archived_at: null })
        watchlists.set(id, item)
        return rows([item])
    }

    if (compact.startsWith('SELECT * FROM organization_watchlist_items')) {
        const [organizationId, kind] = params
        return rows([...watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at && (!kind || item.kind === kind)).sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`)))
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET archived_at')) {
        const [id, organizationId] = params
        const existing = watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId || existing.archived_at) return rows([])
        const archived = { ...existing, archived_at: iso(), updated_at: iso() }
        watchlists.set(id, archived)
        return rows([archived])
    }

    if (compact.startsWith('UPDATE organizations SET updated_at')) {
        const org = organizations.get(params[0])
        if (org) organizations.set(params[0], { ...org, updated_at: iso() })
        return rows([])
    }

    throw new Error(`Unhandled organization smoke query: ${compact}`)
}

function organizationSummary(organizationId: string, role: string) {
    const org = organizations.get(organizationId)
    const activeMembers = [...members.values()].filter(member => member.organization_id === organizationId && member.status === 'active' && users.get(member.user_id)?.active !== false)
    const activeOwners = activeMembers.filter(member => member.role === 'owner')
    const pendingInvites = [...invites.values()].filter(invite => invite.organization_id === organizationId && invite.status === 'pending' && Date.parse(invite.expires_at) > Date.now())
    const sharedWatchlists = [...watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at)
    return {
        ...org,
        role,
        member_count: activeMembers.length,
        owner_count: activeOwners.length,
        pending_invite_count: pendingInvites.length,
        shared_watchlist_count: sharedWatchlists.length,
    }
}

function organizationRow(row: Row) {
    return nowRow({
        default_webhook_policy: 'active_destinations',
        alert_visibility_policy: 'members',
        retention_days: 365,
        audit_safe_metadata: {},
        ...row,
    })
}

function nowRow(row: Row) {
    const at = iso()
    return { created_at: at, updated_at: at, ...row }
}

function rows(resultRows: Row[]) {
    return { rows: resultRows, rowCount: resultRows.length }
}

function memberKey(organizationId: string, userId: string) {
    return `${organizationId}:${userId}`
}

function nextRole(existingRole: string | undefined, invitedRole: string) {
    const rank: Record<string, number> = { owner: 4, admin: 3, member: 2, viewer: 1 }
    return existingRole && rank[existingRole] > rank[invitedRole] ? existingRole : invitedRole
}

function iso() {
    return new Date().toISOString()
}
