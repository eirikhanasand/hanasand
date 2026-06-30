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

const inputClass = 'h-9 min-w-0 rounded-md border border-[#d8e0ec] bg-white px-3 text-sm text-[#171a21] outline-none transition placeholder:text-[#7b8494] focus:border-[#3056d3] focus:ring-2 focus:ring-[#3056d3]/15'
const textAreaClass = 'min-h-20 rounded-md border border-[#d8e0ec] bg-white px-3 py-2 text-sm text-[#171a21] outline-none transition placeholder:text-[#7b8494] focus:border-[#3056d3] focus:ring-2 focus:ring-[#3056d3]/15'
const primaryButton = 'h-9 rounded-md bg-[#3056d3] px-3 text-sm font-semibold text-white transition hover:bg-[#2848b5] disabled:cursor-not-allowed disabled:opacity-55'
const secondaryButton = 'h-9 rounded-md border border-[#ccd6e4] px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f6fc] disabled:cursor-not-allowed disabled:opacity-55'

function Message({ value, tone = 'neutral' }: { value: string, tone?: 'neutral' | 'error' | 'success' }) {
    if (!value) return null
    const toneClass = tone === 'error'
        ? 'border-[#fecdca] bg-[#fff1f0] text-[#b42318]'
        : tone === 'success'
            ? 'border-[#abefc6] bg-[#ecfdf3] text-[#067647]'
            : 'border-[#d8e0ec] bg-[#f8fafc] text-[#475467]'
    return <p className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>{value}</p>
}

function CopyBlock({ value }: { value?: string }) {
    if (!value) return null
    return <pre className='max-h-36 overflow-auto rounded-md border border-[#d8e0ec] bg-[#f8fafc] p-3 text-xs leading-5 text-[#344054]'>{value}</pre>
}

function auditHref(requestId: string, action?: string) {
    const query = new URLSearchParams({ request: requestId, source: 'admin', service: 'hanasand-api' })
    if (action) query.set('action', action)
    return `/dashboard/system/impersonation?${query.toString()}`
}

