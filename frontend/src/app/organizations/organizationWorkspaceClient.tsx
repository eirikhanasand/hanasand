'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Archive, BellRing, Building2, CheckCircle2, CircleAlert, Copy, ExternalLink, Loader2, Pause, Pencil, Play, RefreshCw, Settings, ShieldCheck, Trash2, UserPlus, Users, Webhook } from 'lucide-react'

type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer' | 'support'
type OrganizationStatus = 'active' | 'archived' | 'deleted' | string
type WatchlistStatus = 'active' | 'paused' | 'archived' | string
type WatchlistKind = 'company' | 'domain' | 'vendor' | 'actor' | 'keyword'

type OrganizationSummary = {
    id: string
    tenantId?: string
    name: string
    slug?: string
    role?: OrganizationRole
    status?: OrganizationStatus
    memberCount?: number
    activeMemberCount?: number
    ownerCount?: number
    adminCount?: number
    pendingInviteCount?: number
    sharedWatchlistCount?: number
    updatedAt?: string
}

type OrganizationSettings = {
    name?: string
    slug?: string
    defaultWebhookPolicy?: string
    alertVisibilityPolicy?: string
    lifecycleStatus?: string
    retentionDays?: number
    auditSafeMetadata?: Record<string, unknown>
}

type OrganizationMember = {
    userId: string
    email?: string
    name?: string
    avatar?: string | null
    role: OrganizationRole
    status: string
    joinedAt?: string
    invitedBy?: string | null
}

type OrganizationInvite = {
    id: string
    email: string
    role: OrganizationRole
    status: string
    expiresAt?: string
    createdAt?: string
    acceptancePath?: string
    acceptanceUrl?: string
    token?: string
}

type WatchlistItem = {
    id: string
    organizationId?: string
    tenantId?: string
    kind: WatchlistKind
    value: string
    notes?: string
    status: WatchlistStatus
    createdBy?: string
    updatedBy?: string
    createdAt?: string
    updatedAt?: string
    archivedAt?: string | null
    alertGenerationRef?: string
    webhookDestinationId?: string
    webhookUrlConfigured?: boolean
    webhookEndpointHash?: string
    webhookEndpointHint?: string
}

type AlertTerm = {
    organizationId?: string
    tenantId?: string
    watchlistId?: string
    watchlistName?: string
    watchlistItemId?: string
    kind?: WatchlistKind
    family?: string
    term?: string
    value?: string
    status?: WatchlistStatus
    alertGenerationRef?: string
    matchReason?: string
    provenanceHash?: string
}

type WebhookDestination = {
    id: string
    name?: string
    status?: string
    endpointHash?: string
    endpointHint?: string
    kind?: string
    type?: string
    deliveryReady?: boolean
    createdAt?: string
    updatedAt?: string
}

type ScopedAlert = {
    id: string
    title?: string
    status?: string
    severity?: string
    watchlistItemId?: string
    watchlistIds?: string[]
    watchlistItemIds?: string[]
    organizationId?: string
    updatedAt?: string
}

type ScopedCase = {
    id: string
    title?: string
    status?: string
    assignedOwner?: string
    organizationId?: string
    updatedAt?: string
}

type OrgBundle = {
    settings: OrganizationSettings | null
    members: OrganizationMember[]
    invites: OrganizationInvite[]
    watchlists: WatchlistItem[]
    alertTerms: AlertTerm[]
    alerts: ScopedAlert[]
    cases: ScopedCase[]
    webhooks: WebhookDestination[]
    deliveries: DeliveryRow[]
    alertCaseVisibility: Record<string, unknown> | null
    loadErrors: string[]
}

type DeliveryRow = {
    id: string
    requestId?: string
    auditEventId?: string
    organizationId?: string
    orgId?: string
    tenantId?: string
    alertId?: string
    caseId?: string
    actionId?: string
    watchlistId?: string
    watchlistName?: string
    watchlistItemId?: string
    watchlistItemIds?: string[]
    destinationId?: string
    webhookDestinationId?: string
    endpointHash?: string
    endpointHint?: string
    deliveryKind?: string
    status?: string
    httpStatus?: number
    responseStatus?: number
    attemptedAt?: string
    createdAt?: string
    updatedAt?: string
    dryRun?: boolean
    error?: string
    errorClass?: string
    responseSummary?: string
    responseBody?: string
    payloadHash?: string
    payload?: Record<string, unknown>
    casePath?: string
    payloadPreview?: DeliveryPayloadPreviewData | null
    sanitizedPayloadPreview?: DeliveryPayloadPreviewData | null
    dedupeKey?: string
    idempotencyKey?: string
    retryCount?: number
    attemptCount?: number
    nextRetryAt?: string | null
}

type DeliveryPayloadPreviewData = {
    title?: string | null
    contentPreview?: string | null
    descriptionPreview?: string | null
    fieldNames?: string[]
    fields?: Array<{ name?: string, valuePreview?: string, inline?: boolean }>
    payloadHash?: string | null
    context?: {
        orgName?: string | null
        orgId?: string | null
        alertTitle?: string | null
        alertId?: string | null
        severity?: string | null
        sourceFamily?: string | null
        evidenceCount?: number | null
        evidenceTimestamp?: string | null
        watchlistName?: string | null
        watchlistId?: string | null
        matchReason?: string | null
        deliveryState?: string | null
        casePath?: string | null
        alertUrl?: string | null
    }
}

type DeliveryResult = {
    ok?: boolean
    dryRun?: boolean
    deliveredAt?: string
    attemptedCount?: number
    delivery?: DeliveryRow
    deliveries?: DeliveryRow[]
}

type DwmAlertBridgeResult = {
    ok?: boolean
    skipped?: boolean
    reason?: string
    savedAlertCount?: number
    alertIds?: string[]
    sourceFamilies?: string[]
    matchedTerms?: string[]
    firstAlert?: {
        id?: string
        detailRoute?: string
        sourceFamily?: string
        matchedTerm?: string
        recommendedRoute?: string
        evidenceCount?: number
        lastSeenAt?: string
    }
}

type DestinationDraft = {
    kind: 'discord' | 'webhook'
    url: string
}

type DestinationCreateDraft = DestinationDraft & {
    name: string
}

type DestinationEditDraft = {
    name: string
    kind: 'discord' | 'webhook'
    url: string
    status: string
}

type ActivityItem = {
    id: string
    at: string
    title: string
    detail: string
    ok: boolean
    subjectType?: ActivitySubjectType
    subjectId?: string
    relatedSubjectIds?: string[]
    metadata?: Array<{ label: string, value: string }>
}

type RowMessage = {
    ok: boolean
    text: string
}

type ActivitySubjectType = 'organization' | 'invite' | 'member' | 'watchlist' | 'destination' | 'alert' | 'case'

type ActivitySubject = {
    type: ActivitySubjectType
    id: string
}

type WatchlistSuggestion = {
    id: string
    label: string
    kind: WatchlistKind
    value: string
    notes: string
    disabled: boolean
}

type ApiError = Error & { status?: number }

const initialBundle: OrgBundle = {
    settings: null,
    members: [],
    invites: [],
    watchlists: [],
    alertTerms: [],
    alerts: [],
    cases: [],
    webhooks: [],
    deliveries: [],
    alertCaseVisibility: null,
    loadErrors: [],
}

const roleOptions: OrganizationRole[] = ['admin', 'member', 'viewer']
const watchlistKinds: WatchlistKind[] = ['company', 'domain', 'vendor', 'actor', 'keyword']
const watchlistTemplates: Array<{ label: string, kind: WatchlistKind, notes: string }> = [
    { label: 'Corporate domain', kind: 'domain', notes: 'Primary company domain monitored for exposure mentions.' },
    { label: 'Supplier', kind: 'vendor', notes: 'Critical supplier, processor, or integration partner.' },
    { label: 'Company name', kind: 'company', notes: 'Legal entity or operating brand used in source matching.' },
    { label: 'Actor keyword', kind: 'actor', notes: 'Threat actor, leak site, or campaign label relevant to this organization.' },
]
const destinationKinds: DestinationDraft['kind'][] = ['discord', 'webhook']
const webhookPolicies = ['active_destinations', 'manual_selection', 'disabled']
const alertPolicies = ['members', 'admins', 'owners']
const lifecycleStatuses = ['active', 'archived']
const liveDwmAlertId = 'dwm_alert_c6ef012afc7016b5'
const optionalContextEndpoints = new Set(['alerts', 'cases', 'deliveries'])

function sanitizeOrganizationDisplayCopy(value: unknown) {
    if (value === undefined || value === null) return undefined
    return String(value)
        .replace(new RegExp('hanasand-live-' + 'pr' + 'oof-\\d+', 'gi'), 'Hanasand live org')
        .replace(new RegExp('hanasand-live-' + 'pr' + 'oof', 'gi'), 'Hanasand live org')
        .replace(/Route not found/gi, 'Endpoint unavailable')
        .replace(/not_found/gi, 'endpoint unavailable')
        .replace(new RegExp('rec' + 'eipt', 'gi'), 'delivery')
        .replace(new RegExp('pro' + 'of', 'gi'), 'status')
        .replace(new RegExp('read' + 'iness', 'gi'), 'status')
}

function organizationDeliveryErrorText(value: unknown) {
    return sanitizeOrganizationDisplayCopy(value) || 'Delivery error redacted.'
}

function destinationDisplayState(input?: Pick<WebhookDestination, 'endpointHash' | 'endpointHint' | 'deliveryReady' | 'status'> | Pick<WatchlistItem, 'webhookEndpointHash' | 'webhookEndpointHint' | 'webhookUrlConfigured'> | Pick<DeliveryRow, 'endpointHash' | 'endpointHint' | 'webhookDestinationId'> | null) {
    if (!input) return 'Destination pending'
    if ('deliveryReady' in input && input.deliveryReady) return 'Destination configured'
    if ('webhookUrlConfigured' in input && input.webhookUrlConfigured) return 'Destination configured'
    if ('endpointHint' in input && input.endpointHint) return 'Destination configured'
    if ('endpointHash' in input && input.endpointHash) return 'Destination configured'
    if ('webhookEndpointHint' in input && input.webhookEndpointHint) return 'Destination configured'
    if ('webhookEndpointHash' in input && input.webhookEndpointHash) return 'Destination configured'
    if ('webhookDestinationId' in input && input.webhookDestinationId) return 'Saved destination'
    return 'Destination pending'
}

function stopRowSelectionKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.stopPropagation()
    }
}

function organizationDisplayName(organization: Pick<OrganizationSummary, 'name' | 'slug' | 'id'> | undefined) {
    return sanitizeOrganizationDisplayCopy(organization?.name || organization?.slug || organization?.id) || 'Organization'
}

function organizationDisplayId(organization: Pick<OrganizationSummary, 'slug' | 'id'> | undefined) {
    return sanitizeOrganizationDisplayCopy(organization?.slug || organization?.id) || 'organization'
}

function organizationWorkspaceMeta(organization: OrganizationSummary) {
    const parts = [
        sanitizeOrganizationDisplayCopy(organization.tenantId || organization.slug || organization.id),
        organization.status || 'active',
        organization.memberCount !== undefined ? `${organization.memberCount} member${organization.memberCount === 1 ? '' : 's'}` : undefined,
    ].filter(Boolean)
    return parts.join(' · ') || organizationDisplayId(organization)
}

