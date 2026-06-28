'use client'

import { FormEvent, useState } from 'react'

type RecoveryPayload = {
    recovery?: {
        schemaVersion: string
        targetUserId: string | null
        requestId: string
        reason: string
        requestedBy: string
        approvalRequired: boolean
        approvalStatus: string
        approvedBy: string | null
        approvedAt: string | null
        approval?: {
            schemaVersion: string
            requestedBy: string
            approvalRequired: boolean
            status: string
            approvedBy: string | null
            approvedAt: string | null
            expiresAt: string
            requestId: string
            outcome: string
            context: string
            reason: string
        }
        invite: {
            id: string
            email: string
            role: string
            expiresAt: string
        }
        audit: {
            query: string
            actionType: string
            severity: string
            outcome: string
        }
        copyText: string
    }
    error?: string
}

type DecisionPayload = {
    decision?: {
        schemaVersion: string
        requestId: string
        organizationId: string
        inviteId: string
        requestedBy: string
        approvalRequired: boolean
        status: string
        approvedBy: string | null
        approvedAt: string | null
        deniedBy: string | null
        deniedAt: string | null
        decisionReason: string | null
        outcome: string
        invite: {
            id: string
            email: string
            role: string
            status: string
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

const inputClass = 'h-10 rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-bright outline-none focus:border-[#f07d33]/55'
const textAreaClass = 'min-h-20 rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-[#f07d33]/55'

export default function AccessRecoveryForm() {
    const [result, setResult] = useState<RecoveryPayload | null>(null)
    const [decisionResult, setDecisionResult] = useState<DecisionPayload | null>(null)
    const [message, setMessage] = useState('')
    const [decisionMessage, setDecisionMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [decisionSubmitting, setDecisionSubmitting] = useState(false)

    async function submit(event: FormEvent<HTMLFormElement>) {
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

        setSubmitting(true)
        setMessage('')
        setResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as RecoveryPayload
            if (!response.ok) {
                setMessage(body.error || 'Access recovery failed.')
                return
            }
            setResult(body)
            setMessage('Recovery invite generated.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Access recovery failed.')
        } finally {
            setSubmitting(false)
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

        setDecisionSubmitting(true)
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
            setDecisionSubmitting(false)
        }
    }

    return (
        <div className='grid gap-5'>
            <form className='grid gap-3' onSubmit={submit}>
                <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem]'>
                    <input className={inputClass} name='organizationId' placeholder='Organization id' required />
                    <input className={inputClass} name='email' placeholder='Recovery email' required type='email' />
                    <input className={inputClass} name='targetUserId' placeholder='User id' />
                    <select className={inputClass} name='role' defaultValue='admin'>
                        <option value='admin'>admin</option>
                        <option value='member'>member</option>
                    </select>
                </div>
                <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                    <input className={inputClass} name='caseId' placeholder='Case id' />
                    <input className={inputClass} name='context' placeholder='Context' />
                </div>
                <textarea className={textAreaClass} name='reason' placeholder='Reason' required />
                <label className='flex items-center gap-2 text-sm text-bright/62'>
                    <input className='h-4 w-4 accent-[#f07d33]' name='approvalRequired' type='checkbox' />
                    Require second review before sharing this recovery invite
                </label>
                <div className='flex flex-wrap items-center gap-3'>
                    <button className='h-10 rounded-lg bg-[#f07d33] px-4 text-sm font-semibold text-black transition hover:bg-[#ff944d] disabled:cursor-not-allowed disabled:opacity-55' disabled={submitting} type='submit'>
                        {submitting ? 'Generating...' : 'Generate recovery invite'}
                    </button>
                    {message ? <p className='text-sm text-bright/58'>{message}</p> : null}
                </div>
                {result?.recovery ? (
                    <div className='grid gap-3 border-t border-white/8 pt-3'>
                        <div className='grid gap-2 text-sm text-bright/72 md:grid-cols-3'>
                            <span>Request {result.recovery.requestId}</span>
                            <span>{result.recovery.invite.email}</span>
                            <span>{result.recovery.approvalStatus}</span>
                        </div>
                        <div className='text-sm text-bright/58'>
                            {result.recovery.invite.role} until {result.recovery.invite.expiresAt}
                            {result.recovery.approval?.reason ? ` · ${result.recovery.approval.reason}` : ''}
                        </div>
                        <textarea className={textAreaClass} readOnly value={result.recovery.copyText} />
                        <a className='text-sm font-semibold text-[#f07d33] hover:text-[#ff944d]' href={`/dashboard/system/impersonation?request=${encodeURIComponent(result.recovery.requestId)}&action=${encodeURIComponent(result.recovery.audit.actionType)}&source=admin&service=hanasand-api`}>
                            Open audit trail
                        </a>
                    </div>
                ) : null}
            </form>

            <form className='grid gap-3 border-t border-white/8 pt-4' onSubmit={submitDecision}>
                <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem]'>
                    <input className={inputClass} name='requestId' placeholder='Recovery request id' required />
                    <select className={inputClass} name='action' defaultValue='approve'>
                        <option value='approve'>approve</option>
                        <option value='deny'>deny</option>
                    </select>
                </div>
                <input className={inputClass} name='context' placeholder='Decision context' />
                <textarea className={textAreaClass} name='reason' placeholder='Approval or denial reason' required />
                <div className='flex flex-wrap items-center gap-3'>
                    <button className='h-10 rounded-lg bg-[#f07d33] px-4 text-sm font-semibold text-black transition hover:bg-[#ff944d] disabled:cursor-not-allowed disabled:opacity-55' disabled={decisionSubmitting} type='submit'>
                        {decisionSubmitting ? 'Recording...' : 'Record decision'}
                    </button>
                    {decisionMessage ? <p className='text-sm text-bright/58'>{decisionMessage}</p> : null}
                </div>
                {decisionResult?.decision ? (
                    <div className='grid gap-3 border-t border-white/8 pt-3'>
                        <div className='grid gap-2 text-sm text-bright/72 md:grid-cols-3'>
                            <span>{decisionResult.decision.status}</span>
                            <span>{decisionResult.decision.invite.email}</span>
                            <span>{decisionResult.decision.invite.status}</span>
                        </div>
                        <textarea className={textAreaClass} readOnly value={decisionResult.decision.copyText} />
                        <a className='text-sm font-semibold text-[#f07d33] hover:text-[#ff944d]' href={`/dashboard/system/impersonation?request=${encodeURIComponent(decisionResult.decision.requestId)}&source=admin&service=hanasand-api`}>
                            Open decision audit
                        </a>
                    </div>
                ) : null}
            </form>
        </div>
    )
}
