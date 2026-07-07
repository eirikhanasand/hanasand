'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Minus, Plus, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { faqs, faqCategories } from './faqData'

type FAQ = typeof faqs[number]
type Category = typeof faqCategories[number]

type Props = {
    categories: readonly Category[]
    faqs: readonly FAQ[]
}

type Feedback = 'yes' | 'no'
const feedbackStorageKey = 'hanasand-faq-feedback'

export default function FAQClient({ categories, faqs }: Props) {
    const [openQuestion, setOpenQuestion] = useState<string>(faqs[0]?.question || '')
    const [feedback, setFeedback] = useState<Record<string, Feedback>>({})
    const [feedbackLoaded, setFeedbackLoaded] = useState(false)
    const grouped = useMemo(() => categories.map(category => ({
        category,
        items: faqs.filter(item => item.category === category),
    })).filter(group => group.items.length), [categories, faqs])

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(feedbackStorageKey)
            if (stored) setFeedback(JSON.parse(stored) as Record<string, Feedback>)
        } catch {
            setFeedback({})
        } finally {
            setFeedbackLoaded(true)
        }
    }, [])

    useEffect(() => {
        if (!feedbackLoaded) return
        window.localStorage.setItem(feedbackStorageKey, JSON.stringify(feedback))
    }, [feedback, feedbackLoaded])

    return (
        <div className='mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[13rem_1fr] md:px-8 md:py-16'>
            <nav className='hidden md:block' aria-label='FAQ sections'>
                <div className='sticky top-24 grid gap-1 text-sm'>
                    {grouped.map(group => (
                        <a key={group.category} href={`#${faqAnchor(group.category)}`} className='rounded-md px-3 py-2 font-medium text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>
                            {group.category}
                        </a>
                    ))}
                </div>
            </nav>

            <div className='grid gap-12'>
                {grouped.map(group => (
                    <section key={group.category} id={faqAnchor(group.category)} className='scroll-mt-24'>
                        <h2 className='text-2xl font-semibold text-ui-text md:text-3xl'>{group.category}</h2>
                        <div className='mt-4 border-t border-ui-border'>
                            {group.items.map(item => {
                                const isOpen = openQuestion === item.question
                                const selected = feedback[item.question]

                                return (
                                    <article key={item.question} className='border-b border-ui-border'>
                                        <button
                                            type='button'
                                            className='grid w-full grid-cols-[1fr_auto] items-center gap-4 py-5 text-left text-base font-semibold text-ui-text transition hover:text-ui-primary md:text-lg'
                                            aria-expanded={isOpen}
                                            onClick={() => setOpenQuestion(isOpen ? '' : item.question)}
                                        >
                                            <span>{item.question}</span>
                                            <span className='grid h-8 w-8 place-items-center rounded-full bg-ui-raised text-ui-muted'>
                                                {isOpen ? <Minus className='h-4 w-4' /> : <Plus className='h-4 w-4' />}
                                            </span>
                                        </button>

                                        {isOpen ? (
                                            <div className='grid max-w-3xl gap-5 pb-6'>
                                                <p className='text-base leading-8 text-ui-muted'>{item.answer}</p>
                                                <div className='flex w-fit flex-wrap items-center gap-2 rounded-full bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                                                    <span className='font-semibold'>Was this useful?</span>
                                                    <button
                                                        type='button'
                                                        aria-pressed={selected === 'yes'}
                                                        className={`inline-flex h-8 items-center gap-1 rounded-full px-3 font-semibold transition ${selected === 'yes' ? 'bg-ui-primary text-white' : 'hover:bg-ui-panel hover:text-ui-text'}`}
                                                        onClick={() => setFeedback(current => ({ ...current, [item.question]: 'yes' }))}
                                                    >
                                                        {selected === 'yes' ? <Check className='h-4 w-4' /> : <ThumbsUp className='h-4 w-4' />}
                                                        Yes
                                                    </button>
                                                    <button
                                                        type='button'
                                                        aria-pressed={selected === 'no'}
                                                        className={`inline-flex h-8 items-center gap-1 rounded-full px-3 font-semibold transition ${selected === 'no' ? 'bg-ui-primary text-white' : 'hover:bg-ui-panel hover:text-ui-text'}`}
                                                        onClick={() => setFeedback(current => ({ ...current, [item.question]: 'no' }))}
                                                    >
                                                        {selected === 'no' ? <Check className='h-4 w-4' /> : <ThumbsDown className='h-4 w-4' />}
                                                        No
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </article>
                                )
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    )
}

function faqAnchor(category: string) {
    return category.toLowerCase().replaceAll(' ', '-')
}
