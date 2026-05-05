'use client'

import { usePathname } from 'next/navigation'
import Upload from '@/components/menu/uploadIcon'
import ShareIcon from '@/components/menu/shareIcon'
import ThemeSwitch from '@/components/theme/themeSwitch'
import { Eye, LinkIcon, Flame, ActivityIcon, Sparkles } from 'lucide-react'
import Login from '@/components/login/login'
import Logout from '@/components/logout/logout'
import Dashboard from '@/components/dashboard/dashboard'
import Menu from '@/components/menu/menu'
import Link from 'next/link'
import ViewModeToggle from './viewModeToggle'

export default function Header({ token, path: serverPath }: { token: boolean, path: string }) {
    const baseStyles = 'group rounded-lg h-11 w-11 md:h-12 md:w-12 grid place-items-center cursor-pointer hover:bg-[#6464641a]'
    const pathname = usePathname() || serverPath
    const isUpload = pathname.includes('/upload')
    const isLink = pathname.endsWith('/g') || pathname.includes('/g/')
    const isPwned = pathname.includes('/pwned')
    const isTest = pathname.includes('/test')
    const isStatus = pathname.includes('/status')
    const isShare = pathname.endsWith('/s') || pathname.includes('/s/')
    const isAI = pathname.endsWith('/ai') || pathname.includes('/ai/')
    const isDashboard = pathname.startsWith('/dashboard')

    return (
        <header className={`fixed top-0 left-0 z-1000 w-full ${isShare || isAI || isDashboard ? 'p-2' : 'px-3 pt-3 sm:px-5 md:px-16 md:pt-4 lg:px-32'}`}>
            <div className='w-full text-foreground flex min-h-13 md:grid md:grid-cols-3 px-2.5 sm:px-4 select-none outline outline-dark rounded-xl py-1 bg-background'>
                <div className='grid md:hidden place-items-center w-full flex-1'>
                    <Link href='/' className='w-full flex px-2.5 items-center h-11 hover:bg-[#6464641a] rounded-lg cursor-pointer'>
                        <h1 className='font-semibold text-bright text-glow'>hanasand</h1>
                    </Link>
                </div>
                <div className='hidden md:flex items-center'>
                    <Upload baseStyles={baseStyles} isUpload={isUpload} href='/upload' />
                    <ShareIcon baseStyles={baseStyles} isShare={isShare} href='/s' />
                    <Link href='/g' className={baseStyles}>
                        <LinkIcon className={`${isLink && 'stroke-blue-400'} group-hover:stroke-blue-400`} />
                    </Link>
                    <Link href='/pwned' className='group relative grid place-items-center'>
                        <div className={baseStyles}>
                            <Eye />
                        </div>
                        <div className={`${!isPwned && 'hidden'} group-hover:block rounded-full pointer-events-none bg-green-600 w-1.25 h-1.25 absolute z-100 self-center`} />
                    </Link>
                    <Link href='/test' className={baseStyles}>
                        <Flame className={`group-hover:stroke-[#e25822] ${isTest && 'stroke-[#e25822]'}`} />
                    </Link>
                    <Link href='/status' className={baseStyles}>
                        <ActivityIcon className={`group-hover:stroke-[#41b819] ${isStatus && 'stroke-[#41b819]'}`} />
                    </Link>
                    <Link href='/ai' className={baseStyles}>
                        <Sparkles className={`group-hover:stroke-orange-300 ${isAI && 'stroke-orange-300'}`} />
                    </Link>
                </div>
                <div className='hidden md:grid place-items-center w-full'>
                    <Link href='/' className='group w-fit grid place-items-center h-12 hover:bg-[#6464641a] md:px-10 rounded-lg cursor-pointer'>
                        <h1 className='font-semibold text-bright text-glow'>hanasand</h1>
                    </Link>
                </div>
                <div className='flex justify-end items-center'>
                    {token && isDashboard && <ViewModeToggle />}
                    <ThemeSwitch />
                    <Dashboard href='/dashboard' serverToken={token} />
                    <Logout baseStyles={baseStyles} serverToken={token} />
                    <Login serverToken={token} />
                    <Menu />
                </div>
            </div>
        </header>
    )
}
