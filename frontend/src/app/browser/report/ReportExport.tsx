'use client'

import { useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'

export default function ReportExport({ report, markdown }: { report: object; markdown: string }) {
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    async function download(format: 'markdown' | 'json' | 'pdf') {
        setBusy(true)
        setError('')
        try {
            if (format === 'pdf') {
                const { exportReportPdf } = await import('./reportPdf')
                await exportReportPdf(markdown)
            } else {
                const content = format === 'json' ? JSON.stringify({ schemaVersion: 1, ...report }, null, 2) : markdown
                const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' }))
                const link = document.createElement('a')
                link.href = url
                link.download = `browser-report.${format === 'json' ? 'json' : 'md'}`
                link.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
            }
            setOpen(false)
        } catch {
            setError('Could not export the report. Try again.')
        } finally { setBusy(false) }
    }
    return <div className='relative'>
        <button type='button' aria-expanded={open} disabled={busy} onClick={() => setOpen(value => !value)} className='flex items-center gap-2 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold hover:border-ui-primary'><Download className='h-4 w-4' />Export<ChevronDown className='h-4 w-4' /></button>
        {open ? <div aria-label='Export formats' className='absolute right-0 z-20 mt-1 grid min-w-36 rounded-md border border-ui-border bg-ui-panel p-1 shadow-lg' onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>{(['markdown', 'json', 'pdf'] as const).map(format => <button key={format} type='button' disabled={busy} onClick={() => void download(format)} className='rounded px-3 py-2 text-left text-sm hover:bg-ui-raised'>{format === 'markdown' ? 'Markdown' : format.toUpperCase()}</button>)}</div> : null}
        {error ? <p role='alert' className='mt-2 text-xs text-ui-danger'>{error}</p> : null}
    </div>
}
