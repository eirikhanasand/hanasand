'use client'

import { LayoutDashboard } from 'lucide-react'
import LinkorDiv from '../misc/linkOrDiv'
import { useEffect, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'
import { usePathname } from 'next/navigation'

export default function Dashboard({ href, serverToken }: { href?: string, serverToken: boolean }) {
    const [token, setToken] = useState<boolean>(serverToken)
    const path = usePathname()

    useEffect(() => {
        const clientToken = getCookie('access_token')
        setToken(Boolean(clientToken))
    }, [path])

    if (!token) {
        return
    }

    return (
        <LinkorDiv href={href} className='group grid h-10 w-10 place-items-center rounded-lg border border-[#dfe5ee] text-[#4b5565] transition hover:bg-[#f6f8fb] hover:text-[#111827]'>
            <LayoutDashboard className='h-4.5 w-4.5 stroke-current' />
        </LinkorDiv>
    )
}
