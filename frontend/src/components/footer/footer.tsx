import config from '@/config'
import Link from 'next/link'

export default function Footer() {
    return (
        <footer className='w-full h-fit md:h-[120px] grid place-items-center bg-normal'>
            <section className='w-full grid md:grid-cols-4 py-8 gap-8 md:gap-0 md:py-0 place-items-center'>
                <h1>© hanasand.com · 2024 - {new Date().getFullYear()}</h1>
                <Link href='/contact'>Contact</Link>
                <Link href='/quotes'>Quotes</Link>
                <h1>v{config.version}</h1>
            </section>
        </footer>
    )
}
