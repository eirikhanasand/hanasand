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
export type OrganizationSharedWatchlistAuditEventAction =
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
    | 'organization_watchlist_alert_terms_export_denied'
    | 'organization_lifecycle_mutation_blocked'
export type OrganizationSharedWatchlistAuditRouteGroup =
    | 'invite_lifecycle'
    | 'watchlist_write'
    | 'watchlist_lifecycle'
    | 'alert_terms_export'
    | 'lifecycle_blocker'
export type OrganizationSharedWatchlistAuditConsumer =
    | 'alert_queue'
    | 'case_workflow'
    | 'webhook_delivery'
    | 'support_timeline'
    | 'dashboard_readiness'
export type OrganizationSharedWatchlistMonitoringWorkflowStep =
    | 'watchlist_export'
    | 'alert_upsert'
    | 'alert_queue_visibility'
    | 'case_link'
    | 'webhook_delivery'
    | 'audit_timeline'
export type OrganizationSharedWatchlistAnalystPortalAction =
    | 'review_alert'
    | 'acknowledge_alert'
    | 'assign_case'
    | 'link_case'
    | 'replay_alert'
    | 'deliver_webhook'
    | 'open_audit_timeline'
export type OrganizationSharedWatchlistProvenanceSourceFamily =
    | 'organization_watchlist'
    | 'darkweb_metadata'
    | 'telegram_public'
    | 'rss_news'
    | 'public_ti'

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
    enabled: boolean
    disabledReason: 'watchlist_paused' | 'watchlist_archived' | null
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
    enabled: true
    disabledReason: null
    lifecycle: {
        status: 'active'
        enabled: true
        disabledReason: null
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
        memberRemovalRevokesPendingInvites: true
        memberRemovalCleanupSchema: 'organization.member_removal_cleanup.v1'
        memberRemovalCleanupField: 'memberRemovalCleanup.revokedInviteIds'
        staleInviteAcceptanceBlocker: 'member_revoked'
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
        eventActions: OrganizationSharedWatchlistAuditEventAction[]
        requiredMetadataFields: string[]
        requestIdFields: string[]
        actorFields: string[]
        downstreamCorrelationFields: string[]
        idempotentActions: Array<'invite_resend' | 'invite_revoke' | 'watchlist_cleanup' | 'alert_terms_export'>
        proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist'
        eventBridge: {
            schemaVersion: 'organization.shared_watchlist_audit_event_bridge.v1'
            source: 'service_logs'
            expectedAdapter: 'organizationSharedWatchlistAuditEventBridge'
            requiredActions: OrganizationSharedWatchlistAuditEventAction[]
            eventDescriptors: Array<{
                action: OrganizationSharedWatchlistAuditEventAction
                routeGroup: OrganizationSharedWatchlistAuditRouteGroup
                outcome: 'success' | 'denied' | 'blocked'
                requestIdField: 'metadata.requestId'
                actorField: 'actor.userId'
                organizationField: 'organizationId'
                requiredMetadataFields: string[]
                redactedMetadataFields: Array<'metadata.value' | 'metadata.email' | 'activeTerms[].term' | 'alertBridge.alertGeneratorKeys'>
                downstreamConsumers: OrganizationSharedWatchlistAuditConsumer[]
                idempotent: boolean
            }>
            requiredSafeFields: Array<'action' | 'routeGroup' | 'outcome' | 'requestIdField' | 'actorField' | 'organizationField'>
            requiredRedactedFields: Array<'metadata.value' | 'metadata.email' | 'activeTerms[].term' | 'alertBridge.alertGeneratorKeys'>
            noRawTermAccess: true
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
            blockerCodes: Array<'missing_required_action' | 'missing_request_id' | 'missing_actor' | 'missing_redaction' | 'raw_term_access_enabled'>
        }
    }
    alertBridge: {
        route: 'organization_watchlist'
        canGenerateAlerts: boolean
        activeWatchlistItemIds: string[]
        alertGeneratorKeys: string[]
        alertGenerationRefField: 'activeTerms[].alertGenerationRef'
        dedupeScope: 'organization_watchlist_term'
        persistenceContract: {
            schemaVersion: 'organization.watchlist_alert_persistence_contract.v1'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            storageModule: 'ti/scraper/src/storage/dwmAlertRepository.ts'
            upsertFunction: 'upsertDwmAlert'
            requiredInputFields: string[]
            persistedAlertFields: string[]
            workflowContextFields: string[]
            watchlistScope: {
                watchlistItemIds: string[]
                alertGeneratorKeys: string[]
                alertGenerationRefField: 'workflowContext.alertGenerationRefs[]'
                watchlistItemIdField: 'watchlistItemIds[]'
            }
            dedupe: {
                scope: 'organization_watchlist_term'
                keyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
                crossTenantCollisionAllowed: false
            }
            lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'watchlist_paused' | 'watchlist_archived' | 'member_revoked' | 'nonmember_denied'>
            visibilityDecisionField: 'workflowContext.visibilityDecision'
            casePathField: 'casePath'
            blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
        }
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
        caseWorkflowContract: {
            schemaVersion: 'organization.watchlist_case_workflow_contract.v1'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            routes: {
                open: 'POST /v1/cases'
                list: 'GET /v1/cases'
                detail: 'GET /v1/cases/:id'
                update: 'PATCH /v1/cases/:id'
            }
            requiredQueryFields: Array<'organizationId'>
            casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
            watchlistScope: {
                watchlistItemIds: string[]
                alertGeneratorKeys: string[]
                evidenceRefField: 'case.evidence.watchlistItemIds[]'
            }
            actorActions: {
                canReadCases: boolean
                canOpenCase: boolean
                canAssignCase: boolean
                canLinkCase: boolean
                canCloseCase: boolean
                allowedActions: OrganizationAlertCaseAction[]
                denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | null
            }
            requiredCaseFields: string[]
            timelineEventTypes: Array<'case.opened' | 'case.linked_alert' | 'case.assigned' | 'case.status_changed' | 'case.note_added'>
            evidenceFields: string[]
            redactedFields: string[]
            blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
        }
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
    monitoringWorkflow: {
        schemaVersion: 'organization.shared_watchlist_monitoring_workflow.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        persistenceLevel: 'organization_persisted'
        expectedAdapter: 'organizationSharedWatchlistMonitoringWorkflow'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
        entrypoint: {
            route: 'GET /api/organizations/:id/watchlists/alert-terms'
            requiredQueryFields: Array<'organizationId' | 'requestId'>
            responseField: 'alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow'
        }
        steps: Array<{
            id: OrganizationSharedWatchlistMonitoringWorkflowStep
            ownerLane: 'org_watchlist' | 'dwm_alert_workflow' | 'case_workflow' | 'webhook_delivery' | 'support_audit'
            route: string
            storageModule: string
            requiredPayloadFields: string[]
            requiredAuditActions: OrganizationSharedWatchlistAuditEventAction[]
            allowedRoles: OrganizationAlertCaseRole[]
            state: 'ready' | 'blocked'
            blockerCodes: string[]
            redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'destination.secret' | 'case.evidence.rawContent' | 'member.userId'>
        }>
        operatorActions: {
            acknowledgeAlert: boolean
            assignCase: boolean
            linkCase: boolean
            replayAlert: boolean
            deliverWebhook: boolean
        }
        evidenceContract: {
            requiredFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'casePath' | 'audit.eventBridge' | 'visibilityDecision'>
            redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'destination.secret' | 'case.evidence.rawContent'>
            containsRawTerms: false
        }
        blockerCodes: string[]
    }
    analystPortalWorkflow: {
        schemaVersion: 'organization.shared_watchlist_analyst_portal_workflow.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        expectedAdapter: 'organizationSharedWatchlistAnalystPortalWorkflow'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
        queueContract: {
            route: 'GET /v1/dwm/alerts'
            requiredQueryFields: Array<'organizationId'>
            storageModule: 'ti/scraper/src/storage/dwmAlertRepository.ts'
            itemFields: Array<'alertId' | 'organizationId' | 'watchlistItemIds' | 'severity' | 'status' | 'casePath' | 'updatedAt' | 'allowedActions'>
            state: 'ready' | 'blocked'
            blockerCodes: string[]
        }
        detailContract: {
            route: 'GET /v1/dwm/alerts/:id'
            evidenceFields: Array<'capturedAt' | 'source' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'casePath' | 'workflowEvents' | 'audit.eventBridge'>
            redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'case.evidence.rawContent' | 'destination.secret'>
            containsRawTerms: false
        }
        actionContracts: Array<{
            action: OrganizationSharedWatchlistAnalystPortalAction
            route: string
            method: 'GET' | 'POST' | 'PATCH'
            requiredRoles: OrganizationAlertCaseRole[]
            allowed: boolean
            requiredPayloadFields: string[]
            auditEventActions: OrganizationSharedWatchlistAuditEventAction[]
            blockerCodes: string[]
        }>
        timelineContract: {
            route: 'GET /api/admin/support/audit'
            source: 'service_logs'
            requiredEventBridge: 'organization.shared_watchlist_audit_event_bridge.v1'
            eventActions: OrganizationSharedWatchlistAuditEventAction[]
            redactedFields: Array<'metadata.value' | 'metadata.email' | 'activeTerms[].term' | 'alertBridge.alertGeneratorKeys'>
        }
        roleGate: {
            actorRole: OrganizationRole
            readAlertsAllowed: boolean
            mutateAllowed: boolean
            caseActionsAllowed: boolean
            webhookDeliveryAllowed: boolean
        }
        blockerCodes: string[]
    }
    enrichmentProvenance: {
        schemaVersion: 'organization.shared_watchlist_enrichment_provenance.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        expectedAdapter: 'organizationSharedWatchlistEnrichmentProvenance'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
        sourceCoverage: {
            requiredFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
            activeFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
            optionalFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
            sourceHealthRoute: 'GET /v1/dwm/sources/health'
            state: 'ready' | 'needs_source_coverage'
            blockerCodes: Array<'source_coverage_required' | 'capture_provenance_missing'>
        }
        sourceHealth: {
            schemaVersion: 'organization.shared_watchlist_source_coverage_health.v1'
            expectedAdapter: 'organizationSharedWatchlistSourceCoverageHealth'
            route: 'GET /v1/dwm/sources/health'
            ownerLane: 'source_operations'
            state: 'ready' | 'needs_source_coverage'
            rows: Array<{
                sourceFamily: OrganizationSharedWatchlistProvenanceSourceFamily
                required: boolean
                active: boolean
                status: 'covered' | 'optional' | 'missing'
                requiredEvidenceFields: Array<'sourceFamily' | 'captureIds' | 'sourceIds' | 'capturedAt' | 'contentHash'>
                blockerCodes: Array<'source_coverage_required' | 'capture_provenance_missing'>
            }>
            redaction: {
                containsRawContent: false
                safeFields: Array<'sourceFamily' | 'active' | 'status' | 'captureIds' | 'sourceIds' | 'contentHash'>
                redactedFields: Array<'rawContent' | 'activeTerms[].term' | 'destination.secret'>
            }
            blockerCodes: Array<'source_coverage_required' | 'capture_provenance_missing'>
        }
        provenanceFields: {
            alert: Array<'provenance.captureIds' | 'provenance.sourceIds' | 'provenance.generatedAt' | 'provenance.matchBasis' | 'sourceFamily'>
            workflowContext: Array<'captureIds' | 'selectedCaptureIds' | 'sourceFamily' | 'alertGeneratorKeys' | 'watchlistTermContexts'>
            caseEvidence: Array<'evidence.provenance.captureIds' | 'evidence.provenance.sourceIds' | 'evidence.provenance.matchBasis' | 'watchlistItemIds'>
            webhookPayload: Array<'captureIds' | 'sourceFamily' | 'casePath' | 'watchlistItemIds' | 'auditEventContracts'>
        }
        propagation: {
            alertRepository: 'ti/scraper/src/storage/dwmAlertRepository.ts'
            caseRoute: 'ti/scraper/src/api/caseRoutes.ts'
            webhookRoute: 'ti/scraper/src/api/dwmWorkflowRoutes.ts'
            requiredCorrelationFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'captureIds' | 'sourceIds' | 'casePath'>
        }
        redaction: {
            containsRawContent: false
            safeFields: Array<'organizationId' | 'tenantId' | 'sourceFamily' | 'captureIds' | 'sourceIds' | 'watchlistItemIds' | 'casePath'>
            redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'evidence.rawContent' | 'destination.secret'>
        }
        watchlistScope: {
            watchlistItemIds: string[]
            alertGeneratorKeys: string[]
            crossTenantCollisionAllowed: false
        }
        blockerCodes: Array<'source_coverage_required' | 'capture_provenance_missing'>
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

export type OrganizationSharedWatchlistIntegrationGuardrailCode =
    | 'schema_mismatch'
    | 'org_scope_mismatch'
    | 'watchlist_scope_mismatch'
    | 'alert_contract_missing'
    | 'case_contract_missing'
    | 'webhook_contract_missing'
    | 'payload_shape_missing'
    | 'nonmember_enumeration_enabled'
    | 'raw_terms_enabled'
    | 'redaction_missing'
    | 'denial_guardrail_missing'
    | 'webhook_guardrail_missing'
    | 'case_guardrail_missing'
    | 'route_missing'

export type OrganizationSharedWatchlistIntegrationGuardrails = {
    schemaVersion: 'organization.shared_watchlist_integration_guardrails.v1'
    organizationId: string
    tenantId: string
    ok: boolean
    checkedContracts: Array<
        | 'organization.shared_watchlist_downstream_proof.v1'
        | 'organization.watchlist_alert_persistence_contract.v1'
        | 'organization.watchlist_alert_visibility_contract.v1'
        | 'organization.watchlist_case_workflow_contract.v1'
        | 'organization.watchlist_webhook_delivery_contract.v1'
        | 'organization.shared_watchlist_audit_contract.v1'
    >
    requiredPayloadShape: string[]
    downstreamRoutes: {
        alertList: 'GET /v1/dwm/alerts'
        alertReplay: 'POST /v1/dwm/alerts/:id/replay'
        caseOpen: 'POST /v1/cases'
        webhookDeliver: 'POST /v1/dwm/webhooks/deliver'
    }
    orgScope: {
        ownerOrganizationId: string
        watchlistItemIds: string[]
        alertGeneratorKeys: string[]
        alertContractOrgId: string
        caseContractOrgId: string
        webhookContractOrgId: string
    }
    safety: {
        nonmemberEnumeration: false
        containsRawTerms: false
        redactedFields: string[]
    }
    denialSafety: {
        schemaVersion: 'organization.shared_watchlist_alert_denial_guardrails.v1'
        ok: boolean
        requiredNoLeakFields: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['requiredNoLeakFields']
        requiredResponseFields: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['requiredResponseFields']
        requiredAuditEvent: 'organization_watchlist_alert_visibility_denied'
        blockerCodes: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['blockerCodes']
    }
    webhookSafety: {
        schemaVersion: 'organization.shared_watchlist_webhook_delivery_guardrails.v1'
        ok: boolean
        requiredIdempotencyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
        requiredEvidenceFields: Array<'deliveryId' | 'destinationId' | 'attemptedAt' | 'status' | 'casePath' | 'watchlistItemIds' | 'auditEventContracts'>
        requiredRedactedFields: Array<'destination.endpoint' | 'destination.secret' | 'activeTerms[].term'>
        destinationEnumerationAllowed: false
        requiredDestinationOrgId: string
        blockerCodes: Array<'webhook_idempotency_missing' | 'webhook_evidence_missing' | 'webhook_redaction_missing' | 'webhook_org_scope_missing' | 'webhook_destination_enumeration_enabled'>
    }
    caseSafety: {
        schemaVersion: 'organization.shared_watchlist_case_workflow_guardrails.v1'
        ok: boolean
        requiredCaseFields: Array<'organizationId' | 'tenantId' | 'alertId' | 'casePath' | 'watchlistItemIds' | 'allowedActions' | 'visibilityDecision' | 'evidence.provenance'>
        requiredTimelineEvents: Array<'case.opened' | 'case.linked_alert' | 'case.assigned' | 'case.status_changed' | 'case.note_added'>
        requiredEvidenceFields: Array<'alertId' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'matchedTerms' | 'source' | 'capturedAt' | 'casePath'>
        requiredRedactedFields: Array<'activeTerms[].term' | 'case.evidence.rawContent'>
        casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        actorCanOpenCase: boolean
        actorCanAssignCase: boolean
        blockerCodes: Array<'case_org_scope_missing' | 'case_path_missing' | 'case_fields_missing' | 'case_timeline_missing' | 'case_evidence_missing' | 'case_redaction_missing' | 'case_role_gate_missing'>
    }
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    blockerCodes: OrganizationSharedWatchlistIntegrationGuardrailCode[]
}

export type OrganizationSharedWatchlistSupportInspection = {
    schemaVersion: 'organization.shared_watchlist_support_inspection.v1'
    organizationId: string
    tenantId: string
    supportMode: 'redacted_summary_only'
    route: 'GET /api/admin/support/organizations/:id'
    supportActionContract: 'admin_support'
    redactionRequired: true
    canInspectRawTerms: false
    containsRawTerms: false
    summary: {
        activeTermCount: number
        pausedCount: number
        archivedCount: number
        termFamilies: WatchlistKind[]
        visibilityPolicy: OrganizationAlertVisibilityPolicy
        allowedViewerRoles: OrganizationRole[]
        cleanupRequired: boolean
    }
    safeFields: string[]
    redactedFields: string[]
    auditFields: string[]
    downstreamCorrelationFields: string[]
    blockerCodes: Array<'support_redaction_required' | 'support_only_access'>
    guardrails: {
        schemaVersion: 'organization.shared_watchlist_support_guardrails.v1'
        ok: boolean
        requiredSafeFields: Array<'activeTermCount' | 'termFamilies' | 'visibilityPolicy' | 'allowedViewerRoles'>
        requiredRedactedFields: Array<'activeTerms[].term' | 'member.userId' | 'sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys'>
        requiredAuditFields: Array<'requestId' | 'actor.role'>
        rawTermAccessAllowed: false
        blockerCodes: Array<'support_safe_fields_missing' | 'support_redaction_missing' | 'support_audit_missing' | 'support_raw_access_enabled'>
    }
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}

export type OrganizationSharedWatchlistAlertQueueVisibility = {
    schemaVersion: 'organization.shared_watchlist_alert_queue_visibility.v1'
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
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    visibility: {
        policy: OrganizationAlertVisibilityPolicy
        allowed: boolean
        denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | null
        allowedRoles: OrganizationRole[]
        nonmemberEnumeration: false
    }
    denialResponseContract: {
        appliesWhen: 'visibility.allowed_false'
        blocked: boolean
        statusCode: 403
        errorCode: 'org_alert_visibility_denied'
        reason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | null
        responseShape: string[]
        safeFields: string[]
        noLeakFields: string[]
        auditEventAction: 'organization_watchlist_alert_visibility_denied'
    }
    denialGuardrails: {
        schemaVersion: 'organization.shared_watchlist_alert_denial_guardrails.v1'
        ok: boolean
        checkedFields: string[]
        requiredNoLeakFields: Array<'activeTerms' | 'watchlistScope.alertGeneratorKeys' | 'persistedAlertContract' | 'member.userId'>
        requiredResponseFields: Array<'error' | 'message' | 'organizationId' | 'visibilityDecision' | 'allowedRoles' | 'requestId'>
        requiredAuditEvent: 'organization_watchlist_alert_visibility_denied'
        blockerCodes: Array<'denial_status_missing' | 'denial_shape_missing' | 'denial_no_leak_missing' | 'denial_audit_missing'>
    }
    allowedActions: OrganizationAlertCaseAction[]
    actionGates: OrganizationSharedWatchlistDownstreamProof['alertBridge']['queueVisibilityContract']['actionGates']
    roleActionMatrix: {
        schemaVersion: 'organization.shared_watchlist_alert_role_matrix.v1'
        actorRole: OrganizationRole
        allowedActions: OrganizationAlertCaseAction[]
        roleGates: Record<OrganizationAlertCaseAction, OrganizationAlertCaseRole[]>
        allowedActionsByRole: Record<OrganizationAlertCaseRole, OrganizationAlertCaseAction[]>
        downstreamConsumers: Array<'alert_queue' | 'case_workflow' | 'webhook_delivery' | 'support_redacted_read'>
        deniedRoles: Array<'viewer' | 'support' | 'nonmember'>
        denialReason: 'role_not_allowed'
    }
    watchlistScope: {
        ownerOrganizationId: string
        watchlistItemIds: string[]
        alertGeneratorKeys: string[]
        alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]'
        visibilityDecisionField: 'workflowContext.visibilityDecision'
        dedupeScope: 'organization_watchlist_term'
        crossTenantCollisionAllowed: false
    }
    tenantIsolation: {
        schemaVersion: 'organization.shared_watchlist_alert_tenant_isolation.v1'
        partitionKey: 'organizationId'
        tenantIdField: 'tenantId'
        requiredAlertFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'workflowContext.organizationId' | 'workflowContext.alertGeneratorKeys' | 'dedupeKey'>
        dedupeKeyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
        watchlistItemScope: 'organization_owned'
        crossTenantCollisionAllowed: false
        nonmemberEnumeration: false
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'watchlist_paused' | 'watchlist_archived' | 'member_revoked' | 'nonmember_denied'>
        proofAssertions: Array<'two_org_overlapping_terms' | 'distinct_alert_generator_keys' | 'org_scoped_watchlist_ids' | 'visibility_query_requires_organization_id'>
    }
    lifecycleExclusions: {
        excludedStatuses: Array<'paused' | 'archived'>
        pausedWatchlistIds: string[]
        archivedWatchlistIds: string[]
        blockerCodes: Array<'watchlist_paused' | 'watchlist_archived'>
    }
    persistedAlertContract: {
        storageModule: 'ti/scraper/src/storage/dwmAlertRepository.ts'
        requiredFields: string[]
        workflowContextFields: string[]
        persistedAlertFields: string[]
        casePathField: 'casePath'
    }
    consumerContract: {
        ownerLane: 'dwm_alert_workflow'
        expectedAdapter: 'organizationSharedWatchlistAlertQueueVisibility'
        payloadShape: string[]
        requiredRouteBinding: 'organizationId_query_and_workflow_context'
        requiredStorageBinding: 'workflowContext.organizationId'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    auditContract: {
        source: 'service_logs'
        requiredEventActions: string[]
        requiredMetadataFields: string[]
        requestIdFields: string[]
        downstreamCorrelationFields: string[]
        proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist'
    }
    support: {
        mode: 'redacted_summary_only'
        redactionRequired: true
        supportOnlyBlocker: 'support_only_access'
    }
    safeFields: string[]
    redactedFields: string[]
    blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
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
    sharedWatchlistIntegrationGuardrails: OrganizationSharedWatchlistIntegrationGuardrails
    sharedWatchlistSupportInspection: OrganizationSharedWatchlistSupportInspection
    sharedWatchlistAlertQueueVisibility: OrganizationSharedWatchlistAlertQueueVisibility
    webhookDestinationOwnership: OrganizationWebhookDestinationOwnershipContract
    webhookDestinationAccessDecision: OrganizationWebhookDestinationAccessDecision
    consumerReadiness: OrganizationSharedWatchlistConsumerReadiness
    alertGenerationConsumer: {
        schemaVersion: 'organization.watchlist_alert_generation_consumer.v1'
        organizationId: string
        tenantId: string
        repositoryAdapter: 'organizationWatchlistAlertTermsExport'
        sourceFamily: 'organization_watchlist'
        route: 'GET /api/organizations/:id/watchlists/alert-terms'
        requiredQueryFields: Array<'organizationId'>
        requiredPersistedFields: Array<'organizationId' | 'tenantId' | 'watchlistItemId' | 'watchlistItemIds' | 'workflowContext.organizationId' | 'workflowContext.alertGeneratorKeys' | 'workflowContext.visibilityDecision'>
        activeTerms: Array<{
            organizationId: string
            tenantId: string
            watchlistItemId: string
            itemId: string
            termFamily: WatchlistKind
            category: WatchlistKind
            term: string
            normalizedTerm: string
            status: 'active'
            alertGeneratorKey: string
            alertGenerationRef: OrganizationWatchlistAlertGenerationRef
        }>
        lifecycleExclusions: OrganizationWatchlistAlertTermsExport['termLifecycle']
        scopeGuardrails: {
            partitionKey: 'organizationId'
            tenantIdField: 'tenantId'
            watchlistScope: 'organization_owned'
            crossOrgReadAllowed: false
            userLocalFallbackAllowed: false
            nonmemberEnumeration: false
        }
        roleGates: {
            exportTerms: OrganizationRole[]
            mutateWatchlists: Array<'owner' | 'admin'>
            readSharedWatchlists: OrganizationRole[]
        }
        denialContract: {
            nonmember: 'organization.access_denial.v1'
            roleDenied: 'organization.watchlist_alert_terms_export_denial.v1'
            removedMember: 'member_revoked'
            noLeakFields: Array<'activeTerms[]' | 'activeWatchlistTerms[]' | 'watchlistScope.alertGeneratorKeys' | 'otherOrg.watchlistItemIds'>
        }
        matchingInputReceipt: {
            schemaVersion: 'organization.watchlist_alert_matching_input.v1'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            matchingRoute: 'organization_watchlist'
            termCount: number
            requiredMatcherFields: Array<'organizationId' | 'tenantId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm' | 'alertGeneratorKey' | 'alertGenerationRef'>
            dedupeKeyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
            terms: Array<{
                organizationId: string
                tenantId: string
                watchlistItemId: string
                termFamily: WatchlistKind
                normalizedTerm: string
                alertGeneratorKey: string
                status: 'active'
                alertGenerationRef: OrganizationWatchlistAlertGenerationRef
            }>
            lifecycleExclusions: {
                pausedItemIds: string[]
                archivedItemIds: string[]
                deletedTermIds: string[]
                excludedStatuses: Array<'paused' | 'archived'>
            }
            scopeGuardrails: {
                partitionKey: 'organizationId'
                crossOrgReadAllowed: false
                userLocalFallbackAllowed: false
                nonmemberEnumeration: false
            }
            noLeakFields: Array<'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'destination.secret'>
        }
        canGenerateAlerts: boolean
        blockerCodes: string[]
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    termExportDeltaReceipt: {
        schemaVersion: 'organization.watchlist_term_export_delta_receipt.v1'
        organizationId: string
        tenantId: string
        actor: {
            userId: string
            role: OrganizationRole
            status: 'active'
        }
        route: 'GET /api/organizations/:id/watchlists/alert-terms'
        activeTermCount: number
        exportedWatchlistItemIds: string[]
        exportedAlertGeneratorKeys: string[]
        excludedTermCount: number
        excludedWatchlistItemIds: string[]
        excludedReasons: Array<'watchlist_paused' | 'watchlist_archived'>
        lifecycle: {
            activeItemIds: string[]
            pausedItemIds: string[]
            archivedItemIds: string[]
            deletedTermIds: string[]
        }
        downstreamRefs: {
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1'
            alertPersistenceContract: 'organization.watchlist_alert_persistence_contract.v1'
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1'
            webhookOwnership: 'organization.shared_watchlist_webhook_ownership_hint.v1'
        }
        roleGates: {
            exportTerms: OrganizationRole[]
            mutateWatchlists: Array<'owner' | 'admin'>
            readSharedWatchlists: OrganizationRole[]
        }
        blockerCodes: string[]
        stableDedupeFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
        nonmemberEnumeration: false
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    alertCasePersistenceReceipt: {
        schemaVersion: 'organization.alert_case_bridge_persistence_receipt.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        alertPersistenceContract: 'organization.watchlist_alert_persistence_contract.v1'
        caseWorkflowContract: 'organization.watchlist_case_workflow_contract.v1'
        storageModule: 'ti/scraper/src/storage/dwmAlertRepository.ts'
        alertUpsertFunction: 'upsertDwmAlert'
        alertRoute: 'organization_watchlist'
        caseRoute: 'POST /v1/cases'
        casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        watchlistScope: {
            watchlistItemIds: string[]
            alertGeneratorKeys: string[]
            crossTenantCollisionAllowed: false
        }
        requiredAlertFields: string[]
        requiredCaseFields: string[]
        workflowContextFields: string[]
        dedupe: {
            scope: 'organization_watchlist_term'
            keyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
            crossTenantCollisionAllowed: false
        }
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'watchlist_paused' | 'watchlist_archived' | 'member_revoked' | 'nonmember_denied'>
        actorActions: OrganizationAlertCaseAction[]
        blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
        noEnumeration: false
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    readinessExport: {
        schemaVersion: 'organization.shared_watchlist_readiness_export.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        actor: {
            userId: string
            role: OrganizationRole
            status: 'active'
        }
        routes: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
            alertQueue: 'GET /v1/dwm/alerts'
            caseVisibility: 'GET /api/organizations/:id/alert-case-visibility'
            caseOpen: 'POST /v1/cases'
            webhookDeliver: 'POST /v1/dwm/webhooks/deliver'
            dashboardReadiness: 'GET /api/organizations/:id/alert-readiness'
        }
        readiness: {
            alertExportReady: boolean
            alertQueueReady: boolean
            casePersistenceReady: boolean
            caseVisibilityReady: boolean
            webhookDestinationReady: boolean
            supportRedactedReadReady: boolean
            dashboardReadinessReady: boolean
        }
        watchlistScope: {
            activeItemIds: string[]
            pausedItemIds: string[]
            archivedItemIds: string[]
            alertGeneratorKeys: string[]
            crossTenantCollisionAllowed: false
        }
        downstreamRefs: {
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1'
            alertPersistenceReceipt: 'organization.alert_case_bridge_persistence_receipt.v1'
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1'
            webhookDestinationOwnership: 'organization.webhook_destination_ownership.v1'
            webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1'
            termExportDeltaReceipt: 'organization.watchlist_term_export_delta_receipt.v1'
        }
        roleGates: {
            exportTerms: OrganizationRole[]
            mutateWatchlists: Array<'owner' | 'admin'>
            manualWebhookTrigger: Array<'owner' | 'admin'>
            assignCase: OrganizationAlertCaseRole[]
        }
        lifecycleAccess: {
            activeMembershipRequired: true
            removedMemberBlocker: 'member_revoked'
            revokedInviteBlocker: 'member_revoked'
            expiredInviteBlocker: 'invite_expired'
            pausedWatchlistBlocker: 'watchlist_paused'
            archivedWatchlistBlocker: 'watchlist_archived'
            nonmemberEnumeration: false
        }
        alertGenerationFixture: {
            schemaVersion: 'organization.watchlist_alert_generation_fixture.v1'
            route: 'organization_watchlist'
            matchingInputSchema: 'organization.watchlist_alert_matching_input.v1'
            activeTermCount: number
            watchlistItemIds: string[]
            alertGeneratorKeys: string[]
            expectedAlertFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'workflowContext.alertGenerationRefs' | 'workflowContext.alertGeneratorKeys' | 'workflowContext.visibilityDecision' | 'casePath'>
            expectedCaseFields: Array<'organizationId' | 'tenantId' | 'alertId' | 'casePath' | 'watchlistItemIds'>
            replaySteps: Array<'export_alert_terms' | 'match_capture_fixture' | 'persist_org_alert' | 'verify_case_visibility' | 'archive_cleanup'>
            lifecycleBlockers: Array<'member_revoked' | 'invite_expired' | 'watchlist_paused' | 'watchlist_archived' | 'org_archived' | 'org_deleted'>
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup'
            crossOrgDedupeAllowed: false
            nonmemberEnumeration: false
        }
        blockers: string[]
        noLeakFields: Array<'activeTerms[].term' | 'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'destination.secret' | 'case.evidence.rawContent'>
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    activeTerms: Array<OrganizationWatchlistTerm & {
        source: 'organization_shared_watchlist'
        alertGeneratorKey: string
        alertGenerationRef: OrganizationWatchlistAlertGenerationRef
        ownerContext: {
            schemaVersion: 'organization.watchlist_term_owner_context.v1'
            organizationId: string
            tenantId: string
            ownerOrganizationId: string
            watchlistItemId: string
            itemId: string
            createdBy: string
            updatedBy: string | null
            visibilityPolicy: OrganizationAlertVisibilityPolicy
            allowedViewerRoles: OrganizationRole[]
            webhookDestinationOrgField: 'destination.org_id'
            alertGeneratorKey: string
        }
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
    termLifecycle: {
        schemaVersion: 'organization.watchlist_term_lifecycle.v1'
        organizationId: string
        tenantId: string
        activeItemIds: string[]
        pausedItemIds: string[]
        archivedItemIds: string[]
        deletedTermIds: string[]
        deletedTermCount: number
        deletedTermSource: 'DELETE /api/organizations/:organizationId/watchlists/:itemId'
        cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup'
        alertMatchingEligibleStatuses: Array<'active'>
        exportExcludesDeletedTerms: true
        excludedFromAlertMatching: Array<{
            watchlistItemId: string
            itemId: string
            status: 'paused' | 'archived'
            blockerCode: 'watchlist_paused' | 'watchlist_archived'
            deletedByArchive: boolean
            archivedAt: string | null
            lifecycleReason: string | null
            lifecycleRequestId: string | null
        }>
        downstreamRefs: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
            alertReadiness: 'GET /api/organizations/:id/alert-readiness'
            webhookDestinationOrgField: 'destination.org_id'
            casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        }
    }
    blockedReasons: string[]
    canGenerateAlerts: boolean
}

export type OrganizationWatchlistAlertTermsExportDenial = {
    schemaVersion: 'organization.watchlist_alert_terms_export_denial.v1'
    organizationId: string
    tenantId: string
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    visibility: OrganizationVisibilityDecision
    allowedActions: OrganizationAlertCaseAction[]
    routes: {
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
        alertReadiness: 'GET /api/organizations/:id/alert-readiness'
        listWatchlists: 'GET /api/organizations/:id/watchlists'
    }
    safeFields: string[]
    redactedFields: Array<'activeTerms[]' | 'activeWatchlistTerms[]' | 'alertGeneratorKeys[]' | 'watchlistScope.alertGeneratorKeys'>
    blockerCodes: Array<OrganizationVisibilityDenyReason | 'alert_export_unavailable'>
    nonmemberEnumeration: false
    alertGenerationConsumerDenial: {
        schemaVersion: 'organization.watchlist_alert_generation_consumer_denial.v1'
        organizationId: string
        tenantId: string
        repositoryAdapter: 'organizationWatchlistAlertTermsExport'
        route: 'GET /api/organizations/:id/watchlists/alert-terms'
        member: {
            role: OrganizationRole
            status: 'active'
        }
        canReadSharedWatchlists: true
        canExportAlertTerms: false
        canMutateWatchlists: boolean
        allowedExportRoles: OrganizationRole[]
        readSharedWatchlistRoles: OrganizationRole[]
        mutateWatchlistRoles: Array<'owner' | 'admin'>
        denialReason: OrganizationVisibilityDenyReason | 'alert_export_unavailable'
        safeFields: Array<'organizationId' | 'tenantId' | 'member.role' | 'allowedExportRoles' | 'denialReason' | 'requestId'>
        noLeakFields: Array<'activeTerms[]' | 'activeWatchlistTerms[]' | 'alertGeneratorKeys[]' | 'watchlistScope.alertGeneratorKeys' | 'otherOrg.watchlistItemIds'>
        nonmemberEnumeration: false
        removedMemberDenied: 'member_revoked'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    auditProof: {
        schemaVersion: 'organization.watchlist_alert_terms_denial_audit.v1'
        serviceLogAction: 'organization_watchlist_alert_terms_export_denied'
        requestId: string | null
        requiredMetadataFields: Array<'requestId' | 'role' | 'alertVisibilityPolicy' | 'allowedRoles' | 'denialReason' | 'blockerCodes'>
        redactedFields: Array<'activeTerms[]' | 'activeWatchlistTerms[]' | 'alertGeneratorKeys[]' | 'watchlistScope.alertGeneratorKeys'>
        proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist_alert_terms_export_denied'
    }
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}

export type OrganizationWebhookDestinationOwnershipContract = {
    schemaVersion: 'organization.webhook_destination_ownership.v1'
    route: 'POST /v1/dwm/webhooks/deliver'
    eventType: 'dwm.alert'
    organizationId: string
    tenantId: string
    policy: OrganizationDefaultWebhookPolicy
    selectedDestinationSource: 'org_active_destinations' | 'manual_selection_required' | 'webhook_policy_disabled'
    requiredDestinationOrgId: string
    selectedDestinationOrgField: 'destination.org_id'
    selectedDestinationIdField: 'webhookDestinationIds[]'
    skippedDestinationReasons: Array<'org_mismatch' | 'destination_disabled' | 'event_not_subscribed' | 'manual_selection_required' | 'webhook_policy_disabled'>
    nonmemberDestinationEnumeration: false
    idempotency: {
        scope: 'organization_destination_alert'
        keyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
    }
    roleGates: {
        automaticDeliveryAllowed: boolean
        manualTriggerAllowed: boolean
        manualTriggerAllowedRoles: Array<'owner' | 'admin'>
        memberManualTriggerAllowed: false
        denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | 'manual_webhook_selection_required' | null
    }
    requiredAlertFields: string[]
    requiredDeliveryFields: string[]
    redactedFields: string[]
    blockerCodes: string[]
}

export type OrganizationWebhookDestinationAccessDecision = {
    schemaVersion: 'organization.webhook_destination_access_decision.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    route: 'POST /v1/dwm/webhooks/deliver'
    destinationScope: {
        requiredDestinationOrgId: string
        selectedDestinationOrgField: 'destination.org_id'
        selectedDestinationIdField: 'webhookDestinationIds[]'
        crossOrgDestinationAllowed: false
        nonmemberDestinationEnumeration: false
    }
    allowedActions: {
        automaticDelivery: boolean
        manualTrigger: boolean
        configureDestination: boolean
        readDeliverySummary: true
    }
    roleGates: {
        automaticDelivery: Array<'owner' | 'admin'>
        manualTrigger: Array<'owner' | 'admin'>
        configureDestination: Array<'owner' | 'admin'>
        readDeliverySummary: OrganizationRole[]
    }
    denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | 'manual_webhook_selection_required' | 'role_not_allowed' | null
    blockerCodes: string[]
    requiredAlertFields: string[]
    requiredDeliveryFields: string[]
    deliveryInputReceipt: {
        schemaVersion: 'organization.webhook_destination_delivery_input.v1'
        organizationId: string
        tenantId: string
        route: 'POST /v1/dwm/webhooks/deliver'
        eventType: 'dwm.alert'
        requiredAlertFields: Array<'alert.organizationId' | 'alert.tenantId' | 'alert.watchlistItemIds' | 'alert.workflowContext.alertGeneratorKeys' | 'alert.dedupeKey'>
        requiredDestinationFields: Array<'destination.id' | 'destination.org_id' | 'destination.enabled' | 'destination.eventSubscriptions'>
        selectedDestinationOrgField: 'destination.org_id'
        selectedDestinationIdField: 'webhookDestinationIds[]'
        idempotencyKeyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'member_revoked' | 'manual_webhook_selection_required'>
        crossOrgDestinationAllowed: false
        nonmemberDestinationEnumeration: false
        noLeakFields: Array<'destination.secret' | 'destination.endpoint' | 'otherOrg.destinationIds'>
    }
    proofAssertions: Array<
        | 'destination_org_matches_alert_org'
        | 'idempotency_scoped_to_org_destination_alert'
        | 'manual_trigger_owner_admin_only'
        | 'member_viewer_cannot_configure_destination'
        | 'nonmember_cannot_enumerate_destinations'
    >
    noLeakFields: Array<
        | 'destination.secret'
        | 'destination.endpoint'
        | 'otherOrg.destinationIds'
        | 'otherOrg.alertGeneratorKeys'
        | 'activeTerms[].term'
    >
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}

export type OrganizationSharedWatchlistConsumerReadiness = {
    schemaVersion: 'organization.shared_watchlist_consumer_readiness.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    routes: {
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
        alertList: 'GET /v1/dwm/alerts'
        alertReplay: 'POST /v1/dwm/alerts/:id/replay'
        caseList: 'GET /v1/cases'
        caseOpen: 'POST /v1/cases'
        webhookDeliver: 'POST /v1/dwm/webhooks/deliver'
        supportInspection: 'GET /api/admin/support/organizations/:id'
        dashboardReadiness: 'GET /api/organizations/:id/alert-readiness'
    }
    watchlists: {
        activeCount: number
        pausedCount: number
        archivedCount: number
        activeIds: string[]
        pausedIds: string[]
        archivedIds: string[]
        alertGeneratorKeys: string[]
        crossTenantCollisionAllowed: false
    }
    readiness: {
        alertQueueReady: boolean
        caseWorkflowReady: boolean
        webhookDeliveryReady: boolean
        supportRedactedReadReady: boolean
        dashboardReadinessReady: boolean
    }
    roleGates: {
        mutateWatchlists: Array<'owner' | 'admin'>
        exportTerms: OrganizationRole[]
        manualWebhookTrigger: Array<'owner' | 'admin'>
        assignCase: OrganizationAlertCaseRole[]
    }
    blockers: string[]
    noLeakFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'destination.secret' | 'case.evidence.rawContent'>
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}

export type OrganizationAnalystPortalVisibilityAdapter = {
    schemaVersion: 'organization.analyst_portal_visibility_adapter.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    routeBindings: {
        alertList: 'GET /v1/dwm/alerts?organizationId=:organizationId'
        alertDetail: 'GET /v1/dwm/alerts/:id'
        caseList: 'GET /v1/cases?organizationId=:organizationId'
        caseDetail: 'GET /v1/cases/:id'
        webhookDelivery: 'POST /v1/dwm/webhooks/deliver'
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
    }
    requiredIdentityFields: Array<'organizationId' | 'tenantId' | 'member.userId' | 'member.role' | 'watchlistItemIds[]' | 'workflowContext.visibilityDecision'>
    watchlistScope: {
        activeWatchlistItemIds: string[]
        alertGeneratorKeys: string[]
        itemIdField: 'watchlistItemIds[]'
        alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]'
        crossTenantCollisionAllowed: false
    }
    actionMatrix: Record<OrganizationSharedWatchlistAnalystPortalAction, {
        allowed: boolean
        allowedRoles: OrganizationAlertCaseRole[]
        denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | 'manual_webhook_selection_required' | null
        blockerCodes: string[]
    }>
    allowedActions: OrganizationSharedWatchlistAnalystPortalAction[]
    lifecycleBlockers: string[]
    consumerProof: {
        alertQueueAdapter: 'organizationSharedWatchlistAlertQueueVisibility'
        caseWorkflowAdapter: 'organization.watchlist_case_workflow_contract.v1'
        webhookGuardrailAdapter: 'organizationSharedWatchlistWebhookDeliveryGuardrails'
        auditAdapter: 'organizationSharedWatchlistAuditEventBridge'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    redaction: {
        safeFields: string[]
        redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'case.evidence.rawContent' | 'destination.secret' | 'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys'>
        nonmemberEnumeration: false
    }
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
        enabled: boolean
        disabledReason: 'watchlist_paused' | 'watchlist_archived' | null
        createdBy: string
        updatedBy: string | null
        terms: string[]
    }
    organization: OrganizationBridgeContext
    ownerContext: {
        schemaVersion: 'organization.alert_reference_owner_context.v1'
        organizationId: string
        tenantId: string
        ownerOrganizationId: string
        watchlistItemId: string
        watchlistId: string
        watchlistKind: WatchlistKind
        createdBy: string
        updatedBy: string | null
        visibilityPolicy: OrganizationAlertVisibilityPolicy
        allowedViewerRoles: OrganizationRole[]
        alertGeneratorKey: string
        webhookDestinationOrgField: 'destination.org_id'
        casePath: string
        crossTenantCollisionAllowed: false
    }
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
        alertOwnership: OrganizationDwmAlertReference['alertOwnership']
        workflowContext: {
            organizationId: string
            tenantId: string
            ownerOrganizationId: string
            watchlistItemIds: string[]
            alertGeneratorKeys: string[]
            ownerContext: OrganizationDwmAlertReference['ownerContext']
        }
    }
    alertOwnership: {
        schemaVersion: 'organization.alert_ownership.v1'
        organizationId: string
        tenantId: string
        ownerOrganizationId: string
        watchlistItemId: string
        watchlistId: string
        sourceFamily: 'organization_watchlist'
        route: 'organization_watchlist'
        dedupeKey: string
        casePath: string
        visibilityPolicy: OrganizationAlertVisibilityPolicy
        allowedViewerRoles: OrganizationRole[]
        requiredPersistedFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'workflowContext.organizationId' | 'workflowContext.alertGeneratorKeys' | 'workflowContext.visibilityDecision' | 'casePath'>
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'member_revoked' | 'watchlist_archived' | 'watchlist_paused'>
        noLeakFields: Array<'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'activeTerms[]' | 'destination.secret'>
        crossTenantCollisionAllowed: false
    }
    webhookContract: {
        schemaVersion: 'organization.alert_reference_webhook_contract.v1'
        orgId: string
        organizationId: string
        tenantId: string
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
        requiredDestinationOrgId: string
        selectedDestinationOrgField: 'destination.org_id'
        selectedDestinationIdField: 'webhookDestinationIds[]'
        ownerContext: OrganizationDwmAlertReference['ownerContext']
        noLeakFields: Array<'destination.secret' | 'otherOrg.destinationIds' | 'otherOrg.alertGeneratorKeys'>
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
    downstreamLifecycleReceipt: {
        schemaVersion: 'organization.lifecycle_downstream_receipt.v1'
        organizationId: string
        tenantId: string
        lifecycleStatus: OrganizationLifecycleStatus
        blockerCode: Extract<OrganizationLifecycleReadinessBlockerCode, 'org_archived' | 'org_deleted'> | null
        activeMembershipRequired: true
        inviteMutationAllowed: boolean
        watchlistMutationAllowed: boolean
        alertExportAllowed: boolean
        caseVisibilityAllowed: boolean
        webhookDeliveryAllowed: boolean
        supportRedactedReadAllowed: true
        blockedRoutes: string[]
        downstreamRefs: {
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1'
            alertGenerationFixture: 'organization.watchlist_alert_generation_fixture.v1'
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1'
            webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1'
        }
        noLeakFields: Array<'activeTerms[]' | 'watchlistScope.alertGeneratorKeys' | 'destination.secret' | 'case.evidence.rawContent'>
    }
    workspaceBoundaryProof: {
        schemaVersion: 'organization.workspace_boundary_readiness.v1'
        organizationId: string
        tenantId: string
        lifecycleStatus: OrganizationLifecycleStatus
        actorRole: OrganizationRole
        routes: {
            createOrganization: 'POST /api/organizations'
            readOrganization: 'GET /api/organizations/:id'
            readSettings: 'GET /api/organizations/:id/settings'
            updateSettings: 'PUT /api/organizations/:id/settings'
            listMembers: 'GET /api/organizations/:id/members'
            listInvites: 'GET /api/organizations/:id/invites'
            listWatchlists: 'GET /api/organizations/:id/watchlists'
            alertReadiness: 'GET /api/organizations/:id/alert-readiness'
        }
        roleGates: {
            readOrganization: Array<'owner' | 'admin' | 'member' | 'viewer'>
            updateSettings: Array<'owner' | 'admin'>
            archiveOrganization: Array<'owner' | 'admin'>
            deleteOrganization: Array<'owner' | 'admin'>
            manageInvites: Array<'owner' | 'admin'>
            mutateWatchlists: Array<'owner' | 'admin'>
            readSharedWatchlists: Array<'owner' | 'admin' | 'member' | 'viewer'>
        }
        actorPermissions: {
            canReadOrganization: true
            canUpdateSettings: boolean
            canArchiveOrganization: boolean
            canDeleteOrganization: boolean
            canManageInvites: boolean
            canMutateWatchlists: boolean
            canReadSharedWatchlists: true
            canReadAlertReadiness: true
        }
        supportInspection: {
            mode: 'redacted_summary_only'
            contract: 'admin_support'
            route: '/api/admin/support/organizations/:id'
        }
        lifecycleMutationAllowed: boolean
        blockedWhenInactive: Array<
            | 'PUT /api/organizations/:id/settings'
            | 'POST /api/organizations/:id/invites'
            | 'POST /api/organizations/:id/watchlists'
            | 'POST /api/organizations/:id/watchlists/:itemId/actions'
            | 'POST /api/organizations/:id/ownership-transfer'
        >
        blockerCode: Extract<OrganizationLifecycleReadinessBlockerCode, 'org_archived' | 'org_deleted'> | null
        nonmemberEnumeration: false
        noLeakFields: Array<'otherOrg.members' | 'otherOrg.invites' | 'otherOrg.watchlistItemIds' | 'destination.secret'>
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
    caseAssignmentProof: {
        schemaVersion: 'organization.case_assignment_readiness.v1'
        sourceContracts: Array<'organization.case_visibility_consumer.v1' | 'organization.alert_case_bridge_persistence_receipt.v1' | 'organization.shared_watchlist_alert_queue_visibility.v1'>
        route: 'POST /v1/cases/:caseId/assignment'
        organizationId: string
        tenantId: string
        actor: {
            role: OrganizationRole
            canAssignCase: boolean
            allowedActions: OrganizationAlertCaseAction[]
        }
        roleGates: {
            assignCase: Array<'owner' | 'admin' | 'analyst'>
            linkCase: Array<'owner' | 'admin' | 'analyst'>
            acknowledgeAlert: Array<'owner' | 'admin' | 'analyst' | 'member'>
            memberReadOnly: true
            viewerReadOnly: true
        }
        requiredCaseFields: Array<'organizationId' | 'tenantId' | 'caseId' | 'assigneeId' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'visibilityDecision' | 'assignmentAudit.requestId'>
        requiredAlertFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'workflowContext.alertGeneratorKeys' | 'workflowContext.allowedActions'>
        visibilityInputs: Array<'member.role' | 'member.status' | 'organization.lifecycleStatus' | 'watchlist.status' | 'alertVisibilityPolicy'>
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'member_revoked' | 'watchlist_paused' | 'watchlist_archived' | 'role_not_allowed'>
        blockerCodes: string[]
        nonmemberEnumeration: false
        crossOrgCaseAssignmentAllowed: false
        noLeakFields: Array<'otherOrg.caseIds' | 'otherOrg.alertGeneratorKeys' | 'case.evidence.rawContent'>
        proofAssertions: Array<'case_org_matches_alert_org' | 'assignee_membership_is_active' | 'member_cannot_assign_case' | 'nonmember_cannot_enumerate_cases'>
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
        webhookDestinationReadinessBridge: {
            schemaVersion: 'organization.webhook_destination_readiness_bridge.v1'
            deliveryContractSchema: 'dwm.webhook.org_alert_delivery.v1'
            sourceContract: 'organization.watchlist_webhook_delivery_contract.v1'
            route: 'POST /v1/dwm/webhooks/deliver'
            defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
            canUseDefaultDestinations: boolean
            selectedDestinationSource: 'org_active_destinations' | 'manual_selection_required' | 'webhook_policy_disabled'
            requiredDestinationOrgId: string
            selectedDestinationOrgField: 'destination.org_id'
            selectedDestinationIdField: 'webhookDestinationIds[]'
            ownerAdminManualTriggerRequired: true
            memberManualTriggerAllowed: false
            requiredAlertFields: string[]
            expectedDeliveryFields: string[]
            skippedDestinationReasons: Array<'org_mismatch' | 'destination_disabled' | 'event_not_subscribed' | 'manual_selection_required' | 'webhook_policy_disabled'>
            lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'watchlist_paused' | 'watchlist_archived' | 'member_revoked' | 'nonmember_denied'>
            blockerCodes: string[]
            nonmemberDestinationEnumeration: false
        }
    }
    destinationOwnershipProof: {
        schemaVersion: 'organization.webhook_destination_ownership_readiness.v1'
        sourceContracts: Array<'organization.webhook_destination_ownership.v1' | 'organization.webhook_destination_access_decision.v1' | 'organization.webhook_destination_readiness_bridge.v1'>
        route: 'POST /v1/dwm/webhooks/deliver'
        organizationId: string
        tenantId: string
        defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
        requiredDestinationOrgId: string
        requiredDestinationOrgField: 'destination.org_id'
        selectedDestinationIdField: 'webhookDestinationIds[]'
        selectedDestinationSource: 'org_active_destinations' | 'manual_selection_required' | 'webhook_policy_disabled'
        crossOrgDestinationAllowed: false
        nonmemberDestinationEnumeration: false
        ownerAdminConfigureAllowed: boolean
        memberConfigureAllowed: false
        manualTriggerAllowedRoles: Array<'owner' | 'admin'>
        automaticDeliveryAllowed: boolean
        supportInspection: {
            route: '/api/admin/support/organizations/:id'
            mode: 'redacted_destination_summary'
            requiredSupportContract: 'admin_support'
            endpointRedacted: true
            secretRedacted: true
        }
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'member_revoked' | 'manual_webhook_selection_required'>
        blockerCodes: string[]
        noLeakFields: Array<'destination.secret' | 'destination.endpoint' | 'otherOrg.destinationIds'>
        proofAssertions: Array<'destination_org_matches_alert_org' | 'nonmember_cannot_enumerate_destinations' | 'member_cannot_configure_destination' | 'support_reads_redacted_destination_summary'>
    }
    memberLifecycleProof: {
        schemaVersion: 'organization.member_lifecycle_visibility_proof.v1'
        activeMembershipRequired: true
        actorStatus: 'active'
        actorRole: OrganizationRole
        visibilityInputs: Array<'role' | 'status' | 'userActive' | 'alertVisibilityPolicy'>
        denialReasons: {
            nonmember: 'not_member'
            removedMember: 'member_removed'
            deactivatedMember: 'member_deactivated'
            expiredInvite: 'invite_expired'
            roleNotAllowed: 'role_not_allowed'
        }
        protectedRoutes: Array<
            | 'GET /api/organizations/:id'
            | 'GET /api/organizations/:id/watchlists'
            | 'GET /api/organizations/:id/alert-readiness'
            | 'GET /api/organizations/:id/watchlists/alert-terms'
            | 'GET /api/organizations/:id/alert-case-visibility'
            | 'POST|PUT|DELETE /api/organizations/:id/watchlists'
            | 'POST /v1/dwm/webhooks/deliver'
        >
        noLeakFields: Array<'activeTerms[]' | 'watchlistScope.alertGeneratorKeys' | 'member.userId' | 'destination.secret'>
        auditActions: Array<'organization_watchlist_alert_terms_export_denied' | 'organization_member_removed' | 'organization_invite_revoked'>
        memberRemovalCleanup: {
            responseSchema: 'organization.member_removal_cleanup.v1'
            revokesPendingInvites: true
            cleanupField: 'memberRemovalCleanup.revokedInviteIds'
            staleInviteAcceptanceBlocker: 'member_revoked'
            serviceLogAction: 'organization_member_removed'
        }
        memberAccessRecovery: {
            responseSchema: 'organization.member_consumer_access_recovery.v1'
            automaticRegrantAllowed: false
            blockerCode: 'member_revoked'
            ownerlessRecoveryMutationAllowed: false
            directMembershipMutationAllowed: false
            requiresOwnerAdminReview: true
            requiresAcceptedInvite: true
            recoveryActorRoles: Array<'owner' | 'admin'>
            recoveryReceipts: Array<'organization.invite_consumer_visibility_receipt.v1' | 'organization.member_role_consumer_visibility_receipt.v1'>
            recoveryRoutes: {
                createInvite: 'POST /api/organizations/:id/invites'
                acceptInvite: 'POST /api/organizations/invites/:inviteId/accept'
                memberList: 'GET /api/organizations/:id/members'
            }
            blockedUntilAcceptedMembership: Array<
                | 'GET /api/organizations/:id/watchlists'
                | 'GET /api/organizations/:id/watchlists/alert-terms'
                | 'GET /api/organizations/:id/alert-case-visibility'
                | 'GET /api/organizations/:id/alert-readiness'
            >
            supportActionHistoryBridge: {
                schemaVersion: 'organization.member_recovery_support_history_bridge.v1'
                source: 'support_audit_timeline'
                supportReceiptSchemas: Array<'support.access_recovery.execution_receipt.v1' | 'support.access_recovery.decision_receipt.v1' | 'support.action_execute.member_role_recovery.v1'>
                expectedSupportActions: Array<'support.organization.access_recovery' | 'support.organization.access_recovery.approve' | 'support.organization.access_recovery.deny' | 'support.organization.member_role_recovery'>
                replayFilters: {
                    organizationId: 'org'
                    targetUserId: 'target'
                    requestId: 'request'
                    action: 'action'
                }
                supportRoutes: {
                    inspect: '/api/admin/support/inspect'
                    accessRecovery: '/api/admin/support/access-recovery/:requestId'
                    organization: '/api/admin/support/organizations/:id'
                    memberRoleRecovery: '/api/admin/support/organizations/:id/members/:userId/role-recovery'
                }
                requiredAuditFields: Array<'organizationId' | 'targetUserId' | 'requestId' | 'supportSessionId' | 'reason' | 'outcome'>
                noSilentMembershipMutation: true
                nonmemberEnumeration: false
            }
            supportAssistedRecoveryReceipt: {
                schemaVersion: 'organization.member_support_assisted_recovery_receipt.v1'
                supportActionHistoryBridge: 'organization.member_recovery_support_history_bridge.v1'
                allowedOutcome: 'invite_required'
                directMembershipMutationAllowed: false
                ownerlessRecoveryMutationAllowed: false
                requiresAcceptedInvite: true
                requiredAuditFields: Array<'organizationId' | 'targetUserId' | 'requestId' | 'supportSessionId' | 'reason' | 'outcome'>
                blockedRoutesUntilAcceptedMembership: Array<
                    | 'GET /api/organizations/:id/watchlists'
                    | 'GET /api/organizations/:id/watchlists/alert-terms'
                    | 'GET /api/organizations/:id/alert-case-visibility'
                    | 'POST /v1/dwm/webhooks/deliver'
                >
                nonmemberEnumeration: false
            }
        }
        nonmemberEnumeration: false
    }
    inviteLifecycleProof: {
        schemaVersion: 'organization.invite_lifecycle_readiness_proof.v1'
        pendingInviteCount: number
        inviteTenSupported: boolean
        maxRecipientsPerRequest: 25
        duplicateRecipientHandling: 'dedupe_case_insensitive'
        defaultExpiryDays: 14
        acceptanceTokenField: 'invite.acceptanceToken'
        acceptanceRoute: 'POST /api/organizations/invites/:inviteId/accept'
        inviteRoute: 'POST /api/organizations/:id/invites'
        actionRoute: 'POST /api/organizations/:id/invites/:inviteId/actions'
        supportedActions: Array<'revoke' | 'resend'>
        idempotentActions: Array<'revoke' | 'resend'>
        duplicateInviteOutcome: 'updated_pending_invite'
        blockedOutcomes: Array<'already_member' | 'blocked_removed_member' | 'blocked_deactivated_user'>
        lifecycleBlockers: Array<'invite_expired' | 'member_revoked' | 'org_archived' | 'org_deleted'>
        auditActions: Array<'organization_invites_created' | 'organization_invite_accepted' | 'organization_invite_revoked' | 'organization_invite_resent'>
        requiredMetadataFields: Array<'requestId' | 'role' | 'recipientCount' | 'submittedRecipientCount' | 'duplicateRecipientCount' | 'invitedCount' | 'skippedCount' | 'inviteId' | 'action' | 'previousStatus' | 'newStatus'>
        nonmemberEnumeration: false
    }
    tenMemberWorkspaceProof: {
        schemaVersion: 'organization.ten_member_workspace_proof.v1'
        targetMemberCount: 10
        activeMemberCount: number
        pendingInviteCount: number
        acceptedOrInvitedCount: number
        sharedWatchlistCount: number
        activeWatchlistTermCount: number
        canSupportTenMemberSharedWatchlistRollout: boolean
        readinessRefs: {
            inviteLifecycle: 'organization.invite_lifecycle_readiness_proof.v1'
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1'
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1'
            alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1'
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1'
        }
        routeRefs: {
            bulkInvite: 'POST /api/organizations/:id/invites'
            listMembers: 'GET /api/organizations/:id/members'
            createWatchlist: 'POST /api/organizations/:id/watchlists'
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
            alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility'
            webhookDeliver: 'POST /v1/dwm/webhooks/deliver'
        }
        lifecycleBlockers: Array<'needs_10_active_members_or_pending_invites' | 'needs_shared_watchlist_item' | 'no_active_terms' | 'org_archived' | 'org_deleted' | 'member_revoked'>
        noEnumerationFields: Array<'otherOrg.members' | 'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'destination.secret'>
        fixtureBackedReadiness: {
            schemaVersion: 'organization.ten_member_workspace_fixture.v1'
            fixtureName: 'organization_watchlist'
            downstreamConsumers: Array<'alert_queue' | 'case_workflow' | 'webhook_delivery' | 'dashboard_readiness' | 'support_timeline'>
            requiredOrganizationFields: Array<'organizationId' | 'tenantId' | 'activeMemberCount' | 'pendingInviteCount' | 'ownerCount'>
            requiredWatchlistFields: Array<'watchlistItemId' | 'alertGenerationRef' | 'alertGeneratorKey' | 'termFamily' | 'normalizedTerm' | 'status'>
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup'
            memberLifecycleBlockers: Array<'member_revoked' | 'not_member' | 'invite_expired'>
            noEnumerationFields: Array<'otherOrg.members' | 'otherOrg.watchlistItemIds' | 'destination.secret'>
        }
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    alertGenerationHandoff: {
        schemaVersion: 'organization.watchlist_alert_generation_handoff.v1'
        sourceContract: 'organization.watchlist_alert_generation_consumer.v1'
        fixtureContract: 'organization.watchlist_alert_generation_fixture.v1'
        route: 'organization_watchlist'
        exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms'
        cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup'
        organizationId: string
        tenantId: string
        activeTermCount: number
        watchlistItemIds: string[]
        alertGeneratorKeys: string[]
        matchingInputFields: Array<'organizationId' | 'tenantId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm' | 'alertGenerationRef'>
        expectedPersistedAlertFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'workflowContext.organizationId' | 'workflowContext.alertGeneratorKeys' | 'workflowContext.visibilityDecision' | 'casePath'>
        expectedCaseFields: Array<'organizationId' | 'tenantId' | 'casePath' | 'watchlistItemIds' | 'allowedActions'>
        dedupeKeyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
        replaySteps: Array<'export_alert_terms' | 'match_capture_fixture' | 'persist_org_alert' | 'verify_case_visibility' | 'deliver_webhook' | 'archive_cleanup'>
        readinessRefs: {
            alertQueue: 'organization.alert_queue_visibility_proof.v1'
            caseAssignment: 'organization.case_assignment_readiness.v1'
            destinationOwnership: 'organization.webhook_destination_ownership_readiness.v1'
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1'
        }
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'member_revoked' | 'watchlist_paused' | 'watchlist_archived' | 'no_active_terms' | 'role_not_allowed'>
        blockerCodes: string[]
        crossOrgDedupeAllowed: false
        nonmemberEnumeration: false
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
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
    customerWorkflowProof: {
        schemaVersion: 'organization.customer_workflow_proof.v1'
        routeSequence: Array<
            | 'POST /api/organizations'
            | 'POST /api/organizations/:id/invites'
            | 'POST /api/organizations/invites/:inviteId/accept'
            | 'GET /api/organizations/:id/members'
            | 'POST /api/organizations/:id/watchlists'
            | 'GET /api/organizations/:id/watchlists/alert-terms'
            | 'GET /api/organizations/:id/alert-case-visibility'
            | 'POST /api/organizations/:id/watchlists/cleanup'
        >
        requiredOrgFields: Array<'organizationId' | 'tenantId' | 'member.role' | 'counts.activeMemberCount' | 'counts.activeAdminCount'>
        requiredWatchlistFields: Array<'watchlistItemId' | 'organizationId' | 'kind' | 'term' | 'status' | 'createdBy' | 'updatedBy' | 'alertGenerationRef'>
        requiredAlertFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'workflowContext.alertGeneratorKeys' | 'workflowContext.visibilityDecision'>
        roleGates: {
            ownerAdminMutate: true
            memberReadExport: boolean
            viewerReadOnly: true
            nonmemberEnumeration: false
        }
        lifecycleBlockers: string[]
        downstreamConsumers: Array<'alert_queue' | 'case_workflow' | 'webhook_delivery' | 'dashboard_readiness' | 'support_timeline'>
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
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
    const submittedEmails = [...fromArray, ...fromSingle]
        .map(email => cleanText(email).toLowerCase())
        .filter(Boolean)
    const emails = Array.from(new Set(submittedEmails))

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
    return {
        emails,
        role,
        expiresAt,
        requestId,
        submittedRecipientCount: submittedEmails.length,
        normalizedRecipientCount: emails.length,
        duplicateRecipientCount: submittedEmails.length - emails.length,
    }
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

export function organizationMemberAccessContract(
    organization: Pick<OrganizationRow, 'id' | 'role' | 'status' | 'alert_visibility_policy'>,
    members: Array<Pick<OrganizationMemberRow, 'user_id' | 'role' | 'status'>>
) {
    const activeMembers = members.filter(member => member.status === 'active')
    const roleCounts = activeMembers.reduce((counts, member) => {
        counts[member.role] += 1
        return counts
    }, {
        owner: 0,
        admin: 0,
        member: 0,
        viewer: 0,
    } satisfies Record<OrganizationRole, number>)
    const actorRole = organization.role ?? 'viewer'
    const roleActionContract = organizationAlertCaseRoleActionContract({
        userId: 'organization_member_read',
        role: actorRole,
    })
    const visibility = organizationVisibilityDecision({
        role: actorRole,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })

    return {
        schemaVersion: 'organization.member_access_contract.v1' as const,
        organizationId: organization.id,
        tenantId: organization.id,
        actor: {
            role: actorRole,
            status: organization.status ?? 'active',
            canManageInvites: roleCanManageOrganization(actorRole),
            canManageMembers: roleCanManageOrganization(actorRole),
            canManageWatchlists: roleCanWriteWatchlist(actorRole),
            canReadSharedWatchlists: true,
            canExportAlertTerms: visibility.allowed,
            allowedAlertCaseActions: organizationAlertCaseRoleActions(actorRole),
        },
        counts: {
            activeMemberCount: activeMembers.length,
            ownerCount: roleCounts.owner,
            adminCount: roleCounts.admin,
            memberCount: roleCounts.member,
            viewerCount: roleCounts.viewer,
            activeAdminCount: roleCounts.owner + roleCounts.admin,
        },
        roleGates: {
            createWatchlist: ['owner', 'admin'],
            updateWatchlist: ['owner', 'admin'],
            pauseWatchlist: ['owner', 'admin'],
            archiveWatchlist: ['owner', 'admin'],
            manageInvites: ['owner', 'admin'],
            manageMembers: ['owner', 'admin'],
            readSharedWatchlists: ['owner', 'admin', 'member', 'viewer'],
            exportAlertTerms: visibility.allowedRoles,
            acknowledgeAlert: roleActionContract.roleGates.acknowledge_alert,
            assignCase: roleActionContract.roleGates.assign_case,
            linkCase: roleActionContract.roleGates.link_case,
        },
        memberLifecycle: {
            schemaVersion: 'organization.member_lifecycle_contract.v1' as const,
            routes: {
                listMembers: 'GET /api/organizations/:id/members',
                updateRole: 'PATCH /api/organizations/:id/members/:userId/role',
                removeMember: 'DELETE /api/organizations/:id/members/:userId',
                transferOwnership: 'POST /api/organizations/:id/ownership-transfer',
            },
            actorRole,
            allowedMutators: ['owner', 'admin'],
            roleTargets: ['admin', 'member', 'viewer'],
            roleChange: {
                ownerCanAssign: ['admin', 'member', 'viewer'],
                adminCanAssign: ['member', 'viewer'],
                memberCanAssign: [],
                viewerCanAssign: [],
                requestMetadataFields: ['requestId', 'reason', 'previousRole', 'newRole'],
                serviceLogAction: 'organization_member_role_updated',
            },
            removal: {
                ownerCanRemove: ['admin', 'member', 'viewer'],
                adminCanRemove: ['member', 'viewer'],
                lastOwnerBlocked: true,
                ownerRemovalRequiresTransfer: true,
                removedMemberStatus: 'removed',
                removedMemberDeniedFromWatchlists: true,
                removedMemberDeniedFromAlertTerms: true,
                serviceLogAction: 'organization_member_removed',
            },
            ownership: {
                transferRoute: 'POST /api/organizations/:id/ownership-transfer',
                reasonRequired: true,
                lastOwnerGuard: true,
                serviceLogAction: 'organization_ownership_transferred',
            },
            audit: {
                source: 'service_logs',
                requiredMetadataFields: ['requestId', 'reason', 'actorId', 'targetUserId', 'organizationId'],
            },
            noLeakFields: [
                'otherOrg.members',
                'watchlistScope.alertGeneratorKeys',
                'activeTerms[]',
                'destination.secret',
            ],
        },
        lifecycleDenials: {
            inactiveOrganization: organization.status === 'archived' ? 'org_archived' : organization.status === 'deleted' ? 'org_deleted' : null,
            revokedMember: 'member_revoked',
            expiredInvite: 'invite_expired',
            nonmember: 'nonmember_denied',
            pausedWatchlist: 'watchlist_paused',
            archivedWatchlist: 'watchlist_archived',
        },
        downstreamConsumers: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
            sharedWatchlists: 'GET /api/organizations/:id/watchlists',
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

export function organizationAnalystPortalVisibilityAdapter(
    proof: OrganizationSharedWatchlistDownstreamProof,
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
): OrganizationAnalystPortalVisibilityAdapter {
    const alertBlockers = proof.alertBridge.blockerCodes.map(String)
    const caseBlockers = proof.caseBridge.blockerCodes.map(String)
    const webhookBlockers = proof.webhookBridge.blockerCodes.map(String)
    const visibilityDenied = downstreamAuthorization.visibility.allowed ? null : downstreamAuthorization.visibility.reason
    const actionMatrix: OrganizationAnalystPortalVisibilityAdapter['actionMatrix'] = {
        review_alert: {
            allowed: downstreamAuthorization.visibility.allowed && alertBlockers.length === 0,
            allowedRoles: downstreamAuthorization.visibility.allowedRoles,
            denialReason: visibilityDenied ?? (alertBlockers[0] as OrganizationWatchlistAlertBridgeBlockerCode | undefined) ?? null,
            blockerCodes: downstreamAuthorization.visibility.allowed ? alertBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        acknowledge_alert: {
            allowed: downstreamAuthorization.visibility.allowed
                && downstreamAuthorization.allowedActions.includes('acknowledge_alert')
                && alertBlockers.length === 0,
            allowedRoles: ['owner', 'admin', 'member'],
            denialReason: visibilityDenied ?? (downstreamAuthorization.allowedActions.includes('acknowledge_alert') ? null : 'role_not_allowed'),
            blockerCodes: downstreamAuthorization.visibility.allowed ? alertBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        assign_case: {
            allowed: downstreamAuthorization.visibility.allowed
                && downstreamAuthorization.allowedActions.includes('assign_case')
                && caseBlockers.length === 0,
            allowedRoles: ['owner', 'admin', 'analyst'],
            denialReason: visibilityDenied ?? (downstreamAuthorization.allowedActions.includes('assign_case') ? null : 'role_not_allowed'),
            blockerCodes: downstreamAuthorization.visibility.allowed ? caseBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        link_case: {
            allowed: downstreamAuthorization.visibility.allowed
                && downstreamAuthorization.allowedActions.includes('link_case')
                && caseBlockers.length === 0,
            allowedRoles: ['owner', 'admin', 'analyst'],
            denialReason: visibilityDenied ?? (downstreamAuthorization.allowedActions.includes('link_case') ? null : 'role_not_allowed'),
            blockerCodes: downstreamAuthorization.visibility.allowed ? caseBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        replay_alert: {
            allowed: downstreamAuthorization.visibility.allowed && alertBlockers.length === 0,
            allowedRoles: downstreamAuthorization.visibility.allowedRoles,
            denialReason: visibilityDenied ?? (alertBlockers[0] as OrganizationWatchlistAlertBridgeBlockerCode | undefined) ?? null,
            blockerCodes: downstreamAuthorization.visibility.allowed ? alertBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        deliver_webhook: {
            allowed: proof.webhookBridge.deliveryContract.roleGates.manualTriggerAllowed
                && webhookBlockers.length === 0,
            allowedRoles: ['owner', 'admin'],
            denialReason: proof.webhookBridge.deliveryContract.roleGates.denialReason
                ?? (webhookBlockers[0] as OrganizationWatchlistAlertBridgeBlockerCode | undefined)
                ?? null,
            blockerCodes: webhookBlockers,
        },
        open_audit_timeline: {
            allowed: downstreamAuthorization.visibility.allowed,
            allowedRoles: ['owner', 'admin', 'support'],
            denialReason: visibilityDenied,
            blockerCodes: downstreamAuthorization.visibility.allowed ? [] : [visibilityDenied ?? 'role_not_allowed'],
        },
    }
    const allowedActions = Object.entries(actionMatrix)
        .filter(([, gate]) => gate.allowed)
        .map(([action]) => action as OrganizationSharedWatchlistAnalystPortalAction)

    return {
        schemaVersion: 'organization.analyst_portal_visibility_adapter.v1',
        organizationId: proof.organizationId,
        tenantId: proof.tenantId,
        sourceFamily: 'organization_watchlist',
        member: proof.actor,
        routeBindings: {
            alertList: 'GET /v1/dwm/alerts?organizationId=:organizationId',
            alertDetail: 'GET /v1/dwm/alerts/:id',
            caseList: 'GET /v1/cases?organizationId=:organizationId',
            caseDetail: 'GET /v1/cases/:id',
            webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
        },
        requiredIdentityFields: [
            'organizationId',
            'tenantId',
            'member.userId',
            'member.role',
            'watchlistItemIds[]',
            'workflowContext.visibilityDecision',
        ],
        watchlistScope: {
            activeWatchlistItemIds: proof.watchlistOwnership.activeIds,
            alertGeneratorKeys: proof.alertBridge.alertGeneratorKeys,
            itemIdField: 'watchlistItemIds[]',
            alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]',
            crossTenantCollisionAllowed: false,
        },
        actionMatrix,
        allowedActions,
        lifecycleBlockers: proof.alertBridge.persistenceContract.lifecycleBlockers,
        consumerProof: {
            alertQueueAdapter: 'organizationSharedWatchlistAlertQueueVisibility',
            caseWorkflowAdapter: 'organization.watchlist_case_workflow_contract.v1',
            webhookGuardrailAdapter: 'organizationSharedWatchlistWebhookDeliveryGuardrails',
            auditAdapter: 'organizationSharedWatchlistAuditEventBridge',
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        redaction: {
            safeFields: [
                'organizationId',
                'tenantId',
                'member.role',
                'allowedActions',
                'actionMatrix',
                'watchlistScope.activeWatchlistItemIds',
                'watchlistScope.alertGeneratorKeys',
            ],
            redactedFields: [
                'activeTerms[].term',
                'activeTerms[].value',
                'case.evidence.rawContent',
                'destination.secret',
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
            ],
            nonmemberEnumeration: false,
        },
    }
}

export function organizationAlertCaseWorkflowState(
    proof: OrganizationSharedWatchlistDownstreamProof,
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
) {
    const analystPortalAdapter = organizationAnalystPortalVisibilityAdapter(proof, downstreamAuthorization)
    const alertQueue = proof.alertBridge.queueVisibilityContract
    const caseWorkflow = proof.caseBridge.caseWorkflowContract

    return {
        schemaVersion: 'organization.alert_case_workflow_state.v1' as const,
        organizationId: proof.organizationId,
        tenantId: proof.tenantId,
        sourceFamily: 'organization_watchlist' as const,
        member: downstreamAuthorization.member,
        visibility: downstreamAuthorization.visibility,
        alertRecord: {
            route: alertQueue.routes.list,
            requiredQueryFields: alertQueue.requiredQueryFields,
            requiredPersistedFields: [
                'organizationId',
                'tenantId',
                'ownerOrganizationId',
                'sourceFamily',
                'watchlistItemIds',
                'watchlist.ownerOrganizationId',
                'matchedTerm.termFamily',
                'matchedTerm.term',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.visibilityDecision',
                'workflowContext.allowedActions',
            ],
            watchlistItemIds: alertQueue.watchlistScope.watchlistItemIds,
            alertGeneratorKeys: alertQueue.watchlistScope.alertGeneratorKeys,
            dedupeScope: proof.alertBridge.dedupeScope,
            crossTenantCollisionAllowed: false,
        },
        alertListing: {
            schemaVersion: 'organization.alert_listing_contract.v1' as const,
            routes: {
                list: alertQueue.routes.list,
                detail: alertQueue.routes.detail,
                update: alertQueue.routes.update,
                replay: alertQueue.routes.replay,
            },
            requiredFilters: {
                organizationId: proof.organizationId,
                tenantId: proof.tenantId,
                watchlistItemIds: alertQueue.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: alertQueue.watchlistScope.alertGeneratorKeys,
                lifecycleStatuses: ['active'] as const,
            },
            responseFields: [
                'alertId',
                'organizationId',
                'tenantId',
                'ownerOrganizationId',
                'sourceFamily',
                'watchlistItemIds',
                'matchedTerm.termFamily',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.visibilityDecision',
                'workflowContext.allowedActions',
                'casePath',
                'updatedAt',
            ],
            actionGates: alertQueue.actionGates,
            allowedActions: analystPortalAdapter.allowedActions,
            deniedResponse: {
                schemaVersion: 'organization.alert_listing_denial.v1' as const,
                statusCode: 403,
                nonmemberEnumeration: false,
                redactedFields: [
                    'activeTerms[]',
                    'watchlistScope.alertGeneratorKeys',
                    'otherOrg.alertIds',
                    'case.evidence.rawContent',
                ],
                blockerCodes: alertQueue.blockerCodes,
            },
            proofAssertions: [
                'query_requires_organization_id',
                'watchlist_ids_match_org_export',
                'alert_generator_keys_match_org_export',
                'nonmember_denial_redacts_terms',
                'cross_org_dedupe_disallowed',
            ],
        },
        caseRecord: {
            route: caseWorkflow.routes.list,
            casePathTemplate: caseWorkflow.casePathTemplate,
            requiredQueryFields: caseWorkflow.requiredQueryFields,
            requiredPersistedFields: [
                'organizationId',
                'tenantId',
                'alertId',
                'casePath',
                'watchlistItemIds',
                'allowedActions',
                'visibilityDecision',
            ],
            watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
            alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
            actorActions: caseWorkflow.actorActions,
        },
        caseAssignment: {
            schemaVersion: 'organization.case_assignment_visibility.v1' as const,
            route: caseWorkflow.routes.update,
            organizationId: proof.organizationId,
            tenantId: proof.tenantId,
            sourceFamily: 'organization_watchlist' as const,
            requiredPayloadFields: [
                'organizationId',
                'caseId',
                'assigneeId',
                'rationale',
                'watchlistItemIds',
            ],
            requiredPersistedFields: [
                'case.organizationId',
                'case.tenantId',
                'case.watchlistItemIds',
                'case.visibilityDecision',
                'case.assigneeId',
                'case.assignmentAudit.requestId',
            ],
            watchlistScope: {
                watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
                crossTenantCollisionAllowed: false as const,
            },
            allowed: caseWorkflow.actorActions.canAssignCase,
            allowedRoles: ['owner', 'admin', 'analyst'] as const,
            actorRole: downstreamAuthorization.member.role,
            denialReason: caseWorkflow.actorActions.canAssignCase
                ? null
                : caseWorkflow.actorActions.denialReason ?? (downstreamAuthorization.visibility.allowed ? 'role_not_allowed' as const : downstreamAuthorization.visibility.reason ?? 'role_not_allowed' as const),
            blockerCodes: caseWorkflow.actorActions.canAssignCase
                ? []
                : Array.from(new Set([
                    ...caseWorkflow.blockerCodes,
                    caseWorkflow.actorActions.denialReason ?? (downstreamAuthorization.visibility.allowed ? 'role_not_allowed' : downstreamAuthorization.visibility.reason ?? 'role_not_allowed'),
                ].filter(Boolean).map(String))).sort(),
            memberLifecycleBlockers: [
                'member_revoked',
                'not_member',
                'invite_expired',
            ],
            noEnumerationFields: [
                'otherOrg.caseIds',
                'otherOrg.watchlistItemIds',
                'case.evidence.rawContent',
                'destination.secret',
            ],
            auditEventAction: 'organization_case_assignment_visibility_checked' as const,
        },
        webhookDestinationOwnership: {
            schemaVersion: 'organization.webhook_destination_ownership.v1' as const,
            route: proof.webhookBridge.route,
            eventType: proof.webhookBridge.deliveryContract.eventType,
            organizationId: proof.webhookBridge.deliveryContract.organizationId,
            tenantId: proof.webhookBridge.deliveryContract.tenantId,
            policy: proof.webhookBridge.deliveryContract.destinationSelection.policy,
            selectedDestinationSource: proof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationSource,
            requiredDestinationOrgId: proof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId,
            selectedDestinationOrgField: proof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationOrgField,
            selectedDestinationIdField: proof.webhookBridge.deliveryContract.destinationSelection.selectedDestinationIdField,
            skippedDestinationReasons: proof.webhookBridge.deliveryContract.destinationSelection.skippedDestinationReasons,
            nonmemberDestinationEnumeration: proof.webhookBridge.deliveryContract.destinationSelection.nonmemberDestinationEnumeration,
            idempotency: proof.webhookBridge.deliveryContract.idempotency,
            roleGates: proof.webhookBridge.deliveryContract.roleGates,
            requiredAlertFields: proof.webhookBridge.deliveryContract.requiredAlertFields,
            requiredDeliveryFields: proof.webhookBridge.deliveryContract.requiredDeliveryFields,
            redactedFields: proof.webhookBridge.deliveryContract.redactedFields,
            blockerCodes: proof.webhookBridge.deliveryContract.blockerCodes,
        },
        allowedActions: analystPortalAdapter.allowedActions,
        actionMatrix: analystPortalAdapter.actionMatrix,
        lifecycleBlockers: Array.from(new Set([
            ...proof.alertBridge.blockerCodes,
            ...proof.caseBridge.blockerCodes,
            ...downstreamAuthorization.downstream.alertGeneration.blockerCodes,
        ])),
        guardrails: {
            nonmemberEnumeration: false,
            noLeakFields: [
                'otherOrg.organizationId',
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'case.evidence.rawContent',
                'destination.secret',
            ],
            denialAuditEvent: 'organization_watchlist_alert_visibility_denied' as const,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
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
    const caseWorkflowDenialReason = downstreamAuthorization.visibility.allowed
        ? (caseBlockers[0] ?? null)
        : downstreamAuthorization.visibility.reason
    const caseReadAllowed = downstreamAuthorization.visibility.allowed && caseBlockers.length === 0
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
    const auditEventActions: OrganizationSharedWatchlistAuditEventAction[] = [
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
    ]

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
            memberRemovalRevokesPendingInvites: true,
            memberRemovalCleanupSchema: 'organization.member_removal_cleanup.v1',
            memberRemovalCleanupField: 'memberRemovalCleanup.revokedInviteIds',
            staleInviteAcceptanceBlocker: 'member_revoked',
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
            eventActions: auditEventActions,
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
            eventBridge: organizationSharedWatchlistAuditEventBridge(auditEventActions),
        },
        alertBridge: {
            route: 'organization_watchlist',
            canGenerateAlerts: alertGeneration.canGenerateAlerts,
            activeWatchlistItemIds: activeTerms.map(term => term.watchlistItemId),
            alertGeneratorKeys,
            alertGenerationRefField: 'activeTerms[].alertGenerationRef',
            dedupeScope: 'organization_watchlist_term',
            persistenceContract: {
                schemaVersion: 'organization.watchlist_alert_persistence_contract.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                sourceFamily: 'organization_watchlist',
                storageModule: 'ti/scraper/src/storage/dwmAlertRepository.ts',
                upsertFunction: 'upsertDwmAlert',
                requiredInputFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemIds',
                    'workflowContext.alertGenerationRefs',
                    'workflowContext.alertGeneratorKeys',
                    'workflowContext.watchlistTermContexts',
                    'workflowContext.visibilityDecision',
                    'casePath',
                ],
                persistedAlertFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemIds',
                    'watchlistIds',
                    'workflowContext.organizationId',
                    'workflowContext.alertGenerationRefs',
                    'workflowContext.alertGeneratorKeys',
                    'workflowContext.watchlistTermContexts',
                    'workflowContext.visibilityDecision',
                    'casePath',
                    'dedupeKey',
                ],
                workflowContextFields: [
                    'organizationId',
                    'tenantId',
                    'sourceFamily',
                    'alertGenerationRefs',
                    'alertGeneratorKeys',
                    'watchlistTermContexts',
                    'visibilityDecision',
                    'allowedActions',
                    'casePath',
                ],
                watchlistScope: {
                    watchlistItemIds: activeTerms.map(term => term.watchlistItemId),
                    alertGeneratorKeys,
                    alertGenerationRefField: 'workflowContext.alertGenerationRefs[]',
                    watchlistItemIdField: 'watchlistItemIds[]',
                },
                dedupe: {
                    scope: 'organization_watchlist_term',
                    keyFields: ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'],
                    crossTenantCollisionAllowed: false,
                },
                lifecycleBlockers: ['org_archived', 'org_deleted', 'watchlist_paused', 'watchlist_archived', 'member_revoked', 'nonmember_denied'],
                visibilityDecisionField: 'workflowContext.visibilityDecision',
                casePathField: 'casePath',
                blockerCodes: [
                    ...alertBlockers,
                    ...(downstreamAuthorization.visibility.allowed ? [] : [downstreamAuthorization.visibility.reason].filter(Boolean)),
                ] as Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>,
            },
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
            caseWorkflowContract: {
                schemaVersion: 'organization.watchlist_case_workflow_contract.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                sourceFamily: 'organization_watchlist',
                routes: {
                    open: 'POST /v1/cases',
                    list: 'GET /v1/cases',
                    detail: 'GET /v1/cases/:id',
                    update: 'PATCH /v1/cases/:id',
                },
                requiredQueryFields: ['organizationId'],
                casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
                watchlistScope: {
                    watchlistItemIds: activeTerms.map(term => term.watchlistItemId),
                    alertGeneratorKeys,
                    evidenceRefField: 'case.evidence.watchlistItemIds[]',
                },
                actorActions: {
                    canReadCases: caseReadAllowed,
                    canOpenCase: caseReadAllowed && downstreamAuthorization.allowedActions.includes('link_case'),
                    canAssignCase: caseReadAllowed && downstreamAuthorization.allowedActions.includes('assign_case'),
                    canLinkCase: caseReadAllowed && downstreamAuthorization.allowedActions.includes('link_case'),
                    canCloseCase: caseReadAllowed && downstreamAuthorization.allowedActions.includes('assign_case'),
                    allowedActions: downstreamAuthorization.allowedActions,
                    denialReason: caseWorkflowDenialReason,
                },
                requiredCaseFields: [
                    'organizationId',
                    'tenantId',
                    'alertId',
                    'casePath',
                    'watchlistItemIds',
                    'allowedActions',
                    'visibilityDecision',
                    'evidence.provenance',
                ],
                timelineEventTypes: [
                    'case.opened',
                    'case.linked_alert',
                    'case.assigned',
                    'case.status_changed',
                    'case.note_added',
                ],
                evidenceFields: [
                    'alertId',
                    'watchlistItemIds',
                    'alertGeneratorKeys',
                    'matchedTerms',
                    'source',
                    'capturedAt',
                    'casePath',
                ],
                redactedFields: [
                    'activeTerms[].term',
                    'activeTerms[].value',
                    'case.evidence.rawContent',
                ],
                blockerCodes: caseBlockers,
            },
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
        monitoringWorkflow: organizationSharedWatchlistMonitoringWorkflow({
            organizationId: organization.id,
            activeWatchlistItemIds: activeTerms.map(term => term.watchlistItemId),
            alertGeneratorKeys,
            alertAllowedRoles: downstreamAuthorization.visibility.allowedRoles,
            allowedActions: downstreamAuthorization.allowedActions,
            alertReadAllowed,
            caseReadAllowed,
            webhookManualAllowed: webhookDeliveryAllowedByRole && downstreamAuthorization.organizationLifecycleState === 'active',
            alertBlockers,
            caseBlockers,
            webhookBlockers,
            auditEventActions,
        }),
        analystPortalWorkflow: organizationSharedWatchlistAnalystPortalWorkflow({
            organizationId: organization.id,
            actorRole: member.role,
            alertReadAllowed,
            caseReadAllowed,
            webhookManualAllowed: webhookDeliveryAllowedByRole && downstreamAuthorization.organizationLifecycleState === 'active',
            allowedActions: downstreamAuthorization.allowedActions,
            alertBlockers,
            caseBlockers,
            webhookBlockers,
            auditEventActions,
        }),
        enrichmentProvenance: organizationSharedWatchlistEnrichmentProvenance({
            organizationId: organization.id,
            activeWatchlistItemIds: activeTerms.map(term => term.watchlistItemId),
            alertGeneratorKeys,
            alertBlockers,
        }),
        integration: {
            expectedAdapter: 'organizationSharedWatchlistDownstreamProof',
            payloadShape: [
                'organizationId',
                'tenantId',
                'actor.role',
                'watchlistOwnership.activeIds',
                'watchlistOwnership.lifecycleStatuses',
                'alertBridge.alertGeneratorKeys',
                'alertBridge.persistenceContract.persistedAlertFields',
                'alertBridge.persistenceContract.workflowContextFields',
                'alertBridge.queueVisibilityContract.actorVisibility',
                'alertBridge.queueVisibilityContract.watchlistScope',
                'alertBridge.expectedAlertFields',
                'caseBridge.caseWorkflowContract.actorActions',
                'caseBridge.caseWorkflowContract.watchlistScope',
                'caseBridge.expectedCaseFields',
                'webhookBridge.expectedDeliveryFields',
                'webhookBridge.deliveryContract.destinationSelection',
                'webhookBridge.deliveryContract.idempotency',
                'monitoringWorkflow',
                'analystPortalWorkflow',
                'enrichmentProvenance',
                'audit.eventActions',
                'audit.eventBridge',
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

function organizationSharedWatchlistAuditEventBridge(
    eventActions: OrganizationSharedWatchlistAuditEventAction[]
): OrganizationSharedWatchlistDownstreamProof['audit']['eventBridge'] {
    const requiredActions: OrganizationSharedWatchlistAuditEventAction[] = [
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
    ]
    const requiredSafeFields: OrganizationSharedWatchlistDownstreamProof['audit']['eventBridge']['requiredSafeFields'] = [
        'action',
        'routeGroup',
        'outcome',
        'requestIdField',
        'actorField',
        'organizationField',
    ]
    const requiredRedactedFields: OrganizationSharedWatchlistDownstreamProof['audit']['eventBridge']['requiredRedactedFields'] = [
        'metadata.value',
        'metadata.email',
        'activeTerms[].term',
        'alertBridge.alertGeneratorKeys',
    ]
    const eventDescriptors = eventActions.map(action => ({
        action,
        routeGroup: organizationSharedWatchlistAuditRouteGroup(action),
        outcome: organizationSharedWatchlistAuditOutcome(action),
        requestIdField: 'metadata.requestId' as const,
        actorField: 'actor.userId' as const,
        organizationField: 'organizationId' as const,
        requiredMetadataFields: organizationSharedWatchlistAuditMetadataFields(action),
        redactedMetadataFields: requiredRedactedFields,
        downstreamConsumers: organizationSharedWatchlistAuditConsumers(action),
        idempotent: organizationSharedWatchlistAuditIsIdempotent(action),
    }))
    const blockerCodes: OrganizationSharedWatchlistDownstreamProof['audit']['eventBridge']['blockerCodes'] = []

    if (!requiredActions.every(action => eventActions.includes(action))) {
        blockerCodes.push('missing_required_action')
    }
    if (!eventDescriptors.every(descriptor => descriptor.requestIdField === 'metadata.requestId')) {
        blockerCodes.push('missing_request_id')
    }
    if (!eventDescriptors.every(descriptor => descriptor.actorField === 'actor.userId')) {
        blockerCodes.push('missing_actor')
    }
    if (!eventDescriptors.every(descriptor => requiredRedactedFields.every(field => descriptor.redactedMetadataFields.includes(field)))) {
        blockerCodes.push('missing_redaction')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_audit_event_bridge.v1',
        source: 'service_logs',
        expectedAdapter: 'organizationSharedWatchlistAuditEventBridge',
        requiredActions,
        eventDescriptors,
        requiredSafeFields,
        requiredRedactedFields,
        noRawTermAccess: true,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        blockerCodes,
    }
}

function organizationSharedWatchlistAuditRouteGroup(action: OrganizationSharedWatchlistAuditEventAction): OrganizationSharedWatchlistAuditRouteGroup {
    if (action.startsWith('organization_invite')) return 'invite_lifecycle'
    if (action === 'organization_watchlist_upserted' || action === 'organization_watchlist_updated') return 'watchlist_write'
    if (action === 'organization_watchlist_alert_terms_exported' || action === 'organization_watchlist_alert_terms_export_denied') return 'alert_terms_export'
    if (action === 'organization_lifecycle_mutation_blocked') return 'lifecycle_blocker'
    return 'watchlist_lifecycle'
}

function organizationSharedWatchlistAuditOutcome(action: OrganizationSharedWatchlistAuditEventAction): 'success' | 'denied' | 'blocked' {
    if (action.endsWith('_denied')) return 'denied'
    if (action.endsWith('_blocked')) return 'blocked'
    return 'success'
}

function organizationSharedWatchlistAuditMetadataFields(action: OrganizationSharedWatchlistAuditEventAction): string[] {
    if (action.startsWith('organization_invite')) {
        return ['requestId', 'inviteId', 'role', 'reason', 'expiresAt']
    }
    if (action === 'organization_watchlist_cleanup_archived') {
        return ['requestId', 'reason', 'requestedItemIds', 'archivedItemIds', 'skippedItemIds', 'archivedCount']
    }
    if (action === 'organization_watchlist_alert_terms_exported') {
        return ['requestId', 'activeTermCount', 'pausedCount', 'archivedCount', 'canGenerateAlerts']
    }
    if (action === 'organization_watchlist_alert_terms_export_denied') {
        return ['requestId', 'role', 'alertVisibilityPolicy', 'allowedRoles', 'denialReason', 'blockerCodes']
    }
    if (action === 'organization_lifecycle_mutation_blocked') {
        return ['requestId', 'blockerCode', 'blockedAction', 'actorRole']
    }
    return ['requestId', 'watchlistItemId', 'kind', 'reason', 'action', 'status']
}

function organizationSharedWatchlistAuditConsumers(action: OrganizationSharedWatchlistAuditEventAction): OrganizationSharedWatchlistAuditConsumer[] {
    if (action === 'organization_watchlist_alert_terms_exported') {
        return ['alert_queue', 'case_workflow', 'webhook_delivery', 'support_timeline', 'dashboard_readiness']
    }
    if (action === 'organization_watchlist_alert_terms_export_denied') {
        return ['alert_queue', 'support_timeline', 'dashboard_readiness']
    }
    if (action.startsWith('organization_watchlist')) {
        return ['alert_queue', 'support_timeline', 'dashboard_readiness']
    }
    return ['support_timeline', 'dashboard_readiness']
}

function organizationSharedWatchlistAuditIsIdempotent(action: OrganizationSharedWatchlistAuditEventAction): boolean {
    return action === 'organization_invite_resent'
        || action === 'organization_invite_revoked'
        || action === 'organization_watchlist_cleanup_archived'
        || action === 'organization_watchlist_alert_terms_exported'
}

function organizationSharedWatchlistMonitoringWorkflow(input: {
    organizationId: string
    activeWatchlistItemIds: string[]
    alertGeneratorKeys: string[]
    alertAllowedRoles: OrganizationRole[]
    allowedActions: OrganizationAlertCaseAction[]
    alertReadAllowed: boolean
    caseReadAllowed: boolean
    webhookManualAllowed: boolean
    alertBlockers: string[]
    caseBlockers: string[]
    webhookBlockers: string[]
    auditEventActions: OrganizationSharedWatchlistAuditEventAction[]
}): OrganizationSharedWatchlistDownstreamProof['monitoringWorkflow'] {
    const activeScopeReady = input.activeWatchlistItemIds.length > 0 && input.alertGeneratorKeys.length > 0
    const watchlistExportReady = activeScopeReady && input.alertBlockers.length === 0
    const alertUpsertReady = watchlistExportReady && input.alertReadAllowed
    const caseLinkReady = input.caseReadAllowed && input.allowedActions.includes('link_case') && input.caseBlockers.length === 0
    const webhookReady = input.webhookManualAllowed && input.webhookBlockers.length === 0
    const auditReady = input.auditEventActions.includes('organization_watchlist_alert_terms_exported')
        && input.auditEventActions.includes('organization_watchlist_alert_terms_export_denied')
    const workflowBlockers = Array.from(new Set([
        ...input.alertBlockers,
        ...input.caseBlockers,
        ...input.webhookBlockers,
        ...(activeScopeReady ? [] : ['no_active_terms']),
    ])).sort()

    return {
        schemaVersion: 'organization.shared_watchlist_monitoring_workflow.v1',
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        sourceFamily: 'organization_watchlist',
        persistenceLevel: 'organization_persisted',
        expectedAdapter: 'organizationSharedWatchlistMonitoringWorkflow',
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        entrypoint: {
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            requiredQueryFields: ['organizationId', 'requestId'],
            responseField: 'alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow',
        },
        steps: [
            {
                id: 'watchlist_export',
                ownerLane: 'org_watchlist',
                route: 'GET /api/organizations/:id/watchlists/alert-terms',
                storageModule: 'api/src/utils/organizations.ts',
                requiredPayloadFields: ['organizationId', 'tenantId', 'activeTerms[].alertGenerationRef', 'sharedWatchlistDownstreamProof.audit.eventBridge'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported', 'organization_watchlist_alert_terms_export_denied'],
                allowedRoles: input.alertAllowedRoles,
                state: watchlistExportReady ? 'ready' : 'blocked',
                blockerCodes: watchlistExportReady ? [] : Array.from(new Set([...input.alertBlockers, ...(activeScopeReady ? [] : ['no_active_terms'])])).sort(),
                redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'member.userId'],
            },
            {
                id: 'alert_upsert',
                ownerLane: 'dwm_alert_workflow',
                route: 'POST /v1/dwm/alerts/rebuild',
                storageModule: 'ti/scraper/src/storage/dwmAlertRepository.ts',
                requiredPayloadFields: ['organizationId', 'tenantId', 'watchlistItemIds', 'workflowContext.alertGeneratorKeys', 'workflowContext.visibilityDecision', 'casePath'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported'],
                allowedRoles: input.alertAllowedRoles,
                state: alertUpsertReady ? 'ready' : 'blocked',
                blockerCodes: alertUpsertReady ? [] : Array.from(new Set(input.alertBlockers.length ? input.alertBlockers : ['role_not_allowed'])).sort(),
                redactedFields: ['activeTerms[].term', 'activeTerms[].value'],
            },
            {
                id: 'alert_queue_visibility',
                ownerLane: 'dwm_alert_workflow',
                route: 'GET /v1/dwm/alerts',
                storageModule: 'ti/scraper/src/storage/dwmAlertRepository.ts',
                requiredPayloadFields: ['organizationId', 'workflowContext.organizationId', 'workflowContext.alertGeneratorKeys', 'workflowContext.allowedActions'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported', 'organization_watchlist_alert_terms_export_denied'],
                allowedRoles: input.alertAllowedRoles,
                state: input.alertReadAllowed ? 'ready' : 'blocked',
                blockerCodes: input.alertReadAllowed ? [] : ['role_not_allowed'],
                redactedFields: ['activeTerms[].term', 'activeTerms[].value'],
            },
            {
                id: 'case_link',
                ownerLane: 'case_workflow',
                route: 'POST /v1/cases',
                storageModule: 'ti/scraper/src/api/caseRoutes.ts',
                requiredPayloadFields: ['organizationId', 'tenantId', 'alertId', 'casePath', 'watchlistItemIds', 'evidence.provenance'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported'],
                allowedRoles: ['owner', 'admin', 'analyst'],
                state: caseLinkReady ? 'ready' : 'blocked',
                blockerCodes: caseLinkReady ? [] : Array.from(new Set(input.caseBlockers.length ? input.caseBlockers : ['role_not_allowed'])).sort(),
                redactedFields: ['activeTerms[].term', 'case.evidence.rawContent'],
            },
            {
                id: 'webhook_delivery',
                ownerLane: 'webhook_delivery',
                route: 'POST /v1/dwm/webhooks/deliver',
                storageModule: 'ti/scraper/src/api/dwmWorkflowRoutes.ts',
                requiredPayloadFields: ['organizationId', 'destinationId', 'alert.dedupeKey', 'casePath', 'watchlistItemIds', 'auditEventContracts'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported'],
                allowedRoles: ['owner', 'admin'],
                state: webhookReady ? 'ready' : 'blocked',
                blockerCodes: webhookReady ? [] : Array.from(new Set(input.webhookBlockers.length ? input.webhookBlockers : ['manual_webhook_selection_required'])).sort(),
                redactedFields: ['activeTerms[].term', 'destination.secret'],
            },
            {
                id: 'audit_timeline',
                ownerLane: 'support_audit',
                route: 'GET /api/admin/support/audit',
                storageModule: 'api/src/handlers/adminSupport.ts',
                requiredPayloadFields: ['organizationId', 'action', 'metadata.requestId', 'actor.userId', 'audit.eventBridge.eventDescriptors'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported', 'organization_watchlist_alert_terms_export_denied', 'organization_lifecycle_mutation_blocked'],
                allowedRoles: ['owner', 'admin', 'support'],
                state: auditReady ? 'ready' : 'blocked',
                blockerCodes: auditReady ? [] : ['missing_required_action'],
                redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'member.userId'],
            },
        ],
        operatorActions: {
            acknowledgeAlert: input.allowedActions.includes('acknowledge_alert'),
            assignCase: input.caseReadAllowed && input.allowedActions.includes('assign_case'),
            linkCase: caseLinkReady,
            replayAlert: alertUpsertReady,
            deliverWebhook: webhookReady,
        },
        evidenceContract: {
            requiredFields: ['organizationId', 'tenantId', 'watchlistItemIds', 'alertGeneratorKeys', 'casePath', 'audit.eventBridge', 'visibilityDecision'],
            redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'destination.secret', 'case.evidence.rawContent'],
            containsRawTerms: false,
        },
        blockerCodes: workflowBlockers,
    }
}

function organizationSharedWatchlistAnalystPortalWorkflow(input: {
    organizationId: string
    actorRole: OrganizationRole
    alertReadAllowed: boolean
    caseReadAllowed: boolean
    webhookManualAllowed: boolean
    allowedActions: OrganizationAlertCaseAction[]
    alertBlockers: string[]
    caseBlockers: string[]
    webhookBlockers: string[]
    auditEventActions: OrganizationSharedWatchlistAuditEventAction[]
}): OrganizationSharedWatchlistDownstreamProof['analystPortalWorkflow'] {
    const canAcknowledge = input.alertReadAllowed && input.allowedActions.includes('acknowledge_alert')
    const canAssignCase = input.caseReadAllowed && input.allowedActions.includes('assign_case')
    const canLinkCase = input.caseReadAllowed && input.allowedActions.includes('link_case')
    const canReplay = input.alertReadAllowed && input.alertBlockers.length === 0
    const canDeliverWebhook = input.webhookManualAllowed && input.webhookBlockers.length === 0
    const portalBlockers = Array.from(new Set([
        ...(input.alertReadAllowed ? [] : ['role_not_allowed']),
        ...input.alertBlockers,
        ...input.caseBlockers,
        ...input.webhookBlockers,
    ])).sort()
    const eventActions = [
        'organization_watchlist_alert_terms_exported',
        'organization_watchlist_alert_terms_export_denied',
        'organization_lifecycle_mutation_blocked',
    ] as OrganizationSharedWatchlistAuditEventAction[]
    const redactedTimelineFields: OrganizationSharedWatchlistDownstreamProof['analystPortalWorkflow']['timelineContract']['redactedFields'] = [
        'metadata.value',
        'metadata.email',
        'activeTerms[].term',
        'alertBridge.alertGeneratorKeys',
    ]

    return {
        schemaVersion: 'organization.shared_watchlist_analyst_portal_workflow.v1',
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        sourceFamily: 'organization_watchlist',
        expectedAdapter: 'organizationSharedWatchlistAnalystPortalWorkflow',
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        queueContract: {
            route: 'GET /v1/dwm/alerts',
            requiredQueryFields: ['organizationId'],
            storageModule: 'ti/scraper/src/storage/dwmAlertRepository.ts',
            itemFields: ['alertId', 'organizationId', 'watchlistItemIds', 'severity', 'status', 'casePath', 'updatedAt', 'allowedActions'],
            state: input.alertReadAllowed ? 'ready' : 'blocked',
            blockerCodes: input.alertReadAllowed ? [] : ['role_not_allowed'],
        },
        detailContract: {
            route: 'GET /v1/dwm/alerts/:id',
            evidenceFields: ['capturedAt', 'source', 'watchlistItemIds', 'alertGeneratorKeys', 'casePath', 'workflowEvents', 'audit.eventBridge'],
            redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'case.evidence.rawContent', 'destination.secret'],
            containsRawTerms: false,
        },
        actionContracts: [
            {
                action: 'review_alert',
                route: 'GET /v1/dwm/alerts/:id',
                method: 'GET',
                requiredRoles: ['owner', 'admin', 'member'],
                allowed: input.alertReadAllowed,
                requiredPayloadFields: ['organizationId', 'alertId'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: input.alertReadAllowed ? [] : ['role_not_allowed'],
            },
            {
                action: 'acknowledge_alert',
                route: 'PATCH /v1/dwm/alerts/:id',
                method: 'PATCH',
                requiredRoles: ['owner', 'admin', 'member', 'analyst'],
                allowed: canAcknowledge,
                requiredPayloadFields: ['organizationId', 'alertId', 'rationale'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canAcknowledge ? [] : ['role_not_allowed'],
            },
            {
                action: 'assign_case',
                route: 'PATCH /v1/cases/:id',
                method: 'PATCH',
                requiredRoles: ['owner', 'admin', 'analyst'],
                allowed: canAssignCase,
                requiredPayloadFields: ['organizationId', 'caseId', 'assigneeId', 'rationale'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canAssignCase ? [] : Array.from(new Set(input.caseBlockers.length ? input.caseBlockers : ['role_not_allowed'])).sort(),
            },
            {
                action: 'link_case',
                route: 'POST /v1/cases',
                method: 'POST',
                requiredRoles: ['owner', 'admin', 'analyst'],
                allowed: canLinkCase,
                requiredPayloadFields: ['organizationId', 'alertId', 'watchlistItemIds', 'casePath'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canLinkCase ? [] : Array.from(new Set(input.caseBlockers.length ? input.caseBlockers : ['role_not_allowed'])).sort(),
            },
            {
                action: 'replay_alert',
                route: 'POST /v1/dwm/alerts/:id/replay',
                method: 'POST',
                requiredRoles: ['owner', 'admin'],
                allowed: canReplay,
                requiredPayloadFields: ['organizationId', 'alertId', 'watchlistItemIds'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canReplay ? [] : Array.from(new Set(input.alertBlockers.length ? input.alertBlockers : ['role_not_allowed'])).sort(),
            },
            {
                action: 'deliver_webhook',
                route: 'POST /v1/dwm/webhooks/deliver',
                method: 'POST',
                requiredRoles: ['owner', 'admin'],
                allowed: canDeliverWebhook,
                requiredPayloadFields: ['organizationId', 'alertId', 'destinationId', 'idempotencyKey'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canDeliverWebhook ? [] : Array.from(new Set(input.webhookBlockers.length ? input.webhookBlockers : ['manual_webhook_selection_required'])).sort(),
            },
            {
                action: 'open_audit_timeline',
                route: 'GET /api/admin/support/audit',
                method: 'GET',
                requiredRoles: ['owner', 'admin', 'support'],
                allowed: input.auditEventActions.includes('organization_watchlist_alert_terms_exported'),
                requiredPayloadFields: ['organizationId', 'requestId'],
                auditEventActions: eventActions,
                blockerCodes: input.auditEventActions.includes('organization_watchlist_alert_terms_exported') ? [] : ['missing_required_action'],
            },
        ],
        timelineContract: {
            route: 'GET /api/admin/support/audit',
            source: 'service_logs',
            requiredEventBridge: 'organization.shared_watchlist_audit_event_bridge.v1',
            eventActions,
            redactedFields: redactedTimelineFields,
        },
        roleGate: {
            actorRole: input.actorRole,
            readAlertsAllowed: input.alertReadAllowed,
            mutateAllowed: canAcknowledge || canReplay,
            caseActionsAllowed: canAssignCase || canLinkCase,
            webhookDeliveryAllowed: canDeliverWebhook,
        },
        blockerCodes: portalBlockers,
    }
}

function organizationSharedWatchlistEnrichmentProvenance(input: {
    organizationId: string
    activeWatchlistItemIds: string[]
    alertGeneratorKeys: string[]
    alertBlockers: string[]
}): OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance'] {
    const hasWatchlistScope = input.activeWatchlistItemIds.length > 0 && input.alertGeneratorKeys.length > 0
    const requiredFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[] = ['organization_watchlist']
    const optionalFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[] = ['darkweb_metadata', 'telegram_public', 'rss_news', 'public_ti']
    const activeFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[] = hasWatchlistScope ? ['organization_watchlist'] : []
    const blockerCodes: OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance']['blockerCodes'] = [
        ...(hasWatchlistScope ? [] : ['capture_provenance_missing' as const]),
        ...(input.alertBlockers.includes('no_active_terms') ? ['source_coverage_required' as const] : []),
    ]

    return {
        schemaVersion: 'organization.shared_watchlist_enrichment_provenance.v1',
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        sourceFamily: 'organization_watchlist',
        expectedAdapter: 'organizationSharedWatchlistEnrichmentProvenance',
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        sourceCoverage: {
            requiredFamilies,
            activeFamilies,
            optionalFamilies,
            sourceHealthRoute: 'GET /v1/dwm/sources/health',
            state: blockerCodes.length === 0 ? 'ready' : 'needs_source_coverage',
            blockerCodes,
        },
        sourceHealth: organizationSharedWatchlistSourceCoverageHealth({
            requiredFamilies,
            activeFamilies,
            optionalFamilies,
            blockerCodes,
        }),
        provenanceFields: {
            alert: ['provenance.captureIds', 'provenance.sourceIds', 'provenance.generatedAt', 'provenance.matchBasis', 'sourceFamily'],
            workflowContext: ['captureIds', 'selectedCaptureIds', 'sourceFamily', 'alertGeneratorKeys', 'watchlistTermContexts'],
            caseEvidence: ['evidence.provenance.captureIds', 'evidence.provenance.sourceIds', 'evidence.provenance.matchBasis', 'watchlistItemIds'],
            webhookPayload: ['captureIds', 'sourceFamily', 'casePath', 'watchlistItemIds', 'auditEventContracts'],
        },
        propagation: {
            alertRepository: 'ti/scraper/src/storage/dwmAlertRepository.ts',
            caseRoute: 'ti/scraper/src/api/caseRoutes.ts',
            webhookRoute: 'ti/scraper/src/api/dwmWorkflowRoutes.ts',
            requiredCorrelationFields: ['organizationId', 'tenantId', 'watchlistItemIds', 'alertGeneratorKeys', 'captureIds', 'sourceIds', 'casePath'],
        },
        redaction: {
            containsRawContent: false,
            safeFields: ['organizationId', 'tenantId', 'sourceFamily', 'captureIds', 'sourceIds', 'watchlistItemIds', 'casePath'],
            redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'evidence.rawContent', 'destination.secret'],
        },
        watchlistScope: {
            watchlistItemIds: input.activeWatchlistItemIds,
            alertGeneratorKeys: input.alertGeneratorKeys,
            crossTenantCollisionAllowed: false,
        },
        blockerCodes,
    }
}

function organizationSharedWatchlistSourceCoverageHealth(input: {
    requiredFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
    activeFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
    optionalFamilies: OrganizationSharedWatchlistProvenanceSourceFamily[]
    blockerCodes: OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance']['blockerCodes']
}): OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance']['sourceHealth'] {
    const requiredEvidenceFields: OrganizationSharedWatchlistDownstreamProof['enrichmentProvenance']['sourceHealth']['rows'][number]['requiredEvidenceFields'] = [
        'sourceFamily',
        'captureIds',
        'sourceIds',
        'capturedAt',
        'contentHash',
    ]
    const families = [...new Set([...input.requiredFamilies, ...input.optionalFamilies])]
    return {
        schemaVersion: 'organization.shared_watchlist_source_coverage_health.v1',
        expectedAdapter: 'organizationSharedWatchlistSourceCoverageHealth',
        route: 'GET /v1/dwm/sources/health',
        ownerLane: 'source_operations',
        state: input.blockerCodes.length === 0 ? 'ready' : 'needs_source_coverage',
        rows: families.map(sourceFamily => {
            const required = input.requiredFamilies.includes(sourceFamily)
            const active = input.activeFamilies.includes(sourceFamily)
            return {
                sourceFamily,
                required,
                active,
                status: active ? 'covered' : required ? 'missing' : 'optional',
                requiredEvidenceFields,
                blockerCodes: active || !required ? [] : input.blockerCodes,
            }
        }),
        redaction: {
            containsRawContent: false,
            safeFields: ['sourceFamily', 'active', 'status', 'captureIds', 'sourceIds', 'contentHash'],
            redactedFields: ['rawContent', 'activeTerms[].term', 'destination.secret'],
        },
        blockerCodes: input.blockerCodes,
    }
}

export function organizationSharedWatchlistIntegrationGuardrails(
    proof: OrganizationSharedWatchlistDownstreamProof
): OrganizationSharedWatchlistIntegrationGuardrails {
    const blockerCodes: OrganizationSharedWatchlistIntegrationGuardrailCode[] = []
    const requiredPayloadShape = [
        'alertBridge.persistenceContract.persistedAlertFields',
        'alertBridge.persistenceContract.workflowContextFields',
        'alertBridge.queueVisibilityContract.actorVisibility',
        'alertBridge.queueVisibilityContract.watchlistScope',
        'caseBridge.caseWorkflowContract.actorActions',
        'caseBridge.caseWorkflowContract.watchlistScope',
        'webhookBridge.deliveryContract.destinationSelection',
        'webhookBridge.deliveryContract.idempotency',
        'monitoringWorkflow',
        'analystPortalWorkflow',
        'enrichmentProvenance',
        'audit.eventActions',
        'audit.eventBridge',
        'audit.requiredMetadataFields',
    ]
    const watchlistIds = [...proof.watchlistOwnership.activeIds].sort()
    const persistenceWatchlistIds = [...proof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds].sort()
    const alertWatchlistIds = [...proof.alertBridge.queueVisibilityContract.watchlistScope.watchlistItemIds].sort()
    const caseWatchlistIds = [...proof.caseBridge.caseWorkflowContract.watchlistScope.watchlistItemIds].sort()
    const alertGeneratorKeys = [...proof.alertBridge.alertGeneratorKeys].sort()
    const persistenceContractKeys = [...proof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys].sort()
    const alertContractKeys = [...proof.alertBridge.queueVisibilityContract.watchlistScope.alertGeneratorKeys].sort()
    const caseContractKeys = [...proof.caseBridge.caseWorkflowContract.watchlistScope.alertGeneratorKeys].sort()
    const alertQueueVisibility = organizationSharedWatchlistAlertQueueVisibility(proof)
    const webhookSafety = organizationSharedWatchlistWebhookDeliveryGuardrails(proof)
    const caseSafety = organizationSharedWatchlistCaseWorkflowGuardrails(proof)

    if (proof.schemaVersion !== 'organization.shared_watchlist_downstream_proof.v1') blockerCodes.push('schema_mismatch')
    if (proof.audit.schemaVersion !== 'organization.shared_watchlist_audit_contract.v1') blockerCodes.push('schema_mismatch')
    if (proof.alertBridge.persistenceContract.schemaVersion !== 'organization.watchlist_alert_persistence_contract.v1') blockerCodes.push('alert_contract_missing')
    if (proof.alertBridge.queueVisibilityContract.schemaVersion !== 'organization.watchlist_alert_visibility_contract.v1') blockerCodes.push('alert_contract_missing')
    if (proof.caseBridge.caseWorkflowContract.schemaVersion !== 'organization.watchlist_case_workflow_contract.v1') blockerCodes.push('case_contract_missing')
    if (proof.webhookBridge.deliveryContract.schemaVersion !== 'organization.watchlist_webhook_delivery_contract.v1') blockerCodes.push('webhook_contract_missing')

    if (
        proof.ownerOrganizationId !== proof.organizationId
        || proof.tenantId !== proof.organizationId
        || proof.alertBridge.persistenceContract.organizationId !== proof.organizationId
        || proof.alertBridge.persistenceContract.tenantId !== proof.organizationId
        || proof.alertBridge.queueVisibilityContract.organizationId !== proof.organizationId
        || proof.alertBridge.queueVisibilityContract.tenantId !== proof.organizationId
        || proof.caseBridge.caseWorkflowContract.organizationId !== proof.organizationId
        || proof.caseBridge.caseWorkflowContract.tenantId !== proof.organizationId
        || proof.webhookBridge.deliveryContract.organizationId !== proof.organizationId
        || proof.webhookBridge.deliveryContract.tenantId !== proof.organizationId
        || proof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId !== proof.organizationId
    ) {
        blockerCodes.push('org_scope_mismatch')
    }

    if (
        !sameStringSet(watchlistIds, persistenceWatchlistIds)
        || !sameStringSet(watchlistIds, alertWatchlistIds)
        || !sameStringSet(watchlistIds, caseWatchlistIds)
        || !sameStringSet(alertGeneratorKeys, persistenceContractKeys)
        || !sameStringSet(alertGeneratorKeys, alertContractKeys)
        || !sameStringSet(alertGeneratorKeys, caseContractKeys)
    ) {
        blockerCodes.push('watchlist_scope_mismatch')
    }

    for (const field of requiredPayloadShape) {
        if (!proof.integration.payloadShape.includes(field)) blockerCodes.push('payload_shape_missing')
    }

    if (
        proof.integration.nonmemberEnumeration
        || proof.alertBridge.queueVisibilityContract.actorVisibility.nonmemberEnumeration
        || proof.webhookBridge.deliveryContract.destinationSelection.nonmemberDestinationEnumeration
    ) {
        blockerCodes.push('nonmember_enumeration_enabled')
    }
    if (proof.integration.containsRawTerms) blockerCodes.push('raw_terms_enabled')
    if (
        !proof.alertBridge.queueVisibilityContract.redactedFields.includes('activeTerms[].term')
        || !proof.caseBridge.caseWorkflowContract.redactedFields.includes('case.evidence.rawContent')
        || !proof.webhookBridge.deliveryContract.redactedFields.includes('destination.secret')
        || !alertQueueVisibility.denialGuardrails.ok
        || !webhookSafety.ok
        || !caseSafety.ok
    ) {
        blockerCodes.push('redaction_missing')
    }
    if (!alertQueueVisibility.denialGuardrails.ok) blockerCodes.push('denial_guardrail_missing')
    if (!webhookSafety.ok) blockerCodes.push('webhook_guardrail_missing')
    if (!caseSafety.ok) blockerCodes.push('case_guardrail_missing')
    if (
        proof.alertBridge.queueVisibilityContract.routes.list !== 'GET /v1/dwm/alerts'
        || proof.alertBridge.queueVisibilityContract.routes.replay !== 'POST /v1/dwm/alerts/:id/replay'
        || proof.caseBridge.caseWorkflowContract.routes.open !== 'POST /v1/cases'
        || proof.webhookBridge.route !== 'POST /v1/dwm/webhooks/deliver'
    ) {
        blockerCodes.push('route_missing')
    }

    const uniqueBlockers = [...new Set(blockerCodes)]
    return {
        schemaVersion: 'organization.shared_watchlist_integration_guardrails.v1',
        organizationId: proof.organizationId,
        tenantId: proof.tenantId,
        ok: uniqueBlockers.length === 0,
        checkedContracts: [
            'organization.shared_watchlist_downstream_proof.v1',
            'organization.watchlist_alert_persistence_contract.v1',
            'organization.watchlist_alert_visibility_contract.v1',
            'organization.watchlist_case_workflow_contract.v1',
            'organization.watchlist_webhook_delivery_contract.v1',
            'organization.shared_watchlist_audit_contract.v1',
        ],
        requiredPayloadShape,
        downstreamRoutes: {
            alertList: 'GET /v1/dwm/alerts',
            alertReplay: 'POST /v1/dwm/alerts/:id/replay',
            caseOpen: 'POST /v1/cases',
            webhookDeliver: 'POST /v1/dwm/webhooks/deliver',
        },
        orgScope: {
            ownerOrganizationId: proof.ownerOrganizationId,
            watchlistItemIds: watchlistIds,
            alertGeneratorKeys,
            alertContractOrgId: proof.alertBridge.persistenceContract.organizationId,
            caseContractOrgId: proof.caseBridge.caseWorkflowContract.organizationId,
            webhookContractOrgId: proof.webhookBridge.deliveryContract.organizationId,
        },
        safety: {
            nonmemberEnumeration: false,
            containsRawTerms: false,
            redactedFields: [
                ...new Set([
                    ...proof.alertBridge.queueVisibilityContract.redactedFields,
                    ...proof.caseBridge.caseWorkflowContract.redactedFields,
                    ...proof.webhookBridge.deliveryContract.redactedFields,
                ]),
            ].sort(),
        },
        denialSafety: {
            schemaVersion: alertQueueVisibility.denialGuardrails.schemaVersion,
            ok: alertQueueVisibility.denialGuardrails.ok,
            requiredNoLeakFields: alertQueueVisibility.denialGuardrails.requiredNoLeakFields,
            requiredResponseFields: alertQueueVisibility.denialGuardrails.requiredResponseFields,
            requiredAuditEvent: alertQueueVisibility.denialGuardrails.requiredAuditEvent,
            blockerCodes: alertQueueVisibility.denialGuardrails.blockerCodes,
        },
        webhookSafety,
        caseSafety,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        blockerCodes: uniqueBlockers,
    }
}

function sameStringSet(left: string[], right: string[]) {
    if (left.length !== right.length) return false
    return left.every((value, index) => value === right[index])
}

function organizationSharedWatchlistWebhookDeliveryGuardrails(
    proof: OrganizationSharedWatchlistDownstreamProof
): OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety'] {
    const delivery = proof.webhookBridge.deliveryContract
    const requiredIdempotencyFields: OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety']['requiredIdempotencyFields'] = [
        'eventType',
        'organizationId',
        'destinationId',
        'alert.dedupeKey',
    ]
    const requiredEvidenceFields: OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety']['requiredEvidenceFields'] = [
        'deliveryId',
        'destinationId',
        'attemptedAt',
        'status',
        'casePath',
        'watchlistItemIds',
        'auditEventContracts',
    ]
    const requiredRedactedFields: OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety']['requiredRedactedFields'] = [
        'destination.endpoint',
        'destination.secret',
        'activeTerms[].term',
    ]
    const blockerCodes: OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety']['blockerCodes'] = []

    if (!requiredIdempotencyFields.every(field => delivery.idempotency.keyFields.includes(field))) {
        blockerCodes.push('webhook_idempotency_missing')
    }
    if (!requiredEvidenceFields.every(field => delivery.evidenceFields.includes(field))) {
        blockerCodes.push('webhook_evidence_missing')
    }
    if (!requiredRedactedFields.every(field => delivery.redactedFields.includes(field))) {
        blockerCodes.push('webhook_redaction_missing')
    }
    if (delivery.organizationId !== proof.organizationId || delivery.destinationSelection.requiredDestinationOrgId !== proof.organizationId) {
        blockerCodes.push('webhook_org_scope_missing')
    }
    if (delivery.destinationSelection.nonmemberDestinationEnumeration) {
        blockerCodes.push('webhook_destination_enumeration_enabled')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_webhook_delivery_guardrails.v1',
        ok: blockerCodes.length === 0,
        requiredIdempotencyFields,
        requiredEvidenceFields,
        requiredRedactedFields,
        destinationEnumerationAllowed: false,
        requiredDestinationOrgId: delivery.destinationSelection.requiredDestinationOrgId,
        blockerCodes,
    }
}

function organizationSharedWatchlistCaseWorkflowGuardrails(
    proof: OrganizationSharedWatchlistDownstreamProof
): OrganizationSharedWatchlistIntegrationGuardrails['caseSafety'] {
    const workflow = proof.caseBridge.caseWorkflowContract
    const requiredCaseFields: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['requiredCaseFields'] = [
        'organizationId',
        'tenantId',
        'alertId',
        'casePath',
        'watchlistItemIds',
        'allowedActions',
        'visibilityDecision',
        'evidence.provenance',
    ]
    const requiredTimelineEvents: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['requiredTimelineEvents'] = [
        'case.opened',
        'case.linked_alert',
        'case.assigned',
        'case.status_changed',
        'case.note_added',
    ]
    const requiredEvidenceFields: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['requiredEvidenceFields'] = [
        'alertId',
        'watchlistItemIds',
        'alertGeneratorKeys',
        'matchedTerms',
        'source',
        'capturedAt',
        'casePath',
    ]
    const requiredRedactedFields: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['requiredRedactedFields'] = [
        'activeTerms[].term',
        'case.evidence.rawContent',
    ]
    const blockerCodes: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['blockerCodes'] = []

    if (workflow.organizationId !== proof.organizationId || workflow.tenantId !== proof.organizationId) {
        blockerCodes.push('case_org_scope_missing')
    }
    if (workflow.casePathTemplate !== '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId') {
        blockerCodes.push('case_path_missing')
    }
    if (!requiredCaseFields.every(field => workflow.requiredCaseFields.includes(field))) {
        blockerCodes.push('case_fields_missing')
    }
    if (!requiredTimelineEvents.every(event => workflow.timelineEventTypes.includes(event))) {
        blockerCodes.push('case_timeline_missing')
    }
    if (!requiredEvidenceFields.every(field => workflow.evidenceFields.includes(field))) {
        blockerCodes.push('case_evidence_missing')
    }
    if (!requiredRedactedFields.every(field => workflow.redactedFields.includes(field))) {
        blockerCodes.push('case_redaction_missing')
    }
    if (workflow.actorActions.canOpenCase && !workflow.actorActions.allowedActions.includes('link_case')) {
        blockerCodes.push('case_role_gate_missing')
    }
    if (workflow.actorActions.canAssignCase && !workflow.actorActions.allowedActions.includes('assign_case')) {
        blockerCodes.push('case_role_gate_missing')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_case_workflow_guardrails.v1',
        ok: blockerCodes.length === 0,
        requiredCaseFields,
        requiredTimelineEvents,
        requiredEvidenceFields,
        requiredRedactedFields,
        casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
        actorCanOpenCase: workflow.actorActions.canOpenCase,
        actorCanAssignCase: workflow.actorActions.canAssignCase,
        blockerCodes: [...new Set(blockerCodes)],
    }
}

export function organizationSharedWatchlistSupportInspection(input: {
    organizationId: string
    tenantId: string
    redactedSummary: OrganizationWatchlistAlertBridgeContract['redactedSummary']
    supportVisibility: OrganizationWatchlistAlertBridgeContract['supportVisibility']
    supportAccess: OrganizationWatchlistAlertBridgeContract['supportAccess']
    audit: OrganizationSharedWatchlistDownstreamProof['audit']
}): OrganizationSharedWatchlistSupportInspection {
    const safeFields = input.supportVisibility.safeFields
    const redactedFields = [
        ...new Set([
            ...input.supportVisibility.redactedFields,
            'sharedWatchlistDownstreamProof.activeTerms',
            'sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys',
        ]),
    ].sort()
    const auditFields = [
        ...input.audit.requiredMetadataFields,
        ...input.audit.actorFields,
    ].sort()
    const guardrails = organizationSharedWatchlistSupportGuardrails({
        safeFields,
        redactedFields,
        auditFields,
        canInspectRawTerms: false,
    })

    return {
        schemaVersion: 'organization.shared_watchlist_support_inspection.v1',
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        supportMode: 'redacted_summary_only',
        route: 'GET /api/admin/support/organizations/:id',
        supportActionContract: input.supportVisibility.contract,
        redactionRequired: true,
        canInspectRawTerms: false,
        containsRawTerms: false,
        summary: {
            activeTermCount: input.redactedSummary.activeTermCount,
            pausedCount: input.redactedSummary.pausedCount,
            archivedCount: input.redactedSummary.archivedCount,
            termFamilies: input.redactedSummary.termFamilies,
            visibilityPolicy: input.redactedSummary.visibilityPolicy,
            allowedViewerRoles: input.redactedSummary.allowedViewerRoles,
            cleanupRequired: input.redactedSummary.cleanupRequired,
        },
        safeFields,
        redactedFields,
        auditFields,
        downstreamCorrelationFields: input.audit.downstreamCorrelationFields,
        blockerCodes: ['support_redaction_required', input.supportAccess.blockerCode],
        guardrails,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
}

function organizationSharedWatchlistSupportGuardrails(input: {
    safeFields: string[]
    redactedFields: string[]
    auditFields: string[]
    canInspectRawTerms: boolean
}): OrganizationSharedWatchlistSupportInspection['guardrails'] {
    const requiredSafeFields: OrganizationSharedWatchlistSupportInspection['guardrails']['requiredSafeFields'] = [
        'activeTermCount',
        'termFamilies',
        'visibilityPolicy',
        'allowedViewerRoles',
    ]
    const requiredRedactedFields: OrganizationSharedWatchlistSupportInspection['guardrails']['requiredRedactedFields'] = [
        'activeTerms[].term',
        'member.userId',
        'sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys',
    ]
    const requiredAuditFields: OrganizationSharedWatchlistSupportInspection['guardrails']['requiredAuditFields'] = [
        'requestId',
        'actor.role',
    ]
    const blockerCodes: OrganizationSharedWatchlistSupportInspection['guardrails']['blockerCodes'] = []

    if (!requiredSafeFields.every(field => input.safeFields.includes(field))) {
        blockerCodes.push('support_safe_fields_missing')
    }
    if (!requiredRedactedFields.every(field => input.redactedFields.includes(field))) {
        blockerCodes.push('support_redaction_missing')
    }
    if (!requiredAuditFields.every(field => input.auditFields.includes(field))) {
        blockerCodes.push('support_audit_missing')
    }
    if (input.canInspectRawTerms) {
        blockerCodes.push('support_raw_access_enabled')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_support_guardrails.v1',
        ok: blockerCodes.length === 0,
        requiredSafeFields,
        requiredRedactedFields,
        requiredAuditFields,
        rawTermAccessAllowed: false,
        blockerCodes,
    }
}

export function organizationSharedWatchlistAlertQueueVisibility(
    proof: OrganizationSharedWatchlistDownstreamProof
): OrganizationSharedWatchlistAlertQueueVisibility {
    const queue = proof.alertBridge.queueVisibilityContract
    const persistence = proof.alertBridge.persistenceContract
    const roleContract = organizationAlertCaseRoleActionContract({
        userId: proof.actor.userId,
        role: proof.actor.role,
    })
    const denialResponseContract: OrganizationSharedWatchlistAlertQueueVisibility['denialResponseContract'] = {
        appliesWhen: 'visibility.allowed_false',
        blocked: !queue.actorVisibility.allowed,
        statusCode: 403,
        errorCode: 'org_alert_visibility_denied',
        reason: queue.actorVisibility.denialReason,
        responseShape: [
            'error',
            'message',
            'organizationId',
            'visibilityDecision',
            'allowedRoles',
            'requestId',
        ],
        safeFields: [
            'organizationId',
            'tenantId',
            'visibility.policy',
            'visibility.denialReason',
            'visibility.allowedRoles',
            'blockerCodes',
        ],
        noLeakFields: [
            'activeTerms',
            'watchlistScope.alertGeneratorKeys',
            'persistedAlertContract',
            'member.userId',
        ],
        auditEventAction: 'organization_watchlist_alert_visibility_denied',
    }
    return {
        schemaVersion: 'organization.shared_watchlist_alert_queue_visibility.v1',
        organizationId: proof.organizationId,
        tenantId: proof.tenantId,
        sourceFamily: 'organization_watchlist',
        routes: queue.routes,
        requiredQueryFields: queue.requiredQueryFields,
        member: {
            userId: proof.actor.userId,
            role: proof.actor.role,
            status: proof.actor.status,
        },
        visibility: {
            policy: queue.actorVisibility.policy,
            allowed: queue.actorVisibility.allowed,
            denialReason: queue.actorVisibility.denialReason,
            allowedRoles: queue.actorVisibility.allowedRoles,
            nonmemberEnumeration: false,
        },
        denialResponseContract,
        denialGuardrails: organizationSharedWatchlistAlertDenialGuardrails(denialResponseContract),
        allowedActions: proof.actor.allowedActions,
        actionGates: queue.actionGates,
        roleActionMatrix: {
            schemaVersion: 'organization.shared_watchlist_alert_role_matrix.v1',
            actorRole: proof.actor.role,
            allowedActions: roleContract.actor.allowedActions,
            roleGates: roleContract.roleGates,
            allowedActionsByRole: {
                owner: organizationAlertCaseRoleActions('owner'),
                admin: organizationAlertCaseRoleActions('admin'),
                analyst: organizationAlertCaseRoleActions('analyst'),
                member: organizationAlertCaseRoleActions('member'),
                viewer: organizationAlertCaseRoleActions('viewer'),
                support: organizationAlertCaseRoleActions('support'),
                nonmember: organizationAlertCaseRoleActions('nonmember'),
            },
            downstreamConsumers: ['alert_queue', 'case_workflow', 'webhook_delivery', 'support_redacted_read'],
            deniedRoles: ['viewer', 'support', 'nonmember'],
            denialReason: 'role_not_allowed',
        },
        watchlistScope: {
            ownerOrganizationId: proof.ownerOrganizationId,
            watchlistItemIds: queue.watchlistScope.watchlistItemIds,
            alertGeneratorKeys: queue.watchlistScope.alertGeneratorKeys,
            alertGeneratorKeyField: queue.watchlistScope.alertGeneratorKeyField,
            visibilityDecisionField: persistence.visibilityDecisionField,
            dedupeScope: queue.watchlistScope.dedupeScope,
            crossTenantCollisionAllowed: persistence.dedupe.crossTenantCollisionAllowed,
        },
        tenantIsolation: {
            schemaVersion: 'organization.shared_watchlist_alert_tenant_isolation.v1',
            partitionKey: 'organizationId',
            tenantIdField: 'tenantId',
            requiredAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.organizationId',
                'workflowContext.alertGeneratorKeys',
                'dedupeKey',
            ],
            dedupeKeyFields: persistence.dedupe.keyFields,
            watchlistItemScope: 'organization_owned',
            crossTenantCollisionAllowed: persistence.dedupe.crossTenantCollisionAllowed,
            nonmemberEnumeration: queue.actorVisibility.nonmemberEnumeration,
            lifecycleBlockers: persistence.lifecycleBlockers,
            proofAssertions: [
                'two_org_overlapping_terms',
                'distinct_alert_generator_keys',
                'org_scoped_watchlist_ids',
                'visibility_query_requires_organization_id',
            ],
        },
        lifecycleExclusions: {
            excludedStatuses: ['paused', 'archived'],
            pausedWatchlistIds: proof.watchlistOwnership.pausedIds,
            archivedWatchlistIds: proof.watchlistOwnership.archivedIds,
            blockerCodes: ['watchlist_paused', 'watchlist_archived'],
        },
        persistedAlertContract: {
            storageModule: persistence.storageModule,
            requiredFields: persistence.requiredInputFields,
            workflowContextFields: persistence.workflowContextFields,
            persistedAlertFields: persistence.persistedAlertFields,
            casePathField: persistence.casePathField,
        },
        consumerContract: {
            ownerLane: 'dwm_alert_workflow',
            expectedAdapter: 'organizationSharedWatchlistAlertQueueVisibility',
            payloadShape: [
                'organizationId',
                'tenantId',
                'routes.list',
                'routes.detail',
                'requiredQueryFields',
                'visibility',
                'allowedActions',
                'actionGates',
                'roleActionMatrix',
                'watchlistScope.watchlistItemIds',
                'watchlistScope.alertGeneratorKeys',
                'watchlistScope.visibilityDecisionField',
                'persistedAlertContract.workflowContextFields',
                'persistedAlertContract.persistedAlertFields',
                'blockerCodes',
            ],
            requiredRouteBinding: 'organizationId_query_and_workflow_context',
            requiredStorageBinding: 'workflowContext.organizationId',
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        auditContract: {
            source: proof.audit.source,
            requiredEventActions: [
                'organization_watchlist_alert_terms_exported',
                'organization_watchlist_upserted',
                'organization_watchlist_updated',
            ],
            requiredMetadataFields: proof.audit.requiredMetadataFields,
            requestIdFields: proof.audit.requestIdFields,
            downstreamCorrelationFields: proof.audit.downstreamCorrelationFields,
            proofLogQuery: proof.audit.proofLogQuery,
        },
        support: {
            mode: 'redacted_summary_only',
            redactionRequired: true,
            supportOnlyBlocker: 'support_only_access',
        },
        safeFields: [
            'organizationId',
            'tenantId',
            'member.role',
            'visibility.allowed',
            'allowedActions',
            'actionGates',
            'roleActionMatrix.actorRole',
            'roleActionMatrix.allowedActions',
            'roleActionMatrix.roleGates',
            'watchlistScope.watchlistItemIds',
            'watchlistScope.alertGeneratorKeys',
            'lifecycleExclusions',
            'blockerCodes',
        ],
        redactedFields: queue.redactedFields,
        blockerCodes: queue.blockerCodes,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
}

function organizationSharedWatchlistAlertDenialGuardrails(
    denial: OrganizationSharedWatchlistAlertQueueVisibility['denialResponseContract']
): OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails'] {
    const requiredNoLeakFields: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['requiredNoLeakFields'] = [
        'activeTerms',
        'watchlistScope.alertGeneratorKeys',
        'persistedAlertContract',
        'member.userId',
    ]
    const requiredResponseFields: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['requiredResponseFields'] = [
        'error',
        'message',
        'organizationId',
        'visibilityDecision',
        'allowedRoles',
        'requestId',
    ]
    const blockerCodes: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['blockerCodes'] = []

    if (denial.statusCode !== 403 || denial.errorCode !== 'org_alert_visibility_denied') {
        blockerCodes.push('denial_status_missing')
    }
    if (!requiredResponseFields.every(field => denial.responseShape.includes(field))) {
        blockerCodes.push('denial_shape_missing')
    }
    if (!requiredNoLeakFields.every(field => denial.noLeakFields.includes(field))) {
        blockerCodes.push('denial_no_leak_missing')
    }
    if (denial.auditEventAction !== 'organization_watchlist_alert_visibility_denied') {
        blockerCodes.push('denial_audit_missing')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_alert_denial_guardrails.v1',
        ok: blockerCodes.length === 0,
        checkedFields: [
            'denialResponseContract.statusCode',
            'denialResponseContract.errorCode',
            'denialResponseContract.responseShape',
            'denialResponseContract.noLeakFields',
            'denialResponseContract.auditEventAction',
        ],
        requiredNoLeakFields,
        requiredResponseFields,
        requiredAuditEvent: 'organization_watchlist_alert_visibility_denied',
        blockerCodes,
    }
}

export function organizationWatchlistAlertTermsExportDenial(input: {
    organizationId: string
    tenantId?: string | null
    member: {
        userId: string
        role: OrganizationRole
    }
    visibility: OrganizationVisibilityDecision
    requestId?: string | null
}): OrganizationWatchlistAlertTermsExportDenial {
    const redactedFields: OrganizationWatchlistAlertTermsExportDenial['redactedFields'] = [
        'activeTerms[]',
        'activeWatchlistTerms[]',
        'alertGeneratorKeys[]',
        'watchlistScope.alertGeneratorKeys',
    ]
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export_denial.v1',
        organizationId: input.organizationId,
        tenantId: input.tenantId ?? input.organizationId,
        member: {
            userId: input.member.userId,
            role: input.member.role,
            status: 'active',
        },
        visibility: input.visibility,
        allowedActions: organizationAlertCaseRoleActions(input.member.role),
        routes: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            listWatchlists: 'GET /api/organizations/:id/watchlists',
        },
        safeFields: [
            'organizationId',
            'tenantId',
            'member.role',
            'visibility.alertVisibilityPolicy',
            'visibility.allowedRoles',
            'visibility.reason',
            'allowedActions',
            'routes',
            'blockerCodes',
        ],
        redactedFields,
        blockerCodes: [input.visibility.reason ?? 'alert_export_unavailable'],
        nonmemberEnumeration: false,
        alertGenerationConsumerDenial: {
            schemaVersion: 'organization.watchlist_alert_generation_consumer_denial.v1',
            organizationId: input.organizationId,
            tenantId: input.tenantId ?? input.organizationId,
            repositoryAdapter: 'organizationWatchlistAlertTermsExport',
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            member: {
                role: input.member.role,
                status: 'active',
            },
            canReadSharedWatchlists: true,
            canExportAlertTerms: false,
            canMutateWatchlists: roleCanWriteWatchlist(input.member.role),
            allowedExportRoles: input.visibility.allowedRoles,
            readSharedWatchlistRoles: ['owner', 'admin', 'member', 'viewer'],
            mutateWatchlistRoles: ['owner', 'admin'],
            denialReason: input.visibility.reason ?? 'alert_export_unavailable',
            safeFields: [
                'organizationId',
                'tenantId',
                'member.role',
                'allowedExportRoles',
                'denialReason',
                'requestId',
            ],
            noLeakFields: [
                'activeTerms[]',
                'activeWatchlistTerms[]',
                'alertGeneratorKeys[]',
                'watchlistScope.alertGeneratorKeys',
                'otherOrg.watchlistItemIds',
            ],
            nonmemberEnumeration: false,
            removedMemberDenied: 'member_revoked',
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        auditProof: {
            schemaVersion: 'organization.watchlist_alert_terms_denial_audit.v1',
            serviceLogAction: 'organization_watchlist_alert_terms_export_denied',
            requestId: input.requestId ?? null,
            requiredMetadataFields: [
                'requestId',
                'role',
                'alertVisibilityPolicy',
                'allowedRoles',
                'denialReason',
                'blockerCodes',
            ],
            redactedFields,
            proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist_alert_terms_export_denied',
        },
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
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

    const lifecycleBlockerCode = lifecycleStatus === 'archived'
        ? 'org_archived'
        : lifecycleStatus === 'deleted'
            ? 'org_deleted'
            : null
    const lifecycleAllowsDownstream = lifecycleBlockerCode === null
    const actorCanManageOrganization = roleCanManageOrganization(actorRole)

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
        downstreamLifecycleReceipt: {
            schemaVersion: 'organization.lifecycle_downstream_receipt.v1',
            organizationId: row.id,
            tenantId: row.id,
            lifecycleStatus,
            blockerCode: lifecycleBlockerCode,
            activeMembershipRequired: true,
            inviteMutationAllowed: lifecycleAllowsDownstream,
            watchlistMutationAllowed: lifecycleAllowsDownstream,
            alertExportAllowed: lifecycleAllowsDownstream && sharedWatchlistCount > 0 && activeAdminCount > 0,
            caseVisibilityAllowed: lifecycleAllowsDownstream,
            webhookDeliveryAllowed: lifecycleAllowsDownstream,
            supportRedactedReadAllowed: true,
            blockedRoutes: lifecycleAllowsDownstream ? [] : [
                'POST /api/organizations/:id/invites',
                'POST /api/organizations/:id/watchlists',
                'GET /api/organizations/:id/watchlists/alert-terms',
                'GET /api/organizations/:id/alert-readiness',
                'GET /api/organizations/:id/alert-case-visibility',
                'POST /v1/dwm/webhooks/deliver',
            ],
            downstreamRefs: {
                alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1',
                alertGenerationFixture: 'organization.watchlist_alert_generation_fixture.v1',
                caseVisibilityConsumer: 'organization.case_visibility_consumer.v1',
                webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1',
            },
            noLeakFields: [
                'activeTerms[]',
                'watchlistScope.alertGeneratorKeys',
                'destination.secret',
                'case.evidence.rawContent',
            ],
        },
        workspaceBoundaryProof: {
            schemaVersion: 'organization.workspace_boundary_readiness.v1',
            organizationId: row.id,
            tenantId: row.id,
            lifecycleStatus,
            actorRole,
            routes: {
                createOrganization: 'POST /api/organizations',
                readOrganization: 'GET /api/organizations/:id',
                readSettings: 'GET /api/organizations/:id/settings',
                updateSettings: 'PUT /api/organizations/:id/settings',
                listMembers: 'GET /api/organizations/:id/members',
                listInvites: 'GET /api/organizations/:id/invites',
                listWatchlists: 'GET /api/organizations/:id/watchlists',
                alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            },
            roleGates: {
                readOrganization: ['owner', 'admin', 'member', 'viewer'],
                updateSettings: ['owner', 'admin'],
                archiveOrganization: ['owner', 'admin'],
                deleteOrganization: ['owner', 'admin'],
                manageInvites: ['owner', 'admin'],
                mutateWatchlists: ['owner', 'admin'],
                readSharedWatchlists: ['owner', 'admin', 'member', 'viewer'],
            },
            actorPermissions: {
                canReadOrganization: true,
                canUpdateSettings: actorCanManageOrganization && lifecycleAllowsDownstream,
                canArchiveOrganization: actorCanManageOrganization && lifecycleAllowsDownstream,
                canDeleteOrganization: actorCanManageOrganization && lifecycleAllowsDownstream,
                canManageInvites: actorCanManageOrganization && lifecycleAllowsDownstream,
                canMutateWatchlists: actorCanManageOrganization && lifecycleAllowsDownstream,
                canReadSharedWatchlists: true,
                canReadAlertReadiness: true,
            },
            supportInspection: {
                mode: 'redacted_summary_only',
                contract: 'admin_support',
                route: '/api/admin/support/organizations/:id',
            },
            lifecycleMutationAllowed: lifecycleAllowsDownstream,
            blockedWhenInactive: lifecycleAllowsDownstream ? [] : [
                'PUT /api/organizations/:id/settings',
                'POST /api/organizations/:id/invites',
                'POST /api/organizations/:id/watchlists',
                'POST /api/organizations/:id/watchlists/:itemId/actions',
                'POST /api/organizations/:id/ownership-transfer',
            ],
            blockerCode: lifecycleBlockerCode,
            nonmemberEnumeration: false,
            noLeakFields: [
                'otherOrg.members',
                'otherOrg.invites',
                'otherOrg.watchlistItemIds',
                'destination.secret',
            ],
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
            'downstreamLifecycleReceipt',
            'workspaceBoundaryProof',
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
    const webhookBlockerCodes = [
        ...input.downstreamAuthorization.downstream.alertGeneration.blockerCodes,
        input.downstreamAuthorization.downstream.webhook.denialReason,
        input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations ? undefined : 'manual_webhook_selection_required',
    ].filter(Boolean).map(String)
    const webhookSelectedDestinationSource = input.downstreamAuthorization.downstream.webhook.defaultPolicy === 'active_destinations'
        && input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations
        ? 'org_active_destinations'
        : input.downstreamAuthorization.downstream.webhook.defaultPolicy === 'disabled'
            ? 'webhook_policy_disabled'
            : 'manual_selection_required'
    const acceptedOrInvitedCount = input.lifecycleReadiness.counts.activeMemberCount + input.lifecycleReadiness.counts.pendingInviteCount
    const tenMemberWorkspaceBlockers = Array.from(new Set([
        acceptedOrInvitedCount >= 10 ? undefined : 'needs_10_active_members_or_pending_invites',
        input.lifecycleReadiness.counts.sharedWatchlistCount > 0 ? undefined : 'needs_shared_watchlist_item',
        input.alertGenerationBridge.activeWatchlistTerms.length > 0 ? undefined : 'no_active_terms',
        input.lifecycleReadiness.lifecycleStatus === 'archived' ? 'org_archived' : undefined,
        input.lifecycleReadiness.lifecycleStatus === 'deleted' ? 'org_deleted' : undefined,
        input.downstreamAuthorization.member.status === 'active' ? undefined : 'member_revoked',
    ].filter(Boolean) as Array<'needs_10_active_members_or_pending_invites' | 'needs_shared_watchlist_item' | 'no_active_terms' | 'org_archived' | 'org_deleted' | 'member_revoked'>))
    const actorCaseActions = organizationAlertCaseRoleActions(input.downstreamAuthorization.member.role)
    const canAssignCase = actorCaseActions.includes('assign_case')
    const caseAssignmentBlockerCodes = Array.from(new Set([
        ...input.lifecycleReadiness.typedBlockers,
        ...input.alertGenerationBridge.blockedReasons,
        ...input.downstreamAuthorization.downstream.alertGeneration.blockerCodes,
        canAssignCase ? undefined : 'role_not_allowed',
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
        caseAssignmentProof: {
            schemaVersion: 'organization.case_assignment_readiness.v1',
            sourceContracts: [
                'organization.case_visibility_consumer.v1',
                'organization.alert_case_bridge_persistence_receipt.v1',
                'organization.shared_watchlist_alert_queue_visibility.v1',
            ],
            route: 'POST /v1/cases/:caseId/assignment',
            organizationId: input.downstreamAuthorization.organizationId,
            tenantId: input.downstreamAuthorization.tenantId,
            actor: {
                role: input.downstreamAuthorization.member.role,
                canAssignCase,
                allowedActions: actorCaseActions,
            },
            roleGates: {
                assignCase: ['owner', 'admin', 'analyst'],
                linkCase: ['owner', 'admin', 'analyst'],
                acknowledgeAlert: ['owner', 'admin', 'analyst', 'member'],
                memberReadOnly: true,
                viewerReadOnly: true,
            },
            requiredCaseFields: [
                'organizationId',
                'tenantId',
                'caseId',
                'assigneeId',
                'watchlistItemIds',
                'alertGeneratorKeys',
                'visibilityDecision',
                'assignmentAudit.requestId',
            ],
            requiredAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.allowedActions',
            ],
            visibilityInputs: [
                'member.role',
                'member.status',
                'organization.lifecycleStatus',
                'watchlist.status',
                'alertVisibilityPolicy',
            ],
            lifecycleBlockers: [
                'org_archived',
                'org_deleted',
                'member_revoked',
                'watchlist_paused',
                'watchlist_archived',
                'role_not_allowed',
            ],
            blockerCodes: caseAssignmentBlockerCodes,
            nonmemberEnumeration: false,
            crossOrgCaseAssignmentAllowed: false,
            noLeakFields: [
                'otherOrg.caseIds',
                'otherOrg.alertGeneratorKeys',
                'case.evidence.rawContent',
            ],
            proofAssertions: [
                'case_org_matches_alert_org',
                'assignee_membership_is_active',
                'member_cannot_assign_case',
                'nonmember_cannot_enumerate_cases',
            ],
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
            blockerCodes: webhookBlockerCodes,
            webhookDestinationReadinessBridge: {
                schemaVersion: 'organization.webhook_destination_readiness_bridge.v1',
                deliveryContractSchema: 'dwm.webhook.org_alert_delivery.v1',
                sourceContract: 'organization.watchlist_webhook_delivery_contract.v1',
                route: 'POST /v1/dwm/webhooks/deliver',
                defaultWebhookPolicy: input.downstreamAuthorization.downstream.webhook.defaultPolicy,
                canUseDefaultDestinations: input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
                selectedDestinationSource: webhookSelectedDestinationSource,
                requiredDestinationOrgId: input.downstreamAuthorization.organizationId,
                selectedDestinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                ownerAdminManualTriggerRequired: true,
                memberManualTriggerAllowed: false,
                requiredAlertFields: [
                    'alert.id',
                    'alert.organizationId',
                    'alert.tenantId',
                    'alert.watchlistItemIds',
                    'alert.workflowContext.alertGenerationRefs',
                    'alert.workflowContext.alertGeneratorKeys',
                ],
                expectedDeliveryFields: [
                    'organizationId',
                    'tenantId',
                    'destinationId',
                    'eventType',
                    'payload.alert.id',
                    'payload.alert.organizationId',
                    'payload.watchlist.watchlistItemIds',
                    'delivery.idempotencyKey',
                ],
                skippedDestinationReasons: [
                    'org_mismatch',
                    'destination_disabled',
                    'event_not_subscribed',
                    'manual_selection_required',
                    'webhook_policy_disabled',
                ],
                lifecycleBlockers: [
                    'org_archived',
                    'org_deleted',
                    'watchlist_paused',
                    'watchlist_archived',
                    'member_revoked',
                    'nonmember_denied',
                ],
                blockerCodes: webhookBlockerCodes,
                nonmemberDestinationEnumeration: false,
            },
        },
        destinationOwnershipProof: {
            schemaVersion: 'organization.webhook_destination_ownership_readiness.v1',
            sourceContracts: [
                'organization.webhook_destination_ownership.v1',
                'organization.webhook_destination_access_decision.v1',
                'organization.webhook_destination_readiness_bridge.v1',
            ],
            route: 'POST /v1/dwm/webhooks/deliver',
            organizationId: input.downstreamAuthorization.organizationId,
            tenantId: input.downstreamAuthorization.tenantId,
            defaultWebhookPolicy: input.downstreamAuthorization.downstream.webhook.defaultPolicy,
            requiredDestinationOrgId: input.downstreamAuthorization.organizationId,
            requiredDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            selectedDestinationSource: webhookSelectedDestinationSource,
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: false,
            ownerAdminConfigureAllowed: input.downstreamAuthorization.member.role === 'owner' || input.downstreamAuthorization.member.role === 'admin',
            memberConfigureAllowed: false,
            manualTriggerAllowedRoles: ['owner', 'admin'],
            automaticDeliveryAllowed: input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
            supportInspection: {
                route: '/api/admin/support/organizations/:id',
                mode: 'redacted_destination_summary',
                requiredSupportContract: 'admin_support',
                endpointRedacted: true,
                secretRedacted: true,
            },
            lifecycleBlockers: [
                'org_archived',
                'org_deleted',
                'member_revoked',
                'manual_webhook_selection_required',
            ],
            blockerCodes: webhookBlockerCodes,
            noLeakFields: [
                'destination.secret',
                'destination.endpoint',
                'otherOrg.destinationIds',
            ],
            proofAssertions: [
                'destination_org_matches_alert_org',
                'nonmember_cannot_enumerate_destinations',
                'member_cannot_configure_destination',
                'support_reads_redacted_destination_summary',
            ],
        },
        memberLifecycleProof: {
            schemaVersion: 'organization.member_lifecycle_visibility_proof.v1',
            activeMembershipRequired: true,
            actorStatus: input.downstreamAuthorization.member.status,
            actorRole: input.downstreamAuthorization.member.role,
            visibilityInputs: ['role', 'status', 'userActive', 'alertVisibilityPolicy'],
            denialReasons: {
                nonmember: 'not_member',
                removedMember: 'member_removed',
                deactivatedMember: 'member_deactivated',
                expiredInvite: 'invite_expired',
                roleNotAllowed: 'role_not_allowed',
            },
            protectedRoutes: [
                'GET /api/organizations/:id',
                'GET /api/organizations/:id/watchlists',
                'GET /api/organizations/:id/alert-readiness',
                'GET /api/organizations/:id/watchlists/alert-terms',
                'GET /api/organizations/:id/alert-case-visibility',
                'POST|PUT|DELETE /api/organizations/:id/watchlists',
                'POST /v1/dwm/webhooks/deliver',
            ],
            noLeakFields: [
                'activeTerms[]',
                'watchlistScope.alertGeneratorKeys',
                'member.userId',
                'destination.secret',
            ],
            auditActions: [
                'organization_watchlist_alert_terms_export_denied',
                'organization_member_removed',
                'organization_invite_revoked',
            ],
            memberRemovalCleanup: {
                responseSchema: 'organization.member_removal_cleanup.v1',
                revokesPendingInvites: true,
                cleanupField: 'memberRemovalCleanup.revokedInviteIds',
                staleInviteAcceptanceBlocker: 'member_revoked',
                serviceLogAction: 'organization_member_removed',
            },
            memberAccessRecovery: {
                responseSchema: 'organization.member_consumer_access_recovery.v1',
                automaticRegrantAllowed: false,
                blockerCode: 'member_revoked',
                ownerlessRecoveryMutationAllowed: false,
                directMembershipMutationAllowed: false,
                requiresOwnerAdminReview: true,
                requiresAcceptedInvite: true,
                recoveryActorRoles: ['owner', 'admin'],
                recoveryReceipts: [
                    'organization.invite_consumer_visibility_receipt.v1',
                    'organization.member_role_consumer_visibility_receipt.v1',
                ],
                recoveryRoutes: {
                    createInvite: 'POST /api/organizations/:id/invites',
                    acceptInvite: 'POST /api/organizations/invites/:inviteId/accept',
                    memberList: 'GET /api/organizations/:id/members',
                },
                blockedUntilAcceptedMembership: [
                    'GET /api/organizations/:id/watchlists',
                    'GET /api/organizations/:id/watchlists/alert-terms',
                    'GET /api/organizations/:id/alert-case-visibility',
                    'GET /api/organizations/:id/alert-readiness',
                ],
                supportActionHistoryBridge: {
                    schemaVersion: 'organization.member_recovery_support_history_bridge.v1',
                    source: 'support_audit_timeline',
                    supportReceiptSchemas: [
                        'support.access_recovery.execution_receipt.v1',
                        'support.access_recovery.decision_receipt.v1',
                        'support.action_execute.member_role_recovery.v1',
                    ],
                    expectedSupportActions: [
                        'support.organization.access_recovery',
                        'support.organization.access_recovery.approve',
                        'support.organization.access_recovery.deny',
                        'support.organization.member_role_recovery',
                    ],
                    replayFilters: {
                        organizationId: 'org',
                        targetUserId: 'target',
                        requestId: 'request',
                        action: 'action',
                    },
                    supportRoutes: {
                        inspect: '/api/admin/support/inspect',
                        accessRecovery: '/api/admin/support/access-recovery/:requestId',
                        organization: '/api/admin/support/organizations/:id',
                        memberRoleRecovery: '/api/admin/support/organizations/:id/members/:userId/role-recovery',
                    },
                    requiredAuditFields: ['organizationId', 'targetUserId', 'requestId', 'supportSessionId', 'reason', 'outcome'],
                    noSilentMembershipMutation: true,
                    nonmemberEnumeration: false,
                },
                supportAssistedRecoveryReceipt: {
                    schemaVersion: 'organization.member_support_assisted_recovery_receipt.v1',
                    supportActionHistoryBridge: 'organization.member_recovery_support_history_bridge.v1',
                    allowedOutcome: 'invite_required',
                    directMembershipMutationAllowed: false,
                    ownerlessRecoveryMutationAllowed: false,
                    requiresAcceptedInvite: true,
                    requiredAuditFields: ['organizationId', 'targetUserId', 'requestId', 'supportSessionId', 'reason', 'outcome'],
                    blockedRoutesUntilAcceptedMembership: [
                        'GET /api/organizations/:id/watchlists',
                        'GET /api/organizations/:id/watchlists/alert-terms',
                        'GET /api/organizations/:id/alert-case-visibility',
                        'POST /v1/dwm/webhooks/deliver',
                    ],
                    nonmemberEnumeration: false,
                },
            },
            nonmemberEnumeration: false,
        },
        inviteLifecycleProof: {
            schemaVersion: 'organization.invite_lifecycle_readiness_proof.v1',
            pendingInviteCount: input.lifecycleReadiness.counts.pendingInviteCount,
            inviteTenSupported: input.lifecycleReadiness.counts.pendingInviteCount + input.lifecycleReadiness.counts.activeMemberCount >= 10,
            maxRecipientsPerRequest: 25,
            duplicateRecipientHandling: 'dedupe_case_insensitive',
            defaultExpiryDays: 14,
            acceptanceTokenField: 'invite.acceptanceToken',
            acceptanceRoute: 'POST /api/organizations/invites/:inviteId/accept',
            inviteRoute: 'POST /api/organizations/:id/invites',
            actionRoute: 'POST /api/organizations/:id/invites/:inviteId/actions',
            supportedActions: ['revoke', 'resend'],
            idempotentActions: ['revoke', 'resend'],
            duplicateInviteOutcome: 'updated_pending_invite',
            blockedOutcomes: ['already_member', 'blocked_removed_member', 'blocked_deactivated_user'],
            lifecycleBlockers: ['invite_expired', 'member_revoked', 'org_archived', 'org_deleted'],
            auditActions: [
                'organization_invites_created',
                'organization_invite_accepted',
                'organization_invite_revoked',
                'organization_invite_resent',
            ],
            requiredMetadataFields: [
                'requestId',
                'role',
                'recipientCount',
                'submittedRecipientCount',
                'duplicateRecipientCount',
                'invitedCount',
                'skippedCount',
                'inviteId',
                'action',
                'previousStatus',
                'newStatus',
            ],
            nonmemberEnumeration: false,
        },
        tenMemberWorkspaceProof: {
            schemaVersion: 'organization.ten_member_workspace_proof.v1',
            targetMemberCount: 10,
            activeMemberCount: input.lifecycleReadiness.counts.activeMemberCount,
            pendingInviteCount: input.lifecycleReadiness.counts.pendingInviteCount,
            acceptedOrInvitedCount,
            sharedWatchlistCount: input.lifecycleReadiness.counts.sharedWatchlistCount,
            activeWatchlistTermCount: input.alertGenerationBridge.activeWatchlistTerms.length,
            canSupportTenMemberSharedWatchlistRollout: tenMemberWorkspaceBlockers.length === 0,
            readinessRefs: {
                inviteLifecycle: 'organization.invite_lifecycle_readiness_proof.v1',
                sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1',
                alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1',
                alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1',
                webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1',
            },
            routeRefs: {
                bulkInvite: 'POST /api/organizations/:id/invites',
                listMembers: 'GET /api/organizations/:id/members',
                createWatchlist: 'POST /api/organizations/:id/watchlists',
                alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
                alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
                webhookDeliver: 'POST /v1/dwm/webhooks/deliver',
            },
            lifecycleBlockers: tenMemberWorkspaceBlockers,
            noEnumerationFields: [
                'otherOrg.members',
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'destination.secret',
            ],
            fixtureBackedReadiness: {
                schemaVersion: 'organization.ten_member_workspace_fixture.v1',
                fixtureName: 'organization_watchlist',
                downstreamConsumers: [
                    'alert_queue',
                    'case_workflow',
                    'webhook_delivery',
                    'dashboard_readiness',
                    'support_timeline',
                ],
                requiredOrganizationFields: [
                    'organizationId',
                    'tenantId',
                    'activeMemberCount',
                    'pendingInviteCount',
                    'ownerCount',
                ],
                requiredWatchlistFields: [
                    'watchlistItemId',
                    'alertGenerationRef',
                    'alertGeneratorKey',
                    'termFamily',
                    'normalizedTerm',
                    'status',
                ],
                cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
                memberLifecycleBlockers: [
                    'member_revoked',
                    'not_member',
                    'invite_expired',
                ],
                noEnumerationFields: [
                    'otherOrg.members',
                    'otherOrg.watchlistItemIds',
                    'destination.secret',
                ],
            },
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        alertGenerationHandoff: {
            schemaVersion: 'organization.watchlist_alert_generation_handoff.v1',
            sourceContract: 'organization.watchlist_alert_generation_consumer.v1',
            fixtureContract: 'organization.watchlist_alert_generation_fixture.v1',
            route: 'organization_watchlist',
            exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            organizationId: input.downstreamAuthorization.organizationId,
            tenantId: input.downstreamAuthorization.tenantId,
            activeTermCount: input.alertGenerationBridge.activeWatchlistTerms.length,
            watchlistItemIds: input.alertGenerationBridge.activeWatchlistTerms.map(term => term.watchlistItemId),
            alertGeneratorKeys: input.alertGenerationBridge.activeWatchlistTerms.map(term => organizationWatchlistAlertGenerationRef(term).dedupe.key),
            matchingInputFields: [
                'organizationId',
                'tenantId',
                'watchlistItemId',
                'termFamily',
                'normalizedTerm',
                'alertGenerationRef',
            ],
            expectedPersistedAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.organizationId',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.visibilityDecision',
                'casePath',
            ],
            expectedCaseFields: [
                'organizationId',
                'tenantId',
                'casePath',
                'watchlistItemIds',
                'allowedActions',
            ],
            dedupeKeyFields: [
                'organizationId',
                'watchlistItemId',
                'termFamily',
                'normalizedTerm',
            ],
            replaySteps: [
                'export_alert_terms',
                'match_capture_fixture',
                'persist_org_alert',
                'verify_case_visibility',
                'deliver_webhook',
                'archive_cleanup',
            ],
            readinessRefs: {
                alertQueue: 'organization.alert_queue_visibility_proof.v1',
                caseAssignment: 'organization.case_assignment_readiness.v1',
                destinationOwnership: 'organization.webhook_destination_ownership_readiness.v1',
                sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1',
            },
            lifecycleBlockers: [
                'org_archived',
                'org_deleted',
                'member_revoked',
                'watchlist_paused',
                'watchlist_archived',
                'no_active_terms',
                'role_not_allowed',
            ],
            blockerCodes: Array.from(new Set([
                ...blockers,
                input.alertGenerationBridge.activeWatchlistTerms.length > 0 ? undefined : 'no_active_terms',
            ].filter(Boolean).map(String))).sort(),
            crossOrgDedupeAllowed: false,
            nonmemberEnumeration: false,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
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
                'memberLifecycleProof',
                'inviteLifecycleProof',
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
        customerWorkflowProof: {
            schemaVersion: 'organization.customer_workflow_proof.v1',
            routeSequence: [
                'POST /api/organizations',
                'POST /api/organizations/:id/invites',
                'POST /api/organizations/invites/:inviteId/accept',
                'GET /api/organizations/:id/members',
                'POST /api/organizations/:id/watchlists',
                'GET /api/organizations/:id/watchlists/alert-terms',
                'GET /api/organizations/:id/alert-case-visibility',
                'POST /api/organizations/:id/watchlists/cleanup',
            ],
            requiredOrgFields: [
                'organizationId',
                'tenantId',
                'member.role',
                'counts.activeMemberCount',
                'counts.activeAdminCount',
            ],
            requiredWatchlistFields: [
                'watchlistItemId',
                'organizationId',
                'kind',
                'term',
                'status',
                'createdBy',
                'updatedBy',
                'alertGenerationRef',
            ],
            requiredAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.visibilityDecision',
            ],
            roleGates: {
                ownerAdminMutate: true,
                memberReadExport: input.downstreamAuthorization.member.role === 'owner'
                    || input.downstreamAuthorization.member.role === 'admin'
                    || input.downstreamAuthorization.member.role === 'member',
                viewerReadOnly: true,
                nonmemberEnumeration: false,
            },
            lifecycleBlockers: blockers,
            downstreamConsumers: [
                'alert_queue',
                'case_workflow',
                'webhook_delivery',
                'dashboard_readiness',
                'support_timeline',
            ],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
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

export function organizationInviteAcceptanceDenial(input: {
    invite?: OrganizationInviteRow | null
    organizationStatus?: OrganizationLifecycleStatus | null
    memberStatus?: OrganizationMemberRow['status'] | null
    userActive?: boolean | null
    requestId?: string | null
}) {
    const status = input.invite?.status ?? null
    const organizationStatus = input.organizationStatus ?? 'active'
    const blockerCode = !input.invite
        ? 'invite_not_found'
        : organizationStatus === 'archived'
            ? 'org_archived'
            : organizationStatus === 'deleted'
                ? 'org_deleted'
                : status === 'accepted'
                    ? 'invite_already_accepted'
                    : input.memberStatus === 'removed'
                        ? 'member_revoked'
                        : input.userActive === false
                            ? 'member_deactivated'
                            : status === 'revoked'
                                ? 'member_revoked'
                                : Date.parse(input.invite.expires_at) <= Date.now()
                                    ? 'invite_expired'
                                    : 'invite_not_pending'

    return {
        schemaVersion: 'organization.invite_acceptance_denial.v1' as const,
        organizationId: input.invite?.organization_id ?? null,
        tenantId: input.invite?.organization_id ?? null,
        inviteId: input.invite?.id ?? null,
        acceptanceToken: input.invite?.id ?? null,
        inviteStatus: status,
        organizationStatus,
        memberStatus: input.memberStatus ?? null,
        userActive: input.userActive ?? null,
        blockerCode,
        statusCode: input.invite ? 409 : 404,
        removedMemberDenied: input.memberStatus === 'removed',
        deactivatedUserDenied: input.userActive === false,
        nonmemberEnumeration: false as const,
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'inviteId',
            'inviteStatus',
            'organizationStatus',
            'memberStatus',
            'userActive',
            'blockerCode',
            'requestId',
        ],
        noLeakFields: [
            'invite.email',
            'otherOrg.invites',
            'otherOrg.members',
            'acceptanceToken.email',
            'activeTerms[]',
            'watchlistScope.alertGeneratorKeys',
            'destination.secret',
        ],
        blockedRoutes: [
            'GET /api/organizations/:id/watchlists',
            'GET /api/organizations/:id/watchlists/alert-terms',
            'GET /api/organizations/:id/alert-case-visibility',
            'POST /v1/dwm/webhooks/deliver',
        ],
        blockedConsumerContracts: [
            'organization.shared_watchlist_readiness_export.v1',
            'organization.watchlist_alert_generation_consumer.v1',
            'organization.case_visibility_consumer.v1',
            'organization.webhook_destination_access_decision.v1',
        ],
        readinessRefs: {
            inviteLifecycle: 'organization.invite_lifecycle_readiness_proof.v1' as const,
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1' as const,
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1' as const,
            alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1' as const,
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
        },
        ownerlessRecoveryMutationAllowed: false,
        accessRequiresAcceptedMembership: true,
        serviceLogAction: 'organization_invite_acceptance_denied' as const,
        requestId: input.requestId ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationInviteActionDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    invite: OrganizationInviteRow
    action: OrganizationInviteAction
    requestId?: string | null
    reason?: string | null
    message: string
}) {
    return {
        schemaVersion: 'organization.invite_action_denial.v1' as const,
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        inviteId: input.invite.id,
        acceptanceToken: input.invite.id,
        inviteStatus: input.invite.status,
        inviteRole: input.invite.role,
        action: input.action,
        blockerCode: input.invite.status === 'accepted' ? 'invite_already_accepted' as const : 'invite_not_actionable' as const,
        message: input.message,
        statusCode: 409,
        memberManagementRoute: 'GET /api/organizations/:id/members' as const,
        replacementActions: ['update_member_role', 'remove_member'] as const,
        nonmemberEnumeration: false as const,
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'inviteId',
            'inviteStatus',
            'inviteRole',
            'action',
            'blockerCode',
            'memberManagementRoute',
            'requestId',
        ],
        noLeakFields: [
            'invite.email',
            'otherOrg.invites',
            'otherOrg.members',
            'acceptanceToken.email',
        ],
        serviceLogAction: 'organization_invite_action_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
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

export function organizationMemberMutationDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    targetUserId: string
    targetRole: OrganizationRole
    action: 'remove_member' | 'change_member_role'
    requestedRole?: OrganizationRole | null
    reason?: string | null
    requestId?: string | null
    message: string
}) {
    return {
        schemaVersion: 'organization.member_mutation_denial.v1' as const,
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        targetUserId: input.targetUserId,
        targetRole: input.targetRole,
        action: input.action,
        requestedRole: input.requestedRole ?? null,
        denialReason: 'role_not_allowed' as const,
        message: input.message,
        statusCode: 403,
        allowedRoles: ['owner', 'admin'] as Array<'owner' | 'admin'>,
        allowedTargetRoles: input.action === 'remove_member'
            ? ['admin', 'member', 'viewer'] as OrganizationRole[]
            : ['admin', 'member', 'viewer'] as OrganizationRole[],
        adminAllowedTargetRoles: ['member', 'viewer'] as Array<'member' | 'viewer'>,
        ownerCanMutateOwners: true,
        adminCanMutateOwners: false,
        nonmemberEnumeration: false as const,
        serviceLogAction: 'organization_member_mutation_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationLastOwnerGuard(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    targetUserId: string
    action: 'remove_owner' | 'change_owner_role'
    requestedRole?: OrganizationRole | null
    ownerCount: number
    message: string
    requestId?: string | null
}) {
    return {
        schemaVersion: 'organization.last_owner_guard.v1' as const,
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        targetUserId: input.targetUserId,
        action: input.action,
        requestedRole: input.requestedRole ?? null,
        ownerCount: input.ownerCount,
        blockerCode: 'last_owner_guard' as const,
        message: input.message,
        statusCode: 409,
        transferOwnershipRoute: 'POST /api/organizations/:id/ownership-transfer' as const,
        transferOwnershipRequired: true,
        destructiveMutationBlocked: true,
        noOrphanedOrganization: true,
        serviceLogAction: 'organization_last_owner_guard_blocked' as const,
        requestId: input.requestId ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationWatchlistMutationDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    action: 'create_watchlist' | 'update_watchlist' | 'archive_watchlist' | 'watchlist_lifecycle_action' | 'cleanup_watchlists'
    itemId?: string | null
    requestId?: string | null
    reason?: string | null
    message: string
}) {
    return {
        schemaVersion: 'organization.watchlist_mutation_denial.v1' as const,
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        action: input.action,
        itemId: input.itemId ?? null,
        denialReason: 'role_not_allowed' as const,
        message: input.message,
        statusCode: 403,
        allowedRoles: ['owner', 'admin'] as Array<'owner' | 'admin'>,
        readRoles: ['owner', 'admin', 'member', 'viewer'] as OrganizationRole[],
        memberCanReadSharedWatchlists: true,
        memberCanMutateSharedWatchlists: false,
        viewerCanReadSharedWatchlists: true,
        viewerCanMutateSharedWatchlists: false,
        downstreamRefs: {
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1' as const,
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1' as const,
            alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1' as const,
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
        },
        deniedMutationDoesNotAffectActiveTerms: true,
        activeExportRemainsAvailableToAllowedRoles: true,
        noLeakFields: [
            'activeTerms[].term',
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'destination.secret',
            'case.evidence.rawContent',
        ],
        nonmemberEnumeration: false as const,
        serviceLogAction: 'organization_watchlist_mutation_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationInviteManagementDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    action: 'list_invites' | 'create_invite' | 'revoke_invite' | 'resend_invite' | 'manage_invites'
    inviteId?: string | null
    requestId?: string | null
    reason?: string | null
    message: string
}) {
    return {
        schemaVersion: 'organization.invite_management_denial.v1' as const,
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        action: input.action,
        inviteId: input.inviteId ?? null,
        denialReason: 'role_not_allowed' as const,
        message: input.message,
        statusCode: 403,
        allowedRoles: ['owner', 'admin'] as Array<'owner' | 'admin'>,
        readRoles: ['owner', 'admin'] as Array<'owner' | 'admin'>,
        memberCanListInvites: false,
        memberCanCreateInvites: false,
        viewerCanListInvites: false,
        viewerCanCreateInvites: false,
        nonmemberEnumeration: false as const,
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'actorRole',
            'action',
            'inviteId',
            'denialReason',
            'requestId',
        ],
        noLeakFields: [
            'pendingInvites[]',
            'invite.email',
            'acceptanceToken',
            'otherOrg.invites',
        ],
        serviceLogAction: 'organization_invite_management_denied' as const,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationSettingsMutationDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    attemptedFields: string[]
    requestId?: string | null
    message: string
}) {
    const attemptedFields = [...new Set(input.attemptedFields)].sort()
    return {
        schemaVersion: 'organization.settings_mutation_denial.v1' as const,
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        attemptedFields,
        denialReason: 'role_not_allowed' as const,
        message: input.message,
        statusCode: 403,
        allowedRoles: ['owner', 'admin'] as Array<'owner' | 'admin'>,
        readableRoles: ['owner', 'admin', 'member', 'viewer'] as OrganizationRole[],
        editableFields: ['name', 'slug', 'defaultWebhookPolicy', 'alertVisibilityPolicy', 'retentionDays', 'auditSafeMetadata'] as const,
        memberCanReadSettings: true,
        memberCanUpdateSettings: false,
        viewerCanReadSettings: true,
        viewerCanUpdateSettings: false,
        nonmemberEnumeration: false as const,
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'actorRole',
            'attemptedFields',
            'denialReason',
            'requestId',
        ],
        noLeakFields: [
            'auditSafeMetadata.sensitive',
            'otherOrg.settings',
            'destination.secret',
            'member.email',
        ],
        serviceLogAction: 'organization_settings_mutation_denied' as const,
        requestId: input.requestId ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationAccessDenial(input: {
    organizationId: string
    actorId: string
    route:
        | 'GET /api/organizations/:id'
        | 'GET /api/organizations/:id/watchlists'
        | 'GET /api/organizations/:id/alert-readiness'
        | 'GET /api/organizations/:id/watchlists/alert-terms'
        | 'GET /api/organizations/:id/alert-case-visibility'
    requestId?: string | null
}) {
    return {
        schemaVersion: 'organization.access_denial.v1' as const,
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        actorId: input.actorId,
        route: input.route,
        blockerCode: 'nonmember_denied' as const,
        denialReason: 'not_member' as const,
        statusCode: 404,
        nonmemberEnumeration: false as const,
        message: 'Organization not found.',
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'route',
            'blockerCode',
            'denialReason',
            'requestId',
        ],
        noLeakFields: [
            'organization.members',
            'organization.invites',
            'watchlistScope.alertGeneratorKeys',
            'activeTerms[]',
            'otherOrg.caseIds',
            'otherOrg.destinationIds',
            'destination.secret',
        ],
        downstreamRoutes: {
            watchlists: 'GET /api/organizations/:id/watchlists',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
            webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
        },
        downstreamRefs: {
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1' as const,
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1' as const,
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1' as const,
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
            webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1' as const,
        },
        serviceLogAction: 'organization_access_denied' as const,
        requestId: input.requestId ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function toWatchlistItem(row: OrganizationWatchlistRow) {
    const status = normalizeWatchlistStatus(row)
    const lifecycleState = organizationWatchlistEnabledState(status)
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
        enabled: lifecycleState.enabled,
        disabledReason: lifecycleState.disabledReason,
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
            enabled: lifecycleState.enabled,
            disabledReason: lifecycleState.disabledReason,
        },
    }
}

function organizationWatchlistEnabledState(status: OrganizationWatchlistStatus): {
    enabled: boolean
    disabledReason: OrganizationWatchlistTerm['disabledReason']
} {
    if (status === 'paused') {
        return { enabled: false, disabledReason: 'watchlist_paused' }
    }
    if (status === 'archived') {
        return { enabled: false, disabledReason: 'watchlist_archived' }
    }
    return { enabled: true, disabledReason: null }
}

export function buildOrganizationDwmAlertReference(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>,
    item: OrganizationWatchlistRow
): OrganizationDwmAlertReference {
    const watchlistName = `${organization.name} ${item.kind} watchlist`
    const casePath = `/dashboard/dwm?organizationId=${encodeURIComponent(organization.id)}&watchlistItemId=${encodeURIComponent(item.id)}`
    const dedupeKey = `org:${organization.id}:watchlist:${item.id}:${item.kind}:${item.value.toLowerCase()}`
    const bridgeContext = buildOrganizationBridgeContext(organization)
    const status = normalizeWatchlistStatus(item)
    const lifecycleState = organizationWatchlistEnabledState(status)
    const watchlist = {
        id: item.id,
        name: watchlistName,
        itemId: item.id,
        kind: item.kind,
        termFamily: item.kind,
        status,
        enabled: lifecycleState.enabled,
        disabledReason: lifecycleState.disabledReason,
        createdBy: item.created_by,
        updatedBy: item.updated_by ?? null,
        terms: [item.value],
    }
    const matchedTerm = {
        value: item.value,
        kind: item.kind,
        termFamily: item.kind,
    }
    const alertOwnership: OrganizationDwmAlertReference['alertOwnership'] = {
        schemaVersion: 'organization.alert_ownership.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        watchlistItemId: item.id,
        watchlistId: item.id,
        sourceFamily: 'organization_watchlist',
        route: 'organization_watchlist',
        dedupeKey,
        casePath,
        visibilityPolicy: bridgeContext.alertVisibilityPolicy,
        allowedViewerRoles: bridgeContext.allowedViewerRoles,
        requiredPersistedFields: [
            'organizationId',
            'tenantId',
            'watchlistItemIds',
            'workflowContext.organizationId',
            'workflowContext.alertGeneratorKeys',
            'workflowContext.visibilityDecision',
            'casePath',
        ],
        lifecycleBlockers: [
            'org_archived',
            'org_deleted',
            'member_revoked',
            'watchlist_archived',
            'watchlist_paused',
        ],
        noLeakFields: [
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'activeTerms[]',
            'destination.secret',
        ],
        crossTenantCollisionAllowed: false,
    }
    const ownerContext: OrganizationDwmAlertReference['ownerContext'] = {
        schemaVersion: 'organization.alert_reference_owner_context.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        watchlistItemId: item.id,
        watchlistId: item.id,
        watchlistKind: item.kind,
        createdBy: item.created_by,
        updatedBy: item.updated_by ?? null,
        visibilityPolicy: bridgeContext.alertVisibilityPolicy,
        allowedViewerRoles: bridgeContext.allowedViewerRoles,
        alertGeneratorKey: dedupeKey,
        webhookDestinationOrgField: 'destination.org_id',
        casePath,
        crossTenantCollisionAllowed: false,
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
        ownerContext,
        alertOwnership,
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
            alertOwnership,
            workflowContext: {
                organizationId: organization.id,
                tenantId: organization.id,
                ownerOrganizationId: organization.id,
                watchlistItemIds: [item.id],
                alertGeneratorKeys: [dedupeKey],
                ownerContext,
            },
        },
        webhookContract: {
            schemaVersion: 'organization.alert_reference_webhook_contract.v1',
            orgId: organization.id,
            organizationId: organization.id,
            tenantId: organization.id,
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
            requiredDestinationOrgId: organization.id,
            selectedDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            ownerContext,
            noLeakFields: [
                'destination.secret',
                'otherOrg.destinationIds',
                'otherOrg.alertGeneratorKeys',
            ],
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
    return items.map(item => {
        const status = normalizeWatchlistStatus(item)
        const lifecycleState = organizationWatchlistEnabledState(status)
        return {
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
            status,
            enabled: lifecycleState.enabled,
            disabledReason: lifecycleState.disabledReason,
            createdBy: item.created_by,
            updatedBy: item.updated_by ?? null,
            lifecycleReason: item.lifecycle_reason ?? null,
            lifecycleRequestId: item.lifecycle_request_id ?? null,
        }
    }).sort((a, b) => `${a.termFamily}:${a.term}`.localeCompare(`${b.termFamily}:${b.term}`))
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
        const alertGeneratorKey = alertGenerationRef.dedupe.key
        return {
            ...term,
            source: 'organization_shared_watchlist' as const,
            alertGeneratorKey,
            alertGenerationRef,
            ownerContext: {
                schemaVersion: 'organization.watchlist_term_owner_context.v1' as const,
                organizationId: term.organizationId,
                tenantId: term.tenantId,
                ownerOrganizationId: term.organizationId,
                watchlistItemId: term.watchlistItemId,
                itemId: term.itemId,
                createdBy: term.createdBy,
                updatedBy: term.updatedBy,
                visibilityPolicy: alertGeneration.visibilityPolicy,
                allowedViewerRoles: alertGeneration.allowedViewerRoles,
                webhookDestinationOrgField: 'destination.org_id' as const,
                alertGeneratorKey,
            },
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
                enabled: true as const,
                disabledReason: null,
            },
        }
    })
    const activeItems = items.filter(item => normalizeWatchlistStatus(item) === 'active')
    const pausedItems = items.filter(item => normalizeWatchlistStatus(item) === 'paused')
    const archivedItems = items.filter(item => normalizeWatchlistStatus(item) === 'archived')
    const pausedCount = pausedItems.length
    const archivedCount = archivedItems.length
    const termLifecycle: OrganizationWatchlistAlertTermsExport['termLifecycle'] = {
        schemaVersion: 'organization.watchlist_term_lifecycle.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        activeItemIds: activeItems.map(item => item.id),
        pausedItemIds: pausedItems.map(item => item.id),
        archivedItemIds: archivedItems.map(item => item.id),
        deletedTermIds: archivedItems.map(item => item.id),
        deletedTermCount: archivedItems.length,
        deletedTermSource: 'DELETE /api/organizations/:organizationId/watchlists/:itemId',
        cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
        alertMatchingEligibleStatuses: ['active'],
        exportExcludesDeletedTerms: true,
        excludedFromAlertMatching: [...pausedItems, ...archivedItems].map(item => {
            const status = normalizeWatchlistStatus(item) as 'paused' | 'archived'
            return {
                watchlistItemId: item.id,
                itemId: item.id,
                status,
                blockerCode: status === 'paused' ? 'watchlist_paused' : 'watchlist_archived',
                deletedByArchive: status === 'archived',
                archivedAt: item.archived_at ?? null,
                lifecycleReason: item.lifecycle_reason ?? null,
                lifecycleRequestId: item.lifecycle_request_id ?? null,
            }
        }),
        downstreamRefs: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            webhookDestinationOrgField: 'destination.org_id',
            casePathTemplate: '/dashboard/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
        },
    }
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
    const sharedWatchlistDownstreamProof = organizationSharedWatchlistDownstreamProof(organization, items, member, alertGeneration, downstreamAuthorization)
    const sharedWatchlistIntegrationGuardrails = organizationSharedWatchlistIntegrationGuardrails(sharedWatchlistDownstreamProof)
    const sharedWatchlistAlertQueueVisibility = organizationSharedWatchlistAlertQueueVisibility(sharedWatchlistDownstreamProof)
    const webhookDestinationOwnership = organizationAlertCaseWorkflowState(
        sharedWatchlistDownstreamProof,
        downstreamAuthorization
    ).webhookDestinationOwnership
    const canManageWebhookDestinations = roleCanManageOrganization(member.role)
    const webhookDestinationAccessDecision: OrganizationWebhookDestinationAccessDecision = {
        schemaVersion: 'organization.webhook_destination_access_decision.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        sourceFamily: 'organization_watchlist',
        member: {
            userId: member.userId,
            role: member.role,
            status: 'active',
        },
        route: webhookDestinationOwnership.route,
        destinationScope: {
            requiredDestinationOrgId: webhookDestinationOwnership.requiredDestinationOrgId,
            selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField,
            selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField,
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: webhookDestinationOwnership.nonmemberDestinationEnumeration,
        },
        allowedActions: {
            automaticDelivery: webhookDestinationOwnership.roleGates.automaticDeliveryAllowed,
            manualTrigger: webhookDestinationOwnership.roleGates.manualTriggerAllowed,
            configureDestination: canManageWebhookDestinations,
            readDeliverySummary: true,
        },
        roleGates: {
            automaticDelivery: ['owner', 'admin'],
            manualTrigger: webhookDestinationOwnership.roleGates.manualTriggerAllowedRoles,
            configureDestination: ['owner', 'admin'],
            readDeliverySummary: ['owner', 'admin', 'member', 'viewer'],
        },
        denialReason: webhookDestinationOwnership.roleGates.denialReason ?? (canManageWebhookDestinations ? null : 'role_not_allowed'),
        blockerCodes: Array.from(new Set([
            ...webhookDestinationOwnership.blockerCodes,
            ...(canManageWebhookDestinations ? [] : ['role_not_allowed']),
        ])),
        requiredAlertFields: webhookDestinationOwnership.requiredAlertFields,
        requiredDeliveryFields: webhookDestinationOwnership.requiredDeliveryFields,
        deliveryInputReceipt: {
            schemaVersion: 'organization.webhook_destination_delivery_input.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            route: webhookDestinationOwnership.route,
            eventType: webhookDestinationOwnership.eventType,
            requiredAlertFields: [
                'alert.organizationId',
                'alert.tenantId',
                'alert.watchlistItemIds',
                'alert.workflowContext.alertGeneratorKeys',
                'alert.dedupeKey',
            ],
            requiredDestinationFields: [
                'destination.id',
                'destination.org_id',
                'destination.enabled',
                'destination.eventSubscriptions',
            ],
            selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField,
            selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField,
            idempotencyKeyFields: webhookDestinationOwnership.idempotency.keyFields,
            lifecycleBlockers: Array.from(new Set([
                'org_archived',
                'org_deleted',
                'member_revoked',
                'manual_webhook_selection_required',
            ])),
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: webhookDestinationOwnership.nonmemberDestinationEnumeration,
            noLeakFields: [
                'destination.secret',
                'destination.endpoint',
                'otherOrg.destinationIds',
            ],
        },
        proofAssertions: [
            'destination_org_matches_alert_org',
            'idempotency_scoped_to_org_destination_alert',
            'manual_trigger_owner_admin_only',
            'member_viewer_cannot_configure_destination',
            'nonmember_cannot_enumerate_destinations',
        ],
        noLeakFields: [
            'destination.secret',
            'destination.endpoint',
            'otherOrg.destinationIds',
            'otherOrg.alertGeneratorKeys',
            'activeTerms[].term',
        ],
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
    const supportAccess: OrganizationWatchlistAlertBridgeContract['supportAccess'] = {
        mode: 'support_contract_only',
        blockerCode: 'support_only_access',
        message: 'Support users must inspect org watchlist alert exports through the admin support contract, not member-scoped org routes.',
    }
    const supportVisibility: OrganizationWatchlistAlertBridgeContract['supportVisibility'] = {
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
    }
    const redactedSummary: OrganizationWatchlistAlertBridgeContract['redactedSummary'] = {
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
    }
    const sharedWatchlistSupportInspection = organizationSharedWatchlistSupportInspection({
        organizationId: organization.id,
        tenantId: organization.id,
        redactedSummary,
        supportVisibility,
        supportAccess,
        audit: sharedWatchlistDownstreamProof.audit,
    })
    const consumerReadinessBlockers = Array.from(new Set([
        ...sharedWatchlistIntegrationGuardrails.blockerCodes,
        ...sharedWatchlistAlertQueueVisibility.blockerCodes,
        ...sharedWatchlistAlertQueueVisibility.denialGuardrails.blockerCodes,
        ...sharedWatchlistIntegrationGuardrails.caseSafety.blockerCodes,
        ...webhookDestinationOwnership.blockerCodes,
    ].map(String)))
    const consumerReadiness: OrganizationSharedWatchlistConsumerReadiness = {
        schemaVersion: 'organization.shared_watchlist_consumer_readiness.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        sourceFamily: 'organization_watchlist',
        member: {
            userId: member.userId,
            role: member.role,
            status: 'active',
        },
        routes: {
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertList: sharedWatchlistAlertQueueVisibility.routes.list,
            alertReplay: sharedWatchlistAlertQueueVisibility.routes.replay,
            caseList: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.routes.list,
            caseOpen: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.routes.open,
            webhookDeliver: webhookDestinationOwnership.route,
            supportInspection: sharedWatchlistSupportInspection.route,
            dashboardReadiness: 'GET /api/organizations/:id/alert-readiness',
        },
        watchlists: {
            activeCount: sharedWatchlistDownstreamProof.watchlistOwnership.activeCount,
            pausedCount: sharedWatchlistDownstreamProof.watchlistOwnership.pausedCount,
            archivedCount: sharedWatchlistDownstreamProof.watchlistOwnership.archivedCount,
            activeIds: sharedWatchlistDownstreamProof.watchlistOwnership.activeIds,
            pausedIds: sharedWatchlistDownstreamProof.watchlistOwnership.pausedIds,
            archivedIds: sharedWatchlistDownstreamProof.watchlistOwnership.archivedIds,
            alertGeneratorKeys: sharedWatchlistAlertQueueVisibility.watchlistScope.alertGeneratorKeys,
            crossTenantCollisionAllowed: sharedWatchlistAlertQueueVisibility.watchlistScope.crossTenantCollisionAllowed,
        },
        readiness: {
            alertQueueReady: sharedWatchlistAlertQueueVisibility.visibility.allowed && sharedWatchlistAlertQueueVisibility.blockerCodes.length === 0,
            caseWorkflowReady: sharedWatchlistIntegrationGuardrails.caseSafety.ok,
            webhookDeliveryReady: webhookDestinationOwnership.blockerCodes.length === 0,
            supportRedactedReadReady: sharedWatchlistSupportInspection.guardrails.ok,
            dashboardReadinessReady: true,
        },
        roleGates: {
            mutateWatchlists: ['owner', 'admin'],
            exportTerms: sharedWatchlistAlertQueueVisibility.visibility.allowedRoles,
            manualWebhookTrigger: webhookDestinationOwnership.roleGates.manualTriggerAllowedRoles,
            assignCase: sharedWatchlistAlertQueueVisibility.roleActionMatrix.roleGates.assign_case,
        },
        blockers: consumerReadinessBlockers,
        noLeakFields: [
            'activeTerms[].term',
            'activeTerms[].value',
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'destination.secret',
            'case.evidence.rawContent',
        ],
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
    const alertGenerationConsumer: OrganizationWatchlistAlertTermsExport['alertGenerationConsumer'] = {
        schemaVersion: 'organization.watchlist_alert_generation_consumer.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        repositoryAdapter: 'organizationWatchlistAlertTermsExport',
        sourceFamily: 'organization_watchlist',
        route: 'GET /api/organizations/:id/watchlists/alert-terms',
        requiredQueryFields: ['organizationId'],
        requiredPersistedFields: [
            'organizationId',
            'tenantId',
            'watchlistItemId',
            'watchlistItemIds',
            'workflowContext.organizationId',
            'workflowContext.alertGeneratorKeys',
            'workflowContext.visibilityDecision',
        ],
        activeTerms: activeTerms.map(term => ({
            organizationId: term.organizationId,
            tenantId: term.tenantId,
            watchlistItemId: term.watchlistItemId,
            itemId: term.itemId,
            termFamily: term.termFamily,
            category: term.category,
            term: term.term,
            normalizedTerm: term.alertGenerationRef.normalizedTerm,
            status: 'active',
            alertGeneratorKey: term.alertGeneratorKey,
            alertGenerationRef: term.alertGenerationRef,
        })),
        lifecycleExclusions: termLifecycle,
        scopeGuardrails: {
            partitionKey: 'organizationId',
            tenantIdField: 'tenantId',
            watchlistScope: 'organization_owned',
            crossOrgReadAllowed: false,
            userLocalFallbackAllowed: false,
            nonmemberEnumeration: false,
        },
        roleGates: {
            exportTerms: sharedWatchlistAlertQueueVisibility.visibility.allowedRoles,
            mutateWatchlists: ['owner', 'admin'],
            readSharedWatchlists: ['owner', 'admin', 'member', 'viewer'],
        },
        denialContract: {
            nonmember: 'organization.access_denial.v1',
            roleDenied: 'organization.watchlist_alert_terms_export_denial.v1',
            removedMember: 'member_revoked',
            noLeakFields: [
                'activeTerms[]',
                'activeWatchlistTerms[]',
                'watchlistScope.alertGeneratorKeys',
                'otherOrg.watchlistItemIds',
            ],
        },
        matchingInputReceipt: {
            schemaVersion: 'organization.watchlist_alert_matching_input.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            sourceFamily: 'organization_watchlist',
            matchingRoute: 'organization_watchlist',
            termCount: activeTerms.length,
            requiredMatcherFields: [
                'organizationId',
                'tenantId',
                'watchlistItemId',
                'termFamily',
                'normalizedTerm',
                'alertGeneratorKey',
                'alertGenerationRef',
            ],
            dedupeKeyFields: ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'],
            terms: activeTerms.map(term => ({
                organizationId: term.organizationId,
                tenantId: term.tenantId,
                watchlistItemId: term.watchlistItemId,
                termFamily: term.termFamily,
                normalizedTerm: term.alertGenerationRef.normalizedTerm,
                alertGeneratorKey: term.alertGeneratorKey,
                status: 'active',
                alertGenerationRef: term.alertGenerationRef,
            })),
            lifecycleExclusions: {
                pausedItemIds: termLifecycle.pausedItemIds,
                archivedItemIds: termLifecycle.archivedItemIds,
                deletedTermIds: termLifecycle.deletedTermIds,
                excludedStatuses: ['paused', 'archived'],
            },
            scopeGuardrails: {
                partitionKey: 'organizationId',
                crossOrgReadAllowed: false,
                userLocalFallbackAllowed: false,
                nonmemberEnumeration: false,
            },
            noLeakFields: [
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'destination.secret',
            ],
        },
        canGenerateAlerts: alertGeneration.canGenerateAlerts,
        blockerCodes: Array.from(new Set([
            ...alertGeneration.blockedReasons,
            ...termLifecycle.excludedFromAlertMatching.map(item => item.blockerCode),
        ])),
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
    const termExportDeltaReceipt: OrganizationWatchlistAlertTermsExport['termExportDeltaReceipt'] = {
        schemaVersion: 'organization.watchlist_term_export_delta_receipt.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        actor: {
            userId: member.userId,
            role: member.role,
            status: 'active',
        },
        route: 'GET /api/organizations/:id/watchlists/alert-terms',
        activeTermCount: activeTerms.length,
        exportedWatchlistItemIds: activeTerms.map(term => term.watchlistItemId),
        exportedAlertGeneratorKeys: activeTerms.map(term => term.alertGeneratorKey),
        excludedTermCount: termLifecycle.excludedFromAlertMatching.length,
        excludedWatchlistItemIds: termLifecycle.excludedFromAlertMatching.map(term => term.watchlistItemId),
        excludedReasons: Array.from(new Set(termLifecycle.excludedFromAlertMatching.map(term => term.blockerCode))),
        lifecycle: {
            activeItemIds: termLifecycle.activeItemIds,
            pausedItemIds: termLifecycle.pausedItemIds,
            archivedItemIds: termLifecycle.archivedItemIds,
            deletedTermIds: termLifecycle.deletedTermIds,
        },
        downstreamRefs: {
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1',
            alertPersistenceContract: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.schemaVersion,
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1',
            webhookOwnership: 'organization.shared_watchlist_webhook_ownership_hint.v1',
        },
        roleGates: {
            exportTerms: sharedWatchlistAlertQueueVisibility.visibility.allowedRoles,
            mutateWatchlists: ['owner', 'admin'],
            readSharedWatchlists: ['owner', 'admin', 'member', 'viewer'],
        },
        blockerCodes: Array.from(new Set([
            ...alertGeneration.blockedReasons,
            ...termLifecycle.excludedFromAlertMatching.map(item => item.blockerCode),
        ])),
        stableDedupeFields: ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'],
        nonmemberEnumeration: false,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
    const alertCasePersistenceReceipt: OrganizationWatchlistAlertTermsExport['alertCasePersistenceReceipt'] = {
        schemaVersion: 'organization.alert_case_bridge_persistence_receipt.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        sourceFamily: 'organization_watchlist',
        alertPersistenceContract: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.schemaVersion,
        caseWorkflowContract: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.schemaVersion,
        storageModule: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.storageModule,
        alertUpsertFunction: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.upsertFunction,
        alertRoute: sharedWatchlistDownstreamProof.alertBridge.route,
        caseRoute: sharedWatchlistDownstreamProof.caseBridge.route,
        casePathTemplate: sharedWatchlistDownstreamProof.caseBridge.casePathTemplate,
        watchlistScope: {
            watchlistItemIds: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds,
            alertGeneratorKeys: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys,
            crossTenantCollisionAllowed: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe.crossTenantCollisionAllowed,
        },
        requiredAlertFields: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.persistedAlertFields,
        requiredCaseFields: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.requiredCaseFields,
        workflowContextFields: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.workflowContextFields,
        dedupe: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe,
        lifecycleBlockers: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.lifecycleBlockers,
        actorActions: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.allowedActions,
        blockerCodes: Array.from(new Set([
            ...sharedWatchlistDownstreamProof.alertBridge.persistenceContract.blockerCodes,
            ...sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.blockerCodes,
        ])),
        noEnumeration: false,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
    const readinessExport: OrganizationWatchlistAlertTermsExport['readinessExport'] = {
        schemaVersion: 'organization.shared_watchlist_readiness_export.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        sourceFamily: 'organization_watchlist',
        actor: {
            userId: member.userId,
            role: member.role,
            status: 'active',
        },
        routes: {
            alertTermsExport: consumerReadiness.routes.alertTermsExport,
            alertQueue: consumerReadiness.routes.alertList,
            caseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
            caseOpen: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.routes.open,
            webhookDeliver: consumerReadiness.routes.webhookDeliver,
            dashboardReadiness: consumerReadiness.routes.dashboardReadiness,
        },
        readiness: {
            alertExportReady: alertGenerationConsumer.canGenerateAlerts && alertGenerationConsumer.blockerCodes.length === 0,
            alertQueueReady: consumerReadiness.readiness.alertQueueReady,
            casePersistenceReady: alertCasePersistenceReceipt.blockerCodes.length === 0,
            caseVisibilityReady: consumerReadiness.readiness.caseWorkflowReady,
            webhookDestinationReady: webhookDestinationAccessDecision.blockerCodes.length === 0,
            supportRedactedReadReady: consumerReadiness.readiness.supportRedactedReadReady,
            dashboardReadinessReady: consumerReadiness.readiness.dashboardReadinessReady,
        },
        watchlistScope: {
            activeItemIds: termLifecycle.activeItemIds,
            pausedItemIds: termLifecycle.pausedItemIds,
            archivedItemIds: termLifecycle.archivedItemIds,
            alertGeneratorKeys: consumerReadiness.watchlists.alertGeneratorKeys,
            crossTenantCollisionAllowed: false,
        },
        downstreamRefs: {
            alertGenerationConsumer: alertGenerationConsumer.schemaVersion,
            alertPersistenceReceipt: alertCasePersistenceReceipt.schemaVersion,
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1',
            webhookDestinationOwnership: webhookDestinationOwnership.schemaVersion,
            webhookDestinationAccessDecision: webhookDestinationAccessDecision.schemaVersion,
            termExportDeltaReceipt: termExportDeltaReceipt.schemaVersion,
        },
        roleGates: {
            exportTerms: consumerReadiness.roleGates.exportTerms,
            mutateWatchlists: consumerReadiness.roleGates.mutateWatchlists,
            manualWebhookTrigger: consumerReadiness.roleGates.manualWebhookTrigger,
            assignCase: consumerReadiness.roleGates.assignCase,
        },
        lifecycleAccess: {
            activeMembershipRequired: true,
            removedMemberBlocker: 'member_revoked',
            revokedInviteBlocker: 'member_revoked',
            expiredInviteBlocker: 'invite_expired',
            pausedWatchlistBlocker: 'watchlist_paused',
            archivedWatchlistBlocker: 'watchlist_archived',
            nonmemberEnumeration: false,
        },
        alertGenerationFixture: {
            schemaVersion: 'organization.watchlist_alert_generation_fixture.v1',
            route: 'organization_watchlist',
            matchingInputSchema: alertGenerationConsumer.matchingInputReceipt.schemaVersion,
            activeTermCount: alertGenerationConsumer.matchingInputReceipt.termCount,
            watchlistItemIds: alertGenerationConsumer.matchingInputReceipt.terms.map(term => term.watchlistItemId),
            alertGeneratorKeys: alertGenerationConsumer.matchingInputReceipt.terms.map(term => term.alertGeneratorKey),
            expectedAlertFields: [
                'organizationId',
                'tenantId',
                'watchlistItemIds',
                'workflowContext.alertGenerationRefs',
                'workflowContext.alertGeneratorKeys',
                'workflowContext.visibilityDecision',
                'casePath',
            ],
            expectedCaseFields: [
                'organizationId',
                'tenantId',
                'alertId',
                'casePath',
                'watchlistItemIds',
            ],
            replaySteps: [
                'export_alert_terms',
                'match_capture_fixture',
                'persist_org_alert',
                'verify_case_visibility',
                'archive_cleanup',
            ],
            lifecycleBlockers: [
                'member_revoked',
                'invite_expired',
                'watchlist_paused',
                'watchlist_archived',
                'org_archived',
                'org_deleted',
            ],
            cleanupRoute: termLifecycle.cleanupRoute,
            crossOrgDedupeAllowed: false,
            nonmemberEnumeration: false,
        },
        blockers: Array.from(new Set([
            ...consumerReadiness.blockers,
            ...alertGenerationConsumer.blockerCodes,
            ...alertCasePersistenceReceipt.blockerCodes.map(String),
            ...webhookDestinationAccessDecision.blockerCodes,
        ])),
        noLeakFields: [
            'activeTerms[].term',
            'otherOrg.watchlistItemIds',
            'otherOrg.alertGeneratorKeys',
            'destination.secret',
            'case.evidence.rawContent',
        ],
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
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
            supportAccess,
            supportVisibility,
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
            redactedSummary,
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
                'activeTerms[].ownerContext',
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
        sharedWatchlistDownstreamProof,
        sharedWatchlistIntegrationGuardrails,
        sharedWatchlistSupportInspection,
        sharedWatchlistAlertQueueVisibility,
        webhookDestinationOwnership,
        webhookDestinationAccessDecision,
        consumerReadiness,
        alertGenerationConsumer,
        termExportDeltaReceipt,
        alertCasePersistenceReceipt,
        readinessExport,
        activeWatchlistTerms: alertGeneration.activeWatchlistTerms,
        termFamilies: alertGeneration.termFamilies,
        excluded: {
            pausedCount,
            archivedCount,
            inactiveCount: pausedCount + archivedCount,
        },
        termLifecycle,
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
        enabled: true,
        disabledReason: null,
        lifecycle: {
            status: 'active',
            enabled: true,
            disabledReason: null,
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
