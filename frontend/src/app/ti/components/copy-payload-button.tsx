'use client'

import { CheckCircle2, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function CopyPayloadButton({ label, payload, showLabel = false }: { label: string; payload: unknown; showLabel?: boolean }) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
    const resetTimerRef = useRef<number | null>(null)
    const feedback = state === 'copied' ? 'Copied' : state === 'failed' ? 'Unavailable' : ''
    const visibleLabel = feedback || (showLabel ? label : '')
    const className = `inline-flex min-h-8 ${visibleLabel ? 'min-w-16 px-2.5' : 'min-w-8 px-2'} max-w-full items-center justify-center gap-1.5 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised`

    useEffect(() => {
        return () => {
            if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
        }
    }, [])

    function resetLater(delay: number) {
        if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = window.setTimeout(() => {
            resetTimerRef.current = null
            setState('idle')
        }, delay)
    }

    async function copyPayload() {
        const text = JSON.stringify(payload, null, 2)
        try {
            await navigator.clipboard.writeText(text)
            setState('copied')
            resetLater(1800)
        } catch {
            setState('failed')
            resetLater(2200)
        }
    }

    return (
        <button type='button' onClick={copyPayload} className={className} aria-label={`Copy ${label} payload`} title={`Copy ${label}`}>
            {state === 'copied' ? <CheckCircle2 className='h-3.5 w-3.5 text-ui-success' /> : <Copy className='h-3.5 w-3.5' />}
            {visibleLabel}
        </button>
    )
}
