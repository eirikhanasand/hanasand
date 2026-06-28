import type { PublicTiHandoffDecodeResult } from '@/utils/ti/actorWorkbench'
import type { WorkbenchAction, WorkbenchCase, WorkbenchEvidence, WorkbenchHandoffAction, WorkbenchPublicTiHandoff, WorkbenchTimelineItem, WorkbenchWorkflowStep } from './ti/workbench/workbenchClient'

export type OperatorScope = {
    tenantId: string
    organizationId?: string
}

export type DwmWatchlistSummary = {
    id: string
    tenantId: string
    organizationId?: string
    name: string
    terms: Array<{ value: string, kind?: string }>
    webhookUrl?: string
    webhookDestinationId?: string
    status: 'active' | 'paused'
    createdAt: string
    updatedAt: string
}

export type DwmOrganizationState = {
    organizations: DwmOrganizationSummary[]
    selectedOrganization?: DwmOrganizationSummary
    members: DwmOrganizationMember[]
    pendingInvites: DwmOrganizationInvite[]
    webhooks: DwmOrganizationWebhookDestination[]
}

export type DwmOrganizationSummary = {
    id: string
    tenantId: string
    name: string
    slug: string
    status: 'active' | 'suspended'
    alertVisibilityPolicy?: 'members' | 'admins' | 'owners'
    createdAt: string
    updatedAt: string
    createdBy?: string
}

export type DwmOrganizationMember = {
    id: string
    organizationId: string
    email: string
    userId?: string
    role: 'owner' | 'admin' | 'analyst' | 'viewer' | string
    status: 'active' | 'invited' | 'removed' | string
    invitedAt?: string
    acceptedAt?: string
    createdAt: string
    updatedAt: string
}

export type DwmOrganizationInvite = {
    id: string
    organizationId: string
    email: string
    role: 'owner' | 'admin' | 'analyst' | 'viewer' | string
    status: 'pending' | 'accepted' | 'revoked' | 'expired' | string
    invitedBy?: string
    invitedAt: string
    expiresAt: string
    updatedAt: string
}

export type DwmOrganizationWebhookDestination = {
    id: string
    organizationId: string
    tenantId: string
    name: string
    kind: 'discord' | 'generic'
    status: 'active' | 'paused'
    createdAt: string
    updatedAt: string
    createdBy?: string
    lastTestedAt?: string
    lastTestStatus?: 'delivered' | 'failed' | 'dry_run'
}

export type DwmOperationsSnapshot = {
    counts: {
        sourceCount: number
        activeSourceCount: number
        captureCount: number
        watchlistMatchCount: number
    }
    latestRun?: {
        status: string
        updatedAt: string
        captureCount: number
    }
}

export type DwmDeliveryItem = {
    id: string
    alertId: string
    watchlistId: string
    organizationId?: string
    webhookDestinationId?: string
    endpointHash: string
    attemptedAt: string
    payloadHash: string
    status: string
    deliveryKind?: 'discord' | 'generic'
    httpStatus?: number
    error?: string
}

