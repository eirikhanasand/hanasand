export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'
export type OrganizationAlertCaseRole = OrganizationRole | 'analyst' | 'support' | 'nonmember'
export type OrganizationAlertCaseAction =
    | 'create_watchlist'
    | 'edit_watchlist_terms'
    | 'archive_watchlist'
    | 'restore_watchlist'
    | 'acknowledge_alert'
    | 'assign_case'
    | 'link_case'
    | 'manage_invites'
export type WatchlistKind = 'company' | 'domain' | 'vendor' | 'actor' | 'keyword'
export type OrganizationWatchlistStatus = 'active' | 'paused' | 'archived'
export type OrganizationWatchlistAction = 'pause' | 'resume' | 'archive' | 'restore'
export type OrganizationDefaultWebhookPolicy = 'active_destinations' | 'manual_selection' | 'disabled'
export type OrganizationAlertVisibilityPolicy = 'members' | 'admins' | 'owners'
export type OrganizationLifecycleStatus = 'active' | 'archived' | 'deleted'

export type OrganizationInput = {
    name?: unknown
}

export type OrganizationSettingsInput = {
    name?: unknown
    slug?: unknown
    defaultWebhookPolicy?: unknown
    default_webhook_policy?: unknown
    alertVisibilityPolicy?: unknown
    alert_visibility_policy?: unknown
    lifecycleStatus?: unknown
    lifecycle_status?: unknown
    retentionDays?: unknown
    retention_days?: unknown
    auditSafeMetadata?: unknown
    audit_safe_metadata?: unknown
}

export type OrganizationOwnershipTransferInput = {
    targetUserId?: unknown
    target_user_id?: unknown
    reason?: unknown
}