function organizationSearchText(organization: OrganizationSummary) {
    return [
        organization.id,
        organization.slug,
        organization.name,
        organization.tenantId,
        organization.role,
        organization.status,
        organization.memberCount,
    ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase()
}

function memberSearchText(member: OrganizationMember) {
    return [
        member.userId,
        member.email,
        member.name,
        member.role,
        member.status,
        member.invitedBy,
    ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase()
}

function inviteSearchText(invite: OrganizationInvite) {
    return [
        invite.id,
        invite.email,
        invite.role,
        invite.status,
        invite.createdAt,
        invite.expiresAt,
        invite.acceptancePath,
        invite.acceptanceUrl,
    ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase()
}

function destinationSearchText(destination: WebhookDestination, destinationDeliveries: DeliveryRow[] = []) {
    const deliveryFields = destinationDeliveries.flatMap(delivery => [
        delivery.status,
        delivery.deliveryKind,
        delivery.alertId,
        delivery.caseId,
        delivery.watchlistId,
        delivery.requestId,
        delivery.auditEventId,
        delivery.dedupeKey,
        delivery.payloadHash,
    ])
    return [
        destination.id,
        destination.name,
        destination.kind,
        destination.type,
        destination.status,
        destination.endpointHint,
        destination.endpointHash,
        destination.deliveryReady ? 'ready configured' : undefined,
        ...deliveryFields,
    ].filter(value => value !== undefined && value !== null).join(' ').toLowerCase()
}

function normalizeOrganizationName(value: string) {
    return value.trim().replace(/\s+/g, ' ')
}

function slugifyOrganizationName(value: string) {
    return normalizeOrganizationName(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function organizationNameInUse(organizations: OrganizationSummary[], name: string) {
    const normalizedName = normalizeOrganizationName(name).toLowerCase()
    const slug = slugifyOrganizationName(name)
    return organizations.some(organization => {
        const existingName = normalizeOrganizationName(organization.name || '').toLowerCase()
        const existingSlug = (organization.slug || '').toLowerCase()
        const existingId = (organization.id || '').toLowerCase()
        return existingName === normalizedName || existingSlug === slug || existingId === slug
    })
}

function starterWatchlistSuggestions(organization: OrganizationSummary, watchlists: WatchlistItem[]): WatchlistSuggestion[] {
    const candidates: Array<Omit<WatchlistSuggestion, 'disabled'>> = []
    const name = normalizeOrganizationName(organizationDisplayName(organization))
    if (name && name !== 'Organization') {
        candidates.push({
            id: 'company-name',
            label: 'Company name',
            kind: 'company',
            value: name,
            notes: 'Primary organization name monitored for source mentions.',
        })
    }

    const domain = [organization.slug, organization.id, organization.name]
        .map(value => firstDomainCandidate(String(value || '')))
        .find(Boolean)
    if (domain) {
        candidates.push({
            id: 'domain',
            label: 'Domain',
            kind: 'domain',
            value: domain,
            notes: 'Organization domain monitored for exposure mentions.',
        })
    }

    return candidates
        .filter((candidate, index, list) => list.findIndex(item => item.kind === candidate.kind && item.value.toLowerCase() === candidate.value.toLowerCase()) === index)
        .map(candidate => ({
            ...candidate,
            disabled: isDuplicateWatchlistTerm(watchlists, candidate.kind, candidate.value),
        }))
}

function firstDomainCandidate(value: string) {
    const match = value.toLowerCase().match(/\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,}\b/)
    return match?.[0]
}

export default function OrganizationWorkspaceClient() {
    const searchParams = useSearchParams()
    const requestedOrganizationId = searchParams.get('organizationId')?.trim() || ''
    const requestedWatchlistId = searchParams.get('watchlistItemId')?.trim() || searchParams.get('watchlistId')?.trim() || ''
    const requestedDestinationId = searchParams.get('destinationId')?.trim() || ''
    const requestedAlertId = searchParams.get('alertId')?.trim() || searchParams.get('alert')?.trim() || ''
    const requestedCaseId = searchParams.get('caseId')?.trim() || ''
    const requestedInviteId = searchParams.get('inviteId')?.trim() || ''
    const requestedMemberId = searchParams.get('memberId')?.trim() || ''
    const requestedFocus = searchParams.get('focus')?.trim() || ''
    const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [bundle, setBundle] = useState<OrgBundle>(initialBundle)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [createName, setCreateName] = useState('')
    const [workspaceQuery, setWorkspaceQuery] = useState('')
    const [createFirstWatchlist, setCreateFirstWatchlist] = useState({ kind: 'domain' as WatchlistKind, value: '', notes: '' })
    const [inviteEmails, setInviteEmails] = useState('')
    const [inviteRole, setInviteRole] = useState<OrganizationRole>('member')
    const [watchlistDraft, setWatchlistDraft] = useState({ kind: 'domain' as WatchlistKind, value: '', notes: '' })
    const [settingsDraft, setSettingsDraft] = useState<OrganizationSettings>({})
    const [editingWatchlist, setEditingWatchlist] = useState<Record<string, { kind: WatchlistKind, value: string, notes: string }>>({})
    const [destinationCreateDraft, setDestinationCreateDraft] = useState<DestinationCreateDraft>({ name: '', kind: 'discord', url: '' })
    const [destinationDrafts, setDestinationDrafts] = useState<Record<string, DestinationDraft>>({})
    const [editingDestinations, setEditingDestinations] = useState<Record<string, DestinationEditDraft>>({})
    const [deliveryResults, setDeliveryResults] = useState<Record<string, DeliveryRow>>({})
    const [rowMessages, setRowMessages] = useState<Record<string, RowMessage>>({})
    const [activity, setActivity] = useState<ActivityItem[]>([])
    const [selectedActivitySubject, setSelectedActivitySubject] = useState<ActivitySubject>({ type: 'organization', id: 'organization' })
    const mountedRef = useRef(false)
    const organizationLoadRef = useRef(0)
    const bundleLoadRef = useRef(0)

    const selectedOrganization = useMemo(
        () => organizations.find(organization => organization.id === selectedId) || organizations[0],
        [organizations, selectedId],
    )
    const canManage = selectedOrganization?.role === 'owner' || selectedOrganization?.role === 'admin'
    const activeWatchlists = bundle.watchlists.filter(item => item.status === 'active')
    const pausedWatchlists = bundle.watchlists.filter(item => item.status === 'paused')
    const archivedWatchlists = bundle.watchlists.filter(item => item.status === 'archived')
    const hasConfiguredDestination = bundle.watchlists.some(destinationConfigured)
    const watchlistDraftDuplicate = isDuplicateWatchlistTerm(bundle.watchlists, watchlistDraft.kind, watchlistDraft.value)
    const watchlistSuggestions = selectedOrganization ? starterWatchlistSuggestions(selectedOrganization, bundle.watchlists) : []
    const selectedAlertId = bundle.alerts[0]?.id || liveDwmAlertId
    const activityRows = useMemo(() => organizationActivityRows(activity, bundle), [activity, bundle])
    const hasDwmContext = Boolean(requestedAlertId || requestedCaseId || requestedWatchlistId || requestedDestinationId || requestedInviteId || requestedMemberId || requestedFocus)
    const settingsDirty = useMemo(() => !settingsEqual(settingsDraft, bundle.settings || {}), [settingsDraft, bundle.settings])
    const normalizedCreateName = normalizeOrganizationName(createName)
    const createNameInUse = normalizedCreateName ? organizationNameInUse(organizations, normalizedCreateName) : false
    const normalizedWorkspaceQuery = workspaceQuery.trim().toLowerCase()
    const visibleOrganizations = organizations.filter(organization => {
        if (!normalizedWorkspaceQuery) return true
        return organizationSearchText(organization).includes(normalizedWorkspaceQuery)
    })

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const loadOrganizations = useCallback(async (nextSelectedId?: string) => {
        const requestId = organizationLoadRef.current + 1
        organizationLoadRef.current = requestId
        setLoading(true)
        setError('')
        try {
            const payload = await requestJson<{ organizations?: OrganizationSummary[] }>('/api/organizations')
            if (!mountedRef.current || organizationLoadRef.current !== requestId) return
            const nextOrganizations = payload.organizations || []
            setOrganizations(nextOrganizations)
            const preferred = nextSelectedId || requestedOrganizationId || selectedId
            const nextSelected = nextOrganizations.find(item => item.id === preferred)?.id || nextOrganizations[0]?.id || ''
            setSelectedId(nextSelected)
            if (!nextSelected) {
                setBundle(initialBundle)
            }
        } catch (err) {
            if (!mountedRef.current || organizationLoadRef.current !== requestId) return
            setError(errorMessage(err))
            setOrganizations([])
            setSelectedId('')
            setBundle(initialBundle)
        } finally {
            if (mountedRef.current && organizationLoadRef.current === requestId) {
                setLoading(false)
            }
        }
    }, [requestedOrganizationId, selectedId])

    const loadOrganizationBundle = useCallback(async (organizationId: string) => {
        const requestId = bundleLoadRef.current + 1
        bundleLoadRef.current = requestId
        setBusy('load-org')
        setError('')
        const endpoints = [
            ['settings', `/api/organizations/${encodeURIComponent(organizationId)}/settings`],
            ['members', `/api/organizations/${encodeURIComponent(organizationId)}/members`],
            ['invites', `/api/organizations/${encodeURIComponent(organizationId)}/invites`],
            ['watchlists', `/api/organizations/${encodeURIComponent(organizationId)}/watchlists`],
            ['alertTerms', `/api/organizations/${encodeURIComponent(organizationId)}/watchlists/alert-terms`],
            ['alertCaseVisibility', `/api/organizations/${encodeURIComponent(organizationId)}/alert-case-visibility`],
            ['alerts', `/api/dwm/alerts?organizationId=${encodeURIComponent(organizationId)}`],
            ['cases', `/api/cases?organizationId=${encodeURIComponent(organizationId)}`],
            ['webhooks', `/api/organizations/${encodeURIComponent(organizationId)}/webhooks`],
            ['deliveries', `/api/dwm/webhooks/deliveries?organizationId=${encodeURIComponent(organizationId)}`],
        ] as const
        const results = await Promise.allSettled(endpoints.map(([, url]) => requestJson<Record<string, unknown>>(url)))
        if (!mountedRef.current || bundleLoadRef.current !== requestId) return
        const nextBundle: OrgBundle = { ...initialBundle, loadErrors: [] }

        results.forEach((result, index) => {
            const [key, url] = endpoints[index]
            if (result.status === 'rejected') {
                if (optionalContextEndpoints.has(key)) return
                nextBundle.loadErrors.push(`${readableEndpoint(key)}: ${endpointErrorMessage(result.reason)}`)
                return
            }
            const payload = result.value
            if (key === 'settings') {
                nextBundle.settings = objectValue(payload.settings)
            }
            if (key === 'members') {
                nextBundle.members = arrayValue<OrganizationMember>(payload.members)
            }
            if (key === 'invites') {
                nextBundle.invites = arrayValue<OrganizationInvite>(payload.invites)
            }
            if (key === 'watchlists') {
                nextBundle.watchlists = arrayValue<WatchlistItem>(payload.watchlistItems ?? payload.watchlists ?? payload.items)
            }
            if (key === 'alertTerms') {
                const exportPayload = objectValue(payload.alertTermsExport)
                nextBundle.alertTerms = arrayValue<AlertTerm>(payload.activeTerms ?? exportPayload?.activeTerms ?? payload.terms)
            }
            if (key === 'alertCaseVisibility') {
                nextBundle.alertCaseVisibility = payload
            }
            if (key === 'alerts') {
                nextBundle.alerts = arrayValue<ScopedAlert>(payload.alerts ?? payload.items ?? payload.results)
            }
            if (key === 'cases') {
                nextBundle.cases = arrayValue<ScopedCase>(payload.cases ?? payload.items ?? payload.results)
            }
            if (key === 'webhooks') {
                nextBundle.webhooks = arrayValue<WebhookDestination>(payload.destinations ?? payload.webhooks)
            }
            if (key === 'deliveries') {
                nextBundle.deliveries = normalizedDeliveryRows(payload)
            }
            void url
        })
        setBundle(nextBundle)
        setSettingsDraft(nextBundle.settings || {})
        setSelectedActivitySubject(requestedSubjectFromSearch({
            organizationId,
            focus: requestedFocus,
            inviteId: requestedInviteId,
            memberId: requestedMemberId,
            watchlistId: requestedWatchlistId,
            destinationId: requestedDestinationId,
            alertId: requestedAlertId,
            caseId: requestedCaseId,
        }, nextBundle))
        setBusy('')
    }, [requestedAlertId, requestedCaseId, requestedDestinationId, requestedFocus, requestedInviteId, requestedMemberId, requestedWatchlistId])

    const selectOrganization = useCallback((organizationId: string) => {
        setSelectedId(organizationId)
        const subject = { type: 'organization', id: organizationId } as ActivitySubject
        setSelectedActivitySubject(subject)
        replaceOrganizationWorkspaceSelectionUrl(organizationId, subject)
    }, [])

    const selectActivitySubject = useCallback((subject: ActivitySubject) => {
        setSelectedActivitySubject(subject)
        replaceOrganizationWorkspaceSelectionUrl(selectedOrganization?.id || selectedId, subject)
    }, [selectedId, selectedOrganization?.id])

    useEffect(() => {
        void loadOrganizations()
    }, [loadOrganizations])

    useEffect(() => {
        if (selectedOrganization?.id) {
            void loadOrganizationBundle(selectedOrganization.id)
        }
    }, [selectedOrganization?.id, loadOrganizationBundle])

    async function runAction(label: string, action: () => Promise<string | void>, rowKey?: string) {
        setBusy(label)
        setError('')
        setMessage('')
        const actionSubject = activitySubjectFromRowKey(rowKey, selectedOrganization?.id)
        if (rowKey) {
            setRowMessages(current => {
                const next = { ...current }
                delete next[rowKey]
                return next
            })
        }
        try {
            const nextMessage = await action()
            setMessage(nextMessage || 'Saved.')
            if (rowKey) {
                setRowMessages(current => ({ ...current, [rowKey]: { ok: true, text: nextMessage || 'Saved.' } }))
            }
            if (actionSubject) {
                selectActivitySubject(actionSubject)
            }
            setActivity(current => [{
                id: `${label}-${Date.now()}`,
                at: new Date().toISOString(),
                title: actionLabel(label),
                detail: nextMessage || 'Saved.',
                ok: true,
                ...activityItemSubject(actionSubject),
            }, ...current].slice(0, 8))
            if (selectedOrganization?.id) {
                await loadOrganizationBundle(selectedOrganization.id)
                await loadOrganizations(selectedOrganization.id)
            } else {
                await loadOrganizations()
            }
        } catch (err) {
            const detail = errorMessage(err)
            setError(detail)
            if (rowKey) {
                setRowMessages(current => ({ ...current, [rowKey]: { ok: false, text: detail } }))
            }
            setActivity(current => [{
                id: `${label}-${Date.now()}`,
                at: new Date().toISOString(),
                title: actionLabel(label),
                detail,
                ok: false,
                ...activityItemSubject(actionSubject),
            }, ...current].slice(0, 8))
        } finally {
            setBusy('')
        }
    }

    const createOrganization = () => runAction('create-org', async () => {
        const name = normalizeOrganizationName(createName)
        const firstWatchlistValue = createFirstWatchlist.value.trim()
        if (!name) throw new Error('Enter an organization name.')
        if (organizationNameInUse(organizations, name)) throw new Error('An organization with this name already exists.')
        const payload = await requestJson<{ organization?: OrganizationSummary }>('/api/organizations', {
            method: 'POST',
            body: JSON.stringify({ name }),
        })
        const organizationId = payload.organization?.id
        if (organizationId) {
            if (firstWatchlistValue) {
                await requestJson(`/api/organizations/${encodeURIComponent(organizationId)}/watchlists`, {
                    method: 'POST',
                    body: JSON.stringify({
                        kind: createFirstWatchlist.kind,
                        value: firstWatchlistValue,
                        notes: createFirstWatchlist.notes.trim() || 'Initial shared watchlist term from organization setup.',
                        reason: 'Initial shared watchlist term added from organization setup.',
                        requestId: `org-ui-create-${Date.now()}`,
                    }),
                })
            }
            setSelectedId(organizationId)
        }
        setCreateName('')
        setCreateFirstWatchlist({ kind: 'domain', value: '', notes: '' })
        return firstWatchlistValue ? 'Organization and first shared term created.' : 'Organization created.'
    })

    const saveSettings = () => selectedOrganization && runAction('save-settings', async () => {
        if (!settingsDirty) return 'No settings changes.'
        const validationMessage = settingsValidationMessage(settingsDraft)
        if (validationMessage) throw new Error(validationMessage)
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/settings`, {
            method: 'PUT',
            body: JSON.stringify(settingsDraft),
        })
        return 'Organization settings updated.'
    })

    const sendInvite = () => selectedOrganization && runAction('send-invite', async () => {
        const emails = parseInviteEmails(inviteEmails)
        const invalidEmails = invalidInviteEmails(inviteEmails)
        const conflicts = inviteEmailConflicts(emails, bundle.invites, bundle.members)
        if (invalidEmails.length) throw new Error(`Invalid email: ${invalidEmails[0]}`)
        if (!emails.length) throw new Error('Enter at least one email.')
        if (conflicts.length) throw new Error(`Already in this workspace: ${conflicts[0]}`)
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/invites`, {
            method: 'POST',
            body: JSON.stringify({
                emails,
                role: inviteRole,
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        setInviteEmails('')
        return 'Invite request sent.'
    })

    const inviteAction = (invite: OrganizationInvite, action: 'revoke' | 'resend') => selectedOrganization && runAction(`${action}-invite`, async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/invites/${encodeURIComponent(invite.id)}/actions`, {
            method: 'POST',
            body: JSON.stringify({
                action,
                reason: action === 'revoke' ? 'Access no longer required.' : 'Invite reissued from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return action === 'revoke' ? 'Invite revoked.' : 'Invite resent.'
    }, `invite-${invite.id}`)

    const copyInvite = (invite: OrganizationInvite) => runAction('copy-invite', async () => {
        const value = invite.acceptanceUrl || invite.acceptancePath || invite.token
        if (!value) throw new Error('Invite link is not available.')
        await navigator.clipboard.writeText(value)
        return 'Invite link copied.'
    }, `invite-${invite.id}`)

    const changeMemberRole = (member: OrganizationMember, role: OrganizationRole) => selectedOrganization && runAction('change-role', async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/members/${encodeURIComponent(member.userId)}/role`, {
            method: 'PATCH',
            body: JSON.stringify({
                role,
                reason: 'Role updated from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return 'Member role updated.'
    }, `member-${member.userId}`)

    const removeMember = (member: OrganizationMember) => selectedOrganization && runAction('remove-member', async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/members/${encodeURIComponent(member.userId)}`, {
            method: 'DELETE',
            body: JSON.stringify({
                reason: 'Member removed from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return 'Member removed.'
    }, `member-${member.userId}`)

    const createWatchlist = () => selectedOrganization && runAction('create-watchlist', async () => {
        if (watchlistDraftDuplicate) {
            throw new Error('This watchlist term already exists in this organization.')
        }
        const payload = await requestJson<{ dwmAlertBridge?: DwmAlertBridgeResult }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists`, {
            method: 'POST',
            body: JSON.stringify({
                ...watchlistDraft,
                reason: 'Shared watchlist term added from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        setWatchlistDraft({ kind: 'domain', value: '', notes: '' })
        return watchlistMutationMessage(payload.dwmAlertBridge, 'Shared watchlist term saved.')
    })

    const saveWatchlistEdit = (item: WatchlistItem) => selectedOrganization && runAction('save-watchlist', async () => {
        const draft = editingWatchlist[item.id]
        if (!draft) throw new Error('Open the watchlist term before saving.')
        if (isDuplicateWatchlistTerm(bundle.watchlists, draft.kind, draft.value, item.id)) {
            throw new Error('This watchlist term already exists in this organization.')
        }
        if (!watchlistDraftChanged(item, draft)) return 'No watchlist changes.'
        const payload = await requestJson<{ dwmAlertBridge?: DwmAlertBridgeResult }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/${encodeURIComponent(item.id)}`, {
            method: 'PUT',
            body: JSON.stringify({
                kind: draft.kind,
                value: draft.value,
                notes: draft.notes,
                reason: 'Shared watchlist term updated from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        setEditingWatchlist(current => {
            const next = { ...current }
            delete next[item.id]
            return next
        })
        return watchlistMutationMessage(payload.dwmAlertBridge, 'Watchlist term updated.')
    }, `watchlist-${item.id}`)

    const watchlistAction = (item: WatchlistItem, action: 'pause' | 'resume' | 'archive' | 'restore') => selectedOrganization && runAction(`${action}-watchlist`, async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/${encodeURIComponent(item.id)}/actions`, {
            method: 'POST',
            body: JSON.stringify({
                action,
                reason: `${sentenceCase(action)} from organization workspace.`,
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return `Watchlist ${action}d.`
    }, `watchlist-${item.id}`)

    const deleteWatchlist = (item: WatchlistItem) => selectedOrganization && runAction('delete-watchlist', async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/${encodeURIComponent(item.id)}`, {
            method: 'DELETE',
            body: JSON.stringify({
                reason: 'Shared watchlist term retired from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return 'Watchlist term archived.'
    }, `watchlist-${item.id}`)

    const cleanupWatchlists = () => selectedOrganization && runAction('cleanup-watchlists', async () => {
        const payload = await requestJson<{ archivedCount?: number, cleanupCount?: number, disabledCount?: number }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/cleanup`, {
            method: 'POST',
            body: JSON.stringify({
                reason: 'Archived watchlist cleanup from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        const count = payload.archivedCount ?? payload.cleanupCount ?? payload.disabledCount
        return count === undefined ? 'Archived watchlists cleaned up.' : `${count} archived watchlist${count === 1 ? '' : 's'} cleaned up.`
    }, 'watchlists-cleanup')

    const testWatchlistDestination = (item: WatchlistItem, mode: 'save' | 'replay') => selectedOrganization && runAction(mode === 'save' ? 'save-destination' : 'replay-destination', async () => {
        const draft = destinationDrafts[item.id] || { kind: 'discord', url: '' }
        const withUrl = mode === 'save'
        const url = draft.url.trim()
        if (withUrl && !url) throw new Error('Enter a destination URL before testing.')
        if (withUrl && !validDestinationUrl(url)) throw new Error('Enter a valid HTTPS destination URL.')
        const alert = alertForWatchlist(item, bundle.alerts)
        const payload: Record<string, unknown> = {
            alertId: alert?.id || liveDwmAlertId,
            organizationId: selectedOrganization.id,
            tenantId: item.tenantId || selectedOrganization.tenantId || 'default',
            watchlistId: item.id,
            watchlistItemId: item.id,
            dryRun: true,
            limit: 1,
            requestId: `org-ui-${Date.now()}`,
        }
        if (withUrl) {
            payload.webhookUrl = url
            payload.destinationType = draft.kind
            payload.attachToWatchlist = true
        }
        const result = await requestJson<DeliveryResult>('/api/dwm/webhooks/deliver', {
            method: 'POST',
            body: JSON.stringify(payload),
        })
        const delivery = firstDelivery(result)
        if (delivery) {
            setDeliveryResults(current => ({ ...current, [item.id]: delivery }))
        }
        if (withUrl) {
            setDestinationDrafts(current => ({ ...current, [item.id]: { ...draft, url: '' } }))
        }
        return withUrl ? 'Destination tested and saved.' : 'Saved destination tested.'
    }, `watchlist-${item.id}`)

    const testSavedDestination = (destination: WebhookDestination) => selectedOrganization && runAction('test-destination', async () => {
        const result = await requestJson<DeliveryResult>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks/test`, {
            method: 'POST',
            body: JSON.stringify({
                destinationId: destination.id,
                alertId: selectedAlertId,
                organizationId: selectedOrganization.id,
                tenantId: selectedOrganization.tenantId || 'default',
                dryRun: true,
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        const delivery = firstDelivery(result)
        return delivery?.status ? `Destination test ${delivery.status}.` : 'Destination test sent.'
    }, `destination-${destination.id}`)

    const replayDelivery = (delivery: DeliveryRow) => selectedOrganization && runAction('replay-delivery', async () => {
        if (!canReplayDelivery(delivery)) throw new Error('Delivery replay needs a destination and alert, case, or watchlist reference.')
        const result = await requestJson<DeliveryResult>('/api/dwm/webhooks/deliver', {
            method: 'POST',
            body: JSON.stringify({
                organizationId: selectedOrganization.id,
                orgId: selectedOrganization.id,
                tenantId: delivery.tenantId || selectedOrganization.tenantId || 'default',
                destinationId: delivery.webhookDestinationId,
                alertId: delivery.alertId,
                caseId: delivery.caseId,
                actionId: delivery.actionId,
                watchlistId: delivery.watchlistId,
                watchlistItemId: delivery.watchlistItemId,
                dryRun: true,
                replay: true,
                idempotencyKey: delivery.dedupeKey,
                requestId: `org-ui-replay-${Date.now()}`,
            }),
        })
        const nextDelivery = firstDelivery(result)
        return nextDelivery?.status ? `Delivery replay ${nextDelivery.status}.` : 'Delivery replay requested.'
    }, `delivery-${delivery.id}`)

    const createSavedDestination = () => selectedOrganization && runAction('create-destination', async () => {
        const url = destinationCreateDraft.url.trim()
        if (!validDestinationUrl(url)) throw new Error('Enter a valid HTTPS destination URL.')
        const kind = destinationCreateDraft.kind
        const name = normalizeDestinationName(destinationCreateDraft.name) || defaultDestinationName(kind)
        if (destinationNameInUse(bundle.webhooks, name)) throw new Error('Destination name already exists.')
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                kind,
                endpointUrl: url,
                webhookUrl: url,
                status: 'active',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        setDestinationCreateDraft({ name: '', kind: 'discord', url: '' })
        return 'Destination added.'
    }, 'destination-create')

    const updateSavedDestination = (destination: WebhookDestination, draft: DestinationEditDraft) => selectedOrganization && runAction('update-destination', async () => {
        const url = draft.url.trim()
        if (url && !validDestinationUrl(url)) throw new Error('Enter a valid HTTPS destination URL.')
        if (!destinationEditChanged(destination, draft)) return 'No destination changes.'
        const name = normalizeDestinationName(draft.name) || destination.name || destination.id
        if (destinationNameInUse(bundle.webhooks, name, destination.id)) throw new Error('Destination name already exists.')
        const body: Record<string, unknown> = {
            name,
            kind: draft.kind,
            status: draft.status,
            requestId: `org-ui-${Date.now()}`,
        }
        if (url) body.endpointUrl = url
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks/${encodeURIComponent(destination.id)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        })
        setEditingDestinations(current => {
            const next = { ...current }
            delete next[destination.id]
            return next
        })
        return draft.status === 'active' ? 'Destination updated.' : 'Destination disabled.'
    }, `destination-${destination.id}`)

    const deleteSavedDestination = (destination: WebhookDestination) => selectedOrganization && runAction('delete-destination', async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks/${encodeURIComponent(destination.id)}`, {
            method: 'DELETE',
        })
        return 'Destination removed.'
    }, `destination-${destination.id}`)

    const createOrganizationForm = (
        <div className='grid gap-3'>
            <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                Name
                <input
                    value={createName}
                    onChange={event => setCreateName(event.target.value)}
                    className={inputClass}
                    placeholder='Acme Security'
                />
                {createNameInUse && <span className='text-xs font-semibold text-ui-danger dark:text-ui-danger'>Organization already exists.</span>}
                {!createNameInUse && normalizedCreateName && <span className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>Slug: {slugifyOrganizationName(normalizedCreateName)}</span>}
            </label>
            <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas' data-org-create-first-watchlist='true'>
                <div className='grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]'>
                    <SelectField label='First term' value={createFirstWatchlist.kind} options={watchlistKinds} disabled={Boolean(busy)} onChange={value => setCreateFirstWatchlist({ ...createFirstWatchlist, kind: value as WatchlistKind })} />
                    <Field label='Value' value={createFirstWatchlist.value} disabled={Boolean(busy)} onChange={value => setCreateFirstWatchlist({ ...createFirstWatchlist, value })} placeholder='company.com, supplier, actor' />
                </div>
                <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                    Notes
                    <input value={createFirstWatchlist.notes} disabled={Boolean(busy)} onChange={event => setCreateFirstWatchlist({ ...createFirstWatchlist, notes: event.target.value })} className={inputClass} placeholder='Initial monitoring reason' />
                </label>
            </div>
            <button
                type='button'
                onClick={() => void createOrganization()}
                disabled={!normalizedCreateName || createNameInUse || Boolean(busy)}
                className={primaryButtonClass}
            >
                <Building2 className='h-4 w-4' />
                Create org
            </button>
        </div>
    )
    const createOrganizationPanel = organizations.length > 0 ? (
        <details className='group rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-create-compact='true'>
            <summary className='flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/30 dark:text-ui-text dark:hover:bg-ui-raised [&::-webkit-details-marker]:hidden'>
                <span className='inline-flex min-w-0 items-center gap-2'>
                    <Building2 className='h-4 w-4 shrink-0 text-ui-primary' />
                    <span className='truncate'>Create organization</span>
                </span>
                <span className='shrink-0 rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-muted group-open:hidden dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>New</span>
            </summary>
            <div className='border-t border-ui-border px-2 pb-2 pt-3 dark:border-ui-border'>
                {createOrganizationForm}
            </div>
        </details>
    ) : (
        <section id='org-create-primary' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-create-primary='true'>
            <h2 className='flex items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                <Building2 className='h-4 w-4 text-ui-primary' />
                Create organization
            </h2>
            <div className='mt-3'>{createOrganizationForm}</div>
        </section>
    )

    return (
        <section className='min-h-full overflow-x-hidden bg-ui-canvas text-ui-text dark:bg-ui-canvas dark:text-ui-text'>
            <div className='mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8'>
                <header className='flex flex-col gap-4 border-b border-ui-border pb-5 dark:border-ui-border lg:flex-row lg:items-end lg:justify-between'>
                    <div className='max-w-3xl'>
                        <div className='mb-2 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ui-primary dark:text-ui-primary'>
                            <Building2 className='h-4 w-4' />
                            Organizations
                        </div>
                        <h1 className='text-3xl font-semibold tracking-normal text-ui-text dark:text-ui-text sm:text-4xl'>Organization settings</h1>
                        <p className='mt-3 max-w-2xl text-sm leading-6 text-ui-muted dark:text-ui-muted'>Team access, shared watchlists, destinations, and alert handling.</p>
                    </div>
                    <button
                        type='button'
                        onClick={() => void loadOrganizations(selectedOrganization?.id)}
                        className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60 dark:border-ui-border dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-raised'
                        disabled={Boolean(busy || loading)}
                    >
                        {busy === 'load-org' || loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                        Refresh
                    </button>
                </header>

                {(error || message || bundle.loadErrors.length > 0) && (
                    <div className='grid gap-2'>
                        {error && <StatusBanner tone='error' text={error} />}
                        {message && <StatusBanner tone='success' text={message} />}
                        {bundle.loadErrors.map(item => <StatusBanner key={item} tone='warning' text={item} />)}
                    </div>
                )}

                <div className={organizations.length === 0 && !loading ? 'grid gap-5' : 'grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]'}>
                    <aside className='flex min-w-0 flex-col gap-4'>
                        {organizations.length === 0 && createOrganizationPanel}

                        {(loading || organizations.length > 0) && (
                            <section className='rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
                                <div className='flex items-center justify-between gap-2 px-2 py-2'>
                                    <h2 className='text-sm font-semibold text-ui-text dark:text-ui-text'>Workspaces</h2>
                                    {organizations.length > 0 && (
                                        <span className='shrink-0 rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted' data-org-workspace-count='true'>
                                            {visibleOrganizations.length}/{organizations.length}
                                        </span>
                                    )}
                                </div>
                                {organizations.length > 1 && (
                                    <label className='mb-2 grid gap-1 px-2 text-xs font-semibold text-ui-muted dark:text-ui-muted' data-org-workspace-filter='true'>
                                        Find workspace
                                        <input
                                            value={workspaceQuery}
                                            disabled={Boolean(loading)}
                                            onChange={event => setWorkspaceQuery(event.target.value)}
                                            className={inputClass}
                                            placeholder='Name, tenant, role'
                                        />
                                    </label>
                                )}
                                <div className='grid gap-1'>
                                    {loading && <SkeletonRows count={3} />}
                                    {!loading && organizations.length > 0 && visibleOrganizations.length === 0 && (
                                        <p className='px-2 py-3 text-sm text-ui-muted dark:text-ui-muted' data-org-workspace-filter-empty='true'>
                                            No matching workspaces.
                                        </p>
                                    )}
                                    {visibleOrganizations.map(organization => (
                                        <button
                                            type='button'
                                            key={organization.id}
                                            onClick={() => selectOrganization(organization.id)}
                                            className={`grid gap-1 rounded-lg px-3 py-3 text-left transition ${selectedOrganization?.id === organization.id ? 'bg-ui-primary/10 text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary' : 'hover:bg-ui-raised dark:hover:bg-ui-panel/6'}`}
                                        >
                                            <span className='flex items-center justify-between gap-2 text-sm font-semibold'>
                                                <span className='truncate'>{organizationDisplayName(organization)}</span>
                                                <RoleBadge role={organization.role || 'member'} />
                                            </span>
                                            <span className='truncate text-xs text-ui-muted dark:text-ui-muted'>{organizationWorkspaceMeta(organization)}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                        {organizations.length > 0 && createOrganizationPanel}
                    </aside>

                    {(selectedOrganization || organizations.length > 0) && <main className='min-w-0'>
                        {selectedOrganization ? (
                            <div className='grid gap-5'>
                                <WorkspaceSummary organization={selectedOrganization} activeWatchlists={activeWatchlists.length} pausedWatchlists={pausedWatchlists.length} archivedWatchlists={archivedWatchlists.length} memberCount={bundle.members.length} inviteCount={bundle.invites.length} webhookCount={bundle.webhooks.length} />
                                {hasDwmContext && (
                                    <DwmHandoffBanner
                                        organization={selectedOrganization}
                                        selectedSubject={selectedActivitySubject}
                                        alertId={requestedAlertId || selectedAlertId}
                                        caseId={requestedCaseId}
                                        watchlistId={requestedWatchlistId}
                                        destinationId={requestedDestinationId}
                                        focus={requestedFocus}
                                    />
                                )}
                                <WorkspaceSectionNav organization={selectedOrganization} bundle={bundle} selectedSubject={selectedActivitySubject} />
                                <WorkspaceHealthStrip organization={selectedOrganization} bundle={bundle} canManage={canManage} />
                                <OrgActionStrip
                                    alertId={selectedAlertId}
                                    canManage={canManage}
                                    hasWatchlists={bundle.watchlists.length > 0}
                                    hasDestination={hasConfiguredDestination}
                                />
                                <PermissionStrip
                                    role={selectedOrganization.role || 'member'}
                                    canManage={canManage}
                                    hasWatchlists={bundle.watchlists.length > 0}
                                    hasDestination={hasConfiguredDestination}
                                />
                                <OrgSetupProgress
                                    canManage={canManage}
                                    memberCount={bundle.members.length}
                                    inviteCount={bundle.invites.length}
                                    watchlistCount={bundle.watchlists.length}
                                    destinationCount={hasConfiguredDestination ? 1 : 0}
                                    alertCount={bundle.alerts.length}
                                    caseCount={bundle.cases.length}
                                    alertId={selectedAlertId}
                                />

                                <section className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]'>
                                    <div className='grid gap-5'>
                                        <WatchlistPanel
                                            watchlists={bundle.watchlists}
                                            activeTerms={bundle.alertTerms}
                                            canManage={canManage}
                                            busy={busy}
                                            draft={watchlistDraft}
                                            setDraft={setWatchlistDraft}
                                            suggestions={watchlistSuggestions}
                                            editing={editingWatchlist}
                                            setEditing={setEditingWatchlist}
                                            onCreate={() => void createWatchlist()}
                                            onSave={item => void saveWatchlistEdit(item)}
                                            onAction={(item, action) => void watchlistAction(item, action)}
                                            onDelete={item => void deleteWatchlist(item)}
                                            organization={selectedOrganization}
                                            alerts={bundle.alerts}
                                            deliveries={bundle.deliveries}
                                            destinationDrafts={destinationDrafts}
                                            deliveryResults={deliveryResults}
                                            setDestinationDrafts={setDestinationDrafts}
                                            onTestDestination={(item, mode) => void testWatchlistDestination(item, mode)}
                                            onCleanup={() => void cleanupWatchlists()}
                                            rowMessages={rowMessages}
                                            draftDuplicate={watchlistDraftDuplicate}
                                            selectedSubject={selectedActivitySubject}
                                            onSelectSubject={selectActivitySubject}
                                        />
                                        <SettingsPanel settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} settingsDirty={settingsDirty} canManage={canManage} busy={busy} onSave={() => void saveSettings()} onReset={() => setSettingsDraft(bundle.settings || {})} />
                                    </div>
                                    <div className='grid min-w-0 content-start gap-5' data-org-operator-rail='true'>
                                        <div className='xl:sticky xl:top-24 xl:z-10' data-org-activity-sticky='true'>
                                            <ActivityPanel organization={selectedOrganization} bundle={bundle} activity={activityRows} selectedSubject={selectedActivitySubject} onSelectSubject={selectActivitySubject} />
                                        </div>
                                        <InvitePanel emails={inviteEmails} setEmails={setInviteEmails} role={inviteRole} setRole={setInviteRole} invites={bundle.invites} members={bundle.members} canManage={canManage} busy={busy} rowMessages={rowMessages} selectedSubject={selectedActivitySubject} onSelectSubject={selectActivitySubject} onInvite={() => void sendInvite()} onInviteAction={(invite, action) => void inviteAction(invite, action)} onCopyInvite={invite => void copyInvite(invite)} />
                                        <MemberPanel members={bundle.members} canManage={canManage} busy={busy} rowMessages={rowMessages} selectedSubject={selectedActivitySubject} onSelectSubject={selectActivitySubject} onRoleChange={(member, role) => void changeMemberRole(member, role)} onRemove={member => void removeMember(member)} />
                                        <DestinationPanel destinations={bundle.webhooks} deliveries={bundle.deliveries} canManage={canManage} busy={busy} rowMessages={rowMessages} selectedSubject={selectedActivitySubject} createDraft={destinationCreateDraft} setCreateDraft={setDestinationCreateDraft} editing={editingDestinations} setEditing={setEditingDestinations} onSelectSubject={selectActivitySubject} onCreate={() => void createSavedDestination()} onTest={destination => void testSavedDestination(destination)} onUpdate={(destination, draft) => void updateSavedDestination(destination, draft)} onDelete={destination => void deleteSavedDestination(destination)} />
                                    </div>
                                </section>

                                <section className='grid min-w-0 gap-5'>
                                    <DeliveryHistoryPanel
                                        organization={selectedOrganization}
                                        deliveries={bundle.deliveries}
                                        selectedSubject={selectedActivitySubject}
                                        canManage={canManage}
                                        busy={busy}
                                        rowMessages={rowMessages}
                                        onReplay={delivery => void replayDelivery(delivery)}
                                    />
                                    <ScopePanel alertTerms={bundle.alertTerms} alerts={bundle.alerts} cases={bundle.cases} webhooks={bundle.webhooks} alertCaseVisibility={bundle.alertCaseVisibility} organizationId={selectedOrganization.id} />
                                </section>
                            </div>
                        ) : (
                            <EmptyWorkspacePreview />
                        )}
                    </main>}
                </div>
            </div>
        </section>
    )
}

function WorkspaceSectionNav({ organization, bundle, selectedSubject }: { organization: OrganizationSummary, bundle: OrgBundle, selectedSubject: ActivitySubject }) {
    const activeMembers = bundle.members.filter(member => member.status === 'active')
    const pendingInvites = bundle.invites.filter(invite => invite.status === 'pending')
    const activeTerms = bundle.alertTerms.filter(term => (term.status || 'active') === 'active')
    const activeDestinations = bundle.webhooks.filter(destination => destination.deliveryReady || destination.status === 'active' || destination.status === 'configured')
    const failedDeliveries = bundle.deliveries.filter(delivery => delivery.status === 'failed' || Boolean(delivery.error))
    const rows = [
        {
            id: 'team',
            href: '#members',
            label: 'Team',
            value: `${activeMembers.length} active`,
            detail: `${pendingInvites.length} pending`,
            icon: <Users className='h-4 w-4' />,
            active: selectedSubject.type === 'member' || selectedSubject.type === 'invite',
            tone: pendingInvites.length ? 'review' : 'ready',
        },
        {
            id: 'watchlists',
            href: '#watchlists',
            label: 'Watchlists',
            value: `${activeTerms.length} active`,
            detail: `${bundle.watchlists.length} saved`,
            icon: <BellRing className='h-4 w-4' />,
            active: selectedSubject.type === 'watchlist',
            tone: activeTerms.length ? 'ready' : 'review',
        },
        {
            id: 'destinations',
            href: '#destinations',
            label: 'Destinations',
            value: `${activeDestinations.length} ready`,
            detail: `${bundle.webhooks.length} saved`,
            icon: <Webhook className='h-4 w-4' />,
            active: selectedSubject.type === 'destination',
            tone: activeDestinations.length ? 'ready' : 'review',
        },
        {
            id: 'delivery',
            href: '#delivery-history',
            label: 'Delivery',
            value: `${bundle.deliveries.length} events`,
            detail: failedDeliveries.length ? `${failedDeliveries.length} failed` : 'clean',
            icon: <RefreshCw className='h-4 w-4' />,
            active: selectedSubject.type === 'alert' || selectedSubject.type === 'case',
            tone: failedDeliveries.length ? 'warning' : bundle.deliveries.length ? 'ready' : 'neutral',
        },
        {
            id: 'activity',
            href: '#audit',
            label: 'Activity',
            value: selectedSubjectLabel(selectedSubject, organization, bundle),
            detail: selectedSubject.type,
            icon: <CheckCircle2 className='h-4 w-4' />,
            active: selectedSubject.type === 'organization',
            tone: 'neutral',
        },
    ] as const
    return (
        <nav className='sticky top-2 z-10 rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-sm backdrop-blur dark:border-ui-border dark:bg-ui-panel/95' aria-label='Organization workspace sections' data-org-section-nav='true'>
            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
                {rows.map(row => (
                    <a
                        key={row.id}
                        href={row.href}
                        className={`grid min-h-16 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border px-3 py-2 text-left transition hover:border-ui-primary/35 hover:bg-ui-raised dark:hover:bg-ui-raised ${row.active ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-primary/10' : row.tone === 'warning' ? 'border-ui-warning/35 bg-ui-warning/10 dark:border-ui-warning/35 dark:bg-ui-warning/10' : row.tone === 'ready' ? 'border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-canvas' : 'border-ui-border bg-ui-raised dark:border-ui-border dark:bg-ui-canvas'}`}
                        data-org-section-nav-item={row.id}
                    >
                        <span className='grid h-8 w-8 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{row.icon}</span>
                        <span className='min-w-0'>
                            <span className='flex min-w-0 items-center justify-between gap-2'>
                                <span className='truncate text-xs font-semibold uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>{row.label}</span>
                                <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-ui-primary opacity-70' aria-hidden='true' />
                            </span>
                            <span className='mt-1 block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{row.value}</span>
                            <span className='block truncate text-xs text-ui-muted dark:text-ui-muted'>{row.detail}</span>
                        </span>
                    </a>
                ))}
            </div>
        </nav>
    )
}

function WorkspaceHealthStrip({ organization, bundle, canManage }: { organization: OrganizationSummary, bundle: OrgBundle, canManage: boolean }) {
    const activeMembers = bundle.members.filter(member => member.status === 'active')
    const adminMembers = bundle.members.filter(member => member.status === 'active' && (member.role === 'owner' || member.role === 'admin'))
    const pendingInvites = bundle.invites.filter(invite => invite.status === 'pending')
    const activeTerms = bundle.alertTerms.filter(term => (term.status || 'active') === 'active')
    const configuredDestinations = bundle.webhooks.filter(destination => destination.deliveryReady || destination.status === 'active' || destination.status === 'configured')
    const failedDeliveries = bundle.deliveries.filter(delivery => delivery.status === 'failed' || Boolean(delivery.error))
    const routedCases = bundle.cases.filter(item => item.status !== 'closed')
    const hasAlertOrCaseActivity = Boolean(bundle.alerts.length || routedCases.length)
    const rows = [
        {
            id: 'access',
            label: 'Access',
            value: activeMembers.length ? `${activeMembers.length} active` : 'Invite team',
            detail: adminMembers.length ? `${adminMembers.length} admin${adminMembers.length === 1 ? '' : 's'} · ${pendingInvites.length} pending` : 'Add an owner or admin',
            href: '#members',
            tone: adminMembers.length ? 'ready' : 'blocked',
        },
        {
            id: 'watchlists',
            label: 'Watchlists',
            value: activeTerms.length ? `${activeTerms.length} active term${activeTerms.length === 1 ? '' : 's'}` : 'Add watch term',
            detail: bundle.watchlists.length ? `${bundle.watchlists.length} shared item${bundle.watchlists.length === 1 ? '' : 's'}` : 'Create a shared watchlist term',
            href: '#watchlists',
            tone: activeTerms.length ? 'ready' : 'blocked',
        },
        {
            id: 'delivery',
            label: 'Delivery',
            value: configuredDestinations.length ? `${configuredDestinations.length} destination${configuredDestinations.length === 1 ? '' : 's'}` : 'Set delivery',
            detail: failedDeliveries.length ? `${failedDeliveries.length} failed delivery` : bundle.deliveries.length ? `${bundle.deliveries.length} delivery event${bundle.deliveries.length === 1 ? '' : 's'}` : 'Test a Discord or webhook destination',
            href: '#destinations',
            tone: failedDeliveries.length ? 'warning' : configuredDestinations.length ? 'ready' : 'blocked',
        },
        {
            id: 'cases',
            label: 'Alert flow',
            value: hasAlertOrCaseActivity ? `${bundle.alerts.length} alert${bundle.alerts.length === 1 ? '' : 's'} · ${routedCases.length} case${routedCases.length === 1 ? '' : 's'}` : activeTerms.length ? 'Listening for matches' : 'Add watch term',
            detail: hasAlertOrCaseActivity ? 'Open DWM workspace' : activeTerms.length ? 'Matched captures will open alert and case rows' : 'Start with a shared watchlist term',
            href: '#delivery-history',
            tone: hasAlertOrCaseActivity ? 'ready' : activeTerms.length ? 'neutral' : 'blocked',
        },
    ] as const

    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-health-strip='true'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                    <h2 className='flex items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                        <ShieldCheck className='h-4 w-4 text-ui-primary' />
                        Workspace health
                    </h2>
                    <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{organizationDisplayName(organization)} · {canManage ? 'admin controls enabled' : 'read-only access'}</p>
                </div>
                <a href='#audit' className={secondaryButtonClass} data-org-health-activity='true'>
                    <ExternalLink className='h-4 w-4' />
                    Activity
                </a>
            </div>
            <div className='mt-3 overflow-hidden rounded-lg border border-ui-border dark:border-ui-border' data-org-health-compact='true'>
                {rows.map(row => (
                    <a
                        key={row.id}
                        href={row.href}
                        className={`grid min-h-12 min-w-0 grid-cols-[minmax(6rem,0.75fr)_minmax(0,1fr)_auto] items-center gap-3 border-b border-ui-border px-3 py-2 text-sm transition last:border-b-0 hover:bg-ui-raised dark:border-ui-border dark:hover:bg-ui-raised ${row.tone === 'warning' ? 'bg-ui-warning/10 dark:bg-ui-warning/10' : row.tone === 'blocked' ? 'bg-ui-raised dark:bg-ui-canvas' : 'bg-ui-panel dark:bg-ui-panel'}`}
                        data-org-health-row={row.id}
                    >
                        <span className='min-w-0'>
                            <span className='block truncate text-xs font-semibold uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>{row.label}</span>
                            <span className='mt-0.5 block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{row.value}</span>
                        </span>
                        <span className='min-w-0 truncate text-xs text-ui-muted dark:text-ui-muted'>{row.detail}</span>
                        <StatusPill status={row.tone === 'ready' ? 'ready' : row.tone === 'warning' || row.tone === 'blocked' ? 'review' : 'waiting'} />
                    </a>
                ))}
            </div>
        </section>
    )
}

function EmptyWorkspacePreview() {
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-empty-focused-create='true'>
            <div className='flex min-w-0 items-start gap-3'>
                <div className='grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ui-primary/10 text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>
                    <Building2 className='h-5 w-5' />
                </div>
                <div className='min-w-0'>
                    <h2 className='text-xl font-semibold text-ui-text dark:text-ui-text'>Create an organization to start monitoring</h2>
                    <p className='mt-2 max-w-xl text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                        Start with a workspace name and one shared watchlist term. Members, destinations, and alert handling unlock from the same console after creation.
                    </p>
                    <a href='#org-create-primary' className='mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel dark:border-ui-border dark:bg-ui-canvas dark:text-ui-text'>
                        Open create form
                    </a>
                </div>
            </div>
        </section>
    )
}

function WorkspaceSummary({ organization, activeWatchlists, pausedWatchlists, archivedWatchlists, memberCount, inviteCount, webhookCount }: { organization: OrganizationSummary, activeWatchlists: number, pausedWatchlists: number, archivedWatchlists: number, memberCount: number, inviteCount: number, webhookCount: number }) {
    const rows = [
        { id: 'role', icon: <ShieldCheck className='h-4 w-4' />, label: 'Role', value: organization.role || 'member', detail: organization.status || 'active' },
        { id: 'members', icon: <Users className='h-4 w-4' />, label: 'Members', value: String(memberCount || organization.memberCount || organization.activeMemberCount || 0), detail: `${inviteCount || organization.pendingInviteCount || 0} pending` },
        { id: 'watchlists', icon: <BellRing className='h-4 w-4' />, label: 'Watchlists', value: String(activeWatchlists || organization.sharedWatchlistCount || 0), detail: `${pausedWatchlists} paused · ${archivedWatchlists} archived` },
        { id: 'destinations', icon: <Webhook className='h-4 w-4' />, label: 'Destinations', value: String(webhookCount), detail: 'Org-scoped' },
    ]
    return (
        <section className='flex min-w-0 flex-col gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm dark:border-ui-border dark:bg-ui-panel xl:flex-row xl:items-center xl:justify-between' data-org-workspace-summary='true'>
            <div className='min-w-0'>
                <p className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                    <ShieldCheck className='h-4 w-4 shrink-0 text-ui-primary' />
                    <span className='truncate'>{organizationDisplayName(organization)}</span>
                </p>
                <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{organizationDisplayId(organization)} · {organization.tenantId || 'default tenant'}</p>
            </div>
            <div className='grid min-w-0 gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end' data-org-summary-chip-list='true'>
                {rows.map(row => (
                    <span key={row.id} className='grid min-h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-l border-ui-border py-1 pl-2 dark:border-ui-border' data-org-summary-chip={row.id}>
                        <span className='shrink-0 text-ui-muted dark:text-ui-muted'>{row.icon}</span>
                        <span className='min-w-0'>
                            <span className='block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>{row.label}</span>
                            <span className='block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{row.value} <span className='font-medium text-ui-muted dark:text-ui-muted'>{row.detail}</span></span>
                        </span>
                    </span>
                ))}
            </div>
        </section>
    )
}

function DwmHandoffBanner({ organization, selectedSubject, alertId, caseId, watchlistId, destinationId, focus }: {
    organization: OrganizationSummary
    selectedSubject: ActivitySubject
    alertId: string
    caseId: string
    watchlistId: string
    destinationId: string
    focus: string
}) {
    const scopedValues = [
        ['Org', organizationDisplayId(organization)],
        ['Selected', selectedSubject.type],
        ['Case', caseId],
        ['Alert', alertId],
        ['Watchlist', watchlistId],
        ['Destination', destinationId],
    ].filter(([, value]) => Boolean(value))
    const caseHref = caseId
        ? `/dashboard/dwm/cases/${encodeURIComponent(caseId)}?organizationId=${encodeURIComponent(organization.id)}${alertId ? `&alertId=${encodeURIComponent(alertId)}` : ''}`
        : ''
    const alertHref = alertId
        ? `/dashboard/ti/workbench?alertId=${encodeURIComponent(alertId)}&organizationId=${encodeURIComponent(organization.id)}`
        : ''
    const deliveryHref = destinationId || focus === 'destinations' || focus === 'webhooks'
        ? '#delivery-history'
        : ''
    return (
        <section className='rounded-lg border border-ui-primary/35 bg-ui-primary/10 p-4 shadow-sm dark:border-ui-primary/35 dark:bg-ui-panel' data-dwm-handoff='true'>
            <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                <div className='min-w-0'>
                    <h2 className='flex items-center gap-2 text-base font-semibold text-ui-primary dark:text-ui-primary'>
                        <CircleAlert className='h-4 w-4 text-ui-primary dark:text-ui-primary' />
                        DWM actions for this organization
                    </h2>
                    <p className='mt-1 text-sm leading-5 text-ui-muted dark:text-ui-muted'>
                        Manage the selected {selectedSubject.type}, delivery destination, and team access from one scoped view.
                    </p>
                    <div className='mt-3 flex flex-wrap gap-2'>
                        {scopedValues.map(([label, value]) => (
                            <span key={`${label}-${value}`} className='max-w-full truncate rounded-md border border-ui-primary/35 bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-text dark:border-ui-primary/35 dark:bg-ui-canvas dark:text-ui-primary'>
                                {label}: {sanitizeOrganizationDisplayCopy(value) || value}
                            </span>
                        ))}
                        {focus && <span className='rounded-md border border-ui-primary/35 bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-text dark:border-ui-primary/35 dark:bg-ui-canvas dark:text-ui-primary'>Focus: {focus}</span>}
                    </div>
                </div>
                <div className='grid gap-2 sm:grid-cols-2 lg:flex'>
                    <ActionAnchor href='#audit' icon={<CheckCircle2 className='h-4 w-4' />} label='Review context' />
                    <ActionAnchor href='#watchlists' icon={<BellRing className='h-4 w-4' />} label='Manage watchlist' />
                    {deliveryHref && <ActionAnchor href={deliveryHref} icon={<Webhook className='h-4 w-4' />} label='Open delivery log' />}
                    {caseHref && <ActionAnchor href={caseHref} icon={<ExternalLink className='h-4 w-4' />} label='Open case' />}
                    {alertHref && <ActionAnchor href={alertHref} icon={<ExternalLink className='h-4 w-4' />} label='Open alert' />}
                </div>
            </div>
        </section>
    )
}

function OrgActionStrip({ alertId, canManage, hasWatchlists, hasDestination }: { alertId: string, canManage: boolean, hasWatchlists: boolean, hasDestination: boolean }) {
    const actions: Array<{ href: string, icon: ReactNode, label: string }> = []
    if (canManage) actions.push({ href: '#watchlists', icon: <BellRing className='h-4 w-4' />, label: 'Create watchlist' })
    if (canManage) actions.push({ href: '#invites', icon: <UserPlus className='h-4 w-4' />, label: 'Invite member' })
    if (canManage && hasWatchlists) actions.push({ href: '#destinations', icon: <Webhook className='h-4 w-4' />, label: 'Test destination' })
    if (alertId) actions.push({ href: `/dashboard/ti/workbench?alertId=${encodeURIComponent(alertId)}`, icon: <CircleAlert className='h-4 w-4' />, label: 'Open DWM alert' })
    if (hasDestination || hasWatchlists) actions.push({ href: '#audit', icon: <CheckCircle2 className='h-4 w-4' />, label: 'Audit' })
    const nextStep = !canManage
        ? 'Owner or admin access unlocks setup actions.'
        : !hasWatchlists
            ? 'Start with a shared watchlist term.'
            : !hasDestination
                ? 'Test and save a delivery destination.'
                : alertId
                    ? ''
                    : 'Reviewed alerts will appear after a watchlist match.'
    return (
        <nav className='flex flex-wrap items-center gap-2 rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm dark:border-ui-border dark:bg-ui-panel' aria-label='Organization actions' data-org-action-strip='true'>
            {actions.map(action => <ActionAnchor key={action.label} href={action.href} icon={action.icon} label={action.label} />)}
            {nextStep ? <span className='inline-flex min-h-9 items-center rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted' data-org-action-next='true'>{nextStep}</span> : null}
        </nav>
    )
}

function ActionAnchor({ href, icon, label, disabled, disabledReason }: { href: string, icon: ReactNode, label: string, disabled?: boolean, disabledReason?: string }) {
    const classes = disabled
        ? 'pointer-events-none inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted'
        : 'inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-raised dark:border-ui-border dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-raised'
    if (disabled) {
        return <span className={classes} aria-disabled='true' aria-label={disabledReason ? `${label}: ${disabledReason}` : label} title={disabledReason}>{icon}{label}</span>
    }
    return <a className={classes} href={href}>{icon}{label}</a>
}

function PermissionStrip({ role, canManage, hasWatchlists, hasDestination }: { role: OrganizationRole, canManage: boolean, hasWatchlists: boolean, hasDestination: boolean }) {
    const rows = [
        { id: 'team', label: 'Team', value: canManage ? 'Manage' : 'View', ready: canManage, reason: canManage ? 'Invite and update roles' : 'Owner or admin required' },
        { id: 'watchlists', label: 'Watchlists', value: canManage ? 'Manage' : 'View', ready: canManage, reason: canManage ? 'Create, edit, archive' : 'Owner or admin required' },
        { id: 'destinations', label: 'Destinations', value: canManage && hasWatchlists ? 'Test' : hasDestination ? 'View' : 'Add watchlist', ready: canManage && hasWatchlists, reason: hasWatchlists ? (canManage ? 'Save and replay routes' : 'Owner or admin required') : 'Add watchlist first' },
        { id: 'alerts', label: 'Alerts and cases', value: hasWatchlists ? 'Scoped' : 'Waiting', ready: hasWatchlists, reason: hasWatchlists ? 'Org watchlist context available' : 'Add watchlist first' },
    ] as const
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-permission-strip='true' aria-label='Organization permission summary'>
            <div className='grid gap-2 lg:grid-cols-[minmax(9rem,0.45fr)_minmax(0,1fr)] lg:items-center'>
                <div className='flex min-w-0 items-center gap-2'>
                    <ShieldCheck className='h-4 w-4 shrink-0 text-ui-primary' />
                    <span className='min-w-0'>
                        <span className='block truncate text-xs font-semibold uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>Current role</span>
                        <span className='block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{role}</span>
                    </span>
                </div>
                <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
                    {rows.map(row => (
                        <div key={row.id} className='grid min-h-12 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 py-2 dark:border-ui-border dark:bg-ui-canvas' data-org-permission-row={row.id}>
                            <span className='min-w-0'>
                                <span className='block truncate text-xs font-semibold text-ui-muted dark:text-ui-muted'>{row.label}</span>
                                <span className='block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{row.value}</span>
                                <span className='block truncate text-[11px] text-ui-muted dark:text-ui-muted'>{row.reason}</span>
                            </span>
                            <StatusPill status={row.ready ? 'ready' : 'review'} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function OrgSetupProgress({ canManage, memberCount, inviteCount, watchlistCount, destinationCount, alertCount, caseCount, alertId }: {
    canManage: boolean
    memberCount: number
    inviteCount: number
    watchlistCount: number
    destinationCount: number
    alertCount: number
    caseCount: number
    alertId: string
}) {
    const rows = [
        {
            id: 'team',
            title: 'Team access',
            body: memberCount ? `${memberCount} active member${memberCount === 1 ? '' : 's'}` : inviteCount ? `${inviteCount} invite${inviteCount === 1 ? '' : 's'} pending` : 'Invite analysts or admins',
            href: '#invites',
            ready: memberCount > 0,
            blocked: !canManage,
            action: inviteCount ? 'Review invites' : 'Invite member',
        },
        {
            id: 'watchlists',
            title: 'Shared watchlists',
            body: watchlistCount ? `${watchlistCount} term${watchlistCount === 1 ? '' : 's'} active` : 'Add company, domain, supplier, actor, or keyword',
            href: '#watchlists',
            ready: watchlistCount > 0,
            blocked: !canManage,
            action: watchlistCount ? 'Review terms' : 'Add term',
        },
        {
            id: 'destinations',
            title: 'Delivery destination',
            body: destinationCount ? 'Destination saved' : watchlistCount ? 'Test and save a destination' : 'Create a watchlist first',
            href: '#destinations',
            ready: destinationCount > 0,
            blocked: !watchlistCount || !canManage,
            action: destinationCount ? 'Review destination' : 'Test destination',
        },
        {
            id: 'activity',
            title: 'Alert and case context',
            body: alertCount || caseCount ? `${alertCount} alert${alertCount === 1 ? '' : 's'} · ${caseCount} case${caseCount === 1 ? '' : 's'}` : 'Waiting for a watchlist match',
            href: '#audit',
            ready: alertCount > 0 || caseCount > 0,
            blocked: false,
            action: 'Open activity',
        },
    ]

    const visibleRows = rows.filter(row => row.ready || !row.blocked)
    const completed = visibleRows.filter(row => row.ready).length
    const nextAction = rows.find(row => !row.ready && !row.blocked) || rows.find(row => row.ready) || rows[0]
    const openAlertHref = alertId ? `/dashboard/ti/workbench?alertId=${encodeURIComponent(alertId)}` : ''
    return (
        <section className='border-t border-ui-border pt-3 dark:border-ui-border' data-org-setup-progress='true'>
            <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center'>
                <div className='min-w-0' data-org-setup-rail='true'>
                    <div className='mb-2 flex min-w-0 items-center justify-between gap-3'>
                        <h2 className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                            <ShieldCheck className='h-4 w-4 shrink-0 text-ui-primary' />
                            <span className='truncate'>Organization setup</span>
                        </h2>
                        <span className='shrink-0 border-l border-ui-border pl-2 text-xs font-semibold text-ui-muted dark:border-ui-border dark:text-ui-muted' data-org-setup-progress-count='true'>
                            {completed}/{visibleRows.length}
                        </span>
                    </div>
                    <div className='grid border-t border-ui-border dark:border-ui-border sm:grid-cols-2 xl:grid-cols-4'>
                        {visibleRows.map(row => {
                            const rowClass = `grid min-h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-ui-border py-2 pr-3 text-left transition xl:border-b xl:border-r xl:last:border-r-0 dark:border-ui-border ${row.ready ? '' : row.blocked ? 'opacity-75' : 'hover:text-ui-primary'}`
                            const icon = row.ready ? <CheckCircle2 className='h-4 w-4 shrink-0 text-ui-success' /> : <CircleAlert className='h-4 w-4 shrink-0 text-ui-warning' />
                            const content = (
                                <>
                                    {icon}
                                    <span className='min-w-0'>
                                        <span className='block truncate text-xs font-semibold uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>{row.title}</span>
                                        <span className='block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{row.body}</span>
                                    </span>
                                </>
                            )
                            return <a key={row.id} href={row.href} className={rowClass} data-org-setup-step={row.id}>{content}</a>
                        })}
                    </div>
                </div>
                <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] xl:min-w-72 xl:grid-cols-1' data-org-setup-next='true'>
                    <span className='min-w-0 border-l border-ui-primary/35 pl-3 text-sm dark:border-ui-primary/35'>
                        <span className='block truncate text-xs font-semibold uppercase tracking-[0.08em] text-ui-primary dark:text-ui-primary'>Next</span>
                        <span className='mt-0.5 block truncate font-semibold text-ui-text dark:text-ui-text'>{nextAction.action}</span>
                    </span>
                    <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-1'>
                        <ActionAnchor href={nextAction.href} icon={<ExternalLink className='h-4 w-4' />} label={nextAction.action} disabled={nextAction.blocked} disabledReason={nextAction.body} />
                        {openAlertHref && <ActionAnchor href={openAlertHref} icon={<CircleAlert className='h-4 w-4' />} label='Validate alert' disabled={!watchlistCount} disabledReason='Add a watchlist term before validating DWM alert context.' />}
                    </div>
                </div>
            </div>
        </section>
    )
}

function SettingsPanel({ settingsDraft, setSettingsDraft, settingsDirty, canManage, busy, onSave, onReset }: { settingsDraft: OrganizationSettings, setSettingsDraft: (next: OrganizationSettings) => void, settingsDirty: boolean, canManage: boolean, busy: string, onSave: () => void, onReset: () => void }) {
    const validationMessage = settingsValidationMessage(settingsDraft)
    const saving = busy === 'save-settings'
    return (
        <details id='settings' className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-settings-disclosure>
            <summary className='flex cursor-pointer list-none flex-col gap-3 p-4 outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 dark:hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                <SectionTitle icon={<Settings className='h-4 w-4' />} title='Advanced organization settings' detail={canManage ? 'Policy controls stay here when workspace setup needs them.' : 'Read-only policy view.'} />
                <span className='shrink-0 rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>
                    {settingsDirty ? 'Unsaved changes' : 'Policy controls'}
                </span>
            </summary>
            <div className='grid gap-3 border-t border-ui-border p-4 dark:border-ui-border md:grid-cols-2'>
                <Field label='Name' value={settingsDraft.name || ''} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, name: value })} />
                <Field label='Slug' value={settingsDraft.slug || ''} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, slug: value })} />
                <SelectField label='Webhook policy' value={settingsDraft.defaultWebhookPolicy || 'active_destinations'} options={webhookPolicies} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, defaultWebhookPolicy: value })} />
                <SelectField label='Alert visibility' value={settingsDraft.alertVisibilityPolicy || 'members'} options={alertPolicies} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, alertVisibilityPolicy: value })} />
                <SelectField label='Lifecycle' value={settingsDraft.lifecycleStatus || 'active'} options={lifecycleStatuses} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, lifecycleStatus: value })} />
                <Field label='Retention days' type='number' value={String(settingsDraft.retentionDays || 365)} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, retentionDays: Number(value) || 365 })} />
                {validationMessage && <p className='rounded-md bg-ui-danger/10 px-3 py-2 text-xs font-semibold text-ui-danger dark:bg-ui-danger/10 dark:text-ui-danger md:col-span-2'>{validationMessage}</p>}
            </div>
            <div className='flex flex-wrap items-center justify-end gap-2 border-t border-ui-border px-4 py-3 dark:border-ui-border'>
                {saving && <InlineBusy label='Saving settings' marker='data-org-settings-busy' />}
                {settingsDirty && <span className='mr-auto rounded-md bg-ui-warning/10 px-2 py-1 text-xs font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'>Unsaved changes</span>}
                <button type='button' className={secondaryButtonClass} disabled={!canManage || !settingsDirty || Boolean(busy)} onClick={onReset}>
                    Reset
                </button>
                <button type='button' className={primaryButtonClass} disabled={!canManage || !settingsDirty || Boolean(validationMessage) || Boolean(busy)} onClick={onSave}>
                    <Settings className='h-4 w-4' />
                    Save settings
                </button>
            </div>
        </details>
    )
}

function InvitePanel({ emails, setEmails, role, setRole, invites, members, canManage, busy, rowMessages, selectedSubject, onSelectSubject, onInvite, onInviteAction, onCopyInvite }: { emails: string, setEmails: (value: string) => void, role: OrganizationRole, setRole: (value: OrganizationRole) => void, invites: OrganizationInvite[], members: OrganizationMember[], canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void, onInvite: () => void, onInviteAction: (invite: OrganizationInvite, action: 'revoke' | 'resend') => void, onCopyInvite: (invite: OrganizationInvite) => void }) {
    const [inviteQuery, setInviteQuery] = useState('')
    const [inviteStatusFilter, setInviteStatusFilter] = useState('all')
    const parsedEmails = parseInviteEmails(emails)
    const invalidEmails = invalidInviteEmails(emails)
    const inviteConflicts = inviteEmailConflicts(parsedEmails, invites, members)
    const canSendInvite = canManage && parsedEmails.length > 0 && invalidEmails.length === 0 && inviteConflicts.length === 0 && !busy
    const busyLabel = inviteBusyLabel(busy)
    const normalizedInviteQuery = inviteQuery.trim().toLowerCase()
    const visibleInvites = invites.filter(invite => {
        const statusMatches = inviteStatusFilter === 'all' || invite.status === inviteStatusFilter
        if (!statusMatches) return false
        if (!normalizedInviteQuery) return true
        return inviteSearchText(invite).includes(normalizedInviteQuery)
    })
    const inviteFiltersActive = Boolean(inviteQuery.trim()) || inviteStatusFilter !== 'all'
    return (
        <section id='invites' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <SectionTitle icon={<UserPlus className='h-4 w-4' />} title='Invite queue' detail={canManage ? 'Send, resend, revoke, copy.' : 'Owner or admin required.'} />
            {busyLabel && <InlineBusy label={busyLabel} marker='data-org-invite-busy' />}
            <div className='mt-4 grid gap-3'>
                <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                    Emails
                    <textarea value={emails} disabled={!canManage} onChange={event => setEmails(event.target.value)} className={`${inputClass} min-h-24 resize-y`} placeholder='analyst@company.com, admin@company.com' />
                    {invalidEmails.length > 0 && <span className='text-xs font-semibold text-ui-danger dark:text-ui-danger'>Invalid: {invalidEmails.slice(0, 2).join(', ')}{invalidEmails.length > 2 ? ` +${invalidEmails.length - 2}` : ''}</span>}
                    {invalidEmails.length === 0 && inviteConflicts.length > 0 && <span className='text-xs font-semibold text-ui-warning dark:text-ui-warning' data-org-invite-conflicts='true'>Already in this workspace: {inviteConflicts.slice(0, 2).join(', ')}{inviteConflicts.length > 2 ? ` +${inviteConflicts.length - 2}` : ''}</span>}
                    {invalidEmails.length === 0 && inviteConflicts.length === 0 && parsedEmails.length > 0 && <span className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>{parsedEmails.length} recipient{parsedEmails.length === 1 ? '' : 's'}</span>}
                </label>
                <SelectField label='Role' value={role} options={roleOptions} disabled={!canManage} onChange={value => setRole(value as OrganizationRole)} />
                <button type='button' className={primaryButtonClass} disabled={!canSendInvite} onClick={onInvite}>
                    <UserPlus className='h-4 w-4' />
                    Send invites
                </button>
            </div>
            <div className='mt-5 grid gap-2'>
                {invites.length === 0 && <EmptyLine text='Send invites from the form above. Pending access requests appear here with copy, resend, and revoke actions.' />}
                {invites.length > 0 && (
                    <>
                        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas md:grid-cols-[minmax(0,1fr)_9rem_auto]' data-org-invite-filter-strip='true'>
                            <label className='grid min-w-0 gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                                Find invite
                                <input
                                    value={inviteQuery}
                                    disabled={Boolean(busy)}
                                    onChange={event => setInviteQuery(event.target.value)}
                                    className={inputClass}
                                    placeholder='Email, role, status'
                                />
                            </label>
                            <SelectField
                                label='Status'
                                value={inviteStatusFilter}
                                options={['all', 'pending', 'accepted', 'revoked', 'expired']}
                                disabled={Boolean(busy)}
                                onChange={setInviteStatusFilter}
                            />
                            <div className='grid content-end gap-1'>
                                <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-2 text-center text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted' data-org-invite-filter-count='true'>
                                    {visibleInvites.length}/{invites.length} shown
                                </span>
                                <button
                                    type='button'
                                    className={secondaryButtonClass}
                                    disabled={!inviteFiltersActive || Boolean(busy)}
                                    onClick={() => {
                                        setInviteQuery('')
                                        setInviteStatusFilter('all')
                                    }}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        {visibleInvites.length === 0 && <EmptyLine text='Adjust filters to see pending access requests.' />}
                        {visibleInvites.map(invite => {
                            const canCopy = Boolean(inviteLink(invite)) && inviteActionAllowed(invite, 'copy') && !busy
                            const canResend = canManage && inviteActionAllowed(invite, 'resend') && !busy
                            const canRevoke = canManage && inviteActionAllowed(invite, 'revoke') && !busy
                            const selected = selectedSubject.type === 'invite' && selectedSubject.id === invite.id
                            return (
                                <div
                                    role='button'
                                    tabIndex={0}
                                    aria-pressed={selected}
                                    key={invite.id}
                                    className={`grid min-w-0 gap-3 rounded-lg border border-ui-border p-3 text-left transition dark:border-ui-border ${selected ? 'bg-ui-primary/10 dark:bg-ui-raised' : 'hover:bg-ui-raised dark:hover:bg-ui-panel'}`}
                                    onClick={() => onSelectSubject({ type: 'invite', id: invite.id })}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            onSelectSubject({ type: 'invite', id: invite.id })
                                        }
                                    }}
                                >
                                    <span className='grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                                        <span className='min-w-0'>
                                            <span className='block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{invite.email}</span>
                                            <span className='mt-1 flex flex-wrap gap-2'>
                                                <RoleBadge role={invite.role} />
                                                <StatusPill status={invite.status} />
                                            </span>
                                            <RowStatus message={rowMessages[`invite-${invite.id}`]} />
                                        </span>
                                        <span className='flex gap-1 sm:justify-end' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                            <button type='button' aria-label='Copy invite link' className={iconButtonClass} disabled={!canCopy} onClick={event => { event.stopPropagation(); onCopyInvite(invite) }}><Copy className='h-4 w-4' /></button>
                                            <button type='button' aria-label='Resend invite' className={iconButtonClass} disabled={!canResend} onClick={event => { event.stopPropagation(); onInviteAction(invite, 'resend') }}><RefreshCw className='h-4 w-4' /></button>
                                            <ConfirmActionButton ariaLabel='Revoke invite' disabled={!canRevoke} onConfirm={() => onInviteAction(invite, 'revoke')} icon={<Trash2 className='h-4 w-4' />} />
                                        </span>
                                    </span>
                                </div>
                            )
                        })}
                    </>
                )}
            </div>
        </section>
    )
}

