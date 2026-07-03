'use client'

import { FormEvent, useState } from 'react'

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

type SupportOperation = 'inspect' | 'impersonation' | 'recovery' | 'decision' | 'queue'
type InspectionUserMember = NonNullable<InspectionPayload['members']>[number]
type InspectionOrganizationMembership = NonNullable<InspectionPayload['memberships']>[number]
type InspectionMember = InspectionUserMember | InspectionOrganizationMembership

const inputClass = 'h-9 min-w-0 rounded-md border border-[#27364f] bg-[#101827] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#7b8494] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
const textAreaClass = 'min-h-20 rounded-md border border-[#27364f] bg-[#101827] px-3 py-2 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#7b8494] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
const primaryButton = 'h-9 rounded-md bg-[#315bd8] px-3 text-sm font-semibold text-white transition hover:bg-[#244bbf] disabled:cursor-not-allowed disabled:opacity-55'
const secondaryButton = 'h-9 rounded-md border border-[#31466b] bg-[#111827] px-3 text-sm font-semibold text-[#dbe7ff] transition hover:bg-[#172033] disabled:cursor-not-allowed disabled:opacity-55'
const operationTabs: Array<{ id: SupportOperation, label: string, detail: string }> = [
    { id: 'inspect', label: 'Inspect', detail: 'Members, invites, audit' },
    { id: 'impersonation', label: 'Session', detail: 'Start or end scoped access' },
    { id: 'recovery', label: 'Recovery', detail: 'Generate an invite' },
    { id: 'decision', label: 'Review', detail: 'Approve or deny' },
    { id: 'queue', label: 'Queue', detail: 'Find recovery requests' },
]

function Message({ value, tone = 'neutral' }: { value: string, tone?: 'neutral' | 'error' | 'success' }) {
    if (!value) return null
    const toneClass = tone === 'error'
        ? 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]'
        : tone === 'success'
            ? 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]'
            : 'border-[#27364f] bg-[#0b121e] text-[#aab7cc]'
    return <p className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>{value}</p>
}

function CopyBlock({ value }: { value?: string }) {
    if (!value) return null
    return <pre className='max-h-36 overflow-auto rounded-md border border-[#27364f] bg-[#0b121e] p-3 text-xs leading-5 text-[#dbe7ff]'>{value}</pre>
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
            className={`rounded-md border px-3 py-2 text-left transition ${active ? 'border-[#b8c5ff] bg-[#122449] text-[#9db8ff]' : 'border-[#26344d] bg-[#0b121e] text-[#aab7cc] hover:bg-[#162033]'}`}
            onClick={onClick}
        >
            <span className='block text-sm font-semibold'>{label}</span>
            <span className='mt-0.5 block text-xs text-[#8fa0ba]'>{detail}</span>
        </button>
    )
}

function auditHref(requestId: string, action?: string) {
    const query = new URLSearchParams({ request: requestId, source: 'admin', service: 'hanasand-api' })
    if (action) query.set('action', action)
    return `/dashboard/system/impersonation?${query.toString()}`
}