export type OrganizationMemberRoleInput = {
    role?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type InviteInput = {
    email?: unknown
    emails?: unknown
    role?: unknown
    expiresAt?: unknown
    expires_at?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type InviteActionInput = {
    action?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
    expiresAt?: unknown
    expires_at?: unknown
}

export type OrganizationInviteAction = 'revoke' | 'resend'

export type WatchlistInput = {
    kind?: unknown
    value?: unknown
    notes?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type WatchlistActionInput = {
    action?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type WatchlistCleanupInput = {
    itemIds?: unknown
    item_ids?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type OrganizationRow = {
    id: string
    name: string
    slug: string
    created_by: string
    created_at: string
    updated_at: string
    member_count?: number
    owner_count?: number
    admin_count?: number
    pending_invite_count?: number
    shared_watchlist_count?: number
    status?: OrganizationLifecycleStatus
    default_webhook_policy?: OrganizationDefaultWebhookPolicy
    alert_visibility_policy?: OrganizationAlertVisibilityPolicy
    retention_days?: number
    audit_safe_metadata?: Record<string, unknown> | null
    role?: OrganizationRole
}

export type OrganizationInviteRow = {
    id: string
    organization_id: string
    email: string
    role: OrganizationRole
    invited_by: string
    accepted_by?: string | null
    status: 'pending' | 'accepted' | 'revoked'
    created_at: string
    expires_at: string
    accepted_at?: string | null
}

export type OrganizationMemberRow = {
    organization_id: string
    user_id: string
    name: string
    avatar: string
    role: OrganizationRole
    status: 'active' | 'removed'
    invited_by?: string | null
    joined_at: string
    created_at: string
}

export type OrganizationWatchlistRow = {
    id: string
    organization_id: string
    kind: WatchlistKind
    value: string
    notes: string
    status?: OrganizationWatchlistStatus
    created_by: string
    updated_by?: string | null
    lifecycle_reason?: string | null
    lifecycle_request_id?: string | null
    created_at: string
    updated_at: string
    archived_at?: string | null
}

export type OrganizationWatchlistTerm = {
    watchlistItemId: string
    itemId: string
    organizationId: string
    tenantId: string
    kind: WatchlistKind
    termFamily: WatchlistKind
    family: WatchlistKind
    category: WatchlistKind
    term: string
    value: string
    terms: string[]
    status: OrganizationWatchlistStatus
    createdBy: string
    updatedBy: string | null
    lifecycleReason: string | null
    lifecycleRequestId: string | null
}

export type OrganizationWatchlistAlertGenerationContract = {
    schemaVersion: 'organization.watchlist_alert_generation.v1'
    organizationId: string
    tenantId: string
    ownerOrganizationId: string
    visibilityPolicy: OrganizationAlertVisibilityPolicy
    allowedViewerRoles: OrganizationRole[]
    activeWatchlistTerms: OrganizationWatchlistTerm[]
    termFamilies: WatchlistKind[]
    blockedReasons: string[]
    canGenerateAlerts: boolean
}

export type OrganizationWatchlistAlertGenerationRef = {
    schemaVersion: 'organization.watchlist_alert_generation_ref.v1'
    source: 'organization_shared_watchlist'
    organizationId: string
    tenantId: string
    ownerOrganizationId: string
    watchlistId: string
    watchlistItemId: string
    itemId: string
    termFamily: WatchlistKind
    category: WatchlistKind
    term: string
    normalizedTerm: string
    status: 'active'
    lifecycle: {
        status: 'active'
        reason: string | null
        requestId: string | null
        createdBy: string
        updatedBy: string | null
    }
    dedupe: {
        scope: 'organization_watchlist_term'
        key: string
        parts: {
            organizationId: string
            tenantId: string
            watchlistItemId: string
            termFamily: WatchlistKind
            normalizedTerm: string
        }
    }
}

export type OrganizationWatchlistAlertBridgeBlockerCode =
    | 'no_active_org'
    | 'no_active_admin'
    | 'org_archived'
    | 'org_deleted'
    | 'invite_expired'
    | 'member_revoked'
    | 'watchlist_archived'
    | 'watchlist_paused'
    | 'no_active_terms'
    | 'paused_archived_only'
    | 'cleanup_required'
    | 'alert_bridge_unavailable'
    | 'alert_export_unavailable'
    | 'case_route_unavailable'
    | 'support_redaction_required'
    | 'no_active_watchlist_terms'
    | 'paused_watchlist_excluded'
    | 'archived_watchlist_excluded'
    | 'missing_org_tenant'
    | 'revoked_member_denied'
    | 'no_alert_ref'
    | 'no_case_route'
    | 'support_only_access'
    | 'nonmember_denied'
    | 'role_not_allowed'

export type OrganizationWatchlistAlertBridgeBlocker = {
    code: OrganizationWatchlistAlertBridgeBlockerCode
    severity: 'blocker' | 'notice'
    message: string
    count?: number
}

export type OrganizationWatchlistAlertBridgeContract = {
    schemaVersion: 'organization.watchlist_alert_bridge_contract.v1'
    recommendedDownstreamRoute: 'organization_watchlist'
    memberProvenance: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    supportAccess: {
        mode: 'support_contract_only'
        blockerCode: 'support_only_access'
        message: string
    }
    supportVisibility: {
        mode: 'redacted_summary_only'
        contract: 'admin_support'
        safeFields: string[]
        redactedFields: string[]
        message: string
    }
    deniedAccess: {
        nonmember: 'nonmember_denied'
        revokedMember: 'revoked_member_denied'
    }
    caseRouteExpectation: {
        route: 'organization_watchlist'
        pathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        queryFields: ['organizationId', 'watchlistItemId']
        blockerCode: 'no_case_route'
    }
    redactedSummary: {
        schemaVersion: 'organization.watchlist_alert_bridge_redacted_summary.v1'
        organizationId: string
        tenantId: string
        activeTermCount: number
        termFamilies: WatchlistKind[]
        pausedCount: number
        archivedCount: number
        cleanupRequired: boolean
        visibilityPolicy: OrganizationAlertVisibilityPolicy
        allowedViewerRoles: OrganizationRole[]
        containsRawTerms: false
    }
    lifecycleReadiness: {
        schemaVersion: 'organization.watchlist_lifecycle_readiness.v1'
        organization: {
            status: 'active'
            deletedBlocker: 'org_deleted'
        }
        member: {
            status: 'active'
            revokedBlocker: 'member_revoked'
        }
        invites: {
            expiredInviteBlocker: 'invite_expired'
            revokedInviteBlocker: 'member_revoked'
        }
        watchlists: {
            activeTermCount: number
            pausedCount: number
            archivedCount: number
            cleanupRequired: boolean
            cleanupIdempotent: true
            pausedBlocker: 'watchlist_paused'
            archivedBlocker: 'watchlist_archived'
            noActiveTermsBlocker: 'no_active_terms'
            cleanupRequiredBlocker: 'cleanup_required'
        }
        alertReplay: {
            status: 'ready' | 'blocked'
            unavailableBlocker: 'alert_bridge_unavailable'
        }
        caseRoute: {
            status: 'expected'
            unavailableBlocker: 'case_route_unavailable'
        }
        typedBlockers: OrganizationWatchlistAlertBridgeBlocker[]
    }
    alertCaseProof: {
        schemaVersion: 'organization.watchlist_alert_case_proof.v1'
        organizationId: string
        tenantId: string
        readyForReplay: boolean
        activeAdminCount: number
        activeTermCount: number
        replayRoute: 'organization_watchlist'
        expectedAlertFields: string[]
        expectedCaseFields: string[]
        expectedSupportFields: string[]
        memberVisibility: {
            mode: 'member_scoped_export'
            userId: string
            role: OrganizationRole
            status: 'active'
            nonmemberEnumeration: false
            revokedMemberDenial: 'member_revoked'
        }
        roleActionContract: {
            schemaVersion: 'organization.alert_case_role_actions.v1'
            actor: {
                userId: string
                role: OrganizationRole
                status: 'active'
                allowedActions: OrganizationAlertCaseAction[]
            }
            roleGates: Record<OrganizationAlertCaseAction, OrganizationAlertCaseRole[]>
            lifecycleDenials: {
                nonmember: 'nonmember_denied'
                revokedMember: 'member_revoked'
                expiredInvite: 'invite_expired'
                pausedWatchlist: 'watchlist_paused'
                archivedWatchlist: 'watchlist_archived'
                supportOnlyAccess: 'support_only_access'
            }
        }
        supportRedaction: {
            mode: 'redacted_summary_only'
            required: true
            blockerCode: 'support_redaction_required'
        }
        cleanupLifecycle: {
            cleanupRequired: boolean
            cleanupIdempotent: true
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup'
            pausedExcludedCount: number
            archivedExcludedCount: number
            cleanupRequiredBlocker: 'cleanup_required'
        }
        typedBlockers: OrganizationWatchlistAlertBridgeBlocker[]
    }
    requiredFields: string[]
    alertGeneratorKeyExpectation: 'alertGenerationRef.dedupe.key'
    typedBlockers: OrganizationWatchlistAlertBridgeBlocker[]
    blockerCatalog: OrganizationWatchlistAlertBridgeBlockerCode[]
}

export type OrganizationDownstreamAuthorizationExport = {
    schemaVersion: 'organization.downstream_authorization_export.v1'
    organizationId: string
    tenantId: string
    organizationLifecycleState: OrganizationLifecycleStatus
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    visibility: OrganizationVisibilityDecision
    watchlists: {
        activeIds: string[]
        pausedIds: string[]
        archivedIds: string[]
        activeCount: number
        pausedCount: number
        archivedCount: number
        states: Array<{
            watchlistItemId: string
            kind: WatchlistKind
            status: OrganizationWatchlistStatus
        }>
    }
    allowedActions: OrganizationAlertCaseAction[]
    actionGates: Record<OrganizationAlertCaseAction, {
        allowed: boolean
        allowedRoles: OrganizationAlertCaseRole[]
        denialReason: OrganizationWatchlistAlertBridgeBlockerCode | null
    }>
    downstream: {
        alertGeneration: {
            canExportActiveTerms: boolean
            excludedStatuses: OrganizationWatchlistStatus[]
            blockerCodes: OrganizationWatchlistAlertBridgeBlockerCode[]
        }
        webhook: {
            defaultPolicy: OrganizationDefaultWebhookPolicy
            canUseDefaultDestinations: boolean
            denialReason: OrganizationWatchlistAlertBridgeBlockerCode | null
        }
        helpdesk: {
            mode: 'redacted_summary_only'
            supportOnlyDenialReason: 'support_only_access'
            safeFields: string[]
        }
        dashboard: {
            readinessFixture: 'organization_watchlist'
            safeFields: string[]
            nonmemberEnumeration: false
        }
    }
    lifecycleDenials: {
        inactiveOrganization: 'no_active_org'
        archivedOrganization: 'org_archived'
        removedMember: 'member_revoked'
        revokedMember: 'member_revoked'
        deactivatedMember: 'revoked_member_denied'
        expiredInvite: 'invite_expired'
        revokedInvite: 'member_revoked'
        pausedWatchlist: 'watchlist_paused'
        archivedWatchlist: 'watchlist_archived'
        noActiveTerms: 'no_active_terms'
        nonmember: 'nonmember_denied'
        roleNotAllowed: 'role_not_allowed'
    }
}

export type OrganizationSharedWatchlistDownstreamProof = {
    schemaVersion: 'organization.shared_watchlist_downstream_proof.v1'
    organizationId: string
    tenantId: string
    ownerOrganizationId: string
    actor: {
        userId: string
        role: OrganizationRole
        status: 'active'
        canManageWatchlists: boolean
        canExportActiveTerms: boolean
        allowedActions: OrganizationAlertCaseAction[]
    }
    inviteLifecycle: {
        pendingInviteCount: number
        acceptedInviteCreatesMembership: true
        acceptedInviteRevocationBlocked: true
        expiredInviteBlocker: 'invite_expired'
        revokedInviteBlocker: 'member_revoked'
        removedMemberReinviteBlocked: true
        deactivatedUserInviteBlocked: true
    }
    watchlistOwnership: {
        activeIds: string[]
        pausedIds: string[]
        archivedIds: string[]
        activeCount: number
        pausedCount: number
        archivedCount: number
        ownerOrganizationId: string
        isolatedByOrganizationId: true
        duplicateTermScope: 'organization'
        lifecycleStatuses: Array<{
            watchlistItemId: string
            organizationId: string
            status: OrganizationWatchlistStatus
            createdBy: string
            updatedBy: string | null
        }>
    }
    audit: {
        schemaVersion: 'organization.shared_watchlist_audit_contract.v1'
        source: 'service_logs'
        eventActions: Array<
            | 'organization_invites_created'
            | 'organization_invite_accepted'
            | 'organization_invite_revoked'
            | 'organization_invite_resent'
            | 'organization_watchlist_upserted'
            | 'organization_watchlist_updated'
            | 'organization_watchlist_paused'
            | 'organization_watchlist_resumed'
            | 'organization_watchlist_archived'
            | 'organization_watchlist_restored'
            | 'organization_watchlist_cleanup_archived'
            | 'organization_watchlist_alert_terms_exported'
            | 'organization_lifecycle_mutation_blocked'
        >
        requiredMetadataFields: string[]
        requestIdFields: string[]
        actorFields: string[]
        downstreamCorrelationFields: string[]
        idempotentActions: Array<'invite_resend' | 'invite_revoke' | 'watchlist_cleanup' | 'alert_terms_export'>
        proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist'
    }
    alertBridge: {
        route: 'organization_watchlist'
        canGenerateAlerts: boolean
        activeWatchlistItemIds: string[]
        alertGeneratorKeys: string[]
        alertGenerationRefField: 'activeTerms[].alertGenerationRef'
        dedupeScope: 'organization_watchlist_term'
        queueVisibilityContract: {
            schemaVersion: 'organization.watchlist_alert_visibility_contract.v1'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            routes: {
                list: 'GET /v1/dwm/alerts'
                detail: 'GET /v1/dwm/alerts/:id'
                update: 'PATCH /v1/dwm/alerts/:id'
                replay: 'POST /v1/dwm/alerts/:id/replay'
            }
            requiredQueryFields: Array<'organizationId'>
            watchlistScope: {
                watchlistItemIds: string[]
                alertGeneratorKeys: string[]
                alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]'
                dedupeScope: 'organization_watchlist_term'
            }
            actorVisibility: {
                policy: OrganizationAlertVisibilityPolicy
                allowed: boolean
                denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | null
                allowedRoles: OrganizationRole[]
                actorRole: OrganizationRole
                nonmemberEnumeration: false
            }
            actionGates: {
                readAlertsAllowed: boolean
                acknowledgeAllowed: boolean
                assignAllowed: boolean
                linkCaseAllowed: boolean
                replayAllowed: boolean
                mutateAllowedRoles: OrganizationAlertCaseRole[]
            }
            requiredAlertFields: string[]
            evidenceFields: string[]
            redactedFields: string[]
            blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
        }
        expectedAlertFields: string[]
        blockerCodes: OrganizationWatchlistAlertBridgeBlockerCode[]
    }
    caseBridge: {
        route: 'POST /v1/cases'
        casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        expectedCaseFields: string[]
        allowedActions: OrganizationAlertCaseAction[]
        blockerCodes: OrganizationWatchlistAlertBridgeBlockerCode[]
    }
    webhookBridge: {
        route: 'POST /v1/dwm/webhooks/deliver'
        defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
        canUseDefaultDestinations: boolean
        deliveryContract: {
            schemaVersion: 'organization.watchlist_webhook_delivery_contract.v1'
            eventType: 'dwm.alert'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            destinationSelection: {
                policy: OrganizationDefaultWebhookPolicy
                selectedDestinationSource: 'org_active_destinations' | 'manual_selection_required' | 'webhook_policy_disabled'
                requiredDestinationOrgId: string
                selectedDestinationOrgField: 'destination.org_id'
                selectedDestinationIdField: 'webhookDestinationIds[]'
                skippedDestinationReasons: Array<'org_mismatch' | 'destination_disabled' | 'event_not_subscribed' | 'manual_selection_required' | 'webhook_policy_disabled'>
                nonmemberDestinationEnumeration: false
            }
            roleGates: {
                automaticDeliveryAllowed: boolean
                manualTriggerAllowed: boolean
                manualTriggerAllowedRoles: Array<'owner' | 'admin'>
                memberManualTriggerAllowed: false
                denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | 'manual_webhook_selection_required' | null
            }
            idempotency: {
                scope: 'organization_destination_alert'
                keyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
            }
            requiredAlertFields: string[]
            requiredDeliveryFields: string[]
            evidenceFields: string[]
            redactedFields: string[]
            blockerCodes: string[]
        }
        expectedDeliveryFields: string[]
        blockerCodes: string[]
    }
    integration: {
        expectedAdapter: 'organizationSharedWatchlistDownstreamProof'
        payloadShape: string[]
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
        routeHandlers: string[]
        storageModules: string[]
        nonmemberEnumeration: false
        containsRawTerms: false
    }
    blockers: string[]
}

export type OrganizationWatchlistAlertTermsExport = {
    schemaVersion: 'organization.watchlist_alert_terms_export.v1'
    organizationId: string
    tenantId: string
    ownerOrganizationId: string
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    visibilityPolicy: OrganizationAlertVisibilityPolicy
    allowedViewerRoles: OrganizationRole[]
    recommendedDownstreamRoute: 'organization_watchlist'
    alertBridgeContract: OrganizationWatchlistAlertBridgeContract
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
    sharedWatchlistDownstreamProof: OrganizationSharedWatchlistDownstreamProof
    activeTerms: Array<OrganizationWatchlistTerm & {
        source: 'organization_shared_watchlist'
        alertGeneratorKey: string
        alertGenerationRef: OrganizationWatchlistAlertGenerationRef
        alertGenerationReference: {
            schemaVersion: 'organization.watchlist_item_alert_reference.v1'
            organizationId: string
            tenantId: string
            watchlistItemId: string
            itemId: string
            termFamily: WatchlistKind
            category: WatchlistKind
            term: string
            status: 'active'
        }
    }>
    activeWatchlistTerms: OrganizationWatchlistTerm[]
    termFamilies: WatchlistKind[]
    excluded: {
        pausedCount: number
        archivedCount: number
        inactiveCount: number
    }
    blockedReasons: string[]
    canGenerateAlerts: boolean
}

export type OrganizationDwmAlertReference = {
    schemaVersion: 'organization.dwm_alert_bridge.v1'
    organizationId: string
    tenantId: string
    watchlistItemId: string
    watchlistKind: WatchlistKind
    matchedTerm: {
        value: string
        kind: WatchlistKind
        termFamily: WatchlistKind
    }
    watchlist: {
        id: string
        name: string
        itemId: string
        kind: WatchlistKind
        termFamily: WatchlistKind
        status: OrganizationWatchlistStatus
        createdBy: string
        updatedBy: string | null
        terms: string[]
    }
    organization: OrganizationBridgeContext
    alert: {
        id: string
        organizationId: string
        orgId: string
        tenantId: string
        orgName: string
        defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
        alertVisibilityPolicy: OrganizationAlertVisibilityPolicy
        memberCount: number
        activeMemberCount: number
        ownerCount: number
        allowedViewerRoles: OrganizationRole[]
        removedMemberDenialReason: OrganizationVisibilityDenyReason
        deactivatedMemberDenialReason: OrganizationVisibilityDenyReason
        pendingInviteCount: number
        sharedWatchlistCount: number
        readinessStatus: OrganizationReadinessStatus
        watchlistItemId: string
        matchedTerm: {
            value: string
            kind: WatchlistKind
            termFamily: WatchlistKind
        }
        watchlist: OrganizationDwmAlertReference['watchlist']
        sourceFamily: 'organization_watchlist'
        artifactType: 'watchlist_readiness'
        route: 'organization_watchlist'
        casePath: string
        dedupeKey: string
    }
    webhookContract: {
        orgId: string
        watchlistId: string
        watchlistName: string
        defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
        alertVisibilityPolicy: OrganizationAlertVisibilityPolicy
        memberCount: number
        activeMemberCount: number
        ownerCount: number
        allowedViewerRoles: OrganizationRole[]
        removedMemberDenialReason: OrganizationVisibilityDenyReason
        deactivatedMemberDenialReason: OrganizationVisibilityDenyReason
        pendingInviteCount: number
        sharedWatchlistCount: number
        readinessStatus: OrganizationReadinessStatus
        route: 'organization_watchlist'
        casePath: string
    }
}

export type OrganizationReadinessStatus = 'ready' | 'needs_watchlist'

export type OrganizationBridgeContext = {
    id: string
    name: string
    slug?: string
    defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
    alertVisibilityPolicy: OrganizationAlertVisibilityPolicy
    memberCount: number
    activeMemberCount: number
    ownerCount: number
    allowedViewerRoles: OrganizationRole[]
    removedMemberDenialReason: OrganizationVisibilityDenyReason
    deactivatedMemberDenialReason: OrganizationVisibilityDenyReason
    pendingInviteCount: number
    sharedWatchlistCount: number
    readinessStatus: OrganizationReadinessStatus
}

export type OrganizationVisibilityDenyReason = 'not_member' | 'member_removed' | 'member_deactivated' | 'role_not_allowed'

export type OrganizationVisibilityDecisionInput = {
    role?: OrganizationRole | null
    status?: OrganizationMemberRow['status'] | 'inactive' | null
    userActive?: boolean | null
    alertVisibilityPolicy?: OrganizationAlertVisibilityPolicy | null
}

export type OrganizationVisibilityDecision = {
    allowed: boolean
    reason: OrganizationVisibilityDenyReason | null
    alertVisibilityPolicy: OrganizationAlertVisibilityPolicy
    allowedRoles: OrganizationRole[]
}

export type OrganizationLifecycleReadinessBlockerCode =
    | 'org_missing'
    | 'org_archived'
    | 'org_deleted'
    | 'no_active_admin'
    | 'member_revoked'
    | 'invite_expired'
    | 'watchlist_setup_required'
    | 'alert_export_unavailable'
    | 'support_redaction_required'
    | 'cleanup_required'

export type OrganizationLifecycleReadiness = {
    schemaVersion: 'organization.lifecycle_readiness.v1'
    organizationId: string
    tenantId: string
    lifecycleStatus: OrganizationLifecycleStatus
    actorRole: OrganizationRole
    counts: {
        memberCount: number
        activeMemberCount: number
        ownerCount: number
        activeAdminCount: number
        pendingInviteCount: number
        sharedWatchlistCount: number
    }
    memberRoleReadiness: {
        ownerCanMutate: boolean
        adminCanMutate: boolean
        memberCanReadAndExport: boolean
        supportReadMode: 'redacted_support_contract_only'
        nonmemberEnumeration: false
        revokedMemberDenial: 'member_revoked'
        expiredInviteDenial: 'invite_expired'
        noActiveAdminBlocker: 'no_active_admin'
    }
    organizationLifecycle: {
        missingBlocker: 'org_missing'
        archivedBlocker: 'org_archived'
        deletedBlocker: 'org_deleted'
    }
    watchlistReadiness: {
        ready: boolean
        activeSharedWatchlistCount: number
        setupBlocker: 'watchlist_setup_required'
    }
    alertExportReadiness: {
        ready: boolean
        route: 'GET /api/organizations/:id/watchlists/alert-terms'
        unavailableBlocker: 'alert_export_unavailable'
    }
    cleanupReadiness: {
        cleanupRequired: boolean
        cleanupIdempotent: true
        route: 'POST /api/organizations/:id/watchlists/cleanup'
        cleanupRequiredBlocker: 'cleanup_required'
    }
    supportVisibility: {
        mode: 'redacted_summary_only'
        contract: 'admin_support'
        redactionBlocker: 'support_redaction_required'
    }
    dashboardFields: string[]
    typedBlockers: OrganizationLifecycleReadinessBlockerCode[]
    blockerCatalog: OrganizationLifecycleReadinessBlockerCode[]
    readyForOnboarding: boolean
}

export type OrganizationReadinessProof = {
    schemaVersion: 'organization.worker3_ui_readiness_proof.v1'
    organizationId: string
    tenantId: string
    actor: {
        role: OrganizationRole
        canExportActiveTerms: boolean
    }
    counts: {
        activeMemberCount: number
        activeAdminCount: number
        pendingInviteCount: number
        activeWatchlistTermCount: number
        pausedWatchlistCount: number
        archivedWatchlistCount: number
    }
    readiness: {
        organizationCanGenerateAlerts: boolean
        actorCanExportActiveTerms: boolean
        readyForWorker3Replay: boolean
        readyForDashboard: boolean
        cleanupRequired: boolean
    }
    routes: {
        createOrganization: 'POST /api/organizations'
        inviteMembers: 'POST /api/organizations/:id/invites'
        acceptInvite: 'POST /api/organizations/invites/:inviteId/accept'
        listWatchlists: 'GET /api/organizations/:id/watchlists'
        mutateWatchlist: 'POST|PUT|DELETE /api/organizations/:id/watchlists'
        alertReadiness: 'GET /api/organizations/:id/alert-readiness'
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
        cleanupWatchlists: 'POST /api/organizations/:id/watchlists/cleanup'
    }
    worker3Proof: {
        noNetworkRequired: true
        replayRoute: 'organization_watchlist'
        exportSchema: 'organization.watchlist_alert_terms_export.v1'
        alertGenerationRefField: 'activeTerms[].alertGenerationRef'
        alertGeneratorKeyField: 'activeTerms[].alertGenerationRef.dedupe.key'
        expectedAlertFields: string[]
        testCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    alertQueueProof: {
        schemaVersion: 'organization.alert_queue_visibility_proof.v1'
        visibilitySchema: 'dwm.org_alert_queue_visibility.v1'
        routes: {
            list: 'GET /v1/dwm/alerts'
            detail: 'GET /v1/dwm/alerts/:id'
            mutate: 'PATCH /v1/dwm/alerts/:id'
            replay: 'POST /v1/dwm/alerts/:id/replay'
        }
        requiredQueryFields: ['organizationId']
        expectedVisibilityFields: string[]
        allowedActions: OrganizationAlertCaseAction[]
        blockerCodes: string[]
        nonmemberEnumeration: false
    }
    webhookDeliveryProof: {
        schemaVersion: 'organization.webhook_delivery_visibility_proof.v1'
        deliveryContractSchema: 'dwm.webhook.org_alert_delivery.v1'
        route: 'POST /dwm/webhook-deliveries'
        defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
        canUseDefaultDestinations: boolean
        ownerAdminManualTriggerRequired: true
        memberManualTriggerAllowed: false
        nonmemberDestinationEnumeration: false
        expectedDeliveryFields: string[]
        blockerCodes: string[]
    }
    uiProof: {
        safeFields: string[]
        redactedFields: string[]
        nonmemberEnumeration: false
        dashboardFixture: 'organization_watchlist'
    }
    cleanupProof: {
        cleanupIdempotent: true
        cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup'
        cleanupRequiredBlocker: 'cleanup_required'
    }
    blockers: string[]
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const watchlistWriteRoles = new Set<OrganizationRole>(['owner', 'admin'])
const inviteRoles = new Set<OrganizationRole>(['admin', 'member', 'viewer'])
const inviteActions = new Set<OrganizationInviteAction>(['revoke', 'resend'])
const watchlistActions = new Set<OrganizationWatchlistAction>(['pause', 'resume', 'archive', 'restore'])
const watchlistKinds = new Set<WatchlistKind>(['company', 'domain', 'vendor', 'actor', 'keyword'])
const memberRoleTargets = new Set<OrganizationRole>(['admin', 'member', 'viewer'])
const defaultWebhookPolicies = new Set<OrganizationDefaultWebhookPolicy>(['active_destinations', 'manual_selection', 'disabled'])
const alertVisibilityPolicies = new Set<OrganizationAlertVisibilityPolicy>(['members', 'admins', 'owners'])
const organizationLifecycleStatuses = new Set<OrganizationLifecycleStatus>(['active', 'archived', 'deleted'])

export function normalizeOrganizationInput(body: OrganizationInput | undefined) {
    const name = cleanText(body?.name)
    if (!name) {
        throw new Error('Organization name is required.')
    }

    if (name.length > 120) {
        throw new Error('Organization name must be 120 characters or fewer.')
    }

    return {
        name,
        slug: slugFor(name),
    }
}

export function normalizeInviteInput(body: InviteInput | undefined) {
    const fromArray = Array.isArray(body?.emails) ? body.emails : []
    const fromSingle = typeof body?.email === 'string' ? [body.email] : []
    const emails = Array.from(new Set([...fromArray, ...fromSingle]
        .map(email => cleanText(email).toLowerCase())
        .filter(Boolean)))

    if (!emails.length) {
        throw new Error('Add at least one invite email.')
    }

    if (emails.length > 25) {
        throw new Error('Invite at most 25 users at a time.')
    }

    const invalid = emails.find(email => !emailPattern.test(email))
    if (invalid) {
        throw new Error(`Invalid invite email: ${invalid}`)
    }

    const role = normalizeInviteRole(body?.role)
    const expiresAt = normalizeInviteExpiry(body?.expiresAt ?? body?.expires_at)
    const requestId = normalizeInviteRequestId(body?.requestId ?? body?.request_id)
    return { emails, role, expiresAt, requestId }
}

export function normalizeInviteActionInput(body: InviteActionInput | undefined) {
    const action = cleanText(body?.action).toLowerCase()
    if (!inviteActions.has(action as OrganizationInviteAction)) {
        throw new Error('Invite action must be revoke or resend.')
    }

    const reason = cleanText(body?.reason)
    if (reason.length < 3) {
        throw new Error('Invite action reason is required.')
    }

    if (reason.length > 1000) {
        throw new Error('Invite action reason must be 1000 characters or fewer.')
    }

    const requestId = normalizeInviteRequestId(body?.requestId ?? body?.request_id)
    const expiresAt = action === 'resend'
        ? normalizeInviteExpiry(body?.expiresAt ?? body?.expires_at)
        : undefined

    return { action: action as OrganizationInviteAction, reason, requestId, expiresAt }
}

export function normalizeOrganizationSettingsInput(body: OrganizationSettingsInput | undefined) {
    const name = body?.name === undefined ? undefined : normalizeSettingsName(body.name)
    const slug = body?.slug === undefined ? undefined : normalizeSettingsSlug(body.slug)
    const defaultWebhookPolicy = normalizeDefaultWebhookPolicy(body?.defaultWebhookPolicy ?? body?.default_webhook_policy)
    const alertVisibilityPolicy = normalizeAlertVisibilityPolicy(body?.alertVisibilityPolicy ?? body?.alert_visibility_policy)
    const lifecycleStatus = normalizeOrganizationLifecycleStatus(body?.lifecycleStatus ?? body?.lifecycle_status)
    const retentionDays = normalizeRetentionDays(body?.retentionDays ?? body?.retention_days)
    const auditSafeMetadata = normalizeAuditSafeMetadata(body?.auditSafeMetadata ?? body?.audit_safe_metadata)

    if (
        name === undefined
        && slug === undefined
        && defaultWebhookPolicy === undefined
        && alertVisibilityPolicy === undefined
        && lifecycleStatus === undefined
        && retentionDays === undefined
        && auditSafeMetadata === undefined
    ) {
        throw new Error('Add at least one organization setting to update.')
    }

    return {
        name,
        slug,
        defaultWebhookPolicy,
        alertVisibilityPolicy,
        lifecycleStatus,
        retentionDays,
        auditSafeMetadata,
    }
}

export function normalizeOwnershipTransferInput(body: OrganizationOwnershipTransferInput | undefined) {
    const targetUserId = cleanText(body?.targetUserId ?? body?.target_user_id)
    if (!targetUserId) {
        throw new Error('Target user is required.')
    }

    const reason = cleanText(body?.reason)
    if (reason.length < 3) {
        throw new Error('Ownership transfer reason is required.')
    }

    if (reason.length > 1000) {
        throw new Error('Ownership transfer reason must be 1000 characters or fewer.')
    }

    return { targetUserId, reason }
}

export function normalizeMemberRoleInput(body: OrganizationMemberRoleInput | undefined) {
    const role = cleanText(body?.role).toLowerCase()
    if (!memberRoleTargets.has(role as OrganizationRole)) {
        throw new Error('Member role must be admin, member, or viewer.')
    }

    const reason = cleanText(body?.reason)
    if (reason.length < 3) {
        throw new Error('Member role change reason is required.')
    }

    if (reason.length > 1000) {
        throw new Error('Member role change reason must be 1000 characters or fewer.')
    }

    const requestId = normalizeWatchlistRequestId(body?.requestId ?? body?.request_id)
    return { role: role as OrganizationRole, reason, requestId }
}

export function normalizeWatchlistInput(body: WatchlistInput | undefined) {
    const kind = cleanText(body?.kind).toLowerCase()
    if (!watchlistKinds.has(kind as WatchlistKind)) {
        throw new Error('Watchlist kind must be company, domain, vendor, actor, or keyword.')
    }

    const value = normalizeWatchlistValue(kind as WatchlistKind, body?.value)
    if (!value) {
        throw new Error('Watchlist value is required.')
    }

    if (value.length > 240) {
        throw new Error('Watchlist value must be 240 characters or fewer.')
    }

    const notes = cleanText(body?.notes)
    const reason = normalizeWatchlistReason(body?.reason)
    const requestId = normalizeWatchlistRequestId(body?.requestId ?? body?.request_id)
    return {
        kind: kind as WatchlistKind,
        value,
        notes: notes.slice(0, 2000),
        reason,
        requestId,
    }
}

export function normalizeWatchlistActionInput(body: WatchlistActionInput | undefined) {
    const action = cleanText(body?.action).toLowerCase()
    if (!watchlistActions.has(action as OrganizationWatchlistAction)) {
        throw new Error('Watchlist action must be pause, resume, archive, or restore.')
    }

    const reason = normalizeWatchlistReason(body?.reason)
    const requestId = normalizeWatchlistRequestId(body?.requestId ?? body?.request_id)
    return { action: action as OrganizationWatchlistAction, reason, requestId }
}

export function normalizeWatchlistCleanupInput(body: WatchlistCleanupInput | undefined) {
    const rawIds = Array.isArray(body?.itemIds)
        ? body?.itemIds
        : Array.isArray(body?.item_ids)
            ? body?.item_ids
            : []
    const itemIds = Array.from(new Set(rawIds.map(id => cleanText(id)).filter(Boolean)))
    if (!itemIds.length) {
        throw new Error('Add at least one watchlist item id to clean up.')
    }

    if (itemIds.length > 50) {
        throw new Error('Clean up at most 50 watchlist items at a time.')
    }

    const reason = normalizeWatchlistReason(body?.reason)
    const requestId = normalizeWatchlistRequestId(body?.requestId ?? body?.request_id)
    return { itemIds, reason, requestId }
}

export function roleCanManageOrganization(role: OrganizationRole | undefined) {
    return role === 'owner' || role === 'admin'
}

export function roleCanWriteWatchlist(role: OrganizationRole | undefined) {
    return watchlistWriteRoles.has(role as OrganizationRole)
}

export function organizationAlertCaseRoleActions(role: OrganizationAlertCaseRole | undefined): OrganizationAlertCaseAction[] {
    if (role === 'owner' || role === 'admin') {
        return [
            'create_watchlist',
            'edit_watchlist_terms',
            'archive_watchlist',
            'restore_watchlist',
            'acknowledge_alert',
            'assign_case',
            'link_case',
            'manage_invites',
        ]
    }

    if (role === 'analyst') {
        return ['acknowledge_alert', 'assign_case', 'link_case']
    }

    if (role === 'member') {
        return ['acknowledge_alert']
    }

    return []
}

export function organizationAlertCaseRoleActionContract(member: { userId: string, role: OrganizationRole }) {
    return {
        schemaVersion: 'organization.alert_case_role_actions.v1' as const,
        actor: {
            userId: member.userId,
            role: member.role,
            status: 'active' as const,
            allowedActions: organizationAlertCaseRoleActions(member.role),
        },
        roleGates: {
            create_watchlist: ['owner', 'admin'],
            edit_watchlist_terms: ['owner', 'admin'],
            archive_watchlist: ['owner', 'admin'],
            restore_watchlist: ['owner', 'admin'],
            acknowledge_alert: ['owner', 'admin', 'analyst', 'member'],
            assign_case: ['owner', 'admin', 'analyst'],
            link_case: ['owner', 'admin', 'analyst'],
            manage_invites: ['owner', 'admin'],
        } satisfies Record<OrganizationAlertCaseAction, OrganizationAlertCaseRole[]>,
        lifecycleDenials: {
            nonmember: 'nonmember_denied' as const,
            revokedMember: 'member_revoked' as const,
            expiredInvite: 'invite_expired' as const,
            pausedWatchlist: 'watchlist_paused' as const,
            archivedWatchlist: 'watchlist_archived' as const,
            supportOnlyAccess: 'support_only_access' as const,
        },
    }
}

export function organizationDownstreamAuthorizationExport(
    organization: Pick<OrganizationRow, 'id' | 'status' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>,
    items: OrganizationWatchlistRow[],
    member: { userId: string, role: OrganizationRole }
): OrganizationDownstreamAuthorizationExport {
    const organizationStatus = normalizeOrganizationStatus(organization.status)
    const visibility = organizationVisibilityDecision({
        role: member.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy ?? 'members',
    })
    const states = organizationWatchlistTerms(items).map(term => ({
        watchlistItemId: term.watchlistItemId,
        kind: term.kind,
        status: term.status,
    }))
    const activeIds = states.filter(state => state.status === 'active').map(state => state.watchlistItemId)
    const pausedIds = states.filter(state => state.status === 'paused').map(state => state.watchlistItemId)
    const archivedIds = states.filter(state => state.status === 'archived').map(state => state.watchlistItemId)
    const allowedActions = organizationAlertCaseRoleActions(member.role)
    const roleContract = organizationAlertCaseRoleActionContract(member)
    const blockerCodes: OrganizationWatchlistAlertBridgeBlockerCode[] = []
    if (organizationStatus !== 'active') blockerCodes.push(organizationStatus === 'archived' ? 'org_archived' : 'org_deleted')
    if (!activeIds.length) blockerCodes.push('no_active_terms', 'alert_export_unavailable')
    if (pausedIds.length) blockerCodes.push('watchlist_paused')
    if (archivedIds.length) blockerCodes.push('watchlist_archived')
    const canExportActiveTerms = organizationStatus === 'active' && visibility.allowed && activeIds.length > 0
    const defaultWebhookPolicy = organization.default_webhook_policy ?? 'active_destinations'

    return {
        schemaVersion: 'organization.downstream_authorization_export.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        organizationLifecycleState: organizationStatus,
        member: {
            userId: member.userId,
            role: member.role,
            status: 'active',
        },
        visibility,
        watchlists: {
            activeIds,
            pausedIds,
            archivedIds,
            activeCount: activeIds.length,
            pausedCount: pausedIds.length,
            archivedCount: archivedIds.length,
            states,
        },
        allowedActions,
        actionGates: Object.fromEntries(
            Object.entries(roleContract.roleGates).map(([action, allowedRoles]) => [
                action,
                {
                    allowed: allowedActions.includes(action as OrganizationAlertCaseAction),
                    allowedRoles,
                    denialReason: allowedActions.includes(action as OrganizationAlertCaseAction) ? null : 'role_not_allowed',
                },
            ])
        ) as OrganizationDownstreamAuthorizationExport['actionGates'],
        downstream: {
            alertGeneration: {
                canExportActiveTerms,
                excludedStatuses: ['paused', 'archived'],
                blockerCodes,
            },
            webhook: {
                defaultPolicy: defaultWebhookPolicy,
                canUseDefaultDestinations: canExportActiveTerms && defaultWebhookPolicy === 'active_destinations',
                denialReason: defaultWebhookPolicy === 'disabled' ? 'alert_bridge_unavailable' : null,
            },
            helpdesk: {
                mode: 'redacted_summary_only',
                supportOnlyDenialReason: 'support_only_access',
                safeFields: ['organizationId', 'tenantId', 'member.role', 'watchlists.activeCount', 'watchlists.pausedCount', 'watchlists.archivedCount', 'visibility.allowedRoles'],
            },
            dashboard: {
                readinessFixture: 'organization_watchlist',
                safeFields: ['organizationId', 'tenantId', 'organizationLifecycleState', 'member.role', 'allowedActions', 'watchlists.states', 'downstream.alertGeneration.blockerCodes'],
                nonmemberEnumeration: false,
            },
        },
        lifecycleDenials: {
            inactiveOrganization: 'no_active_org',
            archivedOrganization: 'org_archived',
            removedMember: 'member_revoked',
            revokedMember: 'member_revoked',
            deactivatedMember: 'revoked_member_denied',
            expiredInvite: 'invite_expired',
            revokedInvite: 'member_revoked',
            pausedWatchlist: 'watchlist_paused',
            archivedWatchlist: 'watchlist_archived',
            noActiveTerms: 'no_active_terms',
            nonmember: 'nonmember_denied',
            roleNotAllowed: 'role_not_allowed',
        },
    }
}

export function organizationSharedWatchlistDownstreamProof(
    organization: Pick<OrganizationRow, 'id' | 'status' | 'pending_invite_count' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>,
    items: OrganizationWatchlistRow[],
    member: { userId: string, role: OrganizationRole },
    alertGeneration: OrganizationWatchlistAlertGenerationContract,
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
): OrganizationSharedWatchlistDownstreamProof {
    const watchlistStates = organizationWatchlistTerms(items)
    const activeTerms = alertGeneration.activeWatchlistTerms
    const activeIds = watchlistStates.filter(state => state.status === 'active').map(state => state.watchlistItemId)
    const pausedIds = watchlistStates.filter(state => state.status === 'paused').map(state => state.watchlistItemId)
    const archivedIds = watchlistStates.filter(state => state.status === 'archived').map(state => state.watchlistItemId)
    const alertGeneratorKeys = activeTerms.map(term => organizationWatchlistAlertGenerationRef(term).dedupe.key)
    const alertBlockers = Array.from(new Set([
        ...alertGeneration.blockedReasons,
        ...downstreamAuthorization.downstream.alertGeneration.blockerCodes,
    ])) as OrganizationWatchlistAlertBridgeBlockerCode[]
    const caseBlockers = Array.from(new Set([
        ...alertBlockers,
        ...(!downstreamAuthorization.allowedActions.includes('link_case') ? ['role_not_allowed' as const] : []),
    ]))
    const alertVisibilityDenialReason = downstreamAuthorization.visibility.allowed
        ? (alertBlockers[0] ?? null)
        : downstreamAuthorization.visibility.reason
    const alertReadAllowed = downstreamAuthorization.visibility.allowed && alertBlockers.length === 0
    const webhookBlockers = Array.from(new Set([
        ...alertBlockers,
        downstreamAuthorization.downstream.webhook.denialReason,
        downstreamAuthorization.downstream.webhook.canUseDefaultDestinations ? undefined : 'manual_webhook_selection_required',
    ].filter(Boolean).map(String)))
    const webhookDeliveryAllowedByRole = member.role === 'owner' || member.role === 'admin'
    const webhookPolicy = downstreamAuthorization.downstream.webhook.defaultPolicy
    const selectedDestinationSource = webhookPolicy === 'active_destinations' && downstreamAuthorization.downstream.webhook.canUseDefaultDestinations
        ? 'org_active_destinations'
        : webhookPolicy === 'disabled'
            ? 'webhook_policy_disabled'
            : 'manual_selection_required'
    const webhookManualDenialReason = webhookDeliveryAllowedByRole
        ? (downstreamAuthorization.downstream.webhook.denialReason ?? (webhookPolicy === 'manual_selection' ? null : null))
        : 'role_not_allowed'

    return {
        schemaVersion: 'organization.shared_watchlist_downstream_proof.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        actor: {
            userId: member.userId,
            role: member.role,
            status: 'active',
            canManageWatchlists: roleCanWriteWatchlist(member.role),
            canExportActiveTerms: downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms,
            allowedActions: downstreamAuthorization.allowedActions,
        },
        inviteLifecycle: {
            pendingInviteCount: Number(organization.pending_invite_count ?? 0),
            acceptedInviteCreatesMembership: true,
            acceptedInviteRevocationBlocked: true,
            expiredInviteBlocker: 'invite_expired',
            revokedInviteBlocker: 'member_revoked',
            removedMemberReinviteBlocked: true,
            deactivatedUserInviteBlocked: true,
        },
        watchlistOwnership: {
            activeIds,
            pausedIds,
            archivedIds,
            activeCount: activeIds.length,
            pausedCount: pausedIds.length,
            archivedCount: archivedIds.length,
            ownerOrganizationId: organization.id,
            isolatedByOrganizationId: true,
            duplicateTermScope: 'organization',
            lifecycleStatuses: watchlistStates.map(term => ({
                watchlistItemId: term.watchlistItemId,
                organizationId: term.organizationId,
                status: term.status,
                createdBy: term.createdBy,
                updatedBy: term.updatedBy,
            })),
        },
        audit: {
            schemaVersion: 'organization.shared_watchlist_audit_contract.v1',
            source: 'service_logs',
            eventActions: [
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
                'organization_lifecycle_mutation_blocked',
            ],
            requiredMetadataFields: [
                'requestId',
                'watchlistItemId',
                'inviteId',
                'role',
                'reason',
                'action',
                'status',
            ],
            requestIdFields: [
                'metadata.requestId',
                'activeTerms[].alertGenerationRef.lifecycle.requestId',
                'watchlistOwnership.lifecycleStatuses[].watchlistItemId',
            ],
            actorFields: [
                'actor.userId',
                'actor.role',
                'watchlistOwnership.lifecycleStatuses[].createdBy',
                'watchlistOwnership.lifecycleStatuses[].updatedBy',
            ],
            downstreamCorrelationFields: [
                'organizationId',
                'tenantId',
                'watchlistOwnership.activeIds',
                'alertBridge.alertGeneratorKeys',
                'caseBridge.casePathTemplate',
                'webhookBridge.route',
            ],
            idempotentActions: ['invite_resend', 'invite_revoke', 'watchlist_cleanup', 'alert_terms_export'],
            proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist',
        },
        alertBridge: {
            route: 'organization_watchlist',
            canGenerateAlerts: alertGeneration.canGenerateAlerts,
            activeWatchlistItemIds: activeTerms.map(term => term.watchlistItemId),
            alertGeneratorKeys,
            alertGenerationRefField: 'activeTerms[].alertGenerationRef',
            dedupeScope: 'organization_watchlist_term',
            queueVisibilityContract: {
                schemaVersion: 'organization.watchlist_alert_visibility_contract.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                sourceFamily: 'organization_watchlist',
                routes: {
                    list: 'GET /v1/dwm/alerts',
                    detail: 'GET /v1/dwm/alerts/:id',
                    update: 'PATCH /v1/dwm/alerts/:id',
                    replay: 'POST /v1/dwm/alerts/:id/replay',
                },
                requiredQueryFields: ['organizationId'],
                watchlistScope: {
                    watchlistItemIds: activeTerms.map(term => term.watchlistItemId),
                    alertGeneratorKeys,
                    alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]',
                    dedupeScope: 'organization_watchlist_term',
                },
                actorVisibility: {
                    policy: downstreamAuthorization.visibility.alertVisibilityPolicy,
                    allowed: downstreamAuthorization.visibility.allowed,
                    denialReason: alertVisibilityDenialReason,
                    allowedRoles: downstreamAuthorization.visibility.allowedRoles,
                    actorRole: member.role,
                    nonmemberEnumeration: false,
                },
                actionGates: {
                    readAlertsAllowed: alertReadAllowed,
                    acknowledgeAllowed: alertReadAllowed && downstreamAuthorization.allowedActions.includes('acknowledge_alert'),
                    assignAllowed: alertReadAllowed && downstreamAuthorization.allowedActions.includes('assign_case'),
                    linkCaseAllowed: alertReadAllowed && downstreamAuthorization.allowedActions.includes('link_case'),
                    replayAllowed: alertReadAllowed && downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms,
                    mutateAllowedRoles: ['owner', 'admin', 'analyst'],
                },
                requiredAlertFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemIds',
                    'workflowContext.alertGeneratorKeys',
                    'workflowContext.watchlistTermContexts',
                    'visibilityDecision',
                    'casePath',
                ],
                evidenceFields: [
                    'alertId',
                    'createdAt',
                    'source',
                    'sourceFamily',
                    'watchlistItemIds',
                    'matchedTerms',
                    'casePath',
                    'workflowEvents',
                ],
                redactedFields: [
                    'activeTerms[].term',
                    'activeTerms[].value',
                    'watchlistTermContexts[].rawTerm',
                ],
                blockerCodes: [
                    ...alertBlockers,
                    ...(downstreamAuthorization.visibility.allowed ? [] : [downstreamAuthorization.visibility.reason].filter(Boolean)),
                ] as Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>,
            },
            expectedAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.alertGenerationRefs',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.watchlistTermContexts',
                'casePath',
            ],
            blockerCodes: alertBlockers,
        },
        caseBridge: {
            route: 'POST /v1/cases',
            casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
            expectedCaseFields: [
                'organizationId',
                'tenantId',
                'alertId',
                'casePath',
                'watchlistItemIds',
                'allowedActions',
                'visibilityDecision',
            ],
            allowedActions: downstreamAuthorization.allowedActions,
            blockerCodes: caseBlockers,
        },
        webhookBridge: {
            route: 'POST /v1/dwm/webhooks/deliver',
            defaultWebhookPolicy: downstreamAuthorization.downstream.webhook.defaultPolicy,
            canUseDefaultDestinations: downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
            deliveryContract: {
                schemaVersion: 'organization.watchlist_webhook_delivery_contract.v1',
                eventType: 'dwm.alert',
                organizationId: organization.id,
                tenantId: organization.id,
                sourceFamily: 'organization_watchlist',
                destinationSelection: {
                    policy: webhookPolicy,
                    selectedDestinationSource,
                    requiredDestinationOrgId: organization.id,
                    selectedDestinationOrgField: 'destination.org_id',
                    selectedDestinationIdField: 'webhookDestinationIds[]',
                    skippedDestinationReasons: [
                        'org_mismatch',
                        'destination_disabled',
                        'event_not_subscribed',
                        'manual_selection_required',
                        'webhook_policy_disabled',
                    ],
                    nonmemberDestinationEnumeration: false,
                },
                roleGates: {
                    automaticDeliveryAllowed: downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
                    manualTriggerAllowed: webhookDeliveryAllowedByRole && downstreamAuthorization.organizationLifecycleState === 'active',
                    manualTriggerAllowedRoles: ['owner', 'admin'],
                    memberManualTriggerAllowed: false,
                    denialReason: webhookManualDenialReason,
                },
                idempotency: {
                    scope: 'organization_destination_alert',
                    keyFields: ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'],
                },
                requiredAlertFields: [
                    'alert.id',
                    'alert.organizationId',
                    'alert.tenantId',
                    'alert.dedupeKey',
                    'alert.watchlistItemIds',
                    'alert.casePath',
                ],
                requiredDeliveryFields: [
                    'deliveryId',
                    'organizationId',
                    'destinationId',
                    'eventType',
                    'status',
                    'idempotencyKey',
                ],
                evidenceFields: [
                    'deliveryId',
                    'destinationId',
                    'attemptedAt',
                    'status',
                    'casePath',
                    'watchlistItemIds',
                    'auditEventContracts',
                ],
                redactedFields: [
                    'destination.endpoint',
                    'destination.secret',
                    'activeTerms[].term',
                    'activeTerms[].value',
                ],
                blockerCodes: webhookBlockers,
            },
            expectedDeliveryFields: [
                'organizationId',
                'alertId',
                'webhookDestinationIds',
                'watchlistItemIds',
                'deliveryId',
                'casePath',
                'auditEventContracts',
            ],
            blockerCodes: webhookBlockers,
        },
        integration: {
            expectedAdapter: 'organizationSharedWatchlistDownstreamProof',
            payloadShape: [
                'organizationId',
                'tenantId',
                'actor.role',
                'watchlistOwnership.activeIds',
                'watchlistOwnership.lifecycleStatuses',
                'alertBridge.alertGeneratorKeys',
                'alertBridge.queueVisibilityContract.actorVisibility',
                'alertBridge.queueVisibilityContract.watchlistScope',
                'alertBridge.expectedAlertFields',
                'caseBridge.expectedCaseFields',
                'webhookBridge.expectedDeliveryFields',
                'webhookBridge.deliveryContract.destinationSelection',
                'webhookBridge.deliveryContract.idempotency',
                'audit.eventActions',
                'audit.requiredMetadataFields',
                'inviteLifecycle.pendingInviteCount',
            ],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
            routeHandlers: [
                'api/src/handlers/organizations.ts',
                'ti/scraper/src/api/dwmWorkflowRoutes.ts',
                'ti/scraper/src/api/caseRoutes.ts',
            ],
            storageModules: [
                'api/src/utils/organizations.ts',
                'ti/scraper/src/storage/dwmAlertRepository.ts',
            ],
            nonmemberEnumeration: false,
            containsRawTerms: false,
        },
        blockers: Array.from(new Set([...alertBlockers, ...caseBlockers, ...webhookBlockers])).sort(),
    }
}

export function organizationVisibilityDecision(input: OrganizationVisibilityDecisionInput): OrganizationVisibilityDecision {
    const alertVisibilityPolicy = input.alertVisibilityPolicy ?? 'members'
    const allowedRoles = allowedOrganizationVisibilityRoles(alertVisibilityPolicy)
    if (!input.role || !input.status) {
        return { allowed: false, reason: 'not_member', alertVisibilityPolicy, allowedRoles }
    }

    if (input.userActive === false) {
        return { allowed: false, reason: 'member_deactivated', alertVisibilityPolicy, allowedRoles }
    }

    if (input.status !== 'active') {
        return { allowed: false, reason: input.status === 'removed' ? 'member_removed' : 'member_deactivated', alertVisibilityPolicy, allowedRoles }
    }

    if (!allowedRoles.includes(input.role)) {
        return { allowed: false, reason: 'role_not_allowed', alertVisibilityPolicy, allowedRoles }
    }

    return { allowed: true, reason: null, alertVisibilityPolicy, allowedRoles }
}

export function toOrganization(row: OrganizationRow) {
    const settings = organizationSettingsFromRow(row)
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        lifecycleStatus: normalizeOrganizationStatus(row.status),
        role: row.role,
        memberCount: Number(row.member_count ?? 0),
        ownerCount: Number(row.owner_count ?? 0),
        activeAdminCount: Number(row.admin_count ?? row.owner_count ?? 0),
        pendingInviteCount: Number(row.pending_invite_count ?? 0),
        sharedWatchlistCount: Number(row.shared_watchlist_count ?? 0),
        settings,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export function organizationLifecycleReadiness(row: OrganizationRow): OrganizationLifecycleReadiness {
    const memberCount = Number(row.member_count ?? 0)
    const ownerCount = Number(row.owner_count ?? 0)
    const activeAdminCount = Number(row.admin_count ?? row.owner_count ?? 0)
    const pendingInviteCount = Number(row.pending_invite_count ?? 0)
    const sharedWatchlistCount = Number(row.shared_watchlist_count ?? 0)
    const actorRole = row.role ?? 'viewer'
    const lifecycleStatus = normalizeOrganizationStatus(row.status)
    const typedBlockers: OrganizationLifecycleReadinessBlockerCode[] = []
    if (lifecycleStatus === 'archived') {
        typedBlockers.push('org_archived')
    }

    if (lifecycleStatus === 'deleted') {
        typedBlockers.push('org_deleted')
    }

    if (activeAdminCount < 1) {
        typedBlockers.push('no_active_admin')
    }

    if (sharedWatchlistCount < 1) {
        typedBlockers.push('watchlist_setup_required', 'alert_export_unavailable')
    }

    return {
        schemaVersion: 'organization.lifecycle_readiness.v1',
        organizationId: row.id,
        tenantId: row.id,
        lifecycleStatus,
        actorRole,
        counts: {
            memberCount,
            activeMemberCount: memberCount,
            ownerCount,
            activeAdminCount,
            pendingInviteCount,
            sharedWatchlistCount,
        },
        memberRoleReadiness: {
            ownerCanMutate: actorRole === 'owner',
            adminCanMutate: actorRole === 'owner' || actorRole === 'admin',
            memberCanReadAndExport: actorRole === 'owner' || actorRole === 'admin' || actorRole === 'member' || actorRole === 'viewer',
            supportReadMode: 'redacted_support_contract_only',
            nonmemberEnumeration: false,
            revokedMemberDenial: 'member_revoked',
            expiredInviteDenial: 'invite_expired',
            noActiveAdminBlocker: 'no_active_admin',
        },
        organizationLifecycle: {
            missingBlocker: 'org_missing',
            archivedBlocker: 'org_archived',
            deletedBlocker: 'org_deleted',
        },
        watchlistReadiness: {
            ready: sharedWatchlistCount > 0,
            activeSharedWatchlistCount: sharedWatchlistCount,
            setupBlocker: 'watchlist_setup_required',
        },
        alertExportReadiness: {
            ready: lifecycleStatus === 'active' && sharedWatchlistCount > 0 && activeAdminCount > 0,
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            unavailableBlocker: 'alert_export_unavailable',
        },
        cleanupReadiness: {
            cleanupRequired: false,
            cleanupIdempotent: true,
            route: 'POST /api/organizations/:id/watchlists/cleanup',
            cleanupRequiredBlocker: 'cleanup_required',
        },
        supportVisibility: {
            mode: 'redacted_summary_only',
            contract: 'admin_support',
            redactionBlocker: 'support_redaction_required',
        },
        dashboardFields: [
            'organizationId',
            'tenantId',
            'lifecycleStatus',
            'counts.memberCount',
            'counts.activeAdminCount',
            'counts.pendingInviteCount',
            'counts.sharedWatchlistCount',
            'memberRoleReadiness',
            'watchlistReadiness',
            'alertExportReadiness',
            'cleanupReadiness',
            'supportVisibility',
            'typedBlockers',
        ],
        typedBlockers,
        blockerCatalog: [
            'org_missing',
            'org_archived',
            'org_deleted',
            'no_active_admin',
            'member_revoked',
            'invite_expired',
            'watchlist_setup_required',
            'alert_export_unavailable',
            'support_redaction_required',
            'cleanup_required',
        ],
        readyForOnboarding: typedBlockers.length === 0,
    }
}

export function organizationReadinessProof(input: {
    lifecycleReadiness: OrganizationLifecycleReadiness
    alertGenerationBridge: OrganizationWatchlistAlertGenerationContract
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
}): OrganizationReadinessProof {
    const watchlists = input.downstreamAuthorization.watchlists
    const actorCanExportActiveTerms = input.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms
    const organizationCanGenerateAlerts = input.alertGenerationBridge.canGenerateAlerts
    const cleanupRequired = watchlists.pausedCount + watchlists.archivedCount > 0
    const blockers = Array.from(new Set([
        ...input.lifecycleReadiness.typedBlockers,
        ...input.alertGenerationBridge.blockedReasons,
        ...input.downstreamAuthorization.downstream.alertGeneration.blockerCodes,
        input.downstreamAuthorization.visibility.allowed ? undefined : input.downstreamAuthorization.visibility.reason,
        cleanupRequired ? 'cleanup_required' : undefined,
    ].filter(Boolean).map(String))).sort()

    return {
        schemaVersion: 'organization.worker3_ui_readiness_proof.v1',
        organizationId: input.downstreamAuthorization.organizationId,
        tenantId: input.downstreamAuthorization.tenantId,
        actor: {
            role: input.downstreamAuthorization.member.role,
            canExportActiveTerms: actorCanExportActiveTerms,
        },
        counts: {
            activeMemberCount: input.lifecycleReadiness.counts.activeMemberCount,
            activeAdminCount: input.lifecycleReadiness.counts.activeAdminCount,
            pendingInviteCount: input.lifecycleReadiness.counts.pendingInviteCount,
            activeWatchlistTermCount: input.alertGenerationBridge.activeWatchlistTerms.length,
            pausedWatchlistCount: watchlists.pausedCount,
            archivedWatchlistCount: watchlists.archivedCount,
        },
        readiness: {
            organizationCanGenerateAlerts,
            actorCanExportActiveTerms,
            readyForWorker3Replay: organizationCanGenerateAlerts && actorCanExportActiveTerms && !blockers.some(blocker => blocker.startsWith('org_') || blocker === 'no_active_admin' || blocker === 'no_active_terms' || blocker === 'alert_export_unavailable'),
            readyForDashboard: input.lifecycleReadiness.lifecycleStatus === 'active' && input.lifecycleReadiness.counts.activeAdminCount > 0,
            cleanupRequired,
        },
        routes: {
            createOrganization: 'POST /api/organizations',
            inviteMembers: 'POST /api/organizations/:id/invites',
            acceptInvite: 'POST /api/organizations/invites/:inviteId/accept',
            listWatchlists: 'GET /api/organizations/:id/watchlists',
            mutateWatchlist: 'POST|PUT|DELETE /api/organizations/:id/watchlists',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            cleanupWatchlists: 'POST /api/organizations/:id/watchlists/cleanup',
        },
        worker3Proof: {
            noNetworkRequired: true,
            replayRoute: 'organization_watchlist',
            exportSchema: 'organization.watchlist_alert_terms_export.v1',
            alertGenerationRefField: 'activeTerms[].alertGenerationRef',
            alertGeneratorKeyField: 'activeTerms[].alertGenerationRef.dedupe.key',
            expectedAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.alertGenerationRefs',
                'workflowContext.alertGeneratorKeys',
                'casePath',
            ],
            testCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        alertQueueProof: {
            schemaVersion: 'organization.alert_queue_visibility_proof.v1',
            visibilitySchema: 'dwm.org_alert_queue_visibility.v1',
            routes: {
                list: 'GET /v1/dwm/alerts',
                detail: 'GET /v1/dwm/alerts/:id',
                mutate: 'PATCH /v1/dwm/alerts/:id',
                replay: 'POST /v1/dwm/alerts/:id/replay',
            },
            requiredQueryFields: ['organizationId'],
            expectedVisibilityFields: [
                'alertQueueVisibility.organizationId',
                'alertQueueVisibility.tenantId',
                'alertQueueVisibility.member.role',
                'alertQueueVisibility.allowedActions',
                'alertQueueVisibility.actionGates',
                'alertQueueVisibility.watchlistScope.watchlistItemIds',
                'alertQueueVisibility.watchlistScope.alertGeneratorKeys',
                'alertQueueVisibility.blockers',
            ],
            allowedActions: input.downstreamAuthorization.allowedActions,
            blockerCodes: blockers,
            nonmemberEnumeration: false,
        },
        webhookDeliveryProof: {
            schemaVersion: 'organization.webhook_delivery_visibility_proof.v1',
            deliveryContractSchema: 'dwm.webhook.org_alert_delivery.v1',
            route: 'POST /dwm/webhook-deliveries',
            defaultWebhookPolicy: input.downstreamAuthorization.downstream.webhook.defaultPolicy,
            canUseDefaultDestinations: input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
            ownerAdminManualTriggerRequired: true,
            memberManualTriggerAllowed: false,
            nonmemberDestinationEnumeration: false,
            expectedDeliveryFields: [
                'orgAlertDelivery.organization.id',
                'orgAlertDelivery.alert.id',
                'orgAlertDelivery.watchlist.watchlistItemIds',
                'orgAlertDelivery.destinationSelection.selectedDestinations',
                'orgAlertDelivery.destinationSelection.skippedDestinations',
                'orgAlertDelivery.ledger.deliveries',
                'orgAlertDelivery.auditEventContracts',
            ],
            blockerCodes: [
                ...input.downstreamAuthorization.downstream.alertGeneration.blockerCodes,
                input.downstreamAuthorization.downstream.webhook.denialReason,
                input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations ? undefined : 'manual_webhook_selection_required',
            ].filter(Boolean).map(String),
        },
        uiProof: {
            safeFields: [
                'organizationId',
                'tenantId',
                'counts',
                'readiness',
                'routes',
                'alertQueueProof',
                'webhookDeliveryProof',
                'blockers',
                'uiProof.nonmemberEnumeration',
            ],
            redactedFields: [
                'activeTerms[].term',
                'activeTerms[].value',
                'member.userId',
                'alertGenerationRef.lifecycle.createdBy',
            ],
            nonmemberEnumeration: false,
            dashboardFixture: 'organization_watchlist',
        },
        cleanupProof: {
            cleanupIdempotent: true,
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            cleanupRequiredBlocker: 'cleanup_required',
        },
        blockers,
    }
}

export function toInvite(row: OrganizationInviteRow) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        tenantId: row.organization_id,
        acceptanceToken: row.id,
        acceptancePath: `/api/organizations/invites/${encodeURIComponent(row.id)}/accept`,
        email: row.email,
        role: row.role,
        invitedBy: row.invited_by,
        acceptedBy: row.accepted_by ?? null,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at ?? null,
    }
}

export function toMember(row: OrganizationMemberRow) {
    return {
        organizationId: row.organization_id,
        userId: row.user_id,
        name: row.name,
        avatar: row.avatar,
        role: row.role,
        status: row.status,
        invitedBy: row.invited_by ?? null,
        joinedAt: row.joined_at,
        createdAt: row.created_at,
    }
}

export function toWatchlistItem(row: OrganizationWatchlistRow) {
    const status = normalizeWatchlistStatus(row)
    return {
        id: row.id,
        itemId: row.id,
        watchlistItemId: row.id,
        organizationId: row.organization_id,
        tenantId: row.organization_id,
        ownerOrganizationId: row.organization_id,
        kind: row.kind,
        termFamily: row.kind,
        category: row.kind,
        term: row.value,
        value: row.value,
        terms: [row.value],
        status,
        notes: row.notes,
        createdBy: row.created_by,
        updatedBy: row.updated_by ?? null,
        lifecycleReason: row.lifecycle_reason ?? null,
        lifecycleRequestId: row.lifecycle_request_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at ?? null,
        alertGenerationReference: {
            schemaVersion: 'organization.watchlist_item_alert_reference.v1',
            organizationId: row.organization_id,
            tenantId: row.organization_id,
            watchlistItemId: row.id,
            itemId: row.id,
            termFamily: row.kind,
            category: row.kind,
            term: row.value,
            status,
        },
    }
}

export function buildOrganizationDwmAlertReference(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>,
    item: OrganizationWatchlistRow
): OrganizationDwmAlertReference {
    const watchlistName = `${organization.name} ${item.kind} watchlist`
    const casePath = `/dashboard/dwm?organizationId=${encodeURIComponent(organization.id)}&watchlistItemId=${encodeURIComponent(item.id)}`
    const dedupeKey = `org:${organization.id}:watchlist:${item.id}:${item.kind}:${item.value.toLowerCase()}`
    const bridgeContext = buildOrganizationBridgeContext(organization)
    const watchlist = {
        id: item.id,
        name: watchlistName,
        itemId: item.id,
        kind: item.kind,
        termFamily: item.kind,
        status: normalizeWatchlistStatus(item),
        createdBy: item.created_by,
        updatedBy: item.updated_by ?? null,
        terms: [item.value],
    }
    const matchedTerm = {
        value: item.value,
        kind: item.kind,
        termFamily: item.kind,
    }

    return {
        schemaVersion: 'organization.dwm_alert_bridge.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        watchlistItemId: item.id,
        watchlistKind: item.kind,
        matchedTerm,
        watchlist,
        organization: bridgeContext,
        alert: {
            id: dedupeKey,
            organizationId: organization.id,
            orgId: organization.id,
            tenantId: organization.id,
            orgName: organization.name,
            defaultWebhookPolicy: bridgeContext.defaultWebhookPolicy,
            alertVisibilityPolicy: bridgeContext.alertVisibilityPolicy,
            memberCount: bridgeContext.memberCount,
            activeMemberCount: bridgeContext.activeMemberCount,
            ownerCount: bridgeContext.ownerCount,
            allowedViewerRoles: bridgeContext.allowedViewerRoles,
            removedMemberDenialReason: bridgeContext.removedMemberDenialReason,
            deactivatedMemberDenialReason: bridgeContext.deactivatedMemberDenialReason,
            pendingInviteCount: bridgeContext.pendingInviteCount,
            sharedWatchlistCount: bridgeContext.sharedWatchlistCount,
            readinessStatus: bridgeContext.readinessStatus,
            watchlistItemId: item.id,
            matchedTerm,
            watchlist,
            sourceFamily: 'organization_watchlist',
            artifactType: 'watchlist_readiness',
            route: 'organization_watchlist',
            casePath,
            dedupeKey,
        },
        webhookContract: {
            orgId: organization.id,
            watchlistId: item.id,
            watchlistName,
            defaultWebhookPolicy: bridgeContext.defaultWebhookPolicy,
            alertVisibilityPolicy: bridgeContext.alertVisibilityPolicy,
            memberCount: bridgeContext.memberCount,
            activeMemberCount: bridgeContext.activeMemberCount,
            ownerCount: bridgeContext.ownerCount,
            allowedViewerRoles: bridgeContext.allowedViewerRoles,
            removedMemberDenialReason: bridgeContext.removedMemberDenialReason,
            deactivatedMemberDenialReason: bridgeContext.deactivatedMemberDenialReason,
            pendingInviteCount: bridgeContext.pendingInviteCount,
            sharedWatchlistCount: bridgeContext.sharedWatchlistCount,
            readinessStatus: bridgeContext.readinessStatus,
            route: 'organization_watchlist',
            casePath,
        },
    }
}

export function buildOrganizationBridgeContext(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>
): OrganizationBridgeContext {
    const sharedWatchlistCount = Number(organization.shared_watchlist_count ?? 0)
    const alertVisibilityPolicy = organization.alert_visibility_policy ?? 'members'
    return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        defaultWebhookPolicy: organization.default_webhook_policy ?? 'active_destinations',
        alertVisibilityPolicy,
        memberCount: Number(organization.member_count ?? 0),
        activeMemberCount: Number(organization.member_count ?? 0),
        ownerCount: Number(organization.owner_count ?? 0),
        allowedViewerRoles: allowedOrganizationVisibilityRoles(alertVisibilityPolicy),
        removedMemberDenialReason: organizationVisibilityDecision({
            role: 'member',
            status: 'removed',
            alertVisibilityPolicy,
        }).reason ?? 'member_removed',
        deactivatedMemberDenialReason: organizationVisibilityDecision({
            role: 'member',
            status: 'active',
            userActive: false,
            alertVisibilityPolicy,
        }).reason ?? 'member_deactivated',
        pendingInviteCount: Number(organization.pending_invite_count ?? 0),
        sharedWatchlistCount,
        readinessStatus: sharedWatchlistCount > 0 ? 'ready' : 'needs_watchlist',
    }
}