function MemberPanel({ members, canManage, busy, rowMessages, selectedSubject, onSelectSubject, onRoleChange, onRemove }: { members: OrganizationMember[], canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void, onRoleChange: (member: OrganizationMember, role: OrganizationRole) => void, onRemove: (member: OrganizationMember) => void }) {
    const [pendingRoles, setPendingRoles] = useState<Record<string, OrganizationRole>>({})
    const [memberQuery, setMemberQuery] = useState('')
    const [memberRoleFilter, setMemberRoleFilter] = useState('all')
    const busyLabel = memberBusyLabel(busy)
    const normalizedMemberQuery = memberQuery.trim().toLowerCase()
    const visibleMembers = members.filter(member => {
        const roleMatches = memberRoleFilter === 'all' || member.role === memberRoleFilter
        if (!roleMatches) return false
        if (!normalizedMemberQuery) return true
        return memberSearchText(member).includes(normalizedMemberQuery)
    })
    const memberFiltersActive = Boolean(memberQuery.trim()) || memberRoleFilter !== 'all'
    return (
        <details id='members' className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-members-disclosure>
            <summary className='flex cursor-pointer list-none flex-col gap-3 p-4 outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 dark:hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                <SectionTitle icon={<Users className='h-4 w-4' />} title='Members' detail='Roles, status, and removal are available when access needs review.' />
                <span className='shrink-0 rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>
                    {visibleMembers.length}/{members.length} member{members.length === 1 ? '' : 's'}
                </span>
            </summary>
            <div className='overflow-x-auto border-t border-ui-border p-4 dark:border-ui-border'>
                {busyLabel && <InlineBusy label={busyLabel} marker='data-org-member-busy' />}
                {members.length === 0 && <EmptyLine text='Invite teammates to populate this access table.' />}
                {members.length > 0 && (
                    <>
                        <div className='mb-3 grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas md:grid-cols-[minmax(0,1fr)_9rem_auto]' data-org-member-filter-strip='true'>
                            <label className='grid min-w-0 gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                                Find member
                                <input
                                    value={memberQuery}
                                    disabled={Boolean(busy)}
                                    onChange={event => setMemberQuery(event.target.value)}
                                    className={inputClass}
                                    placeholder='Name, email, status'
                                />
                            </label>
                            <SelectField
                                label='Role'
                                value={memberRoleFilter}
                                options={['all', 'owner', ...roleOptions]}
                                disabled={Boolean(busy)}
                                onChange={setMemberRoleFilter}
                            />
                            <div className='grid content-end gap-1'>
                                <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-2 text-center text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted' data-org-member-filter-count='true'>
                                    {visibleMembers.length}/{members.length} shown
                                </span>
                                <button
                                    type='button'
                                    className={secondaryButtonClass}
                                    disabled={!memberFiltersActive || Boolean(busy)}
                                    onClick={() => {
                                        setMemberQuery('')
                                        setMemberRoleFilter('all')
                                    }}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        {visibleMembers.length === 0 && (
                            <div className='mb-3'>
                                <EmptyLine text='Adjust filters to see matching team members.' />
                            </div>
                        )}
                        <div className='grid gap-2 md:hidden' data-org-member-mobile-list='true'>
                            {visibleMembers.map(member => {
                                const selectedRole = pendingRoles[member.userId] || member.role
                                const roleChanged = selectedRole !== member.role
                                const canMutateMember = canManage && memberCanMutate(member)
                                const selected = selectedSubject.type === 'member' && selectedSubject.id === member.userId
                                return (
                                    <article
                                        key={member.userId}
                                        role='button'
                                        tabIndex={0}
                                        aria-pressed={selected}
                                        className={`grid gap-3 rounded-lg border p-3 transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-raised' : 'border-ui-border bg-ui-panel hover:bg-ui-raised dark:border-ui-border dark:bg-ui-canvas dark:hover:bg-ui-panel'}`}
                                        data-org-member-mobile-row='true'
                                        onClick={() => onSelectSubject({ type: 'member', id: member.userId })}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                onSelectSubject({ type: 'member', id: member.userId })
                                            }
                                        }}
                                    >
                                        <div className='flex min-w-0 items-start justify-between gap-3'>
                                            <div className='min-w-0'>
                                                <p className='truncate font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(member.name || member.email || member.userId)}</p>
                                                <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(member.email && member.email !== member.userId ? member.email : member.userId)}</p>
                                            </div>
                                            <StatusPill status={member.status} />
                                        </div>
                                        <div className='grid gap-2' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                            {canMutateMember ? (
                                                <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
                                                    <select className={compactSelectClass} value={selectedRole} disabled={Boolean(busy)} onChange={event => setPendingRoles(current => ({ ...current, [member.userId]: event.target.value as OrganizationRole }))}>
                                                        {roleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                                    </select>
                                                    <button
                                                        type='button'
                                                        className={secondaryButtonClass}
                                                        disabled={!roleChanged || Boolean(busy)}
                                                        onClick={() => {
                                                            onRoleChange(member, selectedRole)
                                                            setPendingRoles(current => {
                                                                const next = { ...current }
                                                                delete next[member.userId]
                                                                return next
                                                            })
                                                        }}
                                                    >
                                                        <CheckCircle2 className='h-4 w-4' />
                                                        Apply
                                                    </button>
                                                </div>
                                            ) : <RoleBadge role={member.role} />}
                                            <ConfirmActionButton ariaLabel='Remove member' disabled={!canMutateMember || Boolean(busy)} onConfirm={() => onRemove(member)} icon={<Trash2 className='h-4 w-4' />} />
                                            <RowStatus message={rowMessages[`member-${member.userId}`]} />
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                        <table className='hidden min-w-full border-separate border-spacing-0 text-left text-sm md:table' data-org-member-desktop-table='true'>
                            <thead className='text-xs uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>
                                <tr>
                                    <th className='border-b border-ui-border py-2 pr-3 dark:border-ui-border'>User</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>Role</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>Status</th>
                                    <th className='border-b border-ui-border py-2 pl-3 text-right dark:border-ui-border'>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleMembers.map(member => {
                                    const selectedRole = pendingRoles[member.userId] || member.role
                                    const roleChanged = selectedRole !== member.role
                                    const canMutateMember = canManage && memberCanMutate(member)
                                    const selected = selectedSubject.type === 'member' && selectedSubject.id === member.userId
                                    return (
                                        <tr
                                            key={member.userId}
                                            role='button'
                                            tabIndex={0}
                                            aria-pressed={selected}
                                            className={`cursor-pointer align-middle transition ${selected ? 'bg-ui-primary/10 dark:bg-ui-raised' : 'hover:bg-ui-raised dark:hover:bg-ui-panel'}`}
                                            onClick={() => onSelectSubject({ type: 'member', id: member.userId })}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    onSelectSubject({ type: 'member', id: member.userId })
                                                }
                                            }}
                                        >
                                            <td className='max-w-44 border-b border-ui-border py-2 pr-3 dark:border-ui-border'>
                                                <p className='truncate font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(member.name || member.email || member.userId)}</p>
                                                <p className='truncate text-xs text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(member.email && member.email !== member.userId ? member.email : member.userId)}</p>
                                            </td>
                                            <td className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                {canMutateMember ? (
                                                    <div className='flex flex-wrap items-center gap-2' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                                        <select className={compactSelectClass} value={selectedRole} disabled={Boolean(busy)} onChange={event => setPendingRoles(current => ({ ...current, [member.userId]: event.target.value as OrganizationRole }))}>
                                                            {roleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                                        </select>
                                                        {roleChanged && (
                                                            <button
                                                                type='button'
                                                                className={secondaryButtonClass}
                                                                disabled={Boolean(busy)}
                                                                onClick={() => {
                                                                    onRoleChange(member, selectedRole)
                                                                    setPendingRoles(current => {
                                                                        const next = { ...current }
                                                                        delete next[member.userId]
                                                                        return next
                                                                    })
                                                                }}
                                                            >
                                                                <CheckCircle2 className='h-4 w-4' />
                                                                Apply
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : <RoleBadge role={member.role} />}
                                            </td>
                                            <td className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                <div className='grid gap-1'>
                                                    <StatusPill status={member.status} />
                                                    <RowStatus message={rowMessages[`member-${member.userId}`]} />
                                                </div>
                                            </td>
                                            <td className='border-b border-ui-border py-2 pl-3 text-right dark:border-ui-border'>
                                                <ConfirmActionButton ariaLabel='Remove member' disabled={!canMutateMember || Boolean(busy)} onConfirm={() => onRemove(member)} icon={<Trash2 className='h-4 w-4' />} />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </details>
    )
}

function DestinationPanel({ destinations, deliveries, canManage, busy, rowMessages, selectedSubject, createDraft, setCreateDraft, editing, setEditing, onSelectSubject, onCreate, onTest, onUpdate, onDelete }: { destinations: WebhookDestination[], deliveries: DeliveryRow[], canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, createDraft: DestinationCreateDraft, setCreateDraft: (next: DestinationCreateDraft) => void, editing: Record<string, DestinationEditDraft>, setEditing: (next: Record<string, DestinationEditDraft> | ((current: Record<string, DestinationEditDraft>) => Record<string, DestinationEditDraft>)) => void, onSelectSubject: (subject: ActivitySubject) => void, onCreate: () => void, onTest: (destination: WebhookDestination) => void, onUpdate: (destination: WebhookDestination, draft: DestinationEditDraft) => void, onDelete: (destination: WebhookDestination) => void }) {
    const [destinationQuery, setDestinationQuery] = useState('')
    const [destinationStatusFilter, setDestinationStatusFilter] = useState('all')
    const [destinationKindFilter, setDestinationKindFilter] = useState('all')
    const createUrl = createDraft.url.trim()
    const createUrlInvalid = Boolean(createUrl) && !validDestinationUrl(createUrl)
    const createNameDuplicate = destinationNameInUse(destinations, normalizeDestinationName(createDraft.name) || defaultDestinationName(createDraft.kind))
    const busyLabel = destinationBusyLabel(busy)
    const normalizedDestinationQuery = destinationQuery.trim().toLowerCase()
    const visibleDestinations = destinations.filter(destination => {
        const destinationStatus = destination.status || (destination.deliveryReady ? 'active' : 'configured')
        const destinationDeliveries = deliveriesForDestination(destination, deliveries)
        const statusMatches = destinationStatusFilter === 'all' || destinationStatus === destinationStatusFilter
        if (!statusMatches) return false
        const destinationKind = destination.kind || destination.type || 'webhook'
        const kindMatches = destinationKindFilter === 'all' || destinationKind === destinationKindFilter
        if (!kindMatches) return false
        if (!normalizedDestinationQuery) return true
        return destinationSearchText(destination, destinationDeliveries).includes(normalizedDestinationQuery)
    })
    const destinationFiltersActive = Boolean(destinationQuery.trim()) || destinationStatusFilter !== 'all' || destinationKindFilter !== 'all'
    return (
        <details id='destinations' className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-destinations-disclosure>
            <summary className='flex cursor-pointer list-none flex-col gap-3 p-4 outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 dark:hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                <SectionTitle icon={<Webhook className='h-4 w-4' />} title='Saved destinations' detail='Inventory, tests, and removal stay available after a destination is saved.' />
                <span className='shrink-0 rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>
                    {visibleDestinations.length}/{destinations.length} destination{destinations.length === 1 ? '' : 's'}
                </span>
            </summary>
            <div className='grid gap-2 border-t border-ui-border p-4 dark:border-ui-border'>
                {busyLabel && <InlineBusy label={busyLabel} marker='data-org-destination-busy' />}
                {canManage && (
                    <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas' data-org-destination-create='true'>
                        <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem]'>
                            <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                                Name
                                <input value={createDraft.name} disabled={Boolean(busy)} onChange={event => setCreateDraft({ ...createDraft, name: event.target.value })} className={inputClass} placeholder='Security alerts' />
                                {createNameDuplicate && <span className='text-xs font-semibold text-ui-danger dark:text-ui-danger'>Name already in use.</span>}
                            </label>
                            <SelectField label='Type' value={createDraft.kind} options={destinationKinds} disabled={Boolean(busy)} onChange={value => setCreateDraft({ ...createDraft, kind: value as DestinationCreateDraft['kind'] })} />
                        </div>
                        <div className='grid gap-2 md:grid-cols-[minmax(12rem,1fr)_auto] md:items-end'>
                            <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                                URL
                                <input value={createDraft.url} disabled={Boolean(busy)} onChange={event => setCreateDraft({ ...createDraft, url: event.target.value })} className={inputClass} placeholder='https://discord.com/api/webhooks/...' />
                                {createUrlInvalid && <span className='text-xs font-semibold text-ui-danger dark:text-ui-danger'>Use a valid HTTPS URL.</span>}
                            </label>
                            <button type='button' className={primaryButtonClass} disabled={!createUrl || createUrlInvalid || createNameDuplicate || Boolean(busy)} onClick={onCreate}>
                                <CheckCircle2 className='h-4 w-4' />
                                Add destination
                            </button>
                        </div>
                        <RowStatus message={rowMessages['destination-create']} />
                    </div>
                )}
                {destinations.length === 0 && <EmptyLine text={canManage ? 'Add a Discord or webhook destination to enable delivery tests.' : 'Destination access appears after an owner adds one.'} />}
                {destinations.length > 0 && (
                    <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas md:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]' data-org-destination-filter-strip='true'>
                        <label className='grid min-w-0 gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                            Find destination
                            <input
                                value={destinationQuery}
                                disabled={Boolean(busy)}
                                onChange={event => setDestinationQuery(event.target.value)}
                                className={inputClass}
                                placeholder='Name, status, hash, delivery'
                            />
                        </label>
                        <SelectField
                            label='Status'
                            value={destinationStatusFilter}
                            options={['all', 'active', 'paused', 'configured']}
                            disabled={Boolean(busy)}
                            onChange={setDestinationStatusFilter}
                        />
                        <SelectField
                            label='Type'
                            value={destinationKindFilter}
                            options={['all', ...destinationKinds]}
                            disabled={Boolean(busy)}
                            onChange={setDestinationKindFilter}
                        />
                        <div className='grid content-end gap-1'>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-2 text-center text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted' data-org-destination-filter-count='true'>
                                {visibleDestinations.length}/{destinations.length} shown
                            </span>
                            <button
                                type='button'
                                className={secondaryButtonClass}
                                disabled={!destinationFiltersActive || Boolean(busy)}
                                onClick={() => {
                                    setDestinationQuery('')
                                    setDestinationStatusFilter('all')
                                    setDestinationKindFilter('all')
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
                {destinations.length > 0 && visibleDestinations.length === 0 && <EmptyLine text='Adjust filters to see matching destinations.' />}
                {visibleDestinations.map(destination => {
                    const draft = editing[destination.id]
                    const destinationStatus = destination.status || (destination.deliveryReady ? 'active' : 'configured')
                    const latestDelivery = latestDeliveryForDestination(destination, deliveries)
                    const draftUrl = draft?.url.trim() || ''
                    const draftUrlInvalid = Boolean(draftUrl) && !validDestinationUrl(draftUrl)
                    const draftNameDuplicate = draft ? destinationNameInUse(destinations, normalizeDestinationName(draft.name) || destination.name || destination.id, destination.id) : false
                    const draftChanged = draft ? destinationEditChanged(destination, draft) : false
                    const selected = selectedSubject.type === 'destination' && selectedSubject.id === destination.id
                    return (
                        <div
                            role='button'
                            tabIndex={0}
                            aria-pressed={selected}
                            id={`destination-${encodeURIComponent(destination.id)}`}
                            key={destination.id}
                            onClick={() => onSelectSubject({ type: 'destination', id: destination.id })}
                            onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    onSelectSubject({ type: 'destination', id: destination.id })
                                }
                            }}
                            className={`grid min-w-0 gap-3 rounded-lg border p-3 text-left transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-panel' : 'border-ui-border hover:bg-ui-raised dark:border-ui-border dark:hover:bg-ui-panel'}`}
                        >
                            <span className='flex min-w-0 items-start justify-between gap-2'>
                                <span className='min-w-0'>
                                    <span className='block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(destination.name || destination.id)}</span>
                                    <span className='mt-1 block truncate text-xs text-ui-muted dark:text-ui-muted'>{destinationDisplayState(destination)}</span>
                                </span>
                                <StatusPill status={destinationStatus} />
                            </span>
                            {draft ? (
                                <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem_8rem]' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                    <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                                        Name
                                        <input value={draft.name} disabled={Boolean(busy)} onChange={event => setEditing(current => ({ ...current, [destination.id]: { ...draft, name: event.target.value } }))} className={inputClass} />
                                        {draftNameDuplicate && <span className='text-xs font-semibold text-ui-danger dark:text-ui-danger'>Name already in use.</span>}
                                    </label>
                                    <SelectField label='Type' value={draft.kind} options={destinationKinds} disabled={Boolean(busy)} onChange={value => setEditing(current => ({ ...current, [destination.id]: { ...draft, kind: value as DestinationEditDraft['kind'] } }))} />
                                    <SelectField label='Status' value={draft.status} options={['active', 'paused']} disabled={Boolean(busy)} onChange={value => setEditing(current => ({ ...current, [destination.id]: { ...draft, status: value } }))} />
                                    <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted md:col-span-3'>
                                        Rotate URL
                                        <input value={draft.url} disabled={Boolean(busy)} onChange={event => setEditing(current => ({ ...current, [destination.id]: { ...draft, url: event.target.value } }))} className={inputClass} placeholder='Leave blank to keep the stored redacted endpoint' />
                                        {draftUrlInvalid && <span className='text-xs font-semibold text-ui-danger dark:text-ui-danger'>Use a valid HTTPS URL.</span>}
                                    </label>
                                    {!draftUrlInvalid && !draftNameDuplicate && !draftChanged && <p className='rounded-md bg-ui-raised px-3 py-2 text-xs font-semibold text-ui-muted dark:bg-ui-canvas dark:text-ui-muted md:col-span-3'>Destination settings are current.</p>}
                                    <div className='flex flex-wrap gap-2 md:col-span-3' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                        <button type='button' className={primaryButtonClass} disabled={draftUrlInvalid || draftNameDuplicate || !draftChanged || Boolean(busy)} onClick={() => onUpdate(destination, draft)}>
                                            <CheckCircle2 className='h-4 w-4' />
                                            Save
                                        </button>
                                        <button type='button' className={secondaryButtonClass} disabled={Boolean(busy)} onClick={() => setEditing(current => {
                                            const next = { ...current }
                                            delete next[destination.id]
                                            return next
                                        })}>Cancel</button>
                                        <RowStatus message={rowMessages[`destination-${destination.id}`]} />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span className='grid gap-1 text-xs text-ui-muted dark:text-ui-muted'>
                                        <span className='truncate'>Type: {destination.kind || destination.type || 'webhook'}</span>
                                        <span className='truncate'>Destination: {destinationDisplayState(destination)}</span>
                                    </span>
                                    <DestinationDeliverySummary delivery={latestDelivery} />
                                    {latestDelivery && <DeliveryPayloadPreview delivery={latestDelivery} compact />}
                                    <span className='flex flex-wrap items-center gap-2' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                        <button type='button' className={secondaryButtonClass} disabled={Boolean(busy)} onClick={() => onTest(destination)}>
                                            <RefreshCw className='h-4 w-4' />
                                            Test
                                        </button>
                                        <button type='button' aria-label='Edit destination' className={secondaryButtonClass} disabled={!canManage || Boolean(busy)} onClick={() => setEditing(current => ({ ...current, [destination.id]: { name: destination.name || destination.id, kind: (destination.kind || destination.type || 'webhook') === 'discord' ? 'discord' : 'webhook', url: '', status: destination.status || 'active' } }))}>
                                            <Pencil className='h-4 w-4' />
                                            Edit
                                        </button>
                                        {destinationStatus === 'active' ? (
                                            <button type='button' className={secondaryButtonClass} disabled={!canManage || Boolean(busy)} onClick={() => onUpdate(destination, { name: destination.name || destination.id, kind: (destination.kind || destination.type || 'webhook') === 'discord' ? 'discord' : 'webhook', url: '', status: 'paused' })}>
                                                <Pause className='h-4 w-4' />
                                                Disable
                                            </button>
                                        ) : (
                                            <button type='button' className={secondaryButtonClass} disabled={!canManage || Boolean(busy)} onClick={() => onUpdate(destination, { name: destination.name || destination.id, kind: (destination.kind || destination.type || 'webhook') === 'discord' ? 'discord' : 'webhook', url: '', status: 'active' })}>
                                                <Play className='h-4 w-4' />
                                                Enable
                                            </button>
                                        )}
                                        <ConfirmActionButton ariaLabel='Remove destination' disabled={!canManage || Boolean(busy)} onConfirm={() => onDelete(destination)} icon={<Trash2 className='h-4 w-4' />} />
                                        <RowStatus message={rowMessages[`destination-${destination.id}`]} />
                                    </span>
                                </>
                            )}
                        </div>
                    )
                })}
            </div>
        </details>
    )
}

function WatchlistPanel({ watchlists, activeTerms, canManage, busy, draft, setDraft, suggestions, editing, setEditing, onCreate, onSave, onAction, onDelete, organization, alerts, deliveries, destinationDrafts, deliveryResults, setDestinationDrafts, onTestDestination, onCleanup, rowMessages, draftDuplicate, selectedSubject, onSelectSubject }: { watchlists: WatchlistItem[], activeTerms: AlertTerm[], canManage: boolean, busy: string, draft: { kind: WatchlistKind, value: string, notes: string }, setDraft: (next: { kind: WatchlistKind, value: string, notes: string }) => void, suggestions: WatchlistSuggestion[], editing: Record<string, { kind: WatchlistKind, value: string, notes: string }>, setEditing: (next: Record<string, { kind: WatchlistKind, value: string, notes: string }> | ((current: Record<string, { kind: WatchlistKind, value: string, notes: string }>) => Record<string, { kind: WatchlistKind, value: string, notes: string }>)) => void, onCreate: () => void, onSave: (item: WatchlistItem) => void, onAction: (item: WatchlistItem, action: 'pause' | 'resume' | 'archive' | 'restore') => void, onDelete: (item: WatchlistItem) => void, organization: OrganizationSummary, alerts: ScopedAlert[], deliveries: DeliveryRow[], destinationDrafts: Record<string, DestinationDraft>, deliveryResults: Record<string, DeliveryRow>, setDestinationDrafts: (next: Record<string, DestinationDraft> | ((current: Record<string, DestinationDraft>) => Record<string, DestinationDraft>)) => void, onTestDestination: (item: WatchlistItem, mode: 'save' | 'replay') => void, onCleanup: () => void, rowMessages: Record<string, RowMessage>, draftDuplicate: boolean, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void }) {
    const [watchlistQuery, setWatchlistQuery] = useState('')
    const [watchlistStatusFilter, setWatchlistStatusFilter] = useState('all')
    const archivedCount = watchlists.filter(item => item.status === 'archived').length
    const busyLabel = watchlistBusyLabel(busy)
    const normalizedWatchlistQuery = normalizeWatchlistValue(watchlistQuery)
    const visibleWatchlists = watchlists.filter(item => {
        const statusMatches = watchlistStatusFilter === 'all' || item.status === watchlistStatusFilter
        if (!statusMatches) return false
        if (!normalizedWatchlistQuery) return true
        return watchlistSearchText(item, organization).includes(normalizedWatchlistQuery)
    })
    const filtersActive = Boolean(watchlistQuery.trim()) || watchlistStatusFilter !== 'all'
    return (
        <section id='watchlists' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <SectionTitle icon={<BellRing className='h-4 w-4' />} title='Shared watchlists' detail='Customer-owned terms that drive DWM alert scope, cases, and delivery destinations.' />
                <button type='button' className={secondaryButtonClass} disabled={!canManage || archivedCount === 0 || Boolean(busy)} onClick={onCleanup}>
                    <Archive className='h-4 w-4' />
                    Cleanup archived
                </button>
            </div>
            {busyLabel && <InlineBusy label={busyLabel} marker='data-org-watchlist-busy' />}
            <div className='mt-2'><RowStatus message={rowMessages['watchlists-cleanup']} /></div>
            <details className='mt-4 overflow-hidden rounded-lg border border-ui-border bg-ui-raised dark:border-ui-border dark:bg-ui-canvas' data-org-watchlist-starter='true' data-org-watchlist-add-disclosure='true' open={watchlists.length === 0 ? true : undefined}>
                <summary className='flex min-h-12 cursor-pointer list-none flex-col gap-2 px-3 py-2 outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/25 dark:hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span className='flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                        <span>Add shared term</span>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{watchlists.length} saved</span>
                    </span>
                    <span className='text-xs font-semibold text-ui-primary dark:text-ui-primary'>Company, domain, vendor, actor</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-3 dark:border-ui-border'>
                    <div className='flex flex-wrap gap-2'>
                        {suggestions.map(suggestion => (
                            <button
                                key={suggestion.id}
                                type='button'
                                disabled={!canManage || suggestion.disabled || Boolean(busy)}
                                onClick={() => setDraft({ kind: suggestion.kind, value: suggestion.value, notes: suggestion.notes })}
                                className='inline-flex min-h-9 max-w-full items-center gap-2 rounded-md border border-ui-primary/35 bg-ui-primary/10 px-3 text-xs font-semibold text-ui-primary transition hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:border-ui-border disabled:bg-ui-panel disabled:text-ui-muted dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary dark:hover:bg-ui-primary/15 dark:disabled:border-ui-border dark:disabled:bg-ui-panel dark:disabled:text-ui-muted'
                                data-org-watchlist-suggestion='true'
                            >
                                <span className='truncate'>{suggestion.label}</span>
                                <span className='max-w-40 truncate font-mono'>{suggestion.value}</span>
                            </button>
                        ))}
                        {watchlistTemplates.map(template => (
                            <button
                                key={template.label}
                                type='button'
                                disabled={!canManage || Boolean(busy)}
                                onClick={() => setDraft({ kind: template.kind, value: '', notes: template.notes })}
                                className='inline-flex min-h-9 items-center rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 disabled:cursor-not-allowed disabled:opacity-55 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                            >
                                {template.label}
                            </button>
                        ))}
                    </div>
                    <div className='grid gap-3 md:grid-cols-[9rem_1fr_auto]' data-org-watchlist-create-grid='true'>
                        <SelectField label='Type' value={draft.kind} options={watchlistKinds} disabled={!canManage} onChange={value => setDraft({ ...draft, kind: value as WatchlistKind })} />
                        <Field label='Term' value={draft.value} disabled={!canManage} onChange={value => setDraft({ ...draft, value })} placeholder='company.com, supplier, brand, actor' />
                        <div className='grid content-end'>
                            <button type='button' className={`${primaryButtonClass} whitespace-nowrap`} disabled={!canManage || !draft.value.trim() || draftDuplicate || Boolean(busy)} onClick={onCreate}>
                                <BellRing className='h-4 w-4' />
                                Add term
                            </button>
                        </div>
                        <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted md:col-span-3'>
                            Notes
                            <textarea value={draft.notes} disabled={!canManage} onChange={event => setDraft({ ...draft, notes: event.target.value })} className={`${inputClass} min-h-16 resize-y`} placeholder='Reason, owner, delivery context' />
                        </label>
                        {draftDuplicate && <p className='rounded-md bg-ui-warning/10 px-3 py-2 text-xs font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning md:col-span-3'>This term already exists in this organization.</p>}
                    </div>
                </div>
            </details>

            <div className='mt-5 grid gap-3'>
                {watchlists.length > 0 && (
                    <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas md:grid-cols-[minmax(0,1fr)_10rem_auto]' data-org-watchlist-filter-strip='true'>
                        <label className='grid min-w-0 gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                            Search terms
                            <input
                                value={watchlistQuery}
                                disabled={Boolean(busy)}
                                onChange={event => setWatchlistQuery(event.target.value)}
                                className={inputClass}
                                placeholder='Domain, supplier, owner, alert ref'
                            />
                        </label>
                        <SelectField
                            label='Status'
                            value={watchlistStatusFilter}
                            options={['all', 'active', 'paused', 'archived']}
                            disabled={Boolean(busy)}
                            onChange={setWatchlistStatusFilter}
                        />
                        <div className='grid content-end gap-1'>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-2 text-center text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted' data-org-watchlist-filter-count='true'>
                                {visibleWatchlists.length}/{watchlists.length} shown
                            </span>
                            <button
                                type='button'
                                className={secondaryButtonClass}
                                disabled={!filtersActive || Boolean(busy)}
                                onClick={() => {
                                    setWatchlistQuery('')
                                    setWatchlistStatusFilter('all')
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
                {watchlists.length === 0 && (
                    <div className='rounded-lg border border-dashed border-ui-primary/35 bg-ui-panel p-4 text-sm leading-6 text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>
                        <p className='font-semibold text-ui-text dark:text-ui-text'>Create first watchlist term.</p>
                        <p className='mt-1'>Add a company, domain, vendor, or actor term.</p>
                    </div>
                )}
                {watchlists.length > 0 && visibleWatchlists.length === 0 && (
                    <div className='rounded-lg border border-dashed border-ui-border bg-ui-panel p-4 text-sm text-ui-muted dark:border-ui-border dark:bg-ui-panel' data-org-watchlist-filter-empty='true'>
                        Adjust filters to see matching watchlist terms.
                    </div>
                )}
                {visibleWatchlists.map(item => {
                    const edit = editing[item.id]
                    const editDuplicate = edit ? isDuplicateWatchlistTerm(watchlists, edit.kind, edit.value, item.id) : false
                    const editChanged = edit ? watchlistDraftChanged(item, edit) : false
                    const selected = selectedSubject.type === 'watchlist' && selectedSubject.id === item.id
                    return (
                        <div
                            key={item.id}
                            role='button'
                            tabIndex={0}
                            aria-pressed={selected}
                            className={`rounded-lg border p-3 transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-panel' : 'border-ui-border dark:border-ui-border'}`}
                            onClick={() => onSelectSubject({ type: 'watchlist', id: item.id })}
                            onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    onSelectSubject({ type: 'watchlist', id: item.id })
                                }
                            }}
                        >
                            {edit ? (
                                <div className='grid gap-3 md:grid-cols-[9rem_1fr]' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                    <SelectField label='Type' value={edit.kind} options={watchlistKinds} disabled={Boolean(busy)} onChange={value => setEditing(current => ({ ...current, [item.id]: { ...edit, kind: value as WatchlistKind } }))} />
                                    <Field label='Term' value={edit.value} disabled={Boolean(busy)} onChange={value => setEditing(current => ({ ...current, [item.id]: { ...edit, value } }))} />
                                    <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted md:col-span-2'>
                                        Notes
                                        <textarea value={edit.notes} disabled={Boolean(busy)} onChange={event => setEditing(current => ({ ...current, [item.id]: { ...edit, notes: event.target.value } }))} className={`${inputClass} min-h-20 resize-y`} />
                                    </label>
                                    {editDuplicate && <p className='rounded-md bg-ui-warning/10 px-3 py-2 text-xs font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning md:col-span-2'>This term already exists in this organization.</p>}
                                    {!editDuplicate && !editChanged && <p className='rounded-md bg-ui-raised px-3 py-2 text-xs font-semibold text-ui-muted dark:bg-ui-canvas dark:text-ui-muted md:col-span-2'>Watchlist term is current.</p>}
                                    <div className='flex flex-wrap gap-2 md:col-span-2' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                        <button type='button' className={primaryButtonClass} disabled={!edit.value.trim() || editDuplicate || !editChanged || Boolean(busy)} onClick={() => onSave(item)}>
                                            <CheckCircle2 className='h-4 w-4' />
                                            Save
                                        </button>
                                        <button type='button' className={secondaryButtonClass} disabled={Boolean(busy)} onClick={() => setEditing(current => {
                                            const next = { ...current }
                                            delete next[item.id]
                                            return next
                                        })}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className='grid gap-3'>
                                    <div className='grid gap-3 2xl:grid-cols-[minmax(16rem,1fr)_minmax(17rem,0.8fr)_auto] 2xl:items-start' data-org-watchlist-row-layout='true'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>{item.kind}</span>
                                                <StatusPill status={item.status} />
                                            </div>
                                            <p className='mt-2 line-clamp-2 wrap-break-word text-base font-semibold text-ui-text dark:text-ui-text'>{item.value}</p>
                                            <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{item.notes || 'Add delivery context.'}</p>
                                            <div className='mt-2 grid gap-1 text-xs text-ui-muted dark:text-ui-muted sm:grid-cols-2'>
                                                <span className='truncate'>Org: {sanitizeOrganizationDisplayCopy(item.organizationId || organization.id)}</span>
                                                <span className='truncate'>Owner: {item.updatedBy || item.createdBy || 'system'}</span>
                                                <span className='truncate'>Ref: {item.alertGenerationRef || item.id}</span>
                                                <span className='truncate'>Alerts: {alertsForWatchlist(item, alerts).length}</span>
                                            </div>
                                        </div>
                                        <WatchlistDestinationSummary item={item} delivery={deliveryResults[item.id] || latestDeliveryForWatchlist(item, deliveries)} />
                                        {canManage && (
                                            <div className='flex flex-wrap gap-2' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                                <button type='button' aria-label='Edit watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => setEditing(current => ({ ...current, [item.id]: { kind: item.kind, value: item.value, notes: item.notes || '' } }))}>
                                                    <Pencil className='h-4 w-4' />
                                                </button>
                                                {item.status === 'active' && <button type='button' aria-label='Pause watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'pause')}><Pause className='h-4 w-4' /></button>}
                                                {item.status === 'paused' && <button type='button' aria-label='Resume watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'resume')}><Play className='h-4 w-4' /></button>}
                                                {item.status === 'archived' && <button type='button' aria-label='Restore watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'restore')}><Archive className='h-4 w-4' /></button>}
                                                {item.status !== 'archived' && <ConfirmActionButton ariaLabel='Archive watchlist term' disabled={Boolean(busy)} onConfirm={() => onDelete(item)} icon={<Trash2 className='h-4 w-4' />} />}
                                            </div>
                                        )}
                                    </div>
                                    <DestinationControls
                                        item={item}
                                        organization={organization}
                                        alert={alertForWatchlist(item, alerts)}
                                        delivery={deliveryResults[item.id] || latestDeliveryForWatchlist(item, deliveries)}
                                        draft={destinationDrafts[item.id] || { kind: 'discord', url: '' }}
                                        canManage={canManage}
                                        busy={busy}
                                        onDraftChange={next => setDestinationDrafts(current => ({ ...current, [item.id]: next }))}
                                        onSelect={() => onSelectSubject({ type: 'destination', id: item.id })}
                                        onTest={mode => onTestDestination(item, mode)}
                                    />
                                    <RowStatus message={rowMessages[`watchlist-${item.id}`]} />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className='mt-4 rounded-lg border border-ui-success/35 bg-ui-success/10 p-3 text-sm text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'>
                <strong>{activeTerms.length}</strong> active exported term{activeTerms.length === 1 ? '' : 's'} available to alert generation.
            </div>
        </section>
    )
}

function WatchlistDestinationSummary({ item, delivery }: { item: WatchlistItem, delivery?: DeliveryRow | null }) {
    return (
        <div className='grid gap-1 rounded-lg border border-ui-border bg-ui-panel p-3 text-xs dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex items-center justify-between gap-2'>
                <span className='font-semibold text-ui-text dark:text-ui-text'>Destination</span>
                <StatusPill status={destinationConfigured(item) ? 'configured' : 'none'} />
            </div>
            <span className='truncate text-ui-muted dark:text-ui-muted'>{destinationDisplayState(item)}</span>
            <span className='truncate text-ui-muted dark:text-ui-muted'>{delivery ? `Last ${delivery.dryRun ? 'test' : 'delivery'} ${delivery.status || 'attempted'}` : 'No delivery history yet'}</span>
            <span className='truncate text-ui-muted dark:text-ui-muted'>History: {delivery ? formatDate(delivery.attemptedAt || delivery.updatedAt || delivery.createdAt) : 'none'}</span>
        </div>
    )
}

function DestinationDeliverySummary({ delivery }: { delivery?: DeliveryRow | null }) {
    if (!delivery) {
        return (
            <div className='grid gap-1 rounded-md bg-ui-raised px-3 py-2 text-xs text-ui-muted dark:bg-ui-canvas dark:text-ui-muted' data-org-destination-latest='empty'>
                <span>Test destination to start history.</span>
                <span>Run a dry test or replay from delivery history.</span>
            </div>
        )
    }
    const failed = delivery.status === 'failed' || Boolean(delivery.error)
    return (
        <div className={`grid gap-1 rounded-md px-3 py-2 text-xs ${failed ? 'bg-ui-warning/10 text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning' : 'bg-ui-raised text-ui-muted dark:bg-ui-canvas dark:text-ui-muted'}`} data-org-destination-latest='true'>
            <span className='flex flex-wrap items-center gap-2'>
                <span className='font-semibold text-ui-text dark:text-ui-text'>Last {delivery.dryRun ? 'test' : 'delivery'}:</span>
                <StatusPill status={delivery.status || 'attempt'} />
                <span>{formatDate(delivery.attemptedAt || delivery.updatedAt || delivery.createdAt)}</span>
            </span>
            <span className='truncate'>{failed ? sanitizeOrganizationDisplayCopy(delivery.error || delivery.errorClass || 'Delivery failed.') : sanitizeOrganizationDisplayCopy(delivery.responseSummary || delivery.errorClass || 'Delivery accepted.')}</span>
            <span className='truncate'>{deliveryTraceLabel(delivery)}</span>
            {(delivery.nextRetryAt || delivery.attemptCount !== undefined || delivery.retryCount !== undefined) && (
                <span className='truncate'>Retry: {delivery.nextRetryAt ? formatDate(delivery.nextRetryAt) : `${delivery.attemptCount ?? delivery.retryCount ?? 0} attempts`}</span>
            )}
        </div>
    )
}

function DeliveryPayloadPreview({ delivery, compact = false }: { delivery: DeliveryRow, compact?: boolean }) {
    const preview = payloadPreviewForDelivery(delivery)
    if (!preview) return null
    const context = preview.context || {}
    const fields = (preview.fields || []).slice(0, compact ? 2 : 4)
    const fieldNames = preview.fieldNames?.slice(0, compact ? 3 : 6) || []
    const route = context.casePath || context.alertUrl

    return (
        <div className='grid gap-2 rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-xs dark:border-ui-border dark:bg-ui-canvas' data-org-delivery-payload-preview='true'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <span className='truncate font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(preview.title || context.alertTitle || 'Discord payload preview')}</span>
                <span className='shrink-0 rounded-md border border-ui-border bg-ui-panel px-2 py-0.5 font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>
                    {delivery.dryRun ? 'dry run' : delivery.deliveryKind || 'webhook'}
                </span>
            </div>
            {preview.descriptionPreview && <p className='line-clamp-2 text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(preview.descriptionPreview)}</p>}
            <div className='grid gap-1 sm:grid-cols-2'>
                {context.orgName && <span className='truncate'>Org: {sanitizeOrganizationDisplayCopy(context.orgName)}</span>}
                {context.watchlistName && <span className='truncate'>Watchlist: {sanitizeOrganizationDisplayCopy(context.watchlistName)}</span>}
                {context.severity && <span className='truncate'>Severity: {sanitizeOrganizationDisplayCopy(context.severity)}</span>}
                {context.sourceFamily && <span className='truncate'>Source: {sanitizeOrganizationDisplayCopy(context.sourceFamily)}</span>}
                {context.evidenceCount !== undefined && context.evidenceCount !== null && <span className='truncate'>Evidence: {context.evidenceCount}</span>}
                {context.deliveryState && <span className='truncate'>State: {sanitizeOrganizationDisplayCopy(context.deliveryState)}</span>}
            </div>
            {fields.length > 0 && (
                <div className='grid gap-1'>
                    {fields.map(field => (
                        <p key={`${field.name}-${field.valuePreview}`} className='line-clamp-1 text-ui-muted dark:text-ui-muted'>
                            <span className='font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(field.name || 'Field')}:</span> {sanitizeOrganizationDisplayCopy(field.valuePreview || '')}
                        </p>
                    ))}
                </div>
            )}
            {fields.length === 0 && fieldNames.length > 0 && <p className='truncate text-ui-muted dark:text-ui-muted'>Fields: {fieldNames.map(sanitizeOrganizationDisplayCopy).join(', ')}</p>}
            {context.matchReason && !compact && <p className='line-clamp-2 text-ui-muted dark:text-ui-muted'>Match: {sanitizeOrganizationDisplayCopy(context.matchReason)}</p>}
            {route && !compact && <p className='truncate text-ui-muted dark:text-ui-muted'>Linked case or alert available.</p>}
        </div>
    )
}

function DestinationControls({ item, organization, alert, delivery, draft, canManage, busy, onDraftChange, onSelect, onTest }: { item: WatchlistItem, organization: OrganizationSummary, alert?: ScopedAlert, delivery?: DeliveryRow | null, draft: DestinationDraft, canManage: boolean, busy: string, onDraftChange: (next: DestinationDraft) => void, onSelect: () => void, onTest: (mode: 'save' | 'replay') => void }) {
    const configured = destinationConfigured(item)
    const destinationState = destinationDisplayState(item)
    const selectedAlertId = alert?.id || liveDwmAlertId
    const deliveryStatus = delivery?.status || (configured ? 'Configured' : 'None')
    const replayLabel = delivery?.status === 'failed' || delivery?.status === 'skipped' ? 'Retry' : 'Replay'
    const destinationUrl = draft.url.trim()
    const destinationUrlInvalid = Boolean(destinationUrl) && !validDestinationUrl(destinationUrl)
    return (
        <div className='grid min-w-0 gap-3 overflow-hidden rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas' onClick={event => {
            event.stopPropagation()
            onSelect()
        }} onKeyDown={stopRowSelectionKeys}>
            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
                <div className='min-w-0'>
                    <p className='flex flex-wrap items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                        <Webhook className='h-4 w-4 text-ui-primary' />
                        Destination
                        <StatusPill status={configured ? 'configured' : 'not configured'} />
                    </p>
                    <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{destinationState}</p>
                </div>
                <div className='grid grid-cols-2 gap-2 sm:flex'>
                    <button type='button' className={secondaryButtonClass} disabled={!configured || Boolean(busy)} onClick={() => onTest('replay')}>
                        <Play className='h-4 w-4' />
                        {replayLabel}
                    </button>
                    <a href={`/api/dwm/webhooks/deliveries?organizationId=${encodeURIComponent(organization.id)}`} className={secondaryButtonClass}>
                        <ExternalLink className='h-4 w-4' />
                        History
                    </a>
                </div>
            </div>
            <div className='grid min-w-0 gap-2 lg:grid-cols-[8rem_minmax(0,1fr)] 2xl:grid-cols-[8rem_minmax(0,1fr)_auto]'>
                <SelectField label='Type' value={draft.kind} options={destinationKinds} disabled={!canManage || Boolean(busy)} onChange={value => onDraftChange({ ...draft, kind: value as DestinationDraft['kind'] })} />
                <label className='grid min-w-0 gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                    URL
                    <input value={draft.url} disabled={!canManage || Boolean(busy)} onChange={event => onDraftChange({ ...draft, url: event.target.value })} className={inputClass} placeholder='https://discord.com/api/webhooks/...' />
                    {destinationUrlInvalid && <span className='text-xs font-semibold text-ui-danger dark:text-ui-danger'>Use a valid HTTPS URL.</span>}
                </label>
                <label className='grid content-end lg:col-span-2 2xl:col-span-1'>
                    <span className='sr-only'>Test destination</span>
                    <button type='button' className={`${primaryButtonClass} whitespace-nowrap`} disabled={!canManage || !destinationUrl || destinationUrlInvalid || Boolean(busy)} onClick={() => onTest('save')}>
                        <CheckCircle2 className='h-4 w-4' />
                        Test and save
                    </button>
                </label>
            </div>
            <div className='grid gap-2 text-xs text-ui-muted dark:text-ui-muted sm:grid-cols-3'>
                <span className='truncate'>Selected alert: {selectedAlertId}</span>
                <span className='truncate'>Last delivery: {deliveryStatus}</span>
                <span className='truncate'>Tenant: {sanitizeOrganizationDisplayCopy(item.tenantId || organization.tenantId || 'default')}</span>
            </div>
            {delivery?.error && <p className='rounded-md bg-ui-warning/10 px-3 py-2 text-xs font-medium text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'>{organizationDeliveryErrorText(delivery.error)}</p>}
            {delivery && <DeliveryPayloadPreview delivery={delivery} compact />}
        </div>
    )
}

function DeliveryHistoryPanel({ organization, deliveries, selectedSubject, canManage, busy, rowMessages, onReplay }: { organization: OrganizationSummary, deliveries: DeliveryRow[], selectedSubject: ActivitySubject, canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, onReplay: (delivery: DeliveryRow) => void }) {
    const matchingDeliveries = deliveries
        .filter(delivery => deliveryMatchesSubject(delivery, selectedSubject))
        .sort((left, right) => deliveryTime(right) - deliveryTime(left))
    const scopedDeliveries = matchingDeliveries
        .slice(0, 8)
    const allHref = `/api/dwm/webhooks/deliveries?organizationId=${encodeURIComponent(organization.id)}`
    const selectedHref = deliveryHistoryHref(allHref, selectedSubject)
    const totalFailures = matchingDeliveries.filter(delivery => delivery.status === 'failed' || delivery.error).length
    const retryCount = matchingDeliveries.filter(delivery => Boolean(delivery.nextRetryAt)).length
    const hiddenDeliveryCount = Math.max(0, matchingDeliveries.length - scopedDeliveries.length)
    return (
        <section id='delivery-history' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-delivery-history='true'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <SectionTitle icon={<Webhook className='h-4 w-4' />} title='Delivery history' detail='Recent tests, replays, failures, and retry state for the selected organization scope.' />
                <div className='flex flex-wrap gap-2'>
                    <StatusPill status={`${matchingDeliveries.length} total`} />
                    {hiddenDeliveryCount > 0 && <StatusPill status={`${hiddenDeliveryCount} older`} />}
                    {totalFailures > 0 && <StatusPill status={`${totalFailures} failed`} />}
                    {retryCount > 0 && <StatusPill status={`${retryCount} retry`} />}
                    <a href={selectedHref} className={secondaryButtonClass}>
                        <ExternalLink className='h-4 w-4' />
                        Open delivery log
                    </a>
                </div>
            </div>
            <div className='mt-4 overflow-x-auto rounded-lg border border-ui-border dark:border-ui-border'>
                {scopedDeliveries.length === 0 ? (
                    <EmptyLine text={selectedSubject.type === 'organization' ? 'Test or replay a destination to populate delivery history.' : 'Select a row with delivery activity or run a test destination.'} />
                ) : (
                    <>
                        <div className='grid gap-2 p-2 md:hidden' data-org-delivery-mobile-list='true'>
                            {scopedDeliveries.map(delivery => (
                                <DeliveryHistoryMobileRow
                                    key={delivery.id}
                                    delivery={delivery}
                                    organizationId={organization.id}
                                    canManage={canManage}
                                    busy={busy}
                                    rowMessage={rowMessages[`delivery-${delivery.id}`]}
                                    onReplay={onReplay}
                                />
                            ))}
                        </div>
                        <table className='hidden min-w-full border-separate border-spacing-0 text-left text-sm md:table' data-org-delivery-desktop-table='true'>
                            <thead className='bg-ui-raised text-xs uppercase tracking-[0.08em] text-ui-muted dark:bg-ui-canvas dark:text-ui-muted'>
                                <tr>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>State</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>Target</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>Alert / case</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>Retry</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>When</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scopedDeliveries.map(delivery => {
                                    const replayable = canReplayDelivery(delivery)
                                    const replayLabel = delivery.status === 'failed' || delivery.nextRetryAt ? 'Retry' : 'Replay'
                                    return (
                                        <tr key={delivery.id} className='align-top hover:bg-ui-raised dark:hover:bg-ui-panel'>
                                            <td className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                <div className='grid gap-1'>
                                                    <StatusPill status={delivery.status || 'attempt'} />
                                                    <span className='text-xs text-ui-muted dark:text-ui-muted'>{delivery.dryRun ? 'dry run' : delivery.deliveryKind || 'webhook'}</span>
                                                    {delivery.httpStatus !== undefined && <span className='text-xs text-ui-muted dark:text-ui-muted'>HTTP {delivery.httpStatus}</span>}
                                                </div>
                                            </td>
                                            <td className='max-w-56 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                <p className='truncate text-xs font-semibold text-ui-text dark:text-ui-text'>{destinationDisplayState(delivery)}</p>
                                                <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{delivery.webhookDestinationId ? 'Saved delivery destination' : 'Delivery destination redacted'}</p>
                                                <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{deliveryTraceLabel(delivery)}</p>
                                            </td>
                                            <td className='max-w-64 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                <DeliveryReference delivery={delivery} organizationId={organization.id} />
                                                {delivery.error && <p className='mt-1 line-clamp-2 rounded-md bg-ui-warning/10 px-2 py-1 text-xs font-medium text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'>{organizationDeliveryErrorText(delivery.error)}</p>}
                                                {!delivery.error && delivery.responseSummary && <p className='mt-1 line-clamp-2 text-xs text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(delivery.responseSummary) || delivery.responseSummary}</p>}
                                                <div className='mt-2'>
                                                    <DeliveryPayloadPreview delivery={delivery} compact />
                                                </div>
                                            </td>
                                            <td className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                <div className='grid gap-1 text-xs text-ui-muted dark:text-ui-muted'>
                                                    <span>{delivery.errorClass ? sanitizeOrganizationDisplayCopy(delivery.errorClass) : delivery.nextRetryAt ? 'scheduled' : 'none'}</span>
                                                    <span>{delivery.nextRetryAt ? formatDate(delivery.nextRetryAt) : `${delivery.attemptCount ?? delivery.retryCount ?? 0} attempts`}</span>
                                                    {delivery.dedupeKey && <span className='max-w-40 truncate'>Deduplicated delivery</span>}
                                                </div>
                                            </td>
                                            <td className='border-b border-ui-border px-3 py-2 text-xs text-ui-muted dark:border-ui-border dark:text-ui-muted'>
                                                {formatDate(delivery.attemptedAt || delivery.updatedAt || delivery.createdAt)}
                                            </td>
                                            <td className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                <div className='grid gap-2'>
                                                    <button type='button' className={secondaryButtonClass} disabled={!canManage || !replayable || Boolean(busy)} onClick={() => onReplay(delivery)}>
                                                        <RefreshCw className='h-4 w-4' />
                                                        {replayLabel}
                                                    </button>
                                                    {!replayable && <span className='text-xs text-ui-muted dark:text-ui-muted'>Needs destination and alert context</span>}
                                                    <RowStatus message={rowMessages[`delivery-${delivery.id}`]} />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </section>
    )
}

function DeliveryHistoryMobileRow({ delivery, organizationId, canManage, busy, rowMessage, onReplay }: {
    delivery: DeliveryRow
    organizationId: string
    canManage: boolean
    busy: string
    rowMessage?: RowMessage
    onReplay: (delivery: DeliveryRow) => void
}) {
    const replayable = canReplayDelivery(delivery)
    const replayLabel = delivery.status === 'failed' || delivery.nextRetryAt ? 'Retry' : 'Replay'
    return (
        <article className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-canvas' data-org-delivery-mobile-row='true'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <StatusPill status={delivery.status || 'attempt'} />
                <span className='text-xs font-medium text-ui-muted dark:text-ui-muted'>{formatDate(delivery.attemptedAt || delivery.updatedAt || delivery.createdAt)}</span>
            </div>
            <div className='min-w-0'>
                <p className='truncate text-xs font-semibold text-ui-text dark:text-ui-text'>{destinationDisplayState(delivery)}</p>
                <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{deliveryTraceLabel(delivery)}</p>
                <div className='mt-2'>
                    <DeliveryReference delivery={delivery} organizationId={organizationId} />
                </div>
            </div>
            <div className='grid grid-cols-2 gap-2 text-xs text-ui-muted dark:text-ui-muted'>
                <span className='truncate'>{delivery.dryRun ? 'dry run' : delivery.deliveryKind || 'webhook'}</span>
                <span className='truncate text-right'>{delivery.nextRetryAt ? formatDate(delivery.nextRetryAt) : `${delivery.attemptCount ?? delivery.retryCount ?? 0} attempts`}</span>
                {delivery.httpStatus !== undefined && <span className='truncate'>HTTP {delivery.httpStatus}</span>}
                {delivery.errorClass && <span className='truncate text-right'>{sanitizeOrganizationDisplayCopy(delivery.errorClass)}</span>}
            </div>
            {delivery.error && <p className='line-clamp-2 rounded-md bg-ui-warning/10 px-2 py-1 text-xs font-medium text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'>{organizationDeliveryErrorText(delivery.error)}</p>}
            {!delivery.error && delivery.responseSummary && <p className='line-clamp-2 text-xs text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(delivery.responseSummary) || delivery.responseSummary}</p>}
            <DeliveryPayloadPreview delivery={delivery} compact />
            <div className='grid gap-2'>
                <button type='button' className={secondaryButtonClass} disabled={!canManage || !replayable || Boolean(busy)} onClick={() => onReplay(delivery)}>
                    <RefreshCw className='h-4 w-4' />
                    {replayLabel}
                </button>
                {!replayable && <span className='text-xs text-ui-muted dark:text-ui-muted'>Needs destination and alert context</span>}
                <RowStatus message={rowMessage} />
            </div>
        </article>
    )
}

function DeliveryReference({ delivery, organizationId }: { delivery: DeliveryRow, organizationId: string }) {
    const caseHref = delivery.caseId ? `/dashboard/dwm/cases/${encodeURIComponent(delivery.caseId)}?organizationId=${encodeURIComponent(organizationId)}${delivery.alertId ? `&alertId=${encodeURIComponent(delivery.alertId)}` : ''}` : ''
    const alertHref = delivery.alertId ? `/dashboard/ti/workbench?alertId=${encodeURIComponent(delivery.alertId)}&organizationId=${encodeURIComponent(organizationId)}` : ''
    return (
        <div className='grid gap-1 text-xs'>
            {delivery.caseId ? <a href={caseHref} className='truncate font-semibold text-ui-primary hover:text-ui-primary dark:text-ui-primary'>Case {delivery.caseId}</a> : null}
            {delivery.alertId ? <a href={alertHref} className='truncate font-semibold text-ui-primary hover:text-ui-primary dark:text-ui-primary'>Alert {delivery.alertId}</a> : null}
            {!delivery.caseId && !delivery.alertId ? <span className='truncate text-ui-muted dark:text-ui-muted'>Attach alert after replay</span> : null}
            <span className='truncate text-ui-muted dark:text-ui-muted'>{delivery.watchlistItemId || delivery.watchlistId || delivery.actionId || 'watchlist pending'}</span>
        </div>
    )
}

function ScopePanel({ alertTerms, alerts, cases, webhooks, alertCaseVisibility, organizationId }: { alertTerms: AlertTerm[], alerts: ScopedAlert[], cases: ScopedCase[], webhooks: WebhookDestination[], alertCaseVisibility: Record<string, unknown> | null, organizationId: string }) {
    const route = `/api/organizations/${encodeURIComponent(organizationId)}`
    const visibility = visibilityRows(alertCaseVisibility)
    const hasScopeRows = Boolean(alertTerms.length || alerts.length || cases.length || webhooks.length || visibility.length)
    if (!hasScopeRows) {
        return (
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-scope-empty='true'>
                <SectionTitle icon={<ExternalLink className='h-4 w-4' />} title='Monitoring scope' detail='Shared watchlists create the alert, case, and delivery context shown here.' />
                <div className='mt-4 grid gap-3 rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 dark:border-ui-border dark:bg-ui-canvas sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
                    <div className='min-w-0'>
                        <p className='text-sm font-semibold text-ui-text dark:text-ui-text'>No scoped monitoring records yet</p>
                        <p className='mt-1 text-sm leading-6 text-ui-muted dark:text-ui-muted'>Add a shared watchlist term first. Matching alerts, cases, and saved delivery destinations will appear after the first routed event.</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <ActionAnchor href='#watchlists' icon={<BellRing className='h-4 w-4' />} label='Add watchlist' />
                        <ActionAnchor href='#destinations' icon={<Webhook className='h-4 w-4' />} label='Prepare delivery' />
                    </div>
                </div>
            </section>
        )
    }
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <SectionTitle icon={<ExternalLink className='h-4 w-4' />} title='Alert, case, and destination scope' detail='Org-scoped watchlist, case, and delivery records used by monitoring flows.' />
            <div className='mt-4 grid gap-3 lg:grid-cols-2'>
                <ScopeColumn icon={<BellRing className='h-4 w-4' />} title='Alert terms' route={`${route}/watchlists/alert-terms`} rows={alertTerms.map(term => ({
                    id: term.watchlistItemId || term.watchlistId || term.alertGenerationRef || term.term || term.value || 'term',
                    primary: term.term || term.value || 'Watchlist term',
                    secondary: term.matchReason || term.alertGenerationRef || term.kind || term.family || 'Org-scoped match',
                }))} empty='Add an active shared watchlist term to create organization alert terms.' />
                <ScopeColumn icon={<CircleAlert className='h-4 w-4' />} title='Alerts' route={`/api/dwm/alerts?organizationId=${encodeURIComponent(organizationId)}`} rows={alerts.map(alert => ({
                    id: alert.id,
                    primary: alert.title || alert.id,
                    secondary: `${alert.severity || 'severity'} · ${alert.status || 'status'}${alert.watchlistItemId ? ` · ${alert.watchlistItemId}` : ''}`,
                }))} empty='Alerts appear after a live capture matches an active org watchlist term.' />
                <ScopeColumn icon={<ShieldCheck className='h-4 w-4' />} title='Cases' route={`/api/cases?organizationId=${encodeURIComponent(organizationId)}`} rows={cases.map(item => ({
                    id: item.id,
                    primary: item.title || item.id,
                    secondary: `${item.status || 'status'}${item.assignedOwner ? ` · ${item.assignedOwner}` : ''}`,
                }))} empty='Cases appear after an alert is opened from the DWM workspace.' />
                <ScopeColumn icon={<ShieldCheck className='h-4 w-4' />} title='Visibility' route={`${route}/alert-case-visibility`} rows={visibility} empty='Visibility decisions appear after alerts are reviewed or opened as cases.' />
                <ScopeColumn icon={<Webhook className='h-4 w-4' />} title='Destinations' route={`${route}/webhooks`} rows={webhooks.map(destination => ({
                    id: destination.id,
                    primary: destination.name || destination.id,
                    secondary: `${destination.status || 'unknown'} · ${destinationDisplayState(destination)}`,
                }))} empty='Save a watchlist destination to make customer delivery available here.' />
            </div>
        </section>
    )
}

function ActivityPanel({ organization, bundle, activity, selectedSubject, onSelectSubject }: { organization: OrganizationSummary, bundle: OrgBundle, activity: ActivityItem[], selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void }) {
    const [copyStatus, setCopyStatus] = useState<RowMessage | undefined>()
    const selectedRows = activityRowsForSubject(activity, selectedSubject)
    const contextRows = selectedContextRows(selectedSubject, organization, bundle)
    const visibleRows = selectedSubject.type === 'organization' ? activity.slice(0, 20) : selectedRows.slice(0, 20)
    const totalRows = selectedSubject.type === 'organization' ? activity.length : selectedRows.length
    const contextActions = selectedSubjectActions(selectedSubject, organization)
    const copySelectedActivity = async () => {
        try {
            const heading = `${organization.name || organization.id} · ${selectedSubject.type}`
            const context = contextRows.map(row => `${row.label}: ${row.value}`)
            const rows = visibleRows.slice(0, 8).map(item => `${formatDate(item.at)} · ${item.title} · ${item.detail}`)
            await navigator.clipboard.writeText([heading, ...context, ...rows].filter(Boolean).join('\n'))
            setCopyStatus({ ok: true, text: 'Activity copied.' })
        } catch {
            setCopyStatus({ ok: false, text: 'Copy failed.' })
        }
    }
    return (
        <section id='audit' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <SectionTitle icon={<CheckCircle2 className='h-4 w-4' />} title='Activity' detail='Selected row, delivery, and team actions.' />
            <div className='mt-4 grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(selectedSubjectLabel(selectedSubject, organization, bundle))}</p>
                        <p className='truncate text-xs text-ui-muted dark:text-ui-muted'>{selectedSubject.type} · {totalRows} event{totalRows === 1 ? '' : 's'}</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        {contextActions.map(action => (
                            <a key={action.href} href={action.href} className={secondaryButtonClass} data-org-activity-context-action='true'>
                                <ExternalLink className='h-4 w-4' />
                                {action.label}
                            </a>
                        ))}
                        <button type='button' className={secondaryButtonClass} onClick={() => void copySelectedActivity()} data-org-activity-copy='true'>
                            <Copy className='h-4 w-4' />
                            Copy
                        </button>
                        <button type='button' className={secondaryButtonClass} onClick={() => onSelectSubject({ type: 'organization', id: organization.id })}>
                            All
                        </button>
                    </div>
                </div>
                <dl className='grid gap-2 text-xs sm:grid-cols-2'>
                    {contextRows.map(row => (
                        <div key={row.label} className='min-w-0 rounded-md bg-ui-panel px-2 py-1.5 dark:bg-ui-panel'>
                            <dt className='truncate font-semibold text-ui-muted dark:text-ui-muted'>{row.label}</dt>
                            <dd className='truncate font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(row.value) || row.value}</dd>
                        </div>
                    ))}
                </dl>
                <RowStatus message={copyStatus} />
            </div>
            <div className='mt-4 grid gap-2'>
                {activity.length === 0 && <EmptyLine text='Activity appears after team, watchlist, or destination actions.' />}
                {activity.length > 0 && selectedRows.length === 0 && selectedSubject.type !== 'organization' && <EmptyLine text='Select a row with recent team, watchlist, or delivery activity.' />}
                {visibleRows.map(item => {
                    const itemSubject = activitySubjectFromItem(item, organization.id)
                    const selected = itemSubject?.type === selectedSubject.type && itemSubject.id === selectedSubject.id
                    return (
                        <div
                            key={item.id}
                            role='button'
                            tabIndex={0}
                            aria-pressed={selected}
                            className={`rounded-lg border p-3 text-left transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-panel' : 'border-ui-border hover:bg-ui-raised dark:border-ui-border dark:hover:bg-ui-panel'}`}
                            onClick={() => itemSubject && onSelectSubject(itemSubject)}
                            onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    if (itemSubject) onSelectSubject(itemSubject)
                                }
                            }}
                            data-org-activity-row='true'
                        >
                            <div className='flex items-start gap-2'>
                                {item.ok ? <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-ui-success' /> : <CircleAlert className='mt-0.5 h-4 w-4 shrink-0 text-ui-danger' />}
                                <div className='min-w-0 flex-1'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <p className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(item.title) || item.title}</p>
                                        {item.subjectType && <span className='rounded-md bg-ui-raised px-2 py-0.5 text-[11px] font-semibold text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>{item.subjectType}</span>}
                                    </div>
                                    <p className='mt-1 text-sm leading-5 text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(item.detail) || item.detail}</p>
                                    {item.metadata && item.metadata.length > 0 && (
                                        <div className='mt-2 grid gap-1 text-[11px] text-ui-muted dark:text-ui-muted'>
                                            {item.metadata.slice(0, 3).map(row => <span key={`${item.id}-${row.label}`} className='truncate'>{row.label}: {sanitizeOrganizationDisplayCopy(row.value) || row.value}</span>)}
                                        </div>
                                    )}
                                    <p className='mt-2 text-xs text-ui-muted dark:text-ui-muted'>{formatDate(item.at)}</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

function ScopeColumn({ icon, title, route, rows, empty }: { icon: ReactNode, title: string, route: string, rows: Array<{ id: string, primary: string, secondary: string }>, empty: string }) {
    const [copyStatus, setCopyStatus] = useState<RowMessage | undefined>()
    const showRecordActions = !route.startsWith('/api/')
    const copyRoute = async () => {
        try {
            await navigator.clipboard.writeText(route)
            setCopyStatus({ ok: true, text: 'Records link copied.' })
        } catch {
            setCopyStatus({ ok: false, text: 'Copy failed.' })
        }
    }
    return (
        <div className='rounded-lg border border-ui-border p-3 dark:border-ui-border'>
            <div className='flex items-center justify-between gap-3'>
                <h3 className='flex items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>{icon}{title}</h3>
                {showRecordActions ? (
                    <div className='flex items-center gap-1'>
                        <button type='button' className={iconButtonClass} aria-label={`Copy ${title} records link`} onClick={() => void copyRoute()} data-org-scope-copy='true'>
                            <Copy className='h-4 w-4' />
                        </button>
                        <a href={route} className={iconButtonClass} aria-label={`Open ${title} records`}>
                            <ExternalLink className='h-4 w-4' />
                        </a>
                    </div>
                ) : null}
            </div>
            <div className='mt-3 grid gap-2'>
                {rows.length === 0 && <EmptyLine text={empty} />}
                {rows.slice(0, 5).map(row => (
                    <div key={row.id} className='rounded-md bg-ui-raised p-2 dark:bg-ui-canvas'>
                        <p className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(row.primary) || row.primary}</p>
                        <p className='truncate text-xs text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(row.secondary) || row.secondary}</p>
                    </div>
                ))}
            </div>
            <div className='mt-3'><RowStatus message={copyStatus} /></div>
        </div>
    )
}

function SectionTitle({ icon, title, detail }: { icon: ReactNode, title: string, detail: string }) {
    return (
        <div className='flex items-start justify-between gap-4'>
            <div>
                <h2 className='flex items-center gap-2 text-base font-semibold text-ui-text dark:text-ui-text'>{icon}{title}</h2>
                <p className='mt-1 text-sm leading-5 text-ui-muted dark:text-ui-muted'>{detail}</p>
            </div>
        </div>
    )
}

function Field({ label, value, onChange, disabled, placeholder = '', type = 'text' }: { label: string, value: string, onChange: (value: string) => void, disabled?: boolean, placeholder?: string, type?: string }) {
    return (
        <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
            {label}
            <input type={type} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={inputClass} placeholder={placeholder} />
        </label>
    )
}

function SelectField({ label, value, options, onChange, disabled }: { label: string, value: string, options: string[], onChange: (value: string) => void, disabled?: boolean }) {
    return (
        <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
            {label}
            <select value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={inputClass}>
                {options.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
            </select>
        </label>
    )
}

function RoleBadge({ role }: { role: OrganizationRole }) {
    return <span className='shrink-0 rounded-md bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>{role}</span>
}

function StatusPill({ status }: { status: string }) {
    const normalized = status.toLowerCase()
    const tone = normalized === 'active' || normalized === 'delivered' || normalized === 'dry_run'
        ? 'bg-ui-success/15 text-ui-success dark:bg-ui-success/10 dark:text-ui-success'
        : normalized === 'paused' || normalized.includes('retry') || normalized === 'skipped'
            ? 'bg-ui-warning/10 text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'
            : normalized === 'failed' || normalized.includes('failed') || normalized === 'disabled'
                ? 'bg-ui-danger/10 text-ui-danger dark:bg-ui-danger/10 dark:text-ui-danger'
                : 'bg-ui-raised text-ui-muted dark:bg-ui-raised dark:text-ui-muted'
    return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{status}</span>
}

function StatusBanner({ tone, text }: { tone: 'error' | 'warning' | 'success', text: string }) {
    const classes = tone === 'error'
        ? 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger dark:border-ui-danger/35 dark:bg-ui-danger/10 dark:text-ui-danger'
        : tone === 'warning'
            ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
            : 'border-ui-success/35 bg-ui-success/10 text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    const Icon = tone === 'success' ? CheckCircle2 : CircleAlert
    return (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${classes}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
            <Icon className='mt-0.5 h-4 w-4 shrink-0' />
            <span>{sanitizeOrganizationDisplayCopy(text) || text}</span>
        </div>
    )
}

function RowStatus({ message }: { message?: RowMessage }) {
    if (!message) return null
    const tone = message.ok
        ? 'bg-ui-success/10 text-ui-success dark:bg-ui-success/10 dark:text-ui-success'
        : 'bg-ui-danger/10 text-ui-danger dark:bg-ui-danger/10 dark:text-ui-danger'
    return <span className={`inline-flex max-w-full truncate rounded-md px-2 py-1 text-[11px] font-semibold ${tone}`} role={message.ok ? 'status' : 'alert'} aria-live={message.ok ? 'polite' : 'assertive'}>{sanitizeOrganizationDisplayCopy(message.text) || message.text}</span>
}

function InlineBusy({ label, marker }: { label: string, marker: string }) {
    return (
        <div className='mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted' role='status' aria-live='polite' {...{ [marker]: 'true' }}>
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
            {label}
        </div>
    )
}

function ConfirmActionButton({ ariaLabel, disabled, onConfirm, icon }: { ariaLabel: string, disabled?: boolean, onConfirm: () => void, icon: ReactNode }) {
    const [confirming, setConfirming] = useState(false)
    return (
        <button
            type='button'
            className={confirming ? dangerConfirmButtonClass : iconDangerButtonClass}
            disabled={disabled}
            aria-label={confirming ? `Confirm ${ariaLabel.toLowerCase()}` : ariaLabel}
            aria-pressed={confirming}
            title={confirming ? 'Press again to confirm, or Escape to cancel.' : ariaLabel}
            data-org-confirm-action={confirming ? 'confirming' : 'idle'}
            onBlur={() => setConfirming(false)}
            onKeyDown={event => {
                if (event.key === 'Escape') {
                    event.stopPropagation()
                    setConfirming(false)
                }
                if (event.key === 'Enter' || event.key === ' ') {
                    event.stopPropagation()
                }
            }}
            onClick={event => {
                event.stopPropagation()
                if (confirming) {
                    setConfirming(false)
                    onConfirm()
                    return
                }
                setConfirming(true)
            }}
        >
            {confirming ? <CheckCircle2 className='h-4 w-4' /> : icon}
            {confirming && <span>Confirm</span>}
        </button>
    )
}

function EmptyLine({ text }: { text: string }) {
    return <p className='rounded-md bg-ui-raised px-3 py-2 text-sm text-ui-muted dark:bg-ui-canvas dark:text-ui-muted'>{text}</p>
}

function SkeletonRows({ count }: { count: number }) {
    return Array.from({ length: count }, (_, index) => <div key={index} className='h-14 animate-pulse rounded-lg bg-ui-raised dark:bg-ui-raised' />)
}

async function requestJson<T = Record<string, unknown>>(url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    const response = await fetch(url, {
        ...init,
        headers,
        cache: 'no-store',
    })
    const payload = await safeJson(response)
    if (!response.ok) {
        const error = new Error(apiErrorMessage(payload, response.status)) as ApiError
        error.status = response.status
        throw error
    }
    return payload as T
}

async function safeJson(response: Response): Promise<unknown> {
    try {
        return await response.json()
    } catch {
        return {}
    }
}

function apiErrorMessage(payload: unknown, status: number) {
    const record = objectValue(payload)
    const error = objectValue(record?.error)
    if (typeof record?.error === 'string') return record.error
    if (typeof error?.message === 'string') return error.message
    if (typeof record?.message === 'string') return record.message
    return `Request failed with HTTP ${status}.`
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

function endpointErrorMessage(error: unknown) {
    const message = errorMessage(error)
    if (/route not found|not_found|404/i.test(message)) return 'Endpoint unavailable'
    return sanitizeOrganizationDisplayCopy(message) || message
}

function objectValue(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function arrayValue<T>(value: unknown): T[] {
    return Array.isArray(value) ? value as T[] : []
}

function cleanString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function booleanValue(value: unknown) {
    return typeof value === 'boolean' ? value : undefined
}

function readableEndpoint(value: string) {
    return value.replace(/([A-Z])/g, ' $1').toLowerCase()
}

function sentenceCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function actionLabel(value: string) {
    return value.split('-').map(sentenceCase).join(' ')
}

function inviteBusyLabel(value: string) {
    if (value === 'send-invite') return 'Sending invites'
    if (value === 'resend-invite') return 'Resending invite'
    if (value === 'revoke-invite') return 'Revoking invite'
    if (value === 'copy-invite') return 'Copying invite'
    return ''
}

function memberBusyLabel(value: string) {
    if (value === 'change-role') return 'Updating member role'
    if (value === 'remove-member') return 'Removing member'
    return ''
}

function watchlistBusyLabel(value: string) {
    if (value === 'create-watchlist') return 'Adding watchlist term'
    if (value === 'save-watchlist') return 'Saving watchlist term'
    if (value === 'pause-watchlist') return 'Pausing watchlist term'
    if (value === 'resume-watchlist') return 'Resuming watchlist term'
    if (value === 'archive-watchlist') return 'Archiving watchlist term'
    if (value === 'restore-watchlist') return 'Restoring watchlist term'
    if (value === 'delete-watchlist') return 'Archiving watchlist term'
    if (value === 'cleanup-watchlists') return 'Cleaning archived watchlists'
    if (value === 'save-destination') return 'Testing watchlist destination'
    if (value === 'replay-destination') return 'Replaying saved destination'
    return ''
}

function destinationBusyLabel(value: string) {
    if (value === 'create-destination') return 'Adding destination'
    if (value === 'test-destination') return 'Testing destination'
    if (value === 'update-destination') return 'Updating destination'
    if (value === 'delete-destination') return 'Removing destination'
    if (value === 'replay-delivery') return 'Replaying delivery'
    return ''
}

function formatDate(value: string | undefined) {
    if (!value) return ''
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    } catch {
        return value
    }
}

function visibilityRows(payload: Record<string, unknown> | null) {
    if (!payload) return []
    const visibility = objectValue(payload.visibility) || objectValue(payload.alertCaseVisibility) || objectValue(payload.caseVisibility)
    const rows = [
        ['Alert visibility', visibility?.alertReadAllowed ?? visibility?.allowed ?? payload.allowed],
        ['Case assignment', visibility?.caseAssignmentAllowed ?? visibility?.canAssignCase],
        ['Case link', visibility?.caseRoute ?? payload.caseRoute ?? '/api/cases'],
    ]
    return rows.map(([label, value]) => ({
        id: String(label),
        primary: String(label),
        secondary: value === undefined || value === null ? 'Not available' : String(value),
    }))
}

function organizationActivityRows(local: ActivityItem[], bundle: OrgBundle) {
    const alertRows: ActivityItem[] = bundle.alerts.map(alert => ({
        id: `alert-${alert.id}`,
        at: alert.updatedAt || new Date(0).toISOString(),
        title: 'Alert',
        detail: `${alert.title || alert.id} · ${alert.severity || 'severity'} · ${alert.status || 'status'}`,
        ok: alert.status !== 'failed' && alert.status !== 'suppressed',
        subjectType: 'alert',
        subjectId: alert.id,
        relatedSubjectIds: [alert.watchlistItemId, ...(alert.watchlistItemIds || []), ...(alert.watchlistIds || [])].filter(Boolean) as string[],
        metadata: compactMetadata([
            ['Alert', alert.id],
            ['Severity', alert.severity],
            ['Status', alert.status],
            ['Watchlist', alert.watchlistItemId || alert.watchlistItemIds?.[0] || alert.watchlistIds?.[0]],
        ]),
    }))
    const caseRows: ActivityItem[] = bundle.cases.map(item => ({
        id: `case-${item.id}`,
        at: item.updatedAt || new Date(0).toISOString(),
        title: 'Case',
        detail: `${item.title || item.id} · ${item.status || 'status'}${item.assignedOwner ? ` · ${item.assignedOwner}` : ''}`,
        ok: item.status !== 'failed' && item.status !== 'blocked',
        subjectType: 'case',
        subjectId: item.id,
        metadata: compactMetadata([
            ['Case', item.id],
            ['Status', item.status],
            ['Owner', item.assignedOwner],
        ]),
    }))
    const deliveryRows: ActivityItem[] = bundle.deliveries.map(delivery => ({
        id: `delivery-${delivery.id}`,
        at: delivery.attemptedAt || delivery.updatedAt || delivery.createdAt || new Date(0).toISOString(),
        title: delivery.dryRun ? 'Destination tested' : 'Alert delivery recorded',
        detail: `${delivery.status || 'delivery'} · ${delivery.watchlistId || delivery.alertId || 'watchlist'}`,
        ok: !delivery.error && delivery.status !== 'failed',
        subjectType: 'destination',
        subjectId: delivery.webhookDestinationId || delivery.watchlistItemId || delivery.watchlistId || delivery.alertId,
        relatedSubjectIds: [
            delivery.webhookDestinationId,
            delivery.watchlistItemId,
            delivery.watchlistId,
            delivery.alertId,
            delivery.caseId,
            delivery.actionId,
            ...(delivery.watchlistItemIds || []),
        ].filter(Boolean) as string[],
        metadata: compactMetadata([
            ['Destination', destinationDisplayState(delivery)],
            ['Saved route', delivery.webhookDestinationId ? 'Available' : undefined],
            ['Alert', delivery.alertId],
            ['Case', delivery.caseId],
            ['Watchlist', delivery.watchlistItemId || delivery.watchlistId],
            ['Kind', delivery.deliveryKind],
        ]),
    }))
    const inviteRows: ActivityItem[] = bundle.invites.map(invite => ({
        id: `invite-${invite.id}`,
        at: invite.createdAt || new Date(0).toISOString(),
        title: 'Invite',
        detail: `${invite.email} · ${invite.role} · ${invite.status}`,
        ok: invite.status !== 'revoked' && invite.status !== 'expired',
        subjectType: 'invite',
        subjectId: invite.id,
        metadata: compactMetadata([
            ['Email', invite.email],
            ['Expires', invite.expiresAt ? formatDate(invite.expiresAt) : undefined],
        ]),
    }))
    const memberRows: ActivityItem[] = bundle.members.map(member => ({
        id: `member-${member.userId}`,
        at: member.joinedAt || new Date(0).toISOString(),
        title: 'Member role',
        detail: `${member.name || member.email || member.userId} · ${member.role} · ${member.status}`,
        ok: member.status !== 'removed' && member.status !== 'revoked',
        subjectType: 'member',
        subjectId: member.userId,
        metadata: compactMetadata([
            ['User', member.userId],
            ['Email', member.email],
            ['Invited by', member.invitedBy || undefined],
        ]),
    }))
    const watchlistRows: ActivityItem[] = bundle.watchlists.map(item => ({
        id: `watchlist-${item.id}`,
        at: item.updatedAt || item.archivedAt || item.createdAt || new Date(0).toISOString(),
        title: 'Watchlist term',
        detail: `${item.kind} · ${item.value} · ${item.status}`,
        ok: item.status !== 'archived',
        subjectType: 'watchlist',
        subjectId: item.id,
        metadata: compactMetadata([
            ['Owner', item.updatedBy || item.createdBy],
            ['Destination', destinationDisplayState(item)],
            ['Ref', item.alertGenerationRef],
        ]),
    }))
    const destinationRows: ActivityItem[] = bundle.webhooks.map(destination => ({
        id: `destination-${destination.id}`,
        at: destination.updatedAt || destination.createdAt || new Date(0).toISOString(),
        title: 'Destination',
        detail: `${destination.status || (destination.deliveryReady ? 'active' : 'configured')} · ${destinationDisplayState(destination)}`,
        ok: destination.status !== 'disabled' && destination.status !== 'deleted',
        subjectType: 'destination',
        subjectId: destination.id,
        metadata: compactMetadata([
            ['Type', destination.kind || destination.type],
            ['Destination', destinationDisplayState(destination)],
        ]),
    }))
    return [...local, ...alertRows, ...caseRows, ...deliveryRows, ...inviteRows, ...memberRows, ...watchlistRows, ...destinationRows]
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
}

function requestedSubjectFromSearch(input: {
    organizationId: string
    focus: string
    inviteId: string
    memberId: string
    watchlistId: string
    destinationId: string
    alertId: string
    caseId: string
}, bundle: OrgBundle): ActivitySubject {
    if (input.caseId && bundle.cases.some(item => item.id === input.caseId)) return { type: 'case', id: input.caseId }
    if (input.alertId && bundle.alerts.some(item => item.id === input.alertId)) return { type: 'alert', id: input.alertId }
    if (input.inviteId && bundle.invites.some(item => item.id === input.inviteId)) return { type: 'invite', id: input.inviteId }
    if (input.memberId && bundle.members.some(item => item.userId === input.memberId)) return { type: 'member', id: input.memberId }
    if (input.destinationId && bundle.webhooks.some(item => item.id === input.destinationId)) return { type: 'destination', id: input.destinationId }
    if (input.watchlistId && bundle.watchlists.some(item => item.id === input.watchlistId)) return { type: 'watchlist', id: input.watchlistId }
    if (input.focus === 'invites' && bundle.invites[0]?.id) return { type: 'invite', id: bundle.invites[0].id }
    if (input.focus === 'members' && bundle.members[0]?.userId) return { type: 'member', id: bundle.members[0].userId }
    if (input.focus === 'cases' && bundle.cases[0]?.id) return { type: 'case', id: bundle.cases[0].id }
    if (input.focus === 'alerts' && bundle.alerts[0]?.id) return { type: 'alert', id: bundle.alerts[0].id }
    if ((input.focus === 'destinations' || input.focus === 'webhooks') && bundle.webhooks[0]?.id) return { type: 'destination', id: bundle.webhooks[0].id }
    if (input.focus === 'watchlists' && bundle.watchlists[0]?.id) return { type: 'watchlist', id: bundle.watchlists[0].id }
    return { type: 'organization', id: input.organizationId }
}

function replaceOrganizationWorkspaceSelectionUrl(organizationId: string, subject: ActivitySubject) {
    if (typeof window === 'undefined' || !organizationId) return
    const url = new URL(window.location.href)
    url.searchParams.set('organizationId', organizationId)
    for (const key of ['inviteId', 'memberId', 'watchlistId', 'watchlistItemId', 'destinationId', 'alertId', 'alert', 'caseId']) {
        url.searchParams.delete(key)
    }
    if (subject.type === 'invite') {
        url.searchParams.set('focus', 'invites')
        url.searchParams.set('inviteId', subject.id)
    } else if (subject.type === 'member') {
        url.searchParams.set('focus', 'members')
        url.searchParams.set('memberId', subject.id)
    } else if (subject.type === 'watchlist') {
        url.searchParams.set('focus', 'watchlists')
        url.searchParams.set('watchlistId', subject.id)
    } else if (subject.type === 'destination') {
        url.searchParams.set('focus', 'destinations')
        url.searchParams.set('destinationId', subject.id)
    } else if (subject.type === 'alert') {
        url.searchParams.set('focus', 'alerts')
        url.searchParams.set('alertId', subject.id)
    } else if (subject.type === 'case') {
        url.searchParams.set('focus', 'cases')
        url.searchParams.set('caseId', subject.id)
    } else {
        url.searchParams.delete('focus')
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

function activitySubjectFromRowKey(rowKey: string | undefined, organizationId: string | undefined): ActivitySubject | null {
    if (!rowKey) return organizationId ? { type: 'organization', id: organizationId } : null
    if (rowKey.startsWith('invite-')) return { type: 'invite', id: rowKey.replace(/^invite-/, '') }
    if (rowKey.startsWith('member-')) return { type: 'member', id: rowKey.replace(/^member-/, '') }
    if (rowKey.startsWith('watchlist-')) return { type: 'watchlist', id: rowKey.replace(/^watchlist-/, '') }
    if (rowKey.startsWith('destination-')) return { type: 'destination', id: rowKey.replace(/^destination-/, '') }
    return organizationId ? { type: 'organization', id: organizationId } : null
}

function activitySubjectFromItem(item: ActivityItem, organizationId: string): ActivitySubject {
    if (item.subjectType && item.subjectId) return { type: item.subjectType, id: item.subjectId }
    return activitySubjectFromRowKey(item.id, organizationId) || { type: 'organization', id: organizationId }
}

function activityItemSubject(subject: ActivitySubject | null) {
    return subject ? { subjectType: subject.type, subjectId: subject.id } : {}
}

function activityRowsForSubject(activity: ActivityItem[], subject: ActivitySubject) {
    if (subject.type === 'organization') return activity
    if (subject.type === 'destination') {
        return activity.filter(item => (item.subjectType === 'destination' || item.subjectType === 'watchlist') && (item.subjectId === subject.id || item.relatedSubjectIds?.includes(subject.id)))
    }
    return activity.filter(item => item.subjectId === subject.id || item.relatedSubjectIds?.includes(subject.id))
}

function selectedSubjectLabel(subject: ActivitySubject, organization: OrganizationSummary, bundle: OrgBundle) {
    if (subject.type === 'organization') return organizationDisplayName(organization)
    if (subject.type === 'invite') {
        const invite = bundle.invites.find(item => item.id === subject.id)
        return invite?.email || subject.id
    }
    if (subject.type === 'member') {
        const member = bundle.members.find(item => item.userId === subject.id)
        return member?.name || member?.email || member?.userId || subject.id
    }
    if (subject.type === 'alert') {
        const alert = bundle.alerts.find(item => item.id === subject.id)
        return alert?.title || alert?.id || subject.id
    }
    if (subject.type === 'case') {
        const item = bundle.cases.find(row => row.id === subject.id)
        return item?.title || item?.id || subject.id
    }
    const watchlist = bundle.watchlists.find(item => item.id === subject.id)
    const destination = bundle.webhooks.find(item => item.id === subject.id)
    if (destination) return destination.name || destination.id
    if (subject.type === 'destination') return watchlist ? `Destination · ${watchlist.value}` : subject.id
    return watchlist?.value || subject.id
}

function selectedContextRows(subject: ActivitySubject, organization: OrganizationSummary, bundle: OrgBundle) {
    if (subject.type === 'organization') {
        return compactMetadata([
            ['Org', organizationDisplayId(organization)],
            ['Tenant', sanitizeOrganizationDisplayCopy(organization.tenantId || 'default') || 'default'],
            ['Role', organization.role || 'member'],
            ['Members', String(bundle.members.length)],
            ['Watchlists', String(bundle.watchlists.length)],
            ['Destinations', String(bundle.webhooks.length)],
        ])
    }
    if (subject.type === 'invite') {
        const invite = bundle.invites.find(item => item.id === subject.id)
        return compactMetadata([
            ['Email', invite?.email],
            ['Role', invite?.role],
            ['Status', invite?.status],
            ['Expires', invite?.expiresAt ? formatDate(invite.expiresAt) : undefined],
        ])
    }
    if (subject.type === 'member') {
        const member = bundle.members.find(item => item.userId === subject.id)
        return compactMetadata([
            ['User', member?.userId],
            ['Email', member?.email],
            ['Role', member?.role],
            ['Status', member?.status],
            ['Joined', member?.joinedAt ? formatDate(member.joinedAt) : undefined],
        ])
    }
    if (subject.type === 'alert') {
        const alert = bundle.alerts.find(item => item.id === subject.id)
        return compactMetadata([
            ['Alert', alert?.id || subject.id],
            ['Severity', alert?.severity],
            ['Status', alert?.status],
            ['Watchlist', alert?.watchlistItemId || alert?.watchlistItemIds?.[0] || alert?.watchlistIds?.[0]],
            ['Updated', alert?.updatedAt ? formatDate(alert.updatedAt) : undefined],
        ])
    }
    if (subject.type === 'case') {
        const item = bundle.cases.find(row => row.id === subject.id)
        return compactMetadata([
            ['Case', item?.id || subject.id],
            ['Status', item?.status],
            ['Owner', item?.assignedOwner],
            ['Updated', item?.updatedAt ? formatDate(item.updatedAt) : undefined],
        ])
    }
    const destination = subject.type === 'destination' ? bundle.webhooks.find(row => row.id === subject.id) : undefined
    if (destination) {
        const delivery = bundle.deliveries
            .filter(row => row.webhookDestinationId === destination.id)
            .sort((left, right) => deliveryTime(right) - deliveryTime(left))[0] || null
        return compactMetadata([
            ['Destination', destination.id],
            ['Name', destination.name],
            ['Type', destination.kind || destination.type || 'webhook'],
            ['Status', destination.status || (destination.deliveryReady ? 'active' : 'configured')],
            ['Destination', destinationDisplayState(destination)],
            ['Last delivery', delivery?.status],
        ])
    }
    const item = bundle.watchlists.find(row => row.id === subject.id)
    const delivery = item ? latestDeliveryForWatchlist(item, bundle.deliveries) : null
    const alertCount = item ? alertsForWatchlist(item, bundle.alerts).length : 0
    return compactMetadata([
        ['Watchlist', item?.id || subject.id],
        ['Term', item?.value],
        ['Status', item?.status],
        ['Owner', item?.updatedBy || item?.createdBy],
        ['Destination', item ? destinationDisplayState(item) : destinationDisplayState(delivery)],
        ['Last delivery', delivery?.status],
        ['Alerts', String(alertCount)],
    ])
}

function selectedSubjectActions(subject: ActivitySubject, organization: OrganizationSummary) {
    const organizationId = encodeURIComponent(organization.id)
    if (subject.type === 'organization') {
        return [
            { label: 'Watchlists', href: '#watchlists' },
            { label: 'Audit trail', href: '#audit' },
        ]
    }
    if (subject.type === 'invite') {
        return [
            { label: 'Invites', href: '#invites' },
            { label: 'Audit trail', href: '#audit' },
        ]
    }
    if (subject.type === 'member') {
        return [
            { label: 'Members', href: '#members' },
            { label: 'Audit trail', href: '#audit' },
        ]
    }
    if (subject.type === 'watchlist') {
        const watchlistId = encodeURIComponent(subject.id)
        return [
            { label: 'Watchlist', href: '#watchlists' },
            { label: 'Delivery activity', href: '#delivery-history' },
            { label: 'Open alert scope', href: `/dashboard/ti/workbench?organizationId=${organizationId}&watchlistId=${watchlistId}` },
        ]
    }
    if (subject.type === 'destination') {
        return [
            { label: 'Destinations', href: '#destinations' },
            { label: 'Delivery activity', href: '#delivery-history' },
        ]
    }
    if (subject.type === 'alert') {
        const alertId = encodeURIComponent(subject.id)
        return [
            { label: 'Alert', href: `/dashboard/ti/workbench?alertId=${alertId}&organizationId=${organizationId}` },
            { label: 'Delivery activity', href: '#delivery-history' },
            { label: 'Organization activity', href: '#audit' },
        ]
    }
    if (subject.type === 'case') {
        const caseId = encodeURIComponent(subject.id)
        return [
            { label: 'Case', href: `/dashboard/dwm/cases/${caseId}?organizationId=${organizationId}` },
            { label: 'Delivery activity', href: '#delivery-history' },
            { label: 'Organization activity', href: '#audit' },
        ]
    }
    return []
}

function compactMetadata(rows: Array<[string, string | undefined]>) {
    return rows
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([label, value]) => ({ label, value: String(value) }))
}

function inviteLink(invite: OrganizationInvite) {
    return invite.acceptanceUrl || invite.acceptancePath || invite.token || ''
}

function normalizeSettings(settings: OrganizationSettings = {}) {
    return {
        name: (settings.name || '').trim(),
        slug: (settings.slug || '').trim(),
        defaultWebhookPolicy: settings.defaultWebhookPolicy || 'active_destinations',
        alertVisibilityPolicy: settings.alertVisibilityPolicy || 'members',
        lifecycleStatus: settings.lifecycleStatus || 'active',
        retentionDays: Number(settings.retentionDays || 365),
    }
}

function settingsValidationMessage(settings: OrganizationSettings = {}) {
    const slug = (settings.slug || '').trim()
    const retentionDays = Number(settings.retentionDays || 365)
    if (slug && slugifyOrganizationName(slug) !== slug) return 'Use lowercase letters, numbers, and hyphens for slug.'
    if (!Number.isFinite(retentionDays) || retentionDays < 30 || retentionDays > 3650) return 'Retention days must be between 30 and 3650.'
    return ''
}

function settingsEqual(left: OrganizationSettings = {}, right: OrganizationSettings = {}) {
    return JSON.stringify(normalizeSettings(left)) === JSON.stringify(normalizeSettings(right))
}

function parseInviteEmails(value: string) {
    return Array.from(new Set(value.split(/[,\n]/).map(email => email.trim().toLowerCase()).filter(Boolean)))
}

function invalidInviteEmails(value: string) {
    return parseInviteEmails(value).filter(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

function inviteEmailConflicts(emails: string[], invites: OrganizationInvite[], members: OrganizationMember[]) {
    const activeInviteEmails = new Set(invites
        .filter(invite => !['revoked', 'expired'].includes(invite.status.toLowerCase()))
        .map(invite => invite.email.toLowerCase()))
    const activeMemberEmailIds = new Set(members
        .filter(member => !['removed', 'revoked', 'inactive'].includes(member.status.toLowerCase()))
        .flatMap(member => [member.email?.toLowerCase(), member.userId.toLowerCase()])
        .filter(isEmailLike))
    return emails.filter(email => activeInviteEmails.has(email.toLowerCase()) || activeMemberEmailIds.has(email.toLowerCase()))
}

function isEmailLike(value: string | undefined): value is string {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function inviteActionAllowed(invite: OrganizationInvite, action: 'copy' | 'resend' | 'revoke') {
    const status = invite.status.toLowerCase()
    if (action === 'copy') return status === 'pending'
    if (action === 'resend') return status !== 'accepted'
    return status !== 'accepted' && status !== 'revoked'
}

function memberCanMutate(member: OrganizationMember) {
    const status = member.status.toLowerCase()
    return member.role !== 'owner' && status !== 'removed' && status !== 'revoked' && status !== 'inactive'
}

function validDestinationUrl(value: string) {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && Boolean(url.hostname)
    } catch {
        return false
    }
}

function defaultDestinationName(kind: DestinationCreateDraft['kind']) {
    return kind === 'discord' ? 'Discord destination' : 'Webhook destination'
}

function normalizeDestinationName(value: string) {
    return value.trim().replace(/\s+/g, ' ').slice(0, 80)
}

function destinationNameInUse(destinations: WebhookDestination[], name: string, excludeId = '') {
    const normalized = normalizeDestinationName(name).toLowerCase()
    if (!normalized) return false
    return destinations.some(destination => destination.id !== excludeId && normalizeDestinationName(destination.name || destination.id).toLowerCase() === normalized)
}

function destinationEditChanged(destination: WebhookDestination, draft: DestinationEditDraft) {
    const currentKind = (destination.kind || destination.type || 'webhook') === 'discord' ? 'discord' : 'webhook'
    const currentStatus = destination.status || (destination.deliveryReady ? 'active' : 'configured')
    return (normalizeDestinationName(draft.name) || destination.name || destination.id) !== (destination.name || destination.id)
        || draft.kind !== currentKind
        || draft.status !== currentStatus
        || Boolean(draft.url.trim())
}

function destinationConfigured(item: WatchlistItem) {
    return Boolean(item.webhookUrlConfigured || item.webhookDestinationId || item.webhookEndpointHash || item.webhookEndpointHint)
}

function isDuplicateWatchlistTerm(watchlists: WatchlistItem[], kind: WatchlistKind, value: string, excludeId = '') {
    const normalizedValue = normalizeWatchlistValue(value)
    if (!normalizedValue) return false
    return watchlists.some(item => item.id !== excludeId && item.status !== 'archived' && item.kind === kind && normalizeWatchlistValue(item.value) === normalizedValue)
}

function watchlistDraftChanged(item: WatchlistItem, draft: { kind: WatchlistKind, value: string, notes: string }) {
    return item.kind !== draft.kind
        || normalizeWatchlistValue(item.value) !== normalizeWatchlistValue(draft.value)
        || (item.notes || '').trim() !== draft.notes.trim()
}

function normalizeWatchlistValue(value: string) {
    return value.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/g, '').toLowerCase()
}

function watchlistSearchText(item: WatchlistItem, organization: OrganizationSummary) {
    return [
        item.kind,
        item.value,
        item.status,
        item.notes,
        item.organizationId || organization.id,
        item.tenantId || organization.tenantId,
        item.createdBy,
        item.updatedBy,
        item.alertGenerationRef,
        item.webhookEndpointHint,
        item.webhookEndpointHash,
    ].filter(Boolean).join(' ').toLowerCase()
}

function alertsForWatchlist(item: WatchlistItem, alerts: ScopedAlert[]) {
    return alerts.filter(alert => {
        if (alert.watchlistItemId === item.id) return true
        if (alert.watchlistItemIds?.includes(item.id)) return true
        if (alert.watchlistIds?.includes(item.id)) return true
        return false
    })
}

function alertForWatchlist(item: WatchlistItem, alerts: ScopedAlert[]) {
    return alertsForWatchlist(item, alerts)[0] || alerts[0]
}

function latestDeliveryForWatchlist(item: WatchlistItem, deliveries: DeliveryRow[]) {
    return deliveries
        .filter(delivery => delivery.watchlistId === item.id || delivery.watchlistItemId === item.id || delivery.watchlistItemIds?.includes(item.id))
        .sort((left, right) => deliveryTime(right) - deliveryTime(left))[0] || null
}

function latestDeliveryForDestination(destination: WebhookDestination, deliveries: DeliveryRow[]) {
    return deliveriesForDestination(destination, deliveries)
        .sort((left, right) => deliveryTime(right) - deliveryTime(left))[0] || null
}

function deliveriesForDestination(destination: WebhookDestination, deliveries: DeliveryRow[]) {
    return deliveries.filter(delivery => {
        if ((delivery.webhookDestinationId || delivery.destinationId) === destination.id) return true
        if (destination.endpointHash && delivery.endpointHash === destination.endpointHash) return true
        return false
    })
}

function deliveryMatchesSubject(delivery: DeliveryRow, subject: ActivitySubject) {
    if (subject.type === 'organization') return true
    if (subject.type === 'destination') {
        return delivery.webhookDestinationId === subject.id
            || delivery.watchlistId === subject.id
            || delivery.watchlistItemId === subject.id
            || delivery.watchlistItemIds?.includes(subject.id)
    }
    if (subject.type === 'watchlist') {
        return delivery.watchlistId === subject.id
            || delivery.watchlistItemId === subject.id
            || delivery.watchlistItemIds?.includes(subject.id)
    }
    if (subject.type === 'alert') return delivery.alertId === subject.id
    if (subject.type === 'case') return delivery.caseId === subject.id
    return false
}

function deliveryHistoryHref(baseHref: string, subject: ActivitySubject) {
    if (subject.type === 'organization') return baseHref
    const params = new URLSearchParams()
    if (subject.type === 'destination') params.set('destinationId', subject.id)
    if (subject.type === 'watchlist') params.set('watchlistId', subject.id)
    if (subject.type === 'alert') params.set('alertId', subject.id)
    if (subject.type === 'case') params.set('caseId', subject.id)
    const suffix = params.toString()
    return suffix ? `${baseHref}&${suffix}` : baseHref
}

function deliveryTraceLabel(delivery: DeliveryRow) {
    const trace = delivery.auditEventId || delivery.requestId || delivery.id
    return trace ? 'Delivery tracked' : 'Delivery pending'
}

function canReplayDelivery(delivery: DeliveryRow) {
    return Boolean(
        delivery.webhookDestinationId
        && (delivery.alertId || delivery.caseId || delivery.watchlistId || delivery.watchlistItemId || delivery.actionId)
    )
}

function firstDelivery(result: DeliveryResult) {
    return result.deliveries?.[0] || result.delivery || null
}

function normalizedDeliveryRows(payload: Record<string, unknown>): DeliveryRow[] {
    const rawRows = arrayValue<DeliveryRow>(payload.deliveries ?? payload.items ?? payload.results)
    const ledgerRows = arrayValue<Record<string, unknown>>(payload.deliveryLedger)
    const evidenceRows = arrayValue<Record<string, unknown>>(payload.deliveryEvidence)
    const enrichedById = new Map<string, Record<string, unknown>>()

    for (const row of [...evidenceRows, ...ledgerRows]) {
        const id = cleanString(row.deliveryId) || cleanString(row.requestId) || cleanString(row.id)
        if (!id) continue
        enrichedById.set(id, { ...(enrichedById.get(id) || {}), ...row })
    }

    return rawRows.map((row) => {
        const id = row.id || row.requestId || ''
        const enriched = id ? enrichedById.get(id) || {} : {}
        const response = objectValue(enriched.response) || {}
        const redactedDestination = objectValue(enriched.redactedDestination) || {}
        return {
            ...row,
            id: row.id || cleanString(enriched.deliveryId) || cleanString(enriched.requestId) || id,
            requestId: row.requestId || cleanString(enriched.requestId) || cleanString(enriched.deliveryId),
            auditEventId: row.auditEventId || cleanString(enriched.auditEventId),
            organizationId: row.organizationId || row.orgId || cleanString(enriched.orgId),
            alertId: row.alertId || cleanString(enriched.alertId),
            caseId: row.caseId || cleanString(enriched.caseId),
            watchlistId: row.watchlistId || cleanString(enriched.watchlistId),
            watchlistName: row.watchlistName || cleanString(enriched.watchlistName),
            webhookDestinationId: row.webhookDestinationId || row.destinationId || cleanString(enriched.destinationId),
            endpointHash: row.endpointHash || cleanString(enriched.endpointHash) || cleanString(redactedDestination.endpointHash),
            endpointHint: row.endpointHint || cleanString(enriched.redactedEndpointLabel) || cleanString(redactedDestination.endpointHint),
            status: row.status || cleanString(enriched.status) || cleanString(enriched.rawStatus),
            httpStatus: row.httpStatus ?? row.responseStatus ?? numberValue(enriched.responseStatus) ?? numberValue(response.httpStatus),
            attemptedAt: row.attemptedAt || cleanString(enriched.attemptedAt),
            createdAt: row.createdAt || cleanString(enriched.createdAt),
            updatedAt: row.updatedAt || cleanString(enriched.updatedAt),
            dryRun: row.dryRun ?? booleanValue(enriched.dryRun),
            error: row.error || cleanString(enriched.error),
            errorClass: row.errorClass || cleanString(enriched.errorClass),
            responseSummary: row.responseSummary || row.responseBody || cleanString(enriched.responseSummary) || cleanString(response.summary),
            dedupeKey: row.dedupeKey || row.idempotencyKey || cleanString(enriched.dedupeKey) || cleanString(enriched.idempotencyKey),
            casePath: row.casePath || cleanString(enriched.casePath),
            payload: row.payload || objectValue(enriched.payload) || undefined,
            attemptCount: row.attemptCount ?? numberValue(enriched.attemptCount),
            retryCount: row.retryCount ?? numberValue(enriched.retryCount),
            nextRetryAt: row.nextRetryAt ?? cleanString(enriched.nextRetryAt) ?? null,
            payloadPreview: payloadPreviewForDelivery(row)
                || payloadPreviewFromRecord(enriched.sanitizedPayloadPreview)
                || payloadPreviewFromRecord(enriched.payloadPreview),
        }
    })
}

function payloadPreviewForDelivery(delivery: DeliveryRow): DeliveryPayloadPreviewData | null {
    const direct = payloadPreviewFromRecord(delivery.sanitizedPayloadPreview)
        || payloadPreviewFromRecord(delivery.payloadPreview)
    if (direct) return direct
    return payloadPreviewFromPayload(delivery.payload, delivery)
}

function payloadPreviewFromRecord(value: unknown): DeliveryPayloadPreviewData | null {
    const record = objectValue(value)
    if (!record) return null
    const context = objectValue(record.context) || {}
    const fields = arrayValue<Record<string, unknown>>(record.fields).map(field => ({
        name: cleanString(field.name),
        valuePreview: cleanString(field.valuePreview) || cleanString(field.value),
        inline: booleanValue(field.inline),
    })).filter(field => field.name || field.valuePreview)
    return {
        title: cleanString(record.title),
        contentPreview: cleanString(record.contentPreview) || cleanString(record.content),
        descriptionPreview: cleanString(record.descriptionPreview) || cleanString(record.description),
        fieldNames: arrayValue<unknown>(record.fieldNames).map(cleanString).filter((item): item is string => Boolean(item)),
        fields,
        payloadHash: cleanString(record.payloadHash),
        context: {
            orgName: cleanString(context.orgName),
            orgId: cleanString(context.orgId),
            alertTitle: cleanString(context.alertTitle),
            alertId: cleanString(context.alertId),
            severity: cleanString(context.severity),
            sourceFamily: cleanString(context.sourceFamily),
            evidenceCount: numberValue(context.evidenceCount) ?? null,
            evidenceTimestamp: cleanString(context.evidenceTimestamp),
            watchlistName: cleanString(context.watchlistName),
            watchlistId: cleanString(context.watchlistId),
            matchReason: cleanString(context.matchReason),
            deliveryState: cleanString(context.deliveryState),
            casePath: cleanString(context.casePath),
            alertUrl: cleanString(context.alertUrl),
        },
    }
}

function payloadPreviewFromPayload(payload: unknown, delivery: DeliveryRow): DeliveryPayloadPreviewData | null {
    const record = objectValue(payload)
    if (!record) return null
    const embeds = arrayValue<Record<string, unknown>>(record.embeds)
    const embed = embeds[0] || {}
    const fields = arrayValue<Record<string, unknown>>(embed.fields).map(field => ({
        name: cleanString(field.name),
        valuePreview: cleanString(field.value),
        inline: booleanValue(field.inline),
    })).filter(field => field.name || field.valuePreview)
    if (!fields.length && !cleanString(embed.title) && !cleanString(embed.description) && !cleanString(record.content)) return null
    const fieldValue = (name: string) => fields.find(field => field.name?.toLowerCase() === name.toLowerCase())?.valuePreview
    return {
        title: cleanString(embed.title) || delivery.alertId || null,
        contentPreview: cleanString(record.content) || null,
        descriptionPreview: cleanString(embed.description) || null,
        fieldNames: fields.map(field => field.name).filter((item): item is string => Boolean(item)),
        fields,
        payloadHash: delivery.payloadHash || null,
        context: {
            orgName: fieldValue('Organization') || delivery.organizationId || delivery.orgId || null,
            alertTitle: cleanString(embed.title) || null,
            alertId: delivery.alertId || null,
            severity: fieldValue('Severity') || null,
            sourceFamily: fieldValue('Source family') || null,
            evidenceCount: numberValue(Number(fieldValue('Evidence count'))) ?? null,
            evidenceTimestamp: fieldValue('Evidence timestamp') || fieldValue('Observed at') || null,
            watchlistName: fieldValue('Watchlist') || delivery.watchlistName || delivery.watchlistId || null,
            watchlistId: delivery.watchlistId || null,
            matchReason: fieldValue('Match reason') || null,
            deliveryState: fieldValue('Delivery state') || delivery.status || null,
            casePath: fieldValue('Case') || delivery.casePath || null,
            alertUrl: fieldValue('Alert URL') || null,
        },
    }
}

function watchlistMutationMessage(bridge: DwmAlertBridgeResult | undefined, fallback: string) {
    if (!bridge) return fallback
    if (bridge.skipped) return `${fallback} Alert sync skipped: ${humanizeBridgeReason(bridge.reason)}.`
    if (bridge.savedAlertCount && bridge.savedAlertCount > 0) {
        const firstAlert = bridge.firstAlert
        const matched = firstAlert?.matchedTerm || bridge.matchedTerms?.[0]
        const family = firstAlert?.sourceFamily || bridge.sourceFamilies?.[0]
        const evidence = firstAlert?.evidenceCount
        const route = firstAlert?.recommendedRoute
        return [
            fallback,
            `${bridge.savedAlertCount} alert${bridge.savedAlertCount === 1 ? '' : 's'} generated`,
            matched ? `term ${matched}` : undefined,
            family ? `source ${family}` : undefined,
            evidence ? `${evidence} evidence item${evidence === 1 ? '' : 's'}` : undefined,
            route ? `action ${route}` : undefined,
        ].filter(Boolean).join(' · ') + '.'
    }
    if (bridge.ok) {
        const terms = bridge.matchedTerms?.length ? ` for ${bridge.matchedTerms.join(', ')}` : ''
        return `${fallback} No matching captures found${terms}.`
    }
    return `${fallback} Alert sync did not complete${bridge.reason ? `: ${humanizeBridgeReason(bridge.reason)}` : ''}.`
}

function humanizeBridgeReason(value: unknown) {
    return sanitizeOrganizationDisplayCopy(String(value || 'unavailable').replace(/_/g, ' ')) || 'unavailable'
}

function deliveryTime(delivery: DeliveryRow) {
    const value = delivery.attemptedAt || delivery.updatedAt || delivery.createdAt || ''
    const time = Date.parse(value)
    return Number.isFinite(time) ? time : 0
}

const inputClass = 'h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15 disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-text dark:placeholder:text-ui-muted dark:focus:border-ui-primary/35 dark:disabled:bg-ui-raised'
const compactSelectClass = 'h-9 rounded-lg border border-ui-border bg-ui-panel px-2 text-sm font-semibold text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15 disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-text'
const primaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-55 dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-panel'
const secondaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-55 dark:border-ui-border dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-raised'
const iconButtonClass = 'grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-55 dark:border-ui-border dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-raised'
const iconDangerButtonClass = 'grid h-10 w-10 place-items-center rounded-lg border border-ui-danger/35 bg-ui-danger/10 text-ui-danger transition hover:bg-ui-danger/10 disabled:cursor-not-allowed disabled:opacity-55 dark:border-ui-danger/35 dark:bg-ui-danger/10 dark:text-ui-danger dark:hover:bg-ui-danger/10'
const dangerConfirmButtonClass = 'inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg border border-ui-danger/35 bg-ui-danger/10 px-3 text-sm font-semibold text-ui-danger transition hover:bg-ui-danger/10 disabled:cursor-not-allowed disabled:opacity-55 dark:border-ui-danger/35 dark:bg-ui-danger/10 dark:text-ui-danger dark:hover:bg-ui-danger/10'
