'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Notify from '../notify/notify'
import ClearStateAfter from '@/hooks/clearStateAfter'

export default function LogoutClient({ logoutServer }: { logoutServer: boolean }) {
    const [logout, setLogout] = useState(logoutServer)
    const router = useRouter()

    ClearStateAfter({ condition: logout, set: setLogout, timeout: 5000, onClear: () => router.push('/') })

    if (!logout) {
        return
    }

    return (
        <div className='absolute top-0 left-0 p-10 grid place-items-center w-full'>
            <Notify glow className='w-sm' color='bg-blue-800' fullWidth message='Successfully logged out. Welcome back later!' />
        </div>
    )
}