export default function AccessRecoveryForm() {
    const [operation, setOperation] = useState<SupportOperation>('inspect')
    const [inspectionResult, setInspectionResult] = useState<InspectionPayload | null>(null)
    const [recoveryResult, setRecoveryResult] = useState<RecoveryPayload | null>(null)
    const [decisionResult, setDecisionResult] = useState<DecisionPayload | null>(null)
    const [searchResult, setSearchResult] = useState<ApprovalSearchPayload | null>(null)
    const [impersonationResult, setImpersonationResult] = useState<ImpersonationPayload | null>(null)
    const [recoveryMessage, setRecoveryMessage] = useState('')
    const [decisionMessage, setDecisionMessage] = useState('')
    const [searchMessage, setSearchMessage] = useState('')
    const [impersonationMessage, setImpersonationMessage] = useState('')
    const [inspectionMessage, setInspectionMessage] = useState('')
    const [submitting, setSubmitting] = useState('')

    async function submitInspection(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const targetType = String(form.get('targetType') || 'organization')
        const targetId = String(form.get('targetId') || '').trim()
        const reason = String(form.get('reason') || '').trim()
        const context = String(form.get('context') || '').trim()
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

    async function submitRecovery(event: FormEvent<HTMLFormElement>) {
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

    async function submitDecision(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const requestId = String(form.get('requestId') || '').trim()
        const action = String(form.get('action') || 'approve') === 'deny' ? 'deny' : 'approve'
        const payload = {
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
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

    async function submitSearch(event: FormEvent<HTMLFormElement>) {
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

    async function submitImpersonation(event: FormEvent<HTMLFormElement>) {
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

    async function stopImpersonation(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        setSubmitting('stop')
        setImpersonationMessage('')
        try {
            const response = await fetch('/api/impersonation', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: String(form.get('reason') || '').trim(),
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
            <div className='grid gap-2 sm:grid-cols-2' role='group' aria-label='Support operation'>
                {operationTabs.map(tab => (
                    <OperationTab
                        key={tab.id}
                        active={operation === tab.id}
                        label={tab.label}
                        detail={tab.detail}
                        onClick={() => setOperation(tab.id)}
                    />
                ))}
            </div>

            {operation === 'inspect' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Support inspection</h3>
                    <p className='mt-1 text-xs leading-5 text-[#8fa0ba]'>Load organization or user state before recovery, role changes, or impersonation.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitInspection}>
                    <div className='grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]'>
                        <select className={inputClass} name='targetType' defaultValue='organization'>
                            <option value='organization'>Org</option>
                            <option value='user'>User</option>
                        </select>
                        <input className={inputClass} name='targetId' placeholder='Organization or user id' required />
                    </div>
                    <input className={inputClass} name='context' placeholder='Case or customer context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Reason' required />
                    <button className={primaryButton} disabled={submitting === 'inspect'} type='submit'>{submitting === 'inspect' ? 'Inspecting...' : 'Inspect access'}</button>
                </form>
                <Message value={inspectionMessage} tone={inspectionResult?.error ? 'error' : inspectionMessage ? 'success' : 'neutral'} />
                {inspectionResult && !inspectionResult.error ? (
                    <div className='grid gap-3 rounded-md border border-[#27364f] bg-[#0b121e] p-3 text-sm text-[#aab7cc]'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='font-semibold text-[#edf4ff]'>{inspectionResult.organization?.name || inspectionResult.user?.name || inspectionResult.organization?.id || inspectionResult.user?.id || 'Inspection'}</span>
                            {inspectionResult.accessStatus?.overall ? <span className='rounded-md bg-[#122449] px-2 py-1 text-xs text-[#9db8ff]'>{inspectionResult.accessStatus.overall}</span> : null}
                        </div>
                        <div className='grid grid-cols-2 gap-2 text-xs sm:grid-cols-4'>
                            <span className='rounded-md bg-[#101827] px-2 py-1'>members {(inspectionResult.members || inspectionResult.memberships || []).length}</span>
                            <span className='rounded-md bg-[#101827] px-2 py-1'>invites {(inspectionResult.invites || inspectionResult.pendingInvites || []).length}</span>
                            <span className='rounded-md bg-[#101827] px-2 py-1'>watchlists {(inspectionResult.watchlistItems || []).length}</span>
                            <span className='rounded-md bg-[#101827] px-2 py-1'>webhooks {(inspectionResult.webhookDestinations || []).length}</span>
                        </div>
                        {(inspectionResult.members || inspectionResult.memberships || []).length ? (
                            <div className='grid gap-1'>
                                <div className='text-xs font-semibold uppercase tracking-[0.14em] text-[#8fa0ba]'>Roles</div>
                                {(inspectionResult.members || inspectionResult.memberships || []).slice(0, 6).map((member, index) => (
                                    <div className='grid gap-1 rounded-md bg-[#101827] px-2 py-1 text-xs sm:grid-cols-[minmax(0,1fr)_5rem_5rem]' key={inspectionMemberId(member, index)}>
                                        <span className='truncate'>{inspectionMemberName(member)}</span>
                                        <span>{member.role || 'role'}</span>
                                        <span>{member.status || 'status'}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {(inspectionResult.invites || inspectionResult.pendingInvites || []).length ? (
                            <div className='grid gap-1'>
                                <div className='text-xs font-semibold uppercase tracking-[0.14em] text-[#8fa0ba]'>Invites</div>
                                {(inspectionResult.invites || inspectionResult.pendingInvites || []).slice(0, 6).map((invite, index) => (
                                    <div className='grid gap-1 rounded-md bg-[#101827] px-2 py-1 text-xs sm:grid-cols-[minmax(0,1fr)_5rem_6rem]' key={`${invite.id || invite.email || index}`}>
                                        <span className='truncate'>{invite.email || invite.id}</span>
                                        <span>{invite.role || 'role'}</span>
                                        <span>{invite.status || 'status'}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {(inspectionResult.recentAuditEvents || []).length ? (
                            <div className='grid gap-1'>
                                <div className='text-xs font-semibold uppercase tracking-[0.14em] text-[#8fa0ba]'>Recent audit</div>
                                {(inspectionResult.recentAuditEvents || []).slice(0, 4).map((event, index) => (
                                    <a className='grid gap-1 rounded-md bg-[#101827] px-2 py-1 text-xs text-[#dbe7ff] hover:bg-[#162033]' href={event.id ? `/dashboard/system/impersonation?entity=${encodeURIComponent(String(event.id))}` : '/dashboard/system/impersonation'} key={`${event.id || index}`}>
                                        <span>{event.actionType || event.action_type || 'audit event'} · {event.outcome || 'outcome'}</span>
                                        {event.reason ? <span className='truncate text-[#8fa0ba]'>{event.reason}</span> : null}
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </section>}

            {operation === 'impersonation' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Scoped impersonation</h3>
                    <p className='mt-1 text-xs leading-5 text-[#8fa0ba]'>Start or end a support session with a reason, target, duration, scope, and audit trail.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitImpersonation}>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <input className={inputClass} name='targetId' placeholder='Target user id' required />
                        <input className={inputClass} name='organizationId' placeholder='Organization id' />
                        <input className={inputClass} name='supportSessionId' placeholder='Support session id' />
                        <select className={inputClass} name='durationMinutes' defaultValue='30' required>
                            <option value='15'>15 minutes</option>
                            <option value='30'>30 minutes</option>
                            <option value='60'>60 minutes</option>
                            <option value='120'>120 minutes</option>
                            <option value='240'>240 minutes</option>
                        </select>
                    </div>
                    <div className='flex flex-wrap gap-2 rounded-md border border-[#27364f] bg-[#0b121e] p-2 text-xs text-[#aab7cc]'>
                        {[
                            ['read_profile', 'Profile'],
                            ['read_org', 'Organization'],
                            ['support_debug', 'Debug'],
                        ].map(([value, label]) => (
                            <label className='inline-flex items-center gap-2 rounded-md bg-[#101827] px-2 py-1' key={value}>
                                <input className='accent-[#7aa5ff]' defaultChecked={value !== 'support_debug'} name='scope' type='checkbox' value={value} />
                                {label}
                            </label>
                        ))}
                    </div>
                    <textarea className={textAreaClass} name='reason' placeholder='Reason' required />
                    <button className={primaryButton} disabled={submitting === 'impersonation'} type='submit'>{submitting === 'impersonation' ? 'Starting...' : 'Start scoped session'}</button>
                </form>
                <details className='rounded-md border border-[#26344d] bg-[#0b121e]'>
                    <summary className='cursor-pointer list-none px-3 py-2 text-sm font-semibold text-[#dbe7ff] outline-none transition hover:bg-[#162033] focus-visible:ring-2 focus-visible:ring-[#1f3f7a]'>End current session</summary>
                    <form className='grid gap-2 border-t border-[#26344d] p-3' onSubmit={stopImpersonation}>
                        <input className={inputClass} name='context' placeholder='Stop context' />
                        <textarea className={textAreaClass} name='reason' placeholder='Stop reason' required />
                        <button className={secondaryButton} disabled={submitting === 'stop'} type='submit'>{submitting === 'stop' ? 'Ending...' : 'End current session'}</button>
                    </form>
                </details>
                <Message value={impersonationMessage} tone={impersonationMessage.includes('failed') || impersonationResult?.error ? 'error' : 'success'} />
                {impersonationResult?.session ? (
                    <div className='rounded-md border border-[#27364f] bg-[#0b121e] p-3 text-xs leading-5 text-[#aab7cc]'>
                        <div className='font-semibold text-[#edf4ff]'>{impersonationResult.session.target?.name || impersonationResult.session.target?.id}</div>
                        <div>expires {impersonationResult.session.expires_at || 'active session'} · scope {(impersonationResult.session.scope || []).join(', ') || 'default'}</div>
                    </div>
                ) : null}
            </section>}

            {operation === 'recovery' && <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Access recovery</h3>
                    <p className='mt-1 text-xs leading-5 text-[#8fa0ba]'>Generate a controlled recovery invite, then review its audit trail.</p>
                </div>
                <form className='grid gap-2' onSubmit={submitRecovery}>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <input className={inputClass} name='organizationId' placeholder='Organization id' required />
                        <input className={inputClass} name='email' placeholder='Recovery email' required type='email' />
                        <input className={inputClass} name='targetUserId' placeholder='User id' />
                        <select className={inputClass} name='role' defaultValue='admin'>
                            <option value='admin'>Admin</option>
                            <option value='member'>Member</option>
                        </select>
                    </div>
                    <input className={inputClass} name='caseId' placeholder='Case id' />
                    <input className={inputClass} name='context' placeholder='Context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Reason' required />
                    <label className='flex items-center gap-2 text-sm text-[#aab7cc]'>
                        <input className='h-4 w-4 accent-[#7aa5ff]' name='approvalRequired' type='checkbox' />
                        Require second review
                    </label>
                    <button className={primaryButton} disabled={submitting === 'recovery'} type='submit'>{submitting === 'recovery' ? 'Generating...' : 'Generate recovery invite'}</button>
                </form>
                <Message value={recoveryMessage} tone={recoveryResult?.error ? 'error' : recoveryMessage ? 'success' : 'neutral'} />
                {recoveryResult?.recovery ? (
                    <div className='grid gap-2 rounded-md border border-[#27364f] bg-[#0b121e] p-3 text-sm text-[#aab7cc]'>
                        <div className='flex flex-wrap gap-2 font-medium text-[#edf4ff]'>
                            <span>Request {recoveryResult.recovery.requestId}</span>
                            <span>{recoveryResult.recovery.invite.email}</span>
                            <span>{recoveryResult.recovery.approvalStatus}</span>
                        </div>
                        <div>{recoveryResult.recovery.invite.role} until {recoveryResult.recovery.invite.expiresAt}</div>
                        <CopyBlock value={recoveryResult.recovery.copyText} />
                        <a className='text-sm font-semibold text-[#9db8ff] hover:text-[#2848b5]' href={auditHref(recoveryResult.recovery.requestId, recoveryResult.recovery.audit.actionType)}>Open audit trail</a>
                    </div>
                ) : null}
            </section>}

            {operation === 'decision' && <section className='grid gap-3'>
                <h3 className='text-sm font-semibold text-[#edf4ff]'>Recovery decision</h3>
                <form className='grid gap-2' onSubmit={submitDecision}>
                    <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]'>
                        <input className={inputClass} name='requestId' placeholder='Recovery request id' required />
                        <select className={inputClass} name='action' defaultValue='approve'>
                            <option value='approve'>Approve</option>
                            <option value='deny'>Deny</option>
                        </select>
                    </div>
                    <input className={inputClass} name='context' placeholder='Decision context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Approval or denial reason' required />
                    <button className={secondaryButton} disabled={submitting === 'decision'} type='submit'>{submitting === 'decision' ? 'Recording...' : 'Record decision'}</button>
                </form>
                <Message value={decisionMessage} tone={decisionResult?.error ? 'error' : decisionMessage ? 'success' : 'neutral'} />
                {decisionResult?.decision ? (
                    <div className='grid gap-2 rounded-md border border-[#27364f] bg-[#0b121e] p-3 text-sm text-[#aab7cc]'>
                        <div className='flex flex-wrap gap-2 font-medium text-[#edf4ff]'>
                            <span>{decisionResult.decision.status}</span>
                            <span>{decisionResult.decision.invite.email}</span>
                            <span>{decisionResult.decision.invite.status}</span>
                        </div>
                        <CopyBlock value={decisionResult.decision.copyText} />
                        <a className='text-sm font-semibold text-[#9db8ff] hover:text-[#2848b5]' href={auditHref(decisionResult.decision.requestId)}>Open decision audit</a>
                    </div>
                ) : null}
            </section>}

            {operation === 'queue' && <section className='grid gap-3'>
                <h3 className='text-sm font-semibold text-[#edf4ff]'>Recovery queue</h3>
                <form className='grid gap-2' onSubmit={submitSearch}>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <input className={inputClass} name='request' placeholder='Request id' />
                        <input className={inputClass} name='org' placeholder='Organization id' />
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
                            <div className='grid gap-2 rounded-md border border-[#27364f] bg-[#0b121e] p-3 text-sm text-[#aab7cc]' key={approval.requestId}>
                                <div className='flex flex-wrap gap-2 font-medium text-[#edf4ff]'>
                                    <span>{approval.status}</span>
                                    <span>{approval.outcome}</span>
                                    <span>{approval.invite.email}</span>
                                </div>
                                <div className='text-xs'>request {approval.requestId} · audit {approval.auditEventIds?.join(', ') || 'pending'}</div>
                                <a className='text-sm font-semibold text-[#9db8ff] hover:text-[#2848b5]' href={auditHref(approval.requestId)}>Open request audit</a>
                            </div>
                        ))}
                    </div>
                ) : searchResult ? (
                    <p className='rounded-md border border-[#27364f] bg-[#0b121e] p-3 text-sm text-[#8fa0ba]'>Recovery request filters are clear.</p>
                ) : null}
            </section>}
        </div>
    )
}
