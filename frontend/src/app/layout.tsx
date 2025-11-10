import { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import Footer from '@/components/footer/footer'
import './globals.css'
import Header from '@/components/header/header'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default async function layout({ children }: { children: ReactNode }) {
    const Cookies = await cookies()
    const token = Boolean(Cookies.get('access_token')?.value) || false
    const Headers = await headers()
    const theme = Cookies.get('theme')?.value || 'dark'
    const path = Headers.get('x-current-path') || ''
    const isShare = path.includes('/s')

    return (
        <html lang='en' className={theme}>
            <body className='h-full w-full max-h-screen max-w-screen overflow-hidden'>
                <Header token={token} path={path} />
                <div className={`${isShare ? 'mt-[7.5vh] h-[92.5vh]' : 'mt-[9.5vh] h-[90.5vh]'} w-full overflow-auto`}>
                    <main className={`w-full ${isShare ? 'pt-2' : 'pt-5 md:pt-0'} min-h-[90.5vh]`}>
                        {children}
                    </main>
                    <Footer />
                </div>
            </body>
        </html>
    )
}
