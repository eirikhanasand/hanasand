'use client'

import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default function DashboardDwmError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Dark web monitoring'
                title='Dark web cases'
                description='The page could not show the current attacks and evidence.'
            />
            <section className='rounded-lg border border-ui-danger/30 bg-ui-danger/10 p-5'>
                <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                    <div className='flex gap-3'>
                        <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ui-danger/25 bg-ui-danger/10 text-ui-danger'>
                            <AlertTriangle className='h-5 w-5' />
                        </span>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Case view failed</h2>
                            <p className='mt-2 max-w-2xl text-sm leading-6 text-ui-muted'>
                                Retry the page after the dark web API or dashboard bundle is healthy. Case actions are not attempted from this error state.
                            </p>
                            <p className='mt-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 font-mono text-xs text-ui-danger'>
                                {error.message || error.digest || 'Unknown dashboard render error'}
                            </p>
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={reset}
                        className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'
                    >
                        <RefreshCcw className='h-4 w-4' />
                        Retry
                    </button>
                </div>
            </section>
        </DashboardPage>
    )
}
