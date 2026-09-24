'use client'

import { useRef } from 'react'
import { ChartNoAxesCombined, X } from 'lucide-react'
import BrowserRunMetrics, { type RunMetrics } from '../BrowserRunMetrics'

export default function ReportStatistics({ metrics }: { metrics: RunMetrics }) {
    const dialog = useRef<HTMLDialogElement>(null)
    return <>
        <button type='button' aria-label='Statistics' title='Statistics' onClick={() => dialog.current?.showModal()} className='rounded-md border border-ui-border p-2 text-ui-text hover:border-ui-primary'><ChartNoAxesCombined className='h-5 w-5' /></button>
        <dialog ref={dialog} aria-labelledby='report-statistics-title' onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }} className='fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-lg border border-ui-border bg-ui-panel p-5 text-ui-text shadow-xl backdrop:bg-black/60'>
            <div className='mb-4 flex items-center justify-between gap-4'>
                <h2 id='report-statistics-title' className='text-lg font-semibold'>Statistics</h2>
                <button type='button' aria-label='Close statistics' onClick={() => dialog.current?.close()} className='rounded-md p-1 hover:bg-ui-raised'><X className='h-5 w-5' /></button>
            </div>
            <BrowserRunMetrics metrics={metrics} />
        </dialog>
    </>
}
