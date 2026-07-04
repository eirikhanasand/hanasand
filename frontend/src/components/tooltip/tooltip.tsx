'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
    children: React.ReactNode
    content: React.ReactNode
    align?: 'left' | 'right'
}

export default function Tooltip({ children, content, align = 'left' }: TooltipProps) {
    const [visible, setVisible] = useState(false)
    const [pos, setPos] = useState({ x: 0, y: 0 })
    const ref = useRef<HTMLDivElement>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current || !tooltipRef.current) return
        const rect = ref.current.getBoundingClientRect()
        const tooltipRect = tooltipRef.current.getBoundingClientRect()

        let x = rect.left
        if (align === 'right') {
            x = rect.right - tooltipRect.width
        }

        setPos({ x, y: rect.bottom + 6 })
    }, [visible, align])

    return (
        <>
            <div
                ref={ref}
                className='inline-flex cursor-help'
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
            >
                {children}
            </div>

            {visible &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className='fixed z-99999 mb-2 max-w-xs rounded-md border border-ui-border bg-ui-panel p-2 text-xs text-ui-text shadow-lg shadow-ui-canvas/10 backdrop-blur-xs'
                        style={{ left: pos.x, top: pos.y }}
                    >
                        {content}
                    </div>,
                    document.body
                )}
        </>
    )
}
