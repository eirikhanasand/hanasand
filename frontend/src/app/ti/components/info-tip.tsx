'use client'

import { HelpCircle } from 'lucide-react'

export default function InfoTip({ label }: { label: string }) {
    return (
        <span className='group relative inline-flex'>
            <span
                tabIndex={0}
                aria-label={label}
                className='inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:text-ui-muted dark:hover:bg-ui-raised dark:hover:text-ui-on-primary'
            >
                <HelpCircle className='h-3.5 w-3.5' />
            </span>
            <span className='pointer-events-none absolute left-1/2 top-7 z-20 hidden w-72 -translate-x-1/2 rounded-lg border border-ui-border bg-ui-panel p-3 text-left text-xs font-medium leading-5 text-ui-text shadow-xl group-hover:block group-focus-within:block dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                {label}
            </span>
        </span>
    )
}
