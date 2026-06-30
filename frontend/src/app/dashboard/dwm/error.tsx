'use client'

import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default function DashboardDwmError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Dark web monitoring'
                title='Exposure workbench'
                description='The workbench could not render the current queue and evidence state.'
            />
            <section className='rounded-lg border border-[#fde2d6] bg-[#fffaf7] p-5'>
                <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                    <div className='flex gap-3'>
                        <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff0eb] text-[#c2410c]'>
                            <AlertTriangle className='h-5 w-5' />
                        </span>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Workbench render failed</h2>
                            <p className='mt-2 max-w-2xl text-sm leading-6 text-[#596170]'>
                                Retry the page after the DWM API or dashboard bundle is healthy. Workflow actions are not attempted from this error state.
                            </p>
                            <p className='mt-3 rounded-lg border border-[#fde2d6] bg-white px-3 py-2 font-mono text-xs text-[#9a3412]'>
                                {error.message || error.digest || 'Unknown dashboard render error'}
                            </p>
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={reset}
                        className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'
                    >
                        <RefreshCcw className='h-4 w-4' />
                        Retry
                    </button>
                </div>
            </section>
        </DashboardPage>
    )
}
