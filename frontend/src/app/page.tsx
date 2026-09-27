import type { Metadata } from 'next'
import './homepage.css'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'
import LogoutClient from '@/components/logout/logoutClient'
import { exposureQueueFallback } from './exposureQueue'
import { buildRouteMetadata } from './seo'
import { homepageFaqs } from './faqData'
import HomeExposureQueueClient from './homeExposureQueueClient'

export const revalidate = 5

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand Threat Intelligence',
    description: 'Know what is exposed before it is too late. Monitor companies and vendors with source links and context your team can act on.',
    path: '/',
    keywords: ['hanasand', 'threat intelligence', 'ransomware monitoring', 'dark web monitoring', 'company exposure alerts'],
})

const consoleActions = [
    { label: 'Monitor companies', detail: 'Companies, vendors, domains', href: '/organizations' },
    { label: 'Review alerts', detail: 'Exposure mentions and next steps', href: '/dwm' },
    { label: 'Search intelligence', detail: 'Groups, sources, and activity', href: '/ti' },
    { label: 'Route notifications', detail: 'Email, webhooks, and API', href: '/automation?setup=dwm' },
]

const solutions = [
    { title: 'Monitoring', href: '/ti' },
    { title: 'Isolated browser', href: '/browser' },
    { title: 'Trust center', href: '/trust' },
    { title: 'Shared reports', href: '/contact?intent=reports' },
]

