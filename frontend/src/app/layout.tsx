import React, { ReactNode } from 'react'
import './globals.css'
import { cookies } from 'next/headers'
import ThemeSwitch from '@/components/theme/themeSwitch'
import Link from 'next/link'
import Footer from '@/components/footer/footer'
import Login from '@/components/login/login'
import { FileCode, Eye, LinkIcon, UploadIcon } from 'lucide-react'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default async function layout({children}: {children: ReactNode}) {
    const theme = (await cookies()).get('theme')?.value || 'dark'

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
                        <Link href='/bloom' className='rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                            <Eye />
                        </Link>
                    </div>
                    <div className='grid place-items-center'>
                        <Link className="font-semibold text-bright cursor-pointer" href="/">hanasand</Link>
                    </div>
                    <div className='flex justify-end items-center'>
                        <ThemeSwitch />
                        <Login />
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
