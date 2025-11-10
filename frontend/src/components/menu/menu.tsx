'use client'

import { getCookie } from '@/utils/cookies'
import { ActivityIcon, Menu as MenuIcon, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, LinkIcon, Flame } from 'lucide-react'
import Dashboard from '@/components/dashboard/dashboard'
import Upload from './uploadIcon'
import ShareIcon from './shareIcon'

export default function Menu() {
    const [open, setOpen] = useState(false)
    const [token, setToken] = useState<boolean>(false)
    const path = usePathname()
    const baseStyles = 'group rounded-lg h-12 w-12 grid place-items-center cursor-pointer hover:bg-[#6464641a]'
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
            <div onClick={() => setOpen(prev => !prev)} className='grid md:hidden group rounded-lg hover:bg-[#6464641a] h-12 w-12 place-items-center cursor-pointer'>
                <MenuIcon />
            </div>
        )
    }

    return (
        <div className='grid md:hidden z-105 group rounded-lg hover:bg-[#6464641a] h-12 w-12 place-items-center'>
            <X onClick={toggleOpen} />
            <div className='absolute bg-dark w-fit h-fit right-2 top-15 rounded-lg z-105'>
                <Link href='/upload' onClick={toggleOpen} className='flex pl-2 pr-5'>
                    <Upload baseStyles={baseStyles} isUpload={isUpload} />
                    <h1 className='self-center font-semibold'>Upload</h1>
                </Link>
                <Link href='/s' onClick={toggleOpen} className='flex pl-2 pr-5'>
                    <ShareIcon baseStyles={baseStyles} isShare={isShare} />
                    <h1 className='self-center font-semibold'>Share</h1>
                </Link>
                <Link href='/g' onClick={toggleOpen} className='flex pl-2 pr-5'>
                    <div className={baseStyles}>
                        <LinkIcon className={`${isLink && 'stroke-blue-400'} group-hover:stroke-blue-400`} />
                    </div>
                    <h1 className='self-center font-semibold'>Create Link</h1>
                </Link>
                <Link href='/pwned' onClick={toggleOpen} className='flex pl-2 pr-5'>
                    <div className='group relative grid place-items-center'>
                        <div className={baseStyles}>
                            <Eye />
                        </div>
                        <div className={`${!isPwned && 'hidden'} group-hover:block rounded-full pointer-events-none bg-green-600 w-[5px] h-[5px] absolute z-100 self-center`} />
                    </div>
                    <h1 className='self-center font-semibold'>Check password</h1>
                </Link>
                <Link href='/test' onClick={toggleOpen} className='flex pl-2 pr-5'>
                    <div className={baseStyles}>
                        <Flame className={`group-hover:stroke-[#e25822] ${isTest && 'stroke-[#e25822]'}`} />
                    </div>
                    <h1 className='self-center font-semibold'>Load test</h1>
                </Link>
                <Link href='/status' className={baseStyles}>
                    <div className={baseStyles}>
                        <ActivityIcon className={`group-hover:stroke-[#41b819] ${isStatus && 'stroke-[#41b819]'}`} />
                    </div>
                    <h1 className='self-center font-semibold'>Status</h1>
                </Link>
                <Link href='/dashboard' onClick={toggleOpen} className='flex pl-2 pr-5'>
                    <Dashboard serverToken={token} />
                    {token && <h1 className='self-center font-semibold'>Dashboard</h1>}
                </Link>
            </div>
        </div>
    )
}
