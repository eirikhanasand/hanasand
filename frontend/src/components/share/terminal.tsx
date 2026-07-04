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
    const commandInputRef = useRef<HTMLInputElement | null>(null)

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
            setHeight(preferredTerminalHeight(shareTerminalHeight))
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
            setHeight(preferredTerminalHeight(shareTerminalHeight))
            window.setTimeout(() => commandInputRef.current?.focus(), 120)
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
                    className='fixed bottom-2 left-1/2 z-100 -translate-x-1/2 cursor-pointer rounded-md border border-ui-border bg-ui-panel px-8 py-1 shadow-lg backdrop-blur-md transition-all hover:bg-ui-raised'
                >
                    <div className='mx-auto mt-[2.5px] h-1 w-10 rounded-full bg-ui-muted group-hover:bg-ui-primary/30' />
                </button>
            )}

            {/* Console container */}
            <div
                data-testid='share-terminal-panel'
                className={`fixed inset-x-0 z-100 flex w-screen max-w-none flex-col overflow-hidden bg-ui-canvas text-ui-text shadow-lg transition-all duration-150 ease-in-out ${open ? 'visible' : 'invisible'}`}
                style={{
                    bottom: 0,
                    height: open ? `${height}px` : '0px',
                }}
            >
                {/* Resize handle */}
                <div
                    onMouseDown={handleMouseDown}
                    role='separator'
                    aria-label='Resize terminal panel'
                    className='group absolute top-0 h-2 w-full cursor-row-resize hover:bg-ui-primary/10'
                >
                    <div className='mx-auto mt-1.25 h-1 w-10 rounded-full bg-ui-muted group-hover:bg-ui-primary/30' />
                </div>

                {/* Header bar */}
                <div className='flex min-h-[38px] shrink-0 flex-wrap justify-between gap-2 border-t border-ui-border bg-ui-panel px-3 py-1.5 text-xs text-ui-muted'>
                    <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                        <span className='font-semibold text-ui-text'>Browser terminal</span>
                        <span>{isConnected
                            ? <Wifi className='h-3.5 w-3.5 text-ui-success' />
                            : <WifiOff className='h-3.5 w-3.5 text-ui-danger' />
                        }</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${lifecycleTone(lifecycle)}`}>
                            {lifecycleLabel(lifecycle)}
                        </span>
                        <span className='flex justify-between items-center gap-1'>
                            <Eye className='h-3.5 w-3.5' />
                            <h1>{participants}</h1>
                        </span>
                        <span className='max-w-[42vw] truncate text-ui-muted sm:max-w-[55vw]'>
                            {status}
                        </span>
                    </div>
                    <div className='flex shrink-0 items-center gap-1'>
                        <button
                            type='button'
                            aria-label='Reconnect browser terminal'
                            title='Reconnect terminal'
                            onClick={reconnect}
                            className='grid h-7 w-7 place-items-center rounded-md text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-text'
                        >
                            <RefreshCw size={14} />
                        </button>
                        <button
                            type='button'
                            aria-label='Restart browser terminal'
                            title='Restart terminal'
                            onClick={restart}
                            className='grid h-7 w-7 place-items-center rounded-md text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-text'
                        >
                            <Power size={14} />
                        </button>
                        <button
                            type='button'
                            aria-label='Close terminal panel'
                            onClick={() => setOpen(false)}
                            className='grid h-7 w-7 place-items-center rounded-md text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-text'
                        >
                            <ChevronDown size={16} />
                        </button>
                    </div>
                </div>

                <div className='relative min-h-0 w-full flex-1 overflow-hidden px-2 pb-2 pt-0 text-sm font-mono text-ui-muted'>
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
                        className='absolute inset-x-2 bottom-2 z-20 flex flex-wrap items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-2 py-1.5 shadow-lg backdrop-blur sm:flex-nowrap'
                    >
                        <span className='rounded bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-primary'>
                            Command
                        </span>
                        <input
                            ref={commandInputRef}
                            aria-label='Terminal command'
                            value={command}
                            onChange={(event) => setCommand(event.target.value)}
                            placeholder={isConnected ? 'Run a command...' : 'Terminal is reconnecting...'}
                            className='min-w-0 flex-1 bg-transparent px-1 text-sm text-ui-text outline-none placeholder:text-ui-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'
                            autoComplete='off'
                            spellCheck={false}
                        />
                        <button
                            type='submit'
                            aria-label='Send terminal command'
                            disabled={!command.trim()}
                            className='grid h-8 w-8 place-items-center rounded-md bg-ui-success/15 text-ui-success transition hover:bg-ui-success/25 disabled:cursor-not-allowed disabled:opacity-40'
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
            return 'border-ui-success/35 bg-ui-success/10 text-ui-success'
        case 'waking':
        case 'preparing':
        case 'connecting':
            return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
        case 'idle':
            return 'border-ui-border bg-ui-raised text-ui-muted'
        case 'shutting_down':
        case 'error':
            return 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
        case 'closed':
        default:
            return 'border-ui-border bg-ui-raised text-ui-muted'
    }
}

function preferredTerminalHeight(savedHeight: number) {
    if (typeof window === 'undefined') {
        return savedHeight > 0 ? savedHeight : DEFAULT_TERMINAL_HEIGHT
    }

    if (window.innerWidth < 768) {
        return Math.min(Math.max(window.innerHeight * 0.58, 280), window.innerHeight * 0.78)
    }

    return savedHeight > 0 ? savedHeight : DEFAULT_TERMINAL_HEIGHT
}
