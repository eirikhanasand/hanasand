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
app.get('/api/organizations/:id/alert-case-visibility', handlers.getOrganizationAlertCaseVisibility)
app.get('/api/organizations/:id/watchlists/alert-terms', handlers.getOrganizationWatchlistAlertTerms)
app.get('/api/organizations/:organizationId/watchlists/:itemId', handlers.getOrganizationWatchlist)
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
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.schemaVersion, 'organization.workspace_boundary_readiness.v1')
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.organizationId, organization.id)
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.tenantId, organization.id)
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorRole, 'owner')
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.lifecycleStatus, 'active')
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.routes.updateSettings, 'PUT /api/organizations/:id/settings')
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.routes.listMembers, 'GET /api/organizations/:id/members')
assert.deepEqual(createdLifecycleReadiness.workspaceBoundaryProof.roleGates.updateSettings, ['owner', 'admin'])
assert.deepEqual(createdLifecycleReadiness.workspaceBoundaryProof.roleGates.readSharedWatchlists, ['owner', 'admin', 'member', 'viewer'])
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorPermissions.canUpdateSettings, true)
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorPermissions.canArchiveOrganization, true)
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorPermissions.canManageInvites, true)
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.actorPermissions.canMutateWatchlists, true)
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.lifecycleMutationAllowed, true)
assert.deepEqual(createdLifecycleReadiness.workspaceBoundaryProof.blockedWhenInactive, [])
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.blockerCode, null)
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.supportInspection.mode, 'redacted_summary_only')
assert.equal(createdLifecycleReadiness.workspaceBoundaryProof.nonmemberEnumeration, false)
assert.ok(createdLifecycleReadiness.workspaceBoundaryProof.noLeakFields.includes('otherOrg.members'))
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
assert.equal(parseBody(ownerReadOrganizationResponse.body).lifecycleReadiness.workspaceBoundaryProof.actorPermissions.canArchiveOrganization, true)
assert.equal(parseBody(ownerReadOrganizationResponse.body).lifecycleReadiness.workspaceBoundaryProof.routes.readOrganization, 'GET /api/organizations/:id')

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
assert.equal(accepted.inviteAcceptance.schemaVersion, 'organization.invite_acceptance.v1')
assert.equal(accepted.inviteAcceptance.organizationId, organization.id)
assert.equal(accepted.inviteAcceptance.tenantId, organization.id)
assert.equal(accepted.inviteAcceptance.inviteId, invite.id)
assert.equal(accepted.inviteAcceptance.acceptanceToken, invite.id)
assert.equal(accepted.inviteAcceptance.acceptancePath, `/api/organizations/invites/${invite.id}/accept`)
assert.equal(accepted.inviteAcceptance.acceptedBy, 'org_smoke_member')
assert.equal(accepted.inviteAcceptance.invitedBy, 'org_smoke_owner')
assert.equal(accepted.inviteAcceptance.inviteRole, 'member')
assert.equal(accepted.inviteAcceptance.appliedRole, 'member')
assert.equal(accepted.inviteAcceptance.membershipStatus, 'active')
assert.equal(accepted.inviteAcceptance.expiresAt, invite.expiresAt)
assert.equal(accepted.inviteAcceptance.serviceLogAction, 'organization_invite_accepted')
assert.deepEqual(accepted.inviteAcceptance.auditMetadataFields, ['inviteId', 'role', 'acceptedBy', 'organizationId'])
assert.equal(accepted.inviteAcceptance.reusedInviteBlocked, true)
assert.equal(accepted.inviteAcceptance.expiredInviteDenied, 'invite_expired')
assert.equal(accepted.inviteAcceptance.revokedInviteDenied, 'member_revoked')
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.schemaVersion, 'organization.invite_consumer_visibility_receipt.v1')
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.organizationId, organization.id)
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.tenantId, organization.id)
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.inviteId, invite.id)
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.inviteStatus, 'accepted')
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.role, 'member')
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.action, 'accept')
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.grantsConsumerAccess, true)
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.membershipStatus, 'active')
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.routes.sharedWatchlists, 'GET /api/organizations/:id/watchlists')
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.routes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
assert.ok(accepted.inviteAcceptance.consumerVisibilityReceipt.availableConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
assert.ok(accepted.inviteAcceptance.consumerVisibilityReceipt.availableConsumerContracts.includes('organization.case_visibility_consumer.v1'))
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.roleGates.canReadSharedWatchlists, true)
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.roleGates.canMutateSharedWatchlists, false)
assert.equal(accepted.inviteAcceptance.consumerVisibilityReceipt.noEnumeration, true)

const reusedInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${invite.id}/accept`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(reusedInviteResponse.statusCode, 409, reusedInviteResponse.body)
const reusedInviteDenial = parseBody(reusedInviteResponse.body).inviteAcceptanceDenial
assert.equal(reusedInviteDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
assert.equal(reusedInviteDenial.organizationId, organization.id)
assert.equal(reusedInviteDenial.tenantId, organization.id)
assert.equal(reusedInviteDenial.inviteId, invite.id)
assert.equal(reusedInviteDenial.acceptanceToken, invite.id)
assert.equal(reusedInviteDenial.inviteStatus, 'accepted')
assert.equal(reusedInviteDenial.blockerCode, 'invite_already_accepted')
assert.equal(reusedInviteDenial.statusCode, 409)
assert.equal(reusedInviteDenial.nonmemberEnumeration, false)
assert.ok(reusedInviteDenial.safeFields.includes('blockerCode'))
assert.ok(reusedInviteDenial.noLeakFields.includes('invite.email'))
assert.equal(reusedInviteDenial.serviceLogAction, 'organization_invite_acceptance_denied')
assert.equal(reusedInviteDenial.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

const pendingInvitesResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(pendingInvitesResponse.statusCode, 200, pendingInvitesResponse.body)
const emptyPendingInvitesBody = parseBody(pendingInvitesResponse.body)
assert.deepEqual(emptyPendingInvitesBody.invites, [])
assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.schemaVersion, 'organization.invite_list_contract.v1')
assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.organizationId, organization.id)
assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.tenantId, organization.id)
assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.actor.role, 'owner')
assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.actor.canCreateInvites, true)
assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.counts.pendingInviteCount, 0)
assert.deepEqual(emptyPendingInvitesBody.inviteLifecycleContract.supportedRoles, ['admin', 'member', 'viewer'])
assert.deepEqual(emptyPendingInvitesBody.inviteLifecycleContract.supportedActions, ['revoke', 'resend'])
assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.lifecycleDenials.expiredInvite, 'invite_expired')
assert.equal(emptyPendingInvitesBody.inviteLifecycleContract.lifecycleDenials.nonmemberEnumeration, false)
assert.ok(emptyPendingInvitesBody.inviteLifecycleContract.audit.eventActions.includes('organization_invite_resent'))
assert.ok(emptyPendingInvitesBody.inviteLifecycleContract.noLeakFields.includes('otherOrg.invites'))

const memberListInvitesDeniedResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/invites?requestId=smoke-member-invite-list-denied`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(memberListInvitesDeniedResponse.statusCode, 403, memberListInvitesDeniedResponse.body)
const memberListInvitesDenied = parseBody(memberListInvitesDeniedResponse.body).inviteManagementDenial
assert.equal(memberListInvitesDenied.schemaVersion, 'organization.invite_management_denial.v1')
assert.equal(memberListInvitesDenied.organizationId, organization.id)
assert.equal(memberListInvitesDenied.tenantId, organization.id)
assert.equal(memberListInvitesDenied.actorId, 'org_smoke_member')
assert.equal(memberListInvitesDenied.actorRole, 'member')
assert.equal(memberListInvitesDenied.action, 'list_invites')
assert.equal(memberListInvitesDenied.inviteId, null)
assert.equal(memberListInvitesDenied.denialReason, 'role_not_allowed')
assert.deepEqual(memberListInvitesDenied.allowedRoles, ['owner', 'admin'])
assert.deepEqual(memberListInvitesDenied.readRoles, ['owner', 'admin'])
assert.equal(memberListInvitesDenied.memberCanListInvites, false)
assert.equal(memberListInvitesDenied.memberCanCreateInvites, false)
assert.equal(memberListInvitesDenied.nonmemberEnumeration, false)
assert.ok(memberListInvitesDenied.safeFields.includes('action'))
assert.ok(memberListInvitesDenied.noLeakFields.includes('pendingInvites[]'))
assert.equal(memberListInvitesDenied.serviceLogAction, 'organization_invite_management_denied')
assert.equal(memberListInvitesDenied.requestId, 'smoke-member-invite-list-denied')

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

const duplicateRecipientInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: {
        emails: ['member@example.test', 'MEMBER@example.test'],
        role: 'viewer',
        requestId: 'smoke-duplicate-recipient-dedupe',
    },
})
assert.equal(duplicateRecipientInviteResponse.statusCode, 201, duplicateRecipientInviteResponse.body)
const duplicateRecipientWorkflow = parseBody(duplicateRecipientInviteResponse.body).workflow
assert.equal(duplicateRecipientWorkflow.schemaVersion, 'organization.bulk_invite.v1')
assert.equal(duplicateRecipientWorkflow.submittedRecipientCount, 2)
assert.equal(duplicateRecipientWorkflow.recipientCount, 1)
assert.equal(duplicateRecipientWorkflow.normalizedRecipientCount, 1)
assert.equal(duplicateRecipientWorkflow.duplicateRecipientCount, 1)
assert.equal(duplicateRecipientWorkflow.invitedCount, 0)
assert.equal(duplicateRecipientWorkflow.skippedCount, 1)
assert.equal(duplicateRecipientWorkflow.results[0].email, 'member@example.test')
assert.equal(duplicateRecipientWorkflow.results[0].outcome, 'already_member')

const memberInviteResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/invites`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { email: 'blocked-by-member@example.test', role: 'member', requestId: 'smoke-member-invite-create-denied' },
})
assert.equal(memberInviteResponse.statusCode, 403, memberInviteResponse.body)
const memberInviteDenied = parseBody(memberInviteResponse.body).inviteManagementDenial
assert.equal(memberInviteDenied.schemaVersion, 'organization.invite_management_denial.v1')
assert.equal(memberInviteDenied.organizationId, organization.id)
assert.equal(memberInviteDenied.tenantId, organization.id)
assert.equal(memberInviteDenied.actorId, 'org_smoke_member')
assert.equal(memberInviteDenied.actorRole, 'member')
assert.equal(memberInviteDenied.action, 'create_invite')
assert.equal(memberInviteDenied.inviteId, null)
assert.equal(memberInviteDenied.denialReason, 'role_not_allowed')
assert.deepEqual(memberInviteDenied.allowedRoles, ['owner', 'admin'])
assert.deepEqual(memberInviteDenied.readRoles, ['owner', 'admin'])
assert.equal(memberInviteDenied.memberCanListInvites, false)
assert.equal(memberInviteDenied.memberCanCreateInvites, false)
assert.equal(memberInviteDenied.viewerCanListInvites, false)
assert.equal(memberInviteDenied.viewerCanCreateInvites, false)
assert.equal(memberInviteDenied.nonmemberEnumeration, false)
assert.ok(memberInviteDenied.safeFields.includes('actorRole'))
assert.ok(memberInviteDenied.noLeakFields.includes('pendingInvites[]'))
assert.equal(memberInviteDenied.serviceLogAction, 'organization_invite_management_denied')
assert.equal(memberInviteDenied.requestId, 'smoke-member-invite-create-denied')
assert.equal(memberInviteDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

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
assert.equal(parseBody(adminAcceptResponse.body).inviteAcceptance.inviteRole, 'admin')
assert.equal(parseBody(adminAcceptResponse.body).inviteAcceptance.appliedRole, 'admin')

const lastOwnerRoleChangeDeniedResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_owner/role`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { role: 'admin', reason: 'Cannot demote the only owner.', requestId: 'smoke-last-owner-role-denied' },
})
assert.equal(lastOwnerRoleChangeDeniedResponse.statusCode, 409, lastOwnerRoleChangeDeniedResponse.body)
const lastOwnerRoleGuard = parseBody(lastOwnerRoleChangeDeniedResponse.body).lastOwnerGuard
assert.equal(lastOwnerRoleGuard.schemaVersion, 'organization.last_owner_guard.v1')
assert.equal(lastOwnerRoleGuard.organizationId, organization.id)
assert.equal(lastOwnerRoleGuard.actorId, 'org_smoke_owner')
assert.equal(lastOwnerRoleGuard.actorRole, 'owner')
assert.equal(lastOwnerRoleGuard.targetUserId, 'org_smoke_owner')
assert.equal(lastOwnerRoleGuard.action, 'change_owner_role')
assert.equal(lastOwnerRoleGuard.requestedRole, 'admin')
assert.equal(lastOwnerRoleGuard.ownerCount, 1)
assert.equal(lastOwnerRoleGuard.blockerCode, 'last_owner_guard')
assert.equal(lastOwnerRoleGuard.transferOwnershipRoute, 'POST /api/organizations/:id/ownership-transfer')
assert.equal(lastOwnerRoleGuard.transferOwnershipRequired, true)
assert.equal(lastOwnerRoleGuard.noOrphanedOrganization, true)
assert.equal(lastOwnerRoleGuard.serviceLogAction, 'organization_last_owner_guard_blocked')
assert.equal(lastOwnerRoleGuard.requestId, 'smoke-last-owner-role-denied')

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
    const pendingForManagerBody = parseBody(pendingForManager.body)
    assert.deepEqual(pendingForManagerBody.invites.map((pendingInvite: Row) => pendingInvite.id), [viewerInvite.id])
    assert.equal(pendingForManagerBody.inviteLifecycleContract.actor.role, userId === 'org_smoke_owner' ? 'owner' : 'admin')
    assert.equal(pendingForManagerBody.inviteLifecycleContract.actor.canListPendingInvites, true)
    assert.equal(pendingForManagerBody.inviteLifecycleContract.actor.canRevokeInvites, true)
    assert.equal(pendingForManagerBody.inviteLifecycleContract.counts.pendingInviteCount, 1)
    assert.equal(pendingForManagerBody.inviteLifecycleContract.counts.pendingViewerCount, 1)
    assert.equal(pendingForManagerBody.inviteLifecycleContract.routes.acceptInvite, 'POST /api/organizations/invites/:inviteId/accept')
    assert.equal(pendingForManagerBody.inviteLifecycleContract.acceptanceTokenField, 'invite.acceptanceToken')
}

const viewerAcceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${viewerInvite.id}/accept`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(viewerAcceptResponse.statusCode, 200, viewerAcceptResponse.body)
assert.equal(parseBody(viewerAcceptResponse.body).membership.role, 'viewer')
assert.equal(parseBody(viewerAcceptResponse.body).inviteAcceptance.inviteRole, 'viewer')
assert.equal(parseBody(viewerAcceptResponse.body).inviteAcceptance.appliedRole, 'viewer')

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
    headers: { ...authHeaders('org_smoke_member', 'member-token'), 'x-request-id': 'smoke-member-settings-denied' },
    payload: { alertVisibilityPolicy: 'admins' },
})
assert.equal(memberSettingsUpdateResponse.statusCode, 403, memberSettingsUpdateResponse.body)
const memberSettingsDenied = parseBody(memberSettingsUpdateResponse.body).settingsMutationDenial
assert.equal(memberSettingsDenied.schemaVersion, 'organization.settings_mutation_denial.v1')
assert.equal(memberSettingsDenied.organizationId, organization.id)
assert.equal(memberSettingsDenied.tenantId, organization.id)
assert.equal(memberSettingsDenied.actorId, 'org_smoke_member')
assert.equal(memberSettingsDenied.actorRole, 'member')
assert.deepEqual(memberSettingsDenied.attemptedFields, ['alertVisibilityPolicy'])
assert.equal(memberSettingsDenied.denialReason, 'role_not_allowed')
assert.deepEqual(memberSettingsDenied.allowedRoles, ['owner', 'admin'])
assert.deepEqual(memberSettingsDenied.readableRoles, ['owner', 'admin', 'member', 'viewer'])
assert.ok(memberSettingsDenied.editableFields.includes('defaultWebhookPolicy'))
assert.ok(memberSettingsDenied.editableFields.includes('alertVisibilityPolicy'))
assert.equal(memberSettingsDenied.memberCanReadSettings, true)
assert.equal(memberSettingsDenied.memberCanUpdateSettings, false)
assert.equal(memberSettingsDenied.viewerCanReadSettings, true)
assert.equal(memberSettingsDenied.viewerCanUpdateSettings, false)
assert.equal(memberSettingsDenied.nonmemberEnumeration, false)
assert.ok(memberSettingsDenied.safeFields.includes('attemptedFields'))
assert.ok(memberSettingsDenied.noLeakFields.includes('destination.secret'))
assert.equal(memberSettingsDenied.serviceLogAction, 'organization_settings_mutation_denied')
assert.equal(memberSettingsDenied.requestId, 'smoke-member-settings-denied')
assert.equal(memberSettingsDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

const viewerSettingsUpdateResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/settings`,
    headers: { ...authHeaders('org_smoke_viewer', 'viewer-token'), 'x-request-id': 'smoke-viewer-settings-denied' },
    payload: { defaultWebhookPolicy: 'disabled' },
})
assert.equal(viewerSettingsUpdateResponse.statusCode, 403, viewerSettingsUpdateResponse.body)
const viewerSettingsDenied = parseBody(viewerSettingsUpdateResponse.body).settingsMutationDenial
assert.equal(viewerSettingsDenied.schemaVersion, 'organization.settings_mutation_denial.v1')
assert.equal(viewerSettingsDenied.organizationId, organization.id)
assert.equal(viewerSettingsDenied.actorId, 'org_smoke_viewer')
assert.equal(viewerSettingsDenied.actorRole, 'viewer')
assert.deepEqual(viewerSettingsDenied.attemptedFields, ['defaultWebhookPolicy'])
assert.equal(viewerSettingsDenied.denialReason, 'role_not_allowed')
assert.equal(viewerSettingsDenied.viewerCanReadSettings, true)
assert.equal(viewerSettingsDenied.viewerCanUpdateSettings, false)
assert.equal(viewerSettingsDenied.nonmemberEnumeration, false)
assert.equal(viewerSettingsDenied.serviceLogAction, 'organization_settings_mutation_denied')
assert.equal(viewerSettingsDenied.requestId, 'smoke-viewer-settings-denied')

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
const viewerRevokeInviteDenied = parseBody(viewerRevokeInviteDeniedResponse.body).inviteManagementDenial
assert.equal(viewerRevokeInviteDenied.schemaVersion, 'organization.invite_management_denial.v1')
assert.equal(viewerRevokeInviteDenied.organizationId, organization.id)
assert.equal(viewerRevokeInviteDenied.tenantId, organization.id)
assert.equal(viewerRevokeInviteDenied.actorId, 'org_smoke_viewer')
assert.equal(viewerRevokeInviteDenied.actorRole, 'viewer')
assert.equal(viewerRevokeInviteDenied.action, 'revoke_invite')
assert.equal(viewerRevokeInviteDenied.inviteId, pendingOpsInvite.id)
assert.equal(viewerRevokeInviteDenied.denialReason, 'role_not_allowed')
assert.deepEqual(viewerRevokeInviteDenied.allowedRoles, ['owner', 'admin'])
assert.deepEqual(viewerRevokeInviteDenied.readRoles, ['owner', 'admin'])
assert.equal(viewerRevokeInviteDenied.viewerCanListInvites, false)
assert.equal(viewerRevokeInviteDenied.viewerCanCreateInvites, false)
assert.equal(viewerRevokeInviteDenied.nonmemberEnumeration, false)
assert.ok(viewerRevokeInviteDenied.safeFields.includes('inviteId'))
assert.ok(viewerRevokeInviteDenied.noLeakFields.includes('invite.email'))
assert.equal(viewerRevokeInviteDenied.serviceLogAction, 'organization_invite_management_denied')
assert.equal(viewerRevokeInviteDenied.requestId, 'smoke-viewer-revoke-denied')
assert.equal(viewerRevokeInviteDenied.reason, 'Viewer cannot revoke invites.')
assert.equal(viewerRevokeInviteDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

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
assert.equal(revokedInviteAction.consumerVisibilityReceipt.schemaVersion, 'organization.invite_consumer_visibility_receipt.v1')
assert.equal(revokedInviteAction.consumerVisibilityReceipt.organizationId, organization.id)
assert.equal(revokedInviteAction.consumerVisibilityReceipt.tenantId, organization.id)
assert.equal(revokedInviteAction.consumerVisibilityReceipt.inviteId, pendingOpsInvite.id)
assert.equal(revokedInviteAction.consumerVisibilityReceipt.inviteStatus, 'revoked')
assert.equal(revokedInviteAction.consumerVisibilityReceipt.action, 'revoke')
assert.equal(revokedInviteAction.consumerVisibilityReceipt.grantsConsumerAccess, false)
assert.equal(revokedInviteAction.consumerVisibilityReceipt.acceptanceRequired, true)
assert.equal(revokedInviteAction.consumerVisibilityReceipt.blockerCode, 'member_revoked')
assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedRoutes.includes('GET /api/organizations/:id/watchlists'))
assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedRoutes.includes('GET /api/organizations/:id/alert-case-visibility'))
assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
assert.ok(revokedInviteAction.consumerVisibilityReceipt.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
assert.equal(revokedInviteAction.consumerVisibilityReceipt.noEnumeration, true)

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
assert.equal(repeatRevokedInviteAction.consumerVisibilityReceipt.grantsConsumerAccess, false)
assert.equal(repeatRevokedInviteAction.consumerVisibilityReceipt.blockerCode, 'member_revoked')

const revokedInviteAcceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${pendingOpsInvite.id}/accept`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(revokedInviteAcceptResponse.statusCode, 409, revokedInviteAcceptResponse.body)
const revokedInviteAcceptDenial = parseBody(revokedInviteAcceptResponse.body).inviteAcceptanceDenial
assert.equal(revokedInviteAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
assert.equal(revokedInviteAcceptDenial.organizationId, organization.id)
assert.equal(revokedInviteAcceptDenial.inviteId, pendingOpsInvite.id)
assert.equal(revokedInviteAcceptDenial.inviteStatus, 'revoked')
assert.equal(revokedInviteAcceptDenial.blockerCode, 'member_revoked')
assert.ok(revokedInviteAcceptDenial.blockedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(revokedInviteAcceptDenial.blockedRoutes.includes('POST /v1/dwm/webhooks/deliver'))
assert.ok(revokedInviteAcceptDenial.blockedConsumerContracts.includes('organization.shared_watchlist_readiness_export.v1'))
assert.ok(revokedInviteAcceptDenial.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
assert.equal(revokedInviteAcceptDenial.readinessRefs.inviteLifecycle, 'organization.invite_lifecycle_readiness_proof.v1')
assert.equal(revokedInviteAcceptDenial.readinessRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
assert.equal(revokedInviteAcceptDenial.ownerlessRecoveryMutationAllowed, false)
assert.equal(revokedInviteAcceptDenial.accessRequiresAcceptedMembership, true)
assert.equal(revokedInviteAcceptDenial.nonmemberEnumeration, false)

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
const acceptedInviteActionDenial = parseBody(acceptedInviteRevokeResponse.body).inviteActionDenial
assert.equal(acceptedInviteActionDenial.schemaVersion, 'organization.invite_action_denial.v1')
assert.equal(acceptedInviteActionDenial.organizationId, organization.id)
assert.equal(acceptedInviteActionDenial.tenantId, organization.id)
assert.equal(acceptedInviteActionDenial.actorId, 'org_smoke_owner')
assert.equal(acceptedInviteActionDenial.actorRole, 'owner')
assert.equal(acceptedInviteActionDenial.inviteId, invite.id)
assert.equal(acceptedInviteActionDenial.acceptanceToken, invite.id)
assert.equal(acceptedInviteActionDenial.inviteStatus, 'accepted')
assert.equal(acceptedInviteActionDenial.inviteRole, 'member')
assert.equal(acceptedInviteActionDenial.action, 'revoke')
assert.equal(acceptedInviteActionDenial.blockerCode, 'invite_already_accepted')
assert.equal(acceptedInviteActionDenial.statusCode, 409)
assert.equal(acceptedInviteActionDenial.memberManagementRoute, 'GET /api/organizations/:id/members')
assert.deepEqual(acceptedInviteActionDenial.replacementActions, ['update_member_role', 'remove_member'])
assert.equal(acceptedInviteActionDenial.nonmemberEnumeration, false)
assert.ok(acceptedInviteActionDenial.safeFields.includes('inviteStatus'))
assert.ok(acceptedInviteActionDenial.noLeakFields.includes('invite.email'))
assert.equal(acceptedInviteActionDenial.serviceLogAction, 'organization_invite_action_denied')
assert.equal(acceptedInviteActionDenial.requestId, 'smoke-accepted-revoke-denied')
assert.equal(acceptedInviteActionDenial.reason, 'Accepted invites must be member-managed.')
assert.equal(acceptedInviteActionDenial.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

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
assert.equal(bulkInviteWorkflow.submittedRecipientCount, 10)
assert.equal(bulkInviteWorkflow.recipientCount, 10)
assert.equal(bulkInviteWorkflow.normalizedRecipientCount, 10)
assert.equal(bulkInviteWorkflow.duplicateRecipientCount, 0)
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

const staleDeactivatedInvite = nowRow({
    id: 'stale-deactivated-invite',
    organization_id: organization.id,
    email: 'deactivated@example.test',
    role: 'member',
    invited_by: 'org_smoke_owner',
    status: 'pending',
    accepted_at: null,
    accepted_by: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
})
invites.set(staleDeactivatedInvite.id, staleDeactivatedInvite)
const staleDeactivatedAcceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${staleDeactivatedInvite.id}/accept`,
    headers: authHeaders('org_smoke_deactivated', 'deactivated-token'),
})
assert.equal(staleDeactivatedAcceptResponse.statusCode, 409, staleDeactivatedAcceptResponse.body)
const staleDeactivatedAcceptDenial = parseBody(staleDeactivatedAcceptResponse.body).inviteAcceptanceDenial
assert.equal(staleDeactivatedAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
assert.equal(staleDeactivatedAcceptDenial.organizationId, organization.id)
assert.equal(staleDeactivatedAcceptDenial.inviteId, staleDeactivatedInvite.id)
assert.equal(staleDeactivatedAcceptDenial.inviteStatus, 'pending')
assert.equal(staleDeactivatedAcceptDenial.userActive, false)
assert.equal(staleDeactivatedAcceptDenial.blockerCode, 'member_deactivated')
assert.equal(staleDeactivatedAcceptDenial.deactivatedUserDenied, true)
assert.equal(staleDeactivatedAcceptDenial.nonmemberEnumeration, false)
assert.ok(staleDeactivatedAcceptDenial.safeFields.includes('userActive'))

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
assert.equal(expiredAcceptResponse.statusCode, 409, expiredAcceptResponse.body)
const expiredAcceptDenial = parseBody(expiredAcceptResponse.body).inviteAcceptanceDenial
assert.equal(expiredAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
assert.equal(expiredAcceptDenial.organizationId, organization.id)
assert.equal(expiredAcceptDenial.inviteId, expiredInvite.id)
assert.equal(expiredAcceptDenial.inviteStatus, 'pending')
assert.equal(expiredAcceptDenial.blockerCode, 'invite_expired')
assert.ok(expiredAcceptDenial.blockedRoutes.includes('GET /api/organizations/:id/alert-case-visibility'))
assert.ok(expiredAcceptDenial.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
assert.equal(expiredAcceptDenial.readinessRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(expiredAcceptDenial.ownerlessRecoveryMutationAllowed, false)
assert.ok(expiredAcceptDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
assert.equal(expiredAcceptDenial.nonmemberEnumeration, false)

const membersResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/members`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(membersResponse.statusCode, 200, membersResponse.body)
const membersBody = parseBody(membersResponse.body)
const memberships = membersBody.members
assert.deepEqual(
    memberships.map((member: Row) => member.userId).sort(),
    ['org_smoke_admin', 'org_smoke_member', 'org_smoke_owner', 'org_smoke_viewer'].sort()
)
assert.equal(memberships.find((member: Row) => member.userId === 'org_smoke_admin').role, 'admin')
assert.equal(memberships.find((member: Row) => member.userId === 'org_smoke_viewer').role, 'viewer')
assert.equal(membersBody.memberAccessContract.schemaVersion, 'organization.member_access_contract.v1')
assert.equal(membersBody.memberAccessContract.organizationId, organization.id)
assert.equal(membersBody.memberAccessContract.tenantId, organization.id)
assert.equal(membersBody.memberAccessContract.actor.role, 'owner')
assert.equal(membersBody.memberAccessContract.actor.canManageInvites, true)
assert.equal(membersBody.memberAccessContract.actor.canManageMembers, true)
assert.equal(membersBody.memberAccessContract.actor.canManageWatchlists, true)
assert.equal(membersBody.memberAccessContract.actor.canReadSharedWatchlists, true)
assert.equal(membersBody.memberAccessContract.actor.canExportAlertTerms, true)
assert.equal(membersBody.memberAccessContract.counts.activeMemberCount, 4)
assert.equal(membersBody.memberAccessContract.counts.ownerCount, 1)
assert.equal(membersBody.memberAccessContract.counts.adminCount, 1)
assert.equal(membersBody.memberAccessContract.counts.memberCount, 1)
assert.equal(membersBody.memberAccessContract.counts.viewerCount, 1)
assert.equal(membersBody.memberAccessContract.counts.activeAdminCount, 2)
assert.deepEqual(membersBody.memberAccessContract.roleGates.createWatchlist, ['owner', 'admin'])
assert.deepEqual(membersBody.memberAccessContract.roleGates.readSharedWatchlists, ['owner', 'admin', 'member', 'viewer'])
assert.deepEqual(membersBody.memberAccessContract.roleGates.assignCase, ['owner', 'admin', 'analyst'])
assert.equal(membersBody.memberAccessContract.memberLifecycle.schemaVersion, 'organization.member_lifecycle_contract.v1')
assert.equal(membersBody.memberAccessContract.memberLifecycle.routes.listMembers, 'GET /api/organizations/:id/members')
assert.equal(membersBody.memberAccessContract.memberLifecycle.routes.updateRole, 'PATCH /api/organizations/:id/members/:userId/role')
assert.equal(membersBody.memberAccessContract.memberLifecycle.routes.removeMember, 'DELETE /api/organizations/:id/members/:userId')
assert.equal(membersBody.memberAccessContract.memberLifecycle.routes.transferOwnership, 'POST /api/organizations/:id/ownership-transfer')
assert.equal(membersBody.memberAccessContract.memberLifecycle.actorRole, 'owner')
assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.allowedMutators, ['owner', 'admin'])
assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.roleTargets, ['admin', 'member', 'viewer'])
assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.roleChange.ownerCanAssign, ['admin', 'member', 'viewer'])
assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.roleChange.adminCanAssign, ['member', 'viewer'])
assert.equal(membersBody.memberAccessContract.memberLifecycle.roleChange.serviceLogAction, 'organization_member_role_updated')
assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.removal.ownerCanRemove, ['admin', 'member', 'viewer'])
assert.deepEqual(membersBody.memberAccessContract.memberLifecycle.removal.adminCanRemove, ['member', 'viewer'])
assert.equal(membersBody.memberAccessContract.memberLifecycle.removal.lastOwnerBlocked, true)
assert.equal(membersBody.memberAccessContract.memberLifecycle.removal.removedMemberDeniedFromWatchlists, true)
assert.equal(membersBody.memberAccessContract.memberLifecycle.removal.removedMemberDeniedFromAlertTerms, true)
assert.equal(membersBody.memberAccessContract.memberLifecycle.ownership.reasonRequired, true)
assert.equal(membersBody.memberAccessContract.memberLifecycle.ownership.lastOwnerGuard, true)
assert.ok(membersBody.memberAccessContract.memberLifecycle.audit.requiredMetadataFields.includes('targetUserId'))
assert.ok(membersBody.memberAccessContract.memberLifecycle.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
assert.equal(membersBody.memberAccessContract.lifecycleDenials.revokedMember, 'member_revoked')
assert.equal(membersBody.memberAccessContract.lifecycleDenials.expiredInvite, 'invite_expired')
assert.equal(membersBody.memberAccessContract.lifecycleDenials.nonmember, 'nonmember_denied')
assert.equal(membersBody.memberAccessContract.downstreamConsumers.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')

const memberRoleUpdateDeniedResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { role: 'member', reason: 'Member should not manage roles.', requestId: 'smoke-member-role-denied' },
})
assert.equal(memberRoleUpdateDeniedResponse.statusCode, 403, memberRoleUpdateDeniedResponse.body)
const memberRoleUpdateDenial = parseBody(memberRoleUpdateDeniedResponse.body).memberMutationDenial
assert.equal(memberRoleUpdateDenial.schemaVersion, 'organization.member_mutation_denial.v1')
assert.equal(memberRoleUpdateDenial.organizationId, organization.id)
assert.equal(memberRoleUpdateDenial.actorId, 'org_smoke_member')
assert.equal(memberRoleUpdateDenial.actorRole, 'member')
assert.equal(memberRoleUpdateDenial.targetUserId, 'org_smoke_viewer')
assert.equal(memberRoleUpdateDenial.targetRole, 'viewer')
assert.equal(memberRoleUpdateDenial.action, 'change_member_role')
assert.equal(memberRoleUpdateDenial.requestedRole, 'member')
assert.equal(memberRoleUpdateDenial.denialReason, 'role_not_allowed')
assert.equal(memberRoleUpdateDenial.statusCode, 403)
assert.deepEqual(memberRoleUpdateDenial.allowedRoles, ['owner', 'admin'])
assert.deepEqual(memberRoleUpdateDenial.adminAllowedTargetRoles, ['member', 'viewer'])
assert.equal(memberRoleUpdateDenial.nonmemberEnumeration, false)
assert.equal(memberRoleUpdateDenial.serviceLogAction, 'organization_member_mutation_denied')
assert.equal(memberRoleUpdateDenial.requestId, 'smoke-member-role-denied')

const adminPromotesViewerDeniedResponse = await app.inject({
    method: 'PATCH',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer/role`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
    payload: { role: 'admin', reason: 'Admin cannot promote another admin.', requestId: 'smoke-admin-promote-denied' },
})
assert.equal(adminPromotesViewerDeniedResponse.statusCode, 403, adminPromotesViewerDeniedResponse.body)
const adminPromotesViewerDenial = parseBody(adminPromotesViewerDeniedResponse.body).memberMutationDenial
assert.equal(adminPromotesViewerDenial.actorRole, 'admin')
assert.equal(adminPromotesViewerDenial.targetRole, 'viewer')
assert.equal(adminPromotesViewerDenial.action, 'change_member_role')
assert.equal(adminPromotesViewerDenial.requestedRole, 'admin')
assert.equal(adminPromotesViewerDenial.adminCanMutateOwners, false)
assert.equal(adminPromotesViewerDenial.requestId, 'smoke-admin-promote-denied')

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
assert.equal(ownerRoleChange.consumerVisibilityReceipt.schemaVersion, 'organization.member_role_consumer_visibility_receipt.v1')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.organizationId, organization.id)
assert.equal(ownerRoleChange.consumerVisibilityReceipt.tenantId, organization.id)
assert.equal(ownerRoleChange.consumerVisibilityReceipt.actorId, 'org_smoke_owner')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.targetUserId, 'org_smoke_viewer')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.previousRole, 'viewer')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.newRole, 'member')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.membershipStatus, 'active')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.routes.sharedWatchlists, 'GET /api/organizations/:id/watchlists')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.routes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
assert.ok(ownerRoleChange.consumerVisibilityReceipt.consumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
assert.ok(ownerRoleChange.consumerVisibilityReceipt.consumerContracts.includes('organization.case_visibility_consumer.v1'))
assert.equal(ownerRoleChange.consumerVisibilityReceipt.before.role, 'viewer')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.before.canReadSharedWatchlists, true)
assert.equal(ownerRoleChange.consumerVisibilityReceipt.before.canMutateSharedWatchlists, false)
assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.role, 'member')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.canReadSharedWatchlists, true)
assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.canExportAlertTerms, false)
assert.equal(ownerRoleChange.consumerVisibilityReceipt.after.canMutateSharedWatchlists, false)
assert.equal(ownerRoleChange.consumerVisibilityReceipt.blockerCodes.removedMember, 'member_revoked')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.blockerCodes.alertVisibility, 'role_not_allowed')
assert.equal(ownerRoleChange.consumerVisibilityReceipt.noEnumeration, true)

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
assert.equal(restoreRoleChange.consumerVisibilityReceipt.previousRole, 'member')
assert.equal(restoreRoleChange.consumerVisibilityReceipt.newRole, 'viewer')
assert.equal(restoreRoleChange.consumerVisibilityReceipt.before.canReadSharedWatchlists, true)
assert.equal(restoreRoleChange.consumerVisibilityReceipt.before.canMutateSharedWatchlists, false)
assert.equal(restoreRoleChange.consumerVisibilityReceipt.after.canReadSharedWatchlists, true)
assert.equal(restoreRoleChange.consumerVisibilityReceipt.after.canExportAlertTerms, false)
assert.equal(restoreRoleChange.consumerVisibilityReceipt.after.canMutateSharedWatchlists, false)
assert.equal(restoreRoleChange.consumerVisibilityReceipt.noEnumeration, true)

const ownerWatchlistResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { kind: 'domain', value: 'https://www.acme-shared.example/login', notes: 'Customer domain', reason: 'Live proof domain seed.', requestId: 'smoke-domain-create' },
})
assert.equal(ownerWatchlistResponse.statusCode, 201, ownerWatchlistResponse.body)
const ownerWatchlistItem = parseBody(ownerWatchlistResponse.body).watchlistItem
assert.equal(ownerWatchlistItem.status, 'active')
assert.equal(ownerWatchlistItem.enabled, true)
assert.equal(ownerWatchlistItem.disabledReason, null)
assert.equal(ownerWatchlistItem.createdBy, 'org_smoke_owner')
assert.equal(ownerWatchlistItem.updatedBy, 'org_smoke_owner')
assert.equal(ownerWatchlistItem.lifecycleReason, 'Live proof domain seed.')
assert.equal(ownerWatchlistItem.lifecycleRequestId, 'smoke-domain-create')
assert.equal(ownerWatchlistItem.alertGenerationReference.watchlistItemId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistItem.alertGenerationReference.category, 'domain')
assert.equal(ownerWatchlistItem.alertGenerationReference.enabled, true)
assert.equal(ownerWatchlistItem.alertGenerationReference.disabledReason, null)
const ownerWatchlistOperation = parseBody(ownerWatchlistResponse.body).operation
assert.equal(ownerWatchlistOperation.actorId, 'org_smoke_owner')
assert.equal(ownerWatchlistOperation.requestId, 'smoke-domain-create')
assert.equal(ownerWatchlistOperation.serviceLogAction, 'organization_watchlist_upserted')
assert.equal(ownerWatchlistOperation.reason, 'Live proof domain seed.')
assert.equal(ownerWatchlistOperation.duplicateTermScope, 'organization')
assert.equal(ownerWatchlistOperation.watchlistItemId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistOperation.watchlistId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistOperation.ownerContext.schemaVersion, 'organization.watchlist_owner_context.v1')
assert.equal(ownerWatchlistOperation.ownerContext.organizationId, organization.id)
assert.equal(ownerWatchlistOperation.ownerContext.tenantId, organization.id)
assert.equal(ownerWatchlistOperation.ownerContext.ownerOrganizationId, organization.id)
assert.equal(ownerWatchlistOperation.ownerContext.watchlistItemId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistOperation.ownerContext.watchlistId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistOperation.ownerContext.actorId, 'org_smoke_owner')
assert.equal(ownerWatchlistOperation.ownerContext.actorRole, 'owner')
assert.equal(ownerWatchlistOperation.ownerContext.sourceFamily, 'organization_watchlist')
assert.equal(ownerWatchlistOperation.ownerContext.route, 'organization_watchlist')
assert.ok(ownerWatchlistOperation.ownerContext.alertBridgeFields.includes('workflowContext.alertGeneratorKeys'))
assert.ok(ownerWatchlistOperation.ownerContext.webhookBridgeFields.includes('destination.org_id'))
assert.equal(ownerWatchlistOperation.ownerContext.crossTenantCollisionAllowed, false)
assert.equal(ownerWatchlistOperation.ownerContext.nonmemberEnumeration, false)
assert.equal(ownerWatchlistOperation.upsert.schemaVersion, 'organization.watchlist_upsert.v1')
assert.equal(ownerWatchlistOperation.upsert.watchlistItemId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistOperation.upsert.ownerOrganizationId, organization.id)
assert.equal(ownerWatchlistOperation.upsert.idempotent, true)
assert.equal(ownerWatchlistOperation.upsert.duplicateTermMatched, false)
assert.equal(ownerWatchlistOperation.upsert.existingItemId, null)
assert.equal(ownerWatchlistOperation.upsert.actionTaken, 'created_new_item')
assert.equal(ownerWatchlistOperation.upsert.crossOrganizationDuplicateAllowed, true)
assert.equal(ownerWatchlistOperation.upsert.sameOrganizationDuplicateCreatesNewItem, false)
assert.deepEqual(ownerWatchlistOperation.upsert.duplicateScopeKeyFields, ['organizationId', 'kind', 'normalizedValue'])
assert.deepEqual(ownerWatchlistOperation.upsert.alertDedupeKeyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
assert.equal(ownerWatchlistOperation.upsert.webhookDestinationOrgField, 'destination.org_id')
assert.equal(ownerWatchlistOperation.lifecycleTransition.schemaVersion, 'organization.watchlist_lifecycle_transition.v1')
assert.equal(ownerWatchlistOperation.lifecycleTransition.statusAfter, 'active')
assert.equal(ownerWatchlistOperation.lifecycleTransition.enabledAfter, true)
assert.equal(ownerWatchlistOperation.lifecycleTransition.disabledReasonAfter, null)
assert.equal(ownerWatchlistOperation.lifecycleTransition.alertGenerationEligibleAfter, true)
assert.equal(ownerWatchlistOperation.lifecycleTransition.activeTermsExportRoute, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(ownerWatchlistOperation.mutationReceipt.schemaVersion, 'organization.watchlist_mutation_receipt.v1')
assert.equal(ownerWatchlistOperation.mutationReceipt.organizationId, organization.id)
assert.equal(ownerWatchlistOperation.mutationReceipt.tenantId, organization.id)
assert.equal(ownerWatchlistOperation.mutationReceipt.ownerOrganizationId, organization.id)
assert.equal(ownerWatchlistOperation.mutationReceipt.watchlistItemId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistOperation.mutationReceipt.watchlistId, ownerWatchlistItem.id)
assert.equal(ownerWatchlistOperation.mutationReceipt.action, 'created')
assert.equal(ownerWatchlistOperation.mutationReceipt.actorId, 'org_smoke_owner')
assert.equal(ownerWatchlistOperation.mutationReceipt.actorRole, 'owner')
assert.equal(ownerWatchlistOperation.mutationReceipt.requestId, 'smoke-domain-create')
assert.equal(ownerWatchlistOperation.mutationReceipt.statusAfter, 'active')
assert.equal(ownerWatchlistOperation.mutationReceipt.enabledAfter, true)
assert.equal(ownerWatchlistOperation.mutationReceipt.disabledReasonAfter, null)
assert.deepEqual(ownerWatchlistOperation.mutationReceipt.roleGates.mutateWatchlists, ['owner', 'admin'])
assert.deepEqual(ownerWatchlistOperation.mutationReceipt.roleGates.readSharedWatchlists, ['owner', 'admin', 'member', 'viewer'])
assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRoutes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRoutes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRefs.alertGeneration, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRefs.caseVisibility, 'organization.case_visibility_consumer.v1')
assert.equal(ownerWatchlistOperation.mutationReceipt.downstreamRefs.webhookOwnership, 'organization.shared_watchlist_webhook_ownership_hint.v1')
assert.equal(ownerWatchlistOperation.mutationReceipt.activeTermsIncludedInExport, true)
assert.equal(ownerWatchlistOperation.mutationReceipt.archivedMutationDeniedByLookup, false)
assert.equal(ownerWatchlistOperation.mutationReceipt.duplicateTermMatched, false)
assert.equal(ownerWatchlistOperation.mutationReceipt.noEnumeration, true)

const duplicateOwnerWatchlistResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { kind: 'domain', value: 'acme-shared.example', notes: 'Repeat proof should update existing item.', reason: 'Repeat live proof seed.', requestId: 'smoke-domain-duplicate-upsert' },
})
assert.equal(duplicateOwnerWatchlistResponse.statusCode, 201, duplicateOwnerWatchlistResponse.body)
const duplicateOwnerWatchlistItem = parseBody(duplicateOwnerWatchlistResponse.body).watchlistItem
assert.equal(duplicateOwnerWatchlistItem.id, ownerWatchlistItem.id)
assert.equal(duplicateOwnerWatchlistItem.lifecycleReason, 'Repeat live proof seed.')
assert.equal(duplicateOwnerWatchlistItem.lifecycleRequestId, 'smoke-domain-duplicate-upsert')
const duplicateOwnerWatchlistOperation = parseBody(duplicateOwnerWatchlistResponse.body).operation
assert.equal(duplicateOwnerWatchlistOperation.action, 'updated')
assert.equal(duplicateOwnerWatchlistOperation.duplicateTermScope, 'organization')
assert.equal(duplicateOwnerWatchlistOperation.watchlistItemId, ownerWatchlistItem.id)
assert.equal(duplicateOwnerWatchlistOperation.ownerContext.watchlistItemId, ownerWatchlistItem.id)
assert.equal(duplicateOwnerWatchlistOperation.ownerContext.organizationId, organization.id)
assert.equal(duplicateOwnerWatchlistOperation.mutationReceipt.action, 'updated')
assert.equal(duplicateOwnerWatchlistOperation.mutationReceipt.watchlistItemId, ownerWatchlistItem.id)
assert.equal(duplicateOwnerWatchlistOperation.mutationReceipt.duplicateTermMatched, true)
assert.equal(duplicateOwnerWatchlistOperation.mutationReceipt.existingItemId, ownerWatchlistItem.id)
assert.equal(duplicateOwnerWatchlistOperation.upsert.duplicateTermMatched, true)
assert.equal(duplicateOwnerWatchlistOperation.upsert.watchlistItemId, ownerWatchlistItem.id)
assert.equal(duplicateOwnerWatchlistOperation.upsert.existingItemId, ownerWatchlistItem.id)
assert.equal(duplicateOwnerWatchlistOperation.upsert.actionTaken, 'updated_existing_item')
assert.equal(duplicateOwnerWatchlistOperation.upsert.crossOrganizationDuplicateAllowed, true)
assert.equal(duplicateOwnerWatchlistOperation.upsert.sameOrganizationDuplicateCreatesNewItem, false)
assert.deepEqual(duplicateOwnerWatchlistOperation.upsert.alertDedupeKeyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
assert.equal(duplicateOwnerWatchlistOperation.upsert.webhookDestinationOrgField, 'destination.org_id')

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
assert.equal(memberWatchlist[0].enabled, true)
assert.equal(memberWatchlist[0].disabledReason, null)
const memberWatchlistItemResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(memberWatchlistItemResponse.statusCode, 200, memberWatchlistItemResponse.body)
const memberWatchlistItemBody = parseBody(memberWatchlistItemResponse.body)
assert.equal(memberWatchlistItemBody.watchlistItem.id, ownerWatchlistItem.id)
assert.equal(memberWatchlistItemBody.watchlistItem.organizationId, organization.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.schemaVersion, 'organization.watchlist_item_read.v1')
assert.equal(memberWatchlistItemBody.watchlistReadContract.organizationId, organization.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.tenantId, organization.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.ownerOrganizationId, organization.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.watchlistItemId, ownerWatchlistItem.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.member.userId, 'org_smoke_member')
assert.equal(memberWatchlistItemBody.watchlistReadContract.member.role, 'member')
assert.equal(memberWatchlistItemBody.watchlistReadContract.visibility.canReadSharedWatchlist, true)
assert.equal(memberWatchlistItemBody.watchlistReadContract.visibility.alertVisibilityAllowed, false)
assert.equal(memberWatchlistItemBody.watchlistReadContract.visibility.alertVisibilityDenialReason, 'role_not_allowed')
assert.deepEqual(memberWatchlistItemBody.watchlistReadContract.ownerContext.alertBridgeFields, ownerWatchlistOperation.ownerContext.alertBridgeFields)
assert.deepEqual(memberWatchlistItemBody.watchlistReadContract.ownerContext.webhookBridgeFields, ownerWatchlistOperation.ownerContext.webhookBridgeFields)
assert.equal(memberWatchlistItemBody.watchlistReadContract.alertBridge.alertGenerationReference.watchlistItemId, ownerWatchlistItem.id)
assert.ok(memberWatchlistItemBody.watchlistReadContract.alertBridge.requiredPersistedFields.includes('workflowContext.alertGeneratorKeys'))
assert.equal(memberWatchlistItemBody.watchlistReadContract.webhookBridge.requiredDestinationOrgId, organization.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.webhookBridge.nonmemberDestinationEnumeration, false)
assert.ok(memberWatchlistItemBody.watchlistReadContract.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.equal(memberWatchlistItemBody.watchlistReadContract.lifecycle.status, 'active')
assert.equal(memberWatchlistItemBody.watchlistReadContract.lifecycle.alertGenerationEligible, true)
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.schemaVersion, 'organization.watchlist_item_term_lifecycle.v1')
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.organizationId, organization.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.tenantId, organization.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.watchlistItemId, ownerWatchlistItem.id)
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.status, 'active')
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.activeForAlertMatching, true)
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.deletedByArchive, false)
assert.deepEqual(memberWatchlistItemBody.watchlistReadContract.termLifecycle.alertMatchingEligibleStatuses, ['active'])
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.blockerCode, null)
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.lifecycleRequestId, 'smoke-domain-duplicate-upsert')
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.downstreamRefs.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(memberWatchlistItemBody.watchlistReadContract.termLifecycle.downstreamRefs.webhookDestinationOrgField, 'destination.org_id')
assert.ok(memberWatchlistItemBody.watchlistReadContract.termLifecycle.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
const memberSharedWatchlistContract = parseBody(memberWatchlistResponse.body).sharedWatchlistContract
assert.equal(memberSharedWatchlistContract.schemaVersion, 'organization.shared_watchlist_contract.v1')
assert.equal(memberSharedWatchlistContract.organizationId, organization.id)
assert.equal(memberSharedWatchlistContract.permissions.actorRole, 'member')
assert.equal(memberSharedWatchlistContract.permissions.canRead, true)
assert.equal(memberSharedWatchlistContract.permissions.canWrite, false)
assert.equal(memberSharedWatchlistContract.permissions.nonmemberEnumeration, false)
assert.deepEqual(memberSharedWatchlistContract.permissions.writeRoles, ['owner', 'admin'])
assert.deepEqual(memberSharedWatchlistContract.permissions.readRoles, ['owner', 'admin', 'member', 'viewer'])
assert.equal(memberSharedWatchlistContract.ownership.crossOrgEnumerationAllowed, false)
assert.deepEqual(memberSharedWatchlistContract.ownership.activeItemIds, [ownerWatchlistItem.id])
assert.deepEqual(memberSharedWatchlistContract.ownership.creatorUserIds, ['org_smoke_owner'])
assert.equal(memberSharedWatchlistContract.lifecycle.activeCount, 1)
assert.equal(memberSharedWatchlistContract.lifecycle.cleanupRequired, false)
assert.equal(memberSharedWatchlistContract.alertExportBridge.route, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.deepEqual(memberSharedWatchlistContract.alertExportBridge.watchlistItemIds, [ownerWatchlistItem.id])
assert.ok(memberSharedWatchlistContract.alertExportBridge.requiredFields.includes('ownerOrganizationId'))
assert.ok(memberSharedWatchlistContract.alertExportBridge.requiredFields.includes('activeTerms[].ownerOrganizationId'))
assert.ok(memberSharedWatchlistContract.alertExportBridge.requiredFields.includes('activeTerms[].matchedTerm.termFamily'))
assert.ok(memberSharedWatchlistContract.alertExportBridge.requiredFields.includes('activeTerms[].alertGenerationRef'))
assert.ok(memberSharedWatchlistContract.alertExportBridge.ownerContextFields.includes('activeTerms[].createdBy'))
assert.equal(memberSharedWatchlistContract.alertExportBridge.webhookOwnership.schemaVersion, 'organization.shared_watchlist_webhook_ownership_hint.v1')
assert.equal(memberSharedWatchlistContract.alertExportBridge.webhookOwnership.requiredDestinationOrgId, organization.id)
assert.equal(memberSharedWatchlistContract.alertExportBridge.webhookOwnership.selectedDestinationOrgField, 'destination.org_id')
assert.equal(memberSharedWatchlistContract.alertExportBridge.webhookOwnership.nonmemberDestinationEnumeration, false)

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
    payload: { kind: 'company', value: 'Viewer Blocked Holdings', reason: 'Viewer cannot mutate shared terms.', requestId: 'smoke-viewer-watchlist-create-denied' },
})
assert.equal(viewerAddsWatchlistResponse.statusCode, 403, viewerAddsWatchlistResponse.body)
const viewerAddsWatchlistDenied = parseBody(viewerAddsWatchlistResponse.body).watchlistMutationDenial
assert.equal(viewerAddsWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
assert.equal(viewerAddsWatchlistDenied.organizationId, organization.id)
assert.equal(viewerAddsWatchlistDenied.tenantId, organization.id)
assert.equal(viewerAddsWatchlistDenied.actorId, 'org_smoke_viewer')
assert.equal(viewerAddsWatchlistDenied.actorRole, 'viewer')
assert.equal(viewerAddsWatchlistDenied.action, 'create_watchlist')
assert.equal(viewerAddsWatchlistDenied.itemId, null)
assert.equal(viewerAddsWatchlistDenied.denialReason, 'role_not_allowed')
assert.deepEqual(viewerAddsWatchlistDenied.allowedRoles, ['owner', 'admin'])
assert.deepEqual(viewerAddsWatchlistDenied.readRoles, ['owner', 'admin', 'member', 'viewer'])
assert.equal(viewerAddsWatchlistDenied.memberCanReadSharedWatchlists, true)
assert.equal(viewerAddsWatchlistDenied.memberCanMutateSharedWatchlists, false)
assert.equal(viewerAddsWatchlistDenied.viewerCanReadSharedWatchlists, true)
assert.equal(viewerAddsWatchlistDenied.viewerCanMutateSharedWatchlists, false)
assert.equal(viewerAddsWatchlistDenied.downstreamRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(viewerAddsWatchlistDenied.downstreamRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(viewerAddsWatchlistDenied.downstreamRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
assert.equal(viewerAddsWatchlistDenied.downstreamRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
assert.equal(viewerAddsWatchlistDenied.deniedMutationDoesNotAffectActiveTerms, true)
assert.equal(viewerAddsWatchlistDenied.activeExportRemainsAvailableToAllowedRoles, true)
assert.ok(viewerAddsWatchlistDenied.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.ok(viewerAddsWatchlistDenied.noLeakFields.includes('destination.secret'))
assert.equal(viewerAddsWatchlistDenied.nonmemberEnumeration, false)
assert.equal(viewerAddsWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
assert.equal(viewerAddsWatchlistDenied.requestId, 'smoke-viewer-watchlist-create-denied')
assert.equal(viewerAddsWatchlistDenied.reason, 'Viewer cannot mutate shared terms.')
assert.equal(viewerAddsWatchlistDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

const memberAddsWatchlistDeniedResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { kind: 'keyword', value: 'member should not mutate', reason: 'Member cannot create shared terms.', requestId: 'smoke-member-watchlist-create-denied' },
})
assert.equal(memberAddsWatchlistDeniedResponse.statusCode, 403, memberAddsWatchlistDeniedResponse.body)
const memberAddsWatchlistDenied = parseBody(memberAddsWatchlistDeniedResponse.body).watchlistMutationDenial
assert.equal(memberAddsWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
assert.equal(memberAddsWatchlistDenied.organizationId, organization.id)
assert.equal(memberAddsWatchlistDenied.actorId, 'org_smoke_member')
assert.equal(memberAddsWatchlistDenied.actorRole, 'member')
assert.equal(memberAddsWatchlistDenied.action, 'create_watchlist')
assert.equal(memberAddsWatchlistDenied.itemId, null)
assert.equal(memberAddsWatchlistDenied.denialReason, 'role_not_allowed')
assert.deepEqual(memberAddsWatchlistDenied.allowedRoles, ['owner', 'admin'])
assert.deepEqual(memberAddsWatchlistDenied.readRoles, ['owner', 'admin', 'member', 'viewer'])
assert.equal(memberAddsWatchlistDenied.memberCanReadSharedWatchlists, true)
assert.equal(memberAddsWatchlistDenied.memberCanMutateSharedWatchlists, false)
assert.equal(memberAddsWatchlistDenied.nonmemberEnumeration, false)
assert.equal(memberAddsWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
assert.equal(memberAddsWatchlistDenied.requestId, 'smoke-member-watchlist-create-denied')
assert.equal(memberAddsWatchlistDenied.reason, 'Member cannot create shared terms.')

const viewerArchiveWatchlistResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}?requestId=smoke-viewer-watchlist-archive-denied`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
    payload: { reason: 'Viewer cannot archive shared terms.' },
})
assert.equal(viewerArchiveWatchlistResponse.statusCode, 403, viewerArchiveWatchlistResponse.body)
const viewerArchiveWatchlistDenied = parseBody(viewerArchiveWatchlistResponse.body).watchlistMutationDenial
assert.equal(viewerArchiveWatchlistDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
assert.equal(viewerArchiveWatchlistDenied.organizationId, organization.id)
assert.equal(viewerArchiveWatchlistDenied.actorId, 'org_smoke_viewer')
assert.equal(viewerArchiveWatchlistDenied.actorRole, 'viewer')
assert.equal(viewerArchiveWatchlistDenied.action, 'archive_watchlist')
assert.equal(viewerArchiveWatchlistDenied.itemId, ownerWatchlistItem.id)
assert.equal(viewerArchiveWatchlistDenied.denialReason, 'role_not_allowed')
assert.equal(viewerArchiveWatchlistDenied.viewerCanReadSharedWatchlists, true)
assert.equal(viewerArchiveWatchlistDenied.viewerCanMutateSharedWatchlists, false)
assert.equal(viewerArchiveWatchlistDenied.nonmemberEnumeration, false)
assert.equal(viewerArchiveWatchlistDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
assert.equal(viewerArchiveWatchlistDenied.requestId, 'smoke-viewer-watchlist-archive-denied')
assert.equal(viewerArchiveWatchlistDenied.reason, 'Viewer cannot archive shared terms.')

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
assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.enabled, false)
assert.equal(parseBody(ownerPausesCompanyResponse.body).watchlistItem.disabledReason, 'watchlist_paused')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.action, 'pause')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.statusAfter, 'paused')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.enabledAfter, false)
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.disabledReasonAfter, 'watchlist_paused')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.alertGenerationEligibleAfter, false)
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.lifecycleTransition.blockerAfter, 'watchlist_paused')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.schemaVersion, 'organization.watchlist_mutation_receipt.v1')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.action, 'pause')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.statusAfter, 'paused')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.enabledAfter, false)
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.lifecycleBlockerAfter, 'watchlist_paused')
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.activeTermsIncludedInExport, false)
assert.equal(parseBody(ownerPausesCompanyResponse.body).operation.mutationReceipt.noEnumeration, true)

const pausedWatchlistsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists?status=paused`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(pausedWatchlistsResponse.statusCode, 200, pausedWatchlistsResponse.body)
assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.id), [companyWatchlistItem.id])
assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.enabled), [false])
assert.deepEqual(parseBody(pausedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.disabledReason), ['watchlist_paused'])

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
assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.statusAfter, 'active')
assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.enabledAfter, true)
assert.equal(parseBody(ownerResumesCompanyResponse.body).operation.lifecycleTransition.disabledReasonAfter, null)

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

const memberUpdatesKeywordDeniedResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/watchlists/${keywordWatchlistItem.id}`,
    headers: authHeaders('org_smoke_member', 'member-token'),
    payload: { kind: 'keyword', value: 'member update denied', reason: 'Member cannot edit shared terms.', requestId: 'smoke-member-watchlist-update-denied' },
})
assert.equal(memberUpdatesKeywordDeniedResponse.statusCode, 403, memberUpdatesKeywordDeniedResponse.body)
const memberUpdatesKeywordDenied = parseBody(memberUpdatesKeywordDeniedResponse.body).watchlistMutationDenial
assert.equal(memberUpdatesKeywordDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
assert.equal(memberUpdatesKeywordDenied.organizationId, organization.id)
assert.equal(memberUpdatesKeywordDenied.actorId, 'org_smoke_member')
assert.equal(memberUpdatesKeywordDenied.actorRole, 'member')
assert.equal(memberUpdatesKeywordDenied.action, 'update_watchlist')
assert.equal(memberUpdatesKeywordDenied.itemId, keywordWatchlistItem.id)
assert.equal(memberUpdatesKeywordDenied.denialReason, 'role_not_allowed')
assert.equal(memberUpdatesKeywordDenied.memberCanReadSharedWatchlists, true)
assert.equal(memberUpdatesKeywordDenied.memberCanMutateSharedWatchlists, false)
assert.equal(memberUpdatesKeywordDenied.downstreamRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(memberUpdatesKeywordDenied.deniedMutationDoesNotAffectActiveTerms, true)
assert.ok(memberUpdatesKeywordDenied.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
assert.equal(memberUpdatesKeywordDenied.nonmemberEnumeration, false)
assert.equal(memberUpdatesKeywordDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
assert.equal(memberUpdatesKeywordDenied.requestId, 'smoke-member-watchlist-update-denied')
assert.equal(memberUpdatesKeywordDenied.reason, 'Member cannot edit shared terms.')

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
const ownerSharedWatchlistContract = parseBody(ownerSeesAllResponse.body).sharedWatchlistContract
assert.deepEqual(ownerSharedWatchlistContract.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
assert.equal(ownerSharedWatchlistContract.permissions.actorRole, 'owner')
assert.equal(ownerSharedWatchlistContract.permissions.canWrite, true)
assert.equal(ownerSharedWatchlistContract.permissions.canArchive, true)
assert.equal(ownerSharedWatchlistContract.permissions.canCleanup, true)
assert.equal(ownerSharedWatchlistContract.ownership.duplicateTermScope, 'organization')
assert.equal(ownerSharedWatchlistContract.ownership.crossOrgEnumerationAllowed, false)
assert.equal(ownerSharedWatchlistContract.ownership.activeItemIds.length, 5)
assert.ok(ownerSharedWatchlistContract.ownership.itemIds.includes(ownerWatchlistItem.id))
assert.deepEqual(ownerSharedWatchlistContract.ownership.creatorUserIds.sort(), ['org_smoke_admin', 'org_smoke_owner'].sort())
assert.equal(ownerSharedWatchlistContract.lifecycle.activeCount, 5)
assert.equal(ownerSharedWatchlistContract.lifecycle.pausedCount, 0)
assert.equal(ownerSharedWatchlistContract.lifecycle.archivedCount, 0)
assert.equal(ownerSharedWatchlistContract.lifecycle.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
assert.equal(ownerSharedWatchlistContract.lifecycle.archiveRoute, 'DELETE /api/organizations/:organizationId/watchlists/:itemId')
assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.watchlistItemIds.sort(), ownerSharedWatchlistContract.ownership.activeItemIds.sort())
assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
assert.ok(ownerSharedWatchlistContract.alertExportBridge.ownerContextFields.includes('activeTerms[].lifecycleRequestId'))
assert.ok(ownerSharedWatchlistContract.alertExportBridge.webhookOwnership.requiredAlertFields.includes('alert.ownerOrganizationId'))
assert.ok(ownerSharedWatchlistContract.alertExportBridge.webhookOwnership.redactedFields.includes('destination.secret'))
assert.deepEqual(ownerSharedWatchlistContract.alertExportBridge.blockedReasons, [])

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
assert.equal(readiness.pendingInviteCount, 12)
assert.equal(readiness.sharedWatchlistCount, 5)
assert.equal(readiness.readinessStatus, 'ready')
assert.equal(readiness.ready, true)
assert.equal(readiness.teamOnboardingReadiness.schemaVersion, 'organization.team_onboarding_readiness.v1')
assert.equal(readiness.teamOnboardingReadiness.targetMemberCount, 10)
assert.equal(readiness.teamOnboardingReadiness.activeMemberCount, 4)
assert.equal(readiness.teamOnboardingReadiness.pendingInviteCount, 12)
assert.equal(readiness.teamOnboardingReadiness.acceptedOrInvitedCount, 16)
assert.equal(readiness.teamOnboardingReadiness.sharedWatchlistCount, 5)
assert.equal(readiness.teamOnboardingReadiness.canSupportTenMemberSharedWatchlistRollout, true)
assert.deepEqual(readiness.teamOnboardingReadiness.blockedReasons, [])
assert.equal(readiness.lifecycleReadiness.schemaVersion, 'organization.lifecycle_readiness.v1')
assert.equal(readiness.lifecycleReadiness.actorRole, 'member')
assert.equal(readiness.lifecycleReadiness.counts.memberCount, 4)
assert.equal(readiness.lifecycleReadiness.counts.activeAdminCount, 2)
assert.equal(readiness.lifecycleReadiness.counts.pendingInviteCount, 12)
assert.equal(readiness.lifecycleReadiness.counts.sharedWatchlistCount, 5)
assert.equal(readiness.lifecycleReadiness.watchlistReadiness.ready, true)
assert.equal(readiness.lifecycleReadiness.alertExportReadiness.ready, true)
assert.equal(readiness.lifecycleReadiness.cleanupReadiness.cleanupIdempotent, true)
assert.equal(readiness.lifecycleReadiness.supportVisibility.mode, 'redacted_summary_only')
assert.equal(readiness.lifecycleReadiness.downstreamLifecycleReceipt.schemaVersion, 'organization.lifecycle_downstream_receipt.v1')
assert.equal(readiness.lifecycleReadiness.downstreamLifecycleReceipt.lifecycleStatus, 'active')
assert.equal(readiness.lifecycleReadiness.downstreamLifecycleReceipt.blockerCode, null)
assert.equal(readiness.lifecycleReadiness.downstreamLifecycleReceipt.inviteMutationAllowed, true)
assert.equal(readiness.lifecycleReadiness.downstreamLifecycleReceipt.watchlistMutationAllowed, true)
assert.equal(readiness.lifecycleReadiness.downstreamLifecycleReceipt.alertExportAllowed, true)
assert.equal(readiness.lifecycleReadiness.downstreamLifecycleReceipt.caseVisibilityAllowed, true)
assert.equal(readiness.lifecycleReadiness.downstreamLifecycleReceipt.webhookDeliveryAllowed, true)
assert.deepEqual(readiness.lifecycleReadiness.downstreamLifecycleReceipt.blockedRoutes, [])
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
assert.equal(readiness.readinessProof.counts.pendingInviteCount, 12)
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
assert.equal(readiness.readinessProof.caseAssignmentProof.schemaVersion, 'organization.case_assignment_readiness.v1')
assert.ok(readiness.readinessProof.caseAssignmentProof.sourceContracts.includes('organization.case_visibility_consumer.v1'))
assert.ok(readiness.readinessProof.caseAssignmentProof.sourceContracts.includes('organization.alert_case_bridge_persistence_receipt.v1'))
assert.equal(readiness.readinessProof.caseAssignmentProof.route, 'POST /v1/cases/:caseId/assignment')
assert.equal(readiness.readinessProof.caseAssignmentProof.organizationId, organization.id)
assert.equal(readiness.readinessProof.caseAssignmentProof.tenantId, organization.id)
assert.equal(readiness.readinessProof.caseAssignmentProof.actor.role, 'member')
assert.equal(readiness.readinessProof.caseAssignmentProof.actor.canAssignCase, false)
assert.deepEqual(readiness.readinessProof.caseAssignmentProof.actor.allowedActions, ['acknowledge_alert'])
assert.deepEqual(readiness.readinessProof.caseAssignmentProof.roleGates.assignCase, ['owner', 'admin', 'analyst'])
assert.equal(readiness.readinessProof.caseAssignmentProof.roleGates.memberReadOnly, true)
assert.equal(readiness.readinessProof.caseAssignmentProof.roleGates.viewerReadOnly, true)
assert.ok(readiness.readinessProof.caseAssignmentProof.requiredCaseFields.includes('assignmentAudit.requestId'))
assert.ok(readiness.readinessProof.caseAssignmentProof.requiredAlertFields.includes('workflowContext.allowedActions'))
assert.ok(readiness.readinessProof.caseAssignmentProof.visibilityInputs.includes('organization.lifecycleStatus'))
assert.ok(readiness.readinessProof.caseAssignmentProof.lifecycleBlockers.includes('member_revoked'))
assert.deepEqual(readiness.readinessProof.caseAssignmentProof.blockerCodes, ['role_not_allowed'])
assert.equal(readiness.readinessProof.caseAssignmentProof.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.caseAssignmentProof.crossOrgCaseAssignmentAllowed, false)
assert.ok(readiness.readinessProof.caseAssignmentProof.noLeakFields.includes('otherOrg.caseIds'))
assert.ok(readiness.readinessProof.caseAssignmentProof.proofAssertions.includes('member_cannot_assign_case'))
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
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.schemaVersion, 'organization.webhook_destination_readiness_bridge.v1')
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.deliveryContractSchema, 'dwm.webhook.org_alert_delivery.v1')
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.sourceContract, 'organization.watchlist_webhook_delivery_contract.v1')
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.route, 'POST /v1/dwm/webhooks/deliver')
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.defaultWebhookPolicy, 'manual_selection')
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.canUseDefaultDestinations, false)
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.selectedDestinationSource, 'manual_selection_required')
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.requiredDestinationOrgId, organization.id)
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.selectedDestinationOrgField, 'destination.org_id')
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.selectedDestinationIdField, 'webhookDestinationIds[]')
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.ownerAdminManualTriggerRequired, true)
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.memberManualTriggerAllowed, false)
assert.equal(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.nonmemberDestinationEnumeration, false)
assert.deepEqual(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.blockerCodes, ['manual_webhook_selection_required'])
assert.ok(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.requiredAlertFields.includes('alert.organizationId'))
assert.ok(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.expectedDeliveryFields.includes('payload.alert.organizationId'))
assert.ok(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.skippedDestinationReasons.includes('org_mismatch'))
assert.ok(readiness.readinessProof.webhookDeliveryProof.webhookDestinationReadinessBridge.lifecycleBlockers.includes('member_revoked'))
assert.equal(readiness.readinessProof.destinationOwnershipProof.schemaVersion, 'organization.webhook_destination_ownership_readiness.v1')
assert.ok(readiness.readinessProof.destinationOwnershipProof.sourceContracts.includes('organization.webhook_destination_ownership.v1'))
assert.ok(readiness.readinessProof.destinationOwnershipProof.sourceContracts.includes('organization.webhook_destination_access_decision.v1'))
assert.equal(readiness.readinessProof.destinationOwnershipProof.route, 'POST /v1/dwm/webhooks/deliver')
assert.equal(readiness.readinessProof.destinationOwnershipProof.organizationId, organization.id)
assert.equal(readiness.readinessProof.destinationOwnershipProof.tenantId, organization.id)
assert.equal(readiness.readinessProof.destinationOwnershipProof.defaultWebhookPolicy, 'manual_selection')
assert.equal(readiness.readinessProof.destinationOwnershipProof.requiredDestinationOrgId, organization.id)
assert.equal(readiness.readinessProof.destinationOwnershipProof.requiredDestinationOrgField, 'destination.org_id')
assert.equal(readiness.readinessProof.destinationOwnershipProof.selectedDestinationIdField, 'webhookDestinationIds[]')
assert.equal(readiness.readinessProof.destinationOwnershipProof.selectedDestinationSource, 'manual_selection_required')
assert.equal(readiness.readinessProof.destinationOwnershipProof.crossOrgDestinationAllowed, false)
assert.equal(readiness.readinessProof.destinationOwnershipProof.nonmemberDestinationEnumeration, false)
assert.equal(readiness.readinessProof.destinationOwnershipProof.ownerAdminConfigureAllowed, false)
assert.equal(readiness.readinessProof.destinationOwnershipProof.memberConfigureAllowed, false)
assert.deepEqual(readiness.readinessProof.destinationOwnershipProof.manualTriggerAllowedRoles, ['owner', 'admin'])
assert.equal(readiness.readinessProof.destinationOwnershipProof.automaticDeliveryAllowed, false)
assert.equal(readiness.readinessProof.destinationOwnershipProof.supportInspection.mode, 'redacted_destination_summary')
assert.equal(readiness.readinessProof.destinationOwnershipProof.supportInspection.endpointRedacted, true)
assert.equal(readiness.readinessProof.destinationOwnershipProof.supportInspection.secretRedacted, true)
assert.ok(readiness.readinessProof.destinationOwnershipProof.lifecycleBlockers.includes('member_revoked'))
assert.deepEqual(readiness.readinessProof.destinationOwnershipProof.blockerCodes, ['manual_webhook_selection_required'])
assert.ok(readiness.readinessProof.destinationOwnershipProof.noLeakFields.includes('otherOrg.destinationIds'))
assert.ok(readiness.readinessProof.destinationOwnershipProof.noLeakFields.includes('destination.secret'))
assert.ok(readiness.readinessProof.destinationOwnershipProof.proofAssertions.includes('destination_org_matches_alert_org'))
assert.ok(readiness.readinessProof.destinationOwnershipProof.proofAssertions.includes('support_reads_redacted_destination_summary'))
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
assert.ok(readiness.readinessProof.memberLifecycleProof.protectedRoutes.includes('GET /api/organizations/:id/alert-case-visibility'))
assert.ok(readiness.readinessProof.memberLifecycleProof.protectedRoutes.includes('POST|PUT|DELETE /api/organizations/:id/watchlists'))
assert.ok(readiness.readinessProof.memberLifecycleProof.protectedRoutes.includes('POST /v1/dwm/webhooks/deliver'))
assert.ok(readiness.readinessProof.memberLifecycleProof.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
assert.ok(readiness.readinessProof.memberLifecycleProof.noLeakFields.includes('destination.secret'))
assert.ok(readiness.readinessProof.memberLifecycleProof.auditActions.includes('organization_member_removed'))
assert.equal(readiness.readinessProof.memberLifecycleProof.memberRemovalCleanup.responseSchema, 'organization.member_removal_cleanup.v1')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberRemovalCleanup.revokesPendingInvites, true)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberRemovalCleanup.cleanupField, 'memberRemovalCleanup.revokedInviteIds')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberRemovalCleanup.staleInviteAcceptanceBlocker, 'member_revoked')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberRemovalCleanup.serviceLogAction, 'organization_member_removed')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.responseSchema, 'organization.member_consumer_access_recovery.v1')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.automaticRegrantAllowed, false)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.blockerCode, 'member_revoked')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.ownerlessRecoveryMutationAllowed, false)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.directMembershipMutationAllowed, false)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.requiresOwnerAdminReview, true)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.requiresAcceptedInvite, true)
assert.deepEqual(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.recoveryActorRoles, ['owner', 'admin'])
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.recoveryReceipts.includes('organization.invite_consumer_visibility_receipt.v1'))
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.recoveryReceipts.includes('organization.member_role_consumer_visibility_receipt.v1'))
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.recoveryRoutes.createInvite, 'POST /api/organizations/:id/invites')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.recoveryRoutes.acceptInvite, 'POST /api/organizations/invites/:inviteId/accept')
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.blockedUntilAcceptedMembership.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.blockedUntilAcceptedMembership.includes('GET /api/organizations/:id/alert-case-visibility'))
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.schemaVersion, 'organization.member_recovery_support_history_bridge.v1')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.source, 'support_audit_timeline')
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.supportReceiptSchemas.includes('support.access_recovery.execution_receipt.v1'))
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.supportReceiptSchemas.includes('support.access_recovery.decision_receipt.v1'))
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.supportReceiptSchemas.includes('support.action_execute.member_role_recovery.v1'))
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.expectedSupportActions.includes('support.organization.access_recovery'))
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.expectedSupportActions.includes('support.organization.member_role_recovery'))
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.replayFilters.organizationId, 'org')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.replayFilters.targetUserId, 'target')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.supportRoutes.inspect, '/api/admin/support/inspect')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.supportRoutes.accessRecovery, '/api/admin/support/access-recovery/:requestId')
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.requiredAuditFields.includes('supportSessionId'))
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.noSilentMembershipMutation, true)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportActionHistoryBridge.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.schemaVersion, 'organization.member_support_assisted_recovery_receipt.v1')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.supportActionHistoryBridge, 'organization.member_recovery_support_history_bridge.v1')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.allowedOutcome, 'invite_required')
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.directMembershipMutationAllowed, false)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.ownerlessRecoveryMutationAllowed, false)
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.requiresAcceptedInvite, true)
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.requiredAuditFields.includes('supportSessionId'))
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.blockedRoutesUntilAcceptedMembership.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.blockedRoutesUntilAcceptedMembership.includes('POST /v1/dwm/webhooks/deliver'))
assert.equal(readiness.readinessProof.memberLifecycleProof.memberAccessRecovery.supportAssistedRecoveryReceipt.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.memberLifecycleProof.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.inviteLifecycleProof.schemaVersion, 'organization.invite_lifecycle_readiness_proof.v1')
assert.equal(readiness.readinessProof.inviteLifecycleProof.pendingInviteCount, 12)
assert.equal(readiness.readinessProof.inviteLifecycleProof.inviteTenSupported, true)
assert.equal(readiness.readinessProof.inviteLifecycleProof.maxRecipientsPerRequest, 25)
assert.equal(readiness.readinessProof.inviteLifecycleProof.duplicateRecipientHandling, 'dedupe_case_insensitive')
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
assert.ok(readiness.readinessProof.inviteLifecycleProof.requiredMetadataFields.includes('submittedRecipientCount'))
assert.ok(readiness.readinessProof.inviteLifecycleProof.requiredMetadataFields.includes('duplicateRecipientCount'))
assert.ok(readiness.readinessProof.inviteLifecycleProof.requiredMetadataFields.includes('previousStatus'))
assert.equal(readiness.readinessProof.inviteLifecycleProof.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.schemaVersion, 'organization.lifecycle_cleanup_readiness.v1')
assert.equal(readiness.readinessProof.lifecycleCleanupProof.organizationId, organization.id)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.tenantId, organization.id)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupRoutes.revokeInvite, 'POST /api/organizations/:id/invites/:inviteId/actions')
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupRoutes.removeMember, 'DELETE /api/organizations/:id/members/:userId')
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupRoutes.cleanupWatchlists, 'POST /api/organizations/:id/watchlists/cleanup')
assert.ok(readiness.readinessProof.lifecycleCleanupProof.idempotentActions.includes('invite_revoke'))
assert.ok(readiness.readinessProof.lifecycleCleanupProof.idempotentActions.includes('watchlist_cleanup'))
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupEffects.removedMemberRevokesPendingInvites, true)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupEffects.removedMemberLosesAlertExportAccess, true)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupEffects.removedMemberLosesCaseVisibility, true)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupEffects.removedMemberLosesWebhookAccess, true)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupEffects.revokedInviteCannotGrantAccess, true)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupEffects.expiredInviteCannotGrantAccess, true)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupEffects.archivedWatchlistsExcludedFromMatching, true)
assert.ok(readiness.readinessProof.lifecycleCleanupProof.blockedUntilAcceptedMembership.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(readiness.readinessProof.lifecycleCleanupProof.blockedUntilAcceptedMembership.includes('POST /v1/dwm/webhooks/deliver'))
assert.ok(readiness.readinessProof.lifecycleCleanupProof.affectedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
assert.ok(readiness.readinessProof.lifecycleCleanupProof.affectedConsumerContracts.includes('organization.audit_timeline_readiness.v1'))
assert.ok(readiness.readinessProof.lifecycleCleanupProof.requiredAuditActions.includes('organization_member_removed'))
assert.ok(readiness.readinessProof.lifecycleCleanupProof.requiredAuditActions.includes('organization_watchlist_cleanup_archived'))
assert.ok(readiness.readinessProof.lifecycleCleanupProof.lifecycleBlockers.includes('member_revoked'))
assert.ok(readiness.readinessProof.lifecycleCleanupProof.lifecycleBlockers.includes('cleanup_required'))
assert.equal(readiness.readinessProof.lifecycleCleanupProof.cleanupRequired, false)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.pendingInviteCount, 12)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.pausedWatchlistCount, 0)
assert.equal(readiness.readinessProof.lifecycleCleanupProof.archivedWatchlistCount, 0)
assert.ok(readiness.readinessProof.lifecycleCleanupProof.noLeakFields.includes('otherOrg.invites'))
assert.equal(readiness.readinessProof.lifecycleCleanupProof.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.schemaVersion, 'organization.ten_member_workspace_proof.v1')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.targetMemberCount, 10)
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.activeMemberCount, 4)
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.pendingInviteCount, 12)
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.acceptedOrInvitedCount, 16)
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.sharedWatchlistCount, 5)
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.activeWatchlistTermCount, 5)
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.canSupportTenMemberSharedWatchlistRollout, true)
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.inviteLifecycle, 'organization.invite_lifecycle_readiness_proof.v1')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.readinessRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.bulkInvite, 'POST /api/organizations/:id/invites')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.listMembers, 'GET /api/organizations/:id/members')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.createWatchlist, 'POST /api/organizations/:id/watchlists')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.routeRefs.webhookDeliver, 'POST /v1/dwm/webhooks/deliver')
assert.deepEqual(readiness.readinessProof.tenMemberWorkspaceProof.lifecycleBlockers, [])
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.noEnumerationFields.includes('otherOrg.members'))
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.noEnumerationFields.includes('destination.secret'))
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.schemaVersion, 'organization.ten_member_workspace_fixture.v1')
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.fixtureName, 'organization_watchlist')
assert.deepEqual(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.downstreamConsumers, ['alert_queue', 'case_workflow', 'webhook_delivery', 'dashboard_readiness', 'support_timeline'])
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.requiredOrganizationFields.includes('organizationId'))
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.requiredOrganizationFields.includes('ownerCount'))
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.requiredWatchlistFields.includes('watchlistItemId'))
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.requiredWatchlistFields.includes('alertGenerationRef'))
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.requiredWatchlistFields.includes('status'))
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.memberLifecycleBlockers.includes('member_revoked'))
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.memberLifecycleBlockers.includes('invite_expired'))
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.noEnumerationFields.includes('otherOrg.watchlistItemIds'))
assert.ok(readiness.readinessProof.tenMemberWorkspaceProof.fixtureBackedReadiness.noEnumerationFields.includes('destination.secret'))
assert.equal(readiness.readinessProof.tenMemberWorkspaceProof.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(readiness.readinessProof.alertGenerationHandoff.schemaVersion, 'organization.watchlist_alert_generation_handoff.v1')
assert.equal(readiness.readinessProof.alertGenerationHandoff.sourceContract, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(readiness.readinessProof.alertGenerationHandoff.fixtureContract, 'organization.watchlist_alert_generation_fixture.v1')
assert.equal(readiness.readinessProof.alertGenerationHandoff.route, 'organization_watchlist')
assert.equal(readiness.readinessProof.alertGenerationHandoff.exportRoute, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(readiness.readinessProof.alertGenerationHandoff.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
assert.equal(readiness.readinessProof.alertGenerationHandoff.organizationId, organization.id)
assert.equal(readiness.readinessProof.alertGenerationHandoff.tenantId, organization.id)
assert.equal(readiness.readinessProof.alertGenerationHandoff.activeTermCount, readiness.alertGenerationBridge.activeWatchlistTerms.length)
assert.deepEqual(
    readiness.readinessProof.alertGenerationHandoff.watchlistItemIds.sort(),
    readiness.alertGenerationBridge.activeWatchlistTerms.map((term: Row) => term.watchlistItemId).sort(),
)
assert.deepEqual(
    readiness.readinessProof.alertGenerationHandoff.alertGeneratorKeys.sort(),
    readiness.alertGenerationBridge.activeWatchlistTerms
        .map((term: Row) => `org:${organization.id}:watchlist:${term.watchlistItemId}:${term.termFamily}:${String(term.term).trim().toLowerCase()}`)
        .sort(),
)
assert.ok(readiness.readinessProof.alertGenerationHandoff.matchingInputFields.includes('alertGenerationRef'))
assert.ok(readiness.readinessProof.alertGenerationHandoff.expectedPersistedAlertFields.includes('workflowContext.organizationId'))
assert.ok(readiness.readinessProof.alertGenerationHandoff.expectedPersistedAlertFields.includes('casePath'))
assert.ok(readiness.readinessProof.alertGenerationHandoff.expectedCaseFields.includes('allowedActions'))
assert.deepEqual(readiness.readinessProof.alertGenerationHandoff.dedupeKeyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
assert.deepEqual(readiness.readinessProof.alertGenerationHandoff.replaySteps, ['export_alert_terms', 'match_capture_fixture', 'persist_org_alert', 'verify_case_visibility', 'deliver_webhook', 'archive_cleanup'])
assert.equal(readiness.readinessProof.alertGenerationHandoff.readinessRefs.alertQueue, 'organization.alert_queue_visibility_proof.v1')
assert.equal(readiness.readinessProof.alertGenerationHandoff.readinessRefs.caseAssignment, 'organization.case_assignment_readiness.v1')
assert.equal(readiness.readinessProof.alertGenerationHandoff.readinessRefs.destinationOwnership, 'organization.webhook_destination_ownership_readiness.v1')
assert.ok(readiness.readinessProof.alertGenerationHandoff.lifecycleBlockers.includes('watchlist_archived'))
assert.deepEqual(readiness.readinessProof.alertGenerationHandoff.blockerCodes, ['role_not_allowed'])
assert.equal(readiness.readinessProof.alertGenerationHandoff.crossOrgDedupeAllowed, false)
assert.equal(readiness.readinessProof.alertGenerationHandoff.nonmemberEnumeration, false)
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
assert.equal(readiness.readinessProof.customerWorkflowProof.schemaVersion, 'organization.customer_workflow_proof.v1')
assert.deepEqual(readiness.readinessProof.customerWorkflowProof.routeSequence, [
    'POST /api/organizations',
    'POST /api/organizations/:id/invites',
    'POST /api/organizations/invites/:inviteId/accept',
    'GET /api/organizations/:id/members',
    'POST /api/organizations/:id/watchlists',
    'GET /api/organizations/:id/watchlists/alert-terms',
    'GET /api/organizations/:id/alert-case-visibility',
    'POST /api/organizations/:id/watchlists/cleanup',
])
assert.ok(readiness.readinessProof.customerWorkflowProof.requiredOrgFields.includes('counts.activeAdminCount'))
assert.ok(readiness.readinessProof.customerWorkflowProof.requiredWatchlistFields.includes('alertGenerationRef'))
assert.ok(readiness.readinessProof.customerWorkflowProof.requiredAlertFields.includes('workflowContext.visibilityDecision'))
assert.equal(readiness.readinessProof.customerWorkflowProof.roleGates.ownerAdminMutate, true)
assert.equal(readiness.readinessProof.customerWorkflowProof.roleGates.memberReadExport, true)
assert.equal(readiness.readinessProof.customerWorkflowProof.roleGates.viewerReadOnly, true)
assert.equal(readiness.readinessProof.customerWorkflowProof.roleGates.nonmemberEnumeration, false)
assert.deepEqual(readiness.readinessProof.customerWorkflowProof.lifecycleBlockers, ['role_not_allowed'])
assert.deepEqual(readiness.readinessProof.customerWorkflowProof.downstreamConsumers, ['alert_queue', 'case_workflow', 'webhook_delivery', 'dashboard_readiness', 'support_timeline'])
assert.equal(readiness.readinessProof.customerWorkflowProof.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(readiness.readinessProof.auditTimelineProof.schemaVersion, 'organization.audit_timeline_readiness.v1')
assert.equal(readiness.readinessProof.auditTimelineProof.organizationId, organization.id)
assert.equal(readiness.readinessProof.auditTimelineProof.tenantId, organization.id)
assert.equal(readiness.readinessProof.auditTimelineProof.source, 'service_logs')
assert.equal(readiness.readinessProof.auditTimelineProof.supportRoute, '/api/admin/support/organizations/:id')
assert.equal(readiness.readinessProof.auditTimelineProof.logQuery, 'GET /api/logs?service=api&message=organization')
assert.ok(readiness.readinessProof.auditTimelineProof.requiredEventActions.includes('organization_invites_created'))
assert.ok(readiness.readinessProof.auditTimelineProof.requiredEventActions.includes('organization_member_removed'))
assert.ok(readiness.readinessProof.auditTimelineProof.requiredEventActions.includes('organization_watchlist_alert_terms_export_denied'))
assert.ok(readiness.readinessProof.auditTimelineProof.requiredEventActions.includes('organization_lifecycle_mutation_blocked'))
assert.ok(readiness.readinessProof.auditTimelineProof.requiredMetadataFields.includes('requestId'))
assert.ok(readiness.readinessProof.auditTimelineProof.requiredMetadataFields.includes('watchlistItemId'))
assert.ok(readiness.readinessProof.auditTimelineProof.requiredMetadataFields.includes('blockerCode'))
assert.ok(readiness.readinessProof.auditTimelineProof.downstreamCorrelationFields.includes('alertGeneratorKeys'))
assert.ok(readiness.readinessProof.auditTimelineProof.downstreamCorrelationFields.includes('webhookDestinationIds'))
assert.ok(readiness.readinessProof.auditTimelineProof.lifecycleBlockers.includes('member_revoked'))
assert.ok(readiness.readinessProof.auditTimelineProof.lifecycleBlockers.includes('watchlist_archived'))
assert.equal(readiness.readinessProof.auditTimelineProof.supportReadMode, 'redacted_summary_only')
assert.ok(readiness.readinessProof.auditTimelineProof.noLeakFields.includes('otherOrg.auditEvents'))
assert.equal(readiness.readinessProof.auditTimelineProof.nonmemberEnumeration, false)
assert.equal(readiness.readinessProof.auditTimelineProof.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(readiness.sharedWatchlistDownstreamProof.schemaVersion, 'organization.shared_watchlist_downstream_proof.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.actor.userId, 'org_smoke_member')
assert.equal(readiness.sharedWatchlistDownstreamProof.actor.role, 'member')
assert.equal(readiness.sharedWatchlistDownstreamProof.actor.canManageWatchlists, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.actor.canExportActiveTerms, false)
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.actor.allowedActions, ['acknowledge_alert'])
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.caseBridge.blockerCodes, ['role_not_allowed'])
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.alertBridge.blockerCodes, [])
assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.schemaVersion, 'organization.shared_watchlist_monitoring_workflow.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.organizationId, organization.id)
assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.persistenceLevel, 'organization_persisted')
assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.entrypoint.route, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_queue_visibility').state, 'blocked')
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_queue_visibility').blockerCodes, ['role_not_allowed'])
assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.operatorActions.acknowledgeAlert, true)
assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.operatorActions.linkCase, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.monitoringWorkflow.evidenceContract.containsRawTerms, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.schemaVersion, 'organization.shared_watchlist_analyst_portal_workflow.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.state, 'blocked')
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.blockerCodes, ['role_not_allowed'])
assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.actorRole, 'member')
assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.readAlertsAllowed, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.caseActionsAllowed, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.analystPortalWorkflow.detailContract.containsRawTerms, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.schemaVersion, 'organization.shared_watchlist_enrichment_provenance.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.state, 'ready')
assert.deepEqual(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.activeFamilies, ['organization_watchlist'])
assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.schemaVersion, 'organization.shared_watchlist_source_coverage_health.v1')
assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.state, 'ready')
assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.find((row: Row) => row.sourceFamily === 'organization_watchlist').status, 'covered')
assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.redaction.containsRawContent, false)
assert.equal(readiness.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.crossTenantCollisionAllowed, false)
const memberPortalVisibility = orgUtils.organizationAnalystPortalVisibilityAdapter(readiness.sharedWatchlistDownstreamProof, readiness.downstreamAuthorization)
assert.equal(memberPortalVisibility.schemaVersion, 'organization.analyst_portal_visibility_adapter.v1')
assert.equal(memberPortalVisibility.organizationId, organization.id)
assert.equal(memberPortalVisibility.member.role, 'member')
assert.equal(memberPortalVisibility.actionMatrix.review_alert.allowed, false)
assert.deepEqual(memberPortalVisibility.actionMatrix.review_alert.blockerCodes, ['role_not_allowed'])
assert.equal(memberPortalVisibility.actionMatrix.acknowledge_alert.allowed, false)
assert.equal(memberPortalVisibility.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(memberPortalVisibility.redaction.nonmemberEnumeration, false)
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
assert.equal(readiness.sharedWatchlistDownstreamProof.inviteLifecycle.pendingInviteCount, 12)
assert.ok(readiness.sharedWatchlistDownstreamProof.audit.eventActions.includes('organization_watchlist_alert_terms_exported'))

const memberAlertCaseVisibilityResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-case-visibility?requestId=smoke-member-alert-case-denied`,
    headers: authHeaders('org_smoke_member', 'member-token'),
})
assert.equal(memberAlertCaseVisibilityResponse.statusCode, 403, memberAlertCaseVisibilityResponse.body)
const memberAlertCaseVisibility = parseBody(memberAlertCaseVisibilityResponse.body).alertCaseVisibility
assert.equal(memberAlertCaseVisibility.schemaVersion, 'organization.alert_case_visibility_denial.v1')
assert.equal(memberAlertCaseVisibility.organizationId, organization.id)
assert.equal(memberAlertCaseVisibility.tenantId, organization.id)
assert.deepEqual(memberAlertCaseVisibility.member, {
    userId: 'org_smoke_member',
    role: 'member',
    status: 'active',
})
assert.equal(memberAlertCaseVisibility.visibility.allowed, false)
assert.equal(memberAlertCaseVisibility.visibility.reason, 'role_not_allowed')
assert.deepEqual(memberAlertCaseVisibility.visibility.allowedRoles, ['owner', 'admin'])
assert.equal(memberAlertCaseVisibility.routes.alertList, 'GET /v1/dwm/alerts?organizationId=:organizationId')
assert.equal(memberAlertCaseVisibility.routes.caseList, 'GET /v1/cases?organizationId=:organizationId')
assert.equal(memberAlertCaseVisibility.routes.webhookDelivery, 'POST /v1/dwm/webhooks/deliver')
assert.deepEqual(memberAlertCaseVisibility.requiredQueryFields, ['organizationId'])
assert.ok(memberAlertCaseVisibility.safeFields.includes('visibility.reason'))
assert.ok(memberAlertCaseVisibility.redactedFields.includes('watchlistScope.alertGeneratorKeys'))
assert.ok(memberAlertCaseVisibility.redactedFields.includes('case.evidence.rawContent'))
assert.deepEqual(memberAlertCaseVisibility.blockerCodes, ['role_not_allowed'])
assert.equal(memberAlertCaseVisibility.readinessRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(memberAlertCaseVisibility.readinessRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(memberAlertCaseVisibility.readinessRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
assert.equal(memberAlertCaseVisibility.readinessRefs.caseVisibilityConsumer, 'organization.case_visibility_consumer.v1')
assert.equal(memberAlertCaseVisibility.readinessRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
assert.equal(memberAlertCaseVisibility.deniedReadDoesNotAffectCases, true)
assert.equal(memberAlertCaseVisibility.deniedReadDoesNotAffectActiveTerms, true)
assert.equal(memberAlertCaseVisibility.nonmemberEnumeration, false)
assert.equal(memberAlertCaseVisibility.analystPortalAdapter.schemaVersion, 'organization.analyst_portal_visibility_denial_adapter.v1')
assert.equal(memberAlertCaseVisibility.analystPortalAdapter.memberRole, 'member')
assert.deepEqual(memberAlertCaseVisibility.analystPortalAdapter.allowedActions, [])
assert.equal(memberAlertCaseVisibility.analystPortalAdapter.actionMatrix.review_alert.denialReason, 'role_not_allowed')
assert.equal(memberAlertCaseVisibility.analystPortalAdapter.actionMatrix.assign_case.allowed, false)
assert.ok(memberAlertCaseVisibility.analystPortalAdapter.redactedFields.includes('watchlistScope.alertGeneratorKeys'))
assert.equal(memberAlertCaseVisibility.analystPortalAdapter.nonmemberEnumeration, false)
assert.equal(memberAlertCaseVisibility.auditProof.schemaVersion, 'organization.alert_case_visibility_denial_audit.v1')
assert.equal(memberAlertCaseVisibility.auditProof.organizationId, organization.id)
assert.equal(memberAlertCaseVisibility.auditProof.tenantId, organization.id)
assert.equal(memberAlertCaseVisibility.auditProof.memberRole, 'member')
assert.equal(memberAlertCaseVisibility.auditProof.serviceLogAction, 'organization_alert_case_visibility_denied')
assert.equal(memberAlertCaseVisibility.auditProof.requestId, 'smoke-member-alert-case-denied')
assert.ok(memberAlertCaseVisibility.auditProof.requiredMetadataFields.includes('allowedRoles'))
assert.ok(memberAlertCaseVisibility.auditProof.requiredMetadataFields.includes('denialReason'))
assert.ok(memberAlertCaseVisibility.auditProof.redactedFields.includes('destination.secret'))
assert.equal(memberAlertCaseVisibility.auditProof.proofLogQuery, 'GET /api/logs?service=api&message=organization_alert_case_visibility_denied')
assert.equal(memberAlertCaseVisibility.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

const outsiderAlertCaseVisibilityResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-case-visibility`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(outsiderAlertCaseVisibilityResponse.statusCode, 404, outsiderAlertCaseVisibilityResponse.body)

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
assert.deepEqual(adminReadiness.readinessProof.customerWorkflowProof.lifecycleBlockers, [])
assert.equal(adminReadiness.readinessProof.customerWorkflowProof.roleGates.memberReadExport, true)
assert.equal(adminReadiness.readinessProof.webhookDeliveryProof.canUseDefaultDestinations, false)
assert.deepEqual(adminReadiness.readinessProof.webhookDeliveryProof.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(adminReadiness.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms, true)
assert.deepEqual(adminReadiness.downstreamAuthorization.downstream.alertGeneration.blockerCodes, [])
assert.equal(adminReadiness.sharedWatchlistDownstreamProof.actor.canManageWatchlists, true)
assert.equal(adminReadiness.sharedWatchlistDownstreamProof.actor.canExportActiveTerms, true)
assert.deepEqual(adminReadiness.sharedWatchlistDownstreamProof.caseBridge.blockerCodes, [])
assert.deepEqual(adminReadiness.sharedWatchlistDownstreamProof.alertBridge.blockerCodes, [])

const adminAlertCaseVisibilityResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-case-visibility`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(adminAlertCaseVisibilityResponse.statusCode, 200, adminAlertCaseVisibilityResponse.body)
const adminAlertCaseVisibility = parseBody(adminAlertCaseVisibilityResponse.body).alertCaseVisibility
assert.equal(adminAlertCaseVisibility.schemaVersion, 'organization.alert_case_visibility.v1')
assert.equal(adminAlertCaseVisibility.organizationId, organization.id)
assert.equal(adminAlertCaseVisibility.tenantId, organization.id)
assert.deepEqual(adminAlertCaseVisibility.member, {
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
})
assert.equal(adminAlertCaseVisibility.visibility.allowed, true)
assert.equal(adminAlertCaseVisibility.routes.alertList, 'GET /v1/dwm/alerts?organizationId=:organizationId')
assert.equal(adminAlertCaseVisibility.routes.caseList, 'GET /v1/cases?organizationId=:organizationId')
assert.deepEqual(adminAlertCaseVisibility.requiredQueryFields, ['organizationId'])
assert.ok(adminAlertCaseVisibility.allowedActions.includes('acknowledge_alert'))
assert.ok(adminAlertCaseVisibility.allowedActions.includes('assign_case'))
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.schemaVersion, 'organization.analyst_portal_visibility_adapter.v1')
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.organizationId, organization.id)
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.tenantId, organization.id)
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.sourceFamily, 'organization_watchlist')
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.member.userId, 'org_smoke_admin')
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.member.role, 'admin')
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.member.status, 'active')
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.member.canManageWatchlists, true)
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.member.canExportActiveTerms, true)
assert.ok(adminAlertCaseVisibility.analystPortalAdapter.member.allowedActions.includes('manage_invites'))
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.routeBindings.alertList, 'GET /v1/dwm/alerts?organizationId=:organizationId')
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.routeBindings.webhookDelivery, 'POST /v1/dwm/webhooks/deliver')
assert.ok(adminAlertCaseVisibility.analystPortalAdapter.requiredIdentityFields.includes('workflowContext.visibilityDecision'))
assert.deepEqual(adminAlertCaseVisibility.analystPortalAdapter.watchlistScope.activeWatchlistItemIds.sort(), adminReadiness.alertGenerationBridge.activeWatchlistTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(adminAlertCaseVisibility.analystPortalAdapter.watchlistScope.alertGeneratorKeys.sort(), adminReadiness.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys.sort())
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.watchlistScope.crossTenantCollisionAllowed, false)
assert.ok(adminAlertCaseVisibility.analystPortalAdapter.allowedActions.includes('review_alert'))
assert.ok(adminAlertCaseVisibility.analystPortalAdapter.allowedActions.includes('assign_case'))
assert.ok(adminAlertCaseVisibility.analystPortalAdapter.allowedActions.includes('open_audit_timeline'))
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.actionMatrix.assign_case.allowed, true)
assert.deepEqual(adminAlertCaseVisibility.analystPortalAdapter.actionMatrix.assign_case.blockerCodes, [])
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.actionMatrix.deliver_webhook.allowed, false)
assert.deepEqual(adminAlertCaseVisibility.analystPortalAdapter.actionMatrix.deliver_webhook.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.consumerProof.alertQueueAdapter, 'organizationSharedWatchlistAlertQueueVisibility')
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.consumerProof.caseWorkflowAdapter, 'organization.watchlist_case_workflow_contract.v1')
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.consumerProof.webhookGuardrailAdapter, 'organizationSharedWatchlistWebhookDeliveryGuardrails')
assert.ok(adminAlertCaseVisibility.analystPortalAdapter.redaction.redactedFields.includes('otherOrg.alertGeneratorKeys'))
assert.equal(adminAlertCaseVisibility.analystPortalAdapter.redaction.nonmemberEnumeration, false)
assert.equal(adminAlertCaseVisibility.workflowState.schemaVersion, 'organization.alert_case_workflow_state.v1')
assert.equal(adminAlertCaseVisibility.workflowState.organizationId, organization.id)
assert.equal(adminAlertCaseVisibility.workflowState.tenantId, organization.id)
assert.equal(adminAlertCaseVisibility.workflowState.sourceFamily, 'organization_watchlist')
assert.equal(adminAlertCaseVisibility.workflowState.member.userId, 'org_smoke_admin')
assert.equal(adminAlertCaseVisibility.workflowState.member.role, 'admin')
assert.equal(adminAlertCaseVisibility.workflowState.visibility.allowed, true)
assert.equal(adminAlertCaseVisibility.workflowState.alertRecord.route, 'GET /v1/dwm/alerts')
assert.deepEqual(adminAlertCaseVisibility.workflowState.alertRecord.requiredQueryFields, ['organizationId'])
assert.ok(adminAlertCaseVisibility.workflowState.alertRecord.requiredPersistedFields.includes('ownerOrganizationId'))
assert.ok(adminAlertCaseVisibility.workflowState.alertRecord.requiredPersistedFields.includes('sourceFamily'))
assert.ok(adminAlertCaseVisibility.workflowState.alertRecord.requiredPersistedFields.includes('watchlist.ownerOrganizationId'))
assert.ok(adminAlertCaseVisibility.workflowState.alertRecord.requiredPersistedFields.includes('matchedTerm.termFamily'))
assert.ok(adminAlertCaseVisibility.workflowState.alertRecord.requiredPersistedFields.includes('matchedTerm.term'))
assert.ok(adminAlertCaseVisibility.workflowState.alertRecord.requiredPersistedFields.includes('workflowContext.visibilityDecision'))
assert.deepEqual(adminAlertCaseVisibility.workflowState.alertRecord.watchlistItemIds.sort(), adminReadiness.alertGenerationBridge.activeWatchlistTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(adminAlertCaseVisibility.workflowState.alertRecord.alertGeneratorKeys.sort(), adminReadiness.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys.sort())
assert.equal(adminAlertCaseVisibility.workflowState.alertRecord.dedupeScope, 'organization_watchlist_term')
assert.equal(adminAlertCaseVisibility.workflowState.alertRecord.crossTenantCollisionAllowed, false)
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.schemaVersion, 'organization.alert_listing_contract.v1')
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.routes.list, 'GET /v1/dwm/alerts')
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.routes.detail, 'GET /v1/dwm/alerts/:id')
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.routes.update, 'PATCH /v1/dwm/alerts/:id')
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.routes.replay, 'POST /v1/dwm/alerts/:id/replay')
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.requiredFilters.organizationId, organization.id)
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.requiredFilters.tenantId, organization.id)
assert.deepEqual(adminAlertCaseVisibility.workflowState.alertListing.requiredFilters.watchlistItemIds.sort(), adminAlertCaseVisibility.workflowState.alertRecord.watchlistItemIds.sort())
assert.deepEqual(adminAlertCaseVisibility.workflowState.alertListing.requiredFilters.alertGeneratorKeys.sort(), adminAlertCaseVisibility.workflowState.alertRecord.alertGeneratorKeys.sort())
assert.deepEqual(adminAlertCaseVisibility.workflowState.alertListing.requiredFilters.lifecycleStatuses, ['active'])
assert.ok(adminAlertCaseVisibility.workflowState.alertListing.responseFields.includes('ownerOrganizationId'))
assert.ok(adminAlertCaseVisibility.workflowState.alertListing.responseFields.includes('sourceFamily'))
assert.ok(adminAlertCaseVisibility.workflowState.alertListing.responseFields.includes('matchedTerm.termFamily'))
assert.ok(adminAlertCaseVisibility.workflowState.alertListing.responseFields.includes('workflowContext.visibilityDecision'))
assert.ok(adminAlertCaseVisibility.workflowState.alertListing.responseFields.includes('casePath'))
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.actionGates.readAlertsAllowed, true)
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.actionGates.assignAllowed, true)
assert.ok(adminAlertCaseVisibility.workflowState.alertListing.allowedActions.includes('assign_case'))
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.deniedResponse.schemaVersion, 'organization.alert_listing_denial.v1')
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.deniedResponse.statusCode, 403)
assert.equal(adminAlertCaseVisibility.workflowState.alertListing.deniedResponse.nonmemberEnumeration, false)
assert.ok(adminAlertCaseVisibility.workflowState.alertListing.deniedResponse.redactedFields.includes('watchlistScope.alertGeneratorKeys'))
assert.deepEqual(adminAlertCaseVisibility.workflowState.alertListing.deniedResponse.blockerCodes, [])
assert.ok(adminAlertCaseVisibility.workflowState.alertListing.proofAssertions.includes('cross_org_dedupe_disallowed'))
assert.equal(adminAlertCaseVisibility.workflowState.caseRecord.route, 'GET /v1/cases')
assert.equal(adminAlertCaseVisibility.workflowState.caseRecord.casePathTemplate, '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
assert.ok(adminAlertCaseVisibility.workflowState.caseRecord.requiredPersistedFields.includes('visibilityDecision'))
assert.deepEqual(adminAlertCaseVisibility.workflowState.caseRecord.watchlistItemIds.sort(), adminAlertCaseVisibility.workflowState.alertRecord.watchlistItemIds.sort())
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.schemaVersion, 'organization.case_assignment_visibility.v1')
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.route, 'PATCH /v1/cases/:id')
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.organizationId, organization.id)
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.tenantId, organization.id)
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.sourceFamily, 'organization_watchlist')
assert.ok(adminAlertCaseVisibility.workflowState.caseAssignment.requiredPayloadFields.includes('organizationId'))
assert.ok(adminAlertCaseVisibility.workflowState.caseAssignment.requiredPayloadFields.includes('assigneeId'))
assert.ok(adminAlertCaseVisibility.workflowState.caseAssignment.requiredPersistedFields.includes('case.assignmentAudit.requestId'))
assert.deepEqual(adminAlertCaseVisibility.workflowState.caseAssignment.watchlistScope.watchlistItemIds.sort(), adminAlertCaseVisibility.workflowState.alertRecord.watchlistItemIds.sort())
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.allowed, true)
assert.deepEqual(adminAlertCaseVisibility.workflowState.caseAssignment.allowedRoles, ['owner', 'admin', 'analyst'])
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.actorRole, 'admin')
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.denialReason, null)
assert.deepEqual(adminAlertCaseVisibility.workflowState.caseAssignment.blockerCodes, [])
assert.ok(adminAlertCaseVisibility.workflowState.caseAssignment.memberLifecycleBlockers.includes('member_revoked'))
assert.ok(adminAlertCaseVisibility.workflowState.caseAssignment.memberLifecycleBlockers.includes('invite_expired'))
assert.ok(adminAlertCaseVisibility.workflowState.caseAssignment.noEnumerationFields.includes('otherOrg.caseIds'))
assert.ok(adminAlertCaseVisibility.workflowState.caseAssignment.noEnumerationFields.includes('case.evidence.rawContent'))
assert.equal(adminAlertCaseVisibility.workflowState.caseAssignment.auditEventAction, 'organization_case_assignment_visibility_checked')
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.schemaVersion, 'organization.webhook_destination_ownership.v1')
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.route, 'POST /v1/dwm/webhooks/deliver')
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.organizationId, organization.id)
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.tenantId, organization.id)
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.eventType, 'dwm.alert')
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.policy, 'manual_selection')
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.selectedDestinationSource, 'manual_selection_required')
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.requiredDestinationOrgId, organization.id)
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.selectedDestinationOrgField, 'destination.org_id')
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.selectedDestinationIdField, 'webhookDestinationIds[]')
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.nonmemberDestinationEnumeration, false)
assert.deepEqual(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.idempotency.keyFields, ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'])
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.roleGates.manualTriggerAllowed, true)
assert.equal(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.roleGates.memberManualTriggerAllowed, false)
assert.ok(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.requiredAlertFields.includes('alert.organizationId'))
assert.ok(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.requiredDeliveryFields.includes('destinationId'))
assert.ok(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.redactedFields.includes('destination.secret'))
assert.deepEqual(adminAlertCaseVisibility.workflowState.webhookDestinationOwnership.blockerCodes, ['manual_webhook_selection_required'])
assert.ok(adminAlertCaseVisibility.workflowState.allowedActions.includes('assign_case'))
assert.equal(adminAlertCaseVisibility.workflowState.actionMatrix.assign_case.allowed, true)
assert.deepEqual(adminAlertCaseVisibility.workflowState.lifecycleBlockers, [])
assert.equal(adminAlertCaseVisibility.workflowState.guardrails.nonmemberEnumeration, false)
assert.ok(adminAlertCaseVisibility.workflowState.guardrails.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
assert.equal(adminAlertCaseVisibility.workflowState.guardrails.denialAuditEvent, 'organization_watchlist_alert_visibility_denied')
assert.equal(adminAlertCaseVisibility.alertQueue.route, 'GET /v1/dwm/alerts')
assert.deepEqual(adminAlertCaseVisibility.alertQueue.requiredQueryFields, ['organizationId'])
assert.deepEqual(adminAlertCaseVisibility.alertQueue.watchlistItemIds.sort(), adminReadiness.alertGenerationBridge.activeWatchlistTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(adminAlertCaseVisibility.alertQueue.alertGeneratorKeys.sort(), adminReadiness.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys.sort())
assert.equal(adminAlertCaseVisibility.alertQueue.actionGates.readAlertsAllowed, true)
assert.equal(adminAlertCaseVisibility.alertQueue.actionGates.assignAllowed, true)
assert.deepEqual(adminAlertCaseVisibility.alertQueue.blockerCodes, [])
assert.equal(adminAlertCaseVisibility.caseWorkflow.route, 'GET /v1/cases')
assert.equal(adminAlertCaseVisibility.caseWorkflow.casePathTemplate, '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
assert.deepEqual(adminAlertCaseVisibility.caseWorkflow.requiredQueryFields, ['organizationId'])
assert.deepEqual(adminAlertCaseVisibility.caseWorkflow.watchlistItemIds.sort(), adminAlertCaseVisibility.alertQueue.watchlistItemIds.sort())
assert.deepEqual(adminAlertCaseVisibility.caseWorkflow.alertGeneratorKeys.sort(), adminAlertCaseVisibility.alertQueue.alertGeneratorKeys.sort())
assert.equal(adminAlertCaseVisibility.caseWorkflow.actorActions.canReadCases, true)
assert.equal(adminAlertCaseVisibility.caseWorkflow.actorActions.canAssignCase, true)
assert.deepEqual(adminAlertCaseVisibility.caseWorkflow.blockerCodes, [])
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.schemaVersion, 'organization.case_visibility_consumer.v1')
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.organizationId, organization.id)
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.tenantId, organization.id)
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.sourceFamily, 'organization_watchlist')
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.route, 'GET /api/organizations/:id/alert-case-visibility')
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.downstreamRoutes.caseList, 'GET /v1/cases')
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.downstreamRoutes.alertList, 'GET /v1/dwm/alerts')
assert.deepEqual(adminAlertCaseVisibility.caseVisibilityConsumer.requiredQueryFields, ['organizationId'])
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.casePathTemplate, '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.member.role, 'admin')
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.member.canReadCases, true)
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.member.canOpenCase, true)
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.member.canAssignCase, true)
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.member.denialReason, null)
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.ownerOrganizationId, organization.id)
assert.deepEqual(adminAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.watchlistItemIds.sort(), adminAlertCaseVisibility.caseWorkflow.watchlistItemIds.sort())
assert.deepEqual(adminAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.alertGeneratorKeys.sort(), adminAlertCaseVisibility.caseWorkflow.alertGeneratorKeys.sort())
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.evidenceRefField, 'case.evidence.watchlistItemIds[]')
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.crossTenantCollisionAllowed, false)
assert.deepEqual(adminAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.lifecycleStatuses, ['active'])
assert.ok(adminAlertCaseVisibility.caseVisibilityConsumer.requiredPersistedFields.includes('evidence.provenance'))
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.denialContract.statusCode, 403)
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.denialContract.nonmemberEnumeration, false)
assert.ok(adminAlertCaseVisibility.caseVisibilityConsumer.denialContract.redactedFields.includes('case.evidence.rawContent'))
assert.ok(adminAlertCaseVisibility.caseVisibilityConsumer.noLeakFields.includes('otherOrg.caseIds'))
assert.equal(adminAlertCaseVisibility.caseVisibilityConsumer.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.schemaVersion, 'organization.alert_case_persistence_readiness.v1')
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.organizationId, organization.id)
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.tenantId, organization.id)
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.sourceFamily, 'organization_watchlist')
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.alertPersistenceContract, 'organization.watchlist_alert_persistence_contract.v1')
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.caseWorkflowContract, 'organization.watchlist_case_workflow_contract.v1')
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.storageModule, 'ti/scraper/src/storage/dwmAlertRepository.ts')
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.alertUpsertFunction, 'upsertDwmAlert')
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.alertRoute, 'organization_watchlist')
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.caseRoute, 'POST /v1/cases')
assert.deepEqual(adminAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.watchlistItemIds.sort(), adminAlertCaseVisibility.caseWorkflow.watchlistItemIds.sort())
assert.deepEqual(adminAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.alertGeneratorKeys.sort(), adminAlertCaseVisibility.caseWorkflow.alertGeneratorKeys.sort())
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.crossTenantCollisionAllowed, false)
assert.ok(adminAlertCaseVisibility.alertCasePersistenceReadiness.requiredAlertFields.includes('workflowContext.organizationId'))
assert.ok(adminAlertCaseVisibility.alertCasePersistenceReadiness.requiredCaseFields.includes('casePath'))
assert.ok(adminAlertCaseVisibility.alertCasePersistenceReadiness.workflowContextFields.includes('watchlistTermContexts'))
assert.deepEqual(adminAlertCaseVisibility.alertCasePersistenceReadiness.dedupe.keyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.dedupe.crossTenantCollisionAllowed, false)
assert.ok(adminAlertCaseVisibility.alertCasePersistenceReadiness.lifecycleBlockers.includes('member_revoked'))
assert.ok(adminAlertCaseVisibility.alertCasePersistenceReadiness.actorActions.includes('assign_case'))
assert.deepEqual(adminAlertCaseVisibility.alertCasePersistenceReadiness.blockerCodes, [])
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.readyForPersistence, true)
assert.equal(adminAlertCaseVisibility.alertCasePersistenceReadiness.nonmemberEnumeration, false)
assert.equal(adminAlertCaseVisibility.guardrails.schemaVersion, 'organization.alert_case_visibility_guardrails.v1')
assert.equal(adminAlertCaseVisibility.guardrails.partitionKey, 'organizationId')
assert.equal(adminAlertCaseVisibility.guardrails.tenantIdField, 'tenantId')
assert.ok(adminAlertCaseVisibility.guardrails.requiredWorkflowContextFields.includes('workflowContext.visibilityDecision'))
assert.equal(adminAlertCaseVisibility.guardrails.crossTenantCollisionAllowed, false)
assert.equal(adminAlertCaseVisibility.guardrails.nonmemberEnumeration, false)
assert.ok(adminAlertCaseVisibility.guardrails.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
assert.ok(adminAlertCaseVisibility.guardrails.lifecycleBlockers.includes('org_archived'))
assert.equal(adminAlertCaseVisibility.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
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
assert.equal(alertTermsExport.webhookDestinationOwnership.schemaVersion, 'organization.webhook_destination_ownership.v1')
assert.equal(alertTermsExport.webhookDestinationOwnership.route, 'POST /v1/dwm/webhooks/deliver')
assert.equal(alertTermsExport.webhookDestinationOwnership.eventType, 'dwm.alert')
assert.equal(alertTermsExport.webhookDestinationOwnership.organizationId, organization.id)
assert.equal(alertTermsExport.webhookDestinationOwnership.tenantId, organization.id)
assert.equal(alertTermsExport.webhookDestinationOwnership.requiredDestinationOrgId, organization.id)
assert.equal(alertTermsExport.webhookDestinationOwnership.policy, 'manual_selection')
assert.equal(alertTermsExport.webhookDestinationOwnership.selectedDestinationSource, 'manual_selection_required')
assert.equal(alertTermsExport.webhookDestinationOwnership.selectedDestinationOrgField, 'destination.org_id')
assert.equal(alertTermsExport.webhookDestinationOwnership.selectedDestinationIdField, 'webhookDestinationIds[]')
assert.equal(alertTermsExport.webhookDestinationOwnership.nonmemberDestinationEnumeration, false)
assert.deepEqual(alertTermsExport.webhookDestinationOwnership.idempotency.keyFields, ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'])
assert.deepEqual(alertTermsExport.webhookDestinationOwnership.roleGates.manualTriggerAllowedRoles, ['owner', 'admin'])
assert.equal(alertTermsExport.webhookDestinationOwnership.roleGates.memberManualTriggerAllowed, false)
assert.ok(alertTermsExport.webhookDestinationOwnership.requiredAlertFields.includes('alert.organizationId'))
assert.ok(alertTermsExport.webhookDestinationOwnership.requiredAlertFields.includes('alert.watchlistItemIds'))
assert.ok(alertTermsExport.webhookDestinationOwnership.requiredDeliveryFields.includes('destinationId'))
assert.ok(alertTermsExport.webhookDestinationOwnership.redactedFields.includes('destination.secret'))
assert.equal(alertTermsExport.webhookDestinationAccessDecision.schemaVersion, 'organization.webhook_destination_access_decision.v1')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.organizationId, organization.id)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.tenantId, organization.id)
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.member, { userId: 'org_smoke_admin', role: 'admin', status: 'active' })
assert.equal(alertTermsExport.webhookDestinationAccessDecision.route, 'POST /v1/dwm/webhooks/deliver')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.destinationScope.requiredDestinationOrgId, organization.id)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.destinationScope.selectedDestinationOrgField, 'destination.org_id')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.destinationScope.crossOrgDestinationAllowed, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.destinationScope.nonmemberDestinationEnumeration, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.allowedActions.automaticDelivery, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.allowedActions.manualTrigger, true)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.allowedActions.configureDestination, true)
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.roleGates.manualTrigger, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.roleGates.configureDestination, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.roleGates.readDeliverySummary, ['owner', 'admin', 'member', 'viewer'])
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.blockerCodes, ['manual_webhook_selection_required'])
assert.ok(alertTermsExport.webhookDestinationAccessDecision.requiredAlertFields.includes('alert.organizationId'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.requiredDeliveryFields.includes('destinationId'))
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.schemaVersion, 'organization.webhook_destination_delivery_input.v1')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.organizationId, organization.id)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.tenantId, organization.id)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.route, 'POST /v1/dwm/webhooks/deliver')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.eventType, 'dwm.alert')
assert.ok(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.requiredAlertFields.includes('alert.organizationId'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.requiredAlertFields.includes('alert.workflowContext.alertGeneratorKeys'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.requiredDestinationFields.includes('destination.org_id'))
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.selectedDestinationOrgField, 'destination.org_id')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.selectedDestinationIdField, 'webhookDestinationIds[]')
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.idempotencyKeyFields, ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'])
assert.ok(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.lifecycleBlockers.includes('member_revoked'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.lifecycleBlockers.includes('manual_webhook_selection_required'))
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.crossOrgDestinationAllowed, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.nonmemberDestinationEnumeration, false)
assert.ok(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.noLeakFields.includes('destination.secret'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.noLeakFields.includes('otherOrg.destinationIds'))
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.schemaVersion, 'organization.webhook_destination_dry_run_visibility.v1')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.organizationId, organization.id)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.tenantId, organization.id)
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.actor, { userId: 'org_smoke_admin', role: 'admin', status: 'active' })
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.allowed, true)
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.allowedRoles, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.summaryVisibleRoles, ['owner', 'admin', 'member', 'viewer'])
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.deniedRoles, ['member', 'viewer'])
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.requiredDestinationOrgId, organization.id)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.selectedDestinationOrgField, 'destination.org_id')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.crossOrgDestinationAllowed, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.nonmemberDestinationEnumeration, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.destinationDeliveryReady, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.dryRunAllowed, true)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.manualSelectionRequired, true)
assert.ok(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.blockerCodes.includes('manual_webhook_selection_required'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.requiredAlertFields.includes('alert.organizationId'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.requiredDestinationFields.includes('destination.org_id'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.noLeakFields.includes('destination.secret'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.noLeakFields.includes('otherOrg.destinationIds'))
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.schemaVersion, 'organization.webhook_alert_delivery_readiness.v1')
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.organizationId, organization.id)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.tenantId, organization.id)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.sourceFamily, 'organization_watchlist')
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.provenanceHashes.sort(), alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenanceHash).sort())
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.crossOrgDeliveryAllowed, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.workflowState.alertGenerationReady, true)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.workflowState.caseReplayReady, true)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.workflowState.destinationDeliveryReady, false)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.workflowState.dryRunReady, true)
assert.equal(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.deliveryContract.selectedDestinationOrgField, 'destination.org_id')
assert.deepEqual(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.deliveryContract.idempotencyKeyFields, ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'])
assert.ok(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.blockerCodes.includes('manual_webhook_selection_required'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.noLeakFields.includes('case.evidence.rawContent'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.proofAssertions.includes('destination_org_matches_alert_org'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.proofAssertions.includes('member_viewer_cannot_configure_destination'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.noLeakFields.includes('otherOrg.destinationIds'))
assert.ok(alertTermsExport.webhookDestinationAccessDecision.noLeakFields.includes('destination.secret'))
assert.equal(alertTermsExport.consumerReadiness.schemaVersion, 'organization.shared_watchlist_consumer_readiness.v1')
assert.equal(alertTermsExport.consumerReadiness.organizationId, organization.id)
assert.equal(alertTermsExport.consumerReadiness.tenantId, organization.id)
assert.equal(alertTermsExport.consumerReadiness.sourceFamily, 'organization_watchlist')
assert.deepEqual(alertTermsExport.consumerReadiness.member, { userId: 'org_smoke_admin', role: 'admin', status: 'active' })
assert.equal(alertTermsExport.consumerReadiness.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(alertTermsExport.consumerReadiness.routes.alertList, 'GET /v1/dwm/alerts')
assert.equal(alertTermsExport.consumerReadiness.routes.alertReplay, 'POST /v1/dwm/alerts/:id/replay')
assert.equal(alertTermsExport.consumerReadiness.routes.caseList, 'GET /v1/cases')
assert.equal(alertTermsExport.consumerReadiness.routes.webhookDeliver, 'POST /v1/dwm/webhooks/deliver')
assert.equal(alertTermsExport.consumerReadiness.routes.dashboardReadiness, 'GET /api/organizations/:id/alert-readiness')
assert.equal(alertTermsExport.consumerReadiness.watchlists.activeCount, 5)
assert.deepEqual(alertTermsExport.consumerReadiness.watchlists.activeIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.consumerReadiness.watchlists.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.consumerReadiness.watchlists.crossTenantCollisionAllowed, false)
assert.equal(alertTermsExport.consumerReadiness.readiness.alertQueueReady, true)
assert.equal(alertTermsExport.consumerReadiness.readiness.caseWorkflowReady, true)
assert.equal(alertTermsExport.consumerReadiness.readiness.webhookDeliveryReady, false)
assert.equal(alertTermsExport.consumerReadiness.readiness.supportRedactedReadReady, true)
assert.equal(alertTermsExport.consumerReadiness.readiness.dashboardReadinessReady, true)
assert.deepEqual(alertTermsExport.consumerReadiness.roleGates.mutateWatchlists, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.consumerReadiness.roleGates.manualWebhookTrigger, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.consumerReadiness.roleGates.assignCase, ['owner', 'admin', 'analyst'])
assert.ok(alertTermsExport.consumerReadiness.blockers.includes('manual_webhook_selection_required'))
assert.ok(alertTermsExport.consumerReadiness.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
assert.equal(alertTermsExport.consumerReadiness.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
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
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.pendingInviteCount, 12)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.acceptedInviteCreatesMembership, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.acceptedInviteRevocationBlocked, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.removedMemberReinviteBlocked, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.deactivatedUserInviteBlocked, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.memberRemovalRevokesPendingInvites, true)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.memberRemovalCleanupSchema, 'organization.member_removal_cleanup.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.memberRemovalCleanupField, 'memberRemovalCleanup.revokedInviteIds')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.inviteLifecycle.staleInviteAcceptanceBlocker, 'member_revoked')
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
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.schemaVersion, 'organization.shared_watchlist_monitoring_workflow.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.persistenceLevel, 'organization_persisted')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.expectedAdapter, 'organizationSharedWatchlistMonitoringWorkflow')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.entrypoint.requiredQueryFields, ['organizationId', 'requestId'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.entrypoint.responseField, 'alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.map((step: Row) => step.id), ['watchlist_export', 'alert_upsert', 'alert_queue_visibility', 'case_link', 'webhook_delivery', 'audit_timeline'])
const monitoringWatchlistExport = alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'watchlist_export')
assert.ok(monitoringWatchlistExport)
assert.equal(monitoringWatchlistExport.ownerLane, 'org_watchlist')
assert.equal(monitoringWatchlistExport.state, 'ready')
assert.deepEqual(monitoringWatchlistExport.blockerCodes, [])
assert.ok(monitoringWatchlistExport.requiredPayloadFields.includes('activeTerms[].alertGenerationRef'))
assert.ok(monitoringWatchlistExport.redactedFields.includes('activeTerms[].term'))
const monitoringAlertUpsert = alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_upsert')
assert.ok(monitoringAlertUpsert)
assert.equal(monitoringAlertUpsert.ownerLane, 'dwm_alert_workflow')
assert.equal(monitoringAlertUpsert.storageModule, 'ti/scraper/src/storage/dwmAlertRepository.ts')
assert.equal(monitoringAlertUpsert.state, 'ready')
assert.ok(monitoringAlertUpsert.requiredPayloadFields.includes('workflowContext.alertGeneratorKeys'))
const monitoringCaseLink = alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'case_link')
assert.ok(monitoringCaseLink)
assert.equal(monitoringCaseLink.route, 'POST /v1/cases')
assert.equal(monitoringCaseLink.storageModule, 'ti/scraper/src/api/caseRoutes.ts')
assert.equal(monitoringCaseLink.state, 'ready')
assert.ok(monitoringCaseLink.requiredPayloadFields.includes('evidence.provenance'))
const monitoringWebhookDelivery = alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'webhook_delivery')
assert.ok(monitoringWebhookDelivery)
assert.equal(monitoringWebhookDelivery.route, 'POST /v1/dwm/webhooks/deliver')
assert.equal(monitoringWebhookDelivery.storageModule, 'ti/scraper/src/api/dwmWorkflowRoutes.ts')
assert.equal(monitoringWebhookDelivery.state, 'blocked')
assert.deepEqual(monitoringWebhookDelivery.blockerCodes, ['manual_webhook_selection_required'])
assert.ok(monitoringWebhookDelivery.redactedFields.includes('destination.secret'))
const monitoringAuditTimeline = alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'audit_timeline')
assert.ok(monitoringAuditTimeline)
assert.equal(monitoringAuditTimeline.route, 'GET /api/admin/support/audit')
assert.equal(monitoringAuditTimeline.storageModule, 'api/src/handlers/adminSupport.ts')
assert.equal(monitoringAuditTimeline.state, 'ready')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.operatorActions, {
    acknowledgeAlert: true,
    assignCase: true,
    linkCase: true,
    replayAlert: true,
    deliverWebhook: false,
})
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.evidenceContract.requiredFields, ['organizationId', 'tenantId', 'watchlistItemIds', 'alertGeneratorKeys', 'casePath', 'audit.eventBridge', 'visibilityDecision'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.evidenceContract.containsRawTerms, false)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.schemaVersion, 'organization.shared_watchlist_analyst_portal_workflow.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.expectedAdapter, 'organizationSharedWatchlistAnalystPortalWorkflow')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.route, 'GET /v1/dwm/alerts')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.requiredQueryFields, ['organizationId'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.storageModule, 'ti/scraper/src/storage/dwmAlertRepository.ts')
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.itemFields.includes('allowedActions'))
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.state, 'ready')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.detailContract.route, 'GET /v1/dwm/alerts/:id')
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.detailContract.evidenceFields.includes('audit.eventBridge'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.detailContract.redactedFields.includes('case.evidence.rawContent'))
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.detailContract.containsRawTerms, false)
const analystActionMap = new Map(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.actionContracts.map((action: Row) => [action.action, action]))
assert.equal(analystActionMap.get('review_alert').allowed, true)
assert.equal(analystActionMap.get('acknowledge_alert').allowed, true)
assert.equal(analystActionMap.get('assign_case').allowed, true)
assert.equal(analystActionMap.get('link_case').allowed, true)
assert.equal(analystActionMap.get('replay_alert').allowed, true)
assert.equal(analystActionMap.get('deliver_webhook').allowed, false)
assert.deepEqual(analystActionMap.get('deliver_webhook').blockerCodes, ['manual_webhook_selection_required'])
assert.equal(analystActionMap.get('open_audit_timeline').route, 'GET /api/admin/support/audit')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.timelineContract.requiredEventBridge, 'organization.shared_watchlist_audit_event_bridge.v1')
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.timelineContract.eventActions.includes('organization_watchlist_alert_terms_exported'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.timelineContract.redactedFields.includes('activeTerms[].term'))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate, {
    actorRole: 'admin',
    readAlertsAllowed: true,
    mutateAllowed: true,
    caseActionsAllowed: true,
    webhookDeliveryAllowed: false,
})
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.blockerCodes, ['manual_webhook_selection_required'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.schemaVersion, 'organization.shared_watchlist_enrichment_provenance.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.organizationId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.tenantId, organization.id)
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.expectedAdapter, 'organizationSharedWatchlistEnrichmentProvenance')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.requiredFamilies, ['organization_watchlist'])
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.activeFamilies, ['organization_watchlist'])
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.optionalFamilies, ['darkweb_metadata', 'telegram_public', 'rss_news', 'public_ti'])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.sourceHealthRoute, 'GET /v1/dwm/sources/health')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.state, 'ready')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceCoverage.blockerCodes, [])
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.schemaVersion, 'organization.shared_watchlist_source_coverage_health.v1')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.expectedAdapter, 'organizationSharedWatchlistSourceCoverageHealth')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.route, 'GET /v1/dwm/sources/health')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.ownerLane, 'source_operations')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.state, 'ready')
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.blockerCodes, [])
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.map((row: Row) => row.sourceFamily), ['organization_watchlist', 'darkweb_metadata', 'telegram_public', 'rss_news', 'public_ti'])
const orgWatchlistSourceHealth = alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.find((row: Row) => row.sourceFamily === 'organization_watchlist')
assert.equal(orgWatchlistSourceHealth.required, true)
assert.equal(orgWatchlistSourceHealth.active, true)
assert.equal(orgWatchlistSourceHealth.status, 'covered')
assert.deepEqual(orgWatchlistSourceHealth.blockerCodes, [])
assert.ok(orgWatchlistSourceHealth.requiredEvidenceFields.includes('contentHash'))
const darkwebSourceHealth = alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.find((row: Row) => row.sourceFamily === 'darkweb_metadata')
assert.equal(darkwebSourceHealth.required, false)
assert.equal(darkwebSourceHealth.active, false)
assert.equal(darkwebSourceHealth.status, 'optional')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.redaction.containsRawContent, false)
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.redaction.redactedFields.includes('rawContent'))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.provenanceFields.alert, ['provenance.captureIds', 'provenance.sourceIds', 'provenance.generatedAt', 'provenance.matchBasis', 'sourceFamily'])
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.provenanceFields.workflowContext.includes('selectedCaptureIds'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.provenanceFields.caseEvidence.includes('evidence.provenance.captureIds'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.provenanceFields.webhookPayload.includes('auditEventContracts'))
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.propagation.alertRepository, 'ti/scraper/src/storage/dwmAlertRepository.ts')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.propagation.caseRoute, 'ti/scraper/src/api/caseRoutes.ts')
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.propagation.webhookRoute, 'ti/scraper/src/api/dwmWorkflowRoutes.ts')
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.propagation.requiredCorrelationFields.includes('captureIds'))
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.redaction.containsRawContent, false)
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.redaction.redactedFields.includes('evidence.rawContent'))
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.crossTenantCollisionAllowed, false)
assert.deepEqual(alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.blockerCodes, [])
const adminPortalVisibility = orgUtils.organizationAnalystPortalVisibilityAdapter(alertTermsExport.sharedWatchlistDownstreamProof, alertTermsExport.downstreamAuthorization)
assert.equal(adminPortalVisibility.schemaVersion, 'organization.analyst_portal_visibility_adapter.v1')
assert.equal(adminPortalVisibility.organizationId, organization.id)
assert.equal(adminPortalVisibility.tenantId, organization.id)
assert.equal(adminPortalVisibility.routeBindings.alertList, 'GET /v1/dwm/alerts?organizationId=:organizationId')
assert.equal(adminPortalVisibility.routeBindings.caseDetail, 'GET /v1/cases/:id')
assert.deepEqual(adminPortalVisibility.requiredIdentityFields, ['organizationId', 'tenantId', 'member.userId', 'member.role', 'watchlistItemIds[]', 'workflowContext.visibilityDecision'])
assert.deepEqual(adminPortalVisibility.watchlistScope.activeWatchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(adminPortalVisibility.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(adminPortalVisibility.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(adminPortalVisibility.actionMatrix.review_alert.allowed, true)
assert.equal(adminPortalVisibility.actionMatrix.acknowledge_alert.allowed, true)
assert.equal(adminPortalVisibility.actionMatrix.assign_case.allowed, true)
assert.equal(adminPortalVisibility.actionMatrix.link_case.allowed, true)
assert.equal(adminPortalVisibility.actionMatrix.replay_alert.allowed, true)
assert.equal(adminPortalVisibility.actionMatrix.deliver_webhook.allowed, false)
assert.deepEqual(adminPortalVisibility.actionMatrix.deliver_webhook.blockerCodes, ['manual_webhook_selection_required'])
assert.ok(adminPortalVisibility.allowedActions.includes('review_alert'))
assert.ok(adminPortalVisibility.allowedActions.includes('link_case'))
assert.equal(adminPortalVisibility.consumerProof.alertQueueAdapter, 'organizationSharedWatchlistAlertQueueVisibility')
assert.equal(adminPortalVisibility.consumerProof.auditAdapter, 'organizationSharedWatchlistAuditEventBridge')
assert.ok(adminPortalVisibility.redaction.redactedFields.includes('otherOrg.alertGeneratorKeys'))
assert.equal(adminPortalVisibility.redaction.nonmemberEnumeration, false)
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
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('monitoringWorkflow'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('analystPortalWorkflow'))
assert.ok(alertTermsExport.sharedWatchlistDownstreamProof.integration.payloadShape.includes('enrichmentProvenance'))
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
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.requiredPayloadShape.includes('monitoringWorkflow'))
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.requiredPayloadShape.includes('analystPortalWorkflow'))
assert.ok(alertTermsExport.sharedWatchlistIntegrationGuardrails.requiredPayloadShape.includes('enrichmentProvenance'))
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
assert.equal(alertTermsExport.alertGenerationConsumer.schemaVersion, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(alertTermsExport.alertGenerationConsumer.organizationId, organization.id)
assert.equal(alertTermsExport.alertGenerationConsumer.tenantId, organization.id)
assert.equal(alertTermsExport.alertGenerationConsumer.repositoryAdapter, 'organizationWatchlistAlertTermsExport')
assert.equal(alertTermsExport.alertGenerationConsumer.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.alertGenerationConsumer.route, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.deepEqual(alertTermsExport.alertGenerationConsumer.requiredQueryFields, ['organizationId'])
assert.ok(alertTermsExport.alertGenerationConsumer.requiredPersistedFields.includes('workflowContext.organizationId'))
assert.ok(alertTermsExport.alertGenerationConsumer.requiredPersistedFields.includes('workflowContext.alertGeneratorKeys'))
assert.equal(alertTermsExport.alertGenerationConsumer.activeTerms.length, 5)
assert.deepEqual(alertTermsExport.alertGenerationConsumer.activeTerms.map((term: Row) => term.alertGeneratorKey).sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.deepEqual(alertTermsExport.alertGenerationConsumer.lifecycleExclusions.activeItemIds.sort(), alertTermsExport.termLifecycle.activeItemIds.sort())
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.schemaVersion, 'organization.watchlist_alert_matching_input.v1')
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.organizationId, organization.id)
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.tenantId, organization.id)
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.matchingRoute, 'organization_watchlist')
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.termCount, alertTermsExport.activeTerms.length)
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('alertGenerationRef'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('watchedEntity'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('matchReason'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('actorRef'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('sourceRefs'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('provenanceHash'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('provenance'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('workflowReadiness'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.requiredMatcherFields.includes('destinationReadiness'))
assert.deepEqual(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.dedupeKeyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
assert.deepEqual(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.watchlistItemId).sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.alertGeneratorKey).sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.status === 'active'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.watchlistId === term.watchlistItemId))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.watchedEntity.normalizedValue === term.normalizedTerm))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.matchReason.code === 'organization_watchlist_term_match'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.actorRef.userId === 'org_smoke_admin'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.actorRef.role === 'admin'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.sourceRefs.exportRoute === 'GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => /^orgprov_[0-9a-f]{8}$/.test(term.provenanceHash)))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.provenance.schemaVersion === 'organization.watchlist_match_provenance.v1'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.provenance.alertGeneratorKey === term.alertGeneratorKey))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.provenance.provenanceHash === term.provenanceHash))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.provenance.caseReplayFields.includes('matchReason')))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.provenance.caseReplayFields.includes('provenanceHash')))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.workflowReadiness.alertGenerationReady === true))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.workflowReadiness.caseReplayReady === true))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.workflowReadiness.destinationDeliveryReady === false))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.workflowReadiness.blockerCodes.includes('manual_webhook_selection_required')))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.destinationReadiness.webhookDestinationOwnership === 'organization.webhook_destination_ownership.v1'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.destinationReadiness.selectedDestinationOrgField === 'destination.org_id'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.destinationReadiness.dryRunVisibility.allowed === true))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.destinationReadiness.dryRunVisibility.deniedRoles.includes('viewer')))
assert.deepEqual(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.lifecycleExclusions.pausedItemIds, [])
assert.deepEqual(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.lifecycleExclusions.archivedItemIds, [])
assert.deepEqual(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.lifecycleExclusions.excludedStatuses, ['paused', 'archived'])
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.scopeGuardrails.crossOrgReadAllowed, false)
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.scopeGuardrails.userLocalFallbackAllowed, false)
assert.equal(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.scopeGuardrails.nonmemberEnumeration, false)
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.ok(alertTermsExport.alertGenerationConsumer.matchingInputReceipt.noLeakFields.includes('destination.secret'))
assert.equal(alertTermsExport.termExportDeltaReceipt.schemaVersion, 'organization.watchlist_term_export_delta_receipt.v1')
assert.equal(alertTermsExport.termExportDeltaReceipt.organizationId, organization.id)
assert.equal(alertTermsExport.termExportDeltaReceipt.tenantId, organization.id)
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.actor, {
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
})
assert.equal(alertTermsExport.termExportDeltaReceipt.route, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(alertTermsExport.termExportDeltaReceipt.activeTermCount, alertTermsExport.activeTerms.length)
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.exportedWatchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.exportedAlertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.termExportDeltaReceipt.excludedTermCount, 0)
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.excludedWatchlistItemIds, [])
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.excludedReasons, [])
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.lifecycle.activeItemIds.sort(), alertTermsExport.termLifecycle.activeItemIds.sort())
assert.equal(alertTermsExport.termExportDeltaReceipt.downstreamRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(alertTermsExport.termExportDeltaReceipt.downstreamRefs.alertPersistenceContract, 'organization.watchlist_alert_persistence_contract.v1')
assert.equal(alertTermsExport.termExportDeltaReceipt.downstreamRefs.caseVisibilityConsumer, 'organization.case_visibility_consumer.v1')
assert.equal(alertTermsExport.termExportDeltaReceipt.downstreamRefs.webhookOwnership, 'organization.shared_watchlist_webhook_ownership_hint.v1')
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.roleGates.mutateWatchlists, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.roleGates.readSharedWatchlists, ['owner', 'admin', 'member', 'viewer'])
assert.deepEqual(alertTermsExport.termExportDeltaReceipt.stableDedupeFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
assert.equal(alertTermsExport.termExportDeltaReceipt.nonmemberEnumeration, false)
assert.equal(alertTermsExport.alertGenerationConsumer.scopeGuardrails.partitionKey, 'organizationId')
assert.equal(alertTermsExport.alertGenerationConsumer.scopeGuardrails.crossOrgReadAllowed, false)
assert.equal(alertTermsExport.alertGenerationConsumer.scopeGuardrails.userLocalFallbackAllowed, false)
assert.equal(alertTermsExport.alertGenerationConsumer.scopeGuardrails.nonmemberEnumeration, false)
assert.deepEqual(alertTermsExport.alertGenerationConsumer.roleGates.mutateWatchlists, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.alertGenerationConsumer.roleGates.readSharedWatchlists, ['owner', 'admin', 'member', 'viewer'])
assert.equal(alertTermsExport.alertGenerationConsumer.denialContract.nonmember, 'organization.access_denial.v1')
assert.equal(alertTermsExport.alertGenerationConsumer.denialContract.roleDenied, 'organization.watchlist_alert_terms_export_denial.v1')
assert.equal(alertTermsExport.alertGenerationConsumer.denialContract.removedMember, 'member_revoked')
assert.ok(alertTermsExport.alertGenerationConsumer.denialContract.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.equal(alertTermsExport.alertGenerationConsumer.canGenerateAlerts, true)
assert.deepEqual(alertTermsExport.alertGenerationConsumer.blockerCodes, [])
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
assert.equal(alertTermsExport.alertCasePersistenceReceipt.schemaVersion, 'organization.alert_case_bridge_persistence_receipt.v1')
assert.equal(alertTermsExport.alertCasePersistenceReceipt.organizationId, organization.id)
assert.equal(alertTermsExport.alertCasePersistenceReceipt.tenantId, organization.id)
assert.equal(alertTermsExport.alertCasePersistenceReceipt.sourceFamily, 'organization_watchlist')
assert.equal(alertTermsExport.alertCasePersistenceReceipt.alertPersistenceContract, 'organization.watchlist_alert_persistence_contract.v1')
assert.equal(alertTermsExport.alertCasePersistenceReceipt.caseWorkflowContract, 'organization.watchlist_case_workflow_contract.v1')
assert.equal(alertTermsExport.alertCasePersistenceReceipt.storageModule, 'ti/scraper/src/storage/dwmAlertRepository.ts')
assert.equal(alertTermsExport.alertCasePersistenceReceipt.alertUpsertFunction, 'upsertDwmAlert')
assert.equal(alertTermsExport.alertCasePersistenceReceipt.alertRoute, 'organization_watchlist')
assert.equal(alertTermsExport.alertCasePersistenceReceipt.caseRoute, 'POST /v1/cases')
assert.equal(alertTermsExport.alertCasePersistenceReceipt.casePathTemplate, '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
assert.deepEqual(alertTermsExport.alertCasePersistenceReceipt.watchlistScope.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.alertCasePersistenceReceipt.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.alertCasePersistenceReceipt.watchlistScope.crossTenantCollisionAllowed, false)
assert.ok(alertTermsExport.alertCasePersistenceReceipt.requiredAlertFields.includes('workflowContext.organizationId'))
assert.ok(alertTermsExport.alertCasePersistenceReceipt.requiredAlertFields.includes('workflowContext.alertGeneratorKeys'))
assert.ok(alertTermsExport.alertCasePersistenceReceipt.requiredCaseFields.includes('casePath'))
assert.ok(alertTermsExport.alertCasePersistenceReceipt.workflowContextFields.includes('watchlistTermContexts'))
assert.deepEqual(alertTermsExport.alertCasePersistenceReceipt.dedupe.keyFields, ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'])
assert.equal(alertTermsExport.alertCasePersistenceReceipt.dedupe.crossTenantCollisionAllowed, false)
assert.ok(alertTermsExport.alertCasePersistenceReceipt.lifecycleBlockers.includes('member_revoked'))
assert.ok(alertTermsExport.alertCasePersistenceReceipt.actorActions.includes('assign_case'))
assert.deepEqual(alertTermsExport.alertCasePersistenceReceipt.blockerCodes, [])
assert.equal(alertTermsExport.alertCasePersistenceReceipt.noEnumeration, false)
assert.equal(alertTermsExport.readinessExport.schemaVersion, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(alertTermsExport.readinessExport.organizationId, organization.id)
assert.equal(alertTermsExport.readinessExport.tenantId, organization.id)
assert.equal(alertTermsExport.readinessExport.sourceFamily, 'organization_watchlist')
assert.deepEqual(alertTermsExport.readinessExport.actor, { userId: 'org_smoke_admin', role: 'admin', status: 'active' })
assert.equal(alertTermsExport.readinessExport.routes.alertTermsExport, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(alertTermsExport.readinessExport.routes.alertQueue, 'GET /v1/dwm/alerts')
assert.equal(alertTermsExport.readinessExport.routes.caseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
assert.equal(alertTermsExport.readinessExport.routes.caseOpen, 'POST /v1/cases')
assert.equal(alertTermsExport.readinessExport.routes.webhookDeliver, 'POST /v1/dwm/webhooks/deliver')
assert.equal(alertTermsExport.readinessExport.routes.dashboardReadiness, 'GET /api/organizations/:id/alert-readiness')
assert.equal(alertTermsExport.readinessExport.readiness.alertExportReady, true)
assert.equal(alertTermsExport.readinessExport.readiness.alertQueueReady, true)
assert.equal(alertTermsExport.readinessExport.readiness.casePersistenceReady, true)
assert.equal(alertTermsExport.readinessExport.readiness.caseVisibilityReady, true)
assert.equal(alertTermsExport.readinessExport.readiness.webhookDestinationReady, false)
assert.equal(alertTermsExport.readinessExport.readiness.supportRedactedReadReady, true)
assert.equal(alertTermsExport.readinessExport.readiness.dashboardReadinessReady, true)
assert.deepEqual(alertTermsExport.readinessExport.watchlistScope.activeItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.readinessExport.watchlistScope.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.readinessExport.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(alertTermsExport.readinessExport.userLocalIsolation.schemaVersion, 'organization.user_local_watchlist_isolation.v1')
assert.equal(alertTermsExport.readinessExport.userLocalIsolation.sourceOfTruth, 'organization_watchlist_items')
assert.equal(alertTermsExport.readinessExport.userLocalIsolation.organizationScopeField, 'organization_id')
assert.deepEqual(alertTermsExport.readinessExport.userLocalIsolation.requiredQueryFields, ['organizationId'])
assert.ok(alertTermsExport.readinessExport.userLocalIsolation.excludedSources.includes('user_local_watchlists'))
assert.ok(alertTermsExport.readinessExport.userLocalIsolation.excludedSources.includes('session_watchlists'))
assert.ok(alertTermsExport.readinessExport.userLocalIsolation.forbiddenFallbacks.includes('userId_only'))
assert.ok(alertTermsExport.readinessExport.userLocalIsolation.forbiddenFallbacks.includes('missing_organization_id'))
assert.deepEqual(alertTermsExport.readinessExport.userLocalIsolation.activeWatchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.readinessExport.userLocalIsolation.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.equal(alertTermsExport.readinessExport.userLocalIsolation.crossOrgDedupeAllowed, false)
assert.equal(alertTermsExport.readinessExport.userLocalIsolation.nonmemberEnumeration, false)
assert.ok(alertTermsExport.readinessExport.userLocalIsolation.noLeakFields.includes('userLocal.watchlistItems'))
assert.ok(alertTermsExport.readinessExport.userLocalIsolation.noLeakFields.includes('session.watchlistItems'))
assert.ok(alertTermsExport.readinessExport.userLocalIsolation.proofAssertions.includes('two_org_overlapping_terms_distinct_keys'))
assert.ok(alertTermsExport.readinessExport.userLocalIsolation.proofAssertions.includes('removed_member_cannot_export_terms'))
assert.equal(alertTermsExport.readinessExport.downstreamRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(alertTermsExport.readinessExport.downstreamRefs.alertPersistenceReceipt, 'organization.alert_case_bridge_persistence_receipt.v1')
assert.equal(alertTermsExport.readinessExport.downstreamRefs.caseVisibilityConsumer, 'organization.case_visibility_consumer.v1')
assert.equal(alertTermsExport.readinessExport.downstreamRefs.webhookDestinationOwnership, 'organization.webhook_destination_ownership.v1')
assert.equal(alertTermsExport.readinessExport.downstreamRefs.webhookDestinationAccessDecision, 'organization.webhook_destination_access_decision.v1')
assert.equal(alertTermsExport.readinessExport.downstreamRefs.termExportDeltaReceipt, 'organization.watchlist_term_export_delta_receipt.v1')
assert.deepEqual(alertTermsExport.readinessExport.roleGates.mutateWatchlists, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.readinessExport.roleGates.manualWebhookTrigger, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.readinessExport.roleGates.assignCase, ['owner', 'admin', 'analyst'])
assert.equal(alertTermsExport.readinessExport.alertGenerationFixture.schemaVersion, 'organization.watchlist_alert_generation_fixture.v1')
assert.equal(alertTermsExport.readinessExport.alertGenerationFixture.route, 'organization_watchlist')
assert.equal(alertTermsExport.readinessExport.alertGenerationFixture.matchingInputSchema, 'organization.watchlist_alert_matching_input.v1')
assert.equal(alertTermsExport.readinessExport.alertGenerationFixture.activeTermCount, alertTermsExport.activeTerms.length)
assert.deepEqual(alertTermsExport.readinessExport.alertGenerationFixture.watchlistItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.readinessExport.alertGenerationFixture.alertGeneratorKeys.sort(), alertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey).sort())
assert.ok(alertTermsExport.readinessExport.alertGenerationFixture.expectedAlertFields.includes('workflowContext.alertGenerationRefs'))
assert.ok(alertTermsExport.readinessExport.alertGenerationFixture.expectedCaseFields.includes('casePath'))
assert.deepEqual(alertTermsExport.readinessExport.alertGenerationFixture.replaySteps, ['export_alert_terms', 'match_capture_fixture', 'persist_org_alert', 'verify_case_visibility', 'archive_cleanup'])
assert.ok(alertTermsExport.readinessExport.alertGenerationFixture.lifecycleBlockers.includes('member_revoked'))
assert.ok(alertTermsExport.readinessExport.alertGenerationFixture.lifecycleBlockers.includes('watchlist_archived'))
assert.equal(alertTermsExport.readinessExport.alertGenerationFixture.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
assert.equal(alertTermsExport.readinessExport.alertGenerationFixture.crossOrgDedupeAllowed, false)
assert.equal(alertTermsExport.readinessExport.alertGenerationFixture.nonmemberEnumeration, false)
assert.equal(alertTermsExport.readinessExport.lifecycleAccess.activeMembershipRequired, true)
assert.equal(alertTermsExport.readinessExport.lifecycleAccess.removedMemberBlocker, 'member_revoked')
assert.equal(alertTermsExport.readinessExport.lifecycleAccess.revokedInviteBlocker, 'member_revoked')
assert.equal(alertTermsExport.readinessExport.lifecycleAccess.expiredInviteBlocker, 'invite_expired')
assert.equal(alertTermsExport.readinessExport.lifecycleAccess.pausedWatchlistBlocker, 'watchlist_paused')
assert.equal(alertTermsExport.readinessExport.lifecycleAccess.archivedWatchlistBlocker, 'watchlist_archived')
assert.equal(alertTermsExport.readinessExport.lifecycleAccess.nonmemberEnumeration, false)
assert.ok(alertTermsExport.readinessExport.blockers.includes('manual_webhook_selection_required'))
assert.ok(alertTermsExport.readinessExport.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
assert.ok(alertTermsExport.readinessExport.noLeakFields.includes('destination.secret'))
assert.equal(alertTermsExport.readinessExport.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')
assert.equal(alertTermsExport.activeTerms.length, 5)
assert.equal(alertTermsExport.activeWatchlistTerms.length, 5)
assert.deepEqual(alertTermsExport.termFamilies, ['actor', 'company', 'domain', 'keyword', 'vendor'])
assert.equal(alertTermsExport.excluded.inactiveCount, 0)
assert.equal(alertTermsExport.termLifecycle.schemaVersion, 'organization.watchlist_term_lifecycle.v1')
assert.equal(alertTermsExport.termLifecycle.organizationId, organization.id)
assert.equal(alertTermsExport.termLifecycle.tenantId, organization.id)
assert.deepEqual(alertTermsExport.termLifecycle.activeItemIds.sort(), alertTermsExport.activeTerms.map((term: Row) => term.watchlistItemId).sort())
assert.deepEqual(alertTermsExport.termLifecycle.pausedItemIds, [])
assert.deepEqual(alertTermsExport.termLifecycle.archivedItemIds, [])
assert.deepEqual(alertTermsExport.termLifecycle.deletedTermIds, [])
assert.equal(alertTermsExport.termLifecycle.deletedTermCount, 0)
assert.equal(alertTermsExport.termLifecycle.deletedTermSource, 'DELETE /api/organizations/:organizationId/watchlists/:itemId')
assert.equal(alertTermsExport.termLifecycle.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
assert.deepEqual(alertTermsExport.termLifecycle.alertMatchingEligibleStatuses, ['active'])
assert.equal(alertTermsExport.termLifecycle.exportExcludesDeletedTerms, true)
assert.deepEqual(alertTermsExport.termLifecycle.excludedFromAlertMatching, [])
assert.equal(alertTermsExport.termLifecycle.downstreamRefs.alertReadiness, 'GET /api/organizations/:id/alert-readiness')
assert.equal(alertTermsExport.termLifecycle.downstreamRefs.webhookDestinationOrgField, 'destination.org_id')
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
assert.equal(keywordExportTerm.ownerContext.schemaVersion, 'organization.watchlist_term_owner_context.v1')
assert.equal(keywordExportTerm.ownerContext.organizationId, organization.id)
assert.equal(keywordExportTerm.ownerContext.tenantId, organization.id)
assert.equal(keywordExportTerm.ownerContext.ownerOrganizationId, organization.id)
assert.equal(keywordExportTerm.ownerContext.watchlistItemId, keywordExportTerm.watchlistItemId)
assert.equal(keywordExportTerm.ownerContext.itemId, keywordExportTerm.itemId)
assert.equal(keywordExportTerm.ownerContext.createdBy, 'org_smoke_admin')
assert.equal(keywordExportTerm.ownerContext.updatedBy, 'org_smoke_admin')
assert.equal(keywordExportTerm.ownerContext.visibilityPolicy, 'admins')
assert.deepEqual(keywordExportTerm.ownerContext.allowedViewerRoles, ['owner', 'admin'])
assert.equal(keywordExportTerm.ownerContext.webhookDestinationOrgField, 'destination.org_id')
assert.equal(keywordExportTerm.ownerContext.alertGeneratorKey, keywordExportTerm.alertGeneratorKey)
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
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.schemaVersion, 'organization.watchlist_alert_generation_consumer_denial.v1')
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.organizationId, organization.id)
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.member.role, 'member')
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.canReadSharedWatchlists, true)
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.canExportAlertTerms, false)
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.canMutateWatchlists, false)
assert.deepEqual(memberAlertTermsDenial.alertGenerationConsumerDenial.allowedExportRoles, ['owner', 'admin'])
assert.deepEqual(memberAlertTermsDenial.alertGenerationConsumerDenial.readSharedWatchlistRoles, ['owner', 'admin', 'member', 'viewer'])
assert.deepEqual(memberAlertTermsDenial.alertGenerationConsumerDenial.mutateWatchlistRoles, ['owner', 'admin'])
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.denialReason, 'role_not_allowed')
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.nonmemberEnumeration, false)
assert.equal(memberAlertTermsDenial.alertGenerationConsumerDenial.removedMemberDenied, 'member_revoked')
assert.ok(memberAlertTermsDenial.alertGenerationConsumerDenial.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.ok(!('activeTerms' in memberAlertTermsDenial.alertGenerationConsumerDenial))
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
assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.lifecycleStatus, 'archived')
assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.blockerCode, 'org_archived')
assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.inviteMutationAllowed, false)
assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.watchlistMutationAllowed, false)
assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.alertExportAllowed, false)
assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.caseVisibilityAllowed, false)
assert.equal(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.webhookDeliveryAllowed, false)
assert.ok(archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.blockedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.lifecycleStatus, 'archived')
assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.blockerCode, 'org_archived')
assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.lifecycleMutationAllowed, false)
assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.actorPermissions.canManageInvites, false)
assert.equal(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.actorPermissions.canMutateWatchlists, false)
assert.ok(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.blockedWhenInactive.includes('POST /api/organizations/:id/invites'))
assert.ok(archivedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.equal(
    archivedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.downstreamRefs.alertGenerationFixture,
    'organization.watchlist_alert_generation_fixture.v1',
)

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
assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.lifecycleStatus, 'deleted')
assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.blockerCode, 'org_deleted')
assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.inviteMutationAllowed, false)
assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.watchlistMutationAllowed, false)
assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.alertExportAllowed, false)
assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.caseVisibilityAllowed, false)
assert.equal(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.webhookDeliveryAllowed, false)
assert.ok(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.blockedRoutes.includes('POST /v1/dwm/webhooks/deliver'))
assert.ok(deletedOrganizationSettings.lifecycleReadiness.downstreamLifecycleReceipt.noLeakFields.includes('destination.secret'))
assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.lifecycleStatus, 'deleted')
assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.blockerCode, 'org_deleted')
assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.lifecycleMutationAllowed, false)
assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.actorPermissions.canDeleteOrganization, false)
assert.ok(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.blockedWhenInactive.includes('POST /api/organizations/:id/ownership-transfer'))
assert.equal(deletedOrganizationSettings.lifecycleReadiness.workspaceBoundaryProof.nonmemberEnumeration, false)

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
assert.equal(deletedInviteAcceptDeniedResponse.statusCode, 409, deletedInviteAcceptDeniedResponse.body)
const deletedInviteAcceptDenial = parseBody(deletedInviteAcceptDeniedResponse.body).inviteAcceptanceDenial
assert.equal(deletedInviteAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
assert.equal(deletedInviteAcceptDenial.organizationId, organization.id)
assert.equal(deletedInviteAcceptDenial.inviteId, bulkInviteWorkflow.results[2].inviteId)
assert.equal(deletedInviteAcceptDenial.inviteStatus, 'pending')
assert.equal(deletedInviteAcceptDenial.organizationStatus, 'deleted')
assert.equal(deletedInviteAcceptDenial.blockerCode, 'org_deleted')
assert.equal(deletedInviteAcceptDenial.nonmemberEnumeration, false)

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
assert.equal(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.downstreamLifecycleReceipt.blockerCode, null)
assert.equal(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.downstreamLifecycleReceipt.inviteMutationAllowed, true)
assert.equal(parseBody(reactivateOrganizationResponse.body).lifecycleReadiness.downstreamLifecycleReceipt.webhookDeliveryAllowed, true)

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
assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.ownerOrganizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.watchlistItemId, secondOrgWatchlistItem.id)
assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.webhookDestinationOrgField, 'destination.org_id')
assert.equal(secondOrgAlertTermsExport.activeTerms[0].ownerContext.alertGeneratorKey, secondOrgAlertTermsExport.activeTerms[0].alertGeneratorKey)
assert.notEqual(secondOrgAlertTermsExport.activeTerms[0].alertGeneratorKey, alertTermsExport.activeTerms.find((term: Row) => term.term === 'acme-shared.example').alertGeneratorKey)
const secondOrgGeneratedReference = orgUtils.buildOrganizationDwmAlertReference(
    organizationSummary(secondOrganization.id, 'owner'),
    watchlists.get(secondOrgWatchlistItem.id) as Row,
)
const firstOrgOverlapTerm = alertTermsExport.activeTerms.find((term: Row) => term.term === 'acme-shared.example')
assert.equal(secondOrgGeneratedReference.alertOwnership.organizationId, secondOrganization.id)
assert.equal(secondOrgGeneratedReference.alertOwnership.tenantId, secondOrganization.id)
assert.equal(secondOrgGeneratedReference.alertOwnership.watchlistItemId, secondOrgWatchlistItem.id)
assert.equal(secondOrgGeneratedReference.alertOwnership.crossTenantCollisionAllowed, false)
assert.equal(secondOrgGeneratedReference.ownerContext.organizationId, secondOrganization.id)
assert.equal(secondOrgGeneratedReference.ownerContext.tenantId, secondOrganization.id)
assert.equal(secondOrgGeneratedReference.ownerContext.watchlistItemId, secondOrgWatchlistItem.id)
assert.equal(secondOrgGeneratedReference.ownerContext.alertGeneratorKey, secondOrgGeneratedReference.alert.dedupeKey)
assert.equal(secondOrgGeneratedReference.alert.workflowContext.ownerContext.organizationId, secondOrganization.id)
assert.notEqual(secondOrgGeneratedReference.alertOwnership.dedupeKey, firstOrgOverlapTerm.alertGenerationRef.dedupe.key)
assert.notEqual(secondOrgGeneratedReference.alertOwnership.organizationId, firstOrgOverlapTerm.organizationId)
assert.notEqual(secondOrgGeneratedReference.ownerContext.organizationId, firstOrgOverlapTerm.ownerContext.organizationId)
assert.notEqual(secondOrgGeneratedReference.ownerContext.alertGeneratorKey, firstOrgOverlapTerm.ownerContext.alertGeneratorKey)
assert.equal(secondOrgGeneratedReference.webhookContract.schemaVersion, 'organization.alert_reference_webhook_contract.v1')
assert.equal(secondOrgGeneratedReference.webhookContract.organizationId, secondOrganization.id)
assert.equal(secondOrgGeneratedReference.webhookContract.tenantId, secondOrganization.id)
assert.equal(secondOrgGeneratedReference.webhookContract.requiredDestinationOrgId, secondOrganization.id)
assert.equal(secondOrgGeneratedReference.webhookContract.selectedDestinationOrgField, 'destination.org_id')
assert.equal(secondOrgGeneratedReference.webhookContract.selectedDestinationIdField, 'webhookDestinationIds[]')
assert.equal(secondOrgGeneratedReference.webhookContract.ownerContext.organizationId, secondOrganization.id)
assert.equal(secondOrgGeneratedReference.webhookContract.ownerContext.alertGeneratorKey, secondOrgGeneratedReference.alert.dedupeKey)
assert.notEqual(secondOrgGeneratedReference.webhookContract.requiredDestinationOrgId, organization.id)
assert.notEqual(secondOrgAlertTermsExport.activeTerms[0].ownerContext.organizationId, firstOrgOverlapTerm.ownerContext.organizationId)
assert.notEqual(secondOrgAlertTermsExport.activeTerms[0].ownerContext.alertGeneratorKey, firstOrgOverlapTerm.ownerContext.alertGeneratorKey)
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
assert.equal(secondOrgAlertTermsExport.webhookDestinationOwnership.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.webhookDestinationOwnership.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.webhookDestinationOwnership.requiredDestinationOrgId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.webhookDestinationOwnership.selectedDestinationOrgField, 'destination.org_id')
assert.equal(secondOrgAlertTermsExport.webhookDestinationOwnership.nonmemberDestinationEnumeration, false)
assert.notEqual(secondOrgAlertTermsExport.webhookDestinationOwnership.requiredDestinationOrgId, alertTermsExport.webhookDestinationOwnership.requiredDestinationOrgId)
assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationOwnership.idempotency.keyFields, ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'])
assert.ok(secondOrgAlertTermsExport.webhookDestinationOwnership.requiredAlertFields.includes('alert.organizationId'))
assert.ok(secondOrgAlertTermsExport.webhookDestinationOwnership.redactedFields.includes('destination.secret'))
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.destinationScope.requiredDestinationOrgId, secondOrganization.id)
assert.notEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.destinationScope.requiredDestinationOrgId, alertTermsExport.webhookDestinationAccessDecision.destinationScope.requiredDestinationOrgId)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.destinationScope.crossOrgDestinationAllowed, false)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.allowedActions.automaticDelivery, true)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.allowedActions.manualTrigger, true)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.allowedActions.configureDestination, true)
assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.blockerCodes, [])
assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.roleGates.manualTrigger, ['owner', 'admin'])
assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.noLeakFields.includes('otherOrg.destinationIds'))
assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.proofAssertions.includes('nonmember_cannot_enumerate_destinations'))
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.selectedDestinationOrgField, 'destination.org_id')
assert.notEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.organizationId, alertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.organizationId)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.crossOrgDestinationAllowed, false)
assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.deliveryInputReceipt.noLeakFields.includes('otherOrg.destinationIds'))
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.requiredDestinationOrgId, secondOrganization.id)
assert.notEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.requiredDestinationOrgId, alertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.destinationScope.requiredDestinationOrgId)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.destinationDeliveryReady, true)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.manualSelectionRequired, false)
assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.readiness.blockerCodes, [])
assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.dryRunReceipt.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.provenanceHashes, secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenanceHash))
assert.notDeepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.provenanceHashes, alertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.watchlistScope.provenanceHashes)
assert.equal(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.workflowState.destinationDeliveryReady, true)
assert.deepEqual(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.blockerCodes, [])
assert.ok(secondOrgAlertTermsExport.webhookDestinationAccessDecision.alertDeliveryReadiness.noLeakFields.includes('otherOrg.destinationIds'))
assert.equal(secondOrgAlertTermsExport.alertGenerationConsumer.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.alertGenerationConsumer.scopeGuardrails.crossOrgReadAllowed, false)
assert.equal(secondOrgAlertTermsExport.alertGenerationConsumer.scopeGuardrails.watchlistScope, 'organization_owned')
assert.deepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.activeTerms.map((term: Row) => term.watchlistItemId), [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.activeTerms.map((term: Row) => term.alertGeneratorKey), alertTermsExport.alertGenerationConsumer.activeTerms.map((term: Row) => term.alertGeneratorKey))
assert.ok(!secondOrgAlertTermsExport.alertGenerationConsumer.activeTerms.some((term: Row) => alertTermsExport.alertGenerationConsumer.activeTerms.map((firstTerm: Row) => firstTerm.watchlistItemId).includes(term.watchlistItemId)))
assert.deepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.watchlistId), [secondOrgWatchlistItem.id])
assert.deepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenance.organizationId), [secondOrganization.id])
assert.notDeepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenance.alertGeneratorKey), alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenance.alertGeneratorKey))
assert.notDeepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenanceHash), alertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.provenanceHash))
assert.deepEqual(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.map((term: Row) => term.destinationReadiness.selectedDestinationOrgField), ['destination.org_id'])
assert.ok(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.destinationReadiness.dryRunVisibility.allowed === true))
assert.ok(secondOrgAlertTermsExport.alertGenerationConsumer.matchingInputReceipt.terms.every((term: Row) => term.matchReason.code === 'organization_watchlist_term_match'))
assert.equal(secondOrgAlertTermsExport.termExportDeltaReceipt.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.termExportDeltaReceipt.exportedWatchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.termExportDeltaReceipt.exportedAlertGeneratorKeys, alertTermsExport.termExportDeltaReceipt.exportedAlertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.termExportDeltaReceipt.nonmemberEnumeration, false)
assert.equal(secondOrgAlertTermsExport.alertCasePersistenceReceipt.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.alertCasePersistenceReceipt.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.alertCasePersistenceReceipt.watchlistScope.alertGeneratorKeys, alertTermsExport.alertCasePersistenceReceipt.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.alertCasePersistenceReceipt.dedupe.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.watchlists.activeCount, 1)
assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.watchlists.activeIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertTermsExport.consumerReadiness.watchlists.alertGeneratorKeys, alertTermsExport.consumerReadiness.watchlists.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.watchlists.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.alertQueueReady, true)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.caseWorkflowReady, true)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.webhookDeliveryReady, true)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.supportRedactedReadReady, true)
assert.equal(secondOrgAlertTermsExport.consumerReadiness.readiness.dashboardReadinessReady, true)
assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.roleGates.mutateWatchlists, ['owner', 'admin'])
assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.roleGates.exportTerms, ['owner', 'admin', 'member', 'viewer'])
assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.roleGates.manualWebhookTrigger, ['owner', 'admin'])
assert.deepEqual(secondOrgAlertTermsExport.consumerReadiness.blockers, [])
assert.ok(secondOrgAlertTermsExport.consumerReadiness.noLeakFields.includes('destination.secret'))
assert.equal(secondOrgAlertTermsExport.readinessExport.schemaVersion, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(secondOrgAlertTermsExport.readinessExport.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.readinessExport.tenantId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.readinessExport.watchlistScope.activeItemIds, [secondOrgWatchlistItem.id])
assert.deepEqual(secondOrgAlertTermsExport.readinessExport.watchlistScope.alertGeneratorKeys, secondOrgAlertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey))
assert.notDeepEqual(secondOrgAlertTermsExport.readinessExport.watchlistScope.alertGeneratorKeys, alertTermsExport.readinessExport.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.readinessExport.watchlistScope.crossTenantCollisionAllowed, false)
assert.deepEqual(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.activeWatchlistItemIds, [secondOrgWatchlistItem.id])
assert.deepEqual(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.alertGeneratorKeys, secondOrgAlertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey))
assert.notDeepEqual(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.alertGeneratorKeys, alertTermsExport.readinessExport.userLocalIsolation.alertGeneratorKeys)
assert.ok(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.noLeakFields.includes('userLocal.watchlistItems'))
assert.equal(secondOrgAlertTermsExport.readinessExport.userLocalIsolation.crossOrgDedupeAllowed, false)
assert.equal(secondOrgAlertTermsExport.readinessExport.readiness.alertExportReady, true)
assert.equal(secondOrgAlertTermsExport.readinessExport.readiness.webhookDestinationReady, true)
assert.equal(secondOrgAlertTermsExport.readinessExport.alertGenerationFixture.schemaVersion, 'organization.watchlist_alert_generation_fixture.v1')
assert.equal(secondOrgAlertTermsExport.readinessExport.alertGenerationFixture.activeTermCount, 1)
assert.deepEqual(secondOrgAlertTermsExport.readinessExport.alertGenerationFixture.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.deepEqual(secondOrgAlertTermsExport.readinessExport.alertGenerationFixture.alertGeneratorKeys, secondOrgAlertTermsExport.activeTerms.map((term: Row) => term.alertGeneratorKey))
assert.notDeepEqual(secondOrgAlertTermsExport.readinessExport.alertGenerationFixture.alertGeneratorKeys, alertTermsExport.readinessExport.alertGenerationFixture.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.readinessExport.alertGenerationFixture.crossOrgDedupeAllowed, false)
assert.deepEqual(secondOrgAlertTermsExport.readinessExport.blockers, [])
assert.ok(secondOrgAlertTermsExport.readinessExport.noLeakFields.includes('otherOrg.watchlistItemIds'))
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
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.persistenceLevel, 'organization_persisted')
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_upsert').state, 'ready')
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.steps.find((step: Row) => step.id === 'alert_upsert').blockerCodes, [])
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow.evidenceContract.containsRawTerms, false)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.queueContract.state, 'ready')
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.detailContract.containsRawTerms, false)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.actorRole, 'owner')
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.roleGate.caseActionsAllowed, true)
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.organizationId, alertTermsExport.sharedWatchlistDownstreamProof.analystPortalWorkflow.organizationId)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.tenantId, secondOrganization.id)
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.state, 'ready')
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.find((row: Row) => row.sourceFamily === 'organization_watchlist').status, 'covered')
assert.deepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.map((row: Row) => row.sourceFamily), alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.sourceHealth.rows.map((row: Row) => row.sourceFamily))
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.enrichmentProvenance.redaction.containsRawContent, false)
const secondOrgPortalVisibility = orgUtils.organizationAnalystPortalVisibilityAdapter(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof, secondOrgAlertTermsExport.downstreamAuthorization)
assert.equal(secondOrgPortalVisibility.organizationId, secondOrganization.id)
assert.equal(secondOrgPortalVisibility.tenantId, secondOrganization.id)
assert.equal(secondOrgPortalVisibility.member.role, 'owner')
assert.equal(secondOrgPortalVisibility.actionMatrix.review_alert.allowed, true)
assert.deepEqual(secondOrgPortalVisibility.watchlistScope.activeWatchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgPortalVisibility.watchlistScope.activeWatchlistItemIds, adminPortalVisibility.watchlistScope.activeWatchlistItemIds)
assert.notDeepEqual(secondOrgPortalVisibility.watchlistScope.alertGeneratorKeys, adminPortalVisibility.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgPortalVisibility.redaction.nonmemberEnumeration, false)
assert.notDeepEqual(secondOrgAlertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys, alertTermsExport.sharedWatchlistDownstreamProof.alertBridge.alertGeneratorKeys)
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

const secondOrgAlertCaseVisibilityResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${secondOrganization.id}/alert-case-visibility`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(secondOrgAlertCaseVisibilityResponse.statusCode, 200, secondOrgAlertCaseVisibilityResponse.body)
const secondOrgAlertCaseVisibility = parseBody(secondOrgAlertCaseVisibilityResponse.body).alertCaseVisibility
assert.equal(secondOrgAlertCaseVisibility.schemaVersion, 'organization.alert_case_visibility.v1')
assert.equal(secondOrgAlertCaseVisibility.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertCaseVisibility.tenantId, secondOrganization.id)
assert.equal(secondOrgAlertCaseVisibility.member.role, 'owner')
assert.deepEqual(secondOrgAlertCaseVisibility.alertQueue.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertCaseVisibility.alertQueue.watchlistItemIds, adminAlertCaseVisibility.alertQueue.watchlistItemIds)
assert.notDeepEqual(secondOrgAlertCaseVisibility.alertQueue.alertGeneratorKeys, adminAlertCaseVisibility.alertQueue.alertGeneratorKeys)
assert.deepEqual(secondOrgAlertCaseVisibility.workflowState.alertListing.requiredFilters.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.equal(secondOrgAlertCaseVisibility.workflowState.alertListing.requiredFilters.organizationId, secondOrganization.id)
assert.notDeepEqual(secondOrgAlertCaseVisibility.workflowState.alertListing.requiredFilters.alertGeneratorKeys, adminAlertCaseVisibility.workflowState.alertListing.requiredFilters.alertGeneratorKeys)
assert.equal(secondOrgAlertCaseVisibility.workflowState.alertRecord.crossTenantCollisionAllowed, false)
assert.deepEqual(secondOrgAlertCaseVisibility.analystPortalAdapter.watchlistScope.activeWatchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertCaseVisibility.analystPortalAdapter.watchlistScope.alertGeneratorKeys, adminAlertCaseVisibility.analystPortalAdapter.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertCaseVisibility.analystPortalAdapter.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertCaseVisibility.analystPortalAdapter.redaction.nonmemberEnumeration, false)
assert.deepEqual(secondOrgAlertCaseVisibility.caseWorkflow.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertCaseVisibility.caseWorkflow.alertGeneratorKeys, adminAlertCaseVisibility.caseWorkflow.alertGeneratorKeys)
assert.equal(secondOrgAlertCaseVisibility.caseVisibilityConsumer.organizationId, secondOrganization.id)
assert.equal(secondOrgAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.ownerOrganizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.alertGeneratorKeys, adminAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertCaseVisibility.caseVisibilityConsumer.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertCaseVisibility.caseVisibilityConsumer.denialContract.nonmemberEnumeration, false)
assert.ok(secondOrgAlertCaseVisibility.caseVisibilityConsumer.noLeakFields.includes('otherOrg.caseIds'))
assert.equal(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.organizationId, secondOrganization.id)
assert.deepEqual(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.watchlistItemIds, [secondOrgWatchlistItem.id])
assert.notDeepEqual(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.alertGeneratorKeys, adminAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.alertGeneratorKeys)
assert.equal(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.watchlistScope.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertCaseVisibility.alertCasePersistenceReadiness.readyForPersistence, true)
assert.equal(secondOrgAlertCaseVisibility.guardrails.crossTenantCollisionAllowed, false)
assert.equal(secondOrgAlertCaseVisibility.guardrails.nonmemberEnumeration, false)
assert.ok(secondOrgAlertCaseVisibility.guardrails.noLeakFields.includes('otherOrg.watchlistItemIds'))

const secondOrgListResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${secondOrganization.id}/watchlists`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(secondOrgListResponse.statusCode, 200, secondOrgListResponse.body)
assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.organizationId), [secondOrganization.id])
assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.id), [secondOrgWatchlistItem.id])
assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.enabled), [true])
assert.deepEqual(parseBody(secondOrgListResponse.body).watchlistItems.map((item: Row) => item.disabledReason), [null])

const wrongOrgWatchlistReadResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${secondOrganization.id}/watchlists/${ownerWatchlistItem.id}`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(wrongOrgWatchlistReadResponse.statusCode, 404, wrongOrgWatchlistReadResponse.body)
const wrongOrgWatchlistReadDenied = parseBody(wrongOrgWatchlistReadResponse.body).watchlistLookupDenial
assert.equal(wrongOrgWatchlistReadDenied.schemaVersion, 'organization.watchlist_lookup_denial.v1')
assert.equal(wrongOrgWatchlistReadDenied.organizationId, secondOrganization.id)
assert.equal(wrongOrgWatchlistReadDenied.tenantId, secondOrganization.id)
assert.equal(wrongOrgWatchlistReadDenied.actorId, 'org_smoke_owner')
assert.equal(wrongOrgWatchlistReadDenied.actorRole, 'owner')
assert.equal(wrongOrgWatchlistReadDenied.action, 'read_watchlist')
assert.equal(wrongOrgWatchlistReadDenied.itemId, ownerWatchlistItem.id)
assert.equal(wrongOrgWatchlistReadDenied.blockerCode, 'watchlist_not_found_or_cross_org')
assert.equal(wrongOrgWatchlistReadDenied.nonmemberEnumeration, false)
assert.equal(wrongOrgWatchlistReadDenied.crossOrgEnumerationAllowed, false)
assert.equal(wrongOrgWatchlistReadDenied.deniedReadDoesNotAffectActiveTerms, true)
assert.equal(wrongOrgWatchlistReadDenied.readinessRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(wrongOrgWatchlistReadDenied.readinessRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(wrongOrgWatchlistReadDenied.readinessRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
assert.equal(wrongOrgWatchlistReadDenied.readinessRefs.caseVisibilityConsumer, 'organization.case_visibility_consumer.v1')
assert.equal(wrongOrgWatchlistReadDenied.readinessRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
assert.ok(wrongOrgWatchlistReadDenied.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
assert.ok(wrongOrgWatchlistReadDenied.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
assert.ok(wrongOrgWatchlistReadDenied.blockedConsumerContracts.includes('organization.webhook_destination_access_decision.v1'))
assert.ok(wrongOrgWatchlistReadDenied.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
assert.ok(wrongOrgWatchlistReadDenied.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.ok(wrongOrgWatchlistReadDenied.noLeakFields.includes('otherOrg.webhookDestinationIds'))
assert.ok(wrongOrgWatchlistReadDenied.noLeakFields.includes('otherOrg.caseIds'))

const wrongOrgWatchlistUpdateResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${secondOrganization.id}/watchlists/${ownerWatchlistItem.id}`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { kind: 'domain', value: 'wrong-org-update.example', reason: 'Wrong org item mutation must not enumerate.', requestId: 'smoke-wrong-org-watchlist-update-denied' },
})
assert.equal(wrongOrgWatchlistUpdateResponse.statusCode, 404, wrongOrgWatchlistUpdateResponse.body)
const wrongOrgWatchlistUpdateDenied = parseBody(wrongOrgWatchlistUpdateResponse.body).watchlistLookupDenial
assert.equal(wrongOrgWatchlistUpdateDenied.schemaVersion, 'organization.watchlist_lookup_denial.v1')
assert.equal(wrongOrgWatchlistUpdateDenied.organizationId, secondOrganization.id)
assert.equal(wrongOrgWatchlistUpdateDenied.tenantId, secondOrganization.id)
assert.equal(wrongOrgWatchlistUpdateDenied.actorId, 'org_smoke_owner')
assert.equal(wrongOrgWatchlistUpdateDenied.actorRole, 'owner')
assert.equal(wrongOrgWatchlistUpdateDenied.action, 'update_watchlist')
assert.equal(wrongOrgWatchlistUpdateDenied.itemId, ownerWatchlistItem.id)
assert.equal(wrongOrgWatchlistUpdateDenied.blockerCode, 'watchlist_not_found_or_cross_org')
assert.equal(wrongOrgWatchlistUpdateDenied.nonmemberEnumeration, false)
assert.equal(wrongOrgWatchlistUpdateDenied.crossOrgEnumerationAllowed, false)
assert.equal(wrongOrgWatchlistUpdateDenied.deniedReadDoesNotAffectActiveTerms, true)
assert.equal(wrongOrgWatchlistUpdateDenied.readinessRefs.sharedWatchlistReadiness, 'organization.shared_watchlist_readiness_export.v1')
assert.equal(wrongOrgWatchlistUpdateDenied.readinessRefs.alertGenerationConsumer, 'organization.watchlist_alert_generation_consumer.v1')
assert.equal(wrongOrgWatchlistUpdateDenied.readinessRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
assert.equal(wrongOrgWatchlistUpdateDenied.readinessRefs.caseVisibilityConsumer, 'organization.case_visibility_consumer.v1')
assert.equal(wrongOrgWatchlistUpdateDenied.readinessRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
assert.ok(wrongOrgWatchlistUpdateDenied.blockedConsumerContracts.includes('organization.shared_watchlist_readiness_export.v1'))
assert.ok(wrongOrgWatchlistUpdateDenied.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
assert.ok(wrongOrgWatchlistUpdateDenied.blockedConsumerContracts.includes('organization.webhook_destination_access_decision.v1'))
assert.ok(wrongOrgWatchlistUpdateDenied.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
assert.ok(wrongOrgWatchlistUpdateDenied.safeFields.includes('itemId'))
assert.ok(wrongOrgWatchlistUpdateDenied.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.ok(wrongOrgWatchlistUpdateDenied.noLeakFields.includes('otherOrg.webhookDestinationIds'))
assert.ok(wrongOrgWatchlistUpdateDenied.noLeakFields.includes('otherOrg.caseIds'))
assert.equal(wrongOrgWatchlistUpdateDenied.serviceLogAction, 'organization_watchlist_lookup_denied')
assert.equal(wrongOrgWatchlistUpdateDenied.requestId, 'smoke-wrong-org-watchlist-update-denied')

const alertTermsRetryResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-ready-retry`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(alertTermsRetryResponse.statusCode, 200, alertTermsRetryResponse.body)
const alertTermsRetryExport = parseBody(alertTermsRetryResponse.body).alertTermsExport
assert.ok(alertTermsRetryExport.activeTerms.every((term: Row) => term.enabled === true))
assert.ok(alertTermsRetryExport.activeTerms.every((term: Row) => term.disabledReason === null))
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
assert.equal(domainReference.alertOwnership.schemaVersion, 'organization.alert_ownership.v1')
assert.equal(domainReference.alertOwnership.organizationId, organization.id)
assert.equal(domainReference.alertOwnership.tenantId, organization.id)
assert.equal(domainReference.alertOwnership.ownerOrganizationId, organization.id)
assert.equal(domainReference.alertOwnership.watchlistItemId, domainReference.watchlistItemId)
assert.equal(domainReference.alertOwnership.watchlistId, domainReference.watchlistItemId)
assert.equal(domainReference.alertOwnership.sourceFamily, 'organization_watchlist')
assert.equal(domainReference.alertOwnership.route, 'organization_watchlist')
assert.equal(domainReference.alertOwnership.casePath, domainReference.alert.casePath)
assert.equal(domainReference.alertOwnership.dedupeKey, domainReference.alert.dedupeKey)
assert.equal(domainReference.alertOwnership.visibilityPolicy, 'admins')
assert.deepEqual(domainReference.alertOwnership.allowedViewerRoles, ['owner', 'admin'])
assert.ok(domainReference.alertOwnership.requiredPersistedFields.includes('workflowContext.organizationId'))
assert.ok(domainReference.alertOwnership.requiredPersistedFields.includes('workflowContext.visibilityDecision'))
assert.ok(domainReference.alertOwnership.lifecycleBlockers.includes('watchlist_archived'))
assert.ok(domainReference.alertOwnership.noLeakFields.includes('otherOrg.alertGeneratorKeys'))
assert.equal(domainReference.alertOwnership.crossTenantCollisionAllowed, false)
assert.equal(domainReference.ownerContext.schemaVersion, 'organization.alert_reference_owner_context.v1')
assert.equal(domainReference.ownerContext.organizationId, organization.id)
assert.equal(domainReference.ownerContext.tenantId, organization.id)
assert.equal(domainReference.ownerContext.ownerOrganizationId, organization.id)
assert.equal(domainReference.ownerContext.watchlistItemId, domainReference.watchlistItemId)
assert.equal(domainReference.ownerContext.watchlistId, domainReference.watchlistItemId)
assert.equal(domainReference.ownerContext.watchlistKind, 'domain')
assert.equal(domainReference.ownerContext.createdBy, 'org_smoke_owner')
assert.equal(domainReference.ownerContext.visibilityPolicy, 'admins')
assert.deepEqual(domainReference.ownerContext.allowedViewerRoles, ['owner', 'admin'])
assert.equal(domainReference.ownerContext.alertGeneratorKey, domainReference.alert.dedupeKey)
assert.equal(domainReference.ownerContext.webhookDestinationOrgField, 'destination.org_id')
assert.equal(domainReference.ownerContext.casePath, domainReference.alert.casePath)
assert.equal(domainReference.ownerContext.crossTenantCollisionAllowed, false)
assert.deepEqual(domainReference.alert.alertOwnership, domainReference.alertOwnership)
assert.equal(domainReference.alert.workflowContext.organizationId, organization.id)
assert.equal(domainReference.alert.workflowContext.tenantId, organization.id)
assert.equal(domainReference.alert.workflowContext.ownerOrganizationId, organization.id)
assert.deepEqual(domainReference.alert.workflowContext.watchlistItemIds, [domainReference.watchlistItemId])
assert.deepEqual(domainReference.alert.workflowContext.alertGeneratorKeys, [domainReference.alert.dedupeKey])
assert.deepEqual(domainReference.alert.workflowContext.ownerContext, domainReference.ownerContext)
assert.equal(domainReference.alert.defaultWebhookPolicy, 'manual_selection')
assert.equal(domainReference.alert.alertVisibilityPolicy, 'admins')
assert.equal(domainReference.alert.memberCount, 4)
assert.equal(domainReference.alert.activeMemberCount, 4)
assert.equal(domainReference.alert.ownerCount, 1)
assert.deepEqual(domainReference.alert.allowedViewerRoles, ['owner', 'admin'])
assert.equal(domainReference.alert.removedMemberDenialReason, 'member_removed')
assert.equal(domainReference.alert.deactivatedMemberDenialReason, 'member_deactivated')
assert.equal(domainReference.alert.pendingInviteCount, 12)
assert.equal(domainReference.alert.sharedWatchlistCount, 5)
assert.equal(domainReference.alert.readinessStatus, 'ready')
assert.equal(domainReference.webhookContract.orgId, organization.id)
assert.equal(domainReference.webhookContract.schemaVersion, 'organization.alert_reference_webhook_contract.v1')
assert.equal(domainReference.webhookContract.organizationId, organization.id)
assert.equal(domainReference.webhookContract.tenantId, organization.id)
assert.equal(domainReference.webhookContract.watchlistId, domainReference.watchlistItemId)
assert.equal(domainReference.webhookContract.defaultWebhookPolicy, 'manual_selection')
assert.equal(domainReference.webhookContract.alertVisibilityPolicy, 'admins')
assert.deepEqual(domainReference.webhookContract.allowedViewerRoles, ['owner', 'admin'])
assert.equal(domainReference.webhookContract.requiredDestinationOrgId, organization.id)
assert.equal(domainReference.webhookContract.selectedDestinationOrgField, 'destination.org_id')
assert.equal(domainReference.webhookContract.selectedDestinationIdField, 'webhookDestinationIds[]')
assert.deepEqual(domainReference.webhookContract.ownerContext, domainReference.ownerContext)
assert.ok(domainReference.webhookContract.noLeakFields.includes('destination.secret'))
assert.ok(domainReference.webhookContract.noLeakFields.includes('otherOrg.destinationIds'))
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
assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.schemaVersion, 'organization.watchlist_alert_generation_consumer_denial.v1')
assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.member.role, 'viewer')
assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canReadSharedWatchlists, true)
assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canExportAlertTerms, false)
assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.canMutateWatchlists, false)
assert.deepEqual(viewerAlertTermsDenied.alertGenerationConsumerDenial.allowedExportRoles, ['owner', 'admin'])
assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.denialReason, 'role_not_allowed')
assert.equal(viewerAlertTermsDenied.alertGenerationConsumerDenial.nonmemberEnumeration, false)
assert.ok(viewerAlertTermsDenied.alertGenerationConsumerDenial.noLeakFields.includes('activeTerms[]'))
assert.ok(viewerAlertTermsDenied.alertGenerationConsumerDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
assert.ok(!JSON.stringify(viewerAlertTermsDenied.alertGenerationConsumerDenial).includes('acme-shared.example'))
assert.equal(viewerAlertTermsDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

const ownerDisablesActorResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}?requestId=smoke-disable-actor`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: { reason: 'Retire actor watchlist after proof.' },
})
assert.equal(ownerDisablesActorResponse.statusCode, 200, ownerDisablesActorResponse.body)
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.action, 'disabled')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.requestId, 'smoke-disable-actor')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.reason, 'Retire actor watchlist after proof.')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.statusAfter, 'archived')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.enabledAfter, false)
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.disabledReasonAfter, 'watchlist_archived')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.cleanupRoute, 'POST /api/organizations/:id/watchlists/cleanup')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.mutationAfterArchiveDeniedByLookup, true)
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.lifecycleTransition.lookupDenialBlockerAfter, 'watchlist_not_found_or_cross_org')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.action, 'disabled')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.statusAfter, 'archived')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.enabledAfter, false)
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.lifecycleBlockerAfter, 'watchlist_archived')
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.activeTermsIncludedInExport, false)
assert.equal(parseBody(ownerDisablesActorResponse.body).operation.mutationReceipt.archivedMutationDeniedByLookup, true)
assert.equal(parseBody(ownerDisablesActorResponse.body).watchlistItem.status, 'archived')
assert.equal(parseBody(ownerDisablesActorResponse.body).watchlistItem.enabled, false)
assert.equal(parseBody(ownerDisablesActorResponse.body).watchlistItem.disabledReason, 'watchlist_archived')

