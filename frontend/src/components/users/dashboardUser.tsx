'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import DeleteAccountButton from './deleteAccountButton'
import AccountDate from './accountDate'
import deleteUser from '@/utils/users/deleteUser'
import { startImpersonating } from '@/utils/impersonation/client'
import setUserActive from '@/utils/users/setUserActive'
import { Ban, CheckCircle2, Crown, MoreHorizontal, Pencil, UserRound, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import ErrorNotice from '../error/errorNotice'
import UserRoleHandler from '../roles/userRoleHandler'

export default function DashboardUser({ user, roles }: { user: UserWithRole, roles: Role[] }) {
    const { condition: deleted, setCondition: setDeleted } = useClearStateAfter()
    const [displayRoles, setDisplayRoles] = useState(false)
    const router = useRouter()
    const actions = useRef<HTMLDivElement>(null)
    const actionsId = useId()
    const [actionsOpen, setActionsOpen] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [impersonationPending, setImpersonationPending] = useState(false)
    const [impersonationPromptOpen, setImpersonationPromptOpen] = useState(false)
    const [impersonationReason, setImpersonationReason] = useState('')
    const [impersonationReasonError, setImpersonationReasonError] = useState('')

    async function handleRoles(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        actions.current?.hidePopover()
        setDisplayRoles(!displayRoles)
    }

    async function handleActive(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        actions.current?.hidePopover()
        const result = await setUserActive(user.id, user.active === false)
        if (result.status === 200) {
            router.refresh()
        } else {
            setError(result.message || 'Unable to update user.')
        }
    }

    async function handleImpersonate(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        actions.current?.hidePopover()
        setImpersonationPromptOpen(true)
        setImpersonationReasonError('')
    }

    async function handleCancelImpersonation(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        setImpersonationPromptOpen(false)
        setImpersonationReason('')
        setImpersonationReasonError('')
    }

    async function handleConfirmImpersonation(e: React.SyntheticEvent<HTMLFormElement>) {
        e.stopPropagation()
        e.preventDefault()
        const auditReason = impersonationReason.trim().replace(/\s+/g, ' ')
        if (auditReason.length < 10) {
            setImpersonationReasonError('Enter at least 10 characters so the audit trail explains why this session is needed.')
            return
        }
        setImpersonationPending(true)
        setImpersonationReasonError('')
        try {
            await startImpersonating(user.id, auditReason)
            setImpersonationPromptOpen(false)
            setImpersonationReason('')
            router.refresh()
        } catch (error) {
            setImpersonationReasonError(error instanceof Error ? error.message : 'Unable to start impersonation.')
        } finally {
            setImpersonationPending(false)
        }
    }

    async function handleDelete() {
        const result = await deleteUser(user.id)
        if (result.status !== 200) throw new Error(result.message)
        setDeleted(true)
        router.refresh()
    }

    const reasonLength = impersonationReason.trim().replace(/\s+/g, ' ').length

    return (
        <div className='group relative h-10 min-h-10 max-h-10'>
            <div onClick={() => router.push(`/profile/${encodeURIComponent(user.id)}`)} className={'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_100px_40px] items-center gap-3 rounded-lg py-2 hover:bg-ui-raised cursor-pointer'}>
                <h1 className={`min-w-0 truncate ${user.active === false ? 'text-ui-muted line-through' : ''}`} key={user.id}>{user.name}{user.highest_role_priority === 0 && <Crown aria-label='Administrator' className='ml-2 inline h-4 w-4 stroke-ui-warning' />}</h1>
                <span className={`min-w-0 truncate text-sm text-ui-muted ${user.active === false ? 'line-through' : ''}`}>{user.username || user.id}</span>
                <span className='text-xs text-ui-muted'><AccountDate value={user.created_at} /></span>
                <span className='text-xs text-ui-muted'><AccountDate value={user.last_login_at} empty='Never recorded' /></span>
                <button
                    type='button'
                    aria-label={`Actions for ${user.id}`}
                    aria-expanded={actionsOpen}
                    popoverTarget={actionsId}
                    onClick={(event) => {
                        event.stopPropagation()
                        const rect = event.currentTarget.getBoundingClientRect()
                        if (actions.current) {
                            actions.current.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 200))}px`
                            actions.current.style.left = `${Math.max(8, rect.right - 208)}px`
                        }
                    }}
                    className='grid h-9 w-9 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100'
                ><MoreHorizontal className='h-5 w-5' /></button>
                <div ref={actions} id={actionsId} popover='auto' aria-label={`Actions for ${user.id}`}
                    onToggle={event => setActionsOpen(event.newState === 'open')}
                    onClick={event => event.stopPropagation()}
                    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }}
                    className='fixed m-0 w-52 rounded-lg border border-ui-border bg-ui-panel p-1 text-sm text-ui-text shadow-xl'>
                    <button type='button' autoFocus onClick={handleImpersonate} disabled={impersonationPending}
                        aria-label={`Impersonate ${user.id}`} className='flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-ui-raised'>
                        <UserRound className='h-4 w-4' />{impersonationPending ? 'Checking' : 'Impersonate'}
                    </button>
                    <button type='button' onClick={handleRoles} aria-label={`${displayRoles ? 'Cancel role editing' : 'Edit roles'} for ${user.id}`}
                        className='flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-ui-raised'>
                        {displayRoles ? <X className='h-4 w-4' /> : <Pencil className='h-4 w-4' />}{displayRoles ? 'Cancel role editing' : 'Edit roles'}
                    </button>
                    <button type='button' onClick={handleActive} aria-label={`${user.active === false ? 'Activate' : 'Deactivate'} ${user.id}`}
                        className='flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-ui-raised'>
                        {user.active === false ? <CheckCircle2 className='h-4 w-4' /> : <Ban className='h-4 w-4' />}{user.active === false ? 'Activate' : 'Deactivate'}
                    </button>
                    <DeleteAccountButton name={user.id} onDelete={handleDelete} label='Delete user' />
                </div>
            </div>
            {impersonationPromptOpen ? (
                <form
                    aria-label={`Impersonation reason for ${user.id}`}
                    className='absolute right-0 top-11 z-[100] grid w-80 max-w-[calc(100vw-2rem)] gap-2 rounded-lg border border-ui-primary/30 bg-ui-panel p-3 text-ui-text shadow-xl'
                    onClick={(event) => event.stopPropagation()}
                    onSubmit={handleConfirmImpersonation}
                >
                    <label className='grid gap-1 text-xs font-semibold text-ui-text'>
                        Reason for impersonating {user.name || user.id}
                        <textarea
                            className='min-h-20 resize-y rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary/60 focus:ring-2 focus:ring-ui-primary/15'
                            name='impersonationReason'
                            onChange={(event) => {
                                setImpersonationReason(event.target.value)
                                if (impersonationReasonError) setImpersonationReasonError('')
                            }}
                            placeholder='Describe the support case or audit reason'
                            value={impersonationReason}
                        />
                    </label>
                    <div className='flex items-start justify-between gap-3 text-[0.68rem] leading-4 text-ui-muted'>
                        <span>Required for audit. Starts a 30 minute profile and organization session.</span>
                        <span>{reasonLength}/10</span>
                    </div>
                    {impersonationReasonError ? (
                        <p className='rounded-md border border-ui-danger/30 bg-ui-danger/10 px-2 py-1 text-xs font-semibold text-ui-danger'>
                            {impersonationReasonError}
                        </p>
                    ) : null}
                    <div className='flex justify-end gap-2'>
                        <button
                            className='h-8 rounded-md border border-ui-border px-3 text-xs font-bold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                            disabled={impersonationPending}
                            onClick={handleCancelImpersonation}
                            type='button'
                        >
                            Cancel
                        </button>
                        <button
                            className='h-8 rounded-md bg-ui-primary px-3 text-xs font-bold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55'
                            disabled={impersonationPending}
                            type='submit'
                        >
                            {impersonationPending ? 'Starting...' : 'Start session'}
                        </button>
                    </div>
                </form>
            ) : null}
            <UserRoleHandler user={user} displayRoles={displayRoles} roles={roles} />
            {deleted ? <ErrorNotice compact variant='success' className='absolute right-2 top-12 z-[100] w-60' message={`Deleted user ${user.id}.`} /> : null}
            {error ? <ErrorNotice compact className='absolute right-2 top-12 z-[100] w-60' message={String(error)} /> : null}
        </div>
    )
}
