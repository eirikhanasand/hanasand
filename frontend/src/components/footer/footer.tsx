'use client'

import config from '@/config'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Footer() {
    const pathname = usePathname()
    const isShare = pathname.includes('/s')

    return (
        <footer className={`${isShare && 'hidden'} grid h-fit w-full place-items-center px-3 pb-6 pt-2 sm:px-5 md:px-16 md:pb-8 lg:px-32`}>
            <section className='grid w-full max-w-330 gap-3 rounded-xl outline outline-dark p-3 text-center text-sm md:h-15 md:grid-cols-4 md:gap-0 md:place-items-center md:py-0 md:text-left'>
                <h1>© hanasand.com · 2024 - {new Date().getFullYear()}</h1>
                <Link href='/contact'>Contact</Link>
                <Link href='/quotes'>Quotes</Link>
                <h1 className='md:w-full md:text-right'>v{config.version}</h1>
            </section>
        </footer>
    )
}