export function organizationSettingsFromRow(row: Pick<OrganizationRow, 'status' | 'default_webhook_policy' | 'alert_visibility_policy' | 'retention_days' | 'audit_safe_metadata'>) {
    return {
        defaultWebhookPolicy: row.default_webhook_policy ?? 'active_destinations',
        alertVisibilityPolicy: row.alert_visibility_policy ?? 'members',
        lifecycleStatus: normalizeOrganizationStatus(row.status),
        retentionDays: Number(row.retention_days ?? 365),
        auditSafeMetadata: row.audit_safe_metadata ?? {},
    }
}

export function organizationWatchlistTerms(items: OrganizationWatchlistRow[]): OrganizationWatchlistTerm[] {
    return items.map(item => ({
        watchlistItemId: item.id,
        itemId: item.id,
        organizationId: item.organization_id,
        tenantId: item.organization_id,
        kind: item.kind,
        termFamily: item.kind,
        family: item.kind,
        category: item.kind,
        term: item.value,
        value: item.value,
        terms: [item.value],
        status: normalizeWatchlistStatus(item),
        createdBy: item.created_by,
        updatedBy: item.updated_by ?? null,
        lifecycleReason: item.lifecycle_reason ?? null,
        lifecycleRequestId: item.lifecycle_request_id ?? null,
    })).sort((a, b) => `${a.termFamily}:${a.term}`.localeCompare(`${b.termFamily}:${b.term}`))
}

