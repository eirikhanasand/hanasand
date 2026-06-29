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
assert.equal(organization.lifecycleStatus, 'active')
assert.equal(organization.settings.lifecycleStatus, 'active')
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
assert.equal(adminSettings.settings.lifecycleStatus, 'active')
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
assert.equal(memberReadUpdatedOrganization.settings.lifecycleStatus, 'active')
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
assert.equal(alertTermsWhilePausedResponse.statusCode, 403, alertTermsWhilePausedResponse.body)
const alertTermsWhilePausedDeniedBody = parseBody(alertTermsWhilePausedResponse.body)
assert.equal(alertTermsWhilePausedDeniedBody.error, 'Organization alert visibility does not allow this member to export alert terms.')
assert.ok(!('alertTermsExport' in alertTermsWhilePausedDeniedBody))
const alertTermsWhilePausedDenied = alertTermsWhilePausedDeniedBody.alertTermsExportDenial
assert.equal(alertTermsWhilePausedDenied.schemaVersion, 'organization.watchlist_alert_terms_export_denial.v1')
assert.equal(alertTermsWhilePausedDenied.organizationId, organization.id)
assert.equal(alertTermsWhilePausedDenied.member.userId, 'org_smoke_member')
assert.equal(alertTermsWhilePausedDenied.member.role, 'member')
assert.equal(alertTermsWhilePausedDenied.visibility.allowed, false)
assert.equal(alertTermsWhilePausedDenied.visibility.reason, 'role_not_allowed')
assert.ok(alertTermsWhilePausedDenied.redactedFields.includes('activeTerms[]'))
assert.ok(!('activeTerms' in alertTermsWhilePausedDenied))
assert.equal(alertTermsWhilePausedDenied.auditProof.schemaVersion, 'organization.watchlist_alert_terms_denial_audit.v1')
assert.equal(alertTermsWhilePausedDenied.auditProof.serviceLogAction, 'organization_watchlist_alert_terms_export_denied')
assert.equal(alertTermsWhilePausedDenied.auditProof.requestId, 'smoke-alert-terms-paused')
assert.ok(alertTermsWhilePausedDenied.auditProof.requiredMetadataFields.includes('allowedRoles'))
assert.ok(alertTermsWhilePausedDenied.auditProof.requiredMetadataFields.includes('denialReason'))
assert.ok(alertTermsWhilePausedDenied.auditProof.redactedFields.includes('watchlistScope.alertGeneratorKeys'))
assert.equal(alertTermsWhilePausedDenied.auditProof.proofLogQuery, 'GET /api/logs?service=api&message=organization_watchlist_alert_terms_export_denied')

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
assert.equal(readiness.downstreamAuthorization.schemaVersion, 'organization.downstream_authorization_export.v1')
assert.equal(readiness.downstreamAuthorization.organizationId, organization.id)
assert.equal(readiness.downstreamAuthorization.tenantId, organization.id)
assert.equal(readiness.downstreamAuthorization.organizationLifecycleState, 'active')
assert.deepEqual(readiness.downstreamAuthorization.member, {
    userId: 'org_smoke_member',
    role: 'member',
    status: 'active',
})
assert.equal(readiness.downstreamAuthorization.visibility.allowed, false)
assert.equal(readiness.downstreamAuthorization.visibility.reason, 'role_not_allowed')
assert.deepEqual(readiness.downstreamAuthorization.visibility.allowedRoles, ['owner', 'admin'])
assert.deepEqual(readiness.downstreamAuthorization.allowedActions, ['acknowledge_alert'])
assert.equal(readiness.downstreamAuthorization.actionGates.create_watchlist.allowed, false)
assert.equal(readiness.downstreamAuthorization.actionGates.create_watchlist.denialReason, 'role_not_allowed')
assert.equal(readiness.downstreamAuthorization.actionGates.acknowledge_alert.allowed, true)
assert.equal(readiness.downstreamAuthorization.actionGates.acknowledge_alert.denialReason, null)
assert.equal(readiness.downstreamAuthorization.watchlists.activeCount, 5)
assert.equal(readiness.downstreamAuthorization.watchlists.pausedCount, 0)
assert.equal(readiness.downstreamAuthorization.watchlists.archivedCount, 0)
assert.deepEqual(readiness.downstreamAuthorization.watchlists.activeIds.sort(), readiness.alertGenerationBridge.activeWatchlistTerms.map((term: Row) => term.watchlistItemId).sort())
assert.equal(readiness.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
assert.deepEqual(readiness.downstreamAuthorization.downstream.alertGeneration.excludedStatuses, ['paused', 'archived'])
assert.deepEqual(readiness.downstreamAuthorization.downstream.alertGeneration.blockerCodes, [])
assert.equal(readiness.downstreamAuthorization.downstream.webhook.defaultPolicy, 'manual_selection')
assert.equal(readiness.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations, false)
assert.equal(readiness.downstreamAuthorization.downstream.helpdesk.mode, 'redacted_summary_only')
assert.equal(readiness.downstreamAuthorization.downstream.helpdesk.supportOnlyDenialReason, 'support_only_access')
assert.equal(readiness.downstreamAuthorization.downstream.dashboard.readinessFixture, 'organization_watchlist')
assert.equal(readiness.downstreamAuthorization.downstream.dashboard.nonmemberEnumeration, false)
assert.equal(readiness.downstreamAuthorization.lifecycleDenials.removedMember, 'member_revoked')
assert.equal(readiness.downstreamAuthorization.lifecycleDenials.expiredInvite, 'invite_expired')
assert.equal(readiness.downstreamAuthorization.lifecycleDenials.pausedWatchlist, 'watchlist_paused')
assert.equal(readiness.downstreamAuthorization.lifecycleDenials.archivedWatchlist, 'watchlist_archived')
assert.equal(readiness.downstreamAuthorization.lifecycleDenials.nonmember, 'nonmember_denied')
assert.equal(readiness.downstreamAuthorization.lifecycleDenials.roleNotAllowed, 'role_not_allowed')
assert.equal(readiness.readinessProof.schemaVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(readiness.readinessProof.organizationId, organization.id)
assert.equal(readiness.readinessProof.tenantId, organization.id)
assert.deepEqual(readiness.readinessProof.actor, {
    role: 'member',
    canExportActiveTerms: false,
})
assert.equal(readiness.readinessProof.counts.activeAdminCount, 2)
assert.equal(readiness.readinessProof.counts.pendingInviteCount, 11)
assert.equal(readiness.readinessProof.counts.activeWatchlistTermCount, 5)
assert.equal(readiness.readinessProof.counts.pausedWatchlistCount, 0)
assert.equal(readiness.readinessProof.counts.archivedWatchlistCount, 0)
assert.equal(readiness.readinessProof.readiness.organizationCanGenerateAlerts, true)
assert.equal(readiness.readinessProof.readiness.actorCanExportActiveTerms, false)
assert.equal(readiness.readinessProof.readiness.readyForWorker3Replay, false)
assert.equal(readiness.readinessProof.readiness.readyForDashboard, true)
assert.equal(readiness.readinessProof.readiness.cleanupRequired, false)
assert.deepEqual(readiness.readinessProof.blockers, ['role_not_allowed'])
assert.equal(readiness.readinessProof.routes.createOrganization, 'POST /api/organizations')
assert.equal(readiness.readinessProof.routes.inviteMembers, 'POST /api/organizations/:id/invites')
assert.equal(readiness.readinessProof.routes.alertReadiness, 'GET /api/organizations/:id/alert-readiness')
assert.equal(readiness.readinessProof.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(readiness.readinessProof.routes.cleanupWatchlists, 'POST /api/organizations/:id/watchlists/cleanup')
assert.equal(readiness.readinessProof.worker3Proof.noNetworkRequired, true)
assert.equal(readiness.readinessProof.worker3Proof.replayRoute, 'organization_watchlist')
assert.equal(readiness.readinessProof.worker3Proof.exportSchema, 'organization.watchlist_alert_terms_export.v1')
assert.equal(readiness.readinessProof.worker3Proof.alertGenerationRefField, 'activeTerms[].alertGenerationRef')
assert.equal(readiness.readinessProof.worker3Proof.alertGeneratorKeyField, 'activeTerms[].alertGenerationRef.dedupe.key')
assert.equal(readiness.readinessProof.worker3Proof.testCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.ok(readiness.readinessProof.worker3Proof.expectedAlertFields.includes('workflowContext.alertGenerationRefs'))
assert.equal(readiness.readinessProof.alertQueueProof.schemaVersion, 'organization.alert_queue_visibility_proof.v1')
assert.equal(readiness.readinessProof.alertQueueProof.visibilitySchema, 'dwm.org_alert_queue_visibility.v1')
assert.equal(readiness.readinessProof.alertQueueProof.routes.list, 'GET /v1/dwm/alerts')
assert.equal(readiness.readinessProof.alertQueueProof.routes.detail, 'GET /v1/dwm/alerts/:id')
assert.equal(readiness.readinessProof.alertQueueProof.routes.mutate, 'PATCH /v1/dwm/alerts/:id')
assert.equal(readiness.readinessProof.alertQueueProof.routes.replay, 'POST /v1/dwm/alerts/:id/replay')
assert.deepEqual(readiness.readinessProof.alertQueueProof.requiredQueryFields, ['organizationId'])
assert.deepEqual(readiness.readinessProof.alertQueueProof.allowedActions, ['acknowledge_alert'])
assert.deepEqual(readiness.readinessProof.alertQueueProof.blockerCodes, ['role_not_allowed'])
assert.equal(readiness.readinessProof.alertQueueProof.nonmemberEnumeration, false)
assert.ok(readiness.readinessProof.alertQueueProof.expectedVisibilityFields.includes('alertQueueVisibility.watchlistScope.alertGeneratorKeys'))
assert.equal(readiness.readinessProof.webhookDeliveryProof.schemaVersion, 'organization.webhook_delivery_visibility_proof.v1')
assert.equal(readiness.readinessProof.webhookDeliveryProof.deliveryContractSchema, 'dwm.webhook.org_alert_delivery.v1')
assert.equal(readiness.readinessProof.webhookDeliveryProof.route, 'POST /dwm/webhook-deliveries')
assert.equal(readiness.readinessProof.webhookDeliveryProof.defaultWebhookPolicy, 'manual_selection')
assert.equal(readiness.readinessProof.webhookDeliveryProof.canUseDefaultDestinations, false)
assert.equal(readiness.readinessProof.webhookDeliveryProof.ownerAdminManualTriggerRequired, true)
assert.equal(readiness.readinessProof.webhookDeliveryProof.memberManualTriggerAllowed, false)
assert.equal(readiness.readinessProof.webhookDeliveryProof.nonmemberDestinationEnumeration, false)
assert.deepEqual(readiness.readinessProof.webhookDeliveryProof.blockerCodes, ['manual_webhook_selection_required'])
assert.ok(readiness.readinessProof.webhookDeliveryProof.expectedDeliveryFields.includes('orgAlertDelivery.destinationSelection.selectedDestinations'))
assert.equal(readiness.readinessProof.memberLifecycleProof.schemaVersion, 'organization.member_lifecycle_visibility_proof.v1')
assert.equal(readiness.readinessProof.memberLifecycleProof.activeMembershipRequired, true)
assert.equal(readiness.readinessProof.memberLifecycleProof.actorStatus, 'active')
assert.equal(readiness.readinessProof.memberLifecycleProof.actorRole, 'member')
assert.deepEqual(readiness.readinessProof.memberLifecycleProof.visibilityInputs, ['role', 'status', 'userActive', 'alertVisibilityPolicy'])
assert.deepEqual(readiness.readinessProof.memberLifecycleProof.denialReasons, {
    nonmember: 'not_member',
    removedMember: 'member_removed',
    deactivatedMember: 'member_deactivated',
    expiredInvite: 'invite_expired',
    roleNotAllowed: 'role_not_allowed',
})
assert.ok(readiness.readinessProof.memberLifecycleProof.protectedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(readiness.readinessProof.memberLifecycleProof.protectedRoutes.includes('POST|PUT|DELETE /api/organizations/:id/watchlists'))
assert.ok(readiness.readinessProof.memberLifecycleProof.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
assert.ok(readiness.readinessProof.memberLifecycleProof.noLeakFields.includes('destination.secret'))
assert.ok(readiness.readinessProof.memberLifecycleProof.auditActions.includes('organization_member_removed'))
assert.equal(readiness.readinessProof.memberLifecycleProof.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.inviteLifecycleProof.schemaVersion, 'organization.invite_lifecycle_readiness_proof.v1')
assert.equal(readiness.readinessProof.inviteLifecycleProof.pendingInviteCount, 11)
assert.equal(readiness.readinessProof.inviteLifecycleProof.inviteTenSupported, true)
assert.equal(readiness.readinessProof.inviteLifecycleProof.maxRecipientsPerRequest, 25)
assert.equal(readiness.readinessProof.inviteLifecycleProof.defaultExpiryDays, 14)
assert.equal(readiness.readinessProof.inviteLifecycleProof.acceptanceTokenField, 'invite.acceptanceToken')
assert.equal(readiness.readinessProof.inviteLifecycleProof.acceptanceRoute, 'POST /api/organizations/invites/:inviteId/accept')
assert.equal(readiness.readinessProof.inviteLifecycleProof.inviteRoute, 'POST /api/organizations/:id/invites')
assert.equal(readiness.readinessProof.inviteLifecycleProof.actionRoute, 'POST /api/organizations/:id/invites/:inviteId/actions')
assert.deepEqual(readiness.readinessProof.inviteLifecycleProof.supportedActions, ['revoke', 'resend'])
assert.deepEqual(readiness.readinessProof.inviteLifecycleProof.idempotentActions, ['revoke', 'resend'])
assert.equal(readiness.readinessProof.inviteLifecycleProof.duplicateInviteOutcome, 'updated_pending_invite')
assert.deepEqual(readiness.readinessProof.inviteLifecycleProof.blockedOutcomes, ['already_member', 'blocked_removed_member', 'blocked_deactivated_user'])
assert.ok(readiness.readinessProof.inviteLifecycleProof.lifecycleBlockers.includes('invite_expired'))
assert.ok(readiness.readinessProof.inviteLifecycleProof.lifecycleBlockers.includes('org_archived'))
assert.ok(readiness.readinessProof.inviteLifecycleProof.auditActions.includes('organization_invite_resent'))
assert.ok(readiness.readinessProof.inviteLifecycleProof.requiredMetadataFields.includes('recipientCount'))
assert.ok(readiness.readinessProof.inviteLifecycleProof.requiredMetadataFields.includes('previousStatus'))
assert.equal(readiness.readinessProof.inviteLifecycleProof.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.uiProof.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.uiProof.dashboardFixture, 'organization_watchlist')
assert.ok(readiness.readinessProof.uiProof.safeFields.includes('routes'))
assert.ok(readiness.readinessProof.uiProof.safeFields.includes('alertQueueProof'))
assert.ok(readiness.readinessProof.uiProof.safeFields.includes('webhookDeliveryProof'))
assert.ok(readiness.readinessProof.uiProof.safeFields.includes('memberLifecycleProof'))
assert.ok(readiness.readinessProof.uiProof.safeFields.includes('inviteLifecycleProof'))
assert.ok(readiness.readinessProof.uiProof.redactedFields.includes('activeTerms[].term'))
assert.equal(readiness.readinessProof.cleanupProof.cleanupIdempotent, true)
assert.equal(readiness.readinessProof.cleanupProof.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
assert.equal(readiness.sharedWatchlistDownstreamProof.schemaVersion, 'organization.shared_watchlist_downstream_proof.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.actor.userId, 'org_smoke_member')
assert.equal(readiness.sharedWatchlistDownstreamProof.actor.role, 'member')
assert.equal(readiness.sharedWatchlistDownstreamProof.actor.canManageWatchlists, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.actor.canExportActiveTerms, false)
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.actor.allowedActions, ['acknowledge_alert'])
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.caseBridge.blockerCodes, ['role_not_allowed'])
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.alertBridge.blockerCodes, [])
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.schemaVersion, 'organization.watchlist_alert_visibility_contract.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.organizationId, organization.id)
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.policy, 'admins')
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.allowed, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.denialReason, 'role_not_allowed')
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.allowedRoles, ['owner', 'admin'])
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.nonmemberEnumeration, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actionGates.readAlertsAllowed, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actionGates.acknowledgeAllowed, false)
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.blockerCodes, ['role_not_allowed'])
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.schemaVersion, 'organization.watchlist_alert_persistence_contract.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.organizationId, organization.id)
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.storageModule, 'ti/scraper/src/storage/dwmAlertRepository.ts')
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.alertGenerationRefField, 'workflowContext.alertGenerationRefs[]')
assert.equal(readiness.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe.crossTenantCollisionAllowed, false)
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.blockerCodes, ['role_not_allowed'])
assert.equal(readiness.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.schemaVersion, 'organization.watchlist_case_workflow_contract.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.organizationId, organization.id)
assert.equal(readiness.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.canReadCases, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.canOpenCase, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.denialReason, 'role_not_allowed')
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.blockerCodes, ['role_not_allowed'])
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.webhookBridge.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(readiness.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.schemaVersion, 'organization.watchlist_webhook_delivery_contract.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.organizationId, organization.id)
assert.equal(readiness.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId, organization.id)
assert.equal(readiness.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.nonmemberDestinationEnumeration, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.roleGates.manualTriggerAllowed, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.roleGates.denialReason, 'role_not_allowed')
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(readiness.sharedWatchlistDownstreamProof.watchlistOwnership.activeCount, 5)
assert.equal(readiness.sharedWatchlistDownstreamProof.inviteLifecycle.pendingInviteCount, 11)
assert.ok(readiness.sharedWatchlistDownstreamProof.audit.eventActions.includes('organization_watchlist_alert_terms_exported'))

const adminReadinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(adminReadinessResponse.statusCode, 200, adminReadinessResponse.body)
const adminReadiness = parseBody(adminReadinessResponse.body).alertReadiness
assert.equal(adminReadiness.readinessProof.actor.role, 'admin')
assert.equal(adminReadiness.readinessProof.actor.canExportActiveTerms, true)
assert.equal(adminReadiness.readinessProof.readiness.organizationCanGenerateAlerts, true)
assert.equal(adminReadiness.readinessProof.readiness.actorCanExportActiveTerms, true)
assert.equal(adminReadiness.readinessProof.readiness.readyForWorker3Replay, true)
assert.equal(adminReadiness.readinessProof.readiness.readyForDashboard, true)
assert.deepEqual(adminReadiness.readinessProof.blockers, [])
assert.equal(adminReadiness.readinessProof.counts.activeWatchlistTermCount, 5)
assert.deepEqual(adminReadiness.readinessProof.alertQueueProof.allowedActions, [
    'create_watchlist',
    'edit_watchlist_terms',
    'archive_watchlist',
    'restore_watchlist',
    'acknowledge_alert',
    'assign_case',
    'link_case',
    'manage_invites',
])
assert.deepEqual(adminReadiness.readinessProof.alertQueueProof.blockerCodes, [])
assert.equal(adminReadiness.readinessProof.webhookDeliveryProof.canUseDefaultDestinations, false)
assert.deepEqual(adminReadiness.readinessProof.webhookDeliveryProof.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(adminReadiness.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, true)
assert.deepEqual(adminReadiness.downstreamAuthorization.downstream.alertGeneration.blockerCodes, [])
assert.equal(adminReadiness.sharedWatchlistDownstreamProof.actor.canManageWatchlists, true)
assert.equal(adminReadiness.sharedWatchlistDownstreamProof.actor.canExportActiveTerms, true)
assert.deepEqual(adminReadiness.sharedWatchlistDownstreamProof.caseBridge.blockerCodes, [])
assert.deepEqual(adminReadiness.sharedWatchlistDownstreamProof.alertBridge.blockerCodes, [])
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
assert.equal(alertTermsExport.downstreamAuthorization.schemaVersion, 'organization.downstream_authorization_export.v1')
assert.equal(alertTermsExport.downstreamAuthorization.member.role, 'admin')
assert.equal(alertTermsExport.downstreamAuthorization.visibility.allowed, true)
assert.equal(alertTermsExport.downstreamAuthorization.actionGates.create_watchlist.allowed, true)
assert.equal(alertTermsExport.downstreamAuthorization.actionGates.assign_case.allowed, true)
assert.equal(alertTermsExport.downstreamAuthorization.watchlists.activeCount, 5)
assert.equal(alertTermsExport.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, true)
assert.deepEqual(alertTermsExport.downstreamAuthorization.downstream.alertGeneration.blockerCodes, [])
assert.equal(alertTermsExport.downstreamAuthorization.downstream.webhook.defaultPolicy, 'manual_selection')
assert.equal(alertTermsExport.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations, false)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.schemaVersion, 'organization.shared_watchlist_downstream_proof.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.ownerOrganizationId, organization.id)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.actor, {
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
    canManageWatchlists: true,
    canExportActiveTerms: true,
    allowedActions: [
        'create_watchlist',
        'edit_watchlist_terms',
        'archive_watchlist',
        'restore_watchlist',
        'acknowledge_alert',
        'assign_case',
        'link_case',
        'manage_invites',
    ],
})
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.pendingInviteCount, 11)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.acceptedInviteCreatesMembership, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.acceptedInviteRevocationBlocked, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.removedMemberReinviteBlocked, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.deactivatedUserInviteBlocked, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.ownerOrganizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.isolatedByOrganizationId, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.duplicateTermScope, 'organization')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.activeCount, 5)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.activeIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.lifecycleStatuses.every((item: Row) => item.organizationId === organization.id))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.activeWatchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.dedupeScope, 'organization_watchlist_term')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.schemaVersion, 'organization.watchlist_alert_persistence_contract.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.storageModule, 'ti/scraper/src/storage/dwmAlertRepository.ts')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.upsertFunction, 'upsertDwmAlert')
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.requiredInputFields.includes('workflowContext.alertGenerationRefs'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.persistedAlertFields.includes('organizationId'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.persistedAlertFields.includes('watchlistItemIds'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.persistedAlertFields.includes('workflowContext.alertGeneratorKeys'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.workflowContextFields.includes('visibilityDecision'))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.watchlistItemIdField, 'watchlistItemIds[]')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe.keyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe.crossTenantCollisionAllowed, false)
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.lifecycleBlockers.includes('org_archived'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.lifecycleBlockers.includes('watchlist_archived'))
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.visibilityDecisionField, 'workflowContext.visibilityDecision')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.casePathField, 'casePath')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.schemaVersion, 'organization.watchlist_alert_visibility_contract.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.routes.list, 'GET /v1/dwm/alerts')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.routes.detail, 'GET /v1/dwm/alerts/:id')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.routes.update, 'PATCH /v1/dwm/alerts/:id')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.routes.replay, 'POST /v1/dwm/alerts/:id/replay')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.requiredQueryFields, ['organizationId'])
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.alertGeneratorKeyField, 'workflowContext.alertGeneratorKeys[]')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.dedupeScope, 'organization_watchlist_term')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.policy, 'admins')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.allowed, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.denialReason, null)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actorVisibility.allowedRoles, ['owner', 'admin'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actionGates.readAlertsAllowed, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actionGates.acknowledgeAllowed, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actionGates.assignAllowed, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actionGates.linkCaseAllowed, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actionGates.replayAllowed, true)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.actionGates.mutateAllowedRoles, ['owner', 'admin', 'analyst'])
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.requiredAlertFields.includes('workflowContext.alertGeneratorKeys'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.evidenceFields.includes('workflowEvents'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.redactedFields.includes('activeTerms[].term'))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.blockerCodes, [])
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.route, 'POST /v1/cases')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.schemaVersion, 'organization.watchlist_case_workflow_contract.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.routes.open, 'POST /v1/cases')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.routes.list, 'GET /v1/cases')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.routes.detail, 'GET /v1/cases/:id')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.routes.update, 'PATCH /v1/cases/:id')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.requiredQueryFields, ['organizationId'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.casePathTemplate, '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.evidenceRefField, 'case.evidence.watchlistItemIds[]')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.canReadCases, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.canOpenCase, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.canAssignCase, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.canLinkCase, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.canCloseCase, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.denialReason, null)
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.requiredCaseFields.includes('evidence.provenance'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.timelineEventTypes.includes('case.linked_alert'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.evidenceFields.includes('alertGeneratorKeys'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.redactedFields.includes('case.evidence.rawContent'))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.route, 'POST /v1/dwm/webhooks/deliver')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.defaultWebhookPolicy, 'manual_selection')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.canUseDefaultDestinations, false)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.schemaVersion, 'organization.watchlist_webhook_delivery_contract.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.eventType, 'dwm.alert')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.policy, 'manual_selection')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationSource, 'manual_selection_required')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationOrgField, 'destination.org_id')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationIdField, 'webhookDestinationIds[]')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.skippedDestinationReasons, [
    'org_mismatch',
    'destination_disabled',
    'event_not_subscribed',
    'manual_selection_required',
    'webhook_policy_disabled',
])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.nonmemberDestinationEnumeration, false)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.roleGates.automaticDeliveryAllowed, false)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.roleGates.manualTriggerAllowed, true)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.roleGates.manualTriggerAllowedRoles, ['owner', 'admin'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.roleGates.memberManualTriggerAllowed, false)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.roleGates.denialReason, null)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.idempotency.scope, 'organization_destination_alert')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.idempotency.keyFields, ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'])
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.requiredAlertFields.includes('alert.watchlistItemIds'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.requiredDeliveryFields.includes('idempotencyKey'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.evidenceFields.includes('auditEventContracts'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.redactedFields.includes('destination.secret'))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.integration.expectedAdapter, 'organizationSharedWatchlistDownstreamProof')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.integration.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.integration.nonmemberEnumeration, false)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.integration.containsRawTerms, false)
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('audit.eventActions'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('alertBridge.persistenceContract.persistedAlertFields'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('alertBridge.persistenceContract.workflowContextFields'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('alertBridge.queueVisibilityContract.actorVisibility'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('alertBridge.queueVisibilityContract.watchlistScope'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('caseBridge.caseWorkflowContract.actorActions'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('caseBridge.caseWorkflowContract.watchlistScope'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('webhookBridge.deliveryContract.destinationSelection'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('webhookBridge.deliveryContract.idempotency'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.routeHandlers.includes('api/src/handlers/organizations.ts'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.storageModules.includes('ti/scraper/src/storage/dwmAlertRepository.ts'))
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.audit.schemaVersion, 'organization.shared_watchlist_audit_contract.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.audit.source, 'service_logs')
for (const action of [
    'organization_invites_created',
    'organization_invite_accepted',
    'organization_invite_revoked',
    'organization_invite_resent',
    'organization_watchlist_upserted',
    'organization_watchlist_updated',
    'organization_watchlist_paused',
    'organization_watchlist_resumed',
    'organization_watchlist_archived',
    'organization_watchlist_restored',
    'organization_watchlist_cleanup_archived',
    'organization_watchlist_alert_terms_exported',
    'organization_watchlist_alert_terms_export_denied',
    'organization_lifecycle_mutation_blocked',
] as const) {
    assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventActions.includes(action))
}
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.requiredMetadataFields.includes('requestId'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.requestIdFields.includes('activeTerms[].alertGenerationRef.lifecycle.requestId'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.actorFields.includes('watchlistOwnership.lifecycleStatuses[].updatedBy'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.downstreamCorrelationFields.includes('alertBridge.alertGeneratorKeys'))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.audit.idempotentActions, ['invite_resend', 'invite_revoke', 'watchlist_cleanup', 'alert_terms_export'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.audit.proofLogQuery, 'GET /api/logs?service=api&message=organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.schemaVersion, 'organization.shared_watchlist_audit_event_bridge.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.expectedAdapter, 'organizationSharedWatchlistAuditEventBridge')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.requiredActions, alertTermsExport.sharedWatchlistDownstreamProof.audit.eventActions)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.requiredSafeFields, ['action', 'routeGroup', 'outcome', 'requestIdField', 'actorField', 'organizationField'])
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.requiredRedactedFields, ['metadata.value', 'metadata.email', 'activeTerms[].term', 'alertBridge.alertGeneratorKeys'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.noRawTermAccess, true)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.length, alertTermsExport.sharedWatchlistDownstreamProof.audit.eventActions.length)
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.every((event: Row) => event.requestIdField === 'metadata.requestId'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.every((event: Row) => event.actorField === 'actor.userId'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.every((event: Row) => event.organizationField === 'organizationId'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.every((event: Row) => event.redactedMetadataFields.includes('activeTerms[].term')))
const alertTermsAuditEvent = alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.find((event: Row) => event.action === 'organization_watchlist_alert_terms_exported')
assert.ok(alertTermsAuditEvent)
assert.equal(alertTermsAuditEvent.routeGroup, 'alert_terms_export')
assert.equal(alertTermsAuditEvent.outcome, 'success')
assert.deepEqual(alertTermsAuditEvent.downstreamConsumers, ['alert_queue', 'case_workflow', 'webhook_delivery', 'support_timeline', 'dashboard_readiness'])
assert.ok(alertTermsAuditEvent.requiredMetadataFields.includes('activeTermCount'))
assert.equal(alertTermsAuditEvent.idempotent, true)
const deniedAlertTermsAuditEvent = alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.find((event: Row) => event.action === 'organization_watchlist_alert_terms_export_denied')
assert.ok(deniedAlertTermsAuditEvent)
assert.equal(deniedAlertTermsAuditEvent.routeGroup, 'alert_terms_export')
assert.equal(deniedAlertTermsAuditEvent.outcome, 'denied')
assert.deepEqual(deniedAlertTermsAuditEvent.downstreamConsumers, ['alert_queue', 'support_timeline', 'dashboard_readiness'])
assert.ok(deniedAlertTermsAuditEvent.requiredMetadataFields.includes('denialReason'))
const lifecycleBlockedAuditEvent = alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.find((event: Row) => event.action === 'organization_lifecycle_mutation_blocked')
assert.ok(lifecycleBlockedAuditEvent)
assert.equal(lifecycleBlockedAuditEvent.routeGroup, 'lifecycle_blocker')
assert.equal(lifecycleBlockedAuditEvent.outcome, 'blocked')
assert.ok(lifecycleBlockedAuditEvent.requiredMetadataFields.includes('blockerCode'))
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.schemaVersion, 'organization.shared_watchlist_integration_guardrails.v1')
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.ok, true)
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.blockerCodes, [])
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.checkedContracts.includes('organization.watchlist_alert_persistence_contract.v1'))
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.checkedContracts.includes('organization.watchlist_alert_visibility_contract.v1'))
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.checkedContracts.includes('organization.watchlist_case_workflow_contract.v1'))
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.checkedContracts.includes('organization.watchlist_webhook_delivery_contract.v1'))
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.requiredPayloadShape.includes('alertBridge.persistenceContract.workflowContextFields'))
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.requiredPayloadShape.includes('caseBridge.caseWorkflowContract.watchlistScope'))
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.requiredPayloadShape.includes('audit.eventBridge'))
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.downstreamRoutes.alertReplay, 'POST /v1/dwm/alerts/:id/replay')
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.downstreamRoutes.caseOpen, 'POST /v1/cases')
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.downstreamRoutes.webhookDeliver, 'POST /v1/dwm/webhooks/deliver')
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.ownerOrganizationId, organization.id)
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.alertContractOrgId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.caseContractOrgId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.webhookContractOrgId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.safety.nonmemberEnumeration, false)
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.safety.containsRawTerms, false)
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.safety.redactedFields.includes('destination.secret'))
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.schemaVersion, 'organization.shared_watchlist_alert_denial_guardrails.v1')
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.ok, true)
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.requiredNoLeakFields, [
    'activeTerms',
    'watchlistScope.alertGeneratorKeys',
    'persistedAlertContract',
    'member.userId',
])
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.requiredResponseFields, [
    'error',
    'message',
    'organizationId',
    'visibilityDecision',
    'allowedRoles',
    'requestId',
])
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.requiredAuditEvent, 'organization_watchlist_alert_visibility_denied')
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.schemaVersion, 'organization.shared_watchlist_webhook_delivery_guardrails.v1')
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.ok, true)
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredIdempotencyFields, ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'])
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredEvidenceFields, ['deliveryId', 'destinationId', 'attemptedAt', 'status', 'casePath', 'watchlistItemIds', 'auditEventContracts'])
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredRedactedFields, ['destination.endpoint', 'destination.secret', 'activeTerms[].term'])
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.destinationEnumerationAllowed, false)
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredDestinationOrgId, organization.id)
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.schemaVersion, 'organization.shared_watchlist_case_workflow_guardrails.v1')
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.ok, true)
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.requiredCaseFields, ['organizationId', 'tenantId', 'alertId', 'casePath', 'watchlistItemIds', 'allowedActions', 'visibilityDecision', 'evidence.provenance'])
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.requiredTimelineEvents, ['case.opened', 'case.linked_alert', 'case.assigned', 'case.status_changed', 'case.note_added'])
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.requiredEvidenceFields, ['alertId', 'watchlistItemIds', 'alertGeneratorKeys', 'matchedTerms', 'source', 'capturedAt', 'casePath'])
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.requiredRedactedFields, ['activeTerms[].term', 'case.evidence.rawContent'])
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.casePathTemplate, '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.actorCanOpenCase, true)
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.actorCanAssignCase, true)
assert.deepEqual(alertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistIntegrationGuardrails.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
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
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.schemaVersion, 'organization.shared_watchlist_support_inspection.v1')
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.supportMode, 'redacted_summary_only')
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.route, 'GET /api/admin/support/organizations/:id')
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.supportActionContract, 'admin_support')
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.redactionRequired, true)
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.canInspectRawTerms, false)
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.containsRawTerms, false)
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.summary.activeTermCount, 5)
assert.deepEqual(alertTermsExport.sharedWatchlistSupportInspection.summary.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
assert.deepEqual(alertTermsExport.sharedWatchlistSupportInspection.summary.allowedViewerRoles, ['owner', 'admin'])
assert.ok(alertTermsExport.sharedWatchlistSupportInspection.safeFields.includes('activeTermCount'))
assert.ok(alertTermsExport.sharedWatchlistSupportInspection.redactedFields.includes('activeTerms[].term'))
assert.ok(alertTermsExport.sharedWatchlistSupportInspection.redactedFields.includes('sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys'))
assert.ok(alertTermsExport.sharedWatchlistSupportInspection.auditFields.includes('requestId'))
assert.ok(alertTermsExport.sharedWatchlistSupportInspection.auditFields.includes('actor.role'))
assert.ok(alertTermsExport.sharedWatchlistSupportInspection.downstreamCorrelationFields.includes('caseBridge.casePathTemplate'))
assert.deepEqual(alertTermsExport.sharedWatchlistSupportInspection.blockerCodes, ['support_redaction_required', 'support_only_access'])
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.guardrails.schemaVersion, 'organization.shared_watchlist_support_guardrails.v1')
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.guardrails.ok, true)
assert.deepEqual(alertTermsExport.sharedWatchlistSupportInspection.guardrails.requiredSafeFields, ['activeTermCount', 'termFamilies', 'visibilityPolicy', 'allowedViewerRoles'])
assert.deepEqual(alertTermsExport.sharedWatchlistSupportInspection.guardrails.requiredRedactedFields, ['activeTerms[].term', 'member.userId', 'sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys'])
assert.deepEqual(alertTermsExport.sharedWatchlistSupportInspection.guardrails.requiredAuditFields, ['requestId', 'actor.role'])
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.guardrails.rawTermAccessAllowed, false)
assert.deepEqual(alertTermsExport.sharedWatchlistSupportInspection.guardrails.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistSupportInspection.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.schemaVersion, 'organization.shared_watchlist_alert_queue_visibility.v1')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.routes.list, 'GET /v1/dwm/alerts')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.routes.detail, 'GET /v1/dwm/alerts/:id')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.routes.update, 'PATCH /v1/dwm/alerts/:id')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.routes.replay, 'POST /v1/dwm/alerts/:id/replay')
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.requiredQueryFields, ['organizationId'])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.member, {
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
})
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.policy, 'admins')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.denialReason, null)
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.allowedRoles, ['owner', 'admin'])
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.allowed, true)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.nonmemberEnumeration, false)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.appliesWhen, 'visibility.allowed_false')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.blocked, false)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.statusCode, 403)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.errorCode, 'org_alert_visibility_denied')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.reason, null)
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.responseShape.includes('visibilityDecision'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.safeFields.includes('visibility.allowedRoles'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.noLeakFields.includes('activeTerms'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialResponseContract.auditEventAction, 'organization_watchlist_alert_visibility_denied')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.schemaVersion, 'organization.shared_watchlist_alert_denial_guardrails.v1')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.ok, true)
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.checkedFields.includes('denialResponseContract.noLeakFields'))
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.requiredNoLeakFields, [
    'activeTerms',
    'watchlistScope.alertGeneratorKeys',
    'persistedAlertContract',
    'member.userId',
])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.requiredResponseFields, [
    'error',
    'message',
    'organizationId',
    'visibilityDecision',
    'allowedRoles',
    'requestId',
])
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.requiredAuditEvent, 'organization_watchlist_alert_visibility_denied')
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.blockerCodes, [])
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.allowedActions.includes('acknowledge_alert'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.allowedActions.includes('assign_case'))
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.actionGates.readAlertsAllowed, true)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.actionGates.acknowledgeAllowed, true)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.actionGates.assignAllowed, true)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.actionGates.replayAllowed, true)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.schemaVersion, 'organization.shared_watchlist_alert_role_matrix.v1')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.actorRole, 'admin')
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.allowedActions, [
    'create_watchlist',
    'edit_watchlist_terms',
    'archive_watchlist',
    'restore_watchlist',
    'acknowledge_alert',
    'assign_case',
    'link_case',
    'manage_invites',
])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.roleGates.create_watchlist, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.roleGates.acknowledge_alert, ['owner', 'admin', 'analyst', 'member'])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.allowedActionsByRole.viewer, [])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.allowedActionsByRole.member, ['acknowledge_alert'])
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.downstreamConsumers.includes('alert_queue'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.downstreamConsumers.includes('case_workflow'))
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.deniedRoles, ['viewer', 'support', 'nonmember'])
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.denialReason, 'role_not_allowed')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.ownerOrganizationId, organization.id)
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.alertGeneratorKeyField, 'workflowContext.alertGeneratorKeys[]')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.visibilityDecisionField, 'workflowContext.visibilityDecision')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.dedupeScope, 'organization_watchlist_term')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.schemaVersion, 'organization.shared_watchlist_alert_tenant_isolation.v1')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.partitionKey, 'organizationId')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.tenantIdField, 'tenantId')
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.requiredAlertFields.includes('workflowContext.organizationId'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.requiredAlertFields.includes('workflowContext.alertGeneratorKeys'))
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.dedupeKeyFields, [
    'organizationId',
    'watchlistItemId',
    'termFamily',
    'normalizedTerm',
])
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.watchlistItemScope, 'organization_owned')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.crossTenantCollisionAllowed, false)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.nonmemberEnumeration, false)
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.lifecycleBlockers.includes('org_archived'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.lifecycleBlockers.includes('watchlist_archived'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.proofAssertions.includes('two_org_overlapping_terms'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.proofAssertions.includes('visibility_query_requires_organization_id'))
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.lifecycleExclusions.excludedStatuses, ['paused', 'archived'])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.lifecycleExclusions.pausedWatchlistIds, [])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.lifecycleExclusions.archivedWatchlistIds, [])
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.lifecycleExclusions.blockerCodes, ['watchlist_paused', 'watchlist_archived'])
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.persistedAlertContract.storageModule, 'ti/scraper/src/storage/dwmAlertRepository.ts')
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.persistedAlertContract.requiredFields.includes('workflowContext.visibilityDecision'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.persistedAlertContract.workflowContextFields.includes('allowedActions'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.persistedAlertContract.persistedAlertFields.includes('organizationId'))
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.persistedAlertContract.casePathField, 'casePath')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.ownerLane, 'dwm_alert_workflow')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.expectedAdapter, 'organizationSharedWatchlistAlertQueueVisibility')
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.payloadShape.includes('organizationId'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.payloadShape.includes('watchlistScope.alertGeneratorKeys'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.payloadShape.includes('persistedAlertContract.workflowContextFields'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.payloadShape.includes('blockerCodes'))
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.requiredRouteBinding, 'organizationId_query_and_workflow_context')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.requiredStorageBinding, 'workflowContext.organizationId')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.source, 'service_logs')
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.requiredEventActions.includes('organization_watchlist_alert_terms_exported'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.requiredEventActions.includes('organization_watchlist_upserted'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.requiredEventActions.includes('organization_watchlist_updated'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.requiredMetadataFields.includes('requestId'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.requestIdFields.includes('activeTerms[].alertGenerationRef.lifecycle.requestId'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.downstreamCorrelationFields.includes('alertBridge.alertGeneratorKeys'))
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.proofLogQuery, 'GET /api/logs?service=api&message=organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.support.mode, 'redacted_summary_only')
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.support.redactionRequired, true)
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.support.supportOnlyBlocker, 'support_only_access')
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.safeFields.includes('watchlistScope.watchlistItemIds'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.safeFields.includes('watchlistScope.alertGeneratorKeys'))
assert.ok(alertTermsExport.sharedWatchlistAlertQueueVisibility.redactedFields.includes('activeTerms[].term'))
assert.deepEqual(alertTermsExport.sharedWatchlistAlertQueueVisibility.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistAlertQueueVisibility.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
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
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('role_not_allowed'))
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
assert.equal(memberAlertTermsReadyResponse.statusCode, 403, memberAlertTermsReadyResponse.body)
const memberAlertTermsDenialBody = parseBody(memberAlertTermsReadyResponse.body)
assert.equal(memberAlertTermsDenialBody.error, 'Organization alert visibility does not allow this member to export alert terms.')
assert.ok(!('alertTermsExport' in memberAlertTermsDenialBody))
assert.equal(memberAlertTermsDenialBody.organization.id, organization.id)
const memberAlertTermsDenial = memberAlertTermsDenialBody.alertTermsExportDenial
assert.equal(memberAlertTermsDenial.schemaVersion, 'organization.watchlist_alert_terms_export_denial.v1')
assert.equal(memberAlertTermsDenial.organizationId, organization.id)
assert.equal(memberAlertTermsDenial.tenantId, organization.id)
assert.deepEqual(memberAlertTermsDenial.member, {
    userId: 'org_smoke_member',
    role: 'member',
    status: 'active',
})
assert.equal(memberAlertTermsDenial.visibility.allowed, false)
assert.equal(memberAlertTermsDenial.visibility.reason, 'role_not_allowed')
assert.deepEqual(memberAlertTermsDenial.visibility.allowedRoles, ['owner', 'admin'])
assert.deepEqual(memberAlertTermsDenial.allowedActions, ['acknowledge_alert'])
assert.equal(memberAlertTermsDenial.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.ok(memberAlertTermsDenial.safeFields.includes('visibility.reason'))
assert.ok(memberAlertTermsDenial.redactedFields.includes('activeTerms[]'))
assert.ok(memberAlertTermsDenial.redactedFields.includes('watchlistScope.alertGeneratorKeys'))
assert.deepEqual(memberAlertTermsDenial.blockerCodes, ['role_not_allowed'])
assert.equal(memberAlertTermsDenial.nonmemberEnumeration, false)
assert.equal(memberAlertTermsDenial.auditProof.schemaVersion, 'organization.watchlist_alert_terms_denial_audit.v1')
assert.equal(memberAlertTermsDenial.auditProof.serviceLogAction, 'organization_watchlist_alert_terms_export_denied')
assert.equal(memberAlertTermsDenial.auditProof.requestId, 'smoke-member-alert-terms-ready')
assert.deepEqual(memberAlertTermsDenial.auditProof.requiredMetadataFields, [
    'requestId',
    'role',
    'alertVisibilityPolicy',
    'allowedRoles',
    'denialReason',
    'blockerCodes',
])
assert.ok(memberAlertTermsDenial.auditProof.redactedFields.includes('activeTerms[]'))
assert.equal(memberAlertTermsDenial.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
const deniedQueueContract = orgUtils.organizationSharedWatchlistAlertQueueVisibility(readiness.sharedWatchlistDownstreamProof)
assert.equal(deniedQueueContract.visibility.allowed, false)
assert.equal(deniedQueueContract.visibility.denialReason, 'role_not_allowed')
assert.equal(deniedQueueContract.actionGates.readAlertsAllowed, false)
assert.equal(deniedQueueContract.roleActionMatrix.actorRole, 'member')
assert.deepEqual(deniedQueueContract.roleActionMatrix.allowedActions, ['acknowledge_alert'])
assert.deepEqual(deniedQueueContract.roleActionMatrix.allowedActionsByRole.viewer, [])
assert.deepEqual(deniedQueueContract.roleActionMatrix.roleGates.manage_invites, ['owner', 'admin'])
assert.equal(deniedQueueContract.denialResponseContract.blocked, true)
assert.equal(deniedQueueContract.denialResponseContract.statusCode, 403)
assert.equal(deniedQueueContract.denialResponseContract.errorCode, 'org_alert_visibility_denied')
assert.equal(deniedQueueContract.denialResponseContract.reason, 'role_not_allowed')
assert.deepEqual(deniedQueueContract.denialResponseContract.responseShape, [
    'error',
    'message',
    'organizationId',
    'visibilityDecision',
    'allowedRoles',
    'requestId',
])
assert.ok(deniedQueueContract.denialResponseContract.noLeakFields.includes('persistedAlertContract'))
assert.ok(deniedQueueContract.denialResponseContract.noLeakFields.includes('member.userId'))
assert.equal(deniedQueueContract.denialResponseContract.auditEventAction, 'organization_watchlist_alert_visibility_denied')
assert.equal(deniedQueueContract.denialGuardrails.ok, true)
assert.deepEqual(deniedQueueContract.denialGuardrails.blockerCodes, [])
const deniedIntegrationGuardrails = orgUtils.organizationSharedWatchlistIntegrationGuardrails(readiness.sharedWatchlistDownstreamProof)
assert.equal(deniedIntegrationGuardrails.caseSafety.ok, true)
assert.equal(deniedIntegrationGuardrails.caseSafety.actorCanOpenCase, false)
assert.equal(deniedIntegrationGuardrails.caseSafety.actorCanAssignCase, false)
assert.deepEqual(deniedIntegrationGuardrails.caseSafety.blockerCodes, [])

const archiveOrganizationResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { lifecycleStatus: 'archived' },
})
assert.equal(archiveOrganizationResponse.statusCode, 200, archiveOrganizationResponse.body)
const archivedOrganizationSettings = parseBody(archiveOrganizationResponse.body)
assert.equal(archivedOrganizationSettings.organization.lifecycleStatus, 'archived')
assert.equal(archivedOrganizationSettings.settings.lifecycleStatus, 'archived')
assert.equal(archivedOrganizationSettings.lifecycleReadiness.lifecycleStatus, 'archived')
assert.ok(archivedOrganizationSettings.lifecycleReadiness.typedBlockers.includes('org_archived'))
assert.equal(archivedOrganizationSettings.lifecycleReadiness.alertExportReadiness.ready, false)

const archivedOrgAlertTermsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-archived-org-alert-terms`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(archivedOrgAlertTermsResponse.statusCode, 200, archivedOrgAlertTermsResponse.body)
const archivedOrgAlertTerms = parseBody(archivedOrgAlertTermsResponse.body).alertTermsExport
assert.equal(archivedOrgAlertTerms.downstreamAuthorization.organizationLifecycleState, 'archived')
assert.equal(archivedOrgAlertTerms.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
assert.ok(archivedOrgAlertTerms.downstreamAuthorization.downstream.alertGeneration.blockerCodes.includes('org_archived'))
assert.deepEqual(archivedOrgAlertTerms.activeTerms, [])
assert.ok(archivedOrgAlertTerms.blockedReasons.includes('org_archived'))
assert.equal(archivedOrgAlertTerms.canGenerateAlerts, false)
assert.ok(archivedOrgAlertTerms.alertBridgeContract.typedBlockers.some((blocker: Row) => blocker.code === 'org_archived'))

const archivedOrgReadinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(archivedOrgReadinessResponse.statusCode, 200, archivedOrgReadinessResponse.body)
const archivedOrgReadiness = parseBody(archivedOrgReadinessResponse.body).alertReadiness
assert.equal(archivedOrgReadiness.lifecycleReadiness.lifecycleStatus, 'archived')
assert.equal(archivedOrgReadiness.alertGenerationBridge.canGenerateAlerts, false)
assert.deepEqual(archivedOrgReadiness.alertGenerationBridge.activeWatchlistTerms, [])
assert.equal(archivedOrgReadiness.downstreamAuthorization.organizationLifecycleState, 'archived')
assert.equal(archivedOrgReadiness.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
assert.equal(archivedOrgReadiness.readinessProof.readiness.organizationCanGenerateAlerts, false)
assert.equal(archivedOrgReadiness.readinessProof.readiness.readyForWorker3Replay, false)
assert.equal(archivedOrgReadiness.readinessProof.readiness.readyForDashboard, false)
assert.ok(archivedOrgReadiness.readinessProof.blockers.includes('org_archived'))
assert.equal(archivedOrgReadiness.readinessProof.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.ok(archivedOrgReadiness.readinessProof.alertQueueProof.blockerCodes.includes('org_archived'))
assert.ok(archivedOrgReadiness.readinessProof.webhookDeliveryProof.blockerCodes.includes('org_archived'))
assert.equal(archivedOrgReadiness.readinessProof.memberLifecycleProof.actorRole, 'admin')
assert.equal(archivedOrgReadiness.readinessProof.memberLifecycleProof.denialReasons.removedMember, 'member_removed')
assert.equal(archivedOrgReadiness.readinessProof.memberLifecycleProof.nonmemberEnumeration, false)

const archivedInviteDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { email: 'archived-invite@example.test', role: 'member', requestId: 'smoke-archived-invite-denied' },
})
assert.equal(archivedInviteDeniedResponse.statusCode, 409, archivedInviteDeniedResponse.body)
assert.equal(parseBody(archivedInviteDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
assert.equal(parseBody(archivedInviteDeniedResponse.body).lifecycleBlocker.action, 'invite members')
assert.equal(parseBody(archivedInviteDeniedResponse.body).lifecycleBlocker.serviceLogAction, 'organization_lifecycle_mutation_blocked')
assert.equal(parseBody(archivedInviteDeniedResponse.body).auditEvent.schemaVersion, 'organization.lifecycle_mutation_blocker_audit.v1')
assert.equal(parseBody(archivedInviteDeniedResponse.body).auditEvent.requestId, 'smoke-archived-invite-denied')
assert.equal(parseBody(archivedInviteDeniedResponse.body).auditEvent.blockerCode, 'org_archived')

const archivedInviteResendDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites/${bulkInviteWorkflow.results[1].inviteId}/actions`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { action: 'resend', reason: 'Archived org should not resend invites.', requestId: 'smoke-archived-resend-denied' },
})
assert.equal(archivedInviteResendDeniedResponse.statusCode, 409, archivedInviteResendDeniedResponse.body)
assert.equal(parseBody(archivedInviteResendDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
assert.equal(parseBody(archivedInviteResendDeniedResponse.body).lifecycleBlocker.action, 'resend invites')

const archivedRoleUpdateDeniedResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { role: 'member', reason: 'Archived org should not change roles.', requestId: 'smoke-archived-role-denied' },
})
assert.equal(archivedRoleUpdateDeniedResponse.statusCode, 409, archivedRoleUpdateDeniedResponse.body)
assert.equal(parseBody(archivedRoleUpdateDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
assert.equal(parseBody(archivedRoleUpdateDeniedResponse.body).lifecycleBlocker.action, 'change member roles')

const archivedOwnershipTransferDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/ownership-transfer`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { targetUserId: 'org_smoke_admin', reason: 'Archived org should not transfer ownership.', requestId: 'smoke-archived-transfer-denied' },
})
assert.equal(archivedOwnershipTransferDeniedResponse.statusCode, 409, archivedOwnershipTransferDeniedResponse.body)
assert.equal(parseBody(archivedOwnershipTransferDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
assert.equal(parseBody(archivedOwnershipTransferDeniedResponse.body).lifecycleBlocker.action, 'transfer ownership')

const archivedWatchlistCreateDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { kind: 'domain', value: 'archived-org.example', reason: 'Archived org should not add terms.', requestId: 'smoke-archived-watchlist-create-denied' },
})
assert.equal(archivedWatchlistCreateDeniedResponse.statusCode, 409, archivedWatchlistCreateDeniedResponse.body)
assert.equal(parseBody(archivedWatchlistCreateDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
assert.equal(parseBody(archivedWatchlistCreateDeniedResponse.body).lifecycleBlocker.action, 'create shared watchlists')

const archivedWatchlistPauseDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}/actions`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { action: 'pause', reason: 'Archived org should not pause terms.', requestId: 'smoke-archived-watchlist-pause-denied' },
})
assert.equal(archivedWatchlistPauseDeniedResponse.statusCode, 409, archivedWatchlistPauseDeniedResponse.body)
assert.equal(parseBody(archivedWatchlistPauseDeniedResponse.body).lifecycleBlocker.code, 'org_archived')
assert.equal(parseBody(archivedWatchlistPauseDeniedResponse.body).lifecycleBlocker.action, 'pause shared watchlists')

const deleteOrganizationResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { lifecycleStatus: 'deleted' },
})
assert.equal(deleteOrganizationResponse.statusCode, 200, deleteOrganizationResponse.body)
const deletedOrganizationSettings = parseBody(deleteOrganizationResponse.body)
assert.equal(deletedOrganizationSettings.organization.lifecycleStatus, 'deleted')
assert.equal(deletedOrganizationSettings.settings.lifecycleStatus, 'deleted')
assert.equal(deletedOrganizationSettings.lifecycleReadiness.lifecycleStatus, 'deleted')
assert.ok(deletedOrganizationSettings.lifecycleReadiness.typedBlockers.includes('org_deleted'))
assert.equal(deletedOrganizationSettings.lifecycleReadiness.alertExportReadiness.ready, false)

const deletedOrgAlertTermsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-deleted-org-alert-terms`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(deletedOrgAlertTermsResponse.statusCode, 200, deletedOrgAlertTermsResponse.body)
const deletedOrgAlertTerms = parseBody(deletedOrgAlertTermsResponse.body).alertTermsExport
assert.equal(deletedOrgAlertTerms.downstreamAuthorization.organizationLifecycleState, 'deleted')
assert.equal(deletedOrgAlertTerms.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
assert.ok(deletedOrgAlertTerms.downstreamAuthorization.downstream.alertGeneration.blockerCodes.includes('org_deleted'))
assert.deepEqual(deletedOrgAlertTerms.activeTerms, [])
assert.ok(deletedOrgAlertTerms.blockedReasons.includes('org_deleted'))
assert.equal(deletedOrgAlertTerms.canGenerateAlerts, false)
assert.ok(deletedOrgAlertTerms.alertBridgeContract.typedBlockers.some((blocker: Row) => blocker.code === 'org_deleted'))

const deletedOrgReadinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(deletedOrgReadinessResponse.statusCode, 200, deletedOrgReadinessResponse.body)
const deletedOrgReadiness = parseBody(deletedOrgReadinessResponse.body).alertReadiness
assert.equal(deletedOrgReadiness.lifecycleReadiness.lifecycleStatus, 'deleted')
assert.equal(deletedOrgReadiness.alertGenerationBridge.canGenerateAlerts, false)
assert.deepEqual(deletedOrgReadiness.alertGenerationBridge.activeWatchlistTerms, [])
assert.equal(deletedOrgReadiness.downstreamAuthorization.organizationLifecycleState, 'deleted')
assert.equal(deletedOrgReadiness.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, false)
assert.equal(deletedOrgReadiness.readinessProof.readiness.organizationCanGenerateAlerts, false)
assert.equal(deletedOrgReadiness.readinessProof.readiness.readyForWorker3Replay, false)
assert.equal(deletedOrgReadiness.readinessProof.readiness.readyForDashboard, false)
assert.ok(deletedOrgReadiness.readinessProof.blockers.includes('org_deleted'))
assert.ok(deletedOrgReadiness.readinessProof.alertQueueProof.blockerCodes.includes('org_deleted'))
assert.ok(deletedOrgReadiness.readinessProof.webhookDeliveryProof.blockerCodes.includes('org_deleted'))
assert.equal(deletedOrgReadiness.readinessProof.memberLifecycleProof.actorRole, 'admin')
assert.ok(deletedOrgReadiness.readinessProof.memberLifecycleProof.noLeakFields.includes('activeTerms[]'))
assert.equal(deletedOrgReadiness.readinessProof.cleanupProof.cleanupIdempotent, true)

const deletedInviteAcceptDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${bulkInviteWorkflow.results[2].inviteId}/accept`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(deletedInviteAcceptDeniedResponse.statusCode, 404, deletedInviteAcceptDeniedResponse.body)

const deletedWatchlistCreateDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { kind: 'keyword', value: 'deleted org term', reason: 'Deleted org should not add terms.', requestId: 'smoke-deleted-watchlist-create-denied' },
})
assert.equal(deletedWatchlistCreateDeniedResponse.statusCode, 409, deletedWatchlistCreateDeniedResponse.body)
assert.equal(parseBody(deletedWatchlistCreateDeniedResponse.body).lifecycleBlocker.code, 'org_deleted')
assert.equal(parseBody(deletedWatchlistCreateDeniedResponse.body).lifecycleBlocker.action, 'create shared watchlists')

const deletedWatchlistResumeDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}/actions`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { action: 'resume', reason: 'Deleted org should not resume terms.', requestId: 'smoke-deleted-watchlist-resume-denied' },
})
assert.equal(deletedWatchlistResumeDeniedResponse.statusCode, 409, deletedWatchlistResumeDeniedResponse.body)
assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).lifecycleBlocker.code, 'org_deleted')
assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).lifecycleBlocker.action, 'resume shared watchlists')
assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).auditEvent.serviceLogAction, 'organization_lifecycle_mutation_blocked')
assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).auditEvent.requestId, 'smoke-deleted-watchlist-resume-denied')
assert.equal(parseBody(deletedWatchlistResumeDeniedResponse.body).auditEvent.blockerCode, 'org_deleted')

const reactivateOrganizationResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/settings`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { lifecycle_status: 'active' },
})
assert.equal(reactivateOrganizationResponse.statusCode, 200, reactivateOrganizationResponse.body)
assert.equal(parseBody(reactivateOrganizationResponse.body).organization.lifecycleStatus, 'active')
assert.equal(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.lifecycleStatus, 'active')
assert.deepEqual(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.typedBlockers, [])

