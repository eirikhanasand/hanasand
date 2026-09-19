'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import SupportChat from './supportChat'
import { isInternalAppPath } from '@/utils/routes/appRoutes'
import isPublicProductPath from '@/utils/routes/isPublicProductPath'

export default function SupportAssistant({ force = false, internal = false }: { force?: boolean; internal?: boolean }) {
    const pathname = usePathname()
    const router = useRouter()
    const visible = !internal && !isInternalAppPath(pathname || '') && (force || isPublicProductPath(pathname) || pathname === '/faq')
    const [openPath, setOpenPath] = useState<string | null>(null)
    const open = openPath !== null && openPath === pathname
    useEffect(() => {
        const openSupport = () => {
            if (internal) router.push('/support')
            else if (visible) setOpenPath(pathname)
        }
        window.addEventListener('hanasand:open-support', openSupport)
        return () => window.removeEventListener('hanasand:open-support', openSupport)
    }, [internal, pathname, router, visible])

    if (!visible) return null

    return (
        <div className='fixed bottom-4 right-4 z-[1100]'>
            {open ? (
                <section role='dialog' aria-label='Support assistant' onKeyDown={event => { if (event.key === 'Escape') setOpenPath(null) }} className='grid h-[min(40rem,calc(100dvh-6rem))] w-[min(25rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-ui-border bg-ui-panel text-ui-text shadow-[0_24px_80px_rgba(0,0,0,0.18)]'>
                    <header className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-2'>
                        <h2 className='flex items-center gap-2 text-sm font-semibold'><MessageCircle className='h-4 w-4 text-ui-primary' />Support</h2>
                        <button type='button' onClick={() => setOpenPath(null)} className='grid h-9 w-9 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text' aria-label='Close support assistant'>
                            <X className='h-5 w-5' />
                        </button>
                    </header>

                    <SupportChat />
                </section>
            ) : (
                <button
                    type='button'
                    onClick={() => setOpenPath(pathname)}
                    className='grid h-16 w-16 place-items-center rounded-full bg-ui-text text-ui-canvas shadow-[0_18px_50px_rgba(0,0,0,0.24)] transition hover:scale-105'
                    aria-label='Open support assistant'
                >
                    <MessageCircle className='h-7 w-7' />
                </button>
            )}
        </div>
    )
}
