'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

export default function BrowserDebug({ indicatorCount, logs = [], className = '' }: { indicatorCount: number; logs?: string[]; className?: string }) {
    const [pretty, setPretty] = useState(false)

    return <details className={`group/debug min-w-0 rounded-lg border border-ui-border bg-ui-panel text-xs text-ui-muted ${className}`}>
        <summary className='flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 font-semibold text-ui-primary hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary [&::-webkit-details-marker]:hidden'>
            <ChevronRight aria-hidden='true' className='h-4 w-4 shrink-0 transition-transform group-open/debug:rotate-90' />Debug
        </summary>
        <div className='border-t border-ui-border p-3'>
            <div className='flex items-center gap-3'>
                <span>{indicatorCount} Indicators</span>
                <button type='button' className='underline underline-offset-2' aria-pressed={pretty} onClick={() => setPretty(value => !value)}>{pretty ? 'Raw' : 'Pretty'}</button>
            </div>
            {logs.length ? pretty ? <div className='mt-2 max-h-64 overflow-auto overscroll-contain'>
                <table className='w-full table-fixed text-left'>
                    <caption className='sr-only'>Website debug logs</caption>
                    <thead><tr><th scope='col' className='w-20 p-2'>Level</th><th scope='col' className='p-2'>Message</th></tr></thead>
                    <tbody>{logs.map((log, index) => {
                        const fields = /^\[([^\]\r\n]+)\] ?([\s\S]*)$/.exec(log)
                        return <tr key={index} className='border-t border-ui-border align-top'>
                            <td className='wrap-break-word p-2'>{fields?.[1]}</td>
                            <td className='whitespace-pre-wrap break-all p-2 font-mono'>{fields ? fields[2] : log}</td>
                        </tr>
                    })}</tbody>
                </table>
            </div> : <pre className='mt-2 max-h-64 overflow-auto overscroll-contain whitespace-pre-wrap break-all font-mono'>{logs.join('\n')}</pre> : null}
        </div>
    </details>
}
