import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowUpRight, KeyRound, Link2, LockKeyhole, ShieldCheck, UploadCloud } from 'lucide-react'
import LogoutClient from '@/components/logout/logoutClient'
import { buildRouteMetadata } from './seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand',
    description: 'Hanasand is an autonomous production assistant that builds, verifies, deploys, and recovers websites with visible proof.',
    path: '/',
    keywords: ['hanasand', 'autonomous production assistant', 'website deploy', 'website verification', 'rollback'],
})

const primaryTools = [
    {
        title: 'Production workspace',
        description: 'Build websites with reviewable changes, rendered proof, deploy checks, and recovery evidence.',
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
        title: 'Password exposure',
        description: 'Run exact-match password checks without saving the query.',
        href: '/pwned',
        icon: ShieldCheck,
    },
    {
        title: 'Upload media',
        description: 'Upload or preview supported image and video files.',
        href: '/upload',
        icon: UploadCloud,
    },
]

const secondaryLinks = [
    { label: 'Short links', href: '/g' },
    { label: 'Load tests', href: '/test' },
    { label: 'Dashboard', href: '/dashboard/overview' },
]

const productionProof = [
    { label: 'Build', detail: 'Reviewable file changes instead of hidden magic.', icon: Link2 },
    { label: 'Verify', detail: 'Rendered screenshots, visible checks, and journey proof.', icon: ShieldCheck },
    { label: 'Deploy', detail: 'Launch checks, health status, and visible failure reasons.', icon: Activity },
    { label: 'Recover', detail: 'Rollback and recovery evidence stay part of the flow.', icon: LockKeyhole },
]

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const logout = Boolean(Array.isArray(params.logout) ? params.logout[0] : params.logout) || false

    return (
        <main className='mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 text-[#eeeeea] md:px-8 md:py-10'>
            <LogoutClient logoutServer={logout} />
            <section className='grid min-h-[calc(100vh-8rem)] content-center gap-10'>
                <div className='max-w-3xl'>
                    <p className='mb-4 text-xs font-medium uppercase tracking-[0.24em] text-bright/38'>Autonomous production assistant</p>
                    <h1 className='text-4xl font-semibold tracking-[-0.02em] text-[#f4f4ef] md:text-6xl'>Hanasand</h1>
                    <p className='mt-5 max-w-2xl text-base leading-7 text-bright/55 md:text-lg'>
                        Not another AI website generator. Hanasand builds, verifies, deploys, and recovers websites with visible proof before changes land.
                    </p>
                    <div className='mt-7 flex flex-wrap gap-3'>
                        <Link href='/login' className='inline-flex items-center gap-2 rounded-full border border-bright/12 bg-bright/10 px-4 py-2.5 text-sm font-medium text-[#f4f4ef] transition-colors hover:bg-bright/14'>
                            <KeyRound className='h-4 w-4' />
                            Log in
                        </Link>
                        <Link href='/s' className='inline-flex items-center gap-2 rounded-full border border-bright/10 px-4 py-2.5 text-sm font-medium text-bright/70 transition-colors hover:bg-bright/8 hover:text-[#f4f4ef]'>
                            Build with proof
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
                                className='group rounded-3xl border border-bright/10 bg-[#0f1110]/70 p-5 transition-colors hover:border-bright/18 hover:bg-[#151715]/80'
                            >
                                <div className='flex items-start justify-between gap-4'>
                                    <div className='grid h-10 w-10 place-items-center rounded-2xl bg-bright/8 text-bright/70 transition-colors group-hover:text-[#f4f4ef]'>
                                        <Icon className='h-4.5 w-4.5' />
                                    </div>
                                    <ArrowUpRight className='h-4 w-4 text-bright/30 transition-colors group-hover:text-bright/65' />
                                </div>
                                <h2 className='mt-5 text-lg font-medium text-[#eeeeea]'>{tool.title}</h2>
                                <p className='mt-2 max-w-md text-sm leading-6 text-bright/48'>{tool.description}</p>
                            </Link>
                        )
                    })}
                </div>

                <div className='grid gap-2 rounded-2xl border border-bright/8 bg-[#0f1110]/45 p-3 sm:grid-cols-4'>
                    {productionProof.map((step) => {
                        const Icon = step.icon
                        return (
                            <div key={step.label} className='min-w-0 rounded-xl border border-bright/7 bg-black/16 p-3'>
                                <div className='flex items-center gap-2 text-sm font-semibold text-[#eeeeea]'>
                                    <Icon className='h-4 w-4 shrink-0 text-[#f07d33]' />
                                    {step.label}
                                </div>
                                <p className='mt-2 text-xs leading-5 text-bright/48'>{step.detail}</p>
                            </div>
                        )
                    })}
                </div>

                <div className='flex flex-wrap items-center gap-2 text-sm text-bright/45'>
                    <LockKeyhole className='h-4 w-4' />
                    {secondaryLinks.map((link) => (
                        <Link key={link.href} href={link.href} className='rounded-full px-3 py-1.5 transition-colors hover:bg-bright/8 hover:text-bright/75'>
                            {link.label}
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    )
}
