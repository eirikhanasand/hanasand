'use client'

import { useMemo, useState } from 'react'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import DashboardUser from './dashboardUser'

export default function UsersList({ users, roles }: { users: UserWithRole[], roles: Role[] }) {
    const [showReserved, setShowReserved] = useState(false)
    const reservedSet = useMemo(() => new Set(reservedUsernames), [])
    const reservedCount = users.filter((user) => reservedSet.has(user.id.toLowerCase())).length
    const visibleUsers = showReserved
        ? users
        : users.filter((user) => !reservedSet.has(user.id.toLowerCase()))

    return (
        <>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h1 className='text-base font-semibold text-ui-text'>Users</h1>
                    <p className='mt-1 text-sm text-ui-muted'>{visibleUsers.length} shown</p>
                </div>
                {reservedCount > 0 && (
                    <button
                        type='button'
                        onClick={() => setShowReserved((value) => !value)}
                        className='h-9 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:bg-ui-panel'
                    >
                        {showReserved ? 'Hide reserved' : 'Show reserved'}
                    </button>
                )}
            </div>
            {visibleUsers.map((user) => <DashboardUser roles={roles} key={user.id} user={user} />)}
        </>
    )
}
