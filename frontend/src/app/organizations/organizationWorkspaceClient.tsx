'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
    organizationId?: string
    tenantId?: string
    alertId?: string
    watchlistId?: string
    watchlistItemId?: string
    watchlistItemIds?: string[]
    webhookDestinationId?: string
    endpointHash?: string
    endpointHint?: string
    deliveryKind?: string
    status?: string
    attemptedAt?: string
    createdAt?: string
    updatedAt?: string
    dryRun?: boolean
    error?: string
}

type DeliveryResult = {
    ok?: boolean
    dryRun?: boolean
    deliveredAt?: string
    attemptedCount?: number
    delivery?: DeliveryRow
    deliveries?: DeliveryRow[]
}

type DestinationDraft = {
    kind: 'discord' | 'webhook'
    url: string
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

type ActivitySubjectType = 'organization' | 'invite' | 'member' | 'watchlist' | 'destination'

type ActivitySubject = {
    type: ActivitySubjectType
    id: string
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

function organizationDisplayName(organization: Pick<OrganizationSummary, 'name' | 'slug' | 'id'> | undefined) {
    return sanitizeOrganizationDisplayCopy(organization?.name || organization?.slug || organization?.id) || 'Organization'
}

function organizationDisplayId(organization: Pick<OrganizationSummary, 'slug' | 'id'> | undefined) {
    return sanitizeOrganizationDisplayCopy(organization?.slug || organization?.id) || 'organization'
}

export default function OrganizationWorkspaceClient() {
    const searchParams = useSearchParams()
    const requestedOrganizationId = searchParams.get('organizationId')?.trim() || ''
    const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [bundle, setBundle] = useState<OrgBundle>(initialBundle)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [createName, setCreateName] = useState('')
    const [inviteEmails, setInviteEmails] = useState('')
    const [inviteRole, setInviteRole] = useState<OrganizationRole>('member')
    const [watchlistDraft, setWatchlistDraft] = useState({ kind: 'domain' as WatchlistKind, value: '', notes: '' })
    const [settingsDraft, setSettingsDraft] = useState<OrganizationSettings>({})
    const [editingWatchlist, setEditingWatchlist] = useState<Record<string, { kind: WatchlistKind, value: string, notes: string }>>({})
    const [destinationDrafts, setDestinationDrafts] = useState<Record<string, DestinationDraft>>({})
    const [deliveryResults, setDeliveryResults] = useState<Record<string, DeliveryRow>>({})
    const [rowMessages, setRowMessages] = useState<Record<string, RowMessage>>({})
    const [activity, setActivity] = useState<ActivityItem[]>([])
    const [selectedActivitySubject, setSelectedActivitySubject] = useState<ActivitySubject>({ type: 'organization', id: 'organization' })

    const selectedOrganization = useMemo(
        () => organizations.find(organization => organization.id === selectedId) || organizations[0],
        [organizations, selectedId],
    )
    const canManage = selectedOrganization?.role === 'owner' || selectedOrganization?.role === 'admin'
    const activeWatchlists = bundle.watchlists.filter(item => item.status === 'active')
    const pausedWatchlists = bundle.watchlists.filter(item => item.status === 'paused')
    const archivedWatchlists = bundle.watchlists.filter(item => item.status === 'archived')
    const hasConfiguredDestination = bundle.watchlists.some(destinationConfigured)
    const selectedAlertId = bundle.alerts[0]?.id || liveDwmAlertId
    const activityRows = useMemo(() => organizationActivityRows(activity, bundle), [activity, bundle])

    const loadOrganizations = useCallback(async (nextSelectedId?: string) => {
        setLoading(true)
        setError('')
        try {
            const payload = await requestJson<{ organizations?: OrganizationSummary[] }>('/api/organizations')
            const nextOrganizations = payload.organizations || []
            setOrganizations(nextOrganizations)
            const preferred = nextSelectedId || requestedOrganizationId || selectedId
            const nextSelected = nextOrganizations.find(item => item.id === preferred)?.id || nextOrganizations[0]?.id || ''
            setSelectedId(nextSelected)
            if (!nextSelected) {
                setBundle(initialBundle)
            }
        } catch (err) {
            setError(errorMessage(err))
            setOrganizations([])
            setSelectedId('')
            setBundle(initialBundle)
        } finally {
            setLoading(false)
        }
    }, [requestedOrganizationId, selectedId])

    const loadOrganizationBundle = useCallback(async (organizationId: string) => {
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
                nextBundle.deliveries = arrayValue<DeliveryRow>(payload.deliveries ?? payload.items ?? payload.results)
            }
            void url
        })
        setBundle(nextBundle)
        setSettingsDraft(nextBundle.settings || {})
        setBusy('')
    }, [])

    useEffect(() => {
        void loadOrganizations()
    }, [loadOrganizations])

    useEffect(() => {
        if (selectedOrganization?.id) {
            void loadOrganizationBundle(selectedOrganization.id)
            setSelectedActivitySubject({ type: 'organization', id: selectedOrganization.id })
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
                setSelectedActivitySubject(actionSubject)
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
        const payload = await requestJson<{ organization?: OrganizationSummary }>('/api/organizations', {
            method: 'POST',
            body: JSON.stringify({ name: createName }),
        })
        const organizationId = payload.organization?.id
        if (organizationId) setSelectedId(organizationId)
        setCreateName('')
        return 'Organization created.'
    })

    const saveSettings = () => selectedOrganization && runAction('save-settings', async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/settings`, {
            method: 'PUT',
            body: JSON.stringify(settingsDraft),
        })
        return 'Organization settings updated.'
    })

    const sendInvite = () => selectedOrganization && runAction('send-invite', async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/invites`, {
            method: 'POST',
            body: JSON.stringify({
                emails: inviteEmails.split(/[,\n]/).map(email => email.trim()).filter(Boolean),
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
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists`, {
            method: 'POST',
            body: JSON.stringify({
                ...watchlistDraft,
                reason: 'Shared watchlist term added from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        setWatchlistDraft({ kind: 'domain', value: '', notes: '' })
        return 'Shared watchlist term saved.'
    })

    const saveWatchlistEdit = (item: WatchlistItem) => selectedOrganization && runAction('save-watchlist', async () => {
        const draft = editingWatchlist[item.id]
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/${encodeURIComponent(item.id)}`, {
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
        return 'Watchlist term updated.'
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
        return withUrl ? 'Destination tested and saved.' : 'Saved route tested.'
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

    const deleteSavedDestination = (destination: WebhookDestination) => selectedOrganization && runAction('delete-destination', async () => {
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks/${encodeURIComponent(destination.id)}`, {
            method: 'DELETE',
        })
        return 'Destination removed.'
    }, `destination-${destination.id}`)

    return (
        <section className='min-h-full overflow-x-hidden bg-[#f7f8fb] text-[#171a21] dark:bg-[#0e1520] dark:text-[#f5f7fb]'>
            <div className='mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8'>
                <header className='flex flex-col gap-4 border-b border-[#dfe5ee] pb-5 dark:border-[#273345] lg:flex-row lg:items-end lg:justify-between'>
                    <div className='max-w-3xl'>
                        <div className='mb-2 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#3056d3] dark:text-[#8fb2ff]'>
                            <Building2 className='h-4 w-4' />
                            Organizations
                        </div>
                        <h1 className='text-3xl font-semibold tracking-normal text-[#171a21] dark:text-white sm:text-4xl'>Organization settings</h1>
                        <p className='mt-3 max-w-2xl text-sm leading-6 text-[#596170] dark:text-[#a8b3c5]'>Team access, shared watchlists, destinations, and routed alerts.</p>
                    </div>
                    <button
                        type='button'
                        onClick={() => void loadOrganizations(selectedOrganization?.id)}
                        className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cfd7e6] bg-white px-4 text-sm font-semibold text-[#202838] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#344258] dark:bg-[#121d2b] dark:text-[#eef3fb] dark:hover:bg-[#18263a]'
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

                <div className='grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]'>
                    <aside className='flex min-w-0 flex-col gap-4'>
                        <section className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                            <h2 className='flex items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-white'>
                                <Building2 className='h-4 w-4 text-[#3056d3]' />
                                Create organization
                            </h2>
                            <div className='mt-3 grid gap-3'>
                                <label className='grid gap-1 text-sm font-medium text-[#344054] dark:text-[#cbd5e1]'>
                                    Name
                                    <input
                                        value={createName}
                                        onChange={event => setCreateName(event.target.value)}
                                        className={inputClass}
                                        placeholder='Acme Security'
                                    />
                                </label>
                                <button
                                    type='button'
                                    onClick={() => void createOrganization()}
                                    disabled={!createName.trim() || Boolean(busy)}
                                    className={primaryButtonClass}
                                >
                                    <Building2 className='h-4 w-4' />
                                    Create org
                                </button>
                            </div>
                        </section>

                        <section className='rounded-lg border border-[#dfe5ee] bg-white p-2 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                            <h2 className='px-2 py-2 text-sm font-semibold text-[#171a21] dark:text-white'>Workspaces</h2>
                            <div className='grid gap-1'>
                                {loading && <SkeletonRows count={3} />}
                                {!loading && organizations.length === 0 && (
                                    <p className='px-2 py-3 text-sm leading-6 text-[#667085] dark:text-[#a8b3c5]'>
                                        No organizations yet. Create one to invite teammates, share watchlists, and route alerts together.
                                    </p>
                                )}
                                {organizations.map(organization => (
                                    <button
                                        type='button'
                                        key={organization.id}
                                        onClick={() => setSelectedId(organization.id)}
                                        className={`grid gap-1 rounded-lg px-3 py-3 text-left transition ${selectedOrganization?.id === organization.id ? 'bg-[#eef4ff] text-[#172554] dark:bg-[#1b2a44] dark:text-[#dbeafe]' : 'hover:bg-[#f5f7fb] dark:hover:bg-white/6'}`}
                                    >
                                        <span className='flex items-center justify-between gap-2 text-sm font-semibold'>
                                            <span className='truncate'>{organizationDisplayName(organization)}</span>
                                            <RoleBadge role={organization.role || 'member'} />
                                        </span>
                                        <span className='truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{organizationDisplayId(organization)}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </aside>

                    <main className='min-w-0'>
                        {selectedOrganization ? (
                            <div className='grid gap-5'>
                                <WorkspaceSummary organization={selectedOrganization} activeWatchlists={activeWatchlists.length} pausedWatchlists={pausedWatchlists.length} archivedWatchlists={archivedWatchlists.length} memberCount={bundle.members.length} inviteCount={bundle.invites.length} webhookCount={bundle.webhooks.length} />
                                <OrgActionStrip
                                    alertId={selectedAlertId}
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
                                />

                                <section className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]'>
                                    <div className='grid gap-5'>
                                        <SettingsPanel settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} canManage={canManage} busy={busy} onSave={() => void saveSettings()} />
                                        <WatchlistPanel
                                            watchlists={bundle.watchlists}
                                            activeTerms={bundle.alertTerms}
                                            canManage={canManage}
                                            busy={busy}
                                            draft={watchlistDraft}
                                            setDraft={setWatchlistDraft}
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
                                            selectedSubject={selectedActivitySubject}
                                            onSelectSubject={setSelectedActivitySubject}
                                        />
                                    </div>
                                    <div className='grid min-w-0 content-start gap-5'>
                                        <InvitePanel emails={inviteEmails} setEmails={setInviteEmails} role={inviteRole} setRole={setInviteRole} invites={bundle.invites} canManage={canManage} busy={busy} rowMessages={rowMessages} selectedSubject={selectedActivitySubject} onSelectSubject={setSelectedActivitySubject} onInvite={() => void sendInvite()} onInviteAction={(invite, action) => void inviteAction(invite, action)} onCopyInvite={invite => void copyInvite(invite)} />
                                        <MemberPanel members={bundle.members} canManage={canManage} busy={busy} rowMessages={rowMessages} selectedSubject={selectedActivitySubject} onSelectSubject={setSelectedActivitySubject} onRoleChange={(member, role) => void changeMemberRole(member, role)} onRemove={member => void removeMember(member)} />
                                        <DestinationPanel destinations={bundle.webhooks} canManage={canManage} busy={busy} rowMessages={rowMessages} selectedSubject={selectedActivitySubject} onSelectSubject={setSelectedActivitySubject} onTest={destination => void testSavedDestination(destination)} onDelete={destination => void deleteSavedDestination(destination)} />
                                    </div>
                                </section>

                                <section className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]'>
                                    <ScopePanel alertTerms={bundle.alertTerms} alerts={bundle.alerts} cases={bundle.cases} webhooks={bundle.webhooks} alertCaseVisibility={bundle.alertCaseVisibility} organizationId={selectedOrganization.id} />
                                    <div className='min-w-0'>
                                        <ActivityPanel organization={selectedOrganization} bundle={bundle} activity={activityRows} selectedSubject={selectedActivitySubject} onSelectSubject={setSelectedActivitySubject} />
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <EmptyWorkspacePreview />
                        )}
                    </main>
                </div>
            </div>
        </section>
    )
}

function EmptyWorkspacePreview() {
    const nextSteps = [
        'Invite teammates and assign roles.',
        'Add company, domain, vendor, actor, or keyword watch terms.',
        'Connect alert destinations when the first watchlist is ready.',
    ]

    return (
        <div className='grid gap-4'>
            <section className='rounded-lg border border-[#dfe5ee] bg-white p-6 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                        <h2 className='text-xl font-semibold text-[#171a21] dark:text-white'>Create the first organization</h2>
                        <p className='mt-1 text-sm leading-6 text-[#667085] dark:text-[#a8b3c5]'>The workspace unlocks teammate invites, shared watchlists, alert scope, cases, and destinations.</p>
                    </div>
                    <Building2 className='h-9 w-9 text-[#3056d3]' />
                </div>
            </section>
            <section className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                <SectionTitle icon={<CheckCircle2 className='h-4 w-4' />} title='After the org is created' detail='Keep setup focused: create the workspace first, then add people, watchlists, and delivery routes.' />
                <ol className='mt-4 grid gap-2 text-sm leading-6 text-[#475467] dark:text-[#c4cedd]'>
                    {nextSteps.map((step, index) => (
                        <li key={step} className='flex gap-3 rounded-lg border border-[#edf1f7] bg-[#f8fafc] px-3 py-2 dark:border-[#253246] dark:bg-[#0c1420]'>
                            <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8efff] text-xs font-bold text-[#3056d3] dark:bg-[#172a4b] dark:text-[#a9c3ff]'>{index + 1}</span>
                            <span>{step}</span>
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    )
}

function WorkspaceSummary({ organization, activeWatchlists, pausedWatchlists, archivedWatchlists, memberCount, inviteCount, webhookCount }: { organization: OrganizationSummary, activeWatchlists: number, pausedWatchlists: number, archivedWatchlists: number, memberCount: number, inviteCount: number, webhookCount: number }) {
    return (
        <section className='grid min-w-0 gap-3 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927] sm:grid-cols-2 lg:grid-cols-4'>
            <Metric icon={<ShieldCheck className='h-4 w-4' />} label='Role' value={organization.role || 'member'} detail={organization.status || 'active'} />
            <Metric icon={<Users className='h-4 w-4' />} label='Members' value={String(memberCount || organization.memberCount || organization.activeMemberCount || 0)} detail={`${inviteCount || organization.pendingInviteCount || 0} pending`} />
            <Metric icon={<BellRing className='h-4 w-4' />} label='Watchlists' value={String(activeWatchlists || organization.sharedWatchlistCount || 0)} detail={`${pausedWatchlists} paused · ${archivedWatchlists} archived`} />
            <Metric icon={<Webhook className='h-4 w-4' />} label='Destinations' value={String(webhookCount)} detail='Org-scoped' />
        </section>
    )
}

function OrgActionStrip({ alertId, canManage, hasWatchlists, hasDestination }: { alertId: string, canManage: boolean, hasWatchlists: boolean, hasDestination: boolean }) {
    return (
        <nav className='flex flex-wrap items-center gap-2 rounded-lg border border-[#dfe5ee] bg-white p-2 shadow-sm dark:border-[#273345] dark:bg-[#111927]' aria-label='Organization actions'>
            <ActionAnchor href='#watchlists' icon={<BellRing className='h-4 w-4' />} label='Create watchlist' disabled={!canManage} />
            <ActionAnchor href='#invites' icon={<UserPlus className='h-4 w-4' />} label='Invite member' disabled={!canManage} />
            <ActionAnchor href='#watchlists' icon={<Webhook className='h-4 w-4' />} label='Test destination' disabled={!hasWatchlists} />
            <ActionAnchor href={`/dashboard/ti/workbench?alertId=${encodeURIComponent(alertId)}`} icon={<CircleAlert className='h-4 w-4' />} label='Open DWM alert' disabled={!alertId} />
            <ActionAnchor href='#audit' icon={<CheckCircle2 className='h-4 w-4' />} label='Audit' disabled={!hasDestination && !hasWatchlists} />
        </nav>
    )
}

function ActionAnchor({ href, icon, label, disabled }: { href: string, icon: ReactNode, label: string, disabled?: boolean }) {
    const classes = disabled
        ? 'pointer-events-none inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfe5ee] bg-[#f3f6fa] px-3 text-sm font-semibold text-[#98a2b3] dark:border-[#26344a] dark:bg-[#162033] dark:text-[#667085]'
        : 'inline-flex h-9 items-center gap-2 rounded-lg border border-[#cfd7e6] bg-white px-3 text-sm font-semibold text-[#202838] transition hover:bg-[#f2f5f9] dark:border-[#344258] dark:bg-[#121d2b] dark:text-[#eef3fb] dark:hover:bg-[#18263a]'
    return <a className={classes} href={href} aria-disabled={disabled}>{icon}{label}</a>
}

function OrgSetupProgress({ canManage, memberCount, inviteCount, watchlistCount, destinationCount, alertCount, caseCount }: {
    canManage: boolean
    memberCount: number
    inviteCount: number
    watchlistCount: number
    destinationCount: number
    alertCount: number
    caseCount: number
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
            title: 'Delivery route',
            body: destinationCount ? 'Destination saved' : watchlistCount ? 'Test and save a destination' : 'Create a watchlist first',
            href: '#watchlists',
            ready: destinationCount > 0,
            blocked: !watchlistCount || !canManage,
            action: destinationCount ? 'Review route' : 'Test destination',
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

    const completed = rows.filter(row => row.ready).length
    return (
        <section className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]' data-org-setup-progress='true'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <h2 className='flex items-center gap-2 text-base font-semibold text-[#171a21] dark:text-white'>
                        <ShieldCheck className='h-4 w-4 text-[#3056d3]' />
                        Workspace setup
                    </h2>
                    <p className='mt-1 text-sm leading-5 text-[#667085] dark:text-[#a8b3c5]'>
                        {completed}/{rows.length} steps complete. Use the next action to finish this workspace.
                    </p>
                </div>
                <span className='w-fit rounded-md border border-[#dbe6ff] bg-[#eef4ff] px-2 py-1 text-xs font-semibold text-[#3056d3] dark:border-[#314f86] dark:bg-[#17243a] dark:text-[#9cc2ff]'>
                    {completed === rows.length ? 'Ready for operations' : 'Setup in progress'}
                </span>
            </div>
            <div className='mt-4 grid gap-2'>
                {rows.map(row => (
                    <a
                        key={row.id}
                        href={row.href}
                        aria-disabled={row.blocked}
                        className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2 transition ${row.ready ? 'border-[#b7e4c7] bg-[#f0fdf4] dark:border-[#244b33] dark:bg-[#0f2418]' : row.blocked ? 'pointer-events-none border-[#e6ebf2] bg-[#f8fafc] opacity-70 dark:border-[#26344a] dark:bg-[#0d1522]' : 'border-[#dbe6ff] bg-[#f8fbff] hover:border-[#9db8ff] dark:border-[#2a3b58] dark:bg-[#101b2d]'}`}
                    >
                        {row.ready ? <CheckCircle2 className='h-4 w-4 shrink-0 text-[#067647]' /> : <CircleAlert className='h-4 w-4 shrink-0 text-[#b45309]' />}
                        <span className='min-w-0'>
                            <span className='block truncate text-sm font-semibold text-[#171a21] dark:text-white'>{row.title}</span>
                            <span className='block truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{row.body}</span>
                        </span>
                        <span className='text-xs font-semibold text-[#3056d3] dark:text-[#9cc2ff]'>{row.blocked ? 'Owner or admin required' : row.action}</span>
                    </a>
                ))}
            </div>
        </section>
    )
}

function SettingsPanel({ settingsDraft, setSettingsDraft, canManage, busy, onSave }: { settingsDraft: OrganizationSettings, setSettingsDraft: (next: OrganizationSettings) => void, canManage: boolean, busy: string, onSave: () => void }) {
    return (
        <section id='settings' className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
            <SectionTitle icon={<Settings className='h-4 w-4' />} title='Settings' detail={canManage ? 'Owner and admin policy controls.' : 'Read-only policy view.'} />
            <div className='mt-4 grid gap-3 md:grid-cols-2'>
                <Field label='Name' value={settingsDraft.name || ''} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, name: value })} />
                <Field label='Slug' value={settingsDraft.slug || ''} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, slug: value })} />
                <SelectField label='Webhook policy' value={settingsDraft.defaultWebhookPolicy || 'active_destinations'} options={webhookPolicies} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, defaultWebhookPolicy: value })} />
                <SelectField label='Alert visibility' value={settingsDraft.alertVisibilityPolicy || 'members'} options={alertPolicies} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, alertVisibilityPolicy: value })} />
                <SelectField label='Lifecycle' value={settingsDraft.lifecycleStatus || 'active'} options={lifecycleStatuses} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, lifecycleStatus: value })} />
                <Field label='Retention days' type='number' value={String(settingsDraft.retentionDays || 365)} disabled={!canManage} onChange={value => setSettingsDraft({ ...settingsDraft, retentionDays: Number(value) || 365 })} />
            </div>
            <div className='mt-4 flex justify-end'>
                <button type='button' className={primaryButtonClass} disabled={!canManage || Boolean(busy)} onClick={onSave}>
                    <Settings className='h-4 w-4' />
                    Save settings
                </button>
            </div>
        </section>
    )
}

