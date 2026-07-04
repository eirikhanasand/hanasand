'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { getDashboardViewMode, setDashboardViewMode } from '@/utils/layout/viewMode'

export default function ViewModeToggle() {
    const mode = useSyncExternalStore(
        (onStoreChange) => {
            function handleModeChange() {
                onStoreChange()
            }

            window.addEventListener('dashboard-view-mode', handleModeChange)
            return () => window.removeEventListener('dashboard-view-mode', handleModeChange)
        },
        () => getDashboardViewMode(),
        () => 'normal'
    )

    function toggleMode() {
        const nextMode = mode === 'normal' ? 'compact' : 'normal'
        setDashboardViewMode(nextMode)
    }

    const label = mode === 'normal' ? 'Collapse sidebar' : 'Expand sidebar'

    return (
        <button
            type='button'
            onClick={toggleMode}
            aria-label={label}
            title={label}
            className='group grid h-10 w-10 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
        >
            {mode === 'normal'
                ? <PanelLeftClose className='h-4.5 w-4.5' />
                : <PanelLeftOpen className='h-4.5 w-4.5' />}
        </button>
    )
}
