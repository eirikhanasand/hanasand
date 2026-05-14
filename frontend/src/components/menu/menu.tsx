'use client'

import { getCookie } from '@/utils/cookies/cookies'
import { ActivityIcon, Menu as MenuIcon, Sparkles, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Dashboard from '@/components/dashboard/dashboard'
import ShareIcon from './shareIcon'
import isSharePath from '@/utils/routes/isSharePath'

export default function Menu() {
    const [open, setOpen] = useState(false)
    const [token, setToken] = useState<boolean>(false)
    const path = usePathname()
    const baseStyles = 'group rounded-lg h-12 w-12 grid place-items-center cursor-pointer transition-colors hover:bg-bright/8'
    const isShare = isSharePath(path)
    const isStatus = path.includes('/status')
    const isAI = path.includes('/ai')

    function toggleOpen() {
        setOpen(prev => !prev)
    }

    useEffect(() => {
        const cookieToken = getCookie('access_token')
        setToken(Boolean(cookieToken))
    }, [])

    if (!open) {
        return (
            <div onClick={() => setOpen(prev => !prev)} className='grid md:hidden group h-11 w-11 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-bright/8'>
                <MenuIcon />
            </div>
        )
    }

    return (
        <div className='group z-105 grid h-11 w-11 place-items-center rounded-lg md:hidden'>
            <X onClick={toggleOpen} />
            <div onClick={(e) => e.preventDefault()} className='absolute right-3 top-16 z-105 h-fit w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-bright/10 bg-(--panel-surface) p-1.5 text-bright shadow-[0_24px_90px_var(--soft-shadow)] outline outline-dark/60 backdrop-blur-xl sm:right-5 sm:top-18'>
                <Link href='/s' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <ShareIcon baseStyles={baseStyles} isShare={isShare} />
                    <h1 className='self-center font-semibold'>Workspace</h1>
                </Link>
                <Link href='/ai' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <div className={baseStyles}>
                        <Sparkles className={`group-hover:stroke-orange-300 ${isAI && 'stroke-orange-300'}`} />
                    </div>
                    <h1 className='self-center font-semibold'>AI assistant</h1>
                </Link>
                <Link href='/status' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <div className={baseStyles}>
                        <ActivityIcon className={`group-hover:stroke-[#41b819] ${isStatus && 'stroke-[#41b819]'}`} />
                    </div>
                    <h1 className='self-center font-semibold'>Status</h1>
                </Link>
                <Link href='/dashboard' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <Dashboard serverToken={token} />
                    {token && <h1 className='self-center font-semibold'>Dashboard</h1>}
                </Link>
            </div>
        </div>
    )
}
