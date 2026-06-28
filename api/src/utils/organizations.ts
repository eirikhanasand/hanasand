export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'
export type WatchlistKind = 'company' | 'domain' | 'vendor'

export type OrganizationInput = {
    name?: unknown
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
    alert: {
        id: string
        organizationId: string
        orgId: string
        tenantId: string
        orgName: string
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
        route: 'organization_watchlist'
        casePath: string
    }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const watchlistWriteRoles = new Set<OrganizationRole>(['owner', 'admin', 'member'])
const inviteRoles = new Set<OrganizationRole>(['admin', 'member', 'viewer'])
const watchlistKinds = new Set<WatchlistKind>(['company', 'domain', 'vendor'])

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
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        role: row.role,
        memberCount: Number(row.member_count ?? 0),
        pendingInviteCount: Number(row.pending_invite_count ?? 0),
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
    organization: Pick<OrganizationRow, 'id' | 'name'>,
    item: OrganizationWatchlistRow
): OrganizationDwmAlertReference {
    const watchlistName = `${organization.name} ${item.kind} watchlist`
    const casePath = `/dashboard/dwm?organizationId=${encodeURIComponent(organization.id)}&watchlistItemId=${encodeURIComponent(item.id)}`
    const dedupeKey = `org:${organization.id}:watchlist:${item.id}:${item.kind}:${item.value.toLowerCase()}`
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
        alert: {
            id: dedupeKey,
            organizationId: organization.id,
            orgId: organization.id,
            tenantId: organization.id,
            orgName: organization.name,
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
            route: 'organization_watchlist',
            casePath,
        },
    }
}

function normalizeInviteRole(value: unknown): OrganizationRole {
    const role = cleanText(value).toLowerCase() || 'member'
    if (!inviteRoles.has(role as OrganizationRole)) {
        throw new Error('Invite role must be admin, member, or viewer.')
    }

    return role as OrganizationRole
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

function slugFor(value: string) {
    const slug = value.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)

    return slug || 'organization'
}
