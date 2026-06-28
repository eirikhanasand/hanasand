import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import recordLog from '#utils/logs/recordLog.ts'
import {
    buildOrganizationDwmAlertReference,
    normalizeInviteInput,
    normalizeOrganizationInput,
    normalizeWatchlistInput,
    roleCanManageOrganization,
    roleCanWriteWatchlist,
    toInvite,
    toMember,
    toOrganization,
    toWatchlistItem,
    type OrganizationInviteRow,
    type OrganizationMemberRow,
    type OrganizationRole,
    type OrganizationRow,
    type InviteInput,
    type OrganizationInput,
    type WatchlistKind,
    type WatchlistInput,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'

type OrganizationParams = {
    id: string
}

type InviteParams = {
    inviteId: string
}

type WatchlistParams = {
    organizationId: string
    itemId: string
}

export async function getOrganizations(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const result = await run(`
        SELECT
            o.*,
            om.role,
            COUNT(DISTINCT active_members.user_id)::int AS member_count,
            COUNT(DISTINCT pending_invites.id)::int AS pending_invite_count
        FROM organizations o
        JOIN organization_members om
          ON om.organization_id = o.id
         AND om.user_id = $1
         AND om.status = 'active'
        LEFT JOIN organization_members active_members
          ON active_members.organization_id = o.id
         AND active_members.status = 'active'
        LEFT JOIN organization_invites pending_invites
          ON pending_invites.organization_id = o.id
         AND pending_invites.status = 'pending'
        GROUP BY o.id, om.role
        ORDER BY o.updated_at DESC, o.created_at DESC
    `, [userId])

    return res.send({ organizations: (result.rows as OrganizationRow[]).map(toOrganization) })
}

export async function postOrganization(req: FastifyRequest<{ Body: OrganizationInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    let input
    try {
        input = normalizeOrganizationInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid organization.' })
    }

    const organizationId = randomUUID()
    const slug = await uniqueOrganizationSlug(input.slug)
    const organization = await run(`
        WITH new_organization AS (
            INSERT INTO organizations (id, name, slug, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        ),
        owner_membership AS (
            INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
            SELECT id, $4, 'owner', 'active', $4
            FROM new_organization
            ON CONFLICT (organization_id, user_id)
            DO UPDATE SET role = 'owner', status = 'active'
            RETURNING organization_id
        )
        SELECT new_organization.*
        FROM new_organization
        JOIN owner_membership ON owner_membership.organization_id = new_organization.id
    `, [organizationId, input.name, slug, userId])
    logOrganizationEvent(req, 'organization_created', organizationId, userId, {
        name: input.name,
        slug,
    })

    return res.status(201).send({ organization: toOrganization({
        ...(organization.rows[0] as OrganizationRow),
        role: 'owner',
        member_count: 1,
        pending_invite_count: 0,
    }) })
}

export async function getOrganization(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    return res.send({ organization: toOrganization(organization) })
}

export async function getOrganizationInvites(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanManageOrganization(organization.role)) {
        return res.status(403).send({ error: 'Only organization owners and admins can view invites.' })
    }

    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE organization_id = $1
          AND status = 'pending'
          AND expires_at > NOW()
        ORDER BY status ASC, created_at DESC
    `, [req.params.id])

    return res.send({ invites: (result.rows as OrganizationInviteRow[]).map(toInvite) })
}

export async function getOrganizationMembers(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const result = await run(`
        SELECT
            om.organization_id,
            om.user_id,
            u.name,
            u.avatar,
            om.role,
            om.status,
            om.invited_by,
            om.joined_at,
            om.created_at
        FROM organization_members om
        JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1
          AND om.status = 'active'
        ORDER BY
            CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
            om.joined_at ASC,
            om.user_id ASC
    `, [req.params.id])

    return res.send({
        organization: toOrganization(organization),
        members: (result.rows as OrganizationMemberRow[]).map(toMember),
    })
}

export async function postOrganizationInvites(req: FastifyRequest<{ Params: OrganizationParams, Body: InviteInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanManageOrganization(organization.role)) {
        return res.status(403).send({ error: 'Only organization owners and admins can invite members.' })
    }

    let input
    try {
        input = normalizeInviteInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid invites.' })
    }

    const rows: OrganizationInviteRow[] = []
    for (const email of input.emails) {
        const invite = await run(`
            INSERT INTO organization_invites (id, organization_id, email, role, invited_by, status, expires_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6)
            ON CONFLICT (organization_id, email)
            DO UPDATE SET role = EXCLUDED.role,
                          invited_by = EXCLUDED.invited_by,
                          status = 'pending',
                          accepted_at = NULL,
                          accepted_by = NULL,
                          expires_at = EXCLUDED.expires_at,
                          created_at = NOW()
            RETURNING *
        `, [randomUUID(), req.params.id, email, input.role, userId, input.expiresAt])
        rows.push(invite.rows[0] as OrganizationInviteRow)
    }

    await touchOrganization(req.params.id)
    logOrganizationEvent(req, 'organization_invites_created', req.params.id, userId, {
        inviteCount: rows.length,
        role: input.role,
        expiresAt: input.expiresAt,
    })
    return res.status(201).send({ invites: rows.map(toInvite) })
}

export async function postOrganizationInviteAccept(req: FastifyRequest<{ Params: InviteParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const result = await run(`
        WITH accepted_invite AS (
            UPDATE organization_invites
            SET status = 'accepted',
                accepted_at = NOW(),
                accepted_by = $2
            WHERE id = $1
              AND status = 'pending'
              AND expires_at > NOW()
            RETURNING *
        ),
        member AS (
            INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, joined_at)
            SELECT organization_id, $2, role, 'active', invited_by, NOW()
            FROM accepted_invite
            ON CONFLICT (organization_id, user_id)
            DO UPDATE SET role = CASE
                                WHEN organization_members.role = 'owner' THEN 'owner'
                                WHEN organization_members.role = 'admin' AND EXCLUDED.role IN ('member', 'viewer') THEN 'admin'
                                WHEN organization_members.role = 'member' AND EXCLUDED.role = 'viewer' THEN 'member'
                                ELSE EXCLUDED.role
                              END,
                          status = 'active',
                          invited_by = EXCLUDED.invited_by,
                          joined_at = NOW()
            RETURNING *
        )
        SELECT
            accepted_invite.id AS invite_id,
            accepted_invite.organization_id,
            accepted_invite.email,
            accepted_invite.role AS invite_role,
            accepted_invite.invited_by,
            accepted_invite.accepted_by,
            accepted_invite.status AS invite_status,
            accepted_invite.created_at AS invite_created_at,
            accepted_invite.expires_at,
            accepted_invite.accepted_at,
            member.user_id,
            member.role AS member_role,
            member.status AS member_status,
            member.joined_at,
            member.created_at AS member_created_at
        FROM accepted_invite
        JOIN member ON member.organization_id = accepted_invite.organization_id
    `, [req.params.inviteId, userId])

    if (!result.rows.length) {
        return res.status(404).send({ error: 'Pending invite not found.' })
    }

    const row = result.rows[0] as {
        invite_id: string
        organization_id: string
        email: string
        invite_role: OrganizationRole
        invited_by: string
        accepted_by: string
        invite_status: 'accepted'
        invite_created_at: string
        accepted_at: string
        expires_at: string
        user_id: string
        member_role: OrganizationRole
        member_status: 'active'
        joined_at: string
        member_created_at: string
    }

    await touchOrganization(row.organization_id)
    logOrganizationEvent(req, 'organization_invite_accepted', row.organization_id, userId, {
        inviteId: row.invite_id,
        role: row.member_role,
    })
    const organization = await loadOrganizationForMember(row.organization_id, userId)
    return res.send({
        invite: toInvite({
            id: row.invite_id,
            organization_id: row.organization_id,
            email: row.email,
            role: row.invite_role,
            invited_by: row.invited_by,
            accepted_by: row.accepted_by,
            status: row.invite_status,
            created_at: row.invite_created_at,
            expires_at: row.expires_at,
            accepted_at: row.accepted_at,
        }),
        membership: {
            organizationId: row.organization_id,
            userId: row.user_id,
            role: row.member_role,
            status: row.member_status,
            joinedAt: row.joined_at,
            createdAt: row.member_created_at,
        },
        organization: organization ? toOrganization(organization) : null,
    })
}

export async function getOrganizationWatchlists(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const kind = normalizeOptionalKind((req.query as { kind?: string } | undefined)?.kind)
    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND archived_at IS NULL
          AND ($2::text IS NULL OR kind = $2)
        ORDER BY kind ASC, value ASC
    `, [req.params.id, kind])

    return res.send({
        organization: toOrganization(organization),
        watchlistItems: (result.rows as OrganizationWatchlistRow[]).map(toWatchlistItem),
    })
}

