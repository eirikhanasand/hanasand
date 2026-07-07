'use client'

import Link from 'next/link'
import { SyntheticEvent, useState } from 'react'

type RecoveryPayload = {
    recovery?: {
        requestId: string
        reason: string
        approvalRequired: boolean
        approvalStatus: string
        invite: {
            id: string
            email: string
            role: string
            expiresAt: string
        }
        audit: {
            query: string
            actionType: string
            outcome: string
        }
        copyText: string
    }
    error?: string
}

type DecisionDetail = {
    requestId: string
    organizationId: string
    inviteId: string
    status: string
    outcome: string
    auditEventIds?: number[]
    invite: {
        email: string
        role: string
        status: string
        expiresAt: string
    }
    copyText: string
}

type DecisionPayload = {
    decision?: DecisionDetail
    error?: string
}

type InviteActionPayload = {
    inviteAction?: {
        requestId: string
        action: string
        outcome: string
        audit?: { query?: string, actionType?: string }
        invite?: { email?: string, status?: string, role?: string }
    }
    error?: string
}

type MemberRolePayload = {
    memberRoleRecovery?: {
        requestId: string
        outcome: string
        requestedRole?: string
        audit?: { query?: string, actionType?: string }
        member?: { name?: string, role?: string, status?: string }
    }
    error?: string
}

type ApiUsageResetPayload = {
    reset?: {
        apiKeyId: string
        ownerId: string
        keyPrefix: string
        resetBucketCount: number
        auditAction: string
    }
    error?: string
}

type ApprovalSearchPayload = {
    approvals?: DecisionDetail[]
    error?: string
}

type ImpersonationPayload = {
    session?: {
        id?: string
        target?: { id?: string, name?: string }
        reason?: string
        duration_minutes?: number
        scope?: string[]
        support_session_id?: string | null
        organization_id?: string | null
        expires_at?: string
    }
    error?: string
    detail?: { code?: string, message?: string }
}

type InspectionPayload = {
    organization?: { id?: string, name?: string, slug?: string, status?: string }
    user?: { id?: string, name?: string, active?: boolean }
    accessStatus?: { overall?: string, blockers?: string[], reasons?: string[] }
    members?: Array<{ userId?: string, user_id?: string, name?: string, role?: string, status?: string }>
    memberships?: Array<{ organizationId?: string, organization_id?: string, organizationName?: string, organization_name?: string, role?: string, status?: string }>
    invites?: Array<{ id?: string, email?: string, role?: string, status?: string, expiresAt?: string, expires_at?: string }>
    pendingInvites?: Array<{ id?: string, email?: string, role?: string, status?: string, expiresAt?: string, expires_at?: string }>
    watchlistItems?: Array<{ id?: string, kind?: string, value?: string }>
    webhookDestinations?: Array<{ id?: string, name?: string, kind?: string, status?: string, endpointHint?: string, endpoint_hint?: string }>
    recentAuditEvents?: Array<{ id?: number, actionType?: string, action_type?: string, outcome?: string, reason?: string, createdAt?: string, created_at?: string }>
    supportLinks?: Record<string, string | null>
    error?: string
}

type SupportOperation = 'inspect' | 'impersonation' | 'recovery' | 'decision' | 'queue' | 'invite' | 'member' | 'apiUsage'
type InspectionUserMember = NonNullable<InspectionPayload['members']>[number]
type InspectionOrganizationMembership = NonNullable<InspectionPayload['memberships']>[number]
type InspectionMember = InspectionUserMember | InspectionOrganizationMembership

const inputClass = 'h-9 min-w-0 rounded-md border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
const textAreaClass = 'min-h-20 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
const primaryButton = 'h-9 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55'
const secondaryButton = 'h-9 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-55'
const minimumAuditReasonMessage = 'Add a specific audit reason with at least 10 characters before continuing.'
const operationTabs: Array<{ id: SupportOperation, label: string, detail: string }> = [
    { id: 'inspect', label: 'Inspect', detail: 'Members, invites, audit' },
    { id: 'impersonation', label: 'Session', detail: 'Start or end scoped access' },
    { id: 'recovery', label: 'Recovery', detail: 'Generate an invite' },
    { id: 'invite', label: 'Invite', detail: 'Resend or revoke' },
    { id: 'member', label: 'Role', detail: 'Recover member role' },
    { id: 'apiUsage', label: 'API usage', detail: 'Reset live buckets' },
    { id: 'decision', label: 'Review', detail: 'Approve or deny' },
    { id: 'queue', label: 'Queue', detail: 'Find recovery requests' },
]

