'use client'

import type { ReactNode } from 'react'

type SidebarTooltipProps = {
    label: string
    side?: 'left' | 'right'
    children: ReactNode
}

export default function SidebarTooltip({ label, side = 'right', children }: SidebarTooltipProps) {
    const position = side === 'left'
        ? 'right-full mr-2'
        : 'left-full ml-2'

    return (
        <div className='group/tooltip relative grid place-items-center'>
            {children}
            <span
                className={`pointer-events-none absolute top-1/2 z-200 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-bright/10 bg-background/95 px-2 py-1 text-[11px] font-semibold leading-none text-bright/72 shadow-2xl shadow-black/30 backdrop-blur-md group-hover/tooltip:block group-focus-within/tooltip:block ${position}`}
            >
                {label}
            </span>
        </div>
    )
}
