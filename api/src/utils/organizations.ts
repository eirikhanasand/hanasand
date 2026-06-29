export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'
export type WatchlistKind = 'company' | 'domain' | 'vendor' | 'actor' | 'keyword'
export type OrganizationWatchlistStatus = 'active' | 'paused' | 'archived'
export type OrganizationWatchlistAction = 'pause' | 'resume' | 'archive'
export type OrganizationDefaultWebhookPolicy = 'active_destinations' | 'manual_selection' | 'disabled'
export type OrganizationAlertVisibilityPolicy = 'members' | 'admins' | 'owners'

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
    pending_invite_count?: number
    shared_watchlist_count?: number
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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const watchlistWriteRoles = new Set<OrganizationRole>(['owner', 'admin'])
const inviteRoles = new Set<OrganizationRole>(['admin', 'member', 'viewer'])
const inviteActions = new Set<OrganizationInviteAction>(['revoke', 'resend'])
const watchlistActions = new Set<OrganizationWatchlistAction>(['pause', 'resume', 'archive'])
const watchlistKinds = new Set<WatchlistKind>(['company', 'domain', 'vendor', 'actor', 'keyword'])
const memberRoleTargets = new Set<OrganizationRole>(['admin', 'member', 'viewer'])
const defaultWebhookPolicies = new Set<OrganizationDefaultWebhookPolicy>(['active_destinations', 'manual_selection', 'disabled'])
const alertVisibilityPolicies = new Set<OrganizationAlertVisibilityPolicy>(['members', 'admins', 'owners'])

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
    const retentionDays = normalizeRetentionDays(body?.retentionDays ?? body?.retention_days)
    const auditSafeMetadata = normalizeAuditSafeMetadata(body?.auditSafeMetadata ?? body?.audit_safe_metadata)

    if (
        name === undefined
        && slug === undefined
        && defaultWebhookPolicy === undefined
        && alertVisibilityPolicy === undefined
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
        throw new Error('Watchlist action must be pause, resume, or archive.')
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
        role: row.role,
        memberCount: Number(row.member_count ?? 0),
        ownerCount: Number(row.owner_count ?? 0),
        pendingInviteCount: Number(row.pending_invite_count ?? 0),
        sharedWatchlistCount: Number(row.shared_watchlist_count ?? 0),
        settings,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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

export function organizationSettingsFromRow(row: Pick<OrganizationRow, 'default_webhook_policy' | 'alert_visibility_policy' | 'retention_days' | 'audit_safe_metadata'>) {
    return {
        defaultWebhookPolicy: row.default_webhook_policy ?? 'active_destinations',
        alertVisibilityPolicy: row.alert_visibility_policy ?? 'members',
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
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>,
    items: OrganizationWatchlistRow[]
): OrganizationWatchlistAlertGenerationContract {
    const activeItems = items.filter(item => normalizeWatchlistStatus(item) === 'active')
    const bridgeContext = buildOrganizationBridgeContext({
        ...organization,
        shared_watchlist_count: activeItems.length,
    })
    const activeWatchlistTerms = organizationWatchlistTerms(activeItems)
    const termFamilies = [...new Set(activeWatchlistTerms.map(term => term.termFamily))].sort()
    const blockedReasons: string[] = []
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
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'owner_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>,
    items: OrganizationWatchlistRow[],
    member: { userId: string, role: OrganizationRole }
): OrganizationWatchlistAlertTermsExport {
    const alertGeneration = organizationWatchlistAlertGenerationContract(organization, items)
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
        activeTerms,
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
