'use client'

import { useEffect, useState } from 'react'
import LoginIcon from './loginIcon'
import { getCookie } from '@/utils/cookies'
import { usePathname } from 'next/navigation'

export default function Login({ serverToken }: { serverToken: boolean }) {
    const [token, setToken] = useState<boolean>(serverToken)
    const path = usePathname()

    useEffect(() => {
        const clientToken = getCookie('access_token')
        setToken(Boolean(clientToken))
    }, [path])

    if (token) {
        return
    }

    return (
        <div className='group rounded-lg hover:bg-[#6464641a] h-12 w-12'>
            <LoginIcon />
        </div>
    )
}
