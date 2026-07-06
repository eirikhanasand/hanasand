import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Braces, CheckCircle2, Code2, Database, KeyRound, Mail, ShieldCheck, Webhook } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Developers',
    description: 'Developer integration notes for Hanasand company exposure alerts and webhook delivery.',
    path: '/developers',
    keywords: ['hanasand developers', 'threat intelligence api', 'dark web monitoring webhooks'],
})

const fields = [
    'actorName',
    'victimName',
    'claimDate',
    'claimSize',
    'claimCategory',
    'sourceUrl',
    'claimedDataDescription',
    'sector',
    'country',
    'reviewState',
]

const delivery = [
    { title: 'Search and console', detail: 'Look up a company or actor, then open the matching console view.', icon: Code2 },
    { title: 'Structured exports', detail: 'Send alert rows to spreadsheets, CRM notes, tickets, or security tools.', icon: Database },
    { title: 'Webhook alerts', detail: 'Send watched entity, actor, claim, source, timestamps, and review status to the tools your team already uses.', icon: Webhook },
]

const integrationBoundaries = [
    { title: 'Review-safe payloads', detail: 'Alert records carry matched terms, source references, timing, claim summaries, and review status instead of raw leak material.', icon: ShieldCheck },
    { title: 'Scoped access', detail: 'API and webhook access is provisioned for the integration path being evaluated; enterprise identity requirements should be raised before rollout.', icon: KeyRound },
    { title: 'Operational handoff', detail: 'Use the alert fields below to route cases, suppress noise, and keep downstream systems aligned with analyst review state.', icon: CheckCircle2 },
]

const alertExample = [
    '{',
    '  "watchlistMatch": "acme.com",',
    '  "actorName": "Akira",',
    '  "victimName": "Acme Manufacturing",',
    '  "claimDate": "2026-06-22",',
    '  "claimSize": "5GB",',
    '  "claimCategory": "documents",',
    '  "claimedDataDescription": "finance and HR documents",',
    '  "sourceUrl": "https://hanasand.com/ti/acme-manufacturing",',
    '  "reviewState": "needs_review"',
    '}',
].join('\n')

export default function DevelopersPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center'>
                    <div className='grid gap-5'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Developers</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>Integrate company exposure alerts.</h1>
                        <p className='max-w-2xl text-lg leading-8 text-ui-muted'>
                            Hanasand sends reviewable alert records for company monitoring: actor, victim, claim, source, timing, and watchlist context.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/ti' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                Try search
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/contact?intent=api' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Request access
                            </Link>
                        </div>
                    </div>

                    <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-text shadow-md'>
                        <div className='flex items-center justify-between border-b border-ui-border/40 px-4 py-3'>
                            <div className='flex items-center gap-2 text-sm font-semibold text-ui-canvas'>
                                <Braces className='h-4 w-4 text-ui-primary' />
                                alert.json
                            </div>
                            <span className='rounded-full border border-ui-border/40 bg-ui-raised/10 px-2 py-1 text-xs font-medium text-ui-canvas/70'>webhook alert</span>
                        </div>
                        <pre className='overflow-x-auto whitespace-pre-wrap wrap-break-word p-5 text-sm leading-7 text-ui-canvas/85'>
                            {alertExample}
                        </pre>
                    </div>
                </div>
            </section>

            <section className='border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-4 px-4 py-10 md:px-8 lg:grid-cols-3'>
                    {integrationBoundaries.map((item) => {
                        const Icon = item.icon
                        return (
                            <article key={item.title} className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                                <span className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                    <Icon className='h-4 w-4' />
                                </span>
                                <div>
                                    <h2 className='text-base font-semibold text-ui-text'>{item.title}</h2>
                                    <p className='mt-2 text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                </div>
                            </article>
                        )
                    })}
                </div>
            </section>

            <section className='bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-8 lg:grid-cols-[0.85fr_1.15fr]'>
                    <div className='grid gap-4'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Core fields</p>
                        <h2 className='text-3xl font-semibold'>Built for tickets, dashboards, and notifications.</h2>
                        <p className='text-base leading-7 text-ui-muted'>
                            The important product decision is keeping the output specific enough for security teams: one alert, clear fields, source context, and review status.
                        </p>
                    </div>
                    <div className='grid gap-3 md:grid-cols-2'>
                        {fields.map((field) => (
                            <div key={field} className='flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 text-sm font-semibold text-ui-text shadow-sm'>
                                <CheckCircle2 className='h-4 w-4 text-ui-success' />
                                <code>{field}</code>
                            </div>
                        ))}
                    </div>
                </div>

                <div className='mx-auto grid max-w-7xl gap-4 px-4 pb-14 md:px-8 lg:grid-cols-3'>
                    {delivery.map((item) => {
                        const Icon = item.icon
                        return (
                            <article key={item.title} className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                                <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                    <Icon className='h-5 w-5' />
                                </span>
                                <div className='grid gap-2'>
                                    <h2 className='text-lg font-semibold'>{item.title}</h2>
                                    <p className='text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                </div>
                            </article>
                        )
                    })}
                </div>

                <div className='mx-auto max-w-7xl px-4 pb-16 md:px-8'>
                    <div className='flex flex-col gap-3 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm md:flex-row md:items-center md:justify-between'>
                        <div className='grid gap-1'>
                            <h2 className='text-lg font-semibold'>Need a specific delivery format?</h2>
                            <p className='text-sm text-ui-muted'>Send the ticket, alerting system, or dashboard shape you want the alerts to fit.</p>
                        </div>
                        <Link href='/contact?intent=api' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            <Mail className='h-4 w-4' />
                            Contact sales
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}
