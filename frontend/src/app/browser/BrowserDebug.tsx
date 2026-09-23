'use client'

import { useState } from 'react'

export default function BrowserDebug({ indicatorCount, logs = [], className = '' }: { indicatorCount: number; logs?: string[]; className?: string }) {
    const [pretty, setPretty] = useState(false)

    return <details className={`text-xs text-ui-muted ${className}`}>
        <summary className='cursor-pointer'>Debug</summary>
        <div className='mt-2 flex items-center gap-3'>
            <span>{indicatorCount} Indicators</span>
            <button type='button' className='underline underline-offset-2' aria-pressed={pretty} onClick={() => setPretty(value => !value)}>{pretty ? 'Raw' : 'Pretty'}</button>
        </div>
        {logs.length ? pretty ? <div className='mt-2 max-h-64 overflow-auto'>
            <table className='w-full table-fixed text-left'>
                <caption className='sr-only'>Debug logs</caption>
                <thead><tr><th scope='col' className='w-24 p-2'>Provider</th><th scope='col' className='w-20 p-2'>Level</th><th scope='col' className='p-2'>Message</th></tr></thead>
                <tbody>{logs.map((log, index) => {
                    const fields = /^\[([^\]\r\n]+)\]\s+\[([^\]\r\n]+)\] ?([\s\S]*)$/.exec(log)
                    return <tr key={index} className='border-t border-ui-border align-top'>
                        <td className='wrap-break-word p-2'>{fields?.[1]}</td>
                        <td className='wrap-break-word p-2'>{fields?.[2]}</td>
                        <td className='whitespace-pre-wrap break-all p-2 font-mono'>{fields ? fields[3] : log}</td>
                    </tr>
                })}</tbody>
            </table>
        </div> : <pre className='mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono'>{logs.join('\n')}</pre> : null}
    </details>
}