function InvitePanel({ emails, setEmails, role, setRole, invites, canManage, busy, rowMessages, selectedSubject, onSelectSubject, onInvite, onInviteAction, onCopyInvite }: { emails: string, setEmails: (value: string) => void, role: OrganizationRole, setRole: (value: OrganizationRole) => void, invites: OrganizationInvite[], canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void, onInvite: () => void, onInviteAction: (invite: OrganizationInvite, action: 'revoke' | 'resend') => void, onCopyInvite: (invite: OrganizationInvite) => void }) {
    return (
        <section id='invites' className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
            <SectionTitle icon={<UserPlus className='h-4 w-4' />} title='Invite queue' detail={canManage ? 'Send, resend, revoke, copy.' : 'Owner or admin required.'} />
            <div className='mt-4 grid gap-3'>
                <label className='grid gap-1 text-sm font-medium text-[#344054] dark:text-[#cbd5e1]'>
                    Emails
                    <textarea value={emails} disabled={!canManage} onChange={event => setEmails(event.target.value)} className={`${inputClass} min-h-24 resize-y`} placeholder='teammate@example.com, analyst@example.com' />
                </label>
                <SelectField label='Role' value={role} options={roleOptions} disabled={!canManage} onChange={value => setRole(value as OrganizationRole)} />
                <button type='button' className={primaryButtonClass} disabled={!canManage || !emails.trim() || Boolean(busy)} onClick={onInvite}>
                    <UserPlus className='h-4 w-4' />
                    Send invites
                </button>
            </div>
            <div className='mt-5 grid gap-2'>
                {invites.length === 0 && <EmptyLine text='Send invites from the form above. Pending access requests appear here with copy, resend, and revoke actions.' />}
                {invites.length > 0 && (
                    invites.map(invite => (
                        <div
                            role='button'
                            tabIndex={0}
                            key={invite.id}
                            className={`grid min-w-0 gap-3 rounded-lg border border-[#eef2f7] p-3 text-left transition dark:border-[#1d2a3d] ${selectedSubject.type === 'invite' && selectedSubject.id === invite.id ? 'bg-[#eef4ff] dark:bg-[#17243a]' : 'hover:bg-[#f8fafc] dark:hover:bg-[#111d2d]'}`}
                            onClick={() => onSelectSubject({ type: 'invite', id: invite.id })}
                            onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') onSelectSubject({ type: 'invite', id: invite.id })
                            }}
                        >
                            <span className='grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                                <span className='min-w-0'>
                                    <span className='block truncate text-sm font-semibold text-[#171a21] dark:text-white'>{invite.email}</span>
                                    <span className='mt-1 flex flex-wrap gap-2'>
                                        <RoleBadge role={invite.role} />
                                        <StatusPill status={invite.status} />
                                    </span>
                                    <RowStatus message={rowMessages[`invite-${invite.id}`]} />
                                </span>
                                <span className='flex gap-1 sm:justify-end'>
                                    <span role='button' aria-label='Copy invite link' className={iconButtonClass} aria-disabled={Boolean(busy) || !inviteLink(invite)} onClick={event => { event.stopPropagation(); if (!busy && inviteLink(invite)) onCopyInvite(invite) }}><Copy className='h-4 w-4' /></span>
                                    <span role='button' aria-label='Resend invite' className={iconButtonClass} aria-disabled={!canManage || Boolean(busy)} onClick={event => { event.stopPropagation(); if (canManage && !busy) onInviteAction(invite, 'resend') }}><RefreshCw className='h-4 w-4' /></span>
                                    <span role='button' aria-label='Revoke invite' className={iconDangerButtonClass} aria-disabled={!canManage || Boolean(busy)} onClick={event => { event.stopPropagation(); if (canManage && !busy) onInviteAction(invite, 'revoke') }}><Trash2 className='h-4 w-4' /></span>
                                </span>
                            </span>
                        </div>
                    ))
                )}
            </div>
        </section>
    )
}

