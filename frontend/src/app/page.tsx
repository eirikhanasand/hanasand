import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowUpRight, Gauge, KeyRound, Link2, LockKeyhole, Sparkles } from 'lucide-react'
import LogoutClient from '@/components/logout/logoutClient'
import { buildRouteMetadata } from './seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand',
    description: 'Hanasand is a focused workspace for projects, service status, uploads, and short links.',
    path: '/',
    keywords: ['hanasand', 'operations workspace', 'service status', 'uploads', 'short links'],
})

const primaryTools = [
    {
        title: 'Production workspace',
        description: 'Open the shared project surface for reviewable work and handoffs.',
        href: '/s',
        icon: Link2,
    },
    {
        title: 'System status',
        description: 'Check service health, latency, and recent incidents.',
        href: '/status',
        icon: Activity,
    },
    {
        title: 'AI assistant',
        description: 'Plan, edit, and verify project work in the AI workspace.',
        href: '/ai',
        icon: Sparkles,
    },
    {
        title: 'Operations dashboard',
        description: 'Review queues, projects, infrastructure, and production activity.',
        href: '/dashboard/overview',
        icon: Gauge,
    },
]

const secondaryLinks = [
    { label: 'Dashboard', href: '/dashboard/overview' },
    { label: 'AI workspace', href: '/ai' },
    { label: 'Service status', href: '/status' },
]

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const logout = Boolean(Array.isArray(params.logout) ? params.logout[0] : params.logout) || false

    return (
        <main className='mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 text-bright md:px-8 md:py-10'>
            <LogoutClient logoutServer={logout} />
            <section className='grid min-h-[calc(100vh-8rem)] content-center gap-8'>
                <div className='max-w-3xl'>
                    <p className='mb-4 text-xs font-medium uppercase tracking-[0.24em] text-bright/38'>Operations workspace</p>
                    <h1 className='text-4xl font-semibold text-bright md:text-6xl'>Hanasand</h1>
                    <p className='mt-5 max-w-2xl text-base leading-7 text-bright/55'>
                        Manage projects, service status, uploads, short links, and account access from one focused workspace.
                    </p>
                    <div className='mt-7 flex flex-wrap gap-3'>
                        <Link href='/login' className='inline-flex items-center gap-2 rounded-lg border border-bright/12 bg-bright/10 px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:bg-bright/14'>
                            <KeyRound className='h-4 w-4' />
                            Log in
                        </Link>
                        <Link href='/s' className='inline-flex items-center gap-2 rounded-lg border border-bright/10 px-4 py-2.5 text-sm font-medium text-bright/70 transition-colors hover:bg-bright/8 hover:text-bright'>
                            Open workspace
                            <ArrowUpRight className='h-4 w-4' />
                        </Link>
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-2'>
                    {primaryTools.map((tool) => {
                        const Icon = tool.icon
                        return (
                            <Link
                                key={tool.href}
                                href={tool.href}
                                className='group glass-card rounded-lg p-5 transition-colors hover:border-bright/18 hover:bg-bright/8'
                            >
                                <div className='flex items-start justify-between gap-4'>
                                    <div className='grid h-10 w-10 place-items-center rounded-lg bg-bright/8 text-bright/70 transition-colors group-hover:text-bright'>
                                        <Icon className='h-4.5 w-4.5' />
                                    </div>
                                    <ArrowUpRight className='h-4 w-4 text-bright/30 transition-colors group-hover:text-bright/65' />
                                </div>
                                <h2 className='mt-5 text-lg font-medium text-bright'>{tool.title}</h2>
                                <p className='mt-2 max-w-md text-sm leading-6 text-bright/48'>{tool.description}</p>
                            </Link>
                        )
                    })}
                </div>

                <div className='flex flex-wrap items-center gap-2 text-sm text-bright/45'>
                    <LockKeyhole className='h-4 w-4' />
                    {secondaryLinks.map((link) => (
                        <Link key={link.href} href={link.href} className='rounded-lg px-3 py-1.5 transition-colors hover:bg-bright/8 hover:text-bright/75'>
                            {link.label}
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    )
}
