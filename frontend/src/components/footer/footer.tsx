'use client'

import config from '@/config'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Footer() {
    const pathname = usePathname()
    const isShare = pathname.includes('/s')

    return (
        <footer className={`${isShare && 'hidden'} w-full h-fit grid place-items-center py-2 pb-8 px-8 md:px-16 lg:px-32`}>
            <section className='w-full md:h-15 grid md:grid-cols-4 pb-8 gap-8 md:gap-0 md:py-0 place-items-center outline outline-dark rounded-lg p-2'>
                <h1>© hanasand.com · 2024 - {new Date().getFullYear()}</h1>
                <Link href='/contact'>Contact</Link>
                <Link href='/quotes'>Quotes</Link>
                <h1>v{config.version}</h1>
            </section>
        </footer>
    )
}