export function organizationWatchlistAlertGenerationContract(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'status' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>,
    items: OrganizationWatchlistRow[]
): OrganizationWatchlistAlertGenerationContract {
    const organizationStatus = normalizeOrganizationStatus(organization.status)
    const activeItems = organizationStatus === 'active' ? items.filter(item => normalizeWatchlistStatus(item) === 'active') : []
    const bridgeContext = buildOrganizationBridgeContext({
        ...organization,
        shared_watchlist_count: activeItems.length,
    })
    const activeWatchlistTerms = organizationWatchlistTerms(activeItems)
    const termFamilies = [...new Set(activeWatchlistTerms.map(term => term.termFamily))].sort()
    const blockedReasons: string[] = []
    if (organizationStatus !== 'active') {
        blockedReasons.push(organizationStatus === 'archived' ? 'org_archived' : 'org_deleted')
    }

    if (!activeItems.length) {
        blockedReasons.push('needs_shared_watchlist_item')
    }

    if (!bridgeContext.allowedViewerRoles.length) {
        blockedReasons.push('needs_alert_visibility_roles')
    }

    return {
        schemaVersion: 'organization.watchlist_alert_generation.v1',
        organizationId: bridgeContext.id,
        tenantId: bridgeContext.id,
        ownerOrganizationId: bridgeContext.id,
        visibilityPolicy: bridgeContext.alertVisibilityPolicy,
        allowedViewerRoles: bridgeContext.allowedViewerRoles,
        activeWatchlistTerms,
        termFamilies,
        blockedReasons,
        canGenerateAlerts: blockedReasons.length === 0,
    }
}

