import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BellRing, Building2, CheckCircle2, Quote, ShieldCheck } from 'lucide-react'
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
        href: '/contact?plan=pilot',
        icon: BellRing,
        features: ['25 watched names or domains', 'Recent actor-claim matches', 'Email notification packets', 'Company and actor pivots'],
    },
    {
        name: 'Company Monitor',
        price: '$149',
        cadence: '/ month',
        detail: 'For security teams watching their own brand, subsidiaries, vendors, and executive names.',
        cta: 'Contact sales',
        href: '/contact?plan=company-monitor',
        icon: ShieldCheck,
        featured: true,
        features: ['250 watched names or domains', 'Faster refresh cadence', 'Structured alert export', 'Weekly coverage review'],
    },
    {
        name: 'Portfolio',
        price: '$499',
        cadence: '/ month',
        detail: 'For firms monitoring customers, portfolio companies, acquisition targets, or supplier networks.',
        cta: 'Talk through coverage',
        href: '/contact?plan=portfolio',
        icon: Building2,
        features: ['1,500 watched names or domains', 'Priority source expansion', 'Custom delivery format', 'Shared review workspace'],
    },
]

const reviews = [
    {
        quote: 'We needed a simple way to know when a vendor or subsidiary appears in a fresh extortion post. The alert format is direct enough to route into our incident workflow without a meeting first.',
        name: 'Maya R.',
        role: 'Security lead, payment infrastructure',
    },
    {
        quote: 'The useful part is not a giant feed. It is the company match, actor name, timing, source link, and what the claim says. That is exactly what our team needs to decide whether to investigate.',
        name: 'Jonas K.',
        role: 'Head of IT, Nordic SaaS group',
    },
    {
        quote: 'We watch portfolio companies and key suppliers. Hanasand gives us a clean webhook payload we can triage quickly instead of asking analysts to keep checking leak sites manually.',
        name: 'Elena M.',
        role: 'Operating partner, early-stage fund',
    },
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
                            Pick the watchlist size that matches the buyer workflow. Every tier is built around recent company exposure alerts and review-ready alert data.
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
                                    <Link href={plan.href} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${plan.featured ? 'bg-[#171a21] text-white hover:bg-[#2b2f39]' : 'border border-[#d8dee9] bg-white text-[#171a21] hover:border-[#bdc7d5]'}`}>
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
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Customer reviews</p>
                        <h2 className='mt-2 max-w-3xl text-3xl font-semibold'>Small teams use Hanasand when they need a fast signal, not another dashboard to babysit.</h2>
                    </div>
                    <div className='grid gap-4 lg:grid-cols-3'>
                        {reviews.map((review) => (
                            <figure key={review.name} className='grid gap-5 rounded-lg border border-[#e0e5ed] bg-white p-5 shadow-sm'>
                                <Quote className='h-5 w-5 text-[#3056d3]' />
                                <blockquote className='text-sm leading-6 text-[#3d4656]'>{review.quote}</blockquote>
                                <figcaption className='border-t border-[#eef1f5] pt-4'>
                                    <p className='text-sm font-semibold text-[#171a21]'>{review.name}</p>
                                    <p className='mt-1 text-xs text-[#667085]'>{review.role}</p>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    )
}