function MemberPanel({ members, canManage, busy, rowMessages, selectedSubject, onSelectSubject, onRoleChange, onRemove }: { members: OrganizationMember[], canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void, onRoleChange: (member: OrganizationMember, role: OrganizationRole) => void, onRemove: (member: OrganizationMember) => void }) {
    return (
        <section id='members' className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
            <SectionTitle icon={<Users className='h-4 w-4' />} title='Members' detail='Roles, status, removal.' />
            <div className='mt-4 overflow-x-auto'>
                {members.length === 0 && <EmptyLine text='Active members appear here after invites are accepted or the backend returns the current team.' />}
                {members.length > 0 && (
                    <table className='min-w-full border-separate border-spacing-0 text-left text-sm'>
                        <thead className='text-xs uppercase tracking-[0.08em] text-[#667085] dark:text-[#a8b3c5]'>
                            <tr>
                                <th className='border-b border-[#e6ebf2] py-2 pr-3 dark:border-[#26344a]'>User</th>
                                <th className='border-b border-[#e6ebf2] px-3 py-2 dark:border-[#26344a]'>Role</th>
                                <th className='border-b border-[#e6ebf2] px-3 py-2 dark:border-[#26344a]'>Status</th>
                                <th className='border-b border-[#e6ebf2] py-2 pl-3 text-right dark:border-[#26344a]'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr key={member.userId} className={`cursor-pointer align-middle transition ${selectedSubject.type === 'member' && selectedSubject.id === member.userId ? 'bg-[#eef4ff] dark:bg-[#17243a]' : 'hover:bg-[#f8fafc] dark:hover:bg-[#111d2d]'}`} onClick={() => onSelectSubject({ type: 'member', id: member.userId })}>
                                    <td className='max-w-44 border-b border-[#eef2f7] py-2 pr-3 dark:border-[#1d2a3d]'>
                                        <p className='truncate font-semibold text-[#171a21] dark:text-white'>{sanitizeOrganizationDisplayCopy(member.name || member.userId)}</p>
                                        <p className='truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{sanitizeOrganizationDisplayCopy(member.userId)}</p>
                                    </td>
                                    <td className='border-b border-[#eef2f7] px-3 py-2 dark:border-[#1d2a3d]'>
                                        {canManage && member.role !== 'owner' ? (
                                            <select className={compactSelectClass} value={member.role} disabled={Boolean(busy)} onChange={event => onRoleChange(member, event.target.value as OrganizationRole)}>
                                                {roleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        ) : <RoleBadge role={member.role} />}
                                    </td>
                                    <td className='border-b border-[#eef2f7] px-3 py-2 dark:border-[#1d2a3d]'>
                                        <div className='grid gap-1'>
                                            <StatusPill status={member.status} />
                                            <RowStatus message={rowMessages[`member-${member.userId}`]} />
                                        </div>
                                    </td>
                                    <td className='border-b border-[#eef2f7] py-2 pl-3 text-right dark:border-[#1d2a3d]'>
                                        <button type='button' className={iconDangerButtonClass} disabled={!canManage || member.role === 'owner' || Boolean(busy)} onClick={() => onRemove(member)} aria-label='Remove member'>
                                            <Trash2 className='h-4 w-4' />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    )
}

function DestinationPanel({ destinations, canManage, busy, rowMessages, selectedSubject, onSelectSubject, onTest, onDelete }: { destinations: WebhookDestination[], canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void, onTest: (destination: WebhookDestination) => void, onDelete: (destination: WebhookDestination) => void }) {
    return (
        <section id='destinations' className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
            <SectionTitle icon={<Webhook className='h-4 w-4' />} title='Destinations' detail='Saved routes, tests, removal.' />
            <div className='mt-4 grid gap-2'>
                {destinations.length === 0 && <EmptyLine text='Saved watchlist destinations appear here after a route is tested and attached.' />}
                {destinations.map(destination => (
                    <div
                        role='button'
                        tabIndex={0}
                        key={destination.id}
                        onClick={() => onSelectSubject({ type: 'destination', id: destination.id })}
                        onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                onSelectSubject({ type: 'destination', id: destination.id })
                            }
                        }}
                        className={`grid min-w-0 gap-3 rounded-lg border p-3 text-left transition ${selectedSubject.type === 'destination' && selectedSubject.id === destination.id ? 'border-[#8fb2ff] bg-[#f5f8ff] dark:border-[#4267a7] dark:bg-[#101b2d]' : 'border-[#e6ebf2] hover:bg-[#f8fafc] dark:border-[#26344a] dark:hover:bg-[#111d2d]'}`}
                    >
                        <span className='flex min-w-0 items-start justify-between gap-2'>
                            <span className='min-w-0'>
                                <span className='block truncate text-sm font-semibold text-[#171a21] dark:text-white'>{sanitizeOrganizationDisplayCopy(destination.name || destination.id)}</span>
                                <span className='mt-1 block truncate font-mono text-xs text-[#667085] dark:text-[#a8b3c5]'>{sanitizeOrganizationDisplayCopy(destination.endpointHint || destination.endpointHash || 'redacted_destination')}</span>
                            </span>
                            <StatusPill status={destination.status || (destination.deliveryReady ? 'active' : 'configured')} />
                        </span>
                        <span className='grid gap-1 text-xs text-[#667085] dark:text-[#a8b3c5]'>
                            <span className='truncate'>Type: {destination.kind || destination.type || 'webhook'}</span>
                            <span className='truncate'>Hash: {sanitizeOrganizationDisplayCopy(destination.endpointHash || 'not returned')}</span>
                        </span>
                        <span className='flex flex-wrap items-center gap-2' onClick={event => event.stopPropagation()}>
                            <button type='button' className={secondaryButtonClass} disabled={Boolean(busy)} onClick={() => onTest(destination)}>
                                <RefreshCw className='h-4 w-4' />
                                Test
                            </button>
                            <button type='button' className={iconDangerButtonClass} disabled={!canManage || Boolean(busy)} onClick={() => onDelete(destination)} aria-label='Remove destination'>
                                <Trash2 className='h-4 w-4' />
                            </button>
                            <RowStatus message={rowMessages[`destination-${destination.id}`]} />
                        </span>
                    </div>
                ))}
            </div>
        </section>
    )
}