const secondOrganizationResponse = await app.inject({
    method: 'POST',
    url: '/api/organizations',
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { name: 'Smoke Overlap Tenant' },
})
assert.equal(secondOrganizationResponse.statusCode, 201, secondOrganizationResponse.body)
const secondOrganization = parseBody(secondOrganizationResponse.body).organization
assert.notEqual(secondOrganization.id, organization.id)

const secondOrgWatchlistResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${secondOrganization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { kind: 'domain', value: 'acme-shared.example', notes: 'Overlapping domain in separate tenant.', requestId: 'smoke-overlap-domain-second-org' },
})
assert.equal(secondOrgWatchlistResponse.statusCode, 201, secondOrgWatchlistResponse.body)
const secondOrgWatchlistItem = parseBody(secondOrgWatchlistResponse.body).watchlistItem
assert.equal(secondOrgWatchlistItem.organizationId, secondOrganization.id)
assert.equal(secondOrgWatchlistItem.value, 'acme-shared.example')

const secondOrgAlertTermsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${secondOrganization.id}/watchlists/alert-terms?requestId=smoke-overlap-second-org-export`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(secondOrgAlertTermsResponse.statusCode, 200, secondOrgAlertTermsResponse.body)
const secondOrgAlertTermsExport = parseBody(secondOrgAlertTermsResponse.body).alertTermsExport
assert.equal(secondOrgAlertTermsExport.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.member.role, 'owner')
assert.equal(secondOrgAlertTermsExport.activeTerms.length, 1)
assert.equal(secondOrgAlertTermsExport.activeTerms[0].term, 'acme-shared.example')
assert.equal(secondOrgAlertTermsExport.activeTerms[0].alertGenerationRef.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.activeTerms[0].alertGenerationRef.tenantId, secondOrganization.id)
assert.notEqual(secondOrgAlertTermsExport.activeTerms[0].alertGeneratorKey, alertTermsExport.activeTerms.find((term: Row) => term.term === 'acme-shared.example').alertGeneratorKey)
assert.equal(secondOrgAlertTermsExport.downstreamAuthorization.watchlists.activeCount, 1)
assert.deepEqual(secondOrgAlertTermsExport.downstreamAuthorization.watchlists.activeIds, [secondOrgWatchlistItem.id])
assert.equal(secondOrgAlertTermsExport.downstreamAuthorization.actionGates.create_watchlist.allowed, true)
assert.equal(secondOrgAlertTermsExport.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, true)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.activeIds, [secondOrgWatchlistItem.id])
assert.ok(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.lifecycleStatuses.every((item: Row) => item.organizationId === secondOrganization.id))
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.watchlistOwnership.isolatedByOrganizationId, true)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.queueVisibilityContract.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId, secondOrganization.id)
assert.notEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId, alertTermsExport.sharedWatchlistDownstreamProof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.ok, true)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.ok, true)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.denialSafety.blockerCodes, [])
assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.ok, true)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredDestinationOrgId, secondOrganization.id)
assert.notEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredDestinationOrgId, alertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.requiredDestinationOrgId)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.webhookSafety.blockerCodes, [])
assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.ok, true)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.actorCanOpenCase, true)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.actorCanAssignCase, true)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistIntegrationGuardrails.caseSafety.blockerCodes, [])
assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.summary.activeTermCount, 1)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.summary.termFamilies, ['domain'])
assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.containsRawTerms, false)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.guardrails.ok, true)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.guardrails.rawTermAccessAllowed, false)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistSupportInspection.guardrails.blockerCodes, [])
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.schemaVersion, 'organization.shared_watchlist_audit_event_bridge.v1')
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.requiredActions, alertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.requiredActions)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.noRawTermAccess, true)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.blockerCodes, [])
assert.ok(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.every((event: Row) => event.redactedMetadataFields.includes('alertBridge.alertGeneratorKeys')))
assert.ok(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.audit.eventBridge.eventDescriptors.every((event: Row) => event.organizationField === 'organizationId'))
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.allowed, true)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.ownerOrganizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.partitionKey, 'organizationId')
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.nonmemberEnumeration, false)
assert.ok(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.proofAssertions.includes('two_org_overlapping_terms'))
assert.ok(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.tenantIsolation.proofAssertions.includes('distinct_alert_generator_keys'))
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.visibility.nonmemberEnumeration, false)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.support.mode, 'redacted_summary_only')
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.support.redactionRequired, true)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.expectedAdapter, 'organizationSharedWatchlistAlertQueueVisibility')
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.consumerContract.requiredStorageBinding, 'workflowContext.organizationId')
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.ok, true)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.denialGuardrails.blockerCodes, [])
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.actorRole, 'owner')
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.roleGates.archive_watchlist, ['owner', 'admin'])
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.roleActionMatrix.allowedActionsByRole.support, [])
assert.ok(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.downstreamCorrelationFields.includes('alertBridge.alertGeneratorKeys'))
assert.equal(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.auditContract.proofLogQuery, 'GET /api/logs?service=api&message=organization_watchlist')
assert.ok(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.redactedFields.includes('activeTerms[].term'))
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistAlertQueueVisibility.blockerCodes, [])

const secondOrgListResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${secondOrganization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(secondOrgListResponse.statusCode, 200, secondOrgListResponse.body)
assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.organizationId), [secondOrganization.id])
assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.id), [secondOrgWatchlistItem.id])

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

const viewerAlertTermsDeniedResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-viewer-alert-terms-denied`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(viewerAlertTermsDeniedResponse.statusCode, 403, viewerAlertTermsDeniedResponse.body)
const viewerAlertTermsDeniedBody = parseBody(viewerAlertTermsDeniedResponse.body)
assert.equal(viewerAlertTermsDeniedBody.error, 'Organization alert visibility does not allow this member to export alert terms.')
assert.ok(!('alertTermsExport' in viewerAlertTermsDeniedBody))
const viewerAlertTermsDenied = viewerAlertTermsDeniedBody.alertTermsExportDenial
assert.equal(viewerAlertTermsDenied.schemaVersion, 'organization.watchlist_alert_terms_export_denial.v1')
assert.equal(viewerAlertTermsDenied.organizationId, organization.id)
assert.equal(viewerAlertTermsDenied.tenantId, organization.id)
assert.deepEqual(viewerAlertTermsDenied.member, {
    userId: 'org_smoke_viewer',
    role: 'viewer',
    status: 'active',
})
assert.equal(viewerAlertTermsDenied.visibility.allowed, false)
assert.equal(viewerAlertTermsDenied.visibility.reason, 'role_not_allowed')
assert.equal(viewerAlertTermsDenied.visibility.alertVisibilityPolicy, 'admins')
assert.deepEqual(viewerAlertTermsDenied.visibility.allowedRoles, ['owner', 'admin'])
assert.deepEqual(viewerAlertTermsDenied.blockerCodes, ['role_not_allowed'])
assert.equal(viewerAlertTermsDenied.nonmemberEnumeration, false)
assert.ok(viewerAlertTermsDenied.redactedFields.includes('activeTerms[]'))
assert.ok(viewerAlertTermsDenied.redactedFields.includes('alertGeneratorKeys[]'))
assert.ok(!('activeTerms' in viewerAlertTermsDenied))
assert.ok(!('activeWatchlistTerms' in viewerAlertTermsDenied))
assert.ok(!JSON.stringify(viewerAlertTermsDenied).includes('acme-shared.example'))
assert.equal(viewerAlertTermsDenied.routes.alertReadiness, 'GET /api/organizations/:id/alert-readiness')
assert.equal(viewerAlertTermsDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

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
assert.equal(alertTermsAfterArchive.downstreamAuthorization.watchlists.archivedCount, 1)
assert.deepEqual(alertTermsAfterArchive.downstreamAuthorization.downstream.alertGeneration.blockerCodes, ['watchlist_archived'])
assert.equal(alertTermsAfterArchive.downstreamAuthorization.lifecycleDenials.archivedWatchlist, 'watchlist_archived')
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
    headers: authHeaders('org_smoke_admin', 'admin-token'),
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
assert.equal(cleanupAfterArchiveExport.downstreamAuthorization.watchlists.archivedCount, 3)
assert.ok(cleanupAfterArchiveExport.downstreamAuthorization.downstream.alertGeneration.blockerCodes.includes('watchlist_archived'))
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.status === 'active'))
assert.deepEqual(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.roleActionContract.actor.allowedActions, [
    'create_watchlist',
    'edit_watchlist_terms',
    'archive_watchlist',
    'restore_watchlist',
    'acknowledge_alert',
    'assign_case',
    'link_case',
    'manage_invites',
])
assert.deepEqual(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.roleActionContract.roleGates.restore_watchlist, ['owner', 'admin'])
assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.roleActionContract.lifecycleDenials.archivedWatchlist, 'watchlist_archived')

const restoreArchivedWatchlistResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists/${cleanupKeywordItem.id}/actions`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { action: 'restore', reason: 'Restore after cleanup proof.', requestId: 'smoke-restore-cleanup-keyword' },
})
assert.equal(restoreArchivedWatchlistResponse.statusCode, 200, restoreArchivedWatchlistResponse.body)
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).watchlistItem.status, 'active')
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).watchlistItem.archivedAt, null)
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.action, 'restore')

const restoredExportResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-restored-export`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(restoredExportResponse.statusCode, 200, restoredExportResponse.body)
const restoredExport = parseBody(restoredExportResponse.body).alertTermsExport
assert.ok(restoredExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupKeywordItem.id))
assert.equal(restoredExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupKeywordItem.id).alertGenerationRef.lifecycle.requestId, 'smoke-restore-cleanup-keyword')
assert.deepEqual(restoredExport.alertBridgeContract.alertCaseProof.roleActionContract.actor.allowedActions, [
    'create_watchlist',
    'edit_watchlist_terms',
    'archive_watchlist',
    'restore_watchlist',
    'acknowledge_alert',
    'assign_case',
    'link_case',
    'manage_invites',
])

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
assert.equal(readiness.readinessProof.memberLifecycleProof.denialReasons.removedMember, 'member_removed')
assert.equal(readiness.readinessProof.memberLifecycleProof.denialReasons.expiredInvite, 'invite_expired')

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
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_restored' && log.metadata.requestId === 'smoke-restore-cleanup-keyword'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_exported' && log.metadata.requestId === 'smoke-alert-terms-ready'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-viewer-alert-terms-denied' && log.metadata.denialReason === 'role_not_allowed'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-alert-terms-paused' && log.metadata.role === 'member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-member-alert-terms-ready' && log.metadata.allowedRoles.includes('admin')))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_cleanup_archived' && log.metadata.requestId === 'smoke-proof-cleanup'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.role === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted' && log.metadata.role === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_revoked' && log.metadata.requestId === 'smoke-revoke-pending-ops'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_resent' && log.metadata.requestId === 'smoke-resend-pending-ops'))
assert.ok(serviceLogs.some(log => log.message === 'organization_settings_updated' && log.metadata.fields.includes('defaultWebhookPolicy')))
assert.ok(serviceLogs.some(log => log.message === 'organization_ownership_transferred' && log.metadata.targetUserId === 'org_smoke_admin'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_role_updated' && log.metadata.requestId === 'smoke-viewer-role-member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.requestId === 'smoke-archived-invite-denied' && log.metadata.blockerCode === 'org_archived'))
assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.requestId === 'smoke-deleted-watchlist-resume-denied' && log.metadata.blockerCode === 'org_deleted'))
assert.ok(serviceLogs.some(log => log.message === 'organization_lifecycle_mutation_blocked' && log.metadata.blockedAction === 'change member roles' && log.metadata.actorRole === 'owner'))

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
        const [organizationId, name, slug, defaultWebhookPolicy, alertVisibilityPolicy, lifecycleStatus, retentionDays, auditSafeMetadata] = params
        const existing = organizations.get(organizationId)
        if (!existing) return rows([])
        const updated = {
            ...existing,
            name: name ?? existing.name,
            slug: slug ?? existing.slug,
            default_webhook_policy: defaultWebhookPolicy ?? existing.default_webhook_policy,
            alert_visibility_policy: alertVisibilityPolicy ?? existing.alert_visibility_policy,
            status: lifecycleStatus ?? existing.status,
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
        const organization = organizations.get(invite.organization_id)
        if (!organization || (organization.status ?? 'active') !== 'active') return rows([])
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
        const [id, organizationId, status, updatedBy, reason, requestId, action] = params
        const existing = watchlists.get(id)
        if (!existing || existing.organization_id !== organizationId || (existing.archived_at && action !== 'restore')) return rows([])
        const updated = {
            ...existing,
            status,
            archived_at: status === 'archived' ? iso() : action === 'restore' ? null : existing.archived_at,
            updated_by: updatedBy,
            lifecycle_reason: reason,
            lifecycle_request_id: requestId,
            updated_at: iso(),
        }
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
        status: 'active',
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
