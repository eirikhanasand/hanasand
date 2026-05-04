import { removeCookie, setCookie } from '@/utils/cookies/cookies'
import type { ShareRuntimeCapability } from '@/utils/share/runtimeCapabilities'
import { Monitor } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'

type ShowSiteProps = {
    share: Share | null
    renderSite: boolean
    sharePageWidth: number
    setRenderSite: Dispatch<SetStateAction<boolean>>
    triggerChange: boolean | 'close'
    setTriggerChange: Dispatch<SetStateAction<boolean | 'close'>>
    capability: ShareRuntimeCapability
}

export default function RenderSite({
    share,
    renderSite,
    setRenderSite,
    sharePageWidth,
    triggerChange,
    setTriggerChange,
    capability
}: ShowSiteProps) {
    const [width, setWidth] = useState(sharePageWidth)

    function handleMouseDown(e: React.MouseEvent) {
        e.preventDefault()
        const startX = e.clientX
        const startWidth = width

        function onMouseMove(e: MouseEvent) {
            const delta = e.clientX - startX
            const newWidth = Math.min(Math.max(startWidth - delta, 0), window.innerWidth * 0.9)
            setWidth(newWidth)
        }

        function cleanup() {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', cleanup)
            document.removeEventListener('mouseleave', cleanup)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            document.body.style.userSelect = ''
            document.body.style.cursor = ''

            setWidth(prev => {
                if (prev < 20) {
                    setRenderSite(false)
                    return 0
                }
                return prev
            })
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                cleanup()
            }
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', cleanup)
        document.addEventListener('mouseleave', cleanup)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'col-resize'
    }

    function fade(prev: boolean) {
        const start = width
        const target = prev ? 0 : 500
        const duration = 1000
        const minSpeed = 150

        const distance = Math.abs(target - start)
        const minDuration = (distance / minSpeed) * 1000
        const finalDuration = Math.min(duration, minDuration)

        const startTime = performance.now()

        function animate(now: number) {
            const elapsed = now - startTime
            const t = Math.min(elapsed / finalDuration, 1)
            const newWidth = start + (target - start) * t
            setWidth(newWidth)

            if (t < 1) requestAnimationFrame(animate)
        }

        requestAnimationFrame(animate)
    }

    function handleChange() {
        setRenderSite(prev => { fade(prev); return !prev })
    }

    useEffect(() => {
        if (width >= 20 && !renderSite) {
            setRenderSite(true)
        } else if (width < 20 && renderSite) {
            setRenderSite(false)
        }

        return () => {
            if (renderSite) {
                setCookie('sharePageWidth', String(width))
            } else {
                removeCookie('sharePageWidth')
            }
        }
    }, [width, renderSite, setRenderSite])

    useEffect(() => {
        if (!capability.hasHttpSurface) {
            if (renderSite) {
                setRenderSite(false)
            }
            if (triggerChange) {
                setTriggerChange(false)
            }
            return
        }

        if (triggerChange === 'close') {
            fade(true)
            setRenderSite(false)
            setTriggerChange(false)
            return
        }

        if (triggerChange) {
            handleChange()
            setTriggerChange(false)
        }
    }, [capability.hasHttpSurface, renderSite, setRenderSite, triggerChange, setTriggerChange])

    if (!capability.hasHttpSurface) {
        return null
    }

    return (
        <div style={{ width }} className={`${renderSite ? 'relative min-w-0 shrink-0' : 'absolute right-0 bottom-0 z-100 w-2 h-full'} pb-25`}>
            <div
                onMouseDown={handleMouseDown}
                className='absolute top-0 right-0 h-full w-2 cursor-col-resize z-20 pl-2 pr-8 group grid place-items-center'
                style={{ right: width - (renderSite ? 22 : 18) }}
            >
                <div style={{ left: renderSite ? 14 : 18 }} className='absolute w-2 l-100 h-full right-5 group-hover:bg-light' />
                <div className='absolute h-10 w-1 right-5 bg-extralight group-hover:bg-white/30 rounded-full' />
            </div>

            {renderSite && width > 0 && !capability.canPreview && (
                <h1 className='w-full h-full grid place-items-center px-6 text-center border-none text-sm text-bright/45 mt-13'>{capability.reason}</h1>
            )}

            {renderSite && width > 0 && capability.canPreview && share?.alias && (
                <iframe
                    src={`https://${share.alias}.hanasand.com`}
                    className='absolute w-full h-full min-w-0 border-none rounded-lg'
                    title='Embedded Site'
                ></iframe>
            )}

            <button
                type='button'
                aria-label={renderSite ? 'Hide site' : 'Show site'}
                onClick={handleChange}
                className='
                    group fixed bottom-15 right-3 z-100 inline-flex max-w-[calc(100vw-1.5rem)]
                    cursor-pointer select-none items-center justify-center gap-2 rounded-full
                    border border-bright/10 bg-black/55 px-3.5 py-2 text-sm text-bright/78
                    shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-md transition
                    hover:border-bright/22 hover:bg-bright/8 hover:text-bright
                '
            >
                <Monitor className='h-4 w-4 shrink-0' />
                <span className='truncate'>{renderSite ? 'Hide site' : 'Show site'}</span>
            </button>
        </div>
    )
}
