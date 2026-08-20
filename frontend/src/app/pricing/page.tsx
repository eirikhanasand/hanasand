import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { buildRouteMetadata } from '../seo'
import { commercialAccessPlans } from '@/utils/commercialAccess'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Pricing',
    description: 'Clear monthly plans for Hanasand threat intelligence, monitoring, scanning, and browser access.',
    path: '/pricing',
    keywords: ['hanasand pricing', 'threat monitoring pricing', 'security scanner pricing'],
})

export default function PricingPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-14 text-ui-text md:px-8'>
            <div className='mx-auto grid max-w-7xl gap-8'>
                <header className='mx-auto grid max-w-3xl gap-3 text-center'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Pricing</p>
                    <h1 className='text-4xl font-semibold md:text-6xl'>Know more. Respond faster.</h1>
                    <p className='text-lg leading-8 text-ui-muted'>Search threats. Watch your exposure. Scan your attack surface. Investigate what you find.</p>
                </header>
                <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4' aria-label='Available plans'>
                    {commercialAccessPlans.map(plan => (
                        <article key={plan.id} className={`flex flex-col rounded-md border bg-ui-panel p-5 ${plan.id === 'monitoring' ? 'border-ui-primary ring-1 ring-ui-primary/30' : 'border-ui-border'}`}>
                            <div className='flex-1'>
                                {plan.id === 'monitoring' ? <span className='rounded-full border border-ui-primary/40 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary'>Most popular</span> : null}
                                <h2 className='mt-3 text-xl font-semibold'>{plan.name}</h2>
                                <p className='mt-2 min-h-12 text-sm leading-5 text-ui-muted'>{plan.summary}</p>
                                <p className='mt-4 text-2xl font-semibold'><span className='font-mono tabular-nums tracking-tight'>{plan.priceNok}</span> kr / måned</p>
                                <p className='mt-1 text-sm font-semibold text-ui-primary'>{plan.quota}</p>
                                <Link href={`/api/billing/checkout?plan=${plan.id}`} className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-semibold ${plan.id === 'monitoring' ? 'bg-ui-primary text-ui-canvas' : 'border border-ui-border bg-ui-raised text-ui-text'}`}>Buy now</Link>
                                <div className='mt-4 border-t border-ui-border pt-3'>
                                    <p className='text-sm font-semibold'>What's included</p>
                                    <ul className='mt-3 grid gap-2 text-sm text-ui-muted'>
                                        {plan.features.map(feature => <li key={feature} className='flex items-start gap-2'><CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-ui-success' />{feature}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
                <p className='text-center text-xs text-ui-muted'>Secure checkout is handled by Stripe.</p>
            </div>
        </main>
    )
}