const archivedActorUpdateDeniedResponse = await app.inject({
    method: 'PUT',
    url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
    payload: {
        kind: 'actor',
        value: 'retired actor renamed',
        reason: 'Archived watchlists must stay excluded from active alert matching.',
        requestId: 'smoke-archived-watchlist-update-denied',
    },
})
assert.equal(archivedActorUpdateDeniedResponse.statusCode, 404, archivedActorUpdateDeniedResponse.body)
const archivedActorUpdateDenied = parseBody(archivedActorUpdateDeniedResponse.body).watchlistLookupDenial
assert.equal(archivedActorUpdateDenied.schemaVersion, 'organization.watchlist_lookup_denial.v1')
assert.equal(archivedActorUpdateDenied.organizationId, organization.id)
assert.equal(archivedActorUpdateDenied.tenantId, organization.id)
assert.equal(archivedActorUpdateDenied.actorRole, 'owner')
assert.equal(archivedActorUpdateDenied.action, 'update_watchlist')
assert.equal(archivedActorUpdateDenied.itemId, actorWatchlistItem.id)
assert.equal(archivedActorUpdateDenied.blockerCode, 'watchlist_not_found_or_cross_org')
assert.equal(archivedActorUpdateDenied.nonmemberEnumeration, false)
assert.ok(archivedActorUpdateDenied.noLeakFields.includes('activeTerms[]'))
assert.equal(archivedActorUpdateDenied.requestId, 'smoke-archived-watchlist-update-denied')

const archivedWatchlistsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists?status=archived`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(archivedWatchlistsResponse.statusCode, 200, archivedWatchlistsResponse.body)
assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.id), [actorWatchlistItem.id])
assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.enabled), [false])
assert.deepEqual(parseBody(archivedWatchlistsResponse.body).watchlistItems.map((item: Row) => item.disabledReason), ['watchlist_archived'])
const archivedActorReadResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/${actorWatchlistItem.id}`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(archivedActorReadResponse.statusCode, 200, archivedActorReadResponse.body)
const archivedActorReadContract = parseBody(archivedActorReadResponse.body).watchlistReadContract
assert.equal(archivedActorReadContract.termLifecycle.schemaVersion, 'organization.watchlist_item_term_lifecycle.v1')
assert.equal(archivedActorReadContract.termLifecycle.watchlistItemId, actorWatchlistItem.id)
assert.equal(archivedActorReadContract.termLifecycle.status, 'archived')
assert.equal(archivedActorReadContract.termLifecycle.activeForAlertMatching, false)
assert.equal(archivedActorReadContract.termLifecycle.deletedByArchive, true)
assert.equal(archivedActorReadContract.termLifecycle.blockerCode, 'watchlist_archived')
assert.equal(archivedActorReadContract.termLifecycle.lifecycleReason, 'Retire actor watchlist after proof.')
assert.equal(archivedActorReadContract.termLifecycle.lifecycleRequestId, 'smoke-disable-actor')
assert.ok(archivedActorReadContract.termLifecycle.noLeakFields.includes('destination.secret'))

const alertTermsAfterArchiveResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-alert-terms-after-archive`,
    headers: authHeaders('org_smoke_owner', 'owner-token'),
})
assert.equal(alertTermsAfterArchiveResponse.statusCode, 200, alertTermsAfterArchiveResponse.body)
const alertTermsAfterArchive = parseBody(alertTermsAfterArchiveResponse.body).alertTermsExport
assert.equal(alertTermsAfterArchive.activeTerms.length, 4)
assert.equal(alertTermsAfterArchive.excluded.archivedCount, 1)
assert.deepEqual(alertTermsAfterArchive.termLifecycle.archivedItemIds, [actorWatchlistItem.id])
assert.deepEqual(alertTermsAfterArchive.termLifecycle.deletedTermIds, [actorWatchlistItem.id])
assert.equal(alertTermsAfterArchive.termLifecycle.deletedTermCount, 1)
assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].watchlistItemId, actorWatchlistItem.id)
assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].status, 'archived')
assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].blockerCode, 'watchlist_archived')
assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].deletedByArchive, true)
assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].lifecycleReason, 'Retire actor watchlist after proof.')
assert.equal(alertTermsAfterArchive.termLifecycle.excludedFromAlertMatching[0].lifecycleRequestId, 'smoke-disable-actor')
assert.deepEqual(alertTermsAfterArchive.alertGenerationConsumer.lifecycleExclusions.deletedTermIds, [actorWatchlistItem.id])
assert.ok(alertTermsAfterArchive.alertGenerationConsumer.blockerCodes.includes('watchlist_archived'))
assert.ok(!alertTermsAfterArchive.alertGenerationConsumer.activeTerms.some((term: Row) => term.watchlistItemId === actorWatchlistItem.id))
assert.equal(alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.termCount, 4)
assert.ok(!alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.terms.some((term: Row) => term.watchlistItemId === actorWatchlistItem.id))
assert.deepEqual(alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.lifecycleExclusions.archivedItemIds, [actorWatchlistItem.id])
assert.deepEqual(alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.lifecycleExclusions.deletedTermIds, [actorWatchlistItem.id])
assert.equal(alertTermsAfterArchive.alertGenerationConsumer.matchingInputReceipt.scopeGuardrails.crossOrgReadAllowed, false)
assert.equal(alertTermsAfterArchive.termExportDeltaReceipt.activeTermCount, 4)
assert.equal(alertTermsAfterArchive.termExportDeltaReceipt.excludedTermCount, 1)
assert.deepEqual(alertTermsAfterArchive.termExportDeltaReceipt.excludedWatchlistItemIds, [actorWatchlistItem.id])
assert.deepEqual(alertTermsAfterArchive.termExportDeltaReceipt.excludedReasons, ['watchlist_archived'])
assert.deepEqual(alertTermsAfterArchive.termExportDeltaReceipt.lifecycle.archivedItemIds, [actorWatchlistItem.id])
assert.deepEqual(alertTermsAfterArchive.termExportDeltaReceipt.lifecycle.deletedTermIds, [actorWatchlistItem.id])
assert.ok(alertTermsAfterArchive.termExportDeltaReceipt.blockerCodes.includes('watchlist_archived'))
assert.ok(!alertTermsAfterArchive.termExportDeltaReceipt.exportedWatchlistItemIds.includes(actorWatchlistItem.id))
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
const memberCleanupDenied = parseBody(memberCleanupDeniedResponse.body).watchlistMutationDenial
assert.equal(memberCleanupDenied.schemaVersion, 'organization.watchlist_mutation_denial.v1')
assert.equal(memberCleanupDenied.organizationId, organization.id)
assert.equal(memberCleanupDenied.tenantId, organization.id)
assert.equal(memberCleanupDenied.actorId, 'org_smoke_member')
assert.equal(memberCleanupDenied.actorRole, 'member')
assert.equal(memberCleanupDenied.action, 'cleanup_watchlists')
assert.equal(memberCleanupDenied.itemId, null)
assert.equal(memberCleanupDenied.denialReason, 'role_not_allowed')
assert.deepEqual(memberCleanupDenied.allowedRoles, ['owner', 'admin'])
assert.deepEqual(memberCleanupDenied.readRoles, ['owner', 'admin', 'member', 'viewer'])
assert.equal(memberCleanupDenied.memberCanReadSharedWatchlists, true)
assert.equal(memberCleanupDenied.memberCanMutateSharedWatchlists, false)
assert.equal(memberCleanupDenied.viewerCanReadSharedWatchlists, true)
assert.equal(memberCleanupDenied.viewerCanMutateSharedWatchlists, false)
assert.equal(memberCleanupDenied.downstreamRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
assert.equal(memberCleanupDenied.deniedMutationDoesNotAffectActiveTerms, true)
assert.equal(memberCleanupDenied.activeExportRemainsAvailableToAllowedRoles, true)
assert.ok(memberCleanupDenied.noLeakFields.includes('case.evidence.rawContent'))
assert.equal(memberCleanupDenied.nonmemberEnumeration, false)
assert.equal(memberCleanupDenied.serviceLogAction, 'organization_watchlist_mutation_denied')
assert.equal(memberCleanupDenied.requestId, 'smoke-member-cleanup-denied')
assert.equal(memberCleanupDenied.reason, 'Member cleanup denied.')
assert.equal(memberCleanupDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

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
assert.deepEqual(cleanupAfterArchiveExport.termLifecycle.deletedTermIds.sort(), [actorWatchlistItem.id, cleanupCompanyItem.id, cleanupKeywordItem.id].sort())
assert.equal(cleanupAfterArchiveExport.termLifecycle.deletedTermCount, 3)
assert.ok(cleanupAfterArchiveExport.termLifecycle.excludedFromAlertMatching.every((item: Row) => item.deletedByArchive === true))
assert.ok(cleanupAfterArchiveExport.termLifecycle.excludedFromAlertMatching.some((item: Row) => item.watchlistItemId === cleanupCompanyItem.id && item.lifecycleRequestId === 'smoke-proof-cleanup'))
assert.ok(cleanupAfterArchiveExport.termLifecycle.excludedFromAlertMatching.some((item: Row) => item.watchlistItemId === cleanupKeywordItem.id && item.lifecycleReason === 'Archive disposable live proof watchlists.'))
assert.ok(!cleanupAfterArchiveExport.termLifecycle.activeItemIds.includes(cleanupCompanyItem.id))
assert.ok(!cleanupAfterArchiveExport.termLifecycle.activeItemIds.includes(cleanupKeywordItem.id))
assert.ok(cleanupAfterArchiveExport.alertBridgeContract.typedBlockers.some((blocker: Row) => blocker.code === 'archived_watchlist_excluded' && blocker.count === 3))
assert.ok(cleanupAfterArchiveExport.alertBridgeContract.lifecycleReadiness.typedBlockers.some((blocker: Row) => blocker.code === 'cleanup_required' && blocker.count === 3))
assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.readyForReplay, true)
assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)
assert.equal(cleanupAfterArchiveExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.archivedExcludedCount, 3)
assert.equal(cleanupAfterArchiveExport.downstreamAuthorization.watchlists.archivedCount, 3)
assert.ok(cleanupAfterArchiveExport.downstreamAuthorization.downstream.alertGeneration.blockerCodes.includes('watchlist_archived'))
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.status === 'active'))
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.enabled === true))
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.disabledReason === null))
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.enabled === true))
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.disabledReason === null))
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationRef.lifecycle.enabled === true))
assert.ok(cleanupAfterArchiveExport.activeTerms.every((term: Row) => term.alertGenerationReference.enabled === true))
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
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).watchlistItem.enabled, true)
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).watchlistItem.disabledReason, null)
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.action, 'restore')
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.lifecycleTransition.statusAfter, 'active')
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.lifecycleTransition.enabledAfter, true)
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.lifecycleTransition.disabledReasonAfter, null)
assert.equal(parseBody(restoreArchivedWatchlistResponse.body).operation.lifecycleTransition.alertGenerationEligibleAfter, true)

const restoredExportResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-restored-export`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(restoredExportResponse.statusCode, 200, restoredExportResponse.body)
const restoredExport = parseBody(restoredExportResponse.body).alertTermsExport
assert.ok(restoredExport.activeTerms.some((term: Row) => term.watchlistItemId === cleanupKeywordItem.id))
assert.equal(restoredExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupKeywordItem.id).alertGenerationRef.lifecycle.requestId, 'smoke-restore-cleanup-keyword')
assert.equal(restoredExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupKeywordItem.id).enabled, true)
assert.equal(restoredExport.activeTerms.find((term: Row) => term.watchlistItemId === cleanupKeywordItem.id).disabledReason, null)
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
const memberRemoveViewerDenial = parseBody(memberRemoveViewerResponse.body).memberMutationDenial
assert.equal(memberRemoveViewerDenial.schemaVersion, 'organization.member_mutation_denial.v1')
assert.equal(memberRemoveViewerDenial.organizationId, organization.id)
assert.equal(memberRemoveViewerDenial.actorId, 'org_smoke_member')
assert.equal(memberRemoveViewerDenial.actorRole, 'member')
assert.equal(memberRemoveViewerDenial.targetUserId, 'org_smoke_viewer')
assert.equal(memberRemoveViewerDenial.targetRole, 'viewer')
assert.equal(memberRemoveViewerDenial.action, 'remove_member')
assert.equal(memberRemoveViewerDenial.requestedRole, null)
assert.equal(memberRemoveViewerDenial.denialReason, 'role_not_allowed')
assert.deepEqual(memberRemoveViewerDenial.allowedRoles, ['owner', 'admin'])
assert.deepEqual(memberRemoveViewerDenial.allowedTargetRoles, ['admin', 'member', 'viewer'])
assert.equal(memberRemoveViewerDenial.nonmemberEnumeration, false)
assert.equal(memberRemoveViewerDenial.serviceLogAction, 'organization_member_mutation_denied')

const adminRemoveOwnerResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/members/org_smoke_owner`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(adminRemoveOwnerResponse.statusCode, 403, adminRemoveOwnerResponse.body)
const adminRemoveOwnerDenial = parseBody(adminRemoveOwnerResponse.body).memberMutationDenial
assert.equal(adminRemoveOwnerDenial.actorRole, 'admin')
assert.equal(adminRemoveOwnerDenial.targetUserId, 'org_smoke_owner')
assert.equal(adminRemoveOwnerDenial.targetRole, 'owner')
assert.equal(adminRemoveOwnerDenial.action, 'remove_member')
assert.equal(adminRemoveOwnerDenial.adminCanMutateOwners, false)

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
const lastOwnerRemoveGuard = parseBody(lastOwnerGuardResponse.body).lastOwnerGuard
assert.equal(lastOwnerRemoveGuard.schemaVersion, 'organization.last_owner_guard.v1')
assert.equal(lastOwnerRemoveGuard.organizationId, organization.id)
assert.equal(lastOwnerRemoveGuard.actorId, 'org_smoke_admin')
assert.equal(lastOwnerRemoveGuard.actorRole, 'owner')
assert.equal(lastOwnerRemoveGuard.targetUserId, 'org_smoke_admin')
assert.equal(lastOwnerRemoveGuard.action, 'remove_owner')
assert.equal(lastOwnerRemoveGuard.requestedRole, null)
assert.equal(lastOwnerRemoveGuard.ownerCount, 1)
assert.equal(lastOwnerRemoveGuard.blockerCode, 'last_owner_guard')
assert.equal(lastOwnerRemoveGuard.destructiveMutationBlocked, true)
assert.equal(lastOwnerRemoveGuard.noOrphanedOrganization, true)
assert.equal(lastOwnerRemoveGuard.serviceLogAction, 'organization_last_owner_guard_blocked')

const viewerPendingInviteBeforeRemoval = nowRow({
    id: 'viewer-pending-before-removal',
    organization_id: organization.id,
    email: 'viewer@example.test',
    role: 'viewer',
    invited_by: 'org_smoke_owner',
    status: 'pending',
    accepted_at: null,
    accepted_by: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
})
invites.set(viewerPendingInviteBeforeRemoval.id, viewerPendingInviteBeforeRemoval)
const removeViewerResponse = await app.inject({
    method: 'DELETE',
    url: `/api/organizations/${organization.id}/members/org_smoke_viewer`,
    headers: authHeaders('org_smoke_admin', 'admin-token'),
})
assert.equal(removeViewerResponse.statusCode, 200, removeViewerResponse.body)
assert.equal(parseBody(removeViewerResponse.body).member.status, 'removed')
const removeViewerCleanup = parseBody(removeViewerResponse.body).memberRemovalCleanup
assert.equal(removeViewerCleanup.schemaVersion, 'organization.member_removal_cleanup.v1')
assert.equal(removeViewerCleanup.organizationId, organization.id)
assert.equal(removeViewerCleanup.tenantId, organization.id)
assert.equal(removeViewerCleanup.targetUserId, 'org_smoke_viewer')
assert.equal(removeViewerCleanup.targetRole, 'viewer')
assert.deepEqual(removeViewerCleanup.revokedInviteIds, [viewerPendingInviteBeforeRemoval.id])
assert.equal(removeViewerCleanup.revokedInviteCount, 1)
assert.equal(removeViewerCleanup.revokedInviteStatus, 'revoked')
assert.equal(removeViewerCleanup.staleInviteAcceptanceBlocker, 'member_revoked')
assert.equal(removeViewerCleanup.noOrphanedInviteTokens, true)
assert.equal(removeViewerCleanup.consumerAccessRevocation.schemaVersion, 'organization.member_consumer_access_revocation.v1')
assert.equal(removeViewerCleanup.consumerAccessRevocation.organizationId, organization.id)
assert.equal(removeViewerCleanup.consumerAccessRevocation.tenantId, organization.id)
assert.equal(removeViewerCleanup.consumerAccessRevocation.targetUserId, 'org_smoke_viewer')
assert.equal(removeViewerCleanup.consumerAccessRevocation.targetRole, 'viewer')
assert.deepEqual(removeViewerCleanup.consumerAccessRevocation.revokedInviteIds, [viewerPendingInviteBeforeRemoval.id])
assert.equal(removeViewerCleanup.consumerAccessRevocation.revokedInviteCount, 1)
assert.equal(removeViewerCleanup.consumerAccessRevocation.blockerCode, 'member_revoked')
assert.equal(removeViewerCleanup.consumerAccessRevocation.noEnumeration, true)
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedRoutes.includes('GET /api/organizations/:id/watchlists'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedRoutes.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedRoutes.includes('GET /api/organizations/:id/alert-case-visibility'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedRoutes.includes('POST /v1/dwm/webhooks/deliver'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.watchlist_alert_generation_consumer.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.shared_watchlist_readiness_export.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.webhook_destination_access_decision.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.denialContracts.includes('organization.access_denial.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.noLeakFields.includes('activeTerms'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.noLeakFields.includes('otherOrg.watchlistItemIds'))
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.schemaVersion, 'organization.member_webhook_destination_access_revocation.v1')
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.organizationId, organization.id)
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.tenantId, organization.id)
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.targetUserId, 'org_smoke_viewer')
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.targetRole, 'viewer')
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedRoute, 'POST /v1/dwm/webhooks/deliver')
assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedContracts.includes('organization.webhook_destination_ownership.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedContracts.includes('organization.webhook_destination_access_decision.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.blockedContracts.includes('organization.shared_watchlist_readiness_export.v1'))
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.requiredMembershipStatus, 'active')
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.removedMemberBlocker, 'member_revoked')
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.revokedInviteBlocker, 'member_revoked')
assert.equal(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.nonmemberDestinationEnumeration, false)
assert.ok(removeViewerCleanup.consumerAccessRevocation.webhookDestinationAccessRevocation.noLeakFields.includes('destination.secret'))
assert.equal(removeViewerCleanup.consumerAccessRecovery.schemaVersion, 'organization.member_consumer_access_recovery.v1')
assert.equal(removeViewerCleanup.consumerAccessRecovery.organizationId, organization.id)
assert.equal(removeViewerCleanup.consumerAccessRecovery.tenantId, organization.id)
assert.equal(removeViewerCleanup.consumerAccessRecovery.targetUserId, 'org_smoke_viewer')
assert.equal(removeViewerCleanup.consumerAccessRecovery.targetRoleBeforeRemoval, 'viewer')
assert.equal(removeViewerCleanup.consumerAccessRecovery.currentMemberStatus, 'removed')
assert.equal(removeViewerCleanup.consumerAccessRecovery.automaticRegrantAllowed, false)
assert.equal(removeViewerCleanup.consumerAccessRecovery.ownerlessRecoveryMutationAllowed, false)
assert.equal(removeViewerCleanup.consumerAccessRecovery.directMembershipMutationAllowed, false)
assert.equal(removeViewerCleanup.consumerAccessRecovery.requiresOwnerAdminReview, true)
assert.equal(removeViewerCleanup.consumerAccessRecovery.requiresAcceptedInvite, true)
assert.deepEqual(removeViewerCleanup.consumerAccessRecovery.recoveryActorRoles, ['owner', 'admin'])
assert.deepEqual(removeViewerCleanup.consumerAccessRecovery.requiredSteps, [
    'owner_or_admin_review',
    'create_new_invite',
    'target_accepts_invite',
    'new_membership_role_applied',
])
assert.ok(removeViewerCleanup.consumerAccessRecovery.blockedUntilAcceptedMembership.includes('GET /api/organizations/:id/watchlists/alert-terms'))
assert.ok(removeViewerCleanup.consumerAccessRecovery.blockedUntilAcceptedMembership.includes('GET /api/organizations/:id/alert-case-visibility'))
assert.ok(removeViewerCleanup.consumerAccessRecovery.blockedUntilAcceptedMembership.includes('POST /v1/dwm/webhooks/deliver'))
assert.equal(removeViewerCleanup.consumerAccessRecovery.recoveryRoutes.createInvite, 'POST /api/organizations/:id/invites')
assert.equal(removeViewerCleanup.consumerAccessRecovery.recoveryRoutes.acceptInvite, 'POST /api/organizations/invites/:inviteId/accept')
assert.ok(removeViewerCleanup.consumerAccessRecovery.recoveryReceipts.includes('organization.invite_consumer_visibility_receipt.v1'))
assert.ok(removeViewerCleanup.consumerAccessRecovery.recoveryReceipts.includes('organization.member_role_consumer_visibility_receipt.v1'))
assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.schemaVersion, 'organization.member_support_assisted_recovery_receipt.v1')
assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.supportActionHistoryBridge, 'organization.member_recovery_support_history_bridge.v1')
assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.allowedOutcome, 'invite_required')
assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.directMembershipMutationAllowed, false)
assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.ownerlessRecoveryMutationAllowed, false)
assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.requiresAcceptedInvite, true)
assert.ok(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.requiredAuditFields.includes('supportSessionId'))
assert.ok(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.blockedRoutesUntilAcceptedMembership.includes('POST /v1/dwm/webhooks/deliver'))
assert.equal(removeViewerCleanup.consumerAccessRecovery.supportAssistedRecoveryReceipt.nonmemberEnumeration, false)
assert.equal(removeViewerCleanup.consumerAccessRecovery.blockerCode, 'member_revoked')
assert.equal(removeViewerCleanup.consumerAccessRecovery.nonmemberEnumeration, false)
assert.equal(invites.get(viewerPendingInviteBeforeRemoval.id)?.status, 'revoked')

const staleRemovedViewerInvite = nowRow({
    id: 'stale-removed-viewer-invite',
    organization_id: organization.id,
    email: 'viewer@example.test',
    role: 'member',
    invited_by: 'org_smoke_owner',
    status: 'pending',
    accepted_at: null,
    accepted_by: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
})
invites.set(staleRemovedViewerInvite.id, staleRemovedViewerInvite)
const staleRemovedViewerAcceptResponse = await app.inject({
    method: 'POST',
    url: `/api/organizations/invites/${staleRemovedViewerInvite.id}/accept`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(staleRemovedViewerAcceptResponse.statusCode, 409, staleRemovedViewerAcceptResponse.body)
const staleRemovedViewerAcceptDenial = parseBody(staleRemovedViewerAcceptResponse.body).inviteAcceptanceDenial
assert.equal(staleRemovedViewerAcceptDenial.schemaVersion, 'organization.invite_acceptance_denial.v1')
assert.equal(staleRemovedViewerAcceptDenial.organizationId, organization.id)
assert.equal(staleRemovedViewerAcceptDenial.inviteId, staleRemovedViewerInvite.id)
assert.equal(staleRemovedViewerAcceptDenial.inviteStatus, 'pending')
assert.equal(staleRemovedViewerAcceptDenial.memberStatus, 'removed')
assert.equal(staleRemovedViewerAcceptDenial.blockerCode, 'member_revoked')
assert.equal(staleRemovedViewerAcceptDenial.removedMemberDenied, true)
assert.equal(staleRemovedViewerAcceptDenial.nonmemberEnumeration, false)
assert.ok(staleRemovedViewerAcceptDenial.safeFields.includes('memberStatus'))
assert.ok(staleRemovedViewerAcceptDenial.noLeakFields.includes('otherOrg.members'))
assert.ok(staleRemovedViewerAcceptDenial.noLeakFields.includes('destination.secret'))
assert.ok(staleRemovedViewerAcceptDenial.blockedConsumerContracts.includes('organization.case_visibility_consumer.v1'))
assert.ok(staleRemovedViewerAcceptDenial.blockedConsumerContracts.includes('organization.webhook_alert_delivery_readiness.v1'))
assert.equal(staleRemovedViewerAcceptDenial.readinessRefs.alertCasePersistence, 'organization.alert_case_bridge_persistence_receipt.v1')
assert.equal(staleRemovedViewerAcceptDenial.ownerlessRecoveryMutationAllowed, false)
assert.equal(staleRemovedViewerAcceptDenial.accessRequiresAcceptedMembership, true)

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

const removedViewerAlertTermsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms?requestId=smoke-removed-viewer-alert-terms`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(removedViewerAlertTermsResponse.statusCode, 404, removedViewerAlertTermsResponse.body)
const removedViewerAlertTermsDenial = parseBody(removedViewerAlertTermsResponse.body).organizationAccessDenial
assert.equal(removedViewerAlertTermsDenial.schemaVersion, 'organization.access_denial.v1')
assert.equal(removedViewerAlertTermsDenial.organizationId, organization.id)
assert.equal(removedViewerAlertTermsDenial.actorId, 'org_smoke_viewer')
assert.equal(removedViewerAlertTermsDenial.route, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(removedViewerAlertTermsDenial.blockerCode, 'nonmember_denied')
assert.equal(removedViewerAlertTermsDenial.nonmemberEnumeration, false)

const removedViewerCaseVisibilityResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-case-visibility?requestId=smoke-removed-viewer-case-visibility`,
    headers: authHeaders('org_smoke_viewer', 'viewer-token'),
})
assert.equal(removedViewerCaseVisibilityResponse.statusCode, 404, removedViewerCaseVisibilityResponse.body)
const removedViewerCaseVisibilityDenial = parseBody(removedViewerCaseVisibilityResponse.body).organizationAccessDenial
assert.equal(removedViewerCaseVisibilityDenial.schemaVersion, 'organization.access_denial.v1')
assert.equal(removedViewerCaseVisibilityDenial.organizationId, organization.id)
assert.equal(removedViewerCaseVisibilityDenial.actorId, 'org_smoke_viewer')
assert.equal(removedViewerCaseVisibilityDenial.route, 'GET /api/organizations/:id/alert-case-visibility')
assert.equal(removedViewerCaseVisibilityDenial.blockerCode, 'nonmember_denied')
assert.equal(removedViewerCaseVisibilityDenial.nonmemberEnumeration, false)
assert.equal(removedViewerCaseVisibilityDenial.downstreamRoutes.alertCaseVisibility, 'GET /api/organizations/:id/alert-case-visibility')
assert.equal(removedViewerCaseVisibilityDenial.downstreamRoutes.webhookDelivery, 'POST /v1/dwm/webhooks/deliver')
assert.equal(removedViewerCaseVisibilityDenial.downstreamRefs.caseVisibilityConsumer, 'organization.case_visibility_consumer.v1')
assert.equal(removedViewerCaseVisibilityDenial.downstreamRefs.webhookDestinationReadiness, 'organization.webhook_destination_readiness_bridge.v1')
assert.ok(removedViewerCaseVisibilityDenial.noLeakFields.includes('otherOrg.caseIds'))
assert.ok(removedViewerCaseVisibilityDenial.noLeakFields.includes('destination.secret'))
assert.equal(readiness.readinessProof.memberLifecycleProof.denialReasons.removedMember, 'member_removed')
assert.equal(readiness.readinessProof.memberLifecycleProof.denialReasons.expiredInvite, 'invite_expired')

const outsiderResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists`,
    headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-watchlists-denied' },
})
assert.equal(outsiderResponse.statusCode, 404, outsiderResponse.body)
const outsiderWatchlistsAccessDenial = parseBody(outsiderResponse.body).organizationAccessDenial
assert.equal(outsiderWatchlistsAccessDenial.schemaVersion, 'organization.access_denial.v1')
assert.equal(outsiderWatchlistsAccessDenial.organizationId, organization.id)
assert.equal(outsiderWatchlistsAccessDenial.actorId, 'org_smoke_outsider')
assert.equal(outsiderWatchlistsAccessDenial.route, 'GET /api/organizations/:id/watchlists')
assert.equal(outsiderWatchlistsAccessDenial.blockerCode, 'nonmember_denied')
assert.equal(outsiderWatchlistsAccessDenial.nonmemberEnumeration, false)
assert.ok(outsiderWatchlistsAccessDenial.noLeakFields.includes('watchlistScope.alertGeneratorKeys'))
assert.equal(outsiderWatchlistsAccessDenial.requestId, 'smoke-outsider-watchlists-denied')
const outsiderOrganizationReadResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}`,
    headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-org-read-denied' },
})
assert.equal(outsiderOrganizationReadResponse.statusCode, 404, outsiderOrganizationReadResponse.body)
const outsiderOrganizationAccessDenial = parseBody(outsiderOrganizationReadResponse.body).organizationAccessDenial
assert.equal(outsiderOrganizationAccessDenial.schemaVersion, 'organization.access_denial.v1')
assert.equal(outsiderOrganizationAccessDenial.organizationId, organization.id)
assert.equal(outsiderOrganizationAccessDenial.tenantId, organization.id)
assert.equal(outsiderOrganizationAccessDenial.actorId, 'org_smoke_outsider')
assert.equal(outsiderOrganizationAccessDenial.route, 'GET /api/organizations/:id')
assert.equal(outsiderOrganizationAccessDenial.blockerCode, 'nonmember_denied')
assert.equal(outsiderOrganizationAccessDenial.denialReason, 'not_member')
assert.equal(outsiderOrganizationAccessDenial.nonmemberEnumeration, false)
assert.ok(outsiderOrganizationAccessDenial.noLeakFields.includes('activeTerms[]'))
assert.ok(outsiderOrganizationAccessDenial.downstreamRoutes.alertTermsExport.includes('watchlists/alert-terms'))
assert.equal(outsiderOrganizationAccessDenial.serviceLogAction, 'organization_access_denied')
assert.equal(outsiderOrganizationAccessDenial.requestId, 'smoke-outsider-org-read-denied')
const outsiderReadinessResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/alert-readiness`,
    headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-alert-readiness-denied' },
})
assert.equal(outsiderReadinessResponse.statusCode, 404, outsiderReadinessResponse.body)
const outsiderReadinessAccessDenial = parseBody(outsiderReadinessResponse.body).organizationAccessDenial
assert.equal(outsiderReadinessAccessDenial.schemaVersion, 'organization.access_denial.v1')
assert.equal(outsiderReadinessAccessDenial.route, 'GET /api/organizations/:id/alert-readiness')
assert.equal(outsiderReadinessAccessDenial.blockerCode, 'nonmember_denied')
assert.equal(outsiderReadinessAccessDenial.nonmemberEnumeration, false)
assert.ok(outsiderReadinessAccessDenial.noLeakFields.includes('activeTerms[]'))
assert.equal(outsiderReadinessAccessDenial.requestId, 'smoke-outsider-alert-readiness-denied')
const outsiderAlertTermsResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/alert-terms`,
    headers: { ...authHeaders('org_smoke_outsider', 'outsider-token'), 'x-request-id': 'smoke-outsider-alert-terms-denied' },
})
assert.equal(outsiderAlertTermsResponse.statusCode, 404, outsiderAlertTermsResponse.body)
const outsiderAlertTermsAccessDenial = parseBody(outsiderAlertTermsResponse.body).organizationAccessDenial
assert.equal(outsiderAlertTermsAccessDenial.schemaVersion, 'organization.access_denial.v1')
assert.equal(outsiderAlertTermsAccessDenial.route, 'GET /api/organizations/:id/watchlists/alert-terms')
assert.equal(outsiderAlertTermsAccessDenial.blockerCode, 'nonmember_denied')
assert.equal(outsiderAlertTermsAccessDenial.nonmemberEnumeration, false)
assert.ok(outsiderAlertTermsAccessDenial.noLeakFields.includes('activeTerms[]'))
assert.ok(!('alertTermsExport' in parseBody(outsiderAlertTermsResponse.body)))
assert.equal(outsiderAlertTermsAccessDenial.requestId, 'smoke-outsider-alert-terms-denied')
const outsiderWatchlistItemResponse = await app.inject({
    method: 'GET',
    url: `/api/organizations/${organization.id}/watchlists/${ownerWatchlistItem.id}`,
    headers: authHeaders('org_smoke_outsider', 'outsider-token'),
})
assert.equal(outsiderWatchlistItemResponse.statusCode, 404, outsiderWatchlistItemResponse.body)
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
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-viewer-watchlist-create-denied' && log.metadata.action === 'create_watchlist' && log.metadata.actorRole === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-watchlist-create-denied' && log.metadata.action === 'create_watchlist' && log.metadata.actorRole === 'member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-viewer-watchlist-archive-denied' && log.metadata.action === 'archive_watchlist' && log.metadata.actorRole === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.actorRole === 'member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_mutation_denied' && log.metadata.requestId === 'smoke-member-cleanup-denied' && log.metadata.action === 'cleanup_watchlists' && log.metadata.actorRole === 'member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.action === 'read_watchlist' && log.metadata.itemId === ownerWatchlistItem.id && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.requestId === 'smoke-wrong-org-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_lookup_denied' && log.metadata.requestId === 'smoke-archived-watchlist-update-denied' && log.metadata.action === 'update_watchlist' && log.metadata.blockerCode === 'watchlist_not_found_or_cross_org'))
assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-org-read-denied' && log.metadata.blockerCode === 'nonmember_denied'))
assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-watchlists-denied' && log.metadata.route === 'GET /api/organizations/:id/watchlists' && log.metadata.blockerCode === 'nonmember_denied'))
assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-alert-readiness-denied' && log.metadata.route === 'GET /api/organizations/:id/alert-readiness' && log.metadata.blockerCode === 'nonmember_denied'))
assert.ok(serviceLogs.some(log => log.message === 'organization_access_denied' && log.metadata.requestId === 'smoke-outsider-alert-terms-denied' && log.metadata.route === 'GET /api/organizations/:id/watchlists/alert-terms' && log.metadata.blockerCode === 'nonmember_denied'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_exported' && log.metadata.requestId === 'smoke-alert-terms-ready'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-viewer-alert-terms-denied' && log.metadata.denialReason === 'role_not_allowed'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-alert-terms-paused' && log.metadata.role === 'member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_alert_terms_export_denied' && log.metadata.requestId === 'smoke-member-alert-terms-ready' && log.metadata.allowedRoles.includes('admin')))
assert.ok(serviceLogs.some(log => log.message === 'organization_alert_case_visibility_denied' && log.metadata.requestId === 'smoke-member-alert-case-denied' && log.metadata.denialReason === 'role_not_allowed' && log.metadata.allowedRoles.includes('admin')))
assert.ok(serviceLogs.some(log => log.message === 'organization_watchlist_cleanup_archived' && log.metadata.requestId === 'smoke-proof-cleanup'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.role === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invites_created' && log.metadata.requestId === 'smoke-duplicate-recipient-dedupe' && log.metadata.submittedRecipientCount === 2 && log.metadata.recipientCount === 1 && log.metadata.duplicateRecipientCount === 1))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_accepted' && log.metadata.role === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === invite.id && log.metadata.blockerCode === 'invite_already_accepted'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === pendingOpsInvite.id && log.metadata.blockerCode === 'member_revoked'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === staleDeactivatedInvite.id && log.metadata.blockerCode === 'member_deactivated'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === expiredInvite.id && log.metadata.blockerCode === 'invite_expired'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_acceptance_denied' && log.metadata.inviteId === staleRemovedViewerInvite.id && log.metadata.blockerCode === 'member_revoked'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_action_denied' && log.metadata.inviteId === invite.id && log.metadata.requestId === 'smoke-accepted-revoke-denied' && log.metadata.blockerCode === 'invite_already_accepted'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-member-invite-list-denied' && log.metadata.action === 'list_invites' && log.metadata.actorRole === 'member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-member-invite-create-denied' && log.metadata.action === 'create_invite' && log.metadata.actorRole === 'member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_management_denied' && log.metadata.requestId === 'smoke-viewer-revoke-denied' && log.metadata.action === 'revoke_invite' && log.metadata.actorRole === 'viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_revoked' && log.metadata.requestId === 'smoke-revoke-pending-ops'))
assert.ok(serviceLogs.some(log => log.message === 'organization_invite_resent' && log.metadata.requestId === 'smoke-resend-pending-ops'))
assert.ok(serviceLogs.some(log => log.message === 'organization_settings_mutation_denied' && log.metadata.requestId === 'smoke-member-settings-denied' && log.metadata.actorRole === 'member' && log.metadata.attemptedFields.includes('alertVisibilityPolicy')))
assert.ok(serviceLogs.some(log => log.message === 'organization_settings_mutation_denied' && log.metadata.requestId === 'smoke-viewer-settings-denied' && log.metadata.actorRole === 'viewer' && log.metadata.attemptedFields.includes('defaultWebhookPolicy')))
assert.ok(serviceLogs.some(log => log.message === 'organization_settings_updated' && log.metadata.fields.includes('defaultWebhookPolicy')))
assert.ok(serviceLogs.some(log => log.message === 'organization_ownership_transferred' && log.metadata.targetUserId === 'org_smoke_admin'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_removed' && log.metadata.targetUserId === 'org_smoke_viewer' && log.metadata.revokedInviteCount === 1 && log.metadata.revokedInviteIds.includes(viewerPendingInviteBeforeRemoval.id)))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_role_updated' && log.metadata.requestId === 'smoke-viewer-role-member'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.requestId === 'smoke-member-role-denied' && log.metadata.action === 'change_member_role'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.requestId === 'smoke-admin-promote-denied' && log.metadata.requestedRole === 'admin'))
assert.ok(serviceLogs.some(log => log.message === 'organization_member_mutation_denied' && log.metadata.action === 'remove_member' && log.metadata.targetUserId === 'org_smoke_owner'))
assert.ok(serviceLogs.some(log => log.message === 'organization_last_owner_guard_blocked' && log.metadata.requestId === 'smoke-last-owner-role-denied' && log.metadata.action === 'change_owner_role'))
assert.ok(serviceLogs.some(log => log.message === 'organization_last_owner_guard_blocked' && log.metadata.action === 'remove_owner' && log.metadata.targetUserId === 'org_smoke_admin'))
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
        if (!invite) return rows([])
        if (organizationId && invite.organization_id !== organizationId) return rows([])
        return rows([invite])
    }

    if (compact.startsWith('SELECT COALESCE(status')) {
        const [organizationId] = params
        const organization = organizations.get(organizationId)
        return rows(organization ? [{ status: organization.status ?? 'active' }] : [])
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

    if (compact.startsWith('UPDATE organization_invites SET status = \'revoked\'') && compact.includes('FROM users')) {
        const [organizationId, userId] = params
        const user = users.get(userId)
        if (!user?.email) return rows([])
        const revoked: Row[] = []
        for (const invite of invites.values()) {
            if (invite.organization_id !== organizationId || invite.status !== 'pending' || invite.email.toLowerCase() !== user.email.toLowerCase()) continue
            const updated = { ...invite, status: 'revoked', accepted_at: null, accepted_by: null }
            invites.set(invite.id, updated)
            revoked.push(updated)
        }
        return rows(revoked)
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
        const acceptingUser = users.get(userId)
        if (acceptingUser?.active === false) return rows([])
        const existingMember = members.get(memberKey(invite.organization_id, userId))
        if (existingMember?.status === 'removed') return rows([])
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

    if (compact.startsWith('SELECT status FROM organization_members')) {
        const [organizationId, userId] = params
        const member = members.get(memberKey(organizationId, userId))
        return rows(member ? [{ status: member.status }] : [])
    }

    if (compact.startsWith('SELECT COALESCE(active, TRUE) AS active FROM users')) {
        const user = users.get(params[0])
        return rows(user ? [{ active: user.active !== false }] : [])
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
        if (compact.includes('WHERE id = $1')) {
            const [itemId, organizationId] = params
            const existing = watchlists.get(itemId)
            return rows(existing && existing.organization_id === organizationId ? [existing] : [])
        }

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
