'use client'

import { AlertTriangle, ArrowLeft, Home, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default function ImpersonationError({ reset }: { error: Error & { digest?: string }, reset: () => void }) {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Support'
                title='Helpdesk operations'
                description='The Helpdesk could not be loaded.'
            />
            <section className='rounded-lg border border-ui-danger/30 bg-ui-danger/10 p-5'>
                <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                    <div className='flex gap-3'>
                        <span className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-ui-danger/25 bg-ui-danger/10 text-ui-danger'>
                            <AlertTriangle className='h-5 w-5' />
                        </span>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Helpdesk unavailable</h2>
                            <p className='mt-2 max-w-2xl text-sm leading-6 text-ui-muted'>
                                The Helpdesk page hit an unexpected problem. Retry to reconnect to the support console; if it continues to fail, contact your Hanasand administrator.
                            </p>
                        </div>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <button type='button' onClick={reset} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            <RefreshCcw className='h-4 w-4' />
                            Retry
                        </button>
                        <Link href='/dashboard' className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                            <Home className='h-4 w-4' />
                            Dashboard
                        </Link>
                    </div>
                </div>
                <div className='mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-ui-danger/20 pt-4 text-sm'>
                    <Link href='/dashboard/system' className='inline-flex h-9 items-center gap-1 rounded-md border border-ui-border bg-ui-panel px-3 font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised'><ArrowLeft className='h-4 w-4' />System tools</Link>
                    <Link href='/dashboard/dwm' className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-panel px-3 font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised'>Monitoring</Link>
                    <Link href='/support' className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-panel px-3 font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised'>Support</Link>
                </div>
            </section>
        </DashboardPage>
    )
}
