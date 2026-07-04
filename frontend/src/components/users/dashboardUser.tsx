'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import useKeyPress from '@/hooks/keyPressed'
import deleteUser from '@/utils/users/deleteUser'
import { startImpersonating } from '@/utils/impersonation/client'
import setUserActive from '@/utils/users/setUserActive'
import { Ban, CheckCircle2, Crown, Pencil, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ErrorNotice from '../error/errorNotice'
import UserRoleHandler from '../roles/userRoleHandler'

export default function DashboardUser({ user, roles }: { user: UserWithRole, roles: Role[] }) {
    const { condition: deleted, setCondition: setDeleted } = useClearStateAfter()
    const [displayRoles, setDisplayRoles] = useState(false)
    const keys = useKeyPress('shift')
    const router = useRouter()
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [impersonationPending, setImpersonationPending] = useState(false)
    const [impersonationPromptOpen, setImpersonationPromptOpen] = useState(false)
    const [impersonationReason, setImpersonationReason] = useState('')
    const [impersonationReasonError, setImpersonationReasonError] = useState('')

    async function handleRoles(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        setDisplayRoles(!displayRoles)
    }

    async function handleActive(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
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

    async function handleConfirmImpersonation(e: React.FormEvent<HTMLFormElement>) {
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

    async function handleClick() {
        if (!keys['shift']) {
            router.push(`/profile/${user.id}`)
        }

        if (keys['shift']) {
            const result = await deleteUser(user.id)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    const reasonLength = impersonationReason.trim().replace(/\s+/g, ' ').length

    return (
        <div className='group relative h-10 min-h-10 max-h-10'>
            <div onClick={handleClick} className={`flex cursor-pointer justify-between p-2 ${keys['shift'] ? 'hover:bg-ui-danger/10 hover:outline hover:outline-ui-danger/30' : 'hover:bg-ui-raised'} rounded-lg hover:scale-[1.005]`}>
                <h1 className={`self-center ${user.active === false ? 'text-ui-muted line-through' : ''}`} key={user.id}>{user.name}</h1>
                {keys['shift'] && <Trash2 className='hidden h-5 w-5 stroke-ui-danger group-hover:block' />}
                {!keys['shift'] && <div className='group flex items-center gap-2'>
                    <div
                        aria-label={`${user.active === false ? 'Activate' : 'Deactivate'} ${user.id}`}
                        onClick={handleActive}
                        role='button'
                        className={`hidden h-7 w-7 cursor-pointer place-items-center rounded-lg group-hover:grid ${user.active === false ? 'hover:bg-ui-success/10' : 'hover:bg-ui-danger/10'}`}
                    >
                        {user.active === false
                            ? <CheckCircle2 className='h-4 w-4 self-center stroke-ui-success' />
                            : <Ban className='h-4 w-4 self-center stroke-ui-danger' />
                        }
                    </div>
                    {user.highest_role_priority === 0 && <Crown className='h-5 w-5 stroke-ui-warning' />}
                    <button
                        type='button'
                        aria-label={`Impersonate ${user.id}`}
                        onClick={handleImpersonate}
                        disabled={impersonationPending}
                        className='rounded-md border border-ui-primary/25 bg-ui-primary/10 px-2 py-1 text-[0.68rem] font-bold text-ui-primary transition hover:bg-ui-primary/15'
                        title={`Impersonate ${user.id}`}
                    >
                        {impersonationPending ? 'Checking' : 'Impersonate'}
                    </button>
                    <div
                        aria-label={`Manage roles for ${user.id}`}
                        onClick={handleRoles}
                        role='button'
                        className='hidden h-7 w-7 cursor-pointer place-items-center rounded-lg transition hover:bg-ui-raised group-hover:grid'
                    >
                        {displayRoles
                            ? <X className='w-4 h-4 self-center stroke-ui-muted' />
                            : <Pencil className='w-4 h-4 self-center stroke-ui-muted' />
                        }
                    </div>
                </div>}
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
