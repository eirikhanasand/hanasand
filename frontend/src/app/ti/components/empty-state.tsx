'use client'

import { Building2, HelpCircle, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

export default function EmptyState() {
    const [showSearchHelp, setShowSearchHelp] = useState(false)
    const launchItems = [
        { label: 'APT29', href: '/ti/APT29', icon: <ShieldCheck className='h-4 w-4' /> },
        { label: 'LockBit', href: '/ti/LockBit', icon: <ShieldAlert className='h-4 w-4' /> },
        { label: 'microsoft.com', href: '/ti/Microsoft', icon: <Building2 className='h-4 w-4' /> },
    ]
    const outcomeItems = [
        ['Recent evidence', 'Recent company, actor, domain, and detail results with evidence strength, last-seen age, source family, and review state.'],
        ['Sources', 'Linked source references and open questions so analysts can judge whether a result is useful.'],
        ['Watchlist fit', 'Company, supplier, domain, and portfolio terms are separated from broad actor background.'],
        ['Follow-up actions', 'Review, watch, escalate, export, or open the authenticated console when the result needs follow-up.'],
    ]

    return (
        <section data-ti-empty-workspace='true' className='grid justify-items-center gap-4 text-center'>
            <div className='flex flex-wrap justify-center gap-2'>
                {launchItems.map(item => (
                    <Link key={item.href} href={item.href} className='inline-flex h-9 items-center gap-2 rounded-full border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        <span className='text-ui-primary dark:text-ui-primary'>{item.icon}</span>
                        {item.label}
                    </Link>
                ))}
                <button type='button' onClick={() => setShowSearchHelp(true)} className='inline-flex h-9 items-center gap-2 rounded-full border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised' aria-haspopup='dialog'>
                    <HelpCircle className='h-4 w-4 text-ui-primary dark:text-ui-primary' />
                    Search help
                </button>
            </div>
            <p className='text-sm text-ui-muted dark:text-ui-muted'>No new <Link href='/findings' className='font-semibold text-ui-primary underline decoration-ui-primary/60 underline-offset-2 hover:decoration-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>alerts</Link>.</p>
            {showSearchHelp ? (
                <div className='fixed inset-0 z-1100 grid place-items-center bg-ui-backdrop px-4 py-6' role='dialog' aria-modal='true' aria-labelledby='ti-search-help-title'>
                    <div className='absolute inset-0' onClick={() => setShowSearchHelp(false)} aria-hidden='true' />
                    <div className='relative grid w-full max-w-2xl gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 text-left shadow-2xl dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <h2 id='ti-search-help-title' className='text-base font-semibold text-ui-text dark:text-ui-text'>Search examples</h2>
                                <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                                    Try an actor, company, domain, CVE, or malware name: Lazy Bear, APT29, LockBit, microsoft.com, CVE-2024-3094.
                                </p>
                            </div>
                            <button type='button' onClick={() => setShowSearchHelp(false)} className='grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:border-ui-primary hover:text-ui-primary' aria-label='Close search help'>
                                <XCircle className='h-4 w-4' />
                            </button>
                        </div>
                        <div className='grid gap-2 sm:grid-cols-2'>
                            {outcomeItems.map(([title, detail]) => (
                                <div key={title} className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                                    <p className='text-sm font-semibold text-ui-text dark:text-ui-text'>{title}</p>
                                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{detail}</p>
                                </div>
                            ))}
                        </div>
                        <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                            Public results use reviewable metadata and sources. Customer notification, saved watchlists, and delivery destinations continue in the authenticated console.
                        </p>
                    </div>
                </div>
            ) : null}
        </section>
    )
}
