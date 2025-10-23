import React, { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import ThemeSwitch from '@/components/theme/themeSwitch'
import Link from 'next/link'
import Footer from '@/components/footer/footer'
import Login from '@/components/login/login'
import { Eye, LinkIcon, Flame } from 'lucide-react'
import Logout from '@/components/logout/logout'
import Dashboard from '@/components/dashboard/dashboard'
import Menu from '@/components/menu/menu'
import './globals.css'
import Upload from '@/components/menu/uploadIcon'
import ShareIcon from '@/components/menu/shareIcon'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default async function layout({children}: {children: ReactNode}) {
    const Cookies = await cookies()
    const Headers = await headers()
    const theme = Cookies.get('theme')?.value || 'dark'
    const token = Boolean(Cookies.get('access_token')?.value) || false
    const path = Headers.get('x-current-path') || ''
    const baseStyles = 'group rounded-lg h-12 w-12 grid place-items-center cursor-pointer hover:bg-[#6464641a]'
    const isUpload = path.includes('/upload')
    const isShare = path.includes('/s')
    const isLink = path.includes('/g')
    const isPwned = path.includes('/pwned')
    const isTest = path.includes('/test')

    return (
        <html lang='en' className={theme}>
            <body className='h-full w-full'>
                <header className='fixed top-0 left-0 h-[6.5vh] z-100 w-full max-h-[6.5vh] text-foreground bg-dark grid grid-cols-3 px-4 select-none'>
                    <div className='block md:hidden w-full' />
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
                    </div>
                    <div className='grid place-items-center w-full'>
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
                </header>
                <div className='mt-[6.5vh] h-[93.5vh] w-full overflow-auto'>
                    <main className='w-full min-h-[93.5vh]'>
                        {children}
                    </main>
                    <Footer />
                </div>
            </body>
        </html>
    )
}
