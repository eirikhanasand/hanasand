'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import useKeyPress from '@/hooks/keyPressed'
import { Crown, Shield, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ErrorNotice from '../error/errorNotice'
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
            <ErrorNotice compact variant='success' message={`Deleted role ${role.id}.`} />
        )
    }

    return (
        <div className='grid gap-2'>
            <button
                type='button'
                onClick={handleClick}
                className={`group flex items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition ${keys['shift'] ? 'border-ui-danger/20 bg-ui-danger/8 hover:bg-ui-danger/15' : 'border-ui-border/8 bg-ui-panel/3 hover:bg-ui-panel/7'}`}
            >
                <div className='flex min-w-0 items-center gap-3'>
                    <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui-border/10 bg-ui-panel/5'>
                        <Shield className='h-4 w-4 text-ui-warning' />
                    </div>
                    <div className='min-w-0'>
                        <div className='truncate text-sm font-medium text-ui-text/88'>{role.name}</div>
                        <div className='wrap-break-word whitespace-normal text-xs text-ui-text/45'>{role.description || 'Role policy lane is ready for a description.'}</div>
                    </div>
                </div>
                <div className='flex shrink-0 items-center gap-3 pt-1'>
                    <div className='flex items-center gap-1 text-sm text-ui-text/65'>
                        {role.priority === 0 ? <Crown className='h-4 w-4 text-ui-warning' /> : <span>{role.priority}</span>}
                    </div>
                    {keys['shift'] && <Trash2 className='h-4 w-4 text-ui-danger' />}
                </div>
            </button>
            {error ? <ErrorNotice compact message={error} /> : null}
        </div>
    )
}
