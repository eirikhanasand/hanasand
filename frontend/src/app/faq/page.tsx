import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import FAQClient from '../faqClient'
import { faqCategories, faqs } from '../faqData'
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
            <section className='border-b border-ui-border bg-ui-panel/60'>
                <div className='mx-auto grid max-w-6xl gap-5 px-4 py-14 md:px-8 md:py-20'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>FAQ</p>
                    <h1 className='max-w-4xl text-4xl font-semibold tracking-normal text-ui-text md:text-6xl'>Answers for security teams evaluating Hanasand.</h1>
                    <p className='max-w-2xl text-base leading-7 text-ui-muted'>
                        Short explanations of threat actors, monitoring coverage, alert confidence, routing, and what each signal does or does not prove.
                    </p>
                    <Link href='/contact' className='inline-flex w-fit items-center gap-2 rounded-lg border border-ui-border px-4 py-2.5 text-sm font-semibold text-ui-primary transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                        Ask a different question
                        <ArrowRight className='h-4 w-4' />
                    </Link>
                </div>
            </section>

            <FAQClient categories={faqCategories} faqs={faqs} />
        </main>
    )
}