export function organizationWatchlistAlertTermsExport(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'status' | 'member_count' | 'owner_count' | 'admin_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>,
    items: OrganizationWatchlistRow[],
    member: { userId: string, role: OrganizationRole }
): OrganizationWatchlistAlertTermsExport {
    const alertGeneration = organizationWatchlistAlertGenerationContract(organization, items)
    const downstreamAuthorization = organizationDownstreamAuthorizationExport(organization, items, member)
    const activeTerms = alertGeneration.activeWatchlistTerms.map(term => {
        const alertGenerationRef = organizationWatchlistAlertGenerationRef(term)
        return {
            ...term,
            source: 'organization_shared_watchlist' as const,
            alertGeneratorKey: alertGenerationRef.dedupe.key,
            alertGenerationRef,
            alertGenerationReference: {
                schemaVersion: 'organization.watchlist_item_alert_reference.v1' as const,
                organizationId: term.organizationId,
                tenantId: term.tenantId,
                watchlistItemId: term.watchlistItemId,
                itemId: term.itemId,
                termFamily: term.termFamily,
                category: term.category,
                term: term.term,
                status: 'active' as const,
            },
        }
    })
    const statuses = items.map(normalizeWatchlistStatus)
    const pausedCount = statuses.filter(status => status === 'paused').length
    const archivedCount = statuses.filter(status => status === 'archived').length
    const activeAdminCount = Number(organization.admin_count ?? organization.owner_count ?? 0)
    const organizationStatus = normalizeOrganizationStatus(organization.status)
    const typedBlockers = organizationWatchlistAlertBridgeBlockers({
        organizationId: organization.id,
        tenantId: organization.id,
        organizationStatus,
        activeAdminCount,
        activeTermCount: activeTerms.length,
        pausedCount,
        archivedCount,
        missingAlertRefCount: 0,
    })
    const lifecycleTypedBlockers = organizationWatchlistLifecycleBlockers({
        activeTermCount: activeTerms.length,
        pausedCount,
        archivedCount,
    })
    const alertCaseProofBlockers = organizationWatchlistAlertCaseProofBlockers({
        organizationId: organization.id,
        tenantId: organization.id,
        activeAdminCount,
        activeTermCount: activeTerms.length,
        pausedCount,
        archivedCount,
    })
    const cleanupRequired = pausedCount + archivedCount > 0
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        member: {
            userId: member.userId,
            role: member.role,
            status: 'active',
        },
        visibilityPolicy: alertGeneration.visibilityPolicy,
        allowedViewerRoles: alertGeneration.allowedViewerRoles,
        recommendedDownstreamRoute: 'organization_watchlist',
        downstreamAuthorization,
        alertBridgeContract: {
            schemaVersion: 'organization.watchlist_alert_bridge_contract.v1',
            recommendedDownstreamRoute: 'organization_watchlist',
            memberProvenance: {
                userId: member.userId,
                role: member.role,
                status: 'active',
            },
            supportAccess: {
                mode: 'support_contract_only',
                blockerCode: 'support_only_access',
                message: 'Support users must inspect org watchlist alert exports through the admin support contract, not member-scoped org routes.',
            },
            supportVisibility: {
                mode: 'redacted_summary_only',
                contract: 'admin_support',
                safeFields: [
                    'organizationId',
                    'tenantId',
                    'activeTermCount',
                    'termFamilies',
                    'pausedCount',
                    'archivedCount',
                    'visibilityPolicy',
                    'allowedViewerRoles',
                ],
                redactedFields: [
                    'member.userId',
                    'activeTerms[].term',
                    'activeTerms[].value',
                    'activeTerms[].terms',
                    'activeTerms[].alertGenerationRef.term',
                    'activeTerms[].alertGenerationRef.lifecycle.createdBy',
                    'activeTerms[].alertGenerationRef.lifecycle.updatedBy',
                ],
                message: 'Support/admin consumers should use this summary unless an approved support action contract grants scoped member-visible inspection.',
            },
            deniedAccess: {
                nonmember: 'nonmember_denied',
                revokedMember: 'revoked_member_denied',
            },
            caseRouteExpectation: {
                route: 'organization_watchlist',
                pathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
                queryFields: ['organizationId', 'watchlistItemId'],
                blockerCode: 'no_case_route',
            },
            redactedSummary: {
                schemaVersion: 'organization.watchlist_alert_bridge_redacted_summary.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                activeTermCount: activeTerms.length,
                termFamilies: alertGeneration.termFamilies,
                pausedCount,
                archivedCount,
                cleanupRequired,
                visibilityPolicy: alertGeneration.visibilityPolicy,
                allowedViewerRoles: alertGeneration.allowedViewerRoles,
                containsRawTerms: false,
            },
            lifecycleReadiness: {
                schemaVersion: 'organization.watchlist_lifecycle_readiness.v1',
                organization: {
                    status: 'active',
                    deletedBlocker: 'org_deleted',
                },
                member: {
                    status: 'active',
                    revokedBlocker: 'member_revoked',
                },
                invites: {
                    expiredInviteBlocker: 'invite_expired',
                    revokedInviteBlocker: 'member_revoked',
                },
                watchlists: {
                    activeTermCount: activeTerms.length,
                    pausedCount,
                    archivedCount,
                    cleanupRequired,
                    cleanupIdempotent: true,
                    pausedBlocker: 'watchlist_paused',
                    archivedBlocker: 'watchlist_archived',
                    noActiveTermsBlocker: 'no_active_terms',
                    cleanupRequiredBlocker: 'cleanup_required',
                },
                alertReplay: {
                    status: activeTerms.length > 0 ? 'ready' : 'blocked',
                    unavailableBlocker: 'alert_bridge_unavailable',
                },
                caseRoute: {
                    status: 'expected',
                    unavailableBlocker: 'case_route_unavailable',
                },
                typedBlockers: lifecycleTypedBlockers,
            },
            alertCaseProof: {
                schemaVersion: 'organization.watchlist_alert_case_proof.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                readyForReplay: !alertCaseProofBlockers.some(blocker => blocker.severity === 'blocker'),
                activeAdminCount,
                activeTermCount: activeTerms.length,
                replayRoute: 'organization_watchlist',
                expectedAlertFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemId',
                    'matchedTerm.termFamily',
                    'alertGeneratorKey',
                    'alertGenerationRef.dedupe.key',
                    'alertGenerationRef.lifecycle.requestId',
                ],
                expectedCaseFields: [
                    'route',
                    'casePath',
                    'organizationId',
                    'watchlistItemId',
                    'allowedViewerRoles',
                    'caseRouteExpectation.pathTemplate',
                ],
                expectedSupportFields: [
                    'redactedSummary',
                    'supportVisibility.mode',
                    'supportVisibility.safeFields',
                    'supportVisibility.redactedFields',
                    'supportAccess.blockerCode',
                ],
                memberVisibility: {
                    mode: 'member_scoped_export',
                    userId: member.userId,
                    role: member.role,
                    status: 'active',
                    nonmemberEnumeration: false,
                    revokedMemberDenial: 'member_revoked',
                },
                roleActionContract: organizationAlertCaseRoleActionContract(member),
                supportRedaction: {
                    mode: 'redacted_summary_only',
                    required: true,
                    blockerCode: 'support_redaction_required',
                },
                cleanupLifecycle: {
                    cleanupRequired,
                    cleanupIdempotent: true,
                    cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
                    pausedExcludedCount: pausedCount,
                    archivedExcludedCount: archivedCount,
                    cleanupRequiredBlocker: 'cleanup_required',
                },
                typedBlockers: alertCaseProofBlockers,
            },
            requiredFields: [
                'organizationId',
                'tenantId',
                'member.userId',
                'member.role',
                'activeTerms[].watchlistItemId',
                'activeTerms[].itemId',
                'activeTerms[].status',
                'activeTerms[].termFamily',
                'activeTerms[].term',
                'activeTerms[].alertGenerationRef',
                'activeTerms[].alertGenerationRef.dedupe.key',
                'activeTerms[].alertGeneratorKey',
                'alertBridgeContract.caseRouteExpectation.pathTemplate',
                'alertBridgeContract.redactedSummary',
                'alertBridgeContract.lifecycleReadiness',
                'alertBridgeContract.alertCaseProof',
            ],
            alertGeneratorKeyExpectation: 'alertGenerationRef.dedupe.key',
            typedBlockers,
            blockerCatalog: [
                'no_active_org',
                'no_active_admin',
                'org_archived',
                'org_deleted',
                'invite_expired',
                'member_revoked',
                'watchlist_archived',
                'watchlist_paused',
                'no_active_terms',
                'paused_archived_only',
                'cleanup_required',
                'alert_bridge_unavailable',
                'alert_export_unavailable',
                'case_route_unavailable',
                'support_redaction_required',
                'no_active_watchlist_terms',
                'paused_watchlist_excluded',
                'archived_watchlist_excluded',
                'missing_org_tenant',
                'revoked_member_denied',
                'no_alert_ref',
                'no_case_route',
                'support_only_access',
                'nonmember_denied',
                'role_not_allowed',
            ],
        },
        activeTerms,
        sharedWatchlistDownstreamProof: organizationSharedWatchlistDownstreamProof(organization, items, member, alertGeneration, downstreamAuthorization),
        activeWatchlistTerms: alertGeneration.activeWatchlistTerms,
        termFamilies: alertGeneration.termFamilies,
        excluded: {
            pausedCount,
            archivedCount,
            inactiveCount: pausedCount + archivedCount,
        },
        blockedReasons: alertGeneration.blockedReasons,
        canGenerateAlerts: alertGeneration.canGenerateAlerts,
    }
}

