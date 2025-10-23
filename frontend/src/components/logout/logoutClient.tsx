'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Notify from '../notify/notify'

export default function LogoutClient({ logoutServer }: { logoutServer: boolean }) {
    const [logout, setLogout] = useState(logoutServer)
    const router = useRouter()

    useEffect(() => {
        if (logout) {
            setTimeout(() => {
                setLogout(false)
                router.push('/')
            }, 5000)
        }
    }, [logout])

    if (!logout) {
        return
    }

    return (
        <div className='absolute top-0 left-0 p-10 grid place-items-center w-full'>
            <Notify glow className='w-sm' color='bg-blue-800' fullWidth message='Successfully logged out. Welcome back later!' />
        </div>
    )
}
