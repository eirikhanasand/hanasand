import Link from 'next/link'
import { ArrowRight, Radar, Search, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { buildRouteMetadata } from './seo'
import NotFoundSuggestions from './not-found-suggestions'

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
]

export default function NotFound() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-10 text-ui-text md:px-8'>
            <section className='mx-auto grid max-w-6xl gap-8 py-8 md:py-14'>
                <div className='grid max-w-3xl gap-4'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Page not found</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>This page is not available.</h1>
                    <p className='text-base leading-7 text-ui-muted md:text-lg'>
                        The link may have moved, or the route may belong to a private workspace. The main product paths below will get you back to the monitoring data, API, and buying flow.
                    </p>
                    <div className='flex flex-wrap gap-3'>
                        <Link href='/ti' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            Open intelligence search
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                        <Link href='/contact?intent=dwm' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                            Contact sales
                        </Link>
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-3'>
                    {recoveryLinks.map((item) => {
                        const Icon = item.icon
                        return (
                            <Link key={item.href} href={item.href} className='group grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-ui-primary hover:shadow-md'>
                                <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                    <Icon className='h-5 w-5' />
                                </span>
                                <span className='grid gap-2'>
                                    <span className='flex items-center justify-between gap-3 text-base font-semibold text-ui-text'>
                                        {item.title}
                                        <ArrowRight className='h-4 w-4 shrink-0 text-ui-muted transition group-hover:text-ui-primary' />
                                    </span>
                                    <span className='text-sm leading-6 text-ui-muted'>{item.body}</span>
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
