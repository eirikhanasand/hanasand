'use client'

import { displayRequirementText } from '../pageModel'
import { ExternalLink } from 'lucide-react'
import CopyPayloadButton from './copy-payload-button'

export default function PayloadHandoffRow({ label, detail, payload, route, blocked }: { label: string; detail: string; payload: unknown; route?: string; blocked: boolean }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{label}</p>
                        <span className={blocked ? 'rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning' : 'rounded-md border border-ui-success/35 bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'}>
                            {blocked ? 'syncing' : 'ready'}
                        </span>
                    </div>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(detail)}</p>
                </div>
                <div className='flex min-w-0 w-full flex-wrap items-center justify-start gap-1.5 sm:w-auto sm:justify-end sm:shrink-0'>
                    {route ? (
                        <a href={route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                            <ExternalLink className='h-3.5 w-3.5' />
                            Open
                        </a>
                    ) : null}
                    <CopyPayloadButton label={label} payload={payload} />
                </div>
            </div>
        </div>
    )
}
