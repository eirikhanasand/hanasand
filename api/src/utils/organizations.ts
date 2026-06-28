export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'
export type WatchlistKind = 'company' | 'domain' | 'vendor'
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

export type InviteInput = {
    email?: unknown
    emails?: unknown
    role?: unknown
    expiresAt?: unknown
}

export type WatchlistInput = {
    kind?: unknown
    value?: unknown
    notes?: unknown
}

export type OrganizationRow = {
    id: string
    name: string
    slug: string
    created_by: string
    created_at: string
    updated_at: string
    member_count?: number
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
    created_by: string
    created_at: string
    updated_at: string
    archived_at?: string | null
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
    }
    watchlist: {
        id: string
        name: string
        itemId: string
        kind: WatchlistKind
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
        pendingInviteCount: number
        sharedWatchlistCount: number
        readinessStatus: OrganizationReadinessStatus
        watchlistItemId: string
        matchedTerm: {
            value: string
            kind: WatchlistKind
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
    pendingInviteCount: number
    sharedWatchlistCount: number
    readinessStatus: OrganizationReadinessStatus
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const watchlistWriteRoles = new Set<OrganizationRole>(['owner', 'admin', 'member'])
const inviteRoles = new Set<OrganizationRole>(['admin', 'member', 'viewer'])
const watchlistKinds = new Set<WatchlistKind>(['company', 'domain', 'vendor'])
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
    const expiresAt = normalizeInviteExpiry(body?.expiresAt)
    return { emails, role, expiresAt }
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

export function normalizeWatchlistInput(body: WatchlistInput | undefined) {
    const kind = cleanText(body?.kind).toLowerCase()
    if (!watchlistKinds.has(kind as WatchlistKind)) {
        throw new Error('Watchlist kind must be company, domain, or vendor.')
    }

    const value = normalizeWatchlistValue(kind as WatchlistKind, body?.value)
    if (!value) {
        throw new Error('Watchlist value is required.')
    }

    if (value.length > 240) {
        throw new Error('Watchlist value must be 240 characters or fewer.')
    }

    const notes = cleanText(body?.notes)
    return {
        kind: kind as WatchlistKind,
        value,
        notes: notes.slice(0, 2000),
    }
}

export function roleCanManageOrganization(role: OrganizationRole | undefined) {
    return role === 'owner' || role === 'admin'
}

export function roleCanWriteWatchlist(role: OrganizationRole | undefined) {
    return watchlistWriteRoles.has(role as OrganizationRole)
}

export function toOrganization(row: OrganizationRow) {
    const settings = organizationSettingsFromRow(row)
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        role: row.role,
        memberCount: Number(row.member_count ?? 0),
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
    return {
        id: row.id,
        organizationId: row.organization_id,
        kind: row.kind,
        value: row.value,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at ?? null,
    }
}

export function buildOrganizationDwmAlertReference(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>,
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
        terms: [item.value],
    }
    const matchedTerm = {
        value: item.value,
        kind: item.kind,
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
            pendingInviteCount: bridgeContext.pendingInviteCount,
            sharedWatchlistCount: bridgeContext.sharedWatchlistCount,
            readinessStatus: bridgeContext.readinessStatus,
            route: 'organization_watchlist',
            casePath,
        },
    }
}

export function buildOrganizationBridgeContext(
    organization: Pick<OrganizationRow, 'id' | 'name' | 'slug' | 'member_count' | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy' | 'alert_visibility_policy'>
): OrganizationBridgeContext {
    const sharedWatchlistCount = Number(organization.shared_watchlist_count ?? 0)
    return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        defaultWebhookPolicy: organization.default_webhook_policy ?? 'active_destinations',
        alertVisibilityPolicy: organization.alert_visibility_policy ?? 'members',
        memberCount: Number(organization.member_count ?? 0),
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

function normalizeWatchlistValue(kind: WatchlistKind, value: unknown) {
    const cleaned = cleanText(value)
    if (kind === 'domain') {
        return cleaned.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split('/')[0]
    }

    return cleaned
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
