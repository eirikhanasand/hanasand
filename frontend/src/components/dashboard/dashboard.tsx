'use client'

import { LayoutDashboard } from 'lucide-react'
import LinkorDiv from '../misc/linkOrDiv'
import { useEffect, useState } from 'react'
import { getCookie } from '@/utils/cookies'
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
        <LinkorDiv href={href} className='group rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center'>
            <LayoutDashboard className='stroke-current group-hover:stroke-[#374c66]' />
        </LinkorDiv>
    )
}