export default function AccessRecoveryForm() {
    const [recoveryResult, setRecoveryResult] = useState<RecoveryPayload | null>(null)
    const [decisionResult, setDecisionResult] = useState<DecisionPayload | null>(null)
    const [searchResult, setSearchResult] = useState<ApprovalSearchPayload | null>(null)
    const [impersonationResult, setImpersonationResult] = useState<ImpersonationPayload | null>(null)
    const [recoveryMessage, setRecoveryMessage] = useState('')
    const [decisionMessage, setDecisionMessage] = useState('')
    const [searchMessage, setSearchMessage] = useState('')
    const [impersonationMessage, setImpersonationMessage] = useState('')
    const [submitting, setSubmitting] = useState('')

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
            <section className='grid gap-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Scoped impersonation</h3>
                    <p className='mt-1 text-xs leading-5 text-[#667085]'>Start or end a support session with a reason, target, duration, scope, and audit trail.</p>
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
                    <div className='flex flex-wrap gap-2 rounded-md border border-[#d8e0ec] bg-[#f8fafc] p-2 text-xs text-[#475467]'>
                        {[
                            ['read_profile', 'Profile'],
                            ['read_org', 'Organization'],
                            ['support_debug', 'Debug'],
                        ].map(([value, label]) => (
                            <label className='inline-flex items-center gap-2 rounded-md bg-white px-2 py-1' key={value}>
                                <input className='accent-[#3056d3]' defaultChecked={value !== 'support_debug'} name='scope' type='checkbox' value={value} />
                                {label}
                            </label>
                        ))}
                    </div>
                    <textarea className={textAreaClass} name='reason' placeholder='Reason' required />
                    <button className={primaryButton} disabled={submitting === 'impersonation'} type='submit'>{submitting === 'impersonation' ? 'Starting...' : 'Start scoped session'}</button>
                </form>
                <form className='grid gap-2 border-t border-[#e7edf5] pt-3' onSubmit={stopImpersonation}>
                    <input className={inputClass} name='context' placeholder='Stop context' />
                    <textarea className={textAreaClass} name='reason' placeholder='Stop reason' required />
                    <button className={secondaryButton} disabled={submitting === 'stop'} type='submit'>{submitting === 'stop' ? 'Ending...' : 'End current session'}</button>
                </form>
                <Message value={impersonationMessage} tone={impersonationMessage.includes('failed') || impersonationResult?.error ? 'error' : 'success'} />
                {impersonationResult?.session ? (
                    <div className='rounded-md border border-[#d8e0ec] bg-[#f8fafc] p-3 text-xs leading-5 text-[#475467]'>
                        <div className='font-semibold text-[#171a21]'>{impersonationResult.session.target?.name || impersonationResult.session.target?.id}</div>
                        <div>expires {impersonationResult.session.expires_at || 'unknown'} · scope {(impersonationResult.session.scope || []).join(', ') || 'none'}</div>
                    </div>
                ) : null}
            </section>

            <section className='grid gap-3 border-t border-[#e7edf5] pt-4'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Access recovery</h3>
                    <p className='mt-1 text-xs leading-5 text-[#667085]'>Generate a controlled recovery invite, then review its audit trail.</p>
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
                    <label className='flex items-center gap-2 text-sm text-[#475467]'>
                        <input className='h-4 w-4 accent-[#3056d3]' name='approvalRequired' type='checkbox' />
                        Require second review
                    </label>
                    <button className={primaryButton} disabled={submitting === 'recovery'} type='submit'>{submitting === 'recovery' ? 'Generating...' : 'Generate recovery invite'}</button>
                </form>
                <Message value={recoveryMessage} tone={recoveryResult?.error ? 'error' : recoveryMessage ? 'success' : 'neutral'} />
                {recoveryResult?.recovery ? (
                    <div className='grid gap-2 rounded-md border border-[#d8e0ec] bg-[#f8fafc] p-3 text-sm text-[#475467]'>
                        <div className='flex flex-wrap gap-2 font-medium text-[#171a21]'>
                            <span>Request {recoveryResult.recovery.requestId}</span>
                            <span>{recoveryResult.recovery.invite.email}</span>
                            <span>{recoveryResult.recovery.approvalStatus}</span>
                        </div>
                        <div>{recoveryResult.recovery.invite.role} until {recoveryResult.recovery.invite.expiresAt}</div>
                        <CopyBlock value={recoveryResult.recovery.copyText} />
                        <a className='text-sm font-semibold text-[#3056d3] hover:text-[#2848b5]' href={auditHref(recoveryResult.recovery.requestId, recoveryResult.recovery.audit.actionType)}>Open audit trail</a>
                    </div>
                ) : null}
            </section>

            <section className='grid gap-3 border-t border-[#e7edf5] pt-4'>
                <h3 className='text-sm font-semibold text-[#171a21]'>Recovery decision</h3>
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
                    <div className='grid gap-2 rounded-md border border-[#d8e0ec] bg-[#f8fafc] p-3 text-sm text-[#475467]'>
                        <div className='flex flex-wrap gap-2 font-medium text-[#171a21]'>
                            <span>{decisionResult.decision.status}</span>
                            <span>{decisionResult.decision.invite.email}</span>
                            <span>{decisionResult.decision.invite.status}</span>
                        </div>
                        <CopyBlock value={decisionResult.decision.copyText} />
                        <a className='text-sm font-semibold text-[#3056d3] hover:text-[#2848b5]' href={auditHref(decisionResult.decision.requestId)}>Open decision audit</a>
                    </div>
                ) : null}
            </section>

            <section className='grid gap-3 border-t border-[#e7edf5] pt-4'>
                <h3 className='text-sm font-semibold text-[#171a21]'>Recovery queue</h3>
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
                            <div className='grid gap-2 rounded-md border border-[#d8e0ec] bg-[#f8fafc] p-3 text-sm text-[#475467]' key={approval.requestId}>
                                <div className='flex flex-wrap gap-2 font-medium text-[#171a21]'>
                                    <span>{approval.status}</span>
                                    <span>{approval.outcome}</span>
                                    <span>{approval.invite.email}</span>
                                </div>
                                <div className='text-xs'>request {approval.requestId} · audit {approval.auditEventIds?.join(', ') || 'pending'}</div>
                                <a className='text-sm font-semibold text-[#3056d3] hover:text-[#2848b5]' href={auditHref(approval.requestId)}>Open request audit</a>
                            </div>
                        ))}
                    </div>
                ) : searchResult ? (
                    <p className='rounded-md border border-[#d8e0ec] bg-[#f8fafc] p-3 text-sm text-[#667085]'>No recovery requests matched those filters.</p>
                ) : null}
            </section>
        </div>
    )
}
