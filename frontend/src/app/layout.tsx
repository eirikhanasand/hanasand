import React, { ReactNode } from 'react'
import './globals.css'
import { cookies } from 'next/headers'
import ThemeSwitch from '@/components/theme/themeSwitch'
import Link from 'next/link'
import Footer from '@/components/footer/footer'
import Login from '@/components/login/login'
import { FileCode, Eye, LinkIcon, UploadIcon } from 'lucide-react'
import Logout from '@/components/logout/logout'
import Dashboard from '@/components/dashboard/dashboard'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default async function layout({children}: {children: ReactNode}) {
    const Cookies = await cookies()
    const theme = Cookies.get('theme')?.value || 'dark'
    const token = Cookies.get('access_token')?.value || undefined

    return (
        <html lang="en" className={theme}>
            <body className='h-full w-full'>
                <header className='fixed top-0 left-0 h-[6.5vh] z-100 w-full max-h-[6.5vh] text-white bg-dark grid grid-cols-3 px-4 select-none'>
                    <div className='flex items-center'>
                        <Link href='/upload' className='rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                            <UploadIcon />
                        </Link> 
                        <Link href='/s' className='rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                            <FileCode />
                        </Link> 
                        <Link href='/g' className='rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                            <LinkIcon />
                        </Link>
                        <div className='group relative grid place-items-center'>
                            <Link href='/pwned' className='rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                                <Eye />
                            </Link>
                            <div className='hidden group-hover:block rounded-full bg-red-500 w-[5px] h-[5px] absolute z-100 self-center' />
                        </div>
                    </div>
                    <div className='grid place-items-center'>
                        <Link className="font-semibold text-bright cursor-pointer" href="/">hanasand</Link>
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