export default function Page() {
    const exposureQueue = exposureQueueFallback('checking', 10)

    return (
        <main className='home-page min-h-full text-ui-text'>
            <LogoutClient logoutServer={false} />

            <section className='home-hero relative isolate overflow-hidden'>
                <div className='home-hero-art' aria-hidden='true'>
                    <Image src='/lantern-hero.png' alt='' fill priority sizes='(max-width: 768px) 100vw, 68vw' className='object-cover object-center' />
                </div>
                <div className='home-hero-glow' aria-hidden='true' />
                <div className='home-wrap relative grid min-h-[680px] content-center gap-10 px-5 py-20 md:min-h-[760px] md:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-0 lg:px-16'>
                    <div className='home-hero-copy relative z-10 grid content-center justify-items-start gap-8'>
                        <Link href='/organizations' className='home-monitor-link inline-flex min-h-14 items-center gap-3 rounded-full border px-5 py-3 text-sm font-semibold transition'>
                            <span>Start monitoring</span>
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                        <div className='grid max-w-4xl gap-6'>
                            <h1 className='max-w-4xl text-[clamp(2.8rem,5.4vw,5.4rem)] font-medium leading-[0.94] tracking-[-0.065em]'>
                                Know what’s exposed <span className='home-heading-muted'>before it’s too late.</span>
                            </h1>
                            <p className='max-w-xl text-base leading-7 text-ui-muted md:text-lg md:leading-8'>
                                Company monitoring done right. Track company and vendor mentions with source links and context your team can act on.
                            </p>
                        </div>
                        <form action='/ti' className='home-search flex w-full max-w-xl items-center gap-3 rounded-full border px-4 py-1.5'>
                            <Search className='h-4 w-4 shrink-0 text-ui-muted' />
                            <input name='q' aria-label='Search threat intelligence' placeholder='Search a company, vendor, or domain' className='h-11 min-w-0 flex-1 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted/70' />
                            <button type='submit' className='home-search-button rounded-full px-4 py-2 text-sm font-semibold transition'>Search</button>
                        </form>
                    </div>
                    <div className='hidden lg:block' aria-hidden='true' />
                </div>
                <div className='home-hero-caption home-wrap relative px-5 pb-6 text-xs tracking-[0.14em] text-ui-muted md:px-10 lg:px-16'>
                    CONTINUOUSLY MONITORED
                </div>
            </section>

            <section className='home-section home-activity' aria-labelledby='latest-activity-title'>
                <div className='home-wrap grid gap-8 px-5 py-20 md:px-10 md:py-28 lg:px-16'>
                    <div className='flex flex-wrap items-end justify-between gap-5'>
                        <div className='grid gap-3'>
                            <p className='home-eyebrow'>Live intelligence</p>
                            <h2 id='latest-activity-title' className='text-3xl font-medium tracking-[-0.04em] md:text-5xl'>Latest activity</h2>
                        </div>
                        <Link href='/activity' className='home-text-link inline-flex items-center gap-2 text-sm font-semibold'>
                            Open activity <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                    <HomeExposureQueueClient initialQueue={exposureQueue} />
                </div>
            </section>

            <section className='home-section home-console' aria-labelledby='console-title'>
                <div className='home-wrap grid gap-8 px-5 py-16 md:grid-cols-[0.7fr_1.3fr] md:gap-16 md:px-10 md:py-24 lg:px-16'>
                    <div className='grid content-start gap-4'>
                        <p className='home-eyebrow'>Console</p>
                        <h2 id='console-title' className='text-3xl font-medium tracking-[-0.04em] md:text-4xl'>Get started.</h2>
                        <Link href='/dashboard' className='home-text-link mt-2 inline-flex w-fit items-center gap-2 text-sm font-semibold'>
                            Go to dashboard <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                    <nav aria-label='Console actions' className='home-action-list grid sm:grid-cols-2'>
                        {consoleActions.map((item, index) => (
                            <Link key={item.href} href={item.href} className='home-action group flex min-h-24 items-center justify-between gap-4 border-b px-1 py-5'>
                                <span className='flex items-start gap-4'>
                                    <span className='home-action-index pt-0.5 text-xs tabular-nums'>{String(index + 1).padStart(2, '0')}</span>
                                    <span className='grid gap-1'>
                                        <span className='text-base font-semibold'>{item.label}</span>
                                        <span className='text-sm text-ui-muted'>{item.detail}</span>
                                    </span>
                                </span>
                                <ArrowRight className='home-action-arrow h-4 w-4 shrink-0 transition group-hover:translate-x-1' />
                            </Link>
                        ))}
                    </nav>
                </div>
            </section>

            <section className='home-section home-faq' aria-labelledby='faq-title'>
                <div className='home-wrap grid gap-10 px-5 py-20 md:grid-cols-[0.7fr_1.3fr] md:gap-16 md:px-10 md:py-28 lg:px-16'>
                    <div className='grid content-start gap-4'>
                        <p className='home-eyebrow'>FAQ</p>
                        <h2 id='faq-title' className='text-3xl font-medium tracking-[-0.04em] md:text-4xl'>A few useful answers.</h2>
                    </div>
                    <div className='home-faq-list'>
                        {homepageFaqs.slice(0, 3).map(item => <FaqItem key={item.question} item={item} />)}
                        <details className='home-faq-more'>
                            <summary>More questions <span aria-hidden='true'>+</span></summary>
                            <div className='home-faq-list home-faq-expanded'>
                                {homepageFaqs.slice(3, 10).map(item => <FaqItem key={item.question} item={item} />)}
                                <Link href='/faq' className='home-faq-all inline-flex min-h-12 items-center gap-2 text-sm font-semibold'>Read all FAQs <ArrowRight className='h-4 w-4' /></Link>
                            </div>
                        </details>
                    </div>
                </div>
            </section>

            <section className='home-solutions' aria-labelledby='solutions-title'>
                <div className='home-wrap grid gap-8 px-5 py-14 md:grid-cols-[0.7fr_1.3fr] md:items-end md:px-10 lg:px-16'>
                    <div className='grid gap-3'>
                        <p className='home-eyebrow'>Solutions</p>
                        <h2 id='solutions-title' className='text-2xl font-medium tracking-[-0.035em] md:text-3xl'>Tools for the next step.</h2>
                    </div>
                    <div className='home-solution-links grid gap-x-12 sm:grid-cols-2'>
                        {solutions.map(item => (
                            <Link key={item.href} href={item.href} className='home-solution-link flex items-center justify-between gap-6 border-b py-4 text-sm font-medium'>
                                <span>{item.title}</span><ArrowRight className='home-solution-arrow h-4 w-4 shrink-0' />
                            </Link>
                        ))}
                    </div>
                    <div className='md:col-start-2'>
                        <Link href='/dashboard' className='home-dashboard-link inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-semibold transition'>
                            Go to dashboard <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}

function FaqItem({ item }: { item: (typeof homepageFaqs)[number] }) {
    return (
        <details className='home-faq-item'>
            <summary>{item.question}<span aria-hidden='true'>+</span></summary>
            <p>{item.answer}</p>
        </details>
    )
}
