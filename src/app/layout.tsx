import React, { ReactNode } from 'react'
import './globals.css'
import Navbar from '@components/nav'
import { cookies } from 'next/headers'
import ThemeSwitch from '@/components/theme/themeSwitch'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default async ({children}: {children: ReactNode}) => {
    const theme = (await cookies()).get('theme')?.value || 'dark'

    return (
        <html lang="en" className={theme}>
            <body className='h-[100vh] w-[100vw]'>
                <header className="h-[6.5vh] max-h-[6.5vh] text-white bg-dark grid items-align">
                    <ThemeSwitch />
                </header>
                <main className='h-[93.5vh] max-h-[93.5vh] overflow-auto w-full'>
                    {children}
                </main>
            </body>
        </html>
    )
}
