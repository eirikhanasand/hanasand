'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GripVertical, MessageCircle, Sparkles, X } from 'lucide-react'
import PublicSupportChat from './publicSupportChat'
import useSupportPosition from './useSupportPosition'
import { isInternalAppPath } from '@/utils/routes/appRoutes'
import isPublicProductPath from '@/utils/routes/isPublicProductPath'

export default function SupportAssistant({ force = false, internal = false }: { force?: boolean; internal?: boolean }) {
    const pathname = usePathname()
    const router = useRouter()
    const visible = !internal && !isInternalAppPath(pathname || '') && (force || isPublicProductPath(pathname) || pathname === '/faq')
    const floating = useSupportPosition(visible)
    const [unread, setUnread] = useState(0)
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
        <div ref={floating.ref} style={floating.style} className={`fixed z-[1100] ${floating.moving ? '' : 'transition-[right,bottom] duration-300 ease-out motion-reduce:transition-none'}`}>
            <section role='dialog' aria-label='Support assistant' onKeyDown={event => { if (event.key === 'Escape') setOpenPath(null) }} className={`${open ? 'grid' : 'hidden'} h-[min(36rem,calc(100dvh-2rem))] w-[min(25rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-ui-border bg-ui-panel text-ui-text shadow-[0_24px_80px_rgba(0,0,0,0.18)]`}>
                <header className='flex items-center justify-between gap-3 border-b border-ui-border px-5 py-4'>
                    <button type='button' {...floating.handlers} aria-label='Move support window' title='Drag to move, or use the arrow keys' className='flex min-w-0 flex-1 touch-none select-none items-center gap-3 rounded-lg text-left cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-ui-primary'><GripVertical className='h-4 w-4 shrink-0 text-ui-muted' aria-hidden='true' /><span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ui-primary text-ui-canvas'><Sparkles className='h-4 w-4' aria-hidden='true' /></span><span><span className='block text-sm font-semibold'>Hanasand AI</span><span className='mt-0.5 block text-xs text-ui-muted'>Support</span></span></button>
                    {!floating.isDefault ? <button type='button' onClick={floating.reset} title='Reset support position' aria-label='Reset support position' className='grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>
                        <svg viewBox='0 0 24 24' className='h-5 w-5' aria-hidden='true'><rect x='3' y='3' width='18' height='18' rx='2' fill='none' stroke='currentColor' strokeWidth='1.5' /><circle cx='16.5' cy='16.5' r='3' className='fill-blue-600' /></svg>
                    </button> : null}
                    <button type='button' onClick={() => setOpenPath(null)} className='grid h-9 w-9 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text' aria-label='Close support assistant'>
                        <X className='h-5 w-5' />
                    </button>
                </header>

                <PublicSupportChat active={open} onUnreadChange={setUnread} />
            </section>
            {!open ? (
                <button
                    type='button'
                    {...floating.handlers}
                    onClick={() => { if (!floating.wasDragged()) setOpenPath(pathname) }}
                    title='Drag to move, or use the arrow keys'
                    className='relative grid h-16 w-16 touch-none select-none place-items-center rounded-full bg-ui-text text-ui-canvas shadow-[0_18px_50px_rgba(0,0,0,0.24)] cursor-grab active:cursor-grabbing'
                    aria-label='Open support assistant'
                >
                    <MessageCircle className='h-7 w-7' />
                    {unread > 0 ? <span role='status' aria-label={`${unread} unread support ${unread === 1 ? 'reply' : 'replies'}`} className='absolute -right-0.5 -top-0.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-ui-panel bg-ui-danger px-1 text-[11px] font-semibold text-white'>{unread > 9 ? '9+' : unread}</span> : null}
                </button>
            ) : null}
        </div>
    )
}
