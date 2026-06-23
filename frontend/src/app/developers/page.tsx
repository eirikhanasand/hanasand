import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Braces, CheckCircle2, Code2, Database, Mail, Webhook } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Developers',
    description: 'Developer integration notes for Hanasand threat monitoring metadata and company exposure alerts.',
    path: '/developers',
    keywords: ['hanasand developers', 'threat intelligence api', 'exposure alert metadata'],
})

const fields = [
    'actorName',
    'victimName',
    'claimDate',
    'sourceUrl',
    'claimedDataDescription',
    'sector',
    'country',
    'reviewState',
]

const delivery = [
    { title: 'Search and console', detail: 'Use the TI surface for manual lookup, actor pivots, and company review.', icon: Code2 },
    { title: 'Structured exports', detail: 'Shape alert rows for review queues, spreadsheets, CRM notes, or security workflows.', icon: Database },
    { title: 'Webhook-ready packets', detail: 'Keep payloads small: watched entity, actor, claim metadata, source, timestamps, and review status.', icon: Webhook },
]

const alertExample = [
    '{',
    '  "watchlistMatch": "acme.com",',
    '  "actorName": "Akira",',
    '  "victimName": "Acme Manufacturing",',
    '  "claimDate": "2026-06-22",',
    '  "claimedDataDescription": "finance and HR documents",',
    '  "sourceUrl": "https://...",',
    '  "reviewState": "needs_review"',
    '}',
].join('\n')

export default function DevelopersPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] text-[#171a21]'>
            <section className='border-b border-[#e3e7ee] bg-white'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center'>
                    <div className='grid gap-5'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Developers</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>Integrate compact exposure metadata.</h1>
                        <p className='max-w-2xl text-lg leading-8 text-[#596170]'>
                            Hanasand is being shaped around compact, reviewable alert records for company monitoring: actor, victim, claim, source, timing, and watchlist context.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/ti' className='inline-flex h-11 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                                Try search
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/contact' className='inline-flex h-11 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5]'>
                                Request access
                            </Link>
                        </div>
                    </div>

                    <div className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-[#111318] shadow-[0_20px_70px_rgba(26,35,55,0.16)]'>
                        <div className='flex items-center justify-between border-b border-white/10 px-4 py-3'>
                            <div className='flex items-center gap-2 text-sm font-semibold text-white'>
                                <Braces className='h-4 w-4 text-[#7ca4ff]' />
                                alert.json
                            </div>
                            <span className='rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white/70'>metadata</span>
                        </div>
                        <pre className='overflow-x-auto p-5 text-sm leading-7 text-[#d8e2f2]'>
                            {alertExample}
                        </pre>
                    </div>
                </div>
            </section>

            <section className='bg-[#f7f8fb]'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-8 lg:grid-cols-[0.85fr_1.15fr]'>
                    <div className='grid gap-4'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Core fields</p>
                        <h2 className='text-3xl font-semibold'>Built for queues, dashboards, and notifications.</h2>
                        <p className='text-base leading-7 text-[#596170]'>
                            The important product decision is keeping the output specific enough for security workflows: one alert packet, clear fields, source context, and review state.
                        </p>
                    </div>
                    <div className='grid gap-3 md:grid-cols-2'>
                        {fields.map((field) => (
                            <div key={field} className='flex items-center gap-2 rounded-lg border border-[#e0e5ed] bg-white p-3 text-sm font-semibold text-[#3d4656] shadow-sm'>
                                <CheckCircle2 className='h-4 w-4 text-[#147a3b]' />
                                <code>{field}</code>
                            </div>
                        ))}
                    </div>
                </div>

                <div className='mx-auto grid max-w-7xl gap-4 px-4 pb-14 md:px-8 lg:grid-cols-3'>
                    {delivery.map((item) => {
                        const Icon = item.icon
                        return (
                            <article key={item.title} className='grid gap-4 rounded-lg border border-[#e0e5ed] bg-white p-5 shadow-sm'>
                                <span className='grid h-11 w-11 place-items-center rounded-lg border border-[#dfe6f1] bg-[#f7f9fc] text-[#3056d3]'>
                                    <Icon className='h-5 w-5' />
                                </span>
                                <div className='grid gap-2'>
                                    <h2 className='text-lg font-semibold'>{item.title}</h2>
                                    <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                </div>
                            </article>
                        )
                    })}
                </div>

                <div className='mx-auto max-w-7xl px-4 pb-16 md:px-8'>
                    <div className='flex flex-col gap-3 rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between'>
                        <div className='grid gap-1'>
                            <h2 className='text-lg font-semibold'>Need a specific delivery format?</h2>
                            <p className='text-sm text-[#596170]'>Send the queue, alerting system, or dashboard shape you want the metadata to fit.</p>
                        </div>
                        <Link href='/contact' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            <Mail className='h-4 w-4' />
                            Contact sales
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}