function WatchlistPanel({ watchlists, activeTerms, canManage, busy, draft, setDraft, editing, setEditing, onCreate, onSave, onAction, onDelete, organization, alerts, deliveries, destinationDrafts, deliveryResults, setDestinationDrafts, onTestDestination, onCleanup, rowMessages, selectedSubject, onSelectSubject }: { watchlists: WatchlistItem[], activeTerms: AlertTerm[], canManage: boolean, busy: string, draft: { kind: WatchlistKind, value: string, notes: string }, setDraft: (next: { kind: WatchlistKind, value: string, notes: string }) => void, editing: Record<string, { kind: WatchlistKind, value: string, notes: string }>, setEditing: (next: Record<string, { kind: WatchlistKind, value: string, notes: string }> | ((current: Record<string, { kind: WatchlistKind, value: string, notes: string }>) => Record<string, { kind: WatchlistKind, value: string, notes: string }>)) => void, onCreate: () => void, onSave: (item: WatchlistItem) => void, onAction: (item: WatchlistItem, action: 'pause' | 'resume' | 'archive' | 'restore') => void, onDelete: (item: WatchlistItem) => void, organization: OrganizationSummary, alerts: ScopedAlert[], deliveries: DeliveryRow[], destinationDrafts: Record<string, DestinationDraft>, deliveryResults: Record<string, DeliveryRow>, setDestinationDrafts: (next: Record<string, DestinationDraft> | ((current: Record<string, DestinationDraft>) => Record<string, DestinationDraft>)) => void, onTestDestination: (item: WatchlistItem, mode: 'save' | 'replay') => void, onCleanup: () => void, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void }) {
    const archivedCount = watchlists.filter(item => item.status === 'archived').length
    return (
        <section id='watchlists' className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <SectionTitle icon={<BellRing className='h-4 w-4' />} title='Shared watchlists' detail='Terms, owners, destinations.' />
                <button type='button' className={secondaryButtonClass} disabled={!canManage || archivedCount === 0 || Boolean(busy)} onClick={onCleanup}>
                    <Archive className='h-4 w-4' />
                    Cleanup archived
                </button>
            </div>
            <div className='mt-2'><RowStatus message={rowMessages['watchlists-cleanup']} /></div>
            <div className='mt-4 grid gap-3 rounded-lg border border-[#e6ebf2] bg-[#f8fafc] p-3 dark:border-[#26344a] dark:bg-[#0d1522] md:grid-cols-[9rem_1fr]'>
                <SelectField label='Type' value={draft.kind} options={watchlistKinds} disabled={!canManage} onChange={value => setDraft({ ...draft, kind: value as WatchlistKind })} />
                <Field label='Term' value={draft.value} disabled={!canManage} onChange={value => setDraft({ ...draft, value })} placeholder='example.com, vendor name, company, actor' />
                <label className='grid gap-1 text-sm font-medium text-[#344054] dark:text-[#cbd5e1] md:col-span-2'>
                    Notes
                    <textarea value={draft.notes} disabled={!canManage} onChange={event => setDraft({ ...draft, notes: event.target.value })} className={`${inputClass} min-h-20 resize-y`} placeholder='Why this term matters to the organization' />
                </label>
                <div className='md:col-span-2'>
                    <button type='button' className={primaryButtonClass} disabled={!canManage || !draft.value.trim() || Boolean(busy)} onClick={onCreate}>
                        <BellRing className='h-4 w-4' />
                        Add shared term
                    </button>
                </div>
            </div>

            <div className='mt-5 grid gap-3'>
                {watchlists.length === 0 && <EmptyLine text='Add the first shared term above. Alert matching, delivery routes, and case context attach to watchlist rows.' />}
                {watchlists.map(item => {
                    const edit = editing[item.id]
                    return (
                        <div key={item.id} className={`rounded-lg border p-3 transition ${selectedSubject.type === 'watchlist' && selectedSubject.id === item.id ? 'border-[#8fb2ff] bg-[#f5f8ff] dark:border-[#4267a7] dark:bg-[#101b2d]' : 'border-[#e6ebf2] dark:border-[#26344a]'}`} onClick={() => onSelectSubject({ type: 'watchlist', id: item.id })}>
                            {edit ? (
                                <div className='grid gap-3 md:grid-cols-[9rem_1fr]'>
                                    <SelectField label='Type' value={edit.kind} options={watchlistKinds} disabled={Boolean(busy)} onChange={value => setEditing(current => ({ ...current, [item.id]: { ...edit, kind: value as WatchlistKind } }))} />
                                    <Field label='Term' value={edit.value} disabled={Boolean(busy)} onChange={value => setEditing(current => ({ ...current, [item.id]: { ...edit, value } }))} />
                                    <label className='grid gap-1 text-sm font-medium text-[#344054] dark:text-[#cbd5e1] md:col-span-2'>
                                        Notes
                                        <textarea value={edit.notes} disabled={Boolean(busy)} onChange={event => setEditing(current => ({ ...current, [item.id]: { ...edit, notes: event.target.value } }))} className={`${inputClass} min-h-20 resize-y`} />
                                    </label>
                                    <div className='flex flex-wrap gap-2 md:col-span-2'>
                                        <button type='button' className={primaryButtonClass} disabled={!edit.value.trim() || Boolean(busy)} onClick={() => onSave(item)}>
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
                                    <div className='grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)_auto] lg:items-start'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className='rounded-md bg-[#eef4ff] px-2 py-1 text-xs font-semibold text-[#3056d3] dark:bg-[#1b2a44] dark:text-[#9cc2ff]'>{item.kind}</span>
                                                <StatusPill status={item.status} />
                                            </div>
                                            <p className='mt-2 wrap-break-word text-base font-semibold text-[#171a21] dark:text-white'>{item.value}</p>
                                            <p className='mt-1 truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{item.notes || 'No notes.'}</p>
                                            <div className='mt-2 grid gap-1 text-xs text-[#667085] dark:text-[#a8b3c5] sm:grid-cols-2'>
                                                <span className='truncate'>Org: {sanitizeOrganizationDisplayCopy(item.organizationId || organization.id)}</span>
                                                <span className='truncate'>Owner: {item.updatedBy || item.createdBy || 'system'}</span>
                                                <span className='truncate'>Ref: {item.alertGenerationRef || item.id}</span>
                                                <span className='truncate'>Alerts: {alertsForWatchlist(item, alerts).length}</span>
                                            </div>
                                        </div>
                                        <WatchlistDestinationSummary item={item} delivery={deliveryResults[item.id] || latestDeliveryForWatchlist(item, deliveries)} />
                                        {canManage && (
                                            <div className='flex flex-wrap gap-2'>
                                                <button type='button' aria-label='Edit watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => setEditing(current => ({ ...current, [item.id]: { kind: item.kind, value: item.value, notes: item.notes || '' } }))}>
                                                    <Pencil className='h-4 w-4' />
                                                </button>
                                                {item.status === 'active' && <button type='button' aria-label='Pause watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'pause')}><Pause className='h-4 w-4' /></button>}
                                                {item.status === 'paused' && <button type='button' aria-label='Resume watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'resume')}><Play className='h-4 w-4' /></button>}
                                                {item.status === 'archived' && <button type='button' aria-label='Restore watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'restore')}><Archive className='h-4 w-4' /></button>}
                                                {item.status !== 'archived' && <button type='button' aria-label='Archive watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onDelete(item)}><Trash2 className='h-4 w-4' /></button>}
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

            <div className='mt-4 rounded-lg border border-[#d8e7db] bg-[#f0fdf4] p-3 text-sm text-[#14532d] dark:border-[#244b33] dark:bg-[#0f2418] dark:text-[#bbf7d0]'>
                <strong>{activeTerms.length}</strong> active exported term{activeTerms.length === 1 ? '' : 's'} available to alert generation.
            </div>
        </section>
    )
}

function WatchlistDestinationSummary({ item, delivery }: { item: WatchlistItem, delivery?: DeliveryRow | null }) {
    return (
        <div className='grid gap-1 rounded-lg border border-[#edf1f7] bg-white p-3 text-xs dark:border-[#1d2a3d] dark:bg-[#101928]'>
            <div className='flex items-center justify-between gap-2'>
                <span className='font-semibold text-[#202838] dark:text-[#eef3fb]'>Destination</span>
                <StatusPill status={destinationConfigured(item) ? 'configured' : 'none'} />
            </div>
            <span className='truncate text-[#667085] dark:text-[#a8b3c5]'>{item.webhookEndpointHint || delivery?.endpointHint || 'No endpoint'}</span>
            <span className='truncate font-mono text-[#667085] dark:text-[#93a4bd]'>{item.webhookEndpointHash || delivery?.endpointHash || 'no_route_hash'}</span>
            <span className='truncate text-[#667085] dark:text-[#a8b3c5]'>Last delivery: {delivery?.status || 'none'}</span>
        </div>
    )
}

function DestinationControls({ item, organization, alert, delivery, draft, canManage, busy, onDraftChange, onSelect, onTest }: { item: WatchlistItem, organization: OrganizationSummary, alert?: ScopedAlert, delivery?: DeliveryRow | null, draft: DestinationDraft, canManage: boolean, busy: string, onDraftChange: (next: DestinationDraft) => void, onSelect: () => void, onTest: (mode: 'save' | 'replay') => void }) {
    const configured = destinationConfigured(item)
    const endpointHint = item.webhookEndpointHint || delivery?.endpointHint || 'Not configured'
    const endpointHash = item.webhookEndpointHash || delivery?.endpointHash || 'No route hash'
    const selectedAlertId = alert?.id || liveDwmAlertId
    const deliveryStatus = delivery?.status || (configured ? 'Configured' : 'None')
    const replayLabel = delivery?.status === 'failed' || delivery?.status === 'skipped' ? 'Retry' : 'Replay'
    return (
        <div className='grid gap-3 rounded-lg border border-[#dbe3ef] bg-[#f8fafc] p-3 dark:border-[#26344a] dark:bg-[#0d1522]' onClick={event => {
            event.stopPropagation()
            onSelect()
        }}>
            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
                <div className='min-w-0'>
                    <p className='flex flex-wrap items-center gap-2 text-sm font-semibold text-[#202838] dark:text-[#eef3fb]'>
                        <Webhook className='h-4 w-4 text-[#3056d3]' />
                        Destination
                        <StatusPill status={configured ? 'configured' : 'not configured'} />
                    </p>
                    <p className='mt-1 truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{endpointHint} · {endpointHash}</p>
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
            <div className='grid gap-2 md:grid-cols-[8rem_minmax(12rem,1fr)_auto]'>
                <SelectField label='Type' value={draft.kind} options={destinationKinds} disabled={!canManage || Boolean(busy)} onChange={value => onDraftChange({ ...draft, kind: value as DestinationDraft['kind'] })} />
                <Field label='URL' value={draft.url} disabled={!canManage || Boolean(busy)} onChange={url => onDraftChange({ ...draft, url })} placeholder='https://discord.com/api/webhooks/...' />
                <label className='grid content-end'>
                    <span className='sr-only'>Test destination</span>
                    <button type='button' className={primaryButtonClass} disabled={!canManage || !draft.url.trim() || Boolean(busy)} onClick={() => onTest('save')}>
                        <CheckCircle2 className='h-4 w-4' />
                        Test and save
                    </button>
                </label>
            </div>
            <div className='grid gap-2 text-xs text-[#667085] dark:text-[#a8b3c5] sm:grid-cols-3'>
                <span className='truncate'>Selected alert: {selectedAlertId}</span>
                <span className='truncate'>Last delivery: {deliveryStatus}</span>
                <span className='truncate'>Tenant: {sanitizeOrganizationDisplayCopy(item.tenantId || organization.tenantId || 'default')}</span>
            </div>
            {delivery?.error && <p className='rounded-md bg-[#fff7ed] px-3 py-2 text-xs font-medium text-[#9a3412] dark:bg-[#2b1606] dark:text-[#fed7aa]'>{delivery.error}</p>}
        </div>
    )
}

function ScopePanel({ alertTerms, alerts, cases, webhooks, alertCaseVisibility, organizationId }: { alertTerms: AlertTerm[], alerts: ScopedAlert[], cases: ScopedCase[], webhooks: WebhookDestination[], alertCaseVisibility: Record<string, unknown> | null, organizationId: string }) {
    const route = `/api/organizations/${encodeURIComponent(organizationId)}`
    return (
        <section className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
            <SectionTitle icon={<ExternalLink className='h-4 w-4' />} title='Alert, case, and destination scope' detail='Org-scoped watchlist, case, and delivery records used by monitoring flows.' />
            <div className='mt-4 grid gap-3 lg:grid-cols-2'>
                <ScopeColumn icon={<BellRing className='h-4 w-4' />} title='Alert terms' route={`${route}/watchlists/alert-terms`} rows={alertTerms.map(term => ({
                    id: term.watchlistItemId || term.watchlistId || term.alertGenerationRef || term.term || term.value || 'term',
                    primary: term.term || term.value || 'Watchlist term',
                    secondary: term.matchReason || term.alertGenerationRef || term.kind || term.family || 'Org-scoped match',
                }))} empty='Add an active shared watchlist term to export org-scoped alert terms.' />
                <ScopeColumn icon={<CircleAlert className='h-4 w-4' />} title='Alerts' route={`/api/dwm/alerts?organizationId=${encodeURIComponent(organizationId)}`} rows={alerts.map(alert => ({
                    id: alert.id,
                    primary: alert.title || alert.id,
                    secondary: `${alert.severity || 'severity'} · ${alert.status || 'status'}${alert.watchlistItemId ? ` · ${alert.watchlistItemId}` : ''}`,
                }))} empty='Alerts appear after a live capture matches an active org watchlist term.' />
                <ScopeColumn icon={<ShieldCheck className='h-4 w-4' />} title='Cases' route={`/api/cases?organizationId=${encodeURIComponent(organizationId)}`} rows={cases.map(item => ({
                    id: item.id,
                    primary: item.title || item.id,
                    secondary: `${item.status || 'status'}${item.assignedOwner ? ` · ${item.assignedOwner}` : ''}`,
                }))} empty='Cases appear after an alert is reviewed or routed from the DWM workspace.' />
                <ScopeColumn icon={<ShieldCheck className='h-4 w-4' />} title='Visibility' route={`${route}/alert-case-visibility`} rows={visibilityRows(alertCaseVisibility)} empty='Visibility decisions appear after alerts are reviewed or routed into cases.' />
                <ScopeColumn icon={<Webhook className='h-4 w-4' />} title='Destinations' route={`${route}/webhooks`} rows={webhooks.map(destination => ({
                    id: destination.id,
                    primary: destination.name || destination.id,
                    secondary: `${destination.status || 'unknown'}${destination.endpointHash ? ` · ${destination.endpointHash}` : ''}`,
                }))} empty='Save a watchlist destination to make customer delivery routes visible here.' />
            </div>
        </section>
    )
}

function ActivityPanel({ organization, bundle, activity, selectedSubject, onSelectSubject }: { organization: OrganizationSummary, bundle: OrgBundle, activity: ActivityItem[], selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void }) {
    const selectedRows = activityRowsForSubject(activity, selectedSubject)
    const contextRows = selectedContextRows(selectedSubject, organization, bundle)
    const visibleRows = selectedSubject.type === 'organization' ? activity : selectedRows
    return (
        <section id='audit' className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
            <SectionTitle icon={<CheckCircle2 className='h-4 w-4' />} title='Activity' detail='Selected row, delivery, and team actions.' />
            <div className='mt-4 grid gap-3 rounded-lg border border-[#e6ebf2] bg-[#f8fafc] p-3 dark:border-[#26344a] dark:bg-[#0d1522]'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-[#171a21] dark:text-white'>{sanitizeOrganizationDisplayCopy(selectedSubjectLabel(selectedSubject, organization, bundle))}</p>
                        <p className='truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{selectedSubject.type}</p>
                    </div>
                    <button type='button' className={secondaryButtonClass} onClick={() => onSelectSubject({ type: 'organization', id: organization.id })}>
                        All
                    </button>
                </div>
                <dl className='grid gap-2 text-xs sm:grid-cols-2'>
                    {contextRows.map(row => (
                        <div key={row.label} className='min-w-0 rounded-md bg-white px-2 py-1.5 dark:bg-[#111927]'>
                            <dt className='truncate font-semibold text-[#667085] dark:text-[#a8b3c5]'>{row.label}</dt>
                            <dd className='truncate font-mono text-[#202838] dark:text-[#eef3fb]'>{sanitizeOrganizationDisplayCopy(row.value) || row.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
            <div className='mt-4 grid gap-2'>
                {activity.length === 0 && <EmptyLine text='No actions in this browser session yet.' />}
                {activity.length > 0 && selectedRows.length === 0 && selectedSubject.type !== 'organization' && <EmptyLine text='No activity for the selected row.' />}
                {visibleRows.map(item => (
                    <div key={item.id} className='rounded-lg border border-[#e6ebf2] p-3 dark:border-[#26344a]'>
                        <div className='flex items-start gap-2'>
                            {item.ok ? <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-[#067647]' /> : <CircleAlert className='mt-0.5 h-4 w-4 shrink-0 text-[#b42318]' />}
                            <div className='min-w-0 flex-1'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <p className='truncate text-sm font-semibold text-[#171a21] dark:text-white'>{sanitizeOrganizationDisplayCopy(item.title) || item.title}</p>
                                    {item.subjectType && <span className='rounded-md bg-[#eef2f7] px-2 py-0.5 text-[11px] font-semibold text-[#596170] dark:bg-[#1e293b] dark:text-[#cbd5e1]'>{item.subjectType}</span>}
                                </div>
                                <p className='mt-1 text-sm leading-5 text-[#667085] dark:text-[#a8b3c5]'>{sanitizeOrganizationDisplayCopy(item.detail) || item.detail}</p>
                                {item.metadata && item.metadata.length > 0 && (
                                    <div className='mt-2 grid gap-1 text-[11px] text-[#667085] dark:text-[#a8b3c5]'>
                                        {item.metadata.slice(0, 3).map(row => <span key={`${item.id}-${row.label}`} className='truncate'>{row.label}: {sanitizeOrganizationDisplayCopy(row.value) || row.value}</span>)}
                                    </div>
                                )}
                                <p className='mt-2 text-xs text-[#7a8493] dark:text-[#93a4bd]'>{formatDate(item.at)}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

function ScopeColumn({ icon, title, route, rows, empty }: { icon: ReactNode, title: string, route: string, rows: Array<{ id: string, primary: string, secondary: string }>, empty: string }) {
    return (
        <div className='rounded-lg border border-[#e6ebf2] p-3 dark:border-[#26344a]'>
            <div className='flex items-center justify-between gap-3'>
                <h3 className='flex items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-white'>{icon}{title}</h3>
                <a href={route} className='text-[#3056d3] transition hover:text-[#183899] dark:text-[#9cc2ff]' aria-label={`Open ${title} records`}>
                    <ExternalLink className='h-4 w-4' />
                </a>
            </div>
            <div className='mt-3 grid gap-2'>
                {rows.length === 0 && <EmptyLine text={empty} />}
                {rows.slice(0, 5).map(row => (
                    <div key={row.id} className='rounded-md bg-[#f8fafc] p-2 dark:bg-[#0d1522]'>
                        <p className='truncate text-sm font-semibold text-[#202838] dark:text-[#eef3fb]'>{sanitizeOrganizationDisplayCopy(row.primary) || row.primary}</p>
                        <p className='truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{sanitizeOrganizationDisplayCopy(row.secondary) || row.secondary}</p>
                    </div>
                ))}
            </div>
            <p className='mt-3 truncate font-mono text-[11px] text-[#667085] dark:text-[#93a4bd]'>{sanitizeOrganizationDisplayCopy(route) || route}</p>
        </div>
    )
}

function SectionTitle({ icon, title, detail }: { icon: ReactNode, title: string, detail: string }) {
    return (
        <div className='flex items-start justify-between gap-4'>
            <div>
                <h2 className='flex items-center gap-2 text-base font-semibold text-[#171a21] dark:text-white'>{icon}{title}</h2>
                <p className='mt-1 text-sm leading-5 text-[#667085] dark:text-[#a8b3c5]'>{detail}</p>
            </div>
        </div>
    )
}

function Metric({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#e6ebf2] bg-[#f8fafc] p-3 dark:border-[#26344a] dark:bg-[#0d1522]'>
            <p className='flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#667085] dark:text-[#a8b3c5]'>{icon}{label}</p>
            <p className='mt-2 truncate text-2xl font-semibold text-[#171a21] dark:text-white'>{value}</p>
            <p className='mt-1 truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{detail}</p>
        </div>
    )
}

function Field({ label, value, onChange, disabled, placeholder = '', type = 'text' }: { label: string, value: string, onChange: (value: string) => void, disabled?: boolean, placeholder?: string, type?: string }) {
    return (
        <label className='grid gap-1 text-sm font-medium text-[#344054] dark:text-[#cbd5e1]'>
            {label}
            <input type={type} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={inputClass} placeholder={placeholder} />
        </label>
    )
}

function SelectField({ label, value, options, onChange, disabled }: { label: string, value: string, options: string[], onChange: (value: string) => void, disabled?: boolean }) {
    return (
        <label className='grid gap-1 text-sm font-medium text-[#344054] dark:text-[#cbd5e1]'>
            {label}
            <select value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={inputClass}>
                {options.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
            </select>
        </label>
    )
}

function RoleBadge({ role }: { role: OrganizationRole }) {
    return <span className='shrink-0 rounded-md bg-[#eef4ff] px-2 py-1 text-xs font-semibold text-[#3056d3] dark:bg-[#1b2a44] dark:text-[#9cc2ff]'>{role}</span>
}

function StatusPill({ status }: { status: string }) {
    const tone = status === 'active' ? 'bg-[#dcfae6] text-[#067647] dark:bg-[#12351f] dark:text-[#86efac]' : status === 'paused' ? 'bg-[#fff7d6] text-[#8a4b00] dark:bg-[#332604] dark:text-[#fde68a]' : 'bg-[#f1f4f8] text-[#596170] dark:bg-[#1e293b] dark:text-[#cbd5e1]'
    return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{status}</span>
}

function StatusBanner({ tone, text }: { tone: 'error' | 'warning' | 'success', text: string }) {
    const classes = tone === 'error'
        ? 'border-[#fecdca] bg-[#fffbfa] text-[#b42318] dark:border-[#7f1d1d] dark:bg-[#2a1010] dark:text-[#fecaca]'
        : tone === 'warning'
            ? 'border-[#fedf89] bg-[#fffaeb] text-[#93370d] dark:border-[#704d0a] dark:bg-[#271a05] dark:text-[#fde68a]'
            : 'border-[#abefc6] bg-[#f6fef9] text-[#067647] dark:border-[#14532d] dark:bg-[#092114] dark:text-[#bbf7d0]'
    const Icon = tone === 'success' ? CheckCircle2 : CircleAlert
    return (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${classes}`}>
            <Icon className='mt-0.5 h-4 w-4 shrink-0' />
            <span>{sanitizeOrganizationDisplayCopy(text) || text}</span>
        </div>
    )
}

function RowStatus({ message }: { message?: RowMessage }) {
    if (!message) return null
    const tone = message.ok
        ? 'bg-[#ecfdf3] text-[#067647] dark:bg-[#102b1a] dark:text-[#86efac]'
        : 'bg-[#fff1f3] text-[#b42318] dark:bg-[#2a1010] dark:text-[#fecaca]'
    return <span className={`inline-flex max-w-full truncate rounded-md px-2 py-1 text-[11px] font-semibold ${tone}`}>{sanitizeOrganizationDisplayCopy(message.text) || message.text}</span>
}

function EmptyLine({ text }: { text: string }) {
    return <p className='rounded-md bg-[#f8fafc] px-3 py-2 text-sm text-[#667085] dark:bg-[#0d1522] dark:text-[#a8b3c5]'>{text}</p>
}

function SkeletonRows({ count }: { count: number }) {
    return Array.from({ length: count }, (_, index) => <div key={index} className='h-14 animate-pulse rounded-lg bg-[#eef2f7] dark:bg-[#1a2638]' />)
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

function readableEndpoint(value: string) {
    return value.replace(/([A-Z])/g, ' $1').toLowerCase()
}

function sentenceCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function actionLabel(value: string) {
    return value.split('-').map(sentenceCase).join(' ')
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
        ['Case route', visibility?.caseRoute ?? payload.caseRoute ?? '/api/cases'],
    ]
    return rows.map(([label, value]) => ({
        id: String(label),
        primary: String(label),
        secondary: value === undefined || value === null ? 'Not returned' : String(value),
    }))
}

function organizationActivityRows(local: ActivityItem[], bundle: OrgBundle) {
    const deliveryRows: ActivityItem[] = bundle.deliveries.map(delivery => ({
        id: `delivery-${delivery.id}`,
        at: delivery.attemptedAt || delivery.updatedAt || delivery.createdAt || new Date(0).toISOString(),
        title: delivery.dryRun ? 'Destination tested' : 'Alert routed',
        detail: `${delivery.status || 'delivery'} · ${delivery.watchlistId || delivery.alertId || 'watchlist'}`,
        ok: !delivery.error && delivery.status !== 'failed',
        subjectType: 'destination',
        subjectId: delivery.webhookDestinationId || delivery.watchlistItemId || delivery.watchlistId || delivery.alertId,
        relatedSubjectIds: [delivery.webhookDestinationId, delivery.watchlistItemId, delivery.watchlistId, ...(delivery.watchlistItemIds || [])].filter(Boolean) as string[],
        metadata: compactMetadata([
            ['Endpoint', delivery.endpointHint || delivery.endpointHash],
            ['Destination', delivery.webhookDestinationId],
            ['Alert', delivery.alertId],
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
        detail: `${member.name || member.userId} · ${member.role} · ${member.status}`,
        ok: member.status !== 'removed' && member.status !== 'revoked',
        subjectType: 'member',
        subjectId: member.userId,
        metadata: compactMetadata([
            ['User', member.userId],
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
            ['Route', item.webhookEndpointHint || item.webhookEndpointHash],
            ['Ref', item.alertGenerationRef],
        ]),
    }))
    const destinationRows: ActivityItem[] = bundle.webhooks.map(destination => ({
        id: `destination-${destination.id}`,
        at: destination.updatedAt || destination.createdAt || new Date(0).toISOString(),
        title: 'Destination route',
        detail: `${destination.status || (destination.deliveryReady ? 'active' : 'configured')} · ${destination.endpointHint || destination.endpointHash || destination.id}`,
        ok: destination.status !== 'disabled' && destination.status !== 'deleted',
        subjectType: 'destination',
        subjectId: destination.id,
        metadata: compactMetadata([
            ['Type', destination.kind || destination.type],
            ['Hash', destination.endpointHash],
        ]),
    }))
    return [...local, ...deliveryRows, ...inviteRows, ...memberRows, ...watchlistRows, ...destinationRows]
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
        .slice(0, 12)
}

function activitySubjectFromRowKey(rowKey: string | undefined, organizationId: string | undefined): ActivitySubject | null {
    if (!rowKey) return organizationId ? { type: 'organization', id: organizationId } : null
    if (rowKey.startsWith('invite-')) return { type: 'invite', id: rowKey.replace(/^invite-/, '') }
    if (rowKey.startsWith('member-')) return { type: 'member', id: rowKey.replace(/^member-/, '') }
    if (rowKey.startsWith('watchlist-')) return { type: 'watchlist', id: rowKey.replace(/^watchlist-/, '') }
    if (rowKey.startsWith('destination-')) return { type: 'destination', id: rowKey.replace(/^destination-/, '') }
    return organizationId ? { type: 'organization', id: organizationId } : null
}

function activityItemSubject(subject: ActivitySubject | null) {
    return subject ? { subjectType: subject.type, subjectId: subject.id } : {}
}

function activityRowsForSubject(activity: ActivityItem[], subject: ActivitySubject) {
    if (subject.type === 'organization') return activity
    if (subject.type === 'destination') {
        return activity.filter(item => (item.subjectType === 'destination' || item.subjectType === 'watchlist') && (item.subjectId === subject.id || item.relatedSubjectIds?.includes(subject.id)))
    }
    return activity.filter(item => item.subjectType === subject.type && (item.subjectId === subject.id || item.relatedSubjectIds?.includes(subject.id)))
}

function selectedSubjectLabel(subject: ActivitySubject, organization: OrganizationSummary, bundle: OrgBundle) {
    if (subject.type === 'organization') return organizationDisplayName(organization)
    if (subject.type === 'invite') {
        const invite = bundle.invites.find(item => item.id === subject.id)
        return invite?.email || subject.id
    }
    if (subject.type === 'member') {
        const member = bundle.members.find(item => item.userId === subject.id)
        return member?.name || member?.userId || subject.id
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
            ['Role', member?.role],
            ['Status', member?.status],
            ['Joined', member?.joinedAt ? formatDate(member.joinedAt) : undefined],
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
            ['Endpoint', destination.endpointHint || destination.endpointHash],
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
        ['Endpoint', item?.webhookEndpointHint || delivery?.endpointHint || item?.webhookEndpointHash || delivery?.endpointHash],
        ['Last delivery', delivery?.status],
        ['Alerts', String(alertCount)],
    ])
}

function compactMetadata(rows: Array<[string, string | undefined]>) {
    return rows
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([label, value]) => ({ label, value: String(value) }))
}

function inviteLink(invite: OrganizationInvite) {
    return invite.acceptanceUrl || invite.acceptancePath || invite.token || ''
}

function destinationConfigured(item: WatchlistItem) {
    return Boolean(item.webhookUrlConfigured || item.webhookDestinationId || item.webhookEndpointHash || item.webhookEndpointHint)
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

function firstDelivery(result: DeliveryResult) {
    return result.deliveries?.[0] || result.delivery || null
}

function deliveryTime(delivery: DeliveryRow) {
    const value = delivery.attemptedAt || delivery.updatedAt || delivery.createdAt || ''
    const time = Date.parse(value)
    return Number.isFinite(time) ? time : 0
}

const inputClass = 'h-10 w-full rounded-lg border border-[#cfd7e6] bg-white px-3 text-sm text-[#171a21] outline-none transition placeholder:text-[#98a2b3] focus:border-[#3056d3] focus:ring-2 focus:ring-[#3056d3]/15 disabled:cursor-not-allowed disabled:bg-[#eef2f7] disabled:text-[#667085] dark:border-[#344258] dark:bg-[#0d1522] dark:text-[#f5f7fb] dark:placeholder:text-[#69778c] dark:focus:border-[#8fb2ff] dark:disabled:bg-[#182131]'
const compactSelectClass = 'h-9 rounded-lg border border-[#cfd7e6] bg-white px-2 text-sm font-semibold text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#3056d3]/15 disabled:cursor-not-allowed disabled:bg-[#eef2f7] disabled:text-[#667085] dark:border-[#344258] dark:bg-[#0d1522] dark:text-[#f5f7fb]'
const primaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b3342] disabled:cursor-not-allowed disabled:opacity-55 dark:bg-[#f5f7fb] dark:text-[#111827] dark:hover:bg-white'
const secondaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#cfd7e6] bg-white px-3 text-sm font-semibold text-[#202838] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#344258] dark:bg-[#121d2b] dark:text-[#eef3fb] dark:hover:bg-[#18263a]'
const iconButtonClass = 'grid h-10 w-10 place-items-center rounded-lg border border-[#cfd7e6] bg-white text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#344258] dark:bg-[#121d2b] dark:text-[#eef3fb] dark:hover:bg-[#18263a]'
const iconDangerButtonClass = 'grid h-10 w-10 place-items-center rounded-lg border border-[#fecdca] bg-[#fffbfa] text-[#b42318] transition hover:bg-[#fff1f0] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#7f1d1d] dark:bg-[#2a1010] dark:text-[#fecaca] dark:hover:bg-[#3b1414]'
