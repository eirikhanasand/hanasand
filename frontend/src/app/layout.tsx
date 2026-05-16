import { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import './globals.css'
import Header from '@/components/header/header'
import DetachedBoxHost from '@/components/box/detachedBoxHost'
import RouteFrame from '@/components/layout/routeFrame'
export { default as metadata } from './metadata'
export { default as viewport } from './metadata'

export default async function layout({ children }: { children: ReactNode }) {
    const Cookies = await cookies()
    const Headers = await headers()
    const token = Boolean(Cookies.get('access_token')?.value) || false
    const theme = Cookies.get('theme')?.value || 'dark'
    const path = Headers.get('x-current-path') || ''

    return (
        <html lang='en' className={theme}>
            <body className='h-full w-full max-h-screen max-w-screen overflow-hidden'>
                <div className='site-atmosphere' />
                <Header token={token} path={path} />
                <DetachedBoxHost />
                <RouteFrame serverPath={path}>{children}</RouteFrame>
            </body>
        </html>
    )
}