export async function getOrganizationAlertReadiness(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND archived_at IS NULL
        ORDER BY kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const generatedAlertReferences = watchlistItems.map(item => buildOrganizationDwmAlertReference(organization, item))

    return res.send({
        organization: toOrganization(organization),
        alertReadiness: {
            schemaVersion: 'organization.dwm_alert_readiness.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            ready: generatedAlertReferences.length > 0,
            watchlistItemCount: generatedAlertReferences.length,
            generatedAlertReferences,
            downstreamFields: [
                'organizationId',
                'tenantId',
                'watchlistItemId',
                'watchlist.id',
                'watchlist.terms',
                'matchedTerm',
                'route',
                'casePath',
                'dedupeKey',
            ],
        },
    })
}

export async function postOrganizationWatchlist(req: FastifyRequest<{ Params: OrganizationParams, Body: WatchlistInput }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.id, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanWriteWatchlist(organization.role)) {
        return res.status(403).send({ error: 'Only organization owners, admins, and members can update watchlists.' })
    }

    let input
    try {
        input = normalizeWatchlistInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist item.' })
    }

    const existing = await run(`
        SELECT id
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND kind = $2
          AND lower(value) = lower($3)
          AND archived_at IS NULL
        LIMIT 1
    `, [req.params.id, input.kind, input.value])

    const result = existing.rows[0]
        ? await run(`
            UPDATE organization_watchlist_items
            SET value = $3,
                notes = $4,
                updated_at = NOW()
            WHERE id = $1
              AND organization_id = $2
            RETURNING *
        `, [existing.rows[0].id, req.params.id, input.value, input.notes])
        : await run(`
        INSERT INTO organization_watchlist_items (id, organization_id, kind, value, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [randomUUID(), req.params.id, input.kind, input.value, input.notes, userId])

    await touchOrganization(req.params.id)
    logOrganizationEvent(req, 'organization_watchlist_upserted', req.params.id, userId, {
        watchlistItemId: result.rows[0]?.id,
        kind: input.kind,
        value: input.value,
    })
    return res.status(201).send({ watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow) })
}

export async function deleteOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams }>, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const organization = await loadOrganizationForMember(req.params.organizationId, userId)
    if (!organization) {
        return res.status(404).send({ error: 'Organization not found.' })
    }

    if (!roleCanWriteWatchlist(organization.role)) {
        return res.status(403).send({ error: 'Only organization owners, admins, and members can update watchlists.' })
    }

    const result = await run(`
        UPDATE organization_watchlist_items
        SET archived_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND archived_at IS NULL
        RETURNING *
    `, [req.params.itemId, req.params.organizationId])

    if (!result.rows.length) {
        return res.status(404).send({ error: 'Watchlist item not found.' })
    }

    await touchOrganization(req.params.organizationId)
    logOrganizationEvent(req, 'organization_watchlist_archived', req.params.organizationId, userId, {
        watchlistItemId: req.params.itemId,
    })
    return res.send({ watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow) })
}

async function loadOrganizationForMember(organizationId: string, userId: string) {
    const result = await run(`
        SELECT
            o.*,
            om.role,
            COUNT(DISTINCT active_members.user_id)::int AS member_count,
            COUNT(DISTINCT pending_invites.id)::int AS pending_invite_count
        FROM organizations o
        JOIN organization_members om
          ON om.organization_id = o.id
         AND om.user_id = $2
         AND om.status = 'active'
        LEFT JOIN organization_members active_members
          ON active_members.organization_id = o.id
         AND active_members.status = 'active'
        LEFT JOIN organization_invites pending_invites
          ON pending_invites.organization_id = o.id
         AND pending_invites.status = 'pending'
        WHERE o.id = $1
        GROUP BY o.id, om.role
        LIMIT 1
    `, [organizationId, userId])

    return result.rows[0] as OrganizationRow | undefined
}

async function uniqueOrganizationSlug(baseSlug: string) {
    const result = await run(`
        SELECT slug
        FROM organizations
        WHERE slug = $1 OR slug LIKE $2
    `, [baseSlug, `${baseSlug}-%`])
    const existing = new Set(result.rows.map((row: { slug: string }) => row.slug))
    if (!existing.has(baseSlug)) {
        return baseSlug
    }

    let suffix = 2
    while (existing.has(`${baseSlug}-${suffix}`)) {
        suffix += 1
    }

    return `${baseSlug}-${suffix}`
}

async function touchOrganization(organizationId: string) {
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organizationId])
}

function normalizeOptionalKind(value: unknown): WatchlistKind | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null
    }

    const kind = value.trim().toLowerCase()
    return ['company', 'domain', 'vendor'].includes(kind) ? kind as WatchlistKind : null
}

function logOrganizationEvent(req: FastifyRequest, action: string, organizationId: string, actorId: string, metadata: Record<string, unknown>) {
    void recordLog({
        service: 'hanasand-api',
        level: 'info',
        message: action,
        metadata: {
            category: 'organization',
            action,
            organizationId,
            actorId,
            ...metadata,
        },
    }).catch(error => req.log.warn({ error, action, organizationId }, 'Failed to persist organization event log'))
}
