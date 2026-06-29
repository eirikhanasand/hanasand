import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
    normalizeInviteInput,
    normalizeOrganizationInput,
    normalizeOrganizationSettingsInput,
    normalizeOwnershipTransferInput,
    normalizeWatchlistActionInput,
    normalizeWatchlistCleanupInput,
    normalizeWatchlistInput,
    buildOrganizationBridgeContext,
    buildOrganizationDwmAlertReference,
    organizationAlertCaseRoleActions,
    organizationLifecycleReadiness,
    organizationVisibilityDecision,
    organizationWatchlistAlertTermsExport,
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
    lifecycleStatus: 'archived',
    retentionDays: 180,
    auditSafeMetadata: { region: 'EU', customerTier: 'managed' },
}), {
    name: 'Smoke Org Settings',
    slug: 'smoke-org-settings',
    defaultWebhookPolicy: 'manual_selection',
    alertVisibilityPolicy: 'admins',
    lifecycleStatus: 'archived',
    retentionDays: 180,
    auditSafeMetadata: { region: 'EU', customerTier: 'managed' },
})
assert.throws(() => normalizeOrganizationSettingsInput({ defaultWebhookPolicy: 'send_everywhere' }), /Default webhook policy/)
assert.throws(() => normalizeOrganizationSettingsInput({ alertVisibilityPolicy: 'public' }), /Alert visibility policy/)
assert.throws(() => normalizeOrganizationSettingsInput({ lifecycleStatus: 'disabled' }), /Organization lifecycle status/)
assert.throws(() => normalizeOrganizationSettingsInput({ retentionDays: 10 }), /Retention days/)
assert.throws(() => normalizeOrganizationSettingsInput({ auditSafeMetadata: { callback: 'https://hooks.example.test/secret' } }), /emails, URLs, or secrets/)

assert.deepEqual(normalizeOwnershipTransferInput({
    targetUserId: 'user_next_owner',
    reason: 'Customer primary admin changed roles.',
}), {
    targetUserId: 'user_next_owner',
    reason: 'Customer primary admin changed roles.',
})
assert.throws(() => normalizeOwnershipTransferInput({ targetUserId: 'user_next_owner' }), /reason is required/)
assert.throws(() => normalizeOwnershipTransferInput({ reason: 'handoff' }), /Target user/)

assert.deepEqual(normalizeWatchlistInput({ kind: 'domain', value: 'https://WWW.Example.COM/login', notes: ' Supplier portal ' }), {
    kind: 'domain',
    value: 'example.com',
    notes: 'Supplier portal',
    reason: undefined,
    requestId: undefined,
})
assert.deepEqual(normalizeWatchlistInput({ kind: 'company', value: ' Example Holdings ' }), {
    kind: 'company',
    value: 'Example Holdings',
    notes: '',
    reason: undefined,
    requestId: undefined,
})
assert.throws(() => normalizeWatchlistInput({ kind: 'user', value: 'local only' }), /company, domain, vendor, actor, or keyword/)
assert.deepEqual(normalizeWatchlistCleanupInput({
    itemIds: ['watch_1', 'watch_1', 'watch_2'],
    reason: 'Cleanup live proof terms.',
    requestId: 'cleanup-request',
}), {
    itemIds: ['watch_1', 'watch_2'],
    reason: 'Cleanup live proof terms.',
    requestId: 'cleanup-request',
})
assert.throws(() => normalizeWatchlistCleanupInput({ itemIds: [] }), /at least one watchlist item id/)
assert.deepEqual(normalizeWatchlistActionInput({
    action: 'restore',
    reason: 'Restore archived watchlist after customer cleanup.',
    requestId: 'restore-watchlist',
}), {
    action: 'restore',
    reason: 'Restore archived watchlist after customer cleanup.',
    requestId: 'restore-watchlist',
})
assert.throws(() => normalizeWatchlistActionInput({ action: 'delete', reason: 'nope' }), /pause, resume, archive, or restore/)
assert.deepEqual(organizationAlertCaseRoleActions('owner'), [
    'create_watchlist',
    'edit_watchlist_terms',
    'archive_watchlist',
    'restore_watchlist',
    'acknowledge_alert',
    'assign_case',
    'link_case',
    'manage_invites',
])
assert.deepEqual(organizationAlertCaseRoleActions('analyst'), ['acknowledge_alert', 'assign_case', 'link_case'])
assert.deepEqual(organizationAlertCaseRoleActions('viewer'), [])

