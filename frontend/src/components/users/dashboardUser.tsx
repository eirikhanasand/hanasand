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
            <div onClick={handleClick} className={`flex cursor-pointer justify-between p-2 ${keys['shift'] ? 'hover:bg-red-500/15 hover:outline hover:outline-red-500/30' : 'hover:bg-dark'} rounded-lg hover:scale-[1.005]`}>
                <h1 className={`self-center ${user.active === false ? 'text-bright/35 line-through' : ''}`} key={user.id}>{user.name}</h1>
                {keys['shift'] && <Trash2 className='hidden group-hover:block w-5 h-5 stroke-red-500' />}
                {!keys['shift'] && <div className='group flex items-center gap-2'>
                    <div
                        aria-label={`${user.active === false ? 'Activate' : 'Deactivate'} ${user.id}`}
                        onClick={handleActive}
                        role='button'
                        className={`hidden group-hover:grid rounded-lg h-7 w-7 place-items-center cursor-pointer ${user.active === false ? 'hover:bg-emerald-500/15' : 'hover:bg-red-500/15'}`}
                    >
                        {user.active === false
                            ? <CheckCircle2 className='w-4 h-4 self-center stroke-emerald-300' />
                            : <Ban className='w-4 h-4 self-center stroke-red-300' />
                        }
                    </div>
                    {user.highest_role_priority === 0 && <Crown className='w-5 h-5 stroke-amber-300' />}
                    <button
                        type='button'
                        aria-label={`Impersonate ${user.id}`}
                        onClick={handleImpersonate}
                        disabled={impersonationPending}
                        className='rounded-md border border-[#f07d33]/20 bg-[#f07d33]/10 px-2 py-1 text-[0.68rem] font-bold text-[#f07d33] transition hover:bg-[#f07d33]/16'
                        title={`Impersonate ${user.id}`}
                    >
                        {impersonationPending ? 'Checking' : 'Impersonate'}
                    </button>
                    <div
                        aria-label={`Manage roles for ${user.id}`}
                        onClick={handleRoles}
                        role='button'
                        className='hidden group-hover:grid rounded-lg hover:bg-[#6464641a] h-7 w-7 place-items-center cursor-pointer'
                    >
                        {displayRoles
                            ? <X className='w-4 h-4 self-center stroke-bright/50' />
                            : <Pencil className='w-4 h-4 self-center stroke-bright/50' />
                        }
                    </div>
                </div>}
            </div>
            {impersonationPromptOpen ? (
                <form
                    aria-label={`Impersonation reason for ${user.id}`}
                    className='absolute right-0 top-11 z-100 grid w-80 max-w-[calc(100vw-2rem)] gap-2 rounded-lg border border-[#f07d33]/25 bg-[#11131a] p-3 text-bright shadow-xl'
                    onClick={(event) => event.stopPropagation()}
                    onSubmit={handleConfirmImpersonation}
                >
                    <label className='grid gap-1 text-xs font-semibold text-bright/80'>
                        Reason for impersonating {user.name || user.id}
                        <textarea
                            className='min-h-20 resize-y rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-bright outline-none transition placeholder:text-bright/30 focus:border-[#f07d33]/60 focus:ring-2 focus:ring-[#f07d33]/15'
                            name='impersonationReason'
                            onChange={(event) => {
                                setImpersonationReason(event.target.value)
                                if (impersonationReasonError) setImpersonationReasonError('')
                            }}
                            placeholder='Describe the support case or audit reason'
                            value={impersonationReason}
                        />
                    </label>
                    <div className='flex items-start justify-between gap-3 text-[0.68rem] leading-4 text-bright/45'>
                        <span>Required for audit. Starts a 30 minute profile and organization session.</span>
                        <span>{reasonLength}/10</span>
                    </div>
                    {impersonationReasonError ? (
                        <p className='rounded-md border border-red-400/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200'>
                            {impersonationReasonError}
                        </p>
                    ) : null}
                    <div className='flex justify-end gap-2'>
                        <button
                            className='h-8 rounded-md border border-white/10 px-3 text-xs font-bold text-bright/70 transition hover:bg-white/10'
                            disabled={impersonationPending}
                            onClick={handleCancelImpersonation}
                            type='button'
                        >
                            Cancel
                        </button>
                        <button
                            className='h-8 rounded-md bg-[#f07d33] px-3 text-xs font-bold text-[#11131a] transition hover:bg-[#ff914d] disabled:cursor-not-allowed disabled:opacity-55'
                            disabled={impersonationPending}
                            type='submit'
                        >
                            {impersonationPending ? 'Starting...' : 'Start session'}
                        </button>
                    </div>
                </form>
            ) : null}
            <UserRoleHandler user={user} displayRoles={displayRoles} roles={roles} />
            {deleted ? <ErrorNotice compact variant='success' className='absolute right-2 top-12 z-100 w-60' message={`Deleted user ${user.id}.`} /> : null}
            {error ? <ErrorNotice compact className='absolute right-2 top-12 z-100 w-60' message={String(error)} /> : null}
        </div>
    )
}
