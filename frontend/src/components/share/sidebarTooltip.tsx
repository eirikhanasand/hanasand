'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

type SidebarTooltipProps = {
    label: string
    side?: 'left' | 'right'
    children: ReactNode
}

export default function SidebarTooltip({ label, side = 'right', children }: SidebarTooltipProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<{ left: number, top: number } | null>(null)

    const updatePosition = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return

        setPosition({
            left: side === 'left' ? rect.left - 8 : rect.right + 8,
            top: rect.top + rect.height / 2,
        })
    }, [side])

    const showTooltip = () => updatePosition()
    const hideTooltip = () => setPosition(null)

    useEffect(() => {
        if (!position) return

        const refresh = () => updatePosition()
        window.addEventListener('resize', refresh)
        window.addEventListener('scroll', refresh, true)

        return () => {
            window.removeEventListener('resize', refresh)
            window.removeEventListener('scroll', refresh, true)
        }
    }, [position, updatePosition])

    return (
        <div
            ref={containerRef}
            className='relative grid place-items-center'
            onBlur={hideTooltip}
            onFocus={showTooltip}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
        >
            {children}
            {position ? createPortal(
                <span
                    className='pointer-events-none fixed z-[9999] whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold leading-none text-ui-muted shadow-lg shadow-ui-canvas/10 backdrop-blur-md'
                    style={{
                        left: position.left,
                        top: position.top,
                        transform: side === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)',
                    }}
                >
                    {label}
                </span>,
                document.body,
            ) : null}
        </div>
    )
}
