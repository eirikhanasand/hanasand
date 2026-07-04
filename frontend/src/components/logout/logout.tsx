'use client'

import { getCookie } from '@/utils/cookies/cookies'
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
            <div className='pointer-events-none absolute -mr-[3px] hidden h-4 w-[22px] place-items-center overflow-hidden group-hover:block'>
                <ArrowRight className='logout z-10 h-full self-center rounded-lg bg-ui-panel stroke-[2.8px] stroke-ui-primary group-hover:bg-ui-raised' />
                <div className='logout-overlay absolute bottom-0 z-20 h-full w-[1.5px]' />
            </div>
        </Link>
    )
}