export function buildPublicTiHandoffCase(input: {
    decode: PublicTiHandoffDecodeResult | null
    scope: OperatorScope
    organizationState: DwmOrganizationState
    watchlists: DwmWatchlistSummary[]
    operations: DwmOperationsSnapshot | null
    liveAlertCount: number
}): WorkbenchCase[] {
    if (!input.decode) return []
    const now = new Date().toISOString()
    if (!input.decode.ok) {
        return [publicTiHandoffCase({
            handoff: {
                decodeStatus: 'blocked',
                decodeError: input.decode.message,
                missing: input.decode.reasonCodes,
                blockers: [{ code: input.decode.code, detail: input.decode.message }],
                sourceRequests: [],
            },
            title: 'Public TI handoff blocked',
            subtitle: input.decode.message,
            severity: 'high',
            status: input.decode.code,
            priority: 520,
            confidence: 45,
            updatedAt: now,
            evidence: [{
                id: 'ev_public_ti_decode',
                sourceName: 'Public TI handoff decoder',
                sourceFamily: 'authenticated bridge',
                captureMode: 'url payload',
                redactionState: 'customer safe',
                contentHash: input.decode.code,
                excerpt: input.decode.message,
                observedAt: now,
                provenance: 'decodePublicTiHandoffPayload',
                confidence: 45,
            }],
            nextTasks: ['Copy the exact handoff payload or return to the public TI artifact and export a fresh authenticated bridge link.', 'Do not mutate org watchlists, cases, alerts, or enrichment until payload validation succeeds.'],
            relatedLinks: [{ href: '/ti', label: 'Public TI' }],
        })]
    }

    const payload = input.decode.payload
    const organization = input.organizationState.selectedOrganization
    const orgMissing = payload.orgRequired && !organization
    const sourceBlocked = payload.sourceRequired && !input.operations
    const watchTerms = payload.artifact.watchlistTerms || []
    const watchlistCovered = watchTerms.some(term => input.watchlists.some(watchlist => (watchlist.terms || []).some(candidate => candidate.value.toLowerCase() === term.value.toLowerCase())))
    const missing = [
        ...payload.missing,
        ...(orgMissing ? ['Selected organization context from GET /api/organizations'] : []),
        ...(sourceBlocked ? ['DWM source state from /api/dwm/operations'] : []),
    ]
    const severity: WorkbenchCase['severity'] = orgMissing || sourceBlocked || payload.stale || missing.length ? 'high' : 'medium'
    const updatedAt = payload.generatedAt || now
    const selectedMissing = payload.selectedPayload.missing || []
    const handoff: WorkbenchPublicTiHandoff = {
        decodeStatus: 'ready',
        action: input.decode.action as WorkbenchHandoffAction,
        artifactId: payload.artifactId,
        query: payload.query,
        generatedAt: payload.generatedAt,
        orgRequired: payload.orgRequired,
        sourceRequired: payload.sourceRequired,
        stale: payload.stale,
        missing,
        blockers: payload.blockers,
        sourceRequests: payload.sourceRequests,
        artifact: payload.artifact,
        selectedPayload: payload.selectedPayload,
        actionPayloads: payload.actionPayloads,
    }

    return [publicTiHandoffCase({
        handoff,
        title: `Public TI: ${payload.artifact.label || payload.query}`,
        subtitle: selectedMissing.length ? selectedMissing.join('; ') : `${actionLabel(input.decode.action)} for ${payload.query}.`,
        severity,
        status: orgMissing ? 'org_required' : payload.stale ? 'stale_evidence' : selectedMissing.length ? 'blocked_dependencies' : 'ready_for_operator',
        priority: 540,
        confidence: typeof payload.artifact.confidence === 'number' ? payload.artifact.confidence : 72,
        updatedAt,
        evidence: publicTiEvidence(payload, now),
        timeline: [
            { id: 'public_ti_generated', at: payload.generatedAt || now, title: 'Public TI handoff generated', body: `${payload.query} exported ${actionLabel(input.decode.action)}.` },
            { id: 'public_ti_org_gate', at: now, title: organization ? 'Organization context loaded' : 'Organization context required', body: organization ? `${organization.name} (${organization.id}) is available for explicit mutations.` : 'No selected organization was returned; mutations are blocked until org context exists.' },
            { id: 'public_ti_alert_state', at: input.operations?.latestRun?.updatedAt || now, title: input.liveAlertCount ? 'Alert generation loaded' : 'Alert generation not proven', body: input.liveAlertCount ? `${input.liveAlertCount} live DWM alert(s) loaded for this scope.` : input.operations ? 'Source state loaded, but no live DWM alerts are loaded yet.' : 'Source state unavailable from /api/dwm/operations.' },
        ],
        workflowPath: [
            {
                id: 'public_ti_path_org',
                label: 'Organization',
                status: organization ? 'ready' : 'blocked',
                owner: organization ? 'operator' : 'backend-foundation',
                source: 'GET /api/organizations',
                entityId: organization?.id,
                href: organization ? `/api/organizations/${encodeURIComponent(organization.id)}/members` : '/api/organizations',
                detail: organization ? `Mutations will use ${organization.name}.` : 'Explicit organization context is required before persistence.',
            },
            {
                id: 'public_ti_path_watchlist',
                label: 'Shared watchlist',
                status: watchlistCovered ? 'ready' : watchTerms.length ? 'needs_action' : 'blocked',
                owner: 'operator',
                source: 'POST /api/dwm/watchlists',
                entityId: watchTerms.map(term => term.value).join(', ') || undefined,
                href: '/api/dwm/watchlists',
                detail: watchlistCovered ? 'Selected artifact term is already covered by a loaded watchlist.' : watchTerms.length ? 'Add selected artifact terms to an organization watchlist.' : 'No watchlist terms came with this artifact.',
            },
            {
                id: 'public_ti_path_alerts',
                label: 'Alert generation',
                status: input.operations ? input.liveAlertCount ? 'ready' : 'needs_action' : 'blocked',
                owner: 'analyst',
                source: 'GET /api/dwm/operations + POST /api/dwm/alerts/rebuild',
                href: '/api/dwm/alerts',
                detail: input.operations ? `${input.operations.counts.activeSourceCount}/${input.operations.counts.sourceCount} active sources; ${input.liveAlertCount} saved alerts.` : 'Source state unavailable.',
            },
            {
                id: 'public_ti_path_source',
                label: 'Source pack',
                status: payload.sourceRequired ? 'needs_action' : 'ready',
                owner: 'source-ops',
                source: 'public TI sourceRequests',
                href: '/dashboard/ti/sources',
                detail: payload.sourceRequests.length ? `${payload.sourceRequests.length} source request(s) require review.` : 'No additional source request was included.',
            },
        ],
        nextTasks: nextPublicTiTasks({ orgMissing, sourceBlocked, stale: payload.stale, watchTerms: watchTerms.length, selectedMissing, action: input.decode.action }),
        relatedLinks: [
            { href: '/ti', label: 'Public TI' },
            { href: '/dashboard/dwm', label: 'DWM console' },
            { href: '/dashboard/ti/sources', label: 'Source ops' },
            { href: '/dashboard/automations?setup=dwm', label: 'Delivery routes' },
        ],
    })]
}

