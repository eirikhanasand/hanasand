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
                className="inline-flex cursor-help"
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
            >
                {children}
            </div>

            {visible &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className="fixed z-99999 p-2 rounded-md mb-2 bg-blue-400/20 text-white/70 outline outline-blue-400/40 max-w-xs text-xs"
                        style={{ left: pos.x, top: pos.y }}
                    >
                        {content}
                    </div>,
                    document.body
                )}
        </>
    )
}
