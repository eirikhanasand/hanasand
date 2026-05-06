import { type Dispatch, type FormEvent, type MouseEvent as ReactMouseEvent, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Eye, Power, RefreshCw, Send, Wifi, WifiOff } from 'lucide-react'
import TerminalViewer from './terminalViewer'
import useTerminal, { type TerminalCredentials, type TerminalLifecycle } from '@/hooks/useTerminal'
import { removeCookie, setCookie } from '@/utils/cookies/cookies'

type ConsoleProps = {
    open: boolean
    setOpen: Dispatch<SetStateAction<boolean>>
    share: Share | null
    shareTerminalHeight: number
    triggerChange: boolean | 'close'
    setTriggerChange: Dispatch<SetStateAction<boolean | 'close'>>
    setTerminalStatus: Dispatch<SetStateAction<string>>
    setTerminalCredentials: Dispatch<SetStateAction<TerminalCredentials | null>>
}

const DEFAULT_TERMINAL_HEIGHT = 320

export default function Terminal({
    share,
    open,
    setOpen,
    shareTerminalHeight,
    triggerChange,
    setTriggerChange,
    setTerminalStatus,
    setTerminalCredentials
}: ConsoleProps) {
    const [height, setHeight] = useState(shareTerminalHeight > 0 ? shareTerminalHeight : DEFAULT_TERMINAL_HEIGHT)
    const [isDragging, setIsDragging] = useState(false)
    const startY = useRef(0)
    const startHeight = useRef(0)
    const [isDone, setIsDone] = useState(false)
    const [command, setCommand] = useState('')
    const { isConnected, participants, chunks, status, credentials, lifecycle, sendInput, sendResize, reconnect, restart } = useTerminal({ share, active: open && Boolean(share) })
    const lastOpenRef = useRef(open)

    function handleMouseDown(e: ReactMouseEvent) {
        setIsDragging(true)
        startY.current = e.clientY
        startHeight.current = height
        document.body.style.userSelect = 'none'
    }

    const handleMouseMove: (e: MouseEvent) => void = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const delta = startY.current - e.clientY
        const newHeight = Math.min(Math.max(startHeight.current + delta, 0), window.innerHeight * 0.9)
        setHeight(newHeight)
    }, [isDragging])

    const handleMouseUp: () => void = useCallback(() => {
        setIsDragging(false)
        document.body.style.userSelect = ''
        if (startHeight.current > 0 && height < 50) {
            setOpen(false)
            setHeight(0)
        }
    }, [height, setOpen])

    const handleChange = useCallback(() => {
        if (open) {
            setOpen(false)
            setHeight(0)
        } else {
            setOpen(true)
            setHeight(shareTerminalHeight > 0 ? shareTerminalHeight : DEFAULT_TERMINAL_HEIGHT)
        }
    }, [open, setOpen, shareTerminalHeight])

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
    }, [handleMouseMove, handleMouseUp, isDragging])

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setIsDone(true)
        }, 1000)
        return () => window.clearTimeout(timeout)
    }, [])

    useEffect(() => {
        return () => {
            if (open) {
                setCookie('shareTerminalHeight', String(height))
            } else {
                removeCookie('shareTerminalHeight')
            }
        }
    }, [height, open])

    useEffect(() => {
        setTerminalStatus(status)
    }, [setTerminalStatus, status])

    useEffect(() => {
        setTerminalCredentials(credentials)
    }, [credentials, setTerminalCredentials])

    useEffect(() => {
        if (!triggerChange) {
            return
        }

        const frame = window.setTimeout(() => {
            if (triggerChange === 'close') {
                setOpen(false)
                setTriggerChange(false)
                return
            }

            handleChange()
            setTriggerChange(false)
        }, 0)

        return () => window.clearTimeout(frame)
    }, [handleChange, setOpen, setTriggerChange, triggerChange])

    useEffect(() => {
        if (open && !lastOpenRef.current) {
            setHeight(shareTerminalHeight > 0 ? shareTerminalHeight : DEFAULT_TERMINAL_HEIGHT)
        }
        lastOpenRef.current = open
    }, [open, shareTerminalHeight])

    function handleCommandSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const nextCommand = command.trim()
        if (!nextCommand) {
            return
        }

        sendInput(`${nextCommand}\r`)
        setCommand('')
    }

    return (
        <>
            {isDragging && (
                <div
                    className='fixed inset-0 z-9999'
                    style={{ cursor: 'row-resize', userSelect: 'none', pointerEvents: 'all' }}
                />
            )}

            {/* Collapsed icon */}
            {!open && (
                <button
                    type='button'
                    aria-label='Open terminal panel'
                    onClick={handleChange}
                    data-testid='share-terminal-toggle'
                    className='fixed bottom-2 left-1/2 -translate-x-1/2 bg-dark/40 hover:bg-dark px-8 py-1 rounded-md cursor-pointer transition-all border border-light/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.4)] backdrop-blur-md z-100'
                >
                    <div className='mx-auto w-10 h-1 bg-extralight group-hover:bg-white/30 rounded-full mt-[2.5px]' />
                </button>
            )}

            {/* Console container */}
            <div
                data-testid='share-terminal-panel'
                className={`fixed inset-x-0 w-screen max-w-none overflow-hidden bg-[#1e1e1e] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-150 ease-in-out z-100 ${open ? 'visible' : 'invisible'}`}
                style={{
                    bottom: 0,
                    height: open ? `${height}px` : '0px',
                }}
            >
                {/* Resize handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className='group absolute top-0 w-full h-2 cursor-row-resize hover:bg-light/10'
                >
                    <div className='mx-auto w-10 h-1 bg-extralight group-hover:bg-white/30 rounded-full mt-1.25' />
                </div>

                {/* Header bar */}
                <div className='flex h-[38px] shrink-0 justify-between items-center gap-3 px-3 py-1 bg-dark/60 text-xs text-gray-400 border-t border-light/20'>
                    <div className='flex min-w-0 items-center gap-2'>
                        <span className='font-semibold text-bright/78'>Browser terminal</span>
                        <span>{isConnected
                            ? <Wifi className='w-3.5 h-3.5 stroke-green-500' />
                            : <WifiOff className='w-3.5 h-3.5 stroke-red-500' />
                        }</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${lifecycleTone(lifecycle)}`}>
                            {lifecycleLabel(lifecycle)}
                        </span>
                        <span className='flex justify-between items-center gap-1'>
                            <Eye className='h-3.5 w-3.5' />
                            <h1>{participants}</h1>
                        </span>
                        <span className='max-w-[55vw] truncate text-bright/55'>
                            {status}
                        </span>
                    </div>
                    <div className='flex shrink-0 items-center gap-1'>
                        <button
                            type='button'
                            aria-label='Reconnect browser terminal'
                            title='Reconnect terminal'
                            onClick={reconnect}
                            className='grid h-7 w-7 place-items-center rounded-md text-bright/52 transition hover:bg-bright/10 hover:text-bright'
                        >
                            <RefreshCw size={14} />
                        </button>
                        <button
                            type='button'
                            aria-label='Restart browser terminal'
                            title='Restart terminal'
                            onClick={restart}
                            className='grid h-7 w-7 place-items-center rounded-md text-bright/52 transition hover:bg-bright/10 hover:text-bright'
                        >
                            <Power size={14} />
                        </button>
                        <button
                            type='button'
                            aria-label='Close terminal panel'
                            onClick={() => setOpen(false)}
                            className='grid h-7 w-7 place-items-center rounded-md text-bright/52 transition hover:bg-bright/10 hover:text-bright'
                        >
                            <ChevronDown size={16} />
                        </button>
                    </div>
                </div>

                <div className='h-[calc(100%-38px)] min-w-0 w-full overflow-hidden px-2 pb-2 pt-0 text-sm font-mono text-gray-300'>
                    {share && <TerminalViewer
                        open={open}
                        share={share}
                        sendInput={sendInput}
                        sendResize={sendResize}
                        chunks={chunks}
                        status={status}
                        isDone={isDone}
                    />}
                    <form
                        onSubmit={handleCommandSubmit}
                        className='absolute inset-x-2 bottom-2 z-20 flex items-center gap-2 rounded-md border border-bright/10 bg-[#171a14]/96 px-2 py-1.5 shadow-lg backdrop-blur'
                    >
                        <span className='rounded bg-bright/7 px-2 py-1 text-[11px] font-semibold text-bright/52'>
                            Command
                        </span>
                        <input
                            value={command}
                            onChange={(event) => setCommand(event.target.value)}
                            placeholder={isConnected ? 'Run a command...' : 'Terminal is reconnecting...'}
                            className='min-w-0 flex-1 bg-transparent px-1 text-sm text-bright outline-none placeholder:text-bright/34'
                            autoComplete='off'
                            spellCheck={false}
                        />
                        <button
                            type='submit'
                            aria-label='Send terminal command'
                            disabled={!command.trim()}
                            className='grid h-8 w-8 place-items-center rounded-md bg-[#9de18f]/14 text-[#b7f0aa] transition hover:bg-[#9de18f]/24 disabled:cursor-not-allowed disabled:opacity-40'
                        >
                            <Send size={15} />
                        </button>
                    </form>
                </div>
            </div>
        </>
    )
}

function lifecycleLabel(lifecycle: TerminalLifecycle) {
    switch (lifecycle) {
        case 'connecting':
            return 'Reconnecting'
        case 'waking':
            return 'VM waking'
        case 'preparing':
            return 'Preparing'
        case 'ready':
            return 'Terminal ready'
        case 'idle':
            return 'Idle'
        case 'shutting_down':
            return 'Shutting down'
        case 'error':
            return 'Needs attention'
        case 'closed':
        default:
            return 'Closed'
    }
}

function lifecycleTone(lifecycle: TerminalLifecycle) {
    switch (lifecycle) {
        case 'ready':
            return 'border-[#9de18f]/35 bg-[#9de18f]/12 text-[#b7f0aa]'
        case 'waking':
        case 'preparing':
        case 'connecting':
            return 'border-[#f0c66d]/30 bg-[#f0c66d]/10 text-[#f0d58e]'
        case 'idle':
            return 'border-bright/12 bg-bright/6 text-bright/58'
        case 'shutting_down':
        case 'error':
            return 'border-red-400/30 bg-red-400/10 text-red-200'
        case 'closed':
        default:
            return 'border-bright/10 bg-bright/5 text-bright/48'
    }
}