function Message({ value, tone = 'neutral' }: { value: string, tone?: 'neutral' | 'error' | 'success' }) {
    if (!value) return null
    const toneClass = tone === 'error'
        ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
        : tone === 'success'
            ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
            : 'border-ui-border bg-ui-canvas text-ui-muted'
    return <p className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>{value}</p>
}

function CopyBlock({ value }: { value?: string }) {
    if (!value) return null
    return <pre className='max-h-36 overflow-auto rounded-md border border-ui-border bg-ui-canvas p-3 text-xs leading-5 text-ui-text'>{value}</pre>
}

function isOrganizationMembership(member: InspectionMember): member is InspectionOrganizationMembership {
    return 'organizationId' in member || 'organization_id' in member || 'organizationName' in member || 'organization_name' in member
}

function inspectionMemberId(member: InspectionMember, fallback: number) {
    if (isOrganizationMembership(member)) return member.organizationId || member.organization_id || `membership-${fallback}`
    return member.userId || member.user_id || `member-${fallback}`
}

function inspectionMemberName(member: InspectionMember) {
    if (isOrganizationMembership(member)) return member.organizationName || member.organization_name || member.organizationId || member.organization_id || 'Organization'
    return member.name || member.userId || member.user_id || 'User'
}

function OperationTab({
    active,
    label,
    detail,
    onClick,
}: {
    active: boolean
    label: string
    detail: string
    onClick: () => void
}) {
    return (
        <button
            type='button'
            aria-pressed={active}
            className={`rounded-md border px-3 py-2 text-left transition ${active ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-canvas text-ui-muted hover:bg-ui-raised'}`}
            onClick={onClick}
        >
            <span className='block text-sm font-semibold'>{label}</span>
            <span className='mt-0.5 block text-xs text-ui-muted'>{detail}</span>
        </button>
    )
}

function auditHref(requestId: string, action?: string) {
    const query = new URLSearchParams({ request: requestId, source: 'admin', service: 'hanasand-api' })
    if (action) query.set('action', action)
    return `/dashboard/system/impersonation?${query.toString()}`
}

function supportReasonIsSpecific(reason: string) {
    return reason.trim().length >= 10
}

