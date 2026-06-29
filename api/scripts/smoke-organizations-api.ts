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
app.get('/api/organizations/:id/watchlists/alert-terms', handlers.getOrganizationWatchlistAlertTerms)
app.get('/api/organizations/:id/watchlists', handlers.getOrganizationWatchlists)
app.post('/api/organizations/:id/watchlists', handlers.postOrganizationWatchlist)
app.post('/api/organizations/:id/watchlists/cleanup', handlers.postOrganizationWatchlistCleanup)
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
assert.equal(organization.activeAdminCount, 1)
assert.equal(organization.settings.defaultWebhookPolicy, 'active_destinations')
assert.equal(organization.settings.alertVisibilityPolicy, 'members')
assert.equal(organization.settings.retentionDays, 365)
const createdLifecycleReadiness = parseBody(organizationResponse.body).lifecycleReadiness
assert.equal(createdLifecycleReadiness.schemaVersion, 'organization.lifecycle_readiness.v1')
assert.equal(createdLifecycleReadiness.organizationId, organization.id)
assert.equal(createdLifecycleReadiness.tenantId, organization.id)
assert.equal(createdLifecycleReadiness.lifecycleStatus, 'active')
assert.equal(createdLifecycleReadiness.actorRole, 'owner')
assert.equal(createdLifecycleReadiness.counts.memberCount, 1)
assert.equal(createdLifecycleReadiness.counts.activeAdminCount, 1)
assert.equal(createdLifecycleReadiness.watchlistReadiness.ready, false)
assert.equal(createdLifecycleReadiness.alertExportReadiness.ready, false)
assert.deepEqual(createdLifecycleReadiness.typedBlockers, ['watchlist_setup_required', 'alert_export_unavailable'])
assert.equal(createdLifecycleReadiness.memberRoleReadiness.ownerCanMutate, true)
assert.equal(createdLifecycleReadiness.memberRoleReadiness.supportReadMode, 'redacted_support_contract_only')
assert.equal(createdLifecycleReadiness.memberRoleReadiness.nonmemberEnumeration, false)
assert.equal(createdLifecycleReadiness.memberRoleReadiness.revokedMemberDenial, 'member_revoked')
assert.equal(createdLifecycleReadiness.memberRoleReadiness.expiredInviteDenial, 'invite_expired')
assert.equal(createdLifecycleReadiness.supportVisibility.redactionBlocker, 'support_redaction_required')
assert.ok(createdLifecycleReadiness.blockerCatalog.includes('org_missing'))
assert.ok(createdLifecycleReadiness.blockerCatalog.includes('org_archived'))
assert.ok(createdLifecycleReadiness.blockerCatalog.includes('org_deleted'))
assert.ok(createdLifecycleReadiness.blockerCatalog.includes('no_active_admin'))
assert.ok(createdLifecycleReadiness.blockerCatalog.includes('cleanup_required'))

const ownerReadOrganizationResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(ownerReadOrganizationResponse.statusCode, 200, ownerReadOrganizationResponse.body)
const ownerReadOrganization = parseBody(ownerReadOrganizationResponse.body).organization
assert.equal(ownerReadOrganization.id, organization.id)
assert.equal(ownerReadOrganization.role, 'owner')
assert.equal(ownerReadOrganization.memberCount, 1)
assert.equal(ownerReadOrganization.settings.defaultWebhookPolicy, 'active_destinations')
assert.deepEqual(parseBody(ownerReadOrganizationResponse.body).lifecycleReadiness.typedBlockers, ['watchlist_setup_required', 'alert_export_unavailable'])

const ownerDefaultSettingsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(ownerDefaultSettingsResponse.statusCode, 200, ownerDefaultSettingsResponse.body)
const ownerDefaultSettings = parseBody(ownerDefaultSettingsResponse.body)
assert.equal(ownerDefaultSettings.permissions.canEdit, true)
assert.equal(ownerDefaultSettings.settings.defaultWebhookPolicy, 'active_destinations')
assert.equal(ownerDefaultSettings.lifecycleReadiness.counts.activeAdminCount, 1)

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

const memberReadUpdatedOrganizationResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(memberReadUpdatedOrganizationResponse.statusCode, 200, memberReadUpdatedOrganizationResponse.body)
const memberReadUpdatedOrganization = parseBody(memberReadUpdatedOrganizationResponse.body).organization
assert.equal(memberReadUpdatedOrganization.name, 'Smoke Shared Operations')
assert.equal(memberReadUpdatedOrganization.slug, 'shared-ops')
assert.equal(memberReadUpdatedOrganization.role, 'member')
assert.equal(memberReadUpdatedOrganization.settings.defaultWebhookPolicy, 'manual_selection')
assert.equal(memberReadUpdatedOrganization.settings.alertVisibilityPolicy, 'admins')
const memberReadLifecycle = parseBody(memberReadUpdatedOrganizationResponse.body).lifecycleReadiness
assert.equal(memberReadLifecycle.actorRole, 'member')
assert.equal(memberReadLifecycle.memberRoleReadiness.ownerCanMutate, false)
assert.equal(memberReadLifecycle.memberRoleReadiness.adminCanMutate, false)
assert.equal(memberReadLifecycle.memberRoleReadiness.memberCanReadAndExport, true)

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
    assert.equal(readableSettings.lifecycleReadiness.supportVisibility.mode, 'redacted_summary_only')
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
assert.equal(revokedInviteAction.actorId, 'org_smoke_admin')
assert.equal(revokedInviteAction.actorRole, 'admin')
assert.equal(revokedInviteAction.reason, 'Duplicate operator invite cleanup.')
assert.equal(revokedInviteAction.serviceLogAction, 'organization_invite_revoked')

const revokePendingInviteRepeatResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { action: 'revoke', reason: 'Repeat revoke should be safe.', requestId: 'smoke-revoke-pending-ops-repeat' },
})
assert.equal(revokePendingInviteRepeatResponse.statusCode, 200, revokePendingInviteRepeatResponse.body)
const repeatRevokedInviteAction = parseBody(revokePendingInviteRepeatResponse.body).inviteAction
assert.equal(repeatRevokedInviteAction.previousStatus, 'revoked')
assert.equal(repeatRevokedInviteAction.status, 'revoked')
assert.equal(repeatRevokedInviteAction.requestId, 'smoke-revoke-pending-ops-repeat')

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
assert.equal(resentInviteAction.actorId, 'org_smoke_owner')
assert.equal(resentInviteAction.actorRole, 'owner')
assert.equal(resentInviteAction.reason, 'Restore pending operator invite for rollout.')
assert.equal(resentInviteAction.serviceLogAction, 'organization_invite_resent')
assert.equal(parseBody(resendPendingInviteResponse.body).invite.acceptancePath, `/api/organizations/invites/${pendingOpsInvite.id}/accept`)

const resendPendingInviteRepeatResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites/${pendingOpsInvite.id}/actions`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: {
        action: 'resend',
        reason: 'Repeat resend should keep access pending.',
        requestId: 'smoke-resend-pending-ops-repeat',
    },
})
assert.equal(resendPendingInviteRepeatResponse.statusCode, 200, resendPendingInviteRepeatResponse.body)
const repeatResentInviteAction = parseBody(resendPendingInviteRepeatResponse.body).inviteAction
assert.equal(repeatResentInviteAction.previousStatus, 'pending')
assert.equal(repeatResentInviteAction.status, 'pending')
assert.equal(repeatResentInviteAction.requestId, 'smoke-resend-pending-ops-repeat')

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
assert.equal(bulkInviteWorkflow.expiresAt, parseBody(bulkInviteResponse.body).invites[0].expiresAt)
assert.deepEqual(bulkInviteWorkflow.results.map((result: Row) => result.outcome), Array(10).fill('invited'))
assert.ok(bulkInviteWorkflow.results.every((result: Row) => result.acceptanceToken === result.inviteId))
assert.ok(bulkInviteWorkflow.results.every((result: Row) => result.acceptancePath === `/api/organizations/invites/${result.inviteId}/accept`))

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
assert.equal(ownerRoleChange.organizationId, organization.id)
assert.equal(ownerRoleChange.tenantId, organization.id)
assert.equal(ownerRoleChange.actorId, 'org_smoke_owner')
assert.equal(ownerRoleChange.targetUserId, 'org_smoke_viewer')
assert.equal(ownerRoleChange.previousRole, 'viewer')
assert.equal(ownerRoleChange.newRole, 'member')
assert.equal(ownerRoleChange.reason, 'Temporary rollout support.')
assert.equal(ownerRoleChange.requestId, 'smoke-viewer-role-member')
assert.equal(ownerRoleChange.serviceLogAction, 'organization_member_role_updated')

const ownerRestoresViewerRoleResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { role: 'viewer', reason: 'Restore least privilege after rollout.', requestId: 'smoke-viewer-role-restore' },
})
assert.equal(ownerRestoresViewerRoleResponse.statusCode, 200, ownerRestoresViewerRoleResponse.body)
assert.equal(parseBody(ownerRestoresViewerRoleResponse.body).member.role, 'viewer')
const restoreRoleChange = parseBody(ownerRestoresViewerRoleResponse.body).roleChange
assert.equal(restoreRoleChange.previousRole, 'member')
assert.equal(restoreRoleChange.newRole, 'viewer')
assert.equal(restoreRoleChange.reason, 'Restore least privilege after rollout.')
assert.equal(restoreRoleChange.requestId, 'smoke-viewer-role-restore')

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
const ownerWatchlistOperation = parseBody(ownerWatchlistResponse.body).operation
assert.equal(ownerWatchlistOperation.actorId, 'org_smoke_owner')
assert.equal(ownerWatchlistOperation.requestId, 'smoke-domain-create')
assert.equal(ownerWatchlistOperation.serviceLogAction, 'organization_watchlist_upserted')

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

const alertTermsWhilePausedResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-paused`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(alertTermsWhilePausedResponse.statusCode, 200, alertTermsWhilePausedResponse.body)
const alertTermsWhilePaused = parseBody(alertTermsWhilePausedResponse.body).alertTermsExport
assert.equal(alertTermsWhilePaused.schemaVersion, 'organization.watchlist_alert_terms_export.v1')
assert.equal(alertTermsWhilePaused.organizationId, organization.id)
assert.equal(alertTermsWhilePaused.member.userId, 'org_smoke_member')
assert.equal(alertTermsWhilePaused.member.role, 'member')
assert.equal(alertTermsWhilePaused.activeTerms.length, 1)
assert.equal(alertTermsWhilePaused.excluded.pausedCount, 1)
assert.deepEqual(alertTermsWhilePaused.alertBridgeContract.typedBlockers.map((blocker: Row) => blocker.code), ['paused_watchlist_excluded'])
assert.equal(alertTermsWhilePaused.alertBridgeContract.typedBlockers[0].severity, 'notice')
assert.equal(alertTermsWhilePaused.alertBridgeContract.typedBlockers[0].count, 1)
assert.deepEqual(alertTermsWhilePaused.alertBridgeContract.lifecycleReadiness.typedBlockers.map((blocker: Row) => blocker.code), ['watchlist_paused', 'cleanup_required'])
assert.equal(alertTermsWhilePaused.alertBridgeContract.lifecycleReadiness.watchlists.cleanupRequired, true)
assert.equal(alertTermsWhilePaused.alertBridgeContract.lifecycleReadiness.watchlists.cleanupIdempotent, true)
assert.equal(alertTermsWhilePaused.alertBridgeContract.lifecycleReadiness.alertReplay.status, 'ready')
assert.equal(alertTermsWhilePaused.activeTerms[0].status, 'active')
assert.equal(alertTermsWhilePaused.activeTerms[0].alertGenerationReference.status, 'active')
assert.equal(alertTermsWhilePaused.activeTerms[0].alertGenerationRef.status, 'active')
assert.equal(alertTermsWhilePaused.activeTerms[0].alertGenerationRef.lifecycle.status, 'active')
assert.equal(alertTermsWhilePaused.activeTerms[0].alertGenerationRef.dedupe.scope, 'organization_watchlist_term')

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
assert.equal(readiness.lifecycleReadiness.schemaVersion, 'organization.lifecycle_readiness.v1')
assert.equal(readiness.lifecycleReadiness.actorRole, 'member')
assert.equal(readiness.lifecycleReadiness.counts.memberCount, 4)
assert.equal(readiness.lifecycleReadiness.counts.activeAdminCount, 2)
assert.equal(readiness.lifecycleReadiness.counts.pendingInviteCount, 11)
assert.equal(readiness.lifecycleReadiness.counts.sharedWatchlistCount, 5)
assert.equal(readiness.lifecycleReadiness.watchlistReadiness.ready, true)
assert.equal(readiness.lifecycleReadiness.alertExportReadiness.ready, true)
assert.equal(readiness.lifecycleReadiness.cleanupReadiness.cleanupIdempotent, true)
assert.equal(readiness.lifecycleReadiness.supportVisibility.mode, 'redacted_summary_only')
assert.deepEqual(readiness.lifecycleReadiness.typedBlockers, [])
assert.equal(readiness.lifecycleReadiness.readyForOnboarding, true)
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
const alertTermsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?request_id=smoke-alert-terms-ready`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(alertTermsResponse.statusCode, 200, alertTermsResponse.body)
const alertTermsExport = parseBody(alertTermsResponse.body).alertTermsExport
assert.equal(alertTermsExport.schemaVersion, 'organization.watchlist_alert_terms_export.v1')
assert.equal(alertTermsExport.organizationId, organization.id)
assert.equal(alertTermsExport.tenantId, organization.id)
assert.equal(alertTermsExport.member.userId, 'org_smoke_admin')
assert.equal(alertTermsExport.member.role, 'admin')
assert.equal(alertTermsExport.recommendedDownstreamRoute, 'organization_watchlist')
assert.equal(alertTermsExport.alertBridgeContract.schemaVersion, 'organization.watchlist_alert_bridge_contract.v1')
assert.equal(alertTermsExport.alertBridgeContract.recommendedDownstreamRoute, 'organization_watchlist')
assert.deepEqual(alertTermsExport.alertBridgeContract.memberProvenance, {
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
})
assert.equal(alertTermsExport.alertBridgeContract.supportAccess.mode, 'support_contract_only')
assert.equal(alertTermsExport.alertBridgeContract.supportAccess.blockerCode, 'support_only_access')
assert.equal(alertTermsExport.alertBridgeContract.supportVisibility.mode, 'redacted_summary_only')
assert.equal(alertTermsExport.alertBridgeContract.supportVisibility.contract, 'admin_support')
assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.safeFields.includes('activeTermCount'))
assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.safeFields.includes('termFamilies'))
assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.redactedFields.includes('member.userId'))
assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.redactedFields.includes('activeTerms[].term'))
assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.redactedFields.includes('activeTerms[].alertGenerationRef.lifecycle.createdBy'))
assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.route, 'organization_watchlist')
assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.pathTemplate, '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
assert.deepEqual(alertTermsExport.alertBridgeContract.caseRouteExpectation.queryFields, ['organizationId', 'watchlistItemId'])
assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.blockerCode, 'no_case_route')
assert.equal(alertTermsExport.alertBridgeContract.redactedSummary.schemaVersion, 'organization.watchlist_alert_bridge_redacted_summary.v1')
assert.equal(alertTermsExport.alertBridgeContract.redactedSummary.organizationId, organization.id)
assert.equal(alertTermsExport.alertBridgeContract.redactedSummary.tenantId, organization.id)
assert.equal(alertTermsExport.alertBridgeContract.redactedSummary.activeTermCount, 5)
assert.deepEqual(alertTermsExport.alertBridgeContract.redactedSummary.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
assert.equal(alertTermsExport.alertBridgeContract.redactedSummary.pausedCount, 0)
assert.equal(alertTermsExport.alertBridgeContract.redactedSummary.archivedCount, 0)
assert.equal(alertTermsExport.alertBridgeContract.redactedSummary.cleanupRequired, false)
assert.equal(alertTermsExport.alertBridgeContract.redactedSummary.containsRawTerms, false)
assert.ok(!('activeTerms' in alertTermsExport.alertBridgeContract.redactedSummary))
assert.ok(!('member' in alertTermsExport.alertBridgeContract.redactedSummary))
assert.equal(alertTermsExport.alertBridgeContract.deniedAccess.nonmember, 'nonmember_denied')
assert.equal(alertTermsExport.alertBridgeContract.deniedAccess.revokedMember, 'revoked_member_denied')
assert.equal(alertTermsExport.alertBridgeContract.alertGeneratorKeyExpectation, 'alertGenerationRef.dedupe.key')
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('organizationId'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('member.userId'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('activeTerms[].alertGenerationRef'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.caseRouteExpectation.pathTemplate'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.redactedSummary'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.lifecycleReadiness'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.alertCaseProof'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_active_org'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_active_admin'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('org_deleted'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('invite_expired'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('member_revoked'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('watchlist_archived'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('watchlist_paused'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_active_terms'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('paused_archived_only'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('cleanup_required'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('alert_bridge_unavailable'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('alert_export_unavailable'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('case_route_unavailable'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('support_redaction_required'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_active_watchlist_terms'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('paused_watchlist_excluded'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('archived_watchlist_excluded'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('missing_org_tenant'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('revoked_member_denied'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_alert_ref'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_case_route'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('support_only_access'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('nonmember_denied'))
assert.deepEqual(alertTermsExport.alertBridgeContract.typedBlockers, [])
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.organization.status, 'active')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.organization.deletedBlocker, 'org_deleted')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.member.status, 'active')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.member.revokedBlocker, 'member_revoked')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.invites.expiredInviteBlocker, 'invite_expired')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.invites.revokedInviteBlocker, 'member_revoked')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.activeTermCount, 5)
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.pausedCount, 0)
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.archivedCount, 0)
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.cleanupRequired, false)
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.cleanupIdempotent, true)
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.pausedBlocker, 'watchlist_paused')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.archivedBlocker, 'watchlist_archived')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.noActiveTermsBlocker, 'no_active_terms')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.cleanupRequiredBlocker, 'cleanup_required')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.alertReplay.status, 'ready')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.alertReplay.unavailableBlocker, 'alert_bridge_unavailable')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.caseRoute.status, 'expected')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.caseRoute.unavailableBlocker, 'case_route_unavailable')
assert.deepEqual(alertTermsExport.alertBridgeContract.lifecycleReadiness.typedBlockers, [])
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.schemaVersion, 'organization.watchlist_alert_case_proof.v1')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.organizationId, organization.id)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.tenantId, organization.id)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.readyForReplay, true)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.activeAdminCount, 2)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.activeTermCount, 5)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.replayRoute, 'organization_watchlist')
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedAlertFields.includes('alertGenerationRef.dedupe.key'))
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedAlertFields.includes('alertGenerationRef.lifecycle.requestId'))
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedCaseFields.includes('casePath'))
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedCaseFields.includes('allowedViewerRoles'))
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedSupportFields.includes('redactedSummary'))
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedSupportFields.includes('supportVisibility.redactedFields'))
assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.memberVisibility, {
    mode: 'member_scoped_export',
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
    nonmemberEnumeration: false,
    revokedMemberDenial: 'member_revoked',
})
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.supportRedaction.mode, 'redacted_summary_only')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.supportRedaction.required, true)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.supportRedaction.blockerCode, 'support_redaction_required')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, false)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupIdempotent, true)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.typedBlockers, [])
assert.equal(alertTermsExport.activeTerms.length, 5)
assert.equal(alertTermsExport.activeWatchlistTerms.length, 5)
assert.deepEqual(alertTermsExport.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
assert.equal(alertTermsExport.excluded.inactiveCount, 0)
const keywordExportTerm = alertTermsExport.activeTerms.find((term: Row) => term.term === 'credential reset lures')
assert.equal(keywordExportTerm.category, 'keyword')
assert.equal(keywordExportTerm.source, 'organization_shared_watchlist')
assert.match(keywordExportTerm.alertGeneratorKey, /^org:/)
assert.equal(keywordExportTerm.lifecycleReason, 'Refine live proof keyword.')
assert.equal(keywordExportTerm.lifecycleRequestId, 'smoke-keyword-update')
assert.equal(keywordExportTerm.alertGenerationReference.watchlistItemId, keywordExportTerm.watchlistItemId)
assert.equal(keywordExportTerm.alertGenerationRef.schemaVersion, 'organization.watchlist_alert_generation_ref.v1')
assert.equal(keywordExportTerm.alertGenerationRef.source, 'organization_shared_watchlist')
assert.equal(keywordExportTerm.alertGenerationRef.organizationId, organization.id)
assert.equal(keywordExportTerm.alertGenerationRef.tenantId, organization.id)
assert.equal(keywordExportTerm.alertGenerationRef.ownerOrganizationId, organization.id)
assert.equal(keywordExportTerm.alertGenerationRef.watchlistId, keywordExportTerm.watchlistItemId)
assert.equal(keywordExportTerm.alertGenerationRef.watchlistItemId, keywordExportTerm.watchlistItemId)
assert.equal(keywordExportTerm.alertGenerationRef.itemId, keywordExportTerm.itemId)
assert.equal(keywordExportTerm.alertGenerationRef.termFamily, 'keyword')
assert.equal(keywordExportTerm.alertGenerationRef.category, 'keyword')
assert.equal(keywordExportTerm.alertGenerationRef.term, 'credential reset lures')
assert.equal(keywordExportTerm.alertGenerationRef.normalizedTerm, 'credential reset lures')
assert.equal(keywordExportTerm.alertGenerationRef.lifecycle.reason, 'Refine live proof keyword.')
assert.equal(keywordExportTerm.alertGenerationRef.lifecycle.requestId, 'smoke-keyword-update')
assert.equal(keywordExportTerm.alertGenerationRef.lifecycle.createdBy, 'org_smoke_admin')
assert.equal(keywordExportTerm.alertGenerationRef.lifecycle.updatedBy, 'org_smoke_admin')
assert.equal(keywordExportTerm.alertGenerationRef.dedupe.key, keywordExportTerm.alertGeneratorKey)
assert.deepEqual(keywordExportTerm.alertGenerationRef.dedupe.parts, {
    organizationId: organization.id,
    tenantId: organization.id,
    watchlistItemId: keywordExportTerm.watchlistItemId,
    termFamily: 'keyword',
    normalizedTerm: 'credential reset lures',
})
assert.deepEqual(
    alertTermsExport.activeWatchlistTerms,
    readiness.alertGenerationBridge.activeWatchlistTerms
)

const memberAlertTermsReadyResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-member-alert-terms-ready`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(memberAlertTermsReadyResponse.statusCode, 200, memberAlertTermsReadyResponse.body)
const memberAlertTermsExport = parseBody(memberAlertTermsReadyResponse.body).alertTermsExport
assert.equal(memberAlertTermsExport.member.userId, 'org_smoke_member')
assert.equal(memberAlertTermsExport.member.role, 'member')
assert.equal(memberAlertTermsExport.canGenerateAlerts, true)
assert.equal(memberAlertTermsExport.activeTerms.length, 5)
assert.deepEqual(memberAlertTermsExport.alertBridgeContract.memberProvenance, {
    userId: 'org_smoke_member',
    role: 'member',
    status: 'active',
})
assert.deepEqual(memberAlertTermsExport.alertBridgeContract.alertCaseProof.memberVisibility, {
    mode: 'member_scoped_export',
    userId: 'org_smoke_member',
    role: 'member',
    status: 'active',
    nonmemberEnumeration: false,
    revokedMemberDenial: 'member_revoked',
})
assert.ok(memberAlertTermsExport.activeTerms.every((term: Row) => term.alertGenerationRef.dedupe.key === term.alertGeneratorKey))

const alertTermsRetryResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-ready-retry`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(alertTermsRetryResponse.statusCode, 200, alertTermsRetryResponse.body)
const alertTermsRetryExport = parseBody(alertTermsRetryResponse.body).alertTermsExport
assert.deepEqual(
    alertTermsRetryExport.activeTerms.map((term: Row) => ({
        watchlistItemId: term.watchlistItemId,
        alertGeneratorKey: term.alertGeneratorKey,
        alertGenerationRef: term.alertGenerationRef,
    })),
    alertTermsExport.activeTerms.map((term: Row) => ({
        watchlistItemId: term.watchlistItemId,
        alertGeneratorKey: term.alertGeneratorKey,
        alertGenerationRef: term.alertGenerationRef,
    }))
)

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
assert.equal(domainReference.alert.casePath, `/dashboard/dwm?organizationId=${encodeURIComponent(organization.id)}&watchlistItemId=${encodeURIComponent(domainReference.watchlistItemId)}`)
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

const alertTermsAfterArchiveResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-after-archive`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(alertTermsAfterArchiveResponse.statusCode, 200, alertTermsAfterArchiveResponse.body)
const alertTermsAfterArchive = parseBody(alertTermsAfterArchiveResponse.body).alertTermsExport
assert.equal(alertTermsAfterArchive.activeTerms.length, 4)
assert.equal(alertTermsAfterArchive.excluded.archivedCount, 1)
assert.deepEqual(alertTermsAfterArchive.alertBridgeContract.typedBlockers.map((blocker: Row) => blocker.code), ['archived_watchlist_excluded'])
assert.equal(alertTermsAfterArchive.alertBridgeContract.typedBlockers[0].severity, 'notice')
assert.equal(alertTermsAfterArchive.alertBridgeContract.typedBlockers[0].count, 1)
assert.deepEqual(alertTermsAfterArchive.alertBridgeContract.lifecycleReadiness.typedBlockers.map((blocker: Row) => blocker.code), ['watchlist_archived', 'cleanup_required'])
assert.equal(alertTermsAfterArchive.alertBridgeContract.lifecycleReadiness.watchlists.archivedCount, 1)
assert.equal(alertTermsAfterArchive.alertBridgeContract.lifecycleReadiness.watchlists.cleanupRequired, true)
assert.equal(alertTermsAfterArchive.alertBridgeContract.alertCaseProof.readyForReplay, true)
assert.equal(alertTermsAfterArchive.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)
assert.equal(alertTermsAfterArchive.alertBridgeContract.alertCaseProof.cleanupLifecycle.archivedExcludedCount, 1)
assert.deepEqual(alertTermsAfterArchive.alertBridgeContract.alertCaseProof.typedBlockers.map((blocker: Row) => blocker.code), ['cleanup_required'])
assert.ok(!alertTermsAfterArchive.activeTerms.some((term: Row) => term.watchlistItemId === actorWatchlistItem.id))

const cleanupCompanyResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { kind: 'company', value: 'Live Proof Cleanup Holdings', reason: 'Disposable proof cleanup fixture.', requestId: 'smoke-cleanup-create-company' },
})
assert.equal(cleanupCompanyResponse.statusCode, 201, cleanupCompanyResponse.body)
const cleanupCompanyItem = parseBody(cleanupCompanyResponse.body).watchlistItem

const cleanupKeywordResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { kind: 'keyword', value: 'Live Proof Cleanup Phrase', reason: 'Disposable proof cleanup fixture.', requestId: 'smoke-cleanup-create-keyword' },
})
assert.equal(cleanupKeywordResponse.statusCode, 201, cleanupKeywordResponse.body)
const cleanupKeywordItem = parseBody(cleanupKeywordResponse.body).watchlistItem

const memberCleanupDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/cleanup`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { itemIds: [cleanupCompanyItem.id], reason: 'Member cleanup denied.', requestId: 'smoke-member-cleanup-denied' },
})
assert.equal(memberCleanupDeniedResponse.statusCode, 403, memberCleanupDeniedResponse.body)

const cleanupBeforeArchiveExportResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-cleanup-export-before`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(cleanupBeforeArchiveExportResponse.statusCode, 200, cleanupBeforeArchiveExportResponse.body)
const cleanupBeforeArchiveExport = parseBody(cleanupBeforeArchiveExportResponse.body).alertTermsExport
assert.ok(cleanupBeforeArchiveExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupCompanyItem.id))
assert.ok(cleanupBeforeArchiveExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupKeywordItem.id))
const cleanupCompanyExportTerm = cleanupBeforeArchiveExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupCompanyItem.id)
assert.equal(cleanupCompanyExportTerm.alertGenerationRef.lifecycle.reason, 'Disposable proof cleanup fixture.')
assert.equal(cleanupCompanyExportTerm.alertGenerationRef.lifecycle.requestId, 'smoke-cleanup-create-company')
assert.equal(cleanupCompanyExportTerm.alertGenerationRef.dedupe.parts.normalizedTerm, 'live proof cleanup holdings')

const cleanupArchiveResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/cleanup`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: {
        itemIds: [cleanupCompanyItem.id, cleanupKeywordItem.id, 'missing-cleanup-item'],
        reason: 'Archive disposable live proof watchlists.',
        requestId: 'smoke-proof-cleanup',
    },
})
assert.equal(cleanupArchiveResponse.statusCode, 200, cleanupArchiveResponse.body)
const cleanupArchive = parseBody(cleanupArchiveResponse.body).cleanup
assert.equal(cleanupArchive.schemaVersion, 'organization.watchlist_cleanup.v1')
assert.equal(cleanupArchive.organizationId, organization.id)
assert.equal(cleanupArchive.actorId, 'org_smoke_owner')
assert.equal(cleanupArchive.actorRole, 'owner')
assert.equal(cleanupArchive.archivedCount, 2)
assert.deepEqual(cleanupArchive.archivedItemIds.sort(), [cleanupCompanyItem.id, cleanupKeywordItem.id].sort())
assert.deepEqual(cleanupArchive.skippedItemIds, ['missing-cleanup-item'])
assert.equal(cleanupArchive.reason, 'Archive disposable live proof watchlists.')
assert.equal(cleanupArchive.requestId, 'smoke-proof-cleanup')
assert.equal(cleanupArchive.serviceLogAction, 'organization_watchlist_cleanup_archived')
assert.equal(parseBody(cleanupArchiveResponse.body).archivedItems[0].status, 'archived')

const cleanupArchiveRepeatResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/cleanup`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { item_ids: [cleanupCompanyItem.id], reason: 'Repeat cleanup should be safe.', request_id: 'smoke-proof-cleanup-repeat' },
})
assert.equal(cleanupArchiveRepeatResponse.statusCode, 200, cleanupArchiveRepeatResponse.body)
assert.equal(parseBody(cleanupArchiveRepeatResponse.body).cleanup.archivedCount, 0)
assert.deepEqual(parseBody(cleanupArchiveRepeatResponse.body).cleanup.skippedItemIds, [cleanupCompanyItem.id])
assert.equal(parseBody(cleanupArchiveRepeatResponse.body).cleanup.requestId, 'smoke-proof-cleanup-repeat')

const cleanupArchivedListResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists?status=archived`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(cleanupArchivedListResponse.statusCode, 200, cleanupArchivedListResponse.body)
const cleanupArchivedIds = parseBody(cleanupArchivedListResponse.body).watchlistItems.map((item: Row) => item.id)
assert.ok(cleanupArchivedIds.includes(cleanupCompanyItem.id))
assert.ok(cleanupArchivedIds.includes(cleanupKeywordItem.id))

const cleanupAfterArchiveExportResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-cleanup-export-after`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(cleanupAfterArchiveExportResponse.statusCode, 200, cleanupAfterArchiveExportResponse.body)
const cleanupAfterArchiveExport = parseBody(cleanupAfterArchiveExportResponse.body).alertTermsExport
assert.ok(!cleanupAfterArchiveExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupCompanyItem.id))
assert.ok(!cleanupAfterArchiveExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupKeywordItem.id))
assert.equal(cleanupAfterArchiveExport.excluded.archivedCount, 3)
assert.ok(cleanupAfterArchiveExport.alertBridgeContract.typedBlockers.some((blocker: Row) => blocker.code === 'archived_watchlist_excluded' && blocker.count === 3))
assert.ok(cleanupAfterArchiveExport.alertBridgeContract.lifecycleReadiness.typedBlockers.some((blocker: Row) => blocker.code === 'cleanup_required' && blocker.count === 3))
assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.readyForReplay, true)
assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)
assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.archivedExcludedCount, 3)
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.status === 'active'))

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
const outsiderAlertTermsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(outsiderAlertTermsResponse.statusCode, 404, outsiderAlertTermsResponse.body)
const outsiderCleanupResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/cleanup`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
    payload: { itemIds: [ownerWatchlistItem.id], reason: 'Outsider cannot clean up.', requestId: 'smoke-outsider-cleanup-denied' },
})
assert.equal(outsiderCleanupResponse.statusCode, 404, outsiderCleanupResponse.body)
assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_upserted'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_updated' && log.metadata.requestId === 'smoke-keyword-update'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_paused' && log.metadata.requestId === 'smoke-pause-company'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_resumed' && log.metadata.requestId === 'smoke-resume-company'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_archived' && log.metadata.requestId === 'smoke-disable-actor'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_exported' && log.metadata.requestId === 'smoke-alert-terms-ready'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_cleanup_archived' && log.metadata.requestId === 'smoke-proof-cleanup'))
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
        if (params.length === 1 && compact.includes('ORDER BY status ASC')) {
            const [organizationId] = params
            return rows([...watchlists.values()]
                .filter(item => item.organization_id === organizationId)
                .sort((a, b) => `${a.status}:${a.kind}:${a.value}`.localeCompare(`${b.status}:${b.kind}:${b.value}`)))
        }

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

    if (compact.startsWith('UPDATE organization_watchlist_items SET status = \'archived\'') && compact.includes('id = ANY')) {
        const [organizationId, itemIds, updatedBy, reason, requestId] = params
        const archived: Row[] = []
        for (const itemId of itemIds) {
            const existing = watchlists.get(itemId)
            if (!existing || existing.organization_id !== organizationId || existing.archived_at) continue
            const archivedItem = { ...existing, status: 'archived', archived_at: iso(), updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
            watchlists.set(itemId, archivedItem)
            archived.push(archivedItem)
        }
        return rows(archived)
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
    const activeAdmins = activeMembers.filter(member => member.role === 'owner' || member.role === 'admin')
    const pendingInvites = [...invites.values()].filter(invite => invite.organization_id === organizationId && invite.status === 'pending' && Date.parse(invite.expires_at) > Date.now())
    const sharedWatchlists = [...watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at && item.status === 'active')
    return {
        ...org,
        role,
        member_count: activeMembers.length,
        owner_count: activeOwners.length,
        admin_count: activeAdmins.length,
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
