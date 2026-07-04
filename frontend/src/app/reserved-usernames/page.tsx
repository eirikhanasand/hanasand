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
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-10 text-ui-text md:px-8 md:py-14'>
            <section className='mx-auto grid max-w-5xl gap-5'>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-md md:p-7'>
                    <div className='flex items-center gap-2 text-ui-primary'>
                        <ShieldCheck className='h-4 w-4' />
                        <p className='text-xs font-semibold uppercase text-ui-primary'>Account policy</p>
                    </div>
                    <h1 className='mt-4 text-3xl font-semibold tracking-normal text-ui-text md:text-4xl'>Reserved usernames</h1>
                    <p className='mt-3 max-w-3xl text-sm font-normal leading-6 text-ui-muted'>
                        Some account names are protected because they imply system ownership, mail authority,
                        security responsibility, management authority, financial control, or outside-company identity.
                        These names cannot be registered by normal users.
                    </p>
                    <div className='mt-5 flex flex-wrap gap-2'>
                        <Link
                            href='/register'
                            className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-text px-3.5 text-sm font-semibold text-ui-canvas transition hover:opacity-90'
                        >
                            Create an allowed account
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                        <Link
                            href='/contact'
                            className='inline-flex h-10 items-center rounded-lg border border-ui-border bg-ui-raised px-3.5 text-sm font-semibold text-ui-text transition hover:border-ui-primary'
                        >
                            Request a reserved name
                        </Link>
                    </div>
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                    {reservedUsernameCategories.map(category => (
                        <article key={category.title} className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                            <h2 className='text-sm font-semibold text-ui-text'>{category.title}</h2>
                            <p className='mt-1.5 text-xs leading-5 text-ui-muted'>{category.description}</p>
                            <div className='mt-3 flex flex-wrap gap-1.5'>
                                {category.examples.map(example => (
                                    <span key={example} className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-medium text-ui-muted'>
                                        {example}
                                    </span>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>

                <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm md:p-5'>
                    <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-ui-primary'>Exact reserved names</p>
                            <h2 className='mt-1 text-lg font-semibold text-ui-text'>Protected list</h2>
                        </div>
                        <p className='text-xs text-ui-muted'>{reservedUsernames.length} names reserved, plus lookalike patterns.</p>
                    </div>
                    <div className='mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
                        {reservedUsernames.map(username => (
                            <span key={username} className='truncate rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5 text-xs text-ui-muted'>
                                {username}
                            </span>
                        ))}
                    </div>
                </section>
            </section>
        </main>
    )
}
