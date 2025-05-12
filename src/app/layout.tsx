import React, { ReactNode } from 'react'
import './globals.css'
import { cookies } from 'next/headers'
import ThemeSwitch from '@/components/theme/themeSwitch'
import Link from 'next/link'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default async function layout({children}: {children: ReactNode}) {
    const theme = (await cookies()).get('theme')?.value || 'dark'

    return (
        <html lang="en" className={theme}>
            <body className='h-[100vh] w-[100vw]'>
                <header className="h-[6.5vh] max-h-[6.5vh] text-white bg-dark flex items-center justify-end px-4 select-none">
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                        <Link className="font-semibold text-bright" href="/">hanasand</Link>
                    </div>
                    <ThemeSwitch />
                </header>
                <main className='h-[93.5vh] max-h-[93.5vh] overflow-auto w-full'>
                    {children}
                </main>
            </body>
        </html>
    )
}
