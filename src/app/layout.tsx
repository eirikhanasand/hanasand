import React, { ReactNode } from 'react'
import './globals.css'
import { cookies } from 'next/headers'
import ThemeSwitch from '@/components/theme/themeSwitch'
import Link from 'next/link'
import Footer from '@/components/footer/footer'
import Login from '@/components/login/login'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default async function layout({children}: {children: ReactNode}) {
    const theme = (await cookies()).get('theme')?.value || 'dark'

    return (
        <html lang="en" className={theme}>
            <body className='h-full w-full'>
                <header className="fixed top-0 left-0 h-[6.5vh] z-100 w-full max-h-[6.5vh] text-white bg-dark flex items-center justify-end px-4 select-none">
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                        <Link className="font-semibold text-bright cursor-pointer" href="/">hanasand</Link>
                    </div>
                    <ThemeSwitch />
                    <Login />
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
