import config from '@/config'
import Link from 'next/link'

export default function Footer() {
    return (
        <footer className='w-full h-fit grid place-items-center p-2 pb-8 md:px-32'>
            <section className='w-full md:h-15 grid md:grid-cols-4 pb-8 gap-8 md:gap-0 md:py-0 place-items-center outline outline-dark rounded-lg p-2'>
                <h1>© hanasand.com · 2024 - {new Date().getFullYear()}</h1>
                <Link href='/contact'>Contact</Link>
                <Link href='/quotes'>Quotes</Link>
                <h1>v{config.version}</h1>
            </section>
        </footer>
    )
}