const alertReference = buildOrganizationDwmAlertReference(
    {
        id: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        default_webhook_policy: 'manual_selection',
        alert_visibility_policy: 'admins',
        member_count: 8,
        owner_count: 1,
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
assert.equal(alertReference.alert.activeMemberCount, 8)
assert.equal(alertReference.alert.ownerCount, 1)
assert.deepEqual(alertReference.alert.allowedViewerRoles, ['owner', 'admin'])
assert.equal(alertReference.alert.removedMemberDenialReason, 'member_removed')
assert.equal(alertReference.alert.deactivatedMemberDenialReason, 'member_deactivated')
assert.equal(alertReference.alert.pendingInviteCount, 2)
assert.equal(alertReference.alert.sharedWatchlistCount, 1)
assert.equal(alertReference.alert.readinessStatus, 'ready')
assert.equal(alertReference.webhookContract.defaultWebhookPolicy, 'manual_selection')
assert.deepEqual(alertReference.webhookContract.allowedViewerRoles, ['owner', 'admin'])
assert.match(alertReference.alert.casePath, /organizationId=org_acme/)
assert.match(alertReference.alert.dedupeKey, /org:org_acme:watchlist:watch_domain_acme/)

assert.deepEqual(buildOrganizationBridgeContext({
    id: 'org_empty',
    name: 'Empty Org',
    slug: 'empty-org',
    member_count: 1,
    owner_count: 1,
    pending_invite_count: 0,
    shared_watchlist_count: 0,
}), {
    id: 'org_empty',
    name: 'Empty Org',
    slug: 'empty-org',
    defaultWebhookPolicy: 'active_destinations',
    alertVisibilityPolicy: 'members',
    memberCount: 1,
    activeMemberCount: 1,
    ownerCount: 1,
    allowedViewerRoles: ['owner', 'admin', 'member', 'viewer'],
    removedMemberDenialReason: 'member_removed',
    deactivatedMemberDenialReason: 'member_deactivated',
    pendingInviteCount: 0,
    sharedWatchlistCount: 0,
    readinessStatus: 'needs_watchlist',
})

const lifecycleReadiness = organizationLifecycleReadiness({
    id: 'org_lifecycle',
    name: 'Lifecycle Org',
    slug: 'lifecycle-org',
    created_by: 'owner',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    role: 'admin',
    member_count: 3,
    owner_count: 1,
    admin_count: 2,
    pending_invite_count: 10,
    shared_watchlist_count: 1,
})
assert.equal(lifecycleReadiness.schemaVersion, 'organization.lifecycle_readiness.v1')
assert.equal(lifecycleReadiness.organizationId, 'org_lifecycle')
assert.equal(lifecycleReadiness.tenantId, 'org_lifecycle')
assert.equal(lifecycleReadiness.actorRole, 'admin')
assert.equal(lifecycleReadiness.counts.activeAdminCount, 2)
assert.equal(lifecycleReadiness.memberRoleReadiness.adminCanMutate, true)
assert.equal(lifecycleReadiness.memberRoleReadiness.memberCanReadAndExport, true)
assert.equal(lifecycleReadiness.memberRoleReadiness.revokedMemberDenial, 'member_revoked')
assert.equal(lifecycleReadiness.memberRoleReadiness.expiredInviteDenial, 'invite_expired')
assert.equal(lifecycleReadiness.watchlistReadiness.ready, true)
assert.equal(lifecycleReadiness.alertExportReadiness.ready, true)
assert.equal(lifecycleReadiness.cleanupReadiness.cleanupIdempotent, true)
assert.equal(lifecycleReadiness.supportVisibility.mode, 'redacted_summary_only')
assert.deepEqual(lifecycleReadiness.typedBlockers, [])
assert.equal(lifecycleReadiness.readyForOnboarding, true)
assert.ok(lifecycleReadiness.blockerCatalog.includes('org_missing'))
assert.ok(lifecycleReadiness.blockerCatalog.includes('org_archived'))
assert.ok(lifecycleReadiness.blockerCatalog.includes('org_deleted'))
assert.ok(lifecycleReadiness.blockerCatalog.includes('no_active_admin'))
assert.ok(lifecycleReadiness.blockerCatalog.includes('support_redaction_required'))

const blockedLifecycleReadiness = organizationLifecycleReadiness({
    id: 'org_blocked',
    name: 'Blocked Org',
    slug: 'blocked-org',
    created_by: 'owner',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    role: 'member',
    member_count: 2,
    owner_count: 0,
    admin_count: 0,
    pending_invite_count: 0,
    shared_watchlist_count: 0,
})
assert.deepEqual(blockedLifecycleReadiness.typedBlockers, ['no_active_admin', 'watchlist_setup_required', 'alert_export_unavailable'])
assert.equal(blockedLifecycleReadiness.alertExportReadiness.ready, false)
assert.equal(blockedLifecycleReadiness.readyForOnboarding, false)

const alertTermsExport = organizationWatchlistAlertTermsExport(
    {
        id: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        member_count: 8,
        owner_count: 1,
        pending_invite_count: 2,
        shared_watchlist_count: 2,
    },
    [
        {
            id: 'watch_keyword_acme',
            organization_id: 'org_acme',
            kind: 'keyword',
            value: 'Credential Reset Lures',
            notes: '',
            status: 'active',
            created_by: 'owner',
            updated_by: 'admin',
            lifecycle_reason: 'Proof fixture seed.',
            lifecycle_request_id: 'proof-fixture-create',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        {
            id: 'watch_paused_acme',
            organization_id: 'org_acme',
            kind: 'domain',
            value: 'paused.example',
            notes: '',
            status: 'paused',
            created_by: 'owner',
            updated_by: 'owner',
            lifecycle_reason: 'Paused for cleanup.',
            lifecycle_request_id: 'proof-fixture-pause',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
    ],
    { userId: 'org_smoke_admin', role: 'admin' }
)
assert.equal(alertTermsExport.member.userId, 'org_smoke_admin')
assert.equal(alertTermsExport.activeTerms.length, 1)
assert.equal(alertTermsExport.excluded.pausedCount, 1)
assert.equal(alertTermsExport.recommendedDownstreamRoute, 'organization_watchlist')
assert.equal(alertTermsExport.alertBridgeContract.schemaVersion, 'organization.watchlist_alert_bridge_contract.v1')
assert.equal(alertTermsExport.alertBridgeContract.recommendedDownstreamRoute, 'organization_watchlist')
assert.deepEqual(alertTermsExport.alertBridgeContract.memberProvenance, {
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
})
assert.equal(alertTermsExport.alertBridgeContract.supportAccess.mode, 'support_contract_only')
assert.equal(alertTermsExport.alertBridgeContract.supportVisibility.mode, 'redacted_summary_only')
assert.equal(alertTermsExport.alertBridgeContract.supportVisibility.contract, 'admin_support')
assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.safeFields.includes('activeTermCount'))
assert.ok(alertTermsExport.alertBridgeContract.supportVisibility.redactedFields.includes('activeTerms[].term'))
assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.route, 'organization_watchlist')
assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.pathTemplate, '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId')
assert.deepEqual(alertTermsExport.alertBridgeContract.caseRouteExpectation.queryFields, ['organizationId', 'watchlistItemId'])
assert.equal(alertTermsExport.alertBridgeContract.caseRouteExpectation.blockerCode, 'no_case_route')
assert.deepEqual(alertTermsExport.alertBridgeContract.redactedSummary, {
    schemaVersion: 'organization.watchlist_alert_bridge_redacted_summary.v1',
    organizationId: 'org_acme',
    tenantId: 'org_acme',
    activeTermCount: 1,
    termFamilies: ['keyword'],
    pausedCount: 1,
    archivedCount: 0,
    cleanupRequired: true,
    visibilityPolicy: 'members',
    allowedViewerRoles: ['owner', 'admin', 'member', 'viewer'],
    containsRawTerms: false,
})
assert.equal(alertTermsExport.alertBridgeContract.deniedAccess.nonmember, 'nonmember_denied')
assert.equal(alertTermsExport.alertBridgeContract.deniedAccess.revokedMember, 'revoked_member_denied')
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('activeTerms[].alertGenerationRef.dedupe.key'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.caseRouteExpectation.pathTemplate'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.redactedSummary'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.lifecycleReadiness'))
assert.ok(alertTermsExport.alertBridgeContract.requiredFields.includes('alertBridgeContract.alertCaseProof'))
assert.equal(alertTermsExport.alertBridgeContract.alertGeneratorKeyExpectation, 'alertGenerationRef.dedupe.key')
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
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('no_case_route'))
assert.ok(alertTermsExport.alertBridgeContract.blockerCatalog.includes('support_only_access'))
assert.deepEqual(alertTermsExport.alertBridgeContract.typedBlockers, [{
    code: 'paused_watchlist_excluded',
    severity: 'notice',
    message: 'Paused watchlist items are auditable but excluded from active alert matching.',
    count: 1,
}])
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.schemaVersion, 'organization.watchlist_lifecycle_readiness.v1')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.organization.status, 'active')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.organization.deletedBlocker, 'org_deleted')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.member.status, 'active')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.member.revokedBlocker, 'member_revoked')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.invites.expiredInviteBlocker, 'invite_expired')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.activeTermCount, 1)
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.pausedCount, 1)
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.cleanupRequired, true)
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.watchlists.cleanupIdempotent, true)
assert.deepEqual(alertTermsExport.alertBridgeContract.lifecycleReadiness.typedBlockers.map(blocker => blocker.code), ['watchlist_paused', 'cleanup_required'])
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.alertReplay.status, 'ready')
assert.equal(alertTermsExport.alertBridgeContract.lifecycleReadiness.caseRoute.status, 'expected')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.schemaVersion, 'organization.watchlist_alert_case_proof.v1')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.organizationId, 'org_acme')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.tenantId, 'org_acme')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.readyForReplay, true)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.activeAdminCount, 1)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.activeTermCount, 1)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.replayRoute, 'organization_watchlist')
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedAlertFields.includes('alertGenerationRef.dedupe.key'))
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedCaseFields.includes('casePath'))
assert.ok(alertTermsExport.alertBridgeContract.alertCaseProof.expectedSupportFields.includes('redactedSummary'))
assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.memberVisibility, {
    mode: 'member_scoped_export',
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
    nonmemberEnumeration: false,
    revokedMemberDenial: 'member_revoked',
})
assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.roleActionContract.actor, {
    userId: 'org_smoke_admin',
    role: 'admin',
    status: 'active',
    allowedActions: organizationAlertCaseRoleActions('admin'),
})
assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.roleActionContract.roleGates.restore_watchlist, ['owner', 'admin'])
assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.roleActionContract.roleGates.assign_case, ['owner', 'admin', 'analyst'])
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.roleActionContract.lifecycleDenials.archivedWatchlist, 'watchlist_archived')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.supportRedaction.blockerCode, 'support_redaction_required')
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.pausedExcludedCount, 1)
assert.equal(alertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.archivedExcludedCount, 0)
assert.deepEqual(alertTermsExport.alertBridgeContract.alertCaseProof.typedBlockers.map(blocker => blocker.code), ['cleanup_required'])
assert.equal(alertTermsExport.activeTerms[0].alertGenerationRef.schemaVersion, 'organization.watchlist_alert_generation_ref.v1')
assert.equal(alertTermsExport.activeTerms[0].alertGenerationRef.status, 'active')
assert.equal(alertTermsExport.activeTerms[0].alertGenerationRef.lifecycle.requestId, 'proof-fixture-create')
assert.equal(alertTermsExport.activeTerms[0].alertGenerationRef.dedupe.key, alertTermsExport.activeTerms[0].alertGeneratorKey)
assert.deepEqual(alertTermsExport.activeTerms[0].alertGenerationRef.dedupe.parts, {
    organizationId: 'org_acme',
    tenantId: 'org_acme',
    watchlistItemId: 'watch_keyword_acme',
    termFamily: 'keyword',
    normalizedTerm: 'credential reset lures',
})

