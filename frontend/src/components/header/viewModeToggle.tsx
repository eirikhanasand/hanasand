'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDashboardViewMode, setDashboardViewMode, type DashboardViewMode } from '@/utils/layout/viewMode'

export default function ViewModeToggle() {
    const [mode, setMode] = useState<DashboardViewMode>('normal')

    useEffect(() => {
        const initialMode = getDashboardViewMode()
        setMode(initialMode)

        function handleModeChange(event: Event) {
            const detail = (event as CustomEvent<DashboardViewMode>).detail
            if (detail === 'compact' || detail === 'normal') {
                setMode(detail)
            }
        }

        window.addEventListener('dashboard-view-mode', handleModeChange)
        return () => window.removeEventListener('dashboard-view-mode', handleModeChange)
    }, [])

    function toggleMode() {
        const nextMode = mode === 'normal' ? 'compact' : 'normal'
        setDashboardViewMode(nextMode)
        setMode(nextMode)
    }

    const label = mode === 'normal' ? 'Use compact dashboard navigation' : 'Use normal dashboard navigation'

    return (
        <button
            type='button'
            onClick={toggleMode}
            aria-label={label}
            title={label}
            className='group grid h-12 w-12 place-items-center rounded-lg hover:bg-[#6464641a]'
        >
            {mode === 'normal'
                ? <PanelLeftClose className='h-5 w-5 text-bright/75 group-hover:text-orange-300' />
                : <PanelLeftOpen className='h-5 w-5 text-bright/75 group-hover:text-orange-300' />}
        </button>
    )
}
