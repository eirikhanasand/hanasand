'use client'

import { Inbox } from 'lucide-react'
import Link from 'next/link'

export default function TiCommandBar({ links }: { links: Array<{ href: string; label: string; value: string; icon: typeof Inbox }> }) {
    return (
        <nav data-ti-command-bar='true' className='grid min-w-0 gap-1.5 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-5' aria-label='Threat intelligence actions'>
            {links.map(({ href, label, value, icon: Icon }) => (
                <Link
                    key={`${label}-${href}`}
                    href={href}
                    className='group grid min-h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-left transition hover:border-ui-primary/35 hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-raised dark:hover:bg-ui-raised'
                >
                    <Icon className='h-4 w-4 text-ui-primary dark:text-ui-primary' />
                    <span className='min-w-0'>
                        <span className='block truncate text-xs font-semibold text-ui-text dark:text-ui-text'>{label}</span>
                        <span className='block truncate text-[11px] font-medium text-ui-muted dark:text-ui-muted'>{value}</span>
                    </span>
                </Link>
            ))}
        </nav>
    )
}