export function buildOrgOperatingContext(input: {
    backendConfigured: boolean
    scope: OperatorScope
    watchlists: DwmWatchlistSummary[]
    organizationState: DwmOrganizationState
    operations?: DwmOperationsSnapshot | null
    deliveries?: DwmDeliveryItem[]
    liveAlertCount?: number
}) {
    const organization = input.organizationState.selectedOrganization
    const activeMembers = input.organizationState.members.filter(item => item.status === 'active')
    const pendingInvites = input.organizationState.pendingInvites.filter(item => item.status === 'pending')
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const activeWebhooks = input.organizationState.webhooks.filter(item => item.status === 'active')
    const termCount = activeWatchlists.reduce((sum, item) => sum + (item.terms || []).length, 0)
    const latestDelivery = (input.deliveries || [])[0]
    const blockedReasons = [
        !input.backendConfigured ? 'TI_SCRAPER_API_BASE is not configured; org/team/watchlist state cannot be loaded.' : '',
        !organization ? 'No selected organization returned from GET /api/organizations.' : '',
        organization && !activeMembers.length ? `No active members returned from /api/organizations/${organization.id}/members.` : '',
        organization && !activeWatchlists.length ? 'No active shared DWM watchlist returned for this organization scope.' : '',
        organization && !activeWebhooks.length ? 'No active organization webhook destination returned.' : '',
    ].filter(Boolean)

    return {
        scope: input.scope,
        organization,
        members: input.organizationState.members,
        pendingInvites,
        watchlists: input.watchlists,
        webhookDestinations: input.organizationState.webhooks,
        readiness: {
            activeMemberCount: activeMembers.length,
            pendingInviteCount: pendingInvites.length,
            activeWatchlistCount: activeWatchlists.length,
            termCount,
            activeWebhookCount: activeWebhooks.length,
            alertVisibilityPolicy: organization?.alertVisibilityPolicy || 'members',
            blockedReasons,
            liveAlertCount: input.liveAlertCount ?? 0,
            sourceCoverage: input.operations ? {
                sourceCount: input.operations.counts.sourceCount,
                activeSourceCount: input.operations.counts.activeSourceCount,
                captureCount: input.operations.counts.captureCount,
                watchlistMatchCount: input.operations.counts.watchlistMatchCount,
                latestRunStatus: input.operations.latestRun?.status,
                latestRunAt: input.operations.latestRun?.updatedAt,
            } : undefined,
            latestDelivery: latestDelivery ? {
                id: latestDelivery.id,
                alertId: latestDelivery.alertId,
                status: latestDelivery.status,
                deliveryKind: latestDelivery.deliveryKind,
                attemptedAt: latestDelivery.attemptedAt,
                webhookDestinationId: latestDelivery.webhookDestinationId,
                endpointHash: latestDelivery.endpointHash,
                payloadHash: latestDelivery.payloadHash,
                httpStatus: latestDelivery.httpStatus,
                error: latestDelivery.error,
            } : undefined,
        },
        links: organization ? [
            { href: `/api/organizations/${encodeURIComponent(organization.id)}/members`, label: 'Members API' },
            { href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Webhooks API' },
            { href: '/api/dwm/watchlists', label: 'Watchlists API' },
            { href: '/dashboard/dwm', label: 'DWM console' },
        ] : [
            { href: '/api/organizations', label: 'Organizations API' },
            { href: '/dashboard/dwm', label: 'DWM console' },
        ],
        createWatchlistAction: input.backendConfigured && organization ? {
            id: 'create_shared_watchlist_term',
            label: 'Create shared term',
            method: 'POST' as const,
            href: '/api/dwm/watchlists',
            body: {
                ...actionScope(input.scope),
                name: organization ? `${organization.name} shared exposure watchlist` : 'Shared exposure watchlist',
                webhookDestinationId: activeWebhooks[0]?.id,
            },
        } : undefined,
    }
}

function publicTiHandoffCase(input: {
    handoff: WorkbenchPublicTiHandoff
    title: string
    subtitle: string
    severity: WorkbenchCase['severity']
    status: string
    priority: number
    confidence: number
    updatedAt: string
    evidence: WorkbenchEvidence[]
    timeline?: WorkbenchTimelineItem[]
    workflowPath?: WorkbenchWorkflowStep[]
    nextTasks: string[]
    relatedLinks: WorkbenchCase['relatedLinks']
}): WorkbenchCase {
    const artifact = input.handoff.artifact
    return {
        id: `public_ti_${input.handoff.artifactId || input.status}`,
        kind: 'public_ti_handoff',
        queue: 'Public TI handoff',
        title: input.title,
        subtitle: input.subtitle,
        severity: input.severity,
        status: input.status,
        priority: input.priority,
        confidence: input.confidence,
        owner: input.handoff.decodeStatus === 'blocked' ? 'operator' : input.handoff.orgRequired ? 'operator' : 'analyst',
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt,
        company: input.handoff.query || artifact?.label || 'Public TI',
        matchedTerm: artifact?.watchlistTerms?.[0]?.value || artifact?.label || input.handoff.query || 'public-ti',
        actor: artifact?.kind || 'public TI artifact',
        sourceLabel: input.handoff.sourceRequests.length ? `${input.handoff.sourceRequests.length} source request(s)` : 'public TI bridge',
        recommendedAction: input.handoff.decodeStatus === 'blocked' ? 'Export a valid authenticated public TI bridge payload before mutating operator data.' : 'Resolve org/source blockers, then add watchlist terms, rebuild alerts, open a case, or copy the exact handoff.',
        routeLabel: actionLabel(input.handoff.action),
        persistent: false,
        evidence: input.evidence,
        timeline: input.timeline || [],
        nextTasks: input.nextTasks,
        relatedLinks: input.relatedLinks,
        workflowPath: input.workflowPath,
        handoff: input.handoff,
        missingDependency: input.handoff.missing[0],
    }
}

function publicTiEvidence(payload: Extract<PublicTiHandoffDecodeResult, { ok: true }>['payload'], now: string): WorkbenchEvidence[] {
    const artifactEvidence = (payload.artifact.evidence || []).slice(0, 4).map((excerpt, index) => ({
        id: `ev_public_ti_artifact_${index}`,
        sourceName: 'Public TI artifact',
        sourceFamily: payload.artifact.kind || 'actor artifact',
        captureMode: 'authenticated handoff',
        redactionState: 'customer safe',
        contentHash: `${payload.artifactId}:${index}`,
        excerpt,
        observedAt: payload.artifact.freshness || payload.generatedAt || now,
        provenance: payload.artifact.provenance?.[index] || 'public TI selected artifact',
        confidence: payload.artifact.confidence,
    }))
    const sourceEvidence = payload.sourceRequests.slice(0, 4).map((source, index) => ({
        id: `ev_public_ti_source_${index}`,
        sourceName: source.sourceName,
        sourceFamily: 'source request',
        captureMode: source.captureId ? 'capture reference' : 'source request',
        redactionState: 'customer safe',
        contentHash: source.captureId || source.provenance,
        excerpt: source.missing.length ? `Missing: ${source.missing.join(', ')}` : source.provenance,
        observedAt: payload.generatedAt || now,
        provenance: source.provenance,
        confidence: source.confidence,
    }))
    return [...artifactEvidence, ...sourceEvidence].length ? [...artifactEvidence, ...sourceEvidence] : [{
        id: 'ev_public_ti_payload',
        sourceName: 'Public TI handoff',
        sourceFamily: 'authenticated bridge',
        captureMode: 'url payload',
        redactionState: 'customer safe',
        contentHash: payload.artifactId,
        excerpt: `${payload.query} exported ${actionLabel(payload.action)}.`,
        observedAt: payload.generatedAt || now,
        provenance: 'decodePublicTiHandoffPayload',
        confidence: 70,
    }]
}

function nextPublicTiTasks(input: { orgMissing: boolean, sourceBlocked: boolean, stale: boolean, watchTerms: number, selectedMissing: string[], action: string }) {
    if (input.orgMissing) return ['Owner: operator. Create or select an organization before mutation.', 'Copy exact public TI handoff if the organization lane is not ready.', 'Return after org context loads and add watchlist or case from the handoff.']
    if (input.sourceBlocked || input.stale) return ['Owner: source-ops. Attach fresh source/capture provenance before alert generation.', 'Review source health in /dashboard/ti/sources.', 'Copy exact handoff if source pack persistence is unavailable.']
    if (!input.watchTerms) return ['Owner: analyst. Choose or add a watchlist term for this artifact.', 'Use enrichment before alert rebuild.', 'Copy exact handoff for source-ops if no customer term exists.']
    if (input.selectedMissing.length) return [`Owner: operator. Resolve: ${input.selectedMissing.join('; ')}.`, 'Then run the selected handoff action.', 'Keep the handoff payload attached as audit context.']
    return [`Owner: analyst. Run ${actionLabel(input.action)} from the action rail.`, 'Inspect generated alerts/case detail after refresh.', 'Test webhook before customer delivery.']
}

function actionLabel(action: string | undefined) {
    if (action === 'create_watchlist') return 'create watchlist'
    if (action === 'rebuild_alerts') return 'rebuild alerts'
    if (action === 'open_case') return 'open case'
    if (action === 'queue_enrichment') return 'queue enrichment'
    return 'public TI handoff'
}

export function buildReadinessCases(input: {
    backendConfigured: boolean
    scope: OperatorScope
    watchlists: DwmWatchlistSummary[]
    operations: DwmOperationsSnapshot | null
    deliveries: DwmDeliveryItem[]
    organizationState: DwmOrganizationState
    liveAlertCount: number
    renderedAlertCount: number
}): WorkbenchCase[] {
    const now = new Date().toISOString()
    const organization = input.organizationState.selectedOrganization
    const orgWebhooks = input.organizationState.webhooks.filter(item => item.status === 'active')
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const watchlistTerms = activeWatchlists.flatMap(item => item.terms || [])
    const webhookWatchlists = activeWatchlists.filter(item => item.webhookUrl || item.webhookDestinationId)
    const hasWebhookDestination = Boolean(orgWebhooks.length || webhookWatchlists.length)
    const activeSources = input.operations?.counts.activeSourceCount ?? 0
    const sourceCount = input.operations?.counts.sourceCount ?? 0
    const latestDelivery = input.deliveries[0]
    const deliveryFailures = input.deliveries.filter(item => item.status === 'failed' || item.status === 'skipped').length
    const orgWebhookFailures = orgWebhooks.filter(item => item.lastTestStatus === 'failed').length
    const path = operatorPath({
        scope: input.scope,
        organization,
        activeWatchlists,
        orgWebhooks,
        sourceCount,
        activeSources,
        liveAlertCount: input.liveAlertCount,
        latestDelivery,
    })

    return [
        readinessCase({
            id: 'setup_organization',
            kind: 'org_readiness',
            queue: 'Org access',
            title: organization ? `${organization.name} organization active` : 'Create organization context',
            severity: organization ? 'medium' : 'high',
            status: organization ? 'org_active' : input.backendConfigured ? 'missing_organization' : 'backend_unconfigured',
            priority: organization ? 285 : 390,
            confidence: input.backendConfigured ? 94 : 64,
            subtitle: organization
                ? `${input.organizationState.organizations.length} organization${input.organizationState.organizations.length === 1 ? '' : 's'} loaded. Tenant scope: ${organization.tenantId}.`
                : input.backendConfigured ? 'The backed organization API is available, but no organization was returned for this workspace.' : 'TI scraper backend is not configured, so organization membership cannot be loaded.',
            recommendedAction: organization ? 'Continue through shared watchlist, alert rebuild, case opening, and webhook delivery under this organization scope.' : 'Create or join an organization through the backed org API before selling shared ownership, shared watchlists, or team routing.',
            evidence: [{
                id: 'ev_organization_api',
                sourceName: 'Organizations API',
                sourceFamily: 'organization API',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: organization?.id || '/api/organizations',
                excerpt: organization ? `${organization.name} (${organization.slug}) is ${organization.status}; tenantId=${organization.tenantId}.` : 'GET/POST /api/organizations returned no org record for this workspace.',
                observedAt: organization?.updatedAt || now,
                provenance: 'GET /api/organizations -> /v1/organizations',
                confidence: input.backendConfigured ? 94 : 64,
            }],
            timeline: [{ id: 'organization_setup_audit', at: organization?.updatedAt || now, title: organization ? 'Organization loaded' : 'Organization required', body: organization ? 'Organization state came from the backed scraper API.' : 'Create or join an organization before claiming shared team ownership.' }],
            nextTasks: organization ? [`Owner: operator. Scope: ${organization.id}. Review members and pending invites.`, 'Attach or create a shared DWM watchlist in this organization scope.', 'Create/test org webhook destination before customer routing.'] : ['Owner: backend-foundation. POST /api/organizations with name and ownerEmail.', 'Invite analysts through /api/organizations/:id/invites.', 'Create an org webhook destination before customer routing.'],
            relatedLinks: organization ? [{ href: '/api/organizations', label: 'Organizations API' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/members`, label: 'Members API' }] : [{ href: '/api/organizations', label: 'Create organization API' }],
            workflowPath: path,
            actions: organization ? [] : [{ id: 'create_organization', label: 'Create org API', method: 'GET', href: '/api/organizations' }],
        }),
        readinessCase({
            id: 'watchlist_terms',
            kind: 'watchlist_readiness',
            queue: 'Shared watchlists',
            title: activeWatchlists.length ? 'Shared watchlist active' : 'Create shared watchlist',
            severity: activeWatchlists.length ? 'medium' : 'high',
            status: activeWatchlists.length ? 'active' : 'missing_watchlist',
            priority: activeWatchlists.length ? 260 : 380,
            confidence: input.backendConfigured ? 92 : 65,
            subtitle: activeWatchlists.length
                ? `${activeWatchlists.length} active watchlist${activeWatchlists.length === 1 ? '' : 's'} with ${watchlistTerms.length} total term${watchlistTerms.length === 1 ? '' : 's'} in ${input.scope.organizationId ? 'organization' : 'tenant'} scope.`
                : input.backendConfigured ? 'No active DWM watchlist returned for the selected operator scope.' : 'TI scraper backend is not configured, so watchlist state cannot be loaded.',
            recommendedAction: activeWatchlists.length ? 'Review term coverage, then rebuild alerts from the selected organization scope.' : 'Create a DWM watchlist with company, domain, vendor, brand, VIP, or product terms, then rebuild alerts.',
            evidence: [{
                id: 'ev_watchlist_route',
                sourceName: 'DWM watchlists API',
                sourceFamily: 'workflow route',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: activeWatchlists[0]?.id || '/api/dwm/watchlists',
                excerpt: activeWatchlists.length ? activeWatchlists.map(item => `${item.id}: ${item.name}; ${(item.terms || []).map(term => term.value).join(', ')}`).join(' | ') : 'POST /api/dwm/watchlists accepts organizationId, terms, and optional webhookDestinationId/webhookUrl.',
                observedAt: activeWatchlists[0]?.updatedAt || now,
                provenance: 'GET/POST /api/dwm/watchlists',
                confidence: input.backendConfigured ? 92 : 65,
            }],
            timeline: [{ id: 'watchlist_state_at', at: activeWatchlists[0]?.updatedAt || now, title: activeWatchlists.length ? 'Watchlist loaded' : 'Watchlist required', body: activeWatchlists.length ? 'Watchlist data came from the DWM backend.' : 'Alert rebuild is blocked until watchlist terms exist.' }],
            nextTasks: activeWatchlists.length ? [`Owner: operator. Watchlist IDs: ${activeWatchlists.map(item => item.id).join(', ')}.`, `Terms: ${watchlistTerms.length}. Rebuild alerts for ${input.scope.organizationId || input.scope.tenantId}.`, 'Open generated DWM alerts as analyst cases before delivery.'] : ['Owner: operator. Open DWM console and save watchlist terms.', 'Run alert rebuild.', 'Confirm the watchlist has an organization owner.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Edit watchlist' }, { href: '/api/dwm/watchlists', label: 'Watchlists API' }],
            workflowPath: path,
            actions: activeWatchlists.length ? [{
                id: 'rebuild_alerts',
                label: 'Rebuild alerts',
                method: 'POST',
                href: '/api/dwm/alerts/rebuild',
                body: actionScope(input.scope),
            }] : [],
        }),
        readinessCase({
            id: 'delivery_route',
            kind: 'webhook_readiness',
            queue: 'Delivery route',
            title: orgWebhooks.length ? 'Organization webhook destination active' : webhookWatchlists.length ? 'Watchlist webhook destination configured' : 'Configure webhook destination',
            severity: hasWebhookDestination && !deliveryFailures && !orgWebhookFailures ? 'medium' : 'high',
            status: hasWebhookDestination ? 'destination_ready' : 'missing_webhook',
            priority: hasWebhookDestination && !deliveryFailures && !orgWebhookFailures ? 250 : 370,
            confidence: input.backendConfigured ? 90 : 64,
            subtitle: orgWebhooks.length
                ? `${orgWebhooks.length} active org webhook destination${orgWebhooks.length === 1 ? '' : 's'}. Latest delivery: ${latestDelivery ? `${latestDelivery.status} (${latestDelivery.id})` : 'none attempted'}.`
                : webhookWatchlists.length
                    ? `${webhookWatchlists.length} watchlist destination${webhookWatchlists.length === 1 ? '' : 's'} configured. Latest delivery: ${latestDelivery ? `${latestDelivery.status} (${latestDelivery.id})` : 'none attempted'}.`
                    : 'No active organization or watchlist webhook destination is configured.',
            recommendedAction: hasWebhookDestination ? 'Test the destination, then send ready alerts and inspect delivery failures.' : 'Create an organization webhook destination or save a valid HTTPS webhook URL on a watchlist before sending alerts.',
            evidence: [{
                id: 'ev_webhook_delivery',
                sourceName: orgWebhooks.length ? 'Organization webhook API' : 'DWM webhook delivery API',
                sourceFamily: 'workflow route',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: orgWebhooks[0]?.id || latestDelivery?.payloadHash || '/api/organizations/:id/webhooks',
                excerpt: orgWebhooks.length ? orgWebhooks.map(item => `${item.id}: ${item.name} (${item.kind}) ${item.status}${item.lastTestStatus ? `, last test ${item.lastTestStatus}` : ''}`).join(' | ') : latestDelivery ? `${latestDelivery.id}: ${latestDelivery.status} ${latestDelivery.deliveryKind || 'webhook'} delivery to ${latestDelivery.endpointHash} at ${latestDelivery.attemptedAt}.` : 'POST /api/organizations/:id/webhooks and POST /api/dwm/webhooks/test exist; delivery fails honestly when no destination is configured.',
                observedAt: orgWebhooks[0]?.updatedAt || latestDelivery?.attemptedAt || now,
                provenance: orgWebhooks.length ? 'GET /api/organizations/:id/webhooks -> /v1/organizations/:id/webhooks' : 'GET /api/dwm/webhooks/deliveries',
                confidence: input.backendConfigured ? 90 : 64,
            }],
            timeline: [{ id: 'webhook_route_at', at: orgWebhooks[0]?.lastTestedAt || latestDelivery?.attemptedAt || now, title: hasWebhookDestination ? 'Webhook destination loaded' : 'Webhook destination required', body: orgWebhooks[0]?.lastTestStatus ? `${orgWebhooks[0].id} last test ${orgWebhooks[0].lastTestStatus}.` : latestDelivery ? `${latestDelivery.id}: ${latestDelivery.status}${latestDelivery.error ? `: ${latestDelivery.error}` : ''}` : 'No delivery destination is configured for organization or watchlist routing.' }],
            nextTasks: hasWebhookDestination ? [`Owner: operator. Destination IDs: ${orgWebhooks.map(item => item.id).join(', ') || webhookWatchlists.map(item => item.webhookDestinationId || item.id).join(', ')}.`, 'Run a webhook test.', 'Send queued alerts and inspect delivery failures.'] : ['Owner: operator. Create a Discord or generic organization webhook destination.', 'Run webhook test.', 'Send queued alerts and inspect delivery failures.'],
            relatedLinks: organization ? [{ href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Org webhooks API' }, { href: '/dashboard/dwm', label: 'Configure watchlist webhook' }, { href: '/dashboard/automations?setup=dwm', label: 'Delivery routes' }] : [{ href: '/dashboard/dwm', label: 'Configure webhook' }, { href: '/dashboard/automations?setup=dwm', label: 'Delivery routes' }],
            workflowPath: path,
            deliveryEvidence: input.deliveries.map(delivery => ({
                id: delivery.id,
                alertId: delivery.alertId,
                status: delivery.status,
                deliveryKind: delivery.deliveryKind,
                attemptedAt: delivery.attemptedAt,
                webhookDestinationId: delivery.webhookDestinationId,
                endpointHash: delivery.endpointHash,
                payloadHash: delivery.payloadHash,
                httpStatus: delivery.httpStatus,
                error: delivery.error,
            })),
            missingDependency: input.deliveries.length ? undefined : 'No webhook delivery rows returned from /api/dwm/webhooks/deliveries. Run Test org webhook or Send queued alerts to create DB delivery evidence.',
            actions: webhookActions(input.scope, organization, orgWebhooks, hasWebhookDestination),
        }),
        readinessCase({
            id: 'source_coverage',
            kind: 'source_readiness',
            queue: 'Source coverage',
            title: sourceCount ? 'Source coverage loaded' : 'Connect source coverage',
            severity: sourceCount && activeSources ? 'medium' : 'high',
            status: sourceCount && activeSources ? 'collecting' : 'missing_sources',
            priority: sourceCount && activeSources ? 245 : 360,
            confidence: input.operations ? 88 : 60,
            subtitle: input.operations ? `${activeSources}/${sourceCount} sources active. Latest run: ${input.operations.latestRun?.status || 'none'}.` : 'DWM operations API did not return source inventory for this dashboard.',
            recommendedAction: sourceCount && activeSources ? 'Keep source health above threshold and run collection after watchlist changes.' : 'Connect or approve public Telegram and metadata-only dark web sources before promising alert coverage.',
            evidence: [{
                id: 'ev_source_coverage',
                sourceName: 'DWM operations API',
                sourceFamily: 'source health',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: '/api/dwm/operations',
                excerpt: input.operations ? `${input.operations.counts.captureCount} captures, ${input.operations.counts.watchlistMatchCount} watchlist matches.` : 'GET /api/dwm/operations is the expected source-health route; no backend snapshot is configured locally.',
                observedAt: input.operations?.latestRun?.updatedAt || now,
                provenance: 'GET /api/dwm/operations',
                confidence: input.operations ? 88 : 60,
            }],
            timeline: [{ id: 'source_health_at', at: input.operations?.latestRun?.updatedAt || now, title: input.operations?.latestRun ? 'Latest collection run' : 'Source snapshot missing', body: input.operations?.latestRun ? `${input.operations.latestRun.status}: ${input.operations.latestRun.captureCount} captures.` : 'Source coverage cannot be verified without TI scraper backend.' }],
            nextTasks: [`Owner: source-ops. Active sources: ${activeSources}/${sourceCount}.`, 'Approve bounded public Telegram coverage.', 'Approve metadata-only dark web source coverage.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Run collection' }, { href: '/dashboard/ti/sources', label: 'Review TI sources' }],
            workflowPath: path,
        }),
        readinessCase({
            id: 'alert_generation',
            kind: 'alert_readiness',
            queue: 'Alert generation',
            title: input.liveAlertCount ? 'Real DWM alerts generated' : 'Generate real DWM alerts',
            severity: input.liveAlertCount ? 'medium' : 'high',
            status: input.liveAlertCount ? 'alerts_ready' : 'demo_or_empty',
            priority: input.liveAlertCount ? 240 : 350,
            confidence: input.liveAlertCount ? 90 : 58,
            subtitle: input.liveAlertCount ? `${input.liveAlertCount} saved DWM alert${input.liveAlertCount === 1 ? '' : 's'} loaded from backend.` : `${input.renderedAlertCount} fallback alert${input.renderedAlertCount === 1 ? '' : 's'} rendered so the workflow is inspectable, but real alert generation has not been verified.`,
            recommendedAction: input.liveAlertCount ? 'Work the ready alerts, open cases, replay evidence, and deliver customer notifications.' : 'Create watchlist terms, collect sources, rebuild alerts, and stop relying on fallback cases for sales demos.',
            evidence: [{
                id: 'ev_alert_generation',
                sourceName: 'DWM alerts API',
                sourceFamily: 'alert workflow',
                captureMode: 'api snapshot',
                redactionState: 'customer safe',
                contentHash: '/api/dwm/alerts',
                excerpt: input.liveAlertCount ? 'Alerts came from GET /v1/dwm/alerts for the selected operator scope.' : 'The page is using fallback DWM cases because GET /v1/dwm/alerts returned no saved alerts or backend is absent.',
                observedAt: now,
                provenance: 'GET /api/dwm/alerts + POST /api/dwm/alerts/rebuild',
                confidence: input.liveAlertCount ? 90 : 58,
            }],
            timeline: [{ id: 'alert_generation_at', at: now, title: input.liveAlertCount ? 'Alerts loaded' : 'Alert generation not proven', body: input.liveAlertCount ? 'Saved alerts are ready for triage.' : 'Alert rebuild needs active watchlist terms and source captures.' }],
            nextTasks: input.liveAlertCount ? [`Owner: analyst. Case candidates: ${input.liveAlertCount}.`, 'Select a DWM alert and open/update its backed analyst case.', 'Send only after webhook destination test succeeds.'] : ['Owner: operator. Save watchlist.', 'Run collection.', 'Rebuild alerts.'],
            relatedLinks: [{ href: '/dashboard/dwm', label: 'Rebuild alerts' }, { href: '/api/dwm/alerts', label: 'Alerts API' }],
            workflowPath: path,
            actions: activeWatchlists.length ? [{
                id: 'rebuild_alerts',
                label: 'Rebuild alerts',
                method: 'POST',
                href: '/api/dwm/alerts/rebuild',
                body: actionScope(input.scope),
            }] : [],
        }),
    ]
}

function readinessCase(input: {
    id: string
    kind: WorkbenchCase['kind']
    queue: string
    title: string
    severity: WorkbenchCase['severity']
    status: string
    priority: number
    confidence: number
    subtitle: string
    recommendedAction: string
    evidence: WorkbenchEvidence[]
    timeline: WorkbenchTimelineItem[]
    nextTasks: string[]
    relatedLinks: WorkbenchCase['relatedLinks']
    workflowPath?: WorkbenchWorkflowStep[]
    actions?: WorkbenchAction[]
    deliveryEvidence?: WorkbenchCase['deliveryEvidence']
    missingDependency?: string
}): WorkbenchCase {
    const updatedAt = input.evidence[0]?.observedAt || new Date().toISOString()

    return {
        id: input.id,
        kind: input.kind,
        queue: input.queue,
        title: input.title,
        subtitle: input.subtitle,
        severity: input.severity,
        status: input.status,
        priority: input.priority,
        confidence: input.confidence,
        owner: input.kind === 'org_readiness' && input.status !== 'org_active' ? 'backend-foundation' : 'operator',
        createdAt: updatedAt,
        updatedAt,
        company: 'Hanasand DWM',
        matchedTerm: input.queue,
        actor: 'Operations control',
        sourceLabel: input.evidence[0]?.sourceName || 'Dashboard control',
        recommendedAction: input.recommendedAction,
        routeLabel: input.queue.toLowerCase(),
        persistent: input.kind !== 'org_readiness',
        evidence: input.evidence,
        timeline: input.timeline,
        nextTasks: input.nextTasks,
        relatedLinks: input.relatedLinks,
        workflowPath: input.workflowPath,
        actions: input.actions,
        deliveryEvidence: input.deliveryEvidence,
        missingDependency: input.missingDependency,
    }
}

function operatorPath(input: {
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWatchlists: DwmWatchlistSummary[]
    orgWebhooks: DwmOrganizationWebhookDestination[]
    sourceCount: number
    activeSources: number
    liveAlertCount: number
    latestDelivery?: DwmDeliveryItem
}): WorkbenchWorkflowStep[] {
    const watchlistIds = input.activeWatchlists.map(item => item.id)
    const webhookIds = input.orgWebhooks.map(item => item.id)
    return [
        {
            id: 'path_org',
            label: 'Organization',
            status: input.organization ? 'ready' : 'blocked',
            owner: input.organization ? 'operator' : 'backend-foundation',
            source: 'GET /api/organizations',
            entityId: input.organization?.id,
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/members` : '/api/organizations',
            detail: input.organization ? `${input.organization.name}; tenant ${input.organization.tenantId}` : 'No organization record loaded.',
        },
        {
            id: 'path_watchlist',
            label: 'Shared watchlist',
            status: input.activeWatchlists.length ? 'ready' : 'needs_action',
            owner: 'operator',
            source: 'GET/POST /api/dwm/watchlists',
            entityId: watchlistIds.join(', ') || undefined,
            href: '/dashboard/dwm',
            detail: input.activeWatchlists.length ? `${input.activeWatchlists.length} active; ${input.activeWatchlists.flatMap(item => item.terms || []).length} terms.` : 'No active watchlist in selected scope.',
        },
        {
            id: 'path_alert_case',
            label: 'Alert/case',
            status: input.liveAlertCount ? 'ready' : 'needs_action',
            owner: 'analyst',
            source: 'GET /api/dwm/alerts + POST /api/cases',
            entityId: input.liveAlertCount ? `${input.liveAlertCount} alert candidates` : undefined,
            href: '/api/dwm/alerts',
            detail: input.liveAlertCount ? 'Select a DWM alert and open/update the backed analyst case.' : `Rebuild alerts after source coverage (${input.activeSources}/${input.sourceCount}) and watchlist terms exist.`,
        },
        {
            id: 'path_webhook',
            label: 'Webhook delivery',
            status: input.orgWebhooks.length ? input.latestDelivery?.status === 'failed' ? 'blocked' : 'ready' : 'needs_action',
            owner: 'operator',
            source: 'GET/POST /api/organizations/:id/webhooks + /api/dwm/webhooks/deliver',
            entityId: webhookIds.join(', ') || input.latestDelivery?.id,
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/webhooks` : '/dashboard/dwm',
            detail: input.latestDelivery ? `${input.latestDelivery.id}: ${input.latestDelivery.status}` : input.orgWebhooks.length ? 'Destination loaded; run a test or send queued alerts.' : 'No webhook destination loaded.',
        },
    ]
}

function webhookActions(scope: OperatorScope, organization: DwmOrganizationSummary | undefined, orgWebhooks: DwmOrganizationWebhookDestination[], hasWebhookDestination: boolean): WorkbenchAction[] {
    const actions: WorkbenchAction[] = []
    const destination = orgWebhooks[0]
    if (organization && destination) {
        actions.push({
            id: 'test_org_webhook',
            label: 'Test org webhook',
            method: 'POST',
            href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks/test`,
            body: { webhookDestinationId: destination.id, dryRun: true },
        })
    }
    if (hasWebhookDestination) {
        actions.push({
            id: 'deliver_webhooks',
            label: 'Send queued alerts',
            method: 'POST',
            href: '/api/dwm/webhooks/deliver',
            body: { ...actionScope(scope), limit: 25 },
        })
    }
    return actions
}

function actionScope(scope: OperatorScope) {
    return scope.organizationId ? { organizationId: scope.organizationId } : { tenantId: scope.tenantId }
}