const emptyAlertTermsExport = organizationWatchlistAlertTermsExport(
    {
        id: 'org_empty',
        name: 'Empty Org',
        slug: 'empty-org',
        member_count: 1,
        owner_count: 1,
        pending_invite_count: 0,
        shared_watchlist_count: 0,
    },
    [],
    { userId: 'org_empty_owner', role: 'owner' }
)
assert.equal(emptyAlertTermsExport.canGenerateAlerts, false)
assert.deepEqual(emptyAlertTermsExport.blockedReasons, ['needs_shared_watchlist_item'])
assert.deepEqual(emptyAlertTermsExport.alertBridgeContract.typedBlockers.map(blocker => blocker.code), ['no_active_watchlist_terms'])
assert.equal(emptyAlertTermsExport.alertBridgeContract.typedBlockers[0].severity, 'blocker')
assert.deepEqual(emptyAlertTermsExport.alertBridgeContract.lifecycleReadiness.typedBlockers.map(blocker => blocker.code), ['no_active_terms', 'alert_bridge_unavailable'])
assert.equal(emptyAlertTermsExport.alertBridgeContract.lifecycleReadiness.alertReplay.status, 'blocked')
assert.equal(emptyAlertTermsExport.alertBridgeContract.alertCaseProof.readyForReplay, false)
assert.deepEqual(emptyAlertTermsExport.alertBridgeContract.alertCaseProof.typedBlockers.map(blocker => blocker.code), ['no_active_terms', 'alert_export_unavailable'])