function organizationWatchlistLifecycleBlockers(input: {
    activeTermCount: number
    pausedCount: number
    archivedCount: number
}): OrganizationWatchlistAlertBridgeBlocker[] {
    const blockers: OrganizationWatchlistAlertBridgeBlocker[] = []
    if (input.activeTermCount === 0) {
        blockers.push({
            code: 'no_active_terms',
            severity: 'blocker',
            message: 'No active organization watchlist terms are available for alert replay.',
        })
        blockers.push({
            code: 'alert_bridge_unavailable',
            severity: 'blocker',
            message: 'Alert replay is unavailable until at least one active org watchlist term is exported.',
        })
    }

    if (input.pausedCount > 0) {
        blockers.push({
            code: 'watchlist_paused',
            severity: 'notice',
            message: 'Paused org watchlist items are excluded from alert replay until resumed.',
            count: input.pausedCount,
        })
    }

    if (input.archivedCount > 0) {
        blockers.push({
            code: 'watchlist_archived',
            severity: 'notice',
            message: 'Archived org watchlist items are excluded from alert replay and remain available for cleanup audit.',
            count: input.archivedCount,
        })
    }

    if (input.pausedCount + input.archivedCount > 0) {
        blockers.push({
            code: 'cleanup_required',
            severity: 'notice',
            message: 'Paused or archived org watchlist items exist; repeatable cleanup/list flows should account for them.',
            count: input.pausedCount + input.archivedCount,
        })
    }

    return blockers
}

