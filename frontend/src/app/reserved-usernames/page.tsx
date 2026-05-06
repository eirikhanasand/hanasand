import type { Metadata } from 'next'
import Link from 'next/link'
import { reservedUsernameCategories, reservedUsernames } from '@/utils/auth/reservedUsernames'
import { buildRouteMetadata } from '../seo'
import { ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Reserved Usernames',
    description: 'Protected Hanasand usernames for system, security, management, and anti-impersonation use.',
    path: '/reserved-usernames',
    keywords: ['hanasand reserved usernames', 'protected account names', 'security usernames'],
})

export default function ReservedUsernamesPage() {
    return (
        <main className='min-h-[90vh] px-4 py-8 md:px-12'>
            <section className='mx-auto grid max-w-5xl gap-5'>
                <div className='rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl md:p-7'>
                    <div className='flex items-center gap-2 text-orange-200/80'>
                        <ShieldCheck className='h-4 w-4' />
                        <p className='text-xs font-medium uppercase tracking-[0.18em] text-bright/45'>Account policy</p>
                    </div>
                    <h1 className='mt-4 text-3xl font-medium tracking-normal text-bright md:text-4xl'>Reserved usernames</h1>
                    <p className='mt-3 max-w-3xl text-sm font-normal leading-6 text-bright/58'>
                        Some account names are protected because they imply system ownership, mail authority,
                        security responsibility, management authority, financial control, or outside-company identity.
                        These names cannot be registered by normal users.
                    </p>
                    <div className='mt-5 flex flex-wrap gap-2'>
                        <Link
                            href='/register'
                            className='inline-flex h-10 items-center gap-2 rounded-lg bg-bright/88 px-3.5 text-sm font-medium text-background/90 transition hover:bg-bright'
                        >
                            Create an allowed account
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                        <Link
                            href='/contact'
                            className='inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright/76 transition hover:bg-white/[0.075]'
                        >
                            Request a reserved name
                        </Link>
                    </div>
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                    {reservedUsernameCategories.map(category => (
                        <article key={category.title} className='rounded-lg border border-white/10 bg-white/[0.035] p-4'>
                            <h2 className='text-sm font-medium text-bright/90'>{category.title}</h2>
                            <p className='mt-1.5 text-xs leading-5 text-bright/52'>{category.description}</p>
                            <div className='mt-3 flex flex-wrap gap-1.5'>
                                {category.examples.map(example => (
                                    <span key={example} className='rounded-md border border-white/10 bg-white/[0.045] px-2 py-1 text-xs font-normal text-bright/66'>
                                        {example}
                                    </span>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>

                <section className='rounded-lg border border-white/10 bg-white/[0.035] p-4 md:p-5'>
                    <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-[0.16em] text-bright/40'>Exact reserved names</p>
                            <h2 className='mt-1 text-lg font-medium text-bright/90'>Protected list</h2>
                        </div>
                        <p className='text-xs text-bright/45'>{reservedUsernames.length} names reserved, plus lookalike patterns.</p>
                    </div>
                    <div className='mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
                        {reservedUsernames.map(username => (
                            <span key={username} className='truncate rounded-md border border-white/8 bg-black/14 px-2.5 py-1.5 text-xs text-bright/62'>
                                {username}
                            </span>
                        ))}
                    </div>
                </section>
            </section>
        </main>
    )
}
