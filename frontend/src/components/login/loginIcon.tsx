'use client'

import { getCookie } from '@/utils/cookies'
import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function LoginIcon() {
    const [token, setToken] = useState(false)

    useEffect(() => {
        const cookie = getCookie('access_token')
        if (cookie) {
            setToken(Boolean(cookie))
        }
    }, [])

    if (token) {
        return (
            <Link
                href='/logout' prefetch={false} onClick={(e) => { e.preventDefault(); window.location.href = '/api/logout' }}
                className='grid items-center justify-center h-full w-full'
            >
                <LogOut size={24} />
            </Link>
        )
    }
    
    return (
        <Link
            href='/login'
            className='grid items-center justify-center h-full w-full'
        >
            <div className='user-icon' />
        </Link>
    )
}
