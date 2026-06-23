import Link from 'next/link'
import { ArrowRight, Radar, Search, ShieldCheck } from 'lucide-react'

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
        href: '/solutions/dwm',
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
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] px-4 py-10 text-[#171a21] md:px-8'>
            <section className='mx-auto grid max-w-6xl gap-8 rounded-lg border border-[#dfe5ee] bg-white p-6 shadow-[0_20px_70px_rgba(26,35,55,0.10)] md:p-10'>
                <div className='grid max-w-3xl gap-4'>
                    <p className='text-sm font-semibold uppercase text-[#3056d3]'>Page not found</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>This page is not available.</h1>
                    <p className='text-base leading-7 text-[#596170] md:text-lg'>
                        The link may have moved, or the route may belong to a private workspace. The main product paths below will get you back to the monitoring data, API, and buying flow.
                    </p>
                    <div className='flex flex-wrap gap-3'>
                        <Link href='/ti' className='inline-flex h-11 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            Open intelligence search
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                        <Link href='/contact?intent=dwm' className='inline-flex h-11 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5]'>
                            Contact sales
                        </Link>
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-3'>
                    {recoveryLinks.map((item) => {
                        const Icon = item.icon
                        return (
                            <Link key={item.href} href={item.href} className='group grid gap-4 rounded-lg border border-[#e0e5ed] bg-[#f8fafc] p-5 transition hover:-translate-y-0.5 hover:border-[#c9d2df] hover:bg-white hover:shadow-[0_18px_50px_rgba(26,35,55,0.10)]'>
                                <span className='grid h-11 w-11 place-items-center rounded-lg border border-[#dfe6f1] bg-white text-[#3056d3]'>
                                    <Icon className='h-5 w-5' />
                                </span>
                                <span className='grid gap-2'>
                                    <span className='flex items-center justify-between gap-3 text-base font-semibold text-[#171a21]'>
                                        {item.title}
                                        <ArrowRight className='h-4 w-4 shrink-0 text-[#98a2b3] transition group-hover:text-[#3056d3]' />
                                    </span>
                                    <span className='text-sm leading-6 text-[#596170]'>{item.body}</span>
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </section>
        </main>
    )
}