const inactiveOnlyAlertTermsExport = organizationWatchlistAlertTermsExport(
    {
        id: 'org_inactive_only',
        name: 'Inactive Only Org',
        slug: 'inactive-only',
        member_count: 2,
        owner_count: 1,
        pending_invite_count: 0,
        shared_watchlist_count: 2,
    },
    [
        {
            id: 'watch_paused_only',
            organization_id: 'org_inactive_only',
            kind: 'domain',
            value: 'paused-only.example',
            notes: '',
            status: 'paused',
            created_by: 'owner',
            updated_by: 'owner',
            lifecycle_reason: 'Pause proof term.',
            lifecycle_request_id: 'proof-pause-only',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        {
            id: 'watch_archived_only',
            organization_id: 'org_inactive_only',
            kind: 'vendor',
            value: 'Archived Only Vendor',
            notes: '',
            status: 'archived',
            created_by: 'owner',
            updated_by: 'owner',
            lifecycle_reason: 'Archive proof term.',
            lifecycle_request_id: 'proof-archive-only',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
    ],
    { userId: 'org_inactive_admin', role: 'admin' }
)
assert.equal(inactiveOnlyAlertTermsExport.activeTerms.length, 0)
assert.equal(inactiveOnlyAlertTermsExport.excluded.pausedCount, 1)
assert.equal(inactiveOnlyAlertTermsExport.excluded.archivedCount, 1)
assert.equal(inactiveOnlyAlertTermsExport.alertBridgeContract.alertCaseProof.readyForReplay, false)
assert.deepEqual(inactiveOnlyAlertTermsExport.alertBridgeContract.alertCaseProof.typedBlockers.map(blocker => blocker.code), [
    'no_active_terms',
    'alert_export_unavailable',
    'paused_archived_only',
    'cleanup_required',
])
assert.equal(inactiveOnlyAlertTermsExport.alertBridgeContract.alertCaseProof.cleanupLifecycle.cleanupRequired, true)

assert.deepEqual(organizationVisibilityDecision({
    role: 'viewer',
    status: 'active',
    alertVisibilityPolicy: 'members',
}), {
    allowed: true,
    reason: null,
    alertVisibilityPolicy: 'members',
    allowedRoles: ['owner', 'admin', 'member', 'viewer'],
})
assert.deepEqual(organizationVisibilityDecision({
    role: 'viewer',
    status: 'active',
    alertVisibilityPolicy: 'admins',
}), {
    allowed: false,
    reason: 'role_not_allowed',
    alertVisibilityPolicy: 'admins',
    allowedRoles: ['owner', 'admin'],
})
assert.deepEqual(organizationVisibilityDecision({
    role: 'member',
    status: 'removed',
    alertVisibilityPolicy: 'members',
}), {
    allowed: false,
    reason: 'member_removed',
    alertVisibilityPolicy: 'members',
    allowedRoles: ['owner', 'admin', 'member', 'viewer'],
})
assert.deepEqual(organizationVisibilityDecision({
    role: 'member',
    status: 'active',
    userActive: false,
    alertVisibilityPolicy: 'members',
}), {
    allowed: false,
    reason: 'member_deactivated',
    alertVisibilityPolicy: 'members',
    allowedRoles: ['owner', 'admin', 'member', 'viewer'],
})

assert.equal(roleCanManageOrganization('owner'), true)
assert.equal(roleCanManageOrganization('admin'), true)
assert.equal(roleCanManageOrganization('member'), false)
assert.equal(roleCanWriteWatchlist('member'), false)
assert.equal(roleCanWriteWatchlist('viewer'), false)
assert.equal(roleCanWriteWatchlist(undefined), false)

const routes = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8')
assert.match(routes, /fastify\.post\('\/organizations'/)
assert.match(routes, /fastify\.post\('\/organizations\/:id\/invites'/)
assert.match(routes, /fastify\.post\('\/organizations\/invites\/:inviteId\/accept'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/members'/)
assert.match(routes, /fastify\.delete\('\/organizations\/:id\/members\/:userId'/)
assert.match(routes, /fastify\.post\('\/organizations\/:id\/ownership-transfer'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/settings'/)
assert.match(routes, /fastify\.put\('\/organizations\/:id\/settings'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/alert-readiness'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/watchlists\/alert-terms'/)
assert.match(routes, /fastify\.get\('\/organizations\/:id\/watchlists'/)
assert.match(routes, /fastify\.post\('\/organizations\/:id\/watchlists'/)
assert.match(routes, /fastify\.post\('\/organizations\/:id\/watchlists\/cleanup'/)
assert.match(routes, /fastify\.post\('\/organizations\/:organizationId\/watchlists\/:itemId\/actions'/)
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
