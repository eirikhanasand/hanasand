import type { Metadata } from 'next'
import Link from 'next/link'
import { reservedUsernameCategories, reservedUsernames } from '@/utils/auth/reservedUsernames'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Reserved Usernames',
    description: 'Protected Hanasand usernames for system, security, management, and anti-impersonation use.',
    path: '/reserved-usernames',
    keywords: ['hanasand reserved usernames', 'protected account names', 'security usernames'],
})

export default function ReservedUsernamesPage() {
    return (
        <main className='min-h-[90vh] px-4 py-10 md:px-16'>
            <section className='mx-auto grid max-w-6xl gap-8'>
                <div className='glass-panel rounded-4xl p-6 md:p-10'>
                    <p className='text-xs uppercase tracking-[0.35em] text-bright/35'>Account policy</p>
                    <h1 className='mt-3 text-4xl font-semibold tracking-[-0.05em] text-bright md:text-6xl'>Reserved usernames</h1>
                    <p className='mt-4 max-w-3xl text-sm leading-7 text-bright/55 md:text-base'>
                        Some account names are protected because they imply system ownership, mail authority,
                        security responsibility, management authority, financial control, or outside-company identity.
                        These names cannot be registered by normal users.
                    </p>
                    <div className='mt-6 flex flex-wrap gap-3'>
                        <Link
                            href='/register'
                            className='rounded-full bg-bright px-5 py-3 text-sm font-semibold text-background transition hover:bg-orange-200'
                        >
                            Create an allowed account
                        </Link>
                        <Link
                            href='/contact'
                            className='rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-bright/75 transition hover:bg-white/10'
                        >
                            Request a reserved name
                        </Link>
                    </div>
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                    {reservedUsernameCategories.map(category => (
                        <article key={category.title} className='glass-card rounded-3xl p-5'>
                            <h2 className='text-lg font-semibold text-bright'>{category.title}</h2>
                            <p className='mt-2 text-sm leading-6 text-bright/50'>{category.description}</p>
                            <div className='mt-4 flex flex-wrap gap-2'>
                                {category.examples.map(example => (
                                    <span key={example} className='rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-bright/70'>
                                        {example}
                                    </span>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>

                <section className='glass-panel rounded-4xl p-6 md:p-8'>
                    <div className='flex flex-col gap-2 md:flex-row md:items-end md:justify-between'>
                        <div>
                            <p className='text-xs uppercase tracking-[0.3em] text-bright/35'>Exact reserved names</p>
                            <h2 className='mt-2 text-2xl font-semibold tracking-[-0.03em] text-bright'>Protected list</h2>
                        </div>
                        <p className='text-sm text-bright/45'>{reservedUsernames.length} names reserved, plus lookalike patterns.</p>
                    </div>
                    <div className='mt-6 flex flex-wrap gap-2'>
                        {reservedUsernames.map(username => (
                            <span key={username} className='rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-sm text-bright/70'>
                                {username}
                            </span>
                        ))}
                    </div>
                </section>
            </section>
        </main>
    )
}
