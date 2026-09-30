'use client'

import { techniqueDescription } from '../pageClientShared'

export default function TechniqueBadge({ attackId, name, tactic, detail }: { attackId: string; name: string; tactic: string; detail: string }) {
    const description = techniqueDescription(attackId, name, tactic, detail)
    return (
        <span className='group relative inline-flex'>
            <a
                href={`https://attack.mitre.org/techniques/${attackId.replace('.', '/')}/`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={`${attackId}: ${description}`}
                className='inline-flex min-h-8 items-center rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary transition hover:border-ui-primary hover:bg-ui-primary/15 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary dark:hover:border-ui-primary/35 dark:hover:bg-ui-primary/10'
            >
                {attackId}
            </a>
            <span className='pointer-events-none absolute left-1/2 top-9 z-20 hidden w-80 -translate-x-1/2 rounded-lg border border-ui-border bg-ui-panel p-3 text-left text-xs font-medium leading-5 text-ui-text shadow-xl group-hover:block group-focus-within:block dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                <span className='block font-semibold text-ui-text dark:text-ui-text'>{attackId}: {name}</span>
                <span className='mt-1 block text-ui-muted dark:text-ui-muted'>{tactic}</span>
                <span className='mt-2 block'>{description}</span>
            </span>
        </span>
    )
}
