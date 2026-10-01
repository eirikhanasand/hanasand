'use client'

import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

export const DatabaseFullscreenContext = createContext(false)

export default function DatabaseStoragePanel({ stale, actions, children }: { stale: boolean, actions: ReactNode, children: ReactNode }) {
    const [fullscreen, setFullscreen] = useState(false)

    useEffect(() => {
        if (!fullscreen) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setFullscreen(false)
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', closeOnEscape)
        }
    }, [fullscreen])

    return <DatabaseFullscreenContext.Provider value={fullscreen}>
        <DashboardPanel id='storage-inventory' className={fullscreen ? 'fixed inset-0 z-[1200] m-0 flex h-dvh min-h-0 w-screen flex-col overflow-hidden rounded-none border-0 bg-ui-panel p-0 shadow-none' : 'min-w-0 overflow-hidden'}>
            <div className='flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ui-border px-5 py-4'>
                <div className='flex min-w-0 flex-wrap items-center gap-3'>
                    <h2 className='text-base font-semibold'>Storage and databases</h2>
                    {stale && <span className='text-xs text-ui-muted'>Last known sizes · status stale</span>}
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    {actions}
                    <button type='button' onClick={() => setFullscreen(value => !value)} aria-label={fullscreen ? 'Exit fullscreen database view' : 'Open fullscreen database view'} aria-pressed={fullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} className='ui-button ui-button-secondary ui-button-md !px-3'>
                        {fullscreen ? <Minimize2 aria-hidden className='h-4 w-4' /> : <Maximize2 aria-hidden className='h-4 w-4' />}
                    </button>
                </div>
            </div>
            <div className={fullscreen ? 'min-h-0 flex-1 overflow-auto' : 'min-w-0'}>{children}</div>
        </DashboardPanel>
    </DatabaseFullscreenContext.Provider>
}
