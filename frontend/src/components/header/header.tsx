'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Upload from '@/components/menu/uploadIcon'
import ShareIcon from '@/components/menu/shareIcon'
import ThemeSwitch from '@/components/theme/themeSwitch'
import { Eye, LinkIcon, Flame, ActivityIcon } from 'lucide-react'
import Login from '@/components/login/login'
import Logout from '@/components/logout/logout'
import Dashboard from '@/components/dashboard/dashboard'
import Menu from '@/components/menu/menu'
import Link from 'next/link'

export default function Header({ token, path: serverPath }: { token: boolean, path: string }) {
    const baseStyles = 'group rounded-lg h-12 w-12 grid place-items-center cursor-pointer hover:bg-[#6464641a]'
    const [isUpload, setIsUpload] = useState(serverPath.includes('/upload'))
    const [isLink, setIsLink] = useState(serverPath.endsWith('/g') || serverPath.includes('/g/'))
    const [isPwned, setIsPwned] = useState(serverPath.includes('/pwned'))
    const [isTest, setIsTest] = useState(serverPath.includes('/test'))
    const [isStatus, setIsStatus] = useState(serverPath.includes('/status'))
    const [isShare, setIsShare] = useState(serverPath.endsWith('/s') || serverPath.includes('/s/'))
    const path = usePathname()

    useEffect(() => {
        const updatedIsUpload = path.includes('/upload')
        const updatedIsLink = path.endsWith('/g') || path.includes('/g/')
        const updatedIsPwned = path.includes('/pwned')
        const updatedIsTest = path.includes('/test')
        const updatedIsStatus = path.includes('/status')
        const updatedIsShare = path.endsWith('/s') || path.includes('/s/')

        if (updatedIsUpload !== isUpload) {
            setIsUpload(updatedIsUpload)
        }

        if (updatedIsLink !== isLink) {
            setIsLink(updatedIsLink)
        }

        if (updatedIsPwned !== isPwned) {
            setIsPwned(updatedIsPwned)
        }

        if (updatedIsTest !== isTest) {
            setIsTest(updatedIsTest)
        }

        if (updatedIsShare !== isShare) {
            setIsShare(updatedIsShare)
        }

        if (updatedIsStatus !== isStatus) {
            setIsStatus(updatedIsStatus)
        }
    }, [path])

    return (
        <header className={`fixed top-0 left-0 h-[6.5vh] z-1000 w-full max-h-[6.5vh] ${isShare ? 'p-2' : 'pt-4 px-8 md:px-16 lg:px-32'}`}>
            <div className='w-full text-foreground flex md:grid md:grid-cols-3 px-4 select-none outline outline-dark rounded-lg py-1 bg-background'>
                <div className='grid md:hidden place-items-center w-full flex-1'>
                    <Link href='/' className='w-full flex px-3 items-center h-12 hover:bg-[#6464641a] rounded-lg cursor-pointer'>
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
                        <div className={`${!isPwned && 'hidden'} group-hover:block rounded-full pointer-events-none bg-green-600 w-[5px] h-[5px] absolute z-100 self-center`} />
                    </Link>
                    <Link href='/test' className={baseStyles}>
                        <Flame className={`group-hover:stroke-[#e25822] ${isTest && 'stroke-[#e25822]'}`} />
                    </Link>
                    <Link href='/status' className={baseStyles}>
                        <ActivityIcon className={`group-hover:stroke-[#41b819] ${isStatus && 'stroke-[#41b819]'}`} />
                    </Link>
                </div>
                <div className='hidden md:grid place-items-center w-full'>
                    <Link href='/' className='group w-fit grid place-items-center h-12 hover:bg-[#6464641a] md:px-10 rounded-lg cursor-pointer'>
                        <h1 className='font-semibold text-bright text-glow'>hanasand</h1>
                    </Link>
                </div>
                <div className='flex justify-end items-center'>
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
