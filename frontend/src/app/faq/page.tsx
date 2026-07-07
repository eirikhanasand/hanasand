import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { faqs } from '../faqData'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'FAQ',
    description: 'Answers about Hanasand threat intelligence, exposure alerts, ransomware monitoring, and dark web monitoring.',
    path: '/faq',
    keywords: ['hanasand faq', 'threat intelligence faq', 'dark web monitoring faq', 'ransomware monitoring faq'],
})

export default function FAQPage() {
    return (
        <main className='min-h-full bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-5xl gap-5 px-4 py-14 md:px-8 md:py-20'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>FAQ</p>
                    <h1 className='text-4xl font-semibold tracking-normal text-ui-text md:text-6xl'>Questions security teams ask before trusting a new signal.</h1>
                    <p className='max-w-3xl text-base leading-7 text-ui-muted'>
                        Straight answers about threat actors, exposure monitoring, alerts, routing, and what Hanasand does or does not prove.
                    </p>
                </div>
            </section>

            <section className='mx-auto grid max-w-5xl gap-4 px-4 py-12 md:px-8'>
                {faqs.map(item => (
                    <article key={item.question} className='landing-surface-border rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                        <h2 className='text-lg font-semibold text-ui-text'>{item.question}</h2>
                        <p className='mt-2 text-sm leading-6 text-ui-muted'>{item.answer}</p>
                    </article>
                ))}
                <Link href='/contact' className='landing-primary-action mt-2 inline-flex w-fit items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition'>
                    Ask a different question
                    <ArrowRight className='h-4 w-4' />
                </Link>
            </section>
        </main>
    )
}