export default function AccessRecoveryForm({ initialOperation = 'inspect' }: { initialOperation?: SupportOperation }) {
    const [operation, setOperation] = useState<SupportOperation>(initialOperation)
    const [inspectionResult, setInspectionResult] = useState<InspectionPayload | null>(null)
    const [recoveryResult, setRecoveryResult] = useState<RecoveryPayload | null>(null)
    const [decisionResult, setDecisionResult] = useState<DecisionPayload | null>(null)
    const [inviteActionResult, setInviteActionResult] = useState<InviteActionPayload | null>(null)
    const [memberRoleResult, setMemberRoleResult] = useState<MemberRolePayload | null>(null)
    const [apiUsageResetResult, setApiUsageResetResult] = useState<ApiUsageResetPayload | null>(null)
    const [searchResult, setSearchResult] = useState<ApprovalSearchPayload | null>(null)
    const [impersonationResult, setImpersonationResult] = useState<ImpersonationPayload | null>(null)
    const [recoveryMessage, setRecoveryMessage] = useState('')
    const [decisionMessage, setDecisionMessage] = useState('')
    const [inviteActionMessage, setInviteActionMessage] = useState('')
    const [memberRoleMessage, setMemberRoleMessage] = useState('')
    const [apiUsageResetMessage, setApiUsageResetMessage] = useState('')
    const [searchMessage, setSearchMessage] = useState('')
    const [impersonationMessage, setImpersonationMessage] = useState('')
    const [inspectionMessage, setInspectionMessage] = useState('')
    const [submitting, setSubmitting] = useState('')

    async function submitInspection(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const targetType = String(form.get('targetType') || 'organization')
        const targetId = String(form.get('targetId') || '').trim()
        const reason = String(form.get('reason') || '').trim()
        const context = String(form.get('context') || '').trim()
        if (!supportReasonIsSpecific(reason)) {
            setInspectionMessage(minimumAuditReasonMessage)
            return
        }
        const query = new URLSearchParams()
        if (reason) query.set('reason', reason)
        if (context) query.set('context', context)
        const path = targetType === 'user'
            ? `/api/backend/admin/support/users/${encodeURIComponent(targetId)}`
            : `/api/backend/admin/support/organizations/${encodeURIComponent(targetId)}`

        setSubmitting('inspect')
        setInspectionMessage('')
        setInspectionResult(null)
        try {
            const response = await fetch(`${path}${query.toString() ? `?${query}` : ''}`)
            const body = await response.json().catch(() => ({})) as InspectionPayload
            if (!response.ok) {
                setInspectionMessage(body.error || 'Inspection failed.')
                setInspectionResult(body)
                return
            }
            setInspectionResult(body)
            setInspectionMessage(`${targetType === 'user' ? 'User' : 'Organization'} inspection loaded.`)
        } catch (error) {
            setInspectionMessage(error instanceof Error ? error.message : 'Inspection failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitRecovery(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const organizationId = String(form.get('organizationId') || '').trim()
        const payload = {
            email: String(form.get('email') || '').trim(),
            targetUserId: String(form.get('targetUserId') || '').trim() || undefined,
            role: String(form.get('role') || 'admin'),
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
            caseId: String(form.get('caseId') || '').trim(),
            approvalRequired: form.get('approvalRequired') === 'on',
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setRecoveryMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('recovery')
        setRecoveryMessage('')
        setRecoveryResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as RecoveryPayload
            if (!response.ok) {
                setRecoveryMessage(body.error || 'Access recovery failed.')
                return
            }
            setRecoveryResult(body)
            setRecoveryMessage('Recovery invite generated.')
        } catch (error) {
            setRecoveryMessage(error instanceof Error ? error.message : 'Access recovery failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitDecision(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const requestId = String(form.get('requestId') || '').trim()
        const action = String(form.get('action') || 'approve') === 'deny' ? 'deny' : 'approve'
        const payload = {
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setDecisionMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('decision')
        setDecisionMessage('')
        setDecisionResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/access-recovery/${encodeURIComponent(requestId)}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as DecisionPayload
            if (!response.ok) {
                setDecisionMessage(body.error || 'Access recovery decision failed.')
                if (body.decision) setDecisionResult(body)
                return
            }
            setDecisionResult(body)
            setDecisionMessage(action === 'approve' ? 'Recovery approved.' : 'Recovery denied.')
        } catch (error) {
            setDecisionMessage(error instanceof Error ? error.message : 'Access recovery decision failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitInviteAction(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const organizationId = String(form.get('organizationId') || '').trim()
        const inviteId = String(form.get('inviteId') || '').trim()
        const action = String(form.get('action') || 'resend') === 'revoke' ? 'revoke' : 'resend'
        const payload = {
            action,
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
            supportSessionId: String(form.get('supportSessionId') || '').trim(),
            idempotencyKey: String(form.get('idempotencyKey') || '').trim(),
            expiresAt: String(form.get('expiresAt') || '').trim() || undefined,
            scope: [action === 'revoke' ? 'invite:revoke' : 'invite:resend'],
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setInviteActionMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('invite')
        setInviteActionMessage('')
        setInviteActionResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as InviteActionPayload
            if (!response.ok) {
                setInviteActionMessage(body.error || 'Invite action failed.')
                setInviteActionResult(body)
                return
            }
            setInviteActionResult(body)
            setInviteActionMessage(action === 'revoke' ? 'Invite revoked.' : 'Invite resent.')
        } catch (error) {
            setInviteActionMessage(error instanceof Error ? error.message : 'Invite action failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitMemberRoleRecovery(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const organizationId = String(form.get('organizationId') || '').trim()
        const userId = String(form.get('userId') || '').trim()
        const payload = {
            role: String(form.get('role') || 'admin'),
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
            supportSessionId: String(form.get('supportSessionId') || '').trim(),
            idempotencyKey: String(form.get('idempotencyKey') || '').trim(),
            scope: ['member:role_recovery'],
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setMemberRoleMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('member')
        setMemberRoleMessage('')
        setMemberRoleResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}/role-recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as MemberRolePayload
            if (!response.ok) {
                setMemberRoleMessage(body.error || 'Member role recovery failed.')
                setMemberRoleResult(body)
                return
            }
            setMemberRoleResult(body)
            setMemberRoleMessage('Member role recovered.')
        } catch (error) {
            setMemberRoleMessage(error instanceof Error ? error.message : 'Member role recovery failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitApiUsageReset(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const apiKeyId = String(form.get('apiKeyId') || '').trim()
        const payload = { reason: String(form.get('reason') || '').trim() }
        if (!supportReasonIsSpecific(payload.reason)) {
            setApiUsageResetMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('apiUsage')
        setApiUsageResetMessage('')
        setApiUsageResetResult(null)
        try {
            const response = await fetch(`/api/backend/rate-limit/keys/${encodeURIComponent(apiKeyId)}/reset-usage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as ApiUsageResetPayload
            if (!response.ok) {
                setApiUsageResetMessage(body.error || 'API usage reset failed.')
                setApiUsageResetResult(body)
                return
            }
            setApiUsageResetResult(body)
            setApiUsageResetMessage('API usage buckets reset.')
        } catch (error) {
            setApiUsageResetMessage(error instanceof Error ? error.message : 'API usage reset failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitSearch(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const query = new URLSearchParams()
        for (const key of ['request', 'org', 'status', 'outcome', 'requester', 'approver', 'from', 'to'] as const) {
            const value = String(form.get(key) || '').trim()
            if (value) query.set(key, value)
        }

        setSubmitting('search')
        setSearchMessage('')
        setSearchResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/access-recovery${query.toString() ? `?${query}` : ''}`)
            const body = await response.json().catch(() => ({})) as ApprovalSearchPayload
            if (!response.ok) {
                setSearchMessage(body.error || 'Approval search failed.')
                return
            }
            setSearchResult(body)
            setSearchMessage(`${body.approvals?.length || 0} approval records`)
        } catch (error) {
            setSearchMessage(error instanceof Error ? error.message : 'Approval search failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitImpersonation(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const scope = form.getAll('scope').map(value => String(value)).filter(Boolean)
        const payload = {
            target_id: String(form.get('targetId') || '').trim(),
            organizationId: String(form.get('organizationId') || '').trim(),
            supportSessionId: String(form.get('supportSessionId') || '').trim(),
            durationMinutes: String(form.get('durationMinutes') || '').trim(),
            scope,
            reason: String(form.get('reason') || '').trim(),
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setImpersonationMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('impersonation')
        setImpersonationMessage('')
        setImpersonationResult(null)
        try {
            const response = await fetch('/api/impersonation/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as ImpersonationPayload
            if (!response.ok) {
                setImpersonationMessage(body.error || body.detail?.message || 'Impersonation start failed.')
                setImpersonationResult(body)
                return
            }
            setImpersonationResult(body)
            setImpersonationMessage('Scoped impersonation started.')
        } catch (error) {
            setImpersonationMessage(error instanceof Error ? error.message : 'Impersonation start failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function stopImpersonation(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const reason = String(form.get('reason') || '').trim()
        if (!supportReasonIsSpecific(reason)) {
            setImpersonationMessage(minimumAuditReasonMessage)
            return
        }
        setSubmitting('stop')
        setImpersonationMessage('')
        try {
            const response = await fetch('/api/impersonation', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason,
                    context: String(form.get('context') || '').trim(),
                }),
            })
            if (!response.ok) {
                const body = await response.json().catch(() => ({})) as { error?: string }
                setImpersonationMessage(body.error || 'Impersonation stop failed.')
                return
            }
            setImpersonationMessage('Scoped session ended.')
        } catch (error) {
            setImpersonationMessage(error instanceof Error ? error.message : 'Impersonation stop failed.')
        } finally {
            setSubmitting('')
        }
    }

    return (
        <div className='grid gap-4'>
            <div data-testid='support-primary-operation' className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                        <h3 className='text-sm font-semibold text-ui-text'>Customer lookup</h3>
                        <p className='mt-1 text-xs leading-5 text-ui-muted'>Load customer state, then use any audited action below when the case already has enough context.</p>
                    </div>
                    <button
                        type='button'
                        aria-pressed={operation === 'inspect'}
                        className={operation === 'inspect' ? primaryButton : secondaryButton}
                        onClick={() => setOperation('inspect')}
                    >
                        Inspect access
                    </button>
                </div>
            </div>

            <details data-testid='support-secondary-operations' className='group rounded-md border border-ui-border bg-ui-canvas' open={operation !== 'inspect'}>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/20'>
                    <span>Audited support actions</span>
                    <span className='text-xs font-medium text-ui-muted group-open:hidden'>Sessions, invites, roles, API usage</span>
                    <span className='hidden text-xs font-medium text-ui-muted group-open:inline'>Hide actions</span>
                </summary>
                <div className='grid gap-2 border-t border-ui-border p-3 sm:grid-cols-2' role='group' aria-label='Support operation'>
                    {operationTabs.filter(tab => tab.id !== 'inspect').map(tab => (
                        <OperationTab
                            key={tab.id}
                            active={operation === tab.id}
                            label={tab.label}
                            detail={tab.detail}
                            onClick={() => setOperation(tab.id)}
                        />
                    ))}
                </div>
            </details>

            {operation === 'inspect' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Support inspection</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>Shows what is real: organization/user state, invites, memberships, webhooks, watchlists, and recent support audit.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitInspection}>
                    <div className='grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]'>
                        <select className={inputClass} name='targetType' defaultValue='organization'>
                            <option value='organization'>Org</option>
                            <option value='user'>User</option>
                        </select>
                        <input className={inputClass} name='targetId' placeholder='Organization or user ID' required />
                    </div>
                    <input className={inputClass} name='context' placeholder='Support case or customer context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Audit reason with support case or requester' minLength={10} required />
                    <button className={primaryButton} disabled={submitting === 'inspect'} type='submit'>{submitting === 'inspect' ? 'Inspecting...' : 'Inspect access'}</button>
                </form>
                <Message value={inspectionMessage} tone={inspectionResult?.error ? 'error' : inspectionMessage ? 'success' : 'neutral'} />
                {inspectionResult && !inspectionResult.error ? (
                    <div className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='font-semibold text-ui-text'>{inspectionResult.organization?.name || inspectionResult.user?.name || inspectionResult.organization?.id || inspectionResult.user?.id || 'Inspection'}</span>
                            {inspectionResult.accessStatus?.overall ? <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-xs text-ui-primary'>{inspectionResult.accessStatus.overall}</span> : null}
                        </div>
                        <div className='grid grid-cols-2 gap-2 text-xs sm:grid-cols-4'>
                            <span className='rounded-md bg-ui-panel px-2 py-1'>members {(inspectionResult.members || inspectionResult.memberships || []).length}</span>
                            <span className='rounded-md bg-ui-panel px-2 py-1'>invites {(inspectionResult.invites || inspectionResult.pendingInvites || []).length}</span>
                            <span className='rounded-md bg-ui-panel px-2 py-1'>watchlists {(inspectionResult.watchlistItems || []).length}</span>
                            <span className='rounded-md bg-ui-panel px-2 py-1'>webhooks {(inspectionResult.webhookDestinations || []).length}</span>
                        </div>
                        {(inspectionResult.members || inspectionResult.memberships || []).length ? (
                            <div className='grid gap-1'>
                                <div className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-muted'>Roles</div>
                                {(inspectionResult.members || inspectionResult.memberships || []).slice(0, 6).map((member, index) => (
                                    <div className='grid gap-1 rounded-md bg-ui-panel px-2 py-1 text-xs sm:grid-cols-[minmax(0,1fr)_5rem_5rem]' key={inspectionMemberId(member, index)}>
                                        <span className='truncate'>{inspectionMemberName(member)}</span>
                                        <span>{member.role || 'role'}</span>
                                        <span>{member.status || 'status'}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {(inspectionResult.invites || inspectionResult.pendingInvites || []).length ? (
                            <div className='grid gap-1'>
                                <div className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-muted'>Invites</div>
                                {(inspectionResult.invites || inspectionResult.pendingInvites || []).slice(0, 6).map((invite, index) => (
                                    <div className='grid gap-1 rounded-md bg-ui-panel px-2 py-1 text-xs sm:grid-cols-[minmax(0,1fr)_5rem_6rem]' key={`${invite.id || invite.email || index}`}>
                                        <span className='truncate'>{invite.email || invite.id}</span>
                                        <span>{invite.role || 'role'}</span>
                                        <span>{invite.status || 'status'}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {(inspectionResult.recentAuditEvents || []).length ? (
                            <div className='grid gap-1'>
                                <div className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-muted'>Recent audit</div>
                                {(inspectionResult.recentAuditEvents || []).slice(0, 4).map((event, index) => (
                                    <a className='grid gap-1 rounded-md bg-ui-panel px-2 py-1 text-xs text-ui-text hover:bg-ui-raised' href={event.id ? `/dashboard/system/impersonation?entity=${encodeURIComponent(String(event.id))}` : '/dashboard/system/impersonation'} key={`${event.id || index}`}>
                                        <span>{event.actionType || event.action_type || 'audit event'} · {event.outcome || 'outcome'}</span>
                                        {event.reason ? <span className='truncate text-ui-muted'>{event.reason}</span> : null}
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </section>}

            {operation === 'invite' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Invite support</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>Resend or revoke an organization invite with support session scope and audit replay.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitInviteAction}>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <input className={inputClass} name='organizationId' placeholder='Organization ID' required />
                        <input className={inputClass} name='inviteId' placeholder='Invite ID' required />
                        <select className={inputClass} name='action' defaultValue='resend'>
                            <option value='resend'>Resend</option>
                            <option value='revoke'>Revoke</option>
                        </select>
                        <input className={inputClass} name='expiresAt' placeholder='Resend expiry ISO timestamp' />
                        <input className={inputClass} name='supportSessionId' placeholder='Support session ID' />
                        <input className={inputClass} name='idempotencyKey' placeholder='Idempotency key' />
                    </div>
                    <input className={inputClass} name='context' placeholder='Case context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Audit reason with requester and case' minLength={10} required />
                    <button className={primaryButton} disabled={submitting === 'invite'} type='submit'>{submitting === 'invite' ? 'Applying...' : 'Apply invite action'}</button>
                </form>
                <Message value={inviteActionMessage} tone={inviteActionResult?.error ? 'error' : inviteActionMessage ? 'success' : 'neutral'} />
                {inviteActionResult?.inviteAction ? (
                    <div className='grid gap-1 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                        <div className='font-semibold text-ui-text'>{inviteActionResult.inviteAction.action} · {inviteActionResult.inviteAction.outcome}</div>
                        <div>{inviteActionResult.inviteAction.invite?.email || 'invite'} · {inviteActionResult.inviteAction.invite?.status || 'status'}</div>
                        <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(inviteActionResult.inviteAction.requestId, inviteActionResult.inviteAction.audit?.actionType)}>Open invite audit</a>
                    </div>
                ) : null}
            </section>}

            {operation === 'member' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Member role recovery</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>Change one active membership role when org administration is unavailable.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitMemberRoleRecovery}>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <input className={inputClass} name='organizationId' placeholder='Organization ID' required />
                        <input className={inputClass} name='userId' placeholder='User ID' required />
                        <select className={inputClass} name='role' defaultValue='admin'>
                            <option value='admin'>Admin</option>
                            <option value='member'>Member</option>
                        </select>
                        <input className={inputClass} name='supportSessionId' placeholder='Support session ID' />
                        <input className={inputClass} name='idempotencyKey' placeholder='Idempotency key' />
                    </div>
                    <input className={inputClass} name='context' placeholder='Case context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Audit reason with requester and case' minLength={10} required />
                    <button className={primaryButton} disabled={submitting === 'member'} type='submit'>{submitting === 'member' ? 'Recovering...' : 'Recover member role'}</button>
                </form>
                <Message value={memberRoleMessage} tone={memberRoleResult?.error ? 'error' : memberRoleMessage ? 'success' : 'neutral'} />
                {memberRoleResult?.memberRoleRecovery ? (
                    <div className='grid gap-1 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                        <div className='font-semibold text-ui-text'>{memberRoleResult.memberRoleRecovery.outcome} · {memberRoleResult.memberRoleRecovery.member?.name || 'member'}</div>
                        <div>role {memberRoleResult.memberRoleRecovery.member?.role || memberRoleResult.memberRoleRecovery.requestedRole || 'updated'}</div>
                        <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(memberRoleResult.memberRoleRecovery.requestId, memberRoleResult.memberRoleRecovery.audit?.actionType)}>Open role audit</a>
                    </div>
                ) : null}
            </section>}

            {operation === 'apiUsage' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>API usage reset</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>Resets live API-key rate-limit buckets and records a warning audit event; durable quota/billing adjustments still belong in Rate Limits.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitApiUsageReset}>
                    <input className={inputClass} name='apiKeyId' placeholder='API key ID' required />
                    <textarea className={textAreaClass} name='reason' placeholder='Audit reason with customer approval and case' minLength={10} required />
                    <button className={primaryButton} disabled={submitting === 'apiUsage'} type='submit'>{submitting === 'apiUsage' ? 'Resetting...' : 'Reset API usage buckets'}</button>
                </form>
                <Link className='text-sm font-semibold text-ui-primary hover:opacity-80' href='/dashboard/system/rate-limits'>Open API keys and limit policy</Link>
                <Message value={apiUsageResetMessage} tone={apiUsageResetResult?.error ? 'error' : apiUsageResetMessage ? 'success' : 'neutral'} />
                {apiUsageResetResult?.reset ? (
                    <div className='rounded-md border border-ui-border bg-ui-canvas p-3 text-xs leading-5 text-ui-muted'>
                        <div className='font-semibold text-ui-text'>{apiUsageResetResult.reset.keyPrefix}</div>
                        <div>{apiUsageResetResult.reset.resetBucketCount} live buckets reset · audit {apiUsageResetResult.reset.auditAction}</div>
                    </div>
                ) : null}
            </section>}

            {operation === 'impersonation' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Scoped impersonation</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>Start or end a support session with a reason, target, duration, scope, and audit trail.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitImpersonation}>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <input className={inputClass} name='targetId' placeholder='Target user ID' required />
                        <input className={inputClass} name='organizationId' placeholder='Organization ID' />
                        <input className={inputClass} name='supportSessionId' placeholder='Support session ID' />
                        <select className={inputClass} name='durationMinutes' defaultValue='30' required>
                            <option value='15'>15 minutes</option>
                            <option value='30'>30 minutes</option>
                            <option value='60'>60 minutes</option>
                            <option value='120'>120 minutes</option>
                            <option value='240'>240 minutes</option>
                        </select>
                    </div>
                    <div className='flex flex-wrap gap-2 rounded-md border border-ui-border bg-ui-canvas p-2 text-xs text-ui-muted'>
                        {[
                            ['read_profile', 'Profile'],
                            ['read_org', 'Organization'],
                            ['support_debug', 'Debug'],
                        ].map(([value, label]) => (
                            <label className='inline-flex items-center gap-2 rounded-md bg-ui-panel px-2 py-1' key={value}>
                                <input className='accent-ui-primary' defaultChecked={value !== 'support_debug'} name='scope' type='checkbox' value={value} />
                                {label}
                            </label>
                        ))}
                    </div>
                    <textarea className={textAreaClass} name='reason' placeholder='Audit reason with support case or requester' minLength={10} required />
                    <button className={primaryButton} disabled={submitting === 'impersonation'} type='submit'>{submitting === 'impersonation' ? 'Starting...' : 'Start scoped session'}</button>
                </form>
                <details className='rounded-md border border-ui-border bg-ui-canvas'>
                    <summary className='cursor-pointer list-none px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/20'>End current session</summary>
                    <form className='grid gap-2 border-t border-ui-border p-3' onSubmit={stopImpersonation}>
                        <input className={inputClass} name='context' placeholder='Session close context' />
                        <textarea className={textAreaClass} name='reason' placeholder='Stop reason with support case or requester' minLength={10} required />
                        <button className={secondaryButton} disabled={submitting === 'stop'} type='submit'>{submitting === 'stop' ? 'Ending...' : 'End current session'}</button>
                    </form>
                </details>
                <Message value={impersonationMessage} tone={impersonationMessage.includes('failed') || impersonationResult?.error ? 'error' : 'success'} />
                {impersonationResult?.session ? (
                    <div className='rounded-md border border-ui-border bg-ui-canvas p-3 text-xs leading-5 text-ui-muted'>
                        <div className='font-semibold text-ui-text'>{impersonationResult.session.target?.name || impersonationResult.session.target?.id}</div>
                        <div>expires {impersonationResult.session.expires_at || 'active session'} · scope {(impersonationResult.session.scope || []).join(', ') || 'default'}</div>
                    </div>
                ) : null}
            </section>}

            {operation === 'recovery' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Access recovery</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>Generate a controlled recovery invite, then review its audit trail.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitRecovery}>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <input className={inputClass} name='organizationId' placeholder='Organization ID' required />
                        <input className={inputClass} name='email' placeholder='Recovery email' required type='email' />
                        <input className={inputClass} name='targetUserId' placeholder='Target user ID' />
                        <select className={inputClass} name='role' defaultValue='admin'>
                            <option value='admin'>Admin</option>
                            <option value='member'>Member</option>
                        </select>
                    </div>
                    <input className={inputClass} name='caseId' placeholder='Support case ID' />
                    <input className={inputClass} name='context' placeholder='Recovery context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Audit reason with support case or requester' minLength={10} required />
                    <label className='flex items-center gap-2 text-sm text-ui-muted'>
                        <input className='h-4 w-4 accent-ui-primary' name='approvalRequired' type='checkbox' />
                        Require second review
                    </label>
                    <button className={primaryButton} disabled={submitting === 'recovery'} type='submit'>{submitting === 'recovery' ? 'Generating...' : 'Generate recovery invite'}</button>
                </form>
                <Message value={recoveryMessage} tone={recoveryResult?.error ? 'error' : recoveryMessage ? 'success' : 'neutral'} />
                {recoveryResult?.recovery ? (
                    <div className='grid gap-2 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                        <div className='flex flex-wrap gap-2 font-medium text-ui-text'>
                            <span>Request {recoveryResult.recovery.requestId}</span>
                            <span>{recoveryResult.recovery.invite.email}</span>
                            <span>{recoveryResult.recovery.approvalStatus}</span>
                        </div>
                        <div>{recoveryResult.recovery.invite.role} until {recoveryResult.recovery.invite.expiresAt}</div>
                        <CopyBlock value={recoveryResult.recovery.copyText} />
                        <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(recoveryResult.recovery.requestId, recoveryResult.recovery.audit.actionType)}>Open audit trail</a>
                    </div>
                ) : null}
            </section>}

            {operation === 'decision' && <section className='grid gap-3'>
                <h3 className='text-sm font-semibold text-ui-text'>Recovery decision</h3>
                <form className='grid gap-2' onSubmit={submitDecision}>
                    <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]'>
                        <input className={inputClass} name='requestId' placeholder='Recovery request ID' required />
                        <select className={inputClass} name='action' defaultValue='approve'>
                            <option value='approve'>Approve</option>
                            <option value='deny'>Deny</option>
                        </select>
                    </div>
                    <input className={inputClass} name='context' placeholder='Review context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Approval or denial reason' minLength={10} required />
                    <button className={secondaryButton} disabled={submitting === 'decision'} type='submit'>{submitting === 'decision' ? 'Recording...' : 'Record decision'}</button>
                </form>
                <Message value={decisionMessage} tone={decisionResult?.error ? 'error' : decisionMessage ? 'success' : 'neutral'} />
                {decisionResult?.decision ? (
                    <div className='grid gap-2 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                        <div className='flex flex-wrap gap-2 font-medium text-ui-text'>
                            <span>{decisionResult.decision.status}</span>
                            <span>{decisionResult.decision.invite.email}</span>
                            <span>{decisionResult.decision.invite.status}</span>
                        </div>
                        <CopyBlock value={decisionResult.decision.copyText} />
                        <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(decisionResult.decision.requestId)}>Open decision audit</a>
                    </div>
                ) : null}
            </section>}

            {operation === 'queue' && <section className='grid gap-3'>
                <h3 className='text-sm font-semibold text-ui-text'>Recovery queue</h3>
                <form className='grid gap-2' onSubmit={submitSearch}>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <input className={inputClass} name='request' placeholder='Recovery request ID' />
                        <input className={inputClass} name='org' placeholder='Organization ID' />
                        <select className={inputClass} name='status' defaultValue=''>
                            <option value=''>Status</option>
                            <option value='pending_approval'>Pending</option>
                            <option value='approved'>Approved</option>
                            <option value='denied'>Denied</option>
                            <option value='not_required'>Not required</option>
                        </select>
                        <select className={inputClass} name='outcome' defaultValue=''>
                            <option value=''>Outcome</option>
                            <option value='success'>Success</option>
                            <option value='denied'>Denied</option>
                            <option value='failed'>Failed</option>
                        </select>
                        <input className={inputClass} name='requester' placeholder='Requester' />
                        <input className={inputClass} name='approver' placeholder='Approver or denier' />
                    </div>
                    <button className={secondaryButton} disabled={submitting === 'search'} type='submit'>{submitting === 'search' ? 'Searching...' : 'Search queue'}</button>
                </form>
                <Message value={searchMessage} />
                {searchResult?.approvals?.length ? (
                    <div className='grid gap-2'>
                        {searchResult.approvals.map(approval => (
                            <div className='grid gap-2 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted' key={approval.requestId}>
                                <div className='flex flex-wrap gap-2 font-medium text-ui-text'>
                                    <span>{approval.status}</span>
                                    <span>{approval.outcome}</span>
                                    <span>{approval.invite.email}</span>
                                </div>
                                <div className='text-xs'>request {approval.requestId} · audit {approval.auditEventIds?.join(', ') || 'pending'}</div>
                                <a className='text-sm font-semibold text-ui-primary hover:opacity-80' href={auditHref(approval.requestId)}>Open request audit</a>
                            </div>
                        ))}
                    </div>
                ) : searchResult ? (
                    <p className='rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>Recovery request filters are clear.</p>
                ) : null}
            </section>}
        </div>
    )
}
