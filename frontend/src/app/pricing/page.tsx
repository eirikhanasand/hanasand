import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BellRing, Building2, CheckCircle2, ShieldCheck } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Pricing',
    description: 'Pricing for Hanasand threat monitoring and company exposure alerts.',
    path: '/pricing',
    keywords: ['hanasand pricing', 'threat monitoring pricing', 'ransomware monitoring pricing'],
})

const plans = [
    {
        name: 'Pilot',
        price: '$49',
        cadence: '/ month',
        detail: 'Start monitoring a focused set of companies and domains.',
        cta: 'Start pilot',
        icon: BellRing,
        features: ['25 watched names or domains', 'Recent actor-claim matches', 'Email notification packets', 'Company and actor pivots'],
    },
    {
        name: 'Company Monitor',
        price: '$149',
        cadence: '/ month',
        detail: 'For security teams watching their own brand, subsidiaries, vendors, and executive names.',
        cta: 'Contact sales',
        icon: ShieldCheck,
        featured: true,
        features: ['250 watched names or domains', 'Faster refresh cadence', 'Structured metadata export', 'Weekly coverage review'],
    },
    {
        name: 'Portfolio',
        price: '$499',
        cadence: '/ month',
        detail: 'For firms monitoring customers, portfolio companies, acquisition targets, or supplier networks.',
        cta: 'Talk through coverage',
        icon: Building2,
        features: ['1,500 watched names or domains', 'Priority source expansion', 'Custom delivery format', 'Shared review workspace'],
    },
]

const reasons = [
    'The value is the early company mention, not another copy of public breach lists.',
    'Rows are shaped for monitoring workflows: actor, company, claim text, timing, source, and review state.',
    'Public indexes seed coverage; direct infrastructure checks and freshness logic make the product worth buying.',
]

export default function PricingPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] text-[#171a21]'>
            <section className='border-b border-[#e3e7ee] bg-white'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 md:py-20'>
                    <div className='mx-auto grid max-w-3xl justify-items-center gap-4 text-center'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Pricing</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>Threat monitoring priced for useful signals, not scraped volume.</h1>
                        <p className='text-lg leading-8 text-[#596170]'>
                            Pick the watchlist size that matches the buyer workflow. Every tier is built around recent company exposure alerts and reviewable metadata.
                        </p>
                    </div>

                    <div className='grid gap-4 lg:grid-cols-3'>
                        {plans.map((plan) => {
                            const Icon = plan.icon
                            return (
                                <article key={plan.name} className={`grid gap-5 rounded-lg border bg-white p-6 shadow-sm ${plan.featured ? 'border-[#3056d3] shadow-[0_20px_70px_rgba(48,86,211,0.14)]' : 'border-[#e0e5ed]'}`}>
                                    <div className='flex items-start justify-between gap-4'>
                                        <span className='grid h-12 w-12 place-items-center rounded-lg border border-[#dfe6f1] bg-[#f7f9fc] text-[#3056d3]'>
                                            <Icon className='h-5 w-5' />
                                        </span>
                                        {plan.featured ? <span className='rounded-full bg-[#eef3ff] px-2.5 py-1 text-xs font-semibold text-[#3056d3]'>Best fit</span> : null}
                                    </div>
                                    <div className='grid gap-2'>
                                        <h2 className='text-xl font-semibold'>{plan.name}</h2>
                                        <p className='min-h-14 text-sm leading-6 text-[#596170]'>{plan.detail}</p>
                                    </div>
                                    <div className='flex items-end gap-1'>
                                        <span className='text-4xl font-semibold'>{plan.price}</span>
                                        <span className='pb-1 text-sm font-medium text-[#667085]'>{plan.cadence}</span>
                                    </div>
                                    <Link href='/contact' className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${plan.featured ? 'bg-[#171a21] text-white hover:bg-[#2b2f39]' : 'border border-[#d8dee9] bg-white text-[#171a21] hover:border-[#bdc7d5]'}`}>
                                        {plan.cta}
                                        <ArrowRight className='h-4 w-4' />
                                    </Link>
                                    <div className='grid gap-3 border-t border-[#eef1f5] pt-5'>
                                        {plan.features.map((feature) => (
                                            <div key={feature} className='flex items-start gap-2 text-sm leading-6 text-[#3d4656]'>
                                                <CheckCircle2 className='mt-1 h-4 w-4 shrink-0 text-[#147a3b]' />
                                                <span>{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className='bg-[#f7f8fb]'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8 lg:grid-cols-[0.75fr_1.25fr]'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Why it sells</p>
                        <h2 className='mt-2 text-3xl font-semibold'>Small enough to buy, specific enough to matter.</h2>
                    </div>
                    <div className='grid gap-3'>
                        {reasons.map((reason) => (
                            <div key={reason} className='rounded-lg border border-[#e0e5ed] bg-white p-4 text-sm leading-6 text-[#3d4656] shadow-sm'>
                                {reason}
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    )
}
