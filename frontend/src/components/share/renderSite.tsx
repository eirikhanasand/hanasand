import { removeCookie, setCookie } from '@/utils/cookies'
import { Monitor } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'

type ShowSiteProps = {
    share: Share | null
    renderSite: boolean
    sharePageWidth: number
    setRenderSite: Dispatch<SetStateAction<boolean>>
    triggerChange: boolean | 'close'
    setTriggerChange: Dispatch<SetStateAction<boolean | 'close'>>
}

export default function RenderSite({ 
    share, 
    renderSite, 
    setRenderSite, 
    sharePageWidth, 
    triggerChange, 
    setTriggerChange
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
    }, [triggerChange, setTriggerChange])

    return (
        <div style={{ width }} className={`${renderSite ? 'relative' : 'absolute right-0 bottom-0 z-100 w-2 h-full'} pb-25`}>
            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20 pl-2 pr-8 group grid place-items-center"
                style={{ right: width - (renderSite ? 22 : 18) }}
            >
                <div style={{ left: renderSite ? 14 : 18 }} className="absolute w-2 l-100 h-full right-5 group-hover:bg-light" />
                <div className="absolute h-10 w-1 right-5 bg-extralight group-hover:bg-white/30 rounded-full" />
            </div>

            {renderSite && width > 0 && !share?.alias && (
                <h1 className='w-full h-full grid place-items-center text-center border-none text-gray-400 mt-13'>Loading...</h1>
            )}

            {renderSite && width > 0 && share?.alias && (
                <iframe
                    src={`https://${share.alias}.hanasand.com`}
                    className='absolute w-full h-full border-none rounded-lg'
                    title="Embedded Site"
                ></iframe>
            )}

            <div
                onClick={handleChange}
                className="
                    group fixed bottom-16 right-3 z-100 cursor-pointer select-none
                    w-[18.5%] min-w-[130px] py-2 rounded-xl text-center
                    hover:shadow-[0_0_10px_rgba(0,0,0,0.3)] duration-300
                    backdrop-blur-md bg-bright/3 group-hover:bg-bright/10 overflow-hidden
                    hover:scale-[1.03] hover:border-white/30 transition-all
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_8px_rgba(0,0,0,0.4)]
                "
            >
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-black/10" />

                <div className='grid place-items-center'>
                    <h1 className="relative z-10 text-white/90 font-semibold tracking-wide flex gap-2">
                        <Monitor /> {renderSite ? 'Hide site' : 'Show site'}
                    </h1>
                </div>
            </div>
        </div>
    )
}
