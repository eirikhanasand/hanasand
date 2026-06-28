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
const orgUtils = await import('../src/utils/organizations.ts')
const app = Fastify({ logger: false })

app.get('/api/organizations', handlers.getOrganizations)
app.post('/api/organizations', handlers.postOrganization)
app.post('/api/organizations/invites/:inviteId/accept', handlers.postOrganizationInviteAccept)
app.get('/api/organizations/:id/invites', handlers.getOrganizationInvites)
app.post('/api/organizations/:id/invites', handlers.postOrganizationInvites)
app.post('/api/organizations/:id/invites/:inviteId/actions', handlers.postOrganizationInviteAction)
app.get('/api/organizations/:id/members', handlers.getOrganizationMembers)
app.patch('/api/organizations/:id/members/:userId/role', handlers.patchOrganizationMemberRole)
app.delete('/api/organizations/:id/members/:userId', handlers.deleteOrganizationMember)
app.post('/api/organizations/:id/ownership-transfer', handlers.postOrganizationOwnershipTransfer)
app.get('/api/organizations/:id/settings', handlers.getOrganizationSettings)
app.put('/api/organizations/:id/settings', handlers.putOrganizationSettings)
app.get('/api/organizations/:id/alert-readiness', handlers.getOrganizationAlertReadiness)
app.get('/api/organizations/:id/watchlists', handlers.getOrganizationWatchlists)
app.post('/api/organizations/:id/watchlists', handlers.postOrganizationWatchlist)
app.put('/api/organizations/:organizationId/watchlists/:itemId', handlers.putOrganizationWatchlist)
app.post('/api/organizations/:organizationId/watchlists/:itemId/actions', handlers.postOrganizationWatchlistAction)
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
assert.equal(invite.acceptanceToken, invite.id)
assert.equal(invite.acceptancePath, `/api/organizations/invites/${invite.id}/accept`)
const inviteWorkflow = parseBody(inviteResponse.body).workflow
assert.equal(inviteWorkflow.results[0].acceptanceToken, invite.id)
assert.equal(inviteWorkflow.results[0].acceptancePath, `/api/organizations/invites/${invite.id}/accept`)

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
const pendingOpsInvite = parseBody(pendingOpsInviteResponse.body).invites[0]

const viewerRevokeInviteDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    payload: { action: 'revoke', reason: 'Viewer cannot revoke invites.', requestId: 'smoke-viewer-revoke-denied' },
})
assert.equal(viewerRevokeInviteDeniedResponse.statusCode, 403, viewerRevokeInviteDeniedResponse.body)

const revokePendingInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { action: 'revoke', reason: 'Duplicate operator invite cleanup.', requestId: 'smoke-revoke-pending-ops' },
})
assert.equal(revokePendingInviteResponse.statusCode, 200, revokePendingInviteResponse.body)
const revokedInviteAction = parseBody(revokePendingInviteResponse.body).inviteAction
assert.equal(revokedInviteAction.schemaVersion, 'organization.invite_action.v1')
assert.equal(revokedInviteAction.organizationId, organization.id)
assert.equal(revokedInviteAction.tenantId, organization.id)
assert.equal(revokedInviteAction.action, 'revoke')
assert.equal(revokedInviteAction.status, 'revoked')
assert.equal(revokedInviteAction.previousStatus, 'pending')
assert.equal(revokedInviteAction.requestId, 'smoke-revoke-pending-ops')
assert.equal(revokedInviteAction.acceptanceToken, pendingOpsInvite.id)

const revokedInviteAcceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${pendingOpsInvite.id}/accept`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(revokedInviteAcceptResponse.statusCode, 404, revokedInviteAcceptResponse.body)

const resendPendingInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: {
        action: 'resend',
        reason: 'Restore pending operator invite for rollout.',
        requestId: 'smoke-resend-pending-ops',
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
})
assert.equal(resendPendingInviteResponse.statusCode, 200, resendPendingInviteResponse.body)
const resentInviteAction = parseBody(resendPendingInviteResponse.body).inviteAction
assert.equal(resentInviteAction.action, 'resend')
assert.equal(resentInviteAction.previousStatus, 'revoked')
assert.equal(resentInviteAction.status, 'pending')
assert.equal(resentInviteAction.requestId, 'smoke-resend-pending-ops')
assert.equal(parseBody(resendPendingInviteResponse.body).invite.acceptancePath, `/api/organizations/invites/${pendingOpsInvite.id}/accept`)

const acceptedInviteRevokeResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites/${invite.id}/actions`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { action: 'revoke', reason: 'Accepted invites must be member-managed.', requestId: 'smoke-accepted-revoke-denied' },
})
assert.equal(acceptedInviteRevokeResponse.statusCode, 409, acceptedInviteRevokeResponse.body)

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

const memberRoleUpdateDeniedResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { role: 'member', reason: 'Member should not manage roles.', requestId: 'smoke-member-role-denied' },
})
assert.equal(memberRoleUpdateDeniedResponse.statusCode, 403, memberRoleUpdateDeniedResponse.body)

const adminPromotesViewerDeniedResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { role: 'admin', reason: 'Admin cannot promote another admin.', requestId: 'smoke-admin-promote-denied' },
})
assert.equal(adminPromotesViewerDeniedResponse.statusCode, 403, adminPromotesViewerDeniedResponse.body)

const ownerUpdatesViewerRoleResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { role: 'member', reason: 'Temporary rollout support.', requestId: 'smoke-viewer-role-member' },
})
assert.equal(ownerUpdatesViewerRoleResponse.statusCode, 200, ownerUpdatesViewerRoleResponse.body)
const ownerRoleChange = parseBody(ownerUpdatesViewerRoleResponse.body).roleChange
assert.equal(ownerRoleChange.schemaVersion, 'organization.member_role_change.v1')
assert.equal(ownerRoleChange.previousRole, 'viewer')
assert.equal(ownerRoleChange.newRole, 'member')
assert.equal(ownerRoleChange.requestId, 'smoke-viewer-role-member')

const ownerRestoresViewerRoleResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { role: 'viewer', reason: 'Restore least privilege after rollout.', requestId: 'smoke-viewer-role-restore' },
})
assert.equal(ownerRestoresViewerRoleResponse.statusCode, 200, ownerRestoresViewerRoleResponse.body)
assert.equal(parseBody(ownerRestoresViewerRoleResponse.body).member.role, 'viewer')

const ownerWatchlistResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { kind: 'domain', value: 'https://www.acme-shared.example/login', notes: 'Customer domain', reason: 'Live proof domain seed.', requestId: 'smoke-domain-create' },
})
assert.equal(ownerWatchlistResponse.statusCode, 201, ownerWatchlistResponse.body)
const ownerWatchlistItem = parseBody(ownerWatchlistResponse.body).watchlistItem
assert.equal(ownerWatchlistItem.status, 'active')
assert.equal(ownerWatchlistItem.createdBy, 'org_smoke_owner')
assert.equal(ownerWatchlistItem.updatedBy, 'org_smoke_owner')
assert.equal(ownerWatchlistItem.lifecycleReason, 'Live proof domain seed.')
assert.equal(ownerWatchlistItem.lifecycleRequestId, 'smoke-domain-create')
assert.equal(ownerWatchlistItem.alertGenerationReference.watchlistItemId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistItem.alertGenerationReference.category, 'domain')

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

members.set(memberKey(organization.id, 'org_smoke_deactivated'), nowRow({
    organization_id: organization.id,
    user_id: 'org_smoke_deactivated',
    role: 'member',
    status: 'active',
    invited_by: 'org_smoke_admin',
    joined_at: iso(),
}))
const deactivatedMemberWatchlistResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_deactivated', 'deactivated-token'),
})
assert.equal(deactivatedMemberWatchlistResponse.statusCode, 404, deactivatedMemberWatchlistResponse.body)

const viewerAddsWatchlistResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    payload: { kind: 'company', value: 'Viewer Blocked Holdings' },
})
assert.equal(viewerAddsWatchlistResponse.statusCode, 403, viewerAddsWatchlistResponse.body)

const memberAddsWatchlistDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { kind: 'keyword', value: 'member should not mutate' },
})
assert.equal(memberAddsWatchlistDeniedResponse.statusCode, 403, memberAddsWatchlistDeniedResponse.body)

const viewerArchiveWatchlistResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(viewerArchiveWatchlistResponse.statusCode, 403, viewerArchiveWatchlistResponse.body)

const ownerAddsCompanyResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { kind: 'company', value: 'Acme Shared Holdings', requestId: 'smoke-company-watchlist' },
})
assert.equal(ownerAddsCompanyResponse.statusCode, 201, ownerAddsCompanyResponse.body)
const companyWatchlistItem = parseBody(ownerAddsCompanyResponse.body).watchlistItem

const ownerPausesCompanyResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/${companyWatchlistItem.id}/actions`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { action: 'pause', reason: 'Pause during live proof cleanup.', requestId: 'smoke-pause-company' },
})
assert.equal(ownerPausesCompanyResponse.statusCode, 200, ownerPausesCompanyResponse.body)
assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.status, 'paused')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.action, 'pause')

const pausedWatchlistsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists?status=paused`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(pausedWatchlistsResponse.statusCode, 200, pausedWatchlistsResponse.body)
assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.id), [companyWatchlistItem.id])

const readinessWhilePausedResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(readinessWhilePausedResponse.statusCode, 200, readinessWhilePausedResponse.body)
assert.equal(parseBody(readinessWhilePausedResponse.body).alertReadiness.sharedWatchlistCount, 1)
assert.equal(parseBody(readinessWhilePausedResponse.body).alertReadiness.generatedAlertReferences.length, 1)

const ownerResumesCompanyResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/${companyWatchlistItem.id}/actions`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { action: 'resume', reason: 'Resume after cleanup dry run.', request_id: 'smoke-resume-company' },
})
assert.equal(ownerResumesCompanyResponse.statusCode, 200, ownerResumesCompanyResponse.body)
assert.equal(parseBody(ownerResumesCompanyResponse.body).watchlistItem.status, 'active')
assert.equal(parseBody(ownerResumesCompanyResponse.body).watchlistItem.lifecycleRequestId, 'smoke-resume-company')

const adminAddsActorResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { kind: 'actor', value: 'Scattered Spider', notes: 'Actor alias', requestId: 'smoke-actor-watchlist' },
})
assert.equal(adminAddsActorResponse.statusCode, 201, adminAddsActorResponse.body)
const actorWatchlistItem = parseBody(adminAddsActorResponse.body).watchlistItem
assert.equal(actorWatchlistItem.value, 'scattered spider')

const actorFilterResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists?kind=actor`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(actorFilterResponse.statusCode, 200, actorFilterResponse.body)
assert.deepEqual(parseBody(actorFilterResponse.body).watchlistItems.map((item: Row) => item.value), ['scattered spider'])

const memberAddsKeywordResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { kind: 'keyword', value: 'Credential Reset', notes: 'Phishing wording', requestId: 'smoke-keyword-watchlist' },
})
assert.equal(memberAddsKeywordResponse.statusCode, 201, memberAddsKeywordResponse.body)
const keywordWatchlistItem = parseBody(memberAddsKeywordResponse.body).watchlistItem
assert.equal(keywordWatchlistItem.value, 'credential reset')

const memberUpdatesKeywordResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/watchlists/${keywordWatchlistItem.id}`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { kind: 'keyword', value: 'Credential Reset Lures', notes: 'Updated wording', reason: 'Refine live proof keyword.', requestId: 'smoke-keyword-update' },
})
assert.equal(memberUpdatesKeywordResponse.statusCode, 200, memberUpdatesKeywordResponse.body)
assert.equal(parseBody(memberUpdatesKeywordResponse.body).watchlistItem.value, 'credential reset lures')
assert.equal(parseBody(memberUpdatesKeywordResponse.body).operation.action, 'updated')

const memberAddsVendorResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { kind: 'vendor', value: 'Acme Payroll Vendor' },
})
assert.equal(memberAddsVendorResponse.statusCode, 201, memberAddsVendorResponse.body)

const ownerSeesAllResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(ownerSeesAllResponse.statusCode, 200, ownerSeesAllResponse.body)
assert.deepEqual(
    parseBody(ownerSeesAllResponse.body).watchlistItems.map((item: Row) => item.value).sort(),
    ['Acme Payroll Vendor', 'Acme Shared Holdings', 'acme-shared.example', 'credential reset lures', 'scattered spider'].sort()
)
assert.deepEqual(parseBody(ownerSeesAllResponse.body).sharedWatchlistContract.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])

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
assert.equal(readiness.sharedWatchlistCount, 5)
assert.equal(readiness.readinessStatus, 'ready')
assert.equal(readiness.ready, true)
assert.equal(readiness.teamOnboardingReadiness.schemaVersion, 'organization.team_onboarding_readiness.v1')
assert.equal(readiness.teamOnboardingReadiness.targetMemberCount, 10)
assert.equal(readiness.teamOnboardingReadiness.activeMemberCount, 4)
assert.equal(readiness.teamOnboardingReadiness.pendingInviteCount, 11)
assert.equal(readiness.teamOnboardingReadiness.acceptedOrInvitedCount, 15)
assert.equal(readiness.teamOnboardingReadiness.sharedWatchlistCount, 5)
assert.equal(readiness.teamOnboardingReadiness.canSupportTenMemberSharedWatchlistRollout, true)
assert.deepEqual(readiness.teamOnboardingReadiness.blockedReasons, [])
assert.equal(readiness.alertGenerationBridge.schemaVersion, 'organization.watchlist_alert_generation.v1')
assert.equal(readiness.alertGenerationBridge.organizationId, organization.id)
assert.equal(readiness.alertGenerationBridge.tenantId, organization.id)
assert.deepEqual(readiness.alertGenerationBridge.allowedViewerRoles, ['owner', 'admin'])
assert.deepEqual(readiness.alertGenerationBridge.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
assert.equal(readiness.alertGenerationBridge.activeWatchlistTerms.length, 5)
assert.equal(readiness.alertGenerationBridge.activeWatchlistTerms.find((term: Row) => term.term === 'credential reset lures').family, 'keyword')
assert.equal(readiness.alertGenerationBridge.canGenerateAlerts, true)
assert.deepEqual(readiness.alertGenerationBridge.blockedReasons, [])
const adapterContract = orgUtils.organizationWatchlistAlertGenerationContract(
    organizationSummary(organization.id, 'member'),
    [...watchlists.values()].filter(item => item.organization_id === organization.id && !item.archived_at)
)
assert.deepEqual(adapterContract, readiness.alertGenerationBridge)
assert.equal(readiness.generatedAlertReferences.length, 5)
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
assert.equal(domainReference.alert.sharedWatchlistCount, 5)
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
assert.equal(domainReference.watchlist.termFamily, 'domain')
assert.equal(domainReference.matchedTerm.termFamily, 'domain')
assert.equal(domainReference.alert.matchedTerm.termFamily, 'domain')
assert.deepEqual(domainReference.watchlist.terms, ['acme-shared.example'])

const viewerReadinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(viewerReadinessResponse.statusCode, 200, viewerReadinessResponse.body)
assert.equal(parseBody(viewerReadinessResponse.body).alertReadiness.watchlistItemCount, 5)

const ownerDisablesActorResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}?requestId=smoke-disable-actor`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(ownerDisablesActorResponse.statusCode, 200, ownerDisablesActorResponse.body)
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.action, 'disabled')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.requestId, 'smoke-disable-actor')
assert.equal(parseBody(ownerDisablesActorResponse.body).watchlistItem.status, 'archived')

const archivedWatchlistsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists?status=archived`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(archivedWatchlistsResponse.statusCode, 200, archivedWatchlistsResponse.body)
assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.id), [actorWatchlistItem.id])

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
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_updated' && log.metadata.requestId === 'smoke-keyword-update'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_paused' && log.metadata.requestId === 'smoke-pause-company'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_resumed' && log.metadata.requestId === 'smoke-resume-company'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_archived' && log.metadata.requestId === 'smoke-disable-actor'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.role === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted' && log.metadata.role === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_revoked' && log.metadata.requestId === 'smoke-revoke-pending-ops'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_resent' && log.metadata.requestId === 'smoke-resend-pending-ops'))
assert.ok(serviceLogs.some(log => log.message === 'organization_settings_updated' && log.metadata.fields.includes('defaultWebhookPolicy')))
assert.ok(serviceLogs.some(log => log.message === 'organization_ownership_transferred' && log.metadata.targetUserId === 'org_smoke_admin'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_role_updated' && log.metadata.requestId === 'smoke-viewer-role-member'))

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

    if (compact.startsWith('SELECT * FROM organization_invites WHERE id = $1')) {
        const [inviteId, organizationId] = params
        const invite = invites.get(inviteId)
        return rows(invite && invite.organization_id === organizationId ? [invite] : [])
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

    if (compact.startsWith('UPDATE organization_invites SET status = \'pending\'')) {
        const [inviteId, organizationId, expiresAt] = params
        const existing = invites.get(inviteId)
        if (!existing || existing.organization_id !== organizationId || existing.status === 'accepted') return rows([])
        const updated = { ...existing, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt, created_at: iso() }
        invites.set(inviteId, updated)
        return rows([updated])
    }

    if (compact.startsWith('UPDATE organization_invites SET status = \'revoked\'')) {
        const [inviteId, organizationId] = params
        const existing = invites.get(inviteId)
        if (!existing || existing.organization_id !== organizationId || existing.status === 'accepted') return rows([])
        const updated = { ...existing, status: 'revoked', accepted_at: null, accepted_by: null }
        invites.set(inviteId, updated)
        return rows([updated])
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

    if (compact.startsWith('UPDATE organization_members SET role = $3')) {
        const [organizationId, userId, role] = params
        const key = memberKey(organizationId, userId)
        const existing = members.get(key)
        if (!existing || existing.status !== 'active') return rows([])
        const updated = { ...existing, role }
        members.set(key, updated)
        return rows([{ ...updated, name: users.get(userId)?.name ?? userId, avatar: users.get(userId)?.avatar ?? '' }])
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
        const [id, organizationId, value, notes, updatedBy, reason, requestId] = params
        const existing = watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId) return rows([])
        const updated = { ...existing, value, notes, status: 'active', updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
        watchlists.set(id, updated)
        return rows([updated])
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET kind')) {
        const [id, organizationId, kind, value, notes, updatedBy, reason, requestId] = params
        const existing = watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId || existing.archived_at || existing.status === 'archived') return rows([])
        const updated = { ...existing, kind, value, notes, updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
        watchlists.set(id, updated)
        return rows([updated])
    }

    if (compact.startsWith('INSERT INTO organization_watchlist_items')) {
        const [id, organizationId, kind, value, notes, createdBy, reason, requestId] = params
        const item = nowRow({ id, organization_id: organizationId, kind, value, notes, status: 'active', created_by: createdBy, updated_by: createdBy, lifecycle_reason: reason, lifecycle_request_id: requestId, archived_at: null })
        watchlists.set(id, item)
        return rows([item])
    }

    if (compact.startsWith('SELECT * FROM organization_watchlist_items')) {
        if (params.length === 1) {
            const [organizationId] = params
            return rows([...watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at && item.status === 'active').sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`)))
        }

        const [organizationId, includeArchived, kind, status] = params
        return rows([...watchlists.values()]
            .filter(item => item.organization_id === organizationId)
            .filter(item => includeArchived || !item.archived_at)
            .filter(item => !kind || item.kind === kind)
            .filter(item => !status || item.status === status)
            .sort((a, b) => `${a.status}:${a.kind}:${a.value}`.localeCompare(`${b.status}:${b.kind}:${b.value}`)))
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET status = \'archived\'')) {
        const [id, organizationId, updatedBy, reason, requestId] = params
        const existing = watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId || existing.archived_at) return rows([])
        const archived = { ...existing, status: 'archived', archived_at: iso(), updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
        watchlists.set(id, archived)
        return rows([archived])
    }

    if (compact.startsWith('UPDATE organization_watchlist_items SET status = $3')) {
        const [id, organizationId, status, updatedBy, reason, requestId] = params
        const existing = watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId || existing.archived_at) return rows([])
        const updated = { ...existing, status, archived_at: status === 'archived' ? iso() : null, updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
        watchlists.set(id, updated)
        return rows([updated])
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
    const sharedWatchlists = [...watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at && item.status === 'active')
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
