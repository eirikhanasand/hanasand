'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { hasAppSidebar } from '@/utils/routes/appRoutes'

const MobileNavigationContext = createContext({ enabled: false, open: false, toggle: () => {}, close: () => {} })

export function useMobileNavigation() {
    return useContext(MobileNavigationContext)
}

export default function MobileNavigation({ enabled, children }: { enabled: boolean, children: ReactNode }) {
    const pathname = usePathname()
    const [openPath, setOpenPath] = useState<string | null>(null)
    const trigger = useRef<HTMLElement | null>(null)
    const available = enabled && hasAppSidebar(pathname)
    const open = available && openPath === pathname
    function close() {
        setOpenPath(null)
        trigger.current?.focus()
    }
    useEffect(() => { setOpenPath(null) }, [pathname])
    useEffect(() => {
        if (!open) return
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') close()
        }
        const desktop = window.matchMedia('(min-width: 1024px)')
        function onResize() { if (desktop.matches) setOpenPath(null) }
        document.addEventListener('keydown', onKeyDown)
        desktop.addEventListener('change', onResize)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            desktop.removeEventListener('change', onResize)
        }
    }, [open])
    return <MobileNavigationContext.Provider value={{ enabled: available, open, close, toggle: () => {
        trigger.current = document.activeElement as HTMLElement
        setOpenPath(open ? null : pathname)
    } }}>{children}</MobileNavigationContext.Provider>
}
