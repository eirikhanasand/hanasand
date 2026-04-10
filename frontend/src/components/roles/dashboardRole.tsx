'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import useKeyPress from '@/hooks/keyPressed'
import { Crown, Shield, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Notify from '../notify/notify'
import deleteRole from '@/utils/roles/deleteRole'

export default function DashboardRole({ role }: { role: Role }) {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [deleted, setDeleted] = useState(false)
    const keys = useKeyPress('shift')
    const router = useRouter()

    async function handleClick() {
        if (!keys['shift']) {
            router.push(`/role/${role.id}`)
            return
        }

        const result = await deleteRole(role.id)
        if (result.status === 200) {
            setDeleted(true)
        } else {
            setError(result.message)
        }
    }

    if (deleted) {
        return (
            <Notify message={`Deleted role ${role.id}.`} className='min-w-full px-4 bg-light' />
        )
    }

    return (
        <div className='grid gap-2'>
            <button
                type='button'
                onClick={handleClick}
                className={`group flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${keys['shift'] ? 'border-red-500/20 bg-red-500/8 hover:bg-red-500/15' : 'border-white/8 bg-white/3 hover:bg-white/7'}`}
            >
                <div className='flex min-w-0 items-center gap-3'>
                    <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5'>
                        <Shield className='h-4 w-4 text-orange-300' />
                    </div>
                    <div className='min-w-0'>
                        <div className='truncate text-sm font-medium text-bright/88'>{role.name}</div>
                        <div className='truncate text-xs text-bright/45'>{role.description || 'No description yet.'}</div>
                    </div>
                </div>
                <div className='flex items-center gap-3'>
                    <div className='flex items-center gap-1 text-sm text-bright/65'>
                        {role.priority === 0 ? <Crown className='h-4 w-4 text-amber-300' /> : <span>{role.priority}</span>}
                    </div>
                    {keys['shift'] && <Trash2 className='h-4 w-4 text-red-400' />}
                </div>
            </button>
            {error && <Notify message={error} className='min-w-full px-4 bg-light' />}
        </div>
    )
}