function organizationWatchlistAlertBridgeBlockers(input: {
    organizationId: string
    tenantId: string
    organizationStatus: OrganizationLifecycleStatus
    activeAdminCount: number
    activeTermCount: number
    pausedCount: number
    archivedCount: number
    missingAlertRefCount: number
}): OrganizationWatchlistAlertBridgeBlocker[] {
    const blockers: OrganizationWatchlistAlertBridgeBlocker[] = []
    if (!input.organizationId || !input.tenantId) {
        blockers.push({
            code: 'missing_org_tenant',
            severity: 'blocker',
            message: 'Organization and tenant ids are required before org watchlist terms can generate alerts.',
        })
    }

    if (input.organizationStatus !== 'active') {
        blockers.push({
            code: input.organizationStatus === 'archived' ? 'org_archived' : 'org_deleted',
            severity: 'blocker',
            message: 'Organization lifecycle is not active, so org watchlist terms must not generate alerts.',
        })
    }

    if (input.activeAdminCount < 1) {
        blockers.push({
            code: 'no_active_admin',
            severity: 'blocker',
            message: 'At least one active owner/admin is required before org watchlist alerts can be generated safely.',
        })
    }

    if (input.activeTermCount === 0) {
        blockers.push({
            code: 'no_active_watchlist_terms',
            severity: 'blocker',
            message: 'No active organization watchlist terms are available for alert generation.',
        })
    }

    if (input.missingAlertRefCount > 0) {
        blockers.push({
            code: 'no_alert_ref',
            severity: 'blocker',
            message: 'One or more active terms is missing alertGenerationRef metadata.',
            count: input.missingAlertRefCount,
        })
    }

    if (input.pausedCount > 0) {
        blockers.push({
            code: 'paused_watchlist_excluded',
            severity: 'notice',
            message: 'Paused watchlist items are auditable but excluded from active alert matching.',
            count: input.pausedCount,
        })
    }

    if (input.archivedCount > 0) {
        blockers.push({
            code: 'archived_watchlist_excluded',
            severity: 'notice',
            message: 'Archived watchlist items are auditable but excluded from active alert matching.',
            count: input.archivedCount,
        })
    }

    return blockers
}

