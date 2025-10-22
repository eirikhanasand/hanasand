import React, { ReactNode } from 'react'
import './globals.css'
import { cookies, headers } from 'next/headers'
import ThemeSwitch from '@/components/theme/themeSwitch'
import Link from 'next/link'
import Footer from '@/components/footer/footer'
import Login from '@/components/login/login'
import { FileCode, Eye, LinkIcon, UploadIcon, Flame, Code } from 'lucide-react'
import Logout from '@/components/logout/logout'
import Dashboard from '@/components/dashboard/dashboard'
import UploadIconArrow from '@/components/upload/uploadIconarrow'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default async function layout({children}: {children: ReactNode}) {
    const Cookies = await cookies()
    const Headers = await headers()
    const theme = Cookies.get('theme')?.value || 'dark'
    const token = Cookies.get('access_token')?.value || undefined
    const path = Headers.get('x-current-path') || ''
    const baseStyles = 'group rounded-lg h-12 w-12 grid place-items-center cursor-pointer hover:bg-[#6464641a]'
    const isUpload = path.includes('/upload')
    const isShare = path.includes('/s')
    const isLink = path.includes('/g')
    const isPwned = path.includes('/pwned')
    const isTest = path.includes('/test')

    return (
        <html lang="en" className={theme}>
            <body className='h-full w-full'>
                <header className='fixed top-0 left-0 h-[6.5vh] z-100 w-full max-h-[6.5vh] text-foreground bg-dark grid grid-cols-3 px-4 select-none'>
                    <div className='flex items-center'>
                        <Link href='/upload' className='group relative grid place-items-center'>
                            <div className={baseStyles}>
                                <UploadIcon />
                            </div>
                            <UploadIconArrow isUpload={isUpload} />
                        </Link> 
                        <Link href='/s' className='group relative grid place-items-center'>
                            <div className={baseStyles}>
                                <FileCode />
                            </div>
                            <Code className={`${!isShare && 'hidden'} group-hover:block absolute stroke-[#e25822] stroke-4 bg-dark group-hover:bg-dark/50 w-[10px] h-[10px] mt-[5px] z-100`} />
                        </Link> 
                        <Link href='/g' className={baseStyles}>
                            <LinkIcon className={`${isLink && 'stroke-blue-400'} group-hover:stroke-blue-400`} />
                        </Link>
                        <Link href='/pwned' className='group relative grid place-items-center'>
                            <div className={baseStyles}>
                                <Eye />
                            </div>
                            <div className={`${!isPwned && 'hidden'} group-hover:block rounded-full bg-red-500 w-[5px] h-[5px] absolute z-100 self-center`} />
                        </Link>
                        <Link href='/test' className={baseStyles}>
                            <Flame className={`group-hover:stroke-[#e25822] ${isTest && 'stroke-[#e25822]'}`} />
                        </Link>
                    </div>
                    <div className='grid place-items-center w-full'>
                        <Link href="/" className='group w-fit grid place-items-center h-12 hover:bg-[#6464641a] px-10 rounded-lg cursor-pointer'>
                            <h1 className="font-semibold text-bright group-hover:text-bright/70 text-glow">hanasand</h1>
                        </Link>
                    </div>
                    <div className='flex justify-end items-center'>
                        <ThemeSwitch />
                        {token ? <Dashboard /> : ''}
                        {token ? <Logout /> : <Login />}
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
