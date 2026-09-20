'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useMobileNavigation } from '@/components/layout/mobileNavigation'

export default function Menu() {
    const mobile = useMobileNavigation()
    if (!mobile.enabled) return null

    return <button type='button' onClick={mobile.toggle} aria-label={mobile.open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobile.open} aria-controls='mobile-navigation'
        className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border text-ui-muted hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary lg:hidden'>
        {mobile.open ? <PanelLeftClose /> : <PanelLeftOpen />}
    </button>
}