function organizationWatchlistAlertCaseProofBlockers(input: {
    organizationId: string
    tenantId: string
    activeAdminCount: number
    activeTermCount: number
    pausedCount: number
    archivedCount: number
}): OrganizationWatchlistAlertBridgeBlocker[] {
    const blockers: OrganizationWatchlistAlertBridgeBlocker[] = []
    if (!input.organizationId || !input.tenantId) {
        blockers.push({
            code: 'no_active_org',
            severity: 'blocker',
            message: 'An active organization and tenant id are required for org-scoped alert/case proof.',
        })
    }

    if (input.activeAdminCount < 1) {
        blockers.push({
            code: 'no_active_admin',
            severity: 'blocker',
            message: 'Org alert/case proof requires at least one active owner/admin.',
        })
    }

    if (input.activeTermCount === 0) {
        blockers.push({
            code: 'no_active_terms',
            severity: 'blocker',
            message: 'No active org watchlist terms are available for alert/case replay.',
        })
        blockers.push({
            code: 'alert_export_unavailable',
            severity: 'blocker',
            message: 'Alert export is unavailable until active org watchlist terms exist.',
        })
    }

    if (input.activeTermCount === 0 && input.pausedCount + input.archivedCount > 0) {
        blockers.push({
            code: 'paused_archived_only',
            severity: 'blocker',
            message: 'Only paused or archived org watchlist terms exist, so active alert matching must remain disabled.',
            count: input.pausedCount + input.archivedCount,
        })
    }

    if (input.pausedCount + input.archivedCount > 0) {
        blockers.push({
            code: 'cleanup_required',
            severity: 'notice',
            message: 'Paused or archived watchlist terms are excluded from matching and should be cleaned up after proof runs.',
            count: input.pausedCount + input.archivedCount,
        })
    }

    return blockers
}

function organizationWatchlistAlertGenerationRef(term: OrganizationWatchlistTerm): OrganizationWatchlistAlertGenerationRef {
    const normalizedTerm = cleanText(term.term).toLowerCase()
    const key = `org:${term.organizationId}:watchlist:${term.watchlistItemId}:${term.termFamily}:${normalizedTerm}`
    return {
        schemaVersion: 'organization.watchlist_alert_generation_ref.v1',
        source: 'organization_shared_watchlist',
        organizationId: term.organizationId,
        tenantId: term.tenantId,
        ownerOrganizationId: term.organizationId,
        watchlistId: term.watchlistItemId,
        watchlistItemId: term.watchlistItemId,
        itemId: term.itemId,
        termFamily: term.termFamily,
        category: term.category,
        term: term.term,
        normalizedTerm,
        status: 'active',
        lifecycle: {
            status: 'active',
            reason: term.lifecycleReason,
            requestId: term.lifecycleRequestId,
            createdBy: term.createdBy,
            updatedBy: term.updatedBy,
        },
        dedupe: {
            scope: 'organization_watchlist_term',
            key,
            parts: {
                organizationId: term.organizationId,
                tenantId: term.tenantId,
                watchlistItemId: term.watchlistItemId,
                termFamily: term.termFamily,
                normalizedTerm,
            },
        },
    }
}

export function slugForOrganization(value: string) {
    return slugFor(value)
}

function normalizeInviteRole(value: unknown): OrganizationRole {
    const role = cleanText(value).toLowerCase() || 'member'
    if (!inviteRoles.has(role as OrganizationRole)) {
        throw new Error('Invite role must be admin, member, or viewer.')
    }

    return role as OrganizationRole
}

function allowedOrganizationVisibilityRoles(policy: OrganizationAlertVisibilityPolicy): OrganizationRole[] {
    if (policy === 'owners') return ['owner']
    if (policy === 'admins') return ['owner', 'admin']
    return ['owner', 'admin', 'member', 'viewer']
}

function normalizeSettingsName(value: unknown) {
    const name = cleanText(value)
    if (!name) {
        throw new Error('Organization name is required.')
    }

    if (name.length > 120) {
        throw new Error('Organization name must be 120 characters or fewer.')
    }

    return name
}

function normalizeSettingsSlug(value: unknown) {
    const slug = slugFor(cleanText(value))
    if (!slug) {
        throw new Error('Organization slug is required.')
    }

    if (slug.length > 80) {
        throw new Error('Organization slug must be 80 characters or fewer.')
    }

    return slug
}

function normalizeDefaultWebhookPolicy(value: unknown) {
    if (value === undefined) return undefined
    const policy = cleanText(value).toLowerCase()
    if (!defaultWebhookPolicies.has(policy as OrganizationDefaultWebhookPolicy)) {
        throw new Error('Default webhook policy must be active_destinations, manual_selection, or disabled.')
    }

    return policy as OrganizationDefaultWebhookPolicy
}

function normalizeAlertVisibilityPolicy(value: unknown) {
    if (value === undefined) return undefined
    const policy = cleanText(value).toLowerCase()
    if (!alertVisibilityPolicies.has(policy as OrganizationAlertVisibilityPolicy)) {
        throw new Error('Alert visibility policy must be members, admins, or owners.')
    }

    return policy as OrganizationAlertVisibilityPolicy
}

function normalizeOrganizationLifecycleStatus(value: unknown) {
    if (value === undefined) return undefined
    const status = cleanText(value).toLowerCase()
    if (!organizationLifecycleStatuses.has(status as OrganizationLifecycleStatus)) {
        throw new Error('Organization lifecycle status must be active, archived, or deleted.')
    }

    return status as OrganizationLifecycleStatus
}

function normalizeOrganizationStatus(value: unknown): OrganizationLifecycleStatus {
    const status = cleanText(value).toLowerCase()
    return organizationLifecycleStatuses.has(status as OrganizationLifecycleStatus)
        ? status as OrganizationLifecycleStatus
        : 'active'
}

function normalizeRetentionDays(value: unknown) {
    if (value === undefined) return undefined
    const days = typeof value === 'number' ? value : Number(cleanText(value))
    if (!Number.isInteger(days) || days < 30 || days > 2555) {
        throw new Error('Retention days must be an integer between 30 and 2555.')
    }

    return days
}

function normalizeAuditSafeMetadata(value: unknown) {
    if (value === undefined) return undefined
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Audit-safe metadata must be an object.')
    }

    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length > 20) {
        throw new Error('Audit-safe metadata can contain at most 20 keys.')
    }

    return Object.fromEntries(entries.map(([rawKey, rawValue]) => {
        const key = rawKey.trim().replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 64)
        if (!key) {
            throw new Error('Audit-safe metadata keys must contain letters or numbers.')
        }

        if (rawValue === null || typeof rawValue === 'boolean' || typeof rawValue === 'number') {
            return [key, rawValue]
        }

        if (typeof rawValue === 'string') {
            const value = cleanText(rawValue).slice(0, 240)
            if (looksSensitive(value)) {
                throw new Error('Audit-safe metadata cannot contain emails, URLs, or secrets.')
            }

            return [key, value]
        }

        throw new Error('Audit-safe metadata values must be strings, numbers, booleans, or null.')
    }))
}

function normalizeInviteExpiry(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
        return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    }

    const expiresAt = new Date(value)
    if (!Number.isFinite(expiresAt.getTime())) {
        throw new Error('Invite expiry must be a valid date.')
    }

    if (expiresAt.getTime() <= Date.now()) {
        throw new Error('Invite expiry must be in the future.')
    }

    return expiresAt.toISOString()
}

function normalizeInviteRequestId(value: unknown) {
    const requestId = cleanText(value)
    if (!requestId) return undefined
    return requestId.slice(0, 120)
}

export function normalizeWatchlistRequestId(value: unknown) {
    const requestId = cleanText(value)
    if (!requestId) return undefined
    return requestId.slice(0, 120)
}

function normalizeWatchlistValue(kind: WatchlistKind, value: unknown) {
    const cleaned = cleanText(value)
    if (kind === 'domain') {
        return cleaned.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split('/')[0]
    }

    if (kind === 'actor' || kind === 'keyword') {
        return cleaned.toLowerCase()
    }

    return cleaned
}

function normalizeWatchlistReason(value: unknown) {
    const reason = cleanText(value)
    return reason ? reason.slice(0, 1000) : undefined
}

function normalizeWatchlistStatus(row: Pick<OrganizationWatchlistRow, 'status' | 'archived_at'>): OrganizationWatchlistStatus {
    if (row.archived_at) return 'archived'
    if (row.status === 'paused' || row.status === 'archived') return row.status
    return 'active'
}

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function looksSensitive(value: string) {
    return emailPattern.test(value)
        || /^https?:\/\//i.test(value)
        || /(token|secret|password|bearer)\s*[:=]/i.test(value)
}

function slugFor(value: string) {
    const slug = value.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)

    return slug || 'organization'
}
