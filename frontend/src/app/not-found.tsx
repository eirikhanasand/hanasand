import Link from 'next/link'
import { ArrowRight, Network, Radar, Search, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { buildRouteMetadata } from './seo'
import NotFoundSuggestions from './not-found-suggestions'
import SupportAssistant from '@/components/support/supportAssistant'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Page Not Found',
    description: 'Find the right Hanasand monitoring, threat intelligence, pricing, or contact page.',
    path: '/',
    keywords: ['hanasand', 'threat intelligence', 'dark web monitoring'],
})

const recoveryLinks = [
    {
        title: 'Search threat intelligence',
        body: 'Look up a company, actor, domain, CVE, or recent claim.',
        href: '/ti',
        icon: Search,
    },
    {
        title: 'Dark web monitoring',
        body: 'See the monitoring product, webhook flow, and buyer use cases.',
        href: '/dwm',
        icon: Radar,
    },
    {
        title: 'Pricing',
        body: 'Review plans for watchlists, alert delivery, and API access.',
        href: '/pricing',
        icon: ShieldCheck,
    },
    {
        title: 'Browser',
        body: 'Open suspicious sites in an isolated browser.',
        href: '/browser',
        icon: Network,
    },
]

export default function NotFound() {
    return (
        <main className='min-h-[calc(100vh-5.5rem)] bg-white px-4 py-10 text-black md:px-8'>
            <SupportAssistant force />
            <section className='mx-auto grid max-w-6xl gap-8 py-8 md:py-14'>
                <div className='grid max-w-3xl gap-4'>
                    <h1 className='text-4xl font-semibold tracking-normal text-black md:text-6xl'>This page does not exist</h1>
                    <p className='text-base leading-7 text-black md:text-lg'>
                        The link may have moved, or it is private.
                    </p>
                    <div className='flex flex-wrap gap-3'>
                        <Link href='/ti' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-black transition hover:opacity-90'>
                            Search threat intelligence
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                        <Link href='/contact?intent=dwm' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-white px-4 text-sm font-semibold text-black transition hover:border-ui-primary'>
                            Contact sales
                        </Link>
                    </div>
                </div>

                <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                    {recoveryLinks.map((item) => {
                        const Icon = item.icon
                        return (
                            <Link key={item.href} href={item.href} className='group grid gap-4 rounded-lg border border-ui-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-ui-primary hover:shadow-md'>
                                <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-gray-100 text-black'>
                                    <Icon className='h-5 w-5' />
                                </span>
                                <span className='grid gap-2'>
                                    <span className='flex items-center justify-between gap-3 text-base font-semibold text-black'>
                                        {item.title}
                                        <ArrowRight className='h-4 w-4 shrink-0 text-black transition' />
                                    </span>
                                    <span className='text-sm leading-6 text-black'>{item.body}</span>
                                </span>
                            </Link>
                        )
                    })}
                </div>

                <NotFoundSuggestions />
            </section>
        </main>
    )
}
