import { useState, useRef, useEffect, Dispatch, SetStateAction } from 'react'
import { ChevronDown, Eye, Wifi, WifiOff } from 'lucide-react'
import TerminalViewer from './terminalViewer'
import useTerminal from '@/hooks/useTerminal'

type ConsoleProps = {
    open: boolean
    setOpen: Dispatch<SetStateAction<boolean>>
    share: Share | null
}

export default function Terminal({ share, open, setOpen }: ConsoleProps) {
    const [height, setHeight] = useState(180)
    const [isDragging, setIsDragging] = useState(false)
    const startY = useRef(0)
    const startHeight = useRef(0)
    const [isDone, setIsDone] = useState(false)
    const { isConnected, participants, log } = useTerminal({ share })

    function handleMouseDown(e: React.MouseEvent) {
        setIsDragging(true)
        startY.current = e.clientY
        startHeight.current = height
        document.body.style.userSelect = 'none'
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isDragging) return

        const delta = startY.current - e.clientY
        const newHeight = Math.min(Math.max(startHeight.current + delta, 0), window.innerHeight * 0.9)
        setHeight(newHeight)
    }

    function handleMouseUp() {
        setIsDragging(false)
        document.body.style.userSelect = ''

        if (height < 200) {
            setOpen(false)
        }
    }

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'row-resize'
            document.body.classList.add('dragging')
        } else {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.classList.remove('dragging')
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging])

    useEffect(() => {
        setTimeout(() => {
            setIsDone(true)
        }, 1000)
    }, [])

    return (
        <>
            {isDragging && (
                <div
                    className="fixed inset-0 z-[9999]"
                    style={{ cursor: 'row-resize', userSelect: 'none', pointerEvents: 'all' }}
                />
            )}

            {/* Collapsed icon */}
            {!open && (
                <div
                    onClick={() => { setOpen(true); setHeight(180) }}
                    className="fixed bottom-2 left-1/2 -translate-x-1/2 bg-dark/40 hover:bg-dark px-8 py-1 rounded-md cursor-pointer transition-all border border-light/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.4)] backdrop-blur-md z-100"
                >
                    <div className="mx-auto w-10 h-1 bg-extralight group-hover:bg-white/30 rounded-full mt-[2.5px]" />
                </div>
            )}

            {/* Console container */}
            <div
                className={`fixed left-0 w-full bg-[#1e1e1e] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-150 ease-in-out z-100 ${open ? 'visible' : 'invisible'}`}
                style={{
                    bottom: 0,
                    height: open ? `${height}px` : '0px',
                }}
            >
                {/* Resize handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className="group absolute top-0 w-full h-2 cursor-row-resize hover:bg-light/10"
                >
                    <div className="mx-auto w-10 h-1 bg-extralight group-hover:bg-white/30 rounded-full mt-[5px]" />
                </div>

                {/* Header bar */}
                <div className="flex justify-between items-center px-3 py-1 bg-dark/60 text-xs text-gray-400 border-t border-light/20">
                    <div className='flex gap-2'>
                        <span>TERMINAL</span>
                        <span>{isConnected 
                            ? <Wifi className='w-3.5 h-3.5 stroke-green-500' /> 
                            : <WifiOff className='w-3.5 h-3.5 stroke-red-500' />
                        }</span>
                        <span className='flex justify-between items-center gap-1'>
                            <Eye className='h-3.5 w-3.5' />
                            <h1>{participants}</h1>
                        </span>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        className="hover:text-white transition-colors cursor-pointer"
                    >
                        <ChevronDown size={16} />
                    </button>
                </div>

                {/* Content area */}
                <div className="p-3 text-sm overflow-auto h-[calc(100%-30px)] font-mono text-gray-300">
                    <TerminalViewer text={log.map((l) => l.content)} isDone={isDone} />
                </div>
            </div>
        </>
    )
}
