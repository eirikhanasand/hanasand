'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import SupportChat from './supportChat'

const supportPaths = new Set([
    '/support',
    '/contact',
    '/faq',
    '/privacy',
    '/terms',
    '/cookies',
    '/cookie-settings',
    '/account-pending-deletion',
    '/reset-password',
])

export default function SupportAssistant({ force = false }: { force?: boolean }) {
    const pathname = usePathname()
    const visible = force || supportPaths.has(pathname || '')
    const [open, setOpen] = useState(false)
    const [eventVisible, setEventVisible] = useState(false)
    useEffect(() => {
        const openSupport = () => { setEventVisible(true); setOpen(true) }
        window.addEventListener('hanasand:open-support', openSupport)
        return () => window.removeEventListener('hanasand:open-support', openSupport)
    }, [])

    if (!visible && !eventVisible) return null

    return (
        <div className='fixed bottom-5 right-5 z-[1100]'>
            {open ? (
                <section className='grid h-[min(42rem,calc(100vh-2.5rem))] w-[min(25rem,calc(100vw-2rem))] grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-ui-border bg-ui-panel shadow-[0_24px_80px_rgba(0,0,0,0.18)]'>
                    <header className='flex items-center justify-end gap-3 px-4 py-3'>
                        <button type='button' onClick={() => setOpen(false)} className='grid h-9 w-9 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text' aria-label='Close support assistant'>
                            <X className='h-5 w-5' />
                        </button>
                    </header>

                    <SupportChat />
                </section>
            ) : (
                <button
                    type='button'
                    onClick={() => setOpen(true)}
                    className='grid h-16 w-16 place-items-center rounded-full bg-ui-text text-ui-canvas shadow-[0_18px_50px_rgba(0,0,0,0.24)] transition hover:scale-105'
                    aria-label='Open support assistant'
                >
                    <MessageCircle className='h-7 w-7' />
                </button>
            )}
        </div>
    )
}
