'use client'

import { getCookie } from '@/utils/cookies'
import { ArrowRight, LogOut } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Logout({ baseStyles, serverToken }: { baseStyles: string, serverToken: boolean }) {
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
        <Link href='/logout' className='group relative grid place-items-center'>
            <div className={baseStyles}>
                <LogOut />
            </div>
            <div className={`hidden group-hover:block absolute pointer-events-none place-items-center w-[22px] h-[16px] -mr-[3px] overflow-hidden`}>
                <ArrowRight className={`stroke-[#e25822] stroke-[2.8px] bg-dark group-hover:bg-dark-reverse h-full z-10 self-center logout rounded-lg`} />
                <div className='logout-overlay absolute bottom-0 w-[1.5px] h-full z-20' />
            </div>
        </Link>
    )
}
