'use client'

import { getCookie } from '@/utils/cookies/cookies'
import { ActivityIcon, LinkIcon, Flame, Menu as MenuIcon, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import Dashboard from '@/components/dashboard/dashboard'
import Upload from './uploadIcon'
import ShareIcon from './shareIcon'

export default function Menu() {
    const [open, setOpen] = useState(false)
    const [token, setToken] = useState<boolean>(false)
    const path = usePathname()
    const baseStyles = 'group rounded-lg h-12 w-12 grid place-items-center cursor-pointer transition-colors hover:bg-bright/8'
    const isUpload = path.includes('/upload')
    const isShare = path.includes('/s')
    const isLink = path.includes('/g')
    const isPwned = path.includes('/pwned')
    const isTest = path.includes('/test')
    const isStatus = path.includes('/status')

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
                <Link href='/upload' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <Upload baseStyles={baseStyles} isUpload={isUpload} />
                    <h1 className='self-center font-semibold'>Upload</h1>
                </Link>
                <Link href='/s' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <ShareIcon baseStyles={baseStyles} isShare={isShare} />
                    <h1 className='self-center font-semibold'>Share</h1>
                </Link>
                <Link href='/g' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <div className={baseStyles}>
                        <LinkIcon className={`${isLink && 'stroke-blue-400'} group-hover:stroke-blue-400`} />
                    </div>
                    <h1 className='self-center font-semibold'>Create Link</h1>
                </Link>
                <Link href='/pwned' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <div className='group relative grid place-items-center'>
                        <div className={baseStyles}>
                            <Eye />
                        </div>
                        <div className={`${!isPwned && 'hidden'} group-hover:block rounded-full pointer-events-none bg-green-600 w-1.25 h-1.25 absolute z-100 self-center`} />
                    </div>
                    <h1 className='self-center font-semibold'>Check password</h1>
                </Link>
                <Link href='/test' onClick={toggleOpen} className='flex rounded-xl pl-2 pr-5 transition-colors hover:bg-bright/8'>
                    <div className={baseStyles}>
                        <Flame className={`group-hover:stroke-[#f07d33] ${isTest && 'stroke-[#f07d33]'}`} />
                    </div>
                    <h1 className='self-center font-semibold'>Load test</h1>
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
