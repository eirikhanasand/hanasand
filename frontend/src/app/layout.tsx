import { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import Footer from '@/components/footer/footer'
import BackgroundSketches from '@/components/background/backgroundSketches'
import './globals.css'
import Header from '@/components/header/header'
export { default as metadata } from './metadata'
export { default as viewport } from './metadata'

export default async function layout({ children }: { children: ReactNode }) {
    const Cookies = await cookies()
    const Headers = await headers()
    const token = Boolean(Cookies.get('access_token')?.value) || false
    const theme = Cookies.get('theme')?.value || 'dark'
    const path = Headers.get('x-current-path') || ''
    const isShare = path.startsWith('/s')
    const isDashboard = path.startsWith('/dashboard')
    const isProfile = path.startsWith('/profile')
    const isAppSurface = isShare || path.startsWith('/ai') || isDashboard || isProfile

    return (
        <html lang='en' className={theme}>
            <body className='h-full w-full max-h-screen max-w-screen overflow-hidden'>
                <div className='site-atmosphere' />
                <Header token={token} path={path} />
                <div className={`relative z-10 ${isAppSurface ? 'mt-[7.5vh] h-[92.5vh]' : 'mt-[8.25vh] h-[91.75vh] md:mt-[9.5vh] md:h-[90.5vh]'} w-full overflow-auto`}>
                    {isAppSurface ? null : <BackgroundSketches />}
                    <main className={`w-full ${isAppSurface ? 'h-full' : 'min-h-[90.5vh] pt-3 md:pt-0'}`}>
                        {children}
                    </main>
                    {isAppSurface ? null : <Footer />}
                </div>
            </body>
        </html>
    )
}
