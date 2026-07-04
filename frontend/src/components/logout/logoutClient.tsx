'use client'

import { useRouter } from 'next/navigation'
import Notify from '../notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export default function LogoutClient({ logoutServer }: { logoutServer: boolean }) {
    const router = useRouter()
    const { condition: logout } = useClearStateAfter({
        initialState: logoutServer,
        timeout: 5000,
        onClear: () => router.push('/')
    })

    if (!logout) {
        return
    }

    return (
        <div className='absolute left-0 top-0 grid w-full place-items-center p-10'>
            <Notify className='w-sm' color='info' fullWidth message='Successfully logged out. Welcome back later!' />
        </div>
    )
}
