'use client'

import { useEffect, useId, useRef } from 'react'
import { Info } from 'lucide-react'

export default function ServiceAccountDescription({ name, description }: { name: string, description: string }) {
    const id = useId()
    const popup = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const long = description.length > 80 || description.includes('\n')

    useEffect(() => () => clearTimeout(hideTimer.current), [])

    function show() {
        clearTimeout(hideTimer.current)
        const panel = popup.current
        const button = trigger.current
        if (!panel || !button) return
        panel.showPopover()
        const rect = button.getBoundingClientRect()
        panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8))}px`
        panel.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - panel.offsetHeight - 8))}px`
    }

    function hideSoon() {
        clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(() => popup.current?.hidePopover(), 200)
    }

    return <div className='flex items-center gap-1'>
        {long ? <>
            <button ref={trigger} type='button' aria-label={`Description for ${name}`} aria-describedby={id} onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={hideSoon} onClick={show} className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised focus-visible:outline-ui-primary'><Info className='h-4 w-4' aria-hidden='true' /></button>
            <div ref={popup} id={id} popover='auto' role='tooltip' onMouseEnter={() => clearTimeout(hideTimer.current)} onMouseLeave={hideSoon} className='fixed m-0 max-h-[min(24rem,calc(100dvh-1rem))] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-xl border border-ui-border bg-ui-panel p-4 text-sm leading-6 text-ui-text shadow-xl'>{description}</div>
        </> : <span className='max-w-56 wrap-anywhere text-ui-muted'>{description || '—'}</span>}
    </div>
}
